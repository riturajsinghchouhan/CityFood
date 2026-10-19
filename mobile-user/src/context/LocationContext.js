// Current location, delivery-address mode and service zone in one provider. Merges the web's
// LocationProvider.jsx, hooks/useLocation.jsx (useLocationEngine), hooks/useZone.jsx and
// utils/locationPersistence.js. expo-location replaces navigator.geolocation; reverse geocoding
// is the backend first, then Google (if EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set) or
// BigDataCloud + Nominatim, exactly as on web. Window events become direct calls.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useLatest from "../hooks/useLatest";
import * as Location from "expo-location";
import { setZoneContext } from "../api/client";
import * as locationApi from "../api/location";
import { GOOGLE_MAPS_API_KEY } from "../config";
import { readCached, writeCached } from "../storage/cached";
import { KEYS, store } from "../storage";
import { useAuth } from "./AuthContext";

const LOCATION_TTL_MS = 24 * 60 * 60 * 1000;
const GEOCODE_MIN_INTERVAL_MS = 60000;
const GEOCODE_REUSE_DISTANCE_METERS = 75;
const DB_LOCATION_FETCH_TTL_MS = 2 * 60 * 1000;
const DB_UPDATE_MIN_DISTANCE_METERS = 30;
const DB_UPDATE_MIN_INTERVAL_MS = 90 * 1000;
const ZONE_CACHE_TTL_MS = 30 * 1000;
const OUT_OF_SERVICE_STATUSES = new Set(["OUT_OF_SERVICE", "OUT_OF_RADIUS", "OUT_OF_ZONE"]);
const COORDS_PATTERN = /^-?\d+\.\d+,\s*-?\d+\.\d+$/;
const TIMEOUT = 3;
const PERMISSION_DENIED = 1;

const PLACEHOLDER = {
  city: "Current Location",
  state: "",
  country: "",
  area: "",
  address: "Select location",
  formattedAddress: "Select location",
};
const SELECT_LOCATION = { city: "Select location", address: "Select location", formattedAddress: "Select location" };

const distanceMeters = (lat1, lng1, lat2, lng2) => {
  if ([lat1, lng1, lat2, lng2].some((v) => typeof v !== "number")) return Number.POSITIVE_INFINITY;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111320;
};

const isInIndia = (lat, lng) => lat >= 6.5 && lat <= 37.1 && lng >= 68.7 && lng <= 97.4 && lng > 0;

const hasPlaceholder = (loc) =>
  loc?.city === "Current Location" ||
  loc?.address === "Select location" ||
  loc?.formattedAddress === "Select location" ||
  (!loc?.city && !loc?.address && !loc?.formattedAddress && !loc?.area);

const hasCoords = (loc) => Number.isFinite(Number(loc?.latitude)) && Number.isFinite(Number(loc?.longitude));

const roundCoord = (v, digits = 5) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
};

function geoError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(geoError(TIMEOUT, "Location request timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function fetchJson(url, ms, headers) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ---- Reverse geocoding (module-level dedupe across the app, as on web) ----
let geocodeInFlight = null;
let geocodeLastStartAt = 0;
let geocodeLastCoords = { latitude: null, longitude: null };
let geocodeLastSuccess = null;

async function reverseGeocodeDirect(latitude, longitude) {
  const now = Date.now();
  const moved = distanceMeters(geocodeLastCoords.latitude, geocodeLastCoords.longitude, latitude, longitude);
  if (geocodeLastSuccess && moved < GEOCODE_REUSE_DISTANCE_METERS && now - geocodeLastStartAt < GEOCODE_MIN_INTERVAL_MS) {
    return geocodeLastSuccess;
  }
  if (geocodeInFlight && moved < GEOCODE_REUSE_DISTANCE_METERS) {
    try {
      return await geocodeInFlight;
    } catch {
      // fall through to a fresh attempt
    }
  }
  geocodeLastStartAt = now;
  geocodeLastCoords = { latitude, longitude };

  const run = (async () => {
    try {
      let googleResult = null;
      let area = "";
      let city = "";
      let state = "";
      let country = "India";
      let formattedAddress = "";

      if (GOOGLE_MAPS_API_KEY) {
        try {
          const data = await fetchJson(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`,
            4000,
          );
          if (data.status === "OK" && data.results?.length > 0) {
            googleResult = data.results[0];
            formattedAddress = googleResult.formatted_address;
            const c = googleResult.address_components || [];
            const find = (type) => c.find((x) => x.types.includes(type))?.long_name;
            area = find("sublocality_level_1") || find("sublocality") || find("neighborhood") || "";
            city = find("locality") || "";
            state = find("administrative_area_level_1") || "";
            country = find("country") || "India";
          }
        } catch {
          googleResult = null;
        }
      }

      if (!googleResult) {
        const bdc = await fetchJson(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          3000,
        );
        let nominatim = null;
        try {
          nominatim = await fetchJson(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            3000,
            { "Accept-Language": "en", "User-Agent": "CityFood-App" },
          );
        } catch {
          nominatim = null;
        }
        const bdcFormatted = bdc.formattedAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        formattedAddress = nominatim?.display_name || bdcFormatted;
        city = bdc.city || bdc.locality || bdc.principalSubdivision || "";
        state = bdc.principalSubdivision || "";
        if (nominatim?.address) {
          const a = nominatim.address;
          area = a.suburb || a.neighbourhood || a.road || "";
        }
        if (!area) area = bdc.subLocality || "";
      }

      const value = { city, state, country, area, mainTitle: area || city, address: formattedAddress, formattedAddress };
      geocodeLastSuccess = value;
      return value;
    } catch {
      const coords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      return { city: "Current Location", address: coords, formattedAddress: coords };
    } finally {
      geocodeInFlight = null;
    }
  })();
  geocodeInFlight = run;
  return run;
}

// Web's reverseGeocodeWithGoogleMaps: backend /food/location/reverse-geocode, then the direct chain.
export async function reverseGeocodeAddress(latitude, longitude) {
  try {
    const res = await locationApi.reverseGeocode(latitude, longitude);
    const loc = res?.data?.location;
    if (loc?.formattedAddress && loc?.source !== "coords_only") {
      const value = {
        city: loc.city || "",
        state: loc.state || "",
        country: loc.country || "India",
        area: loc.area || "",
        mainTitle: loc.area || loc.city,
        address: loc.address || loc.formattedAddress,
        formattedAddress: loc.formattedAddress,
      };
      geocodeLastSuccess = value;
      return value;
    }
  } catch {
    // use the direct fallback
  }
  return reverseGeocodeDirect(latitude, longitude);
}

// ---- Zone detection cache (module-level, 30 s per rounded point) ----
const zoneCache = new Map();
const zoneInFlight = new Map();

export function getServiceUnavailableMessage(status) {
  if (status === "OUT_OF_RADIUS") return "Service in this area is currently unavailable at the moment.";
  if (status === "OUT_OF_ZONE" || status === "OUT_OF_SERVICE") return "Service is not available in this zone yet.";
  return "";
}

// One automatic GPS fetch per app launch (web used sessionStorage "locationFetched").
let fetchedThisSession = false;

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const { ready: authReady, isAuthenticated, onLogout } = useAuth();
  const authRef = useLatest(isAuthenticated);

  const [hydrated, setHydrated] = useState(false);
  const [engineLocation, setEngineLocationState] = useState(null);
  const [storedLocation, setStoredLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [deliveryAddressMode, setDeliveryAddressModeState] = useState("saved");
  const [savedLocationOverride, setSavedLocationOverride] = useState(null);

  const [zoneId, setZoneId] = useState(null);
  const [zone, setZone] = useState(null);
  const [zoneStatus, setZoneStatus] = useState("loading");
  const [zoneLoading, setZoneLoading] = useState(false);
  const [zoneError, setZoneError] = useState(null);

  const engineLocationRef = useRef(null);
  const storedLocationRef = useRef(null);
  const storedZoneRef = useRef({ zoneId: null, zoneStatus: null, zone: null });
  const watchSubRef = useRef(null);
  const updateTimerRef = useRef(null);
  const prevWatchCoordsRef = useRef({ latitude: null, longitude: null });
  const lastResolvedAddressRef = useRef(null);
  const lastDbLocationRef = useRef(null);
  const lastDbLocationFetchAtRef = useRef(0);
  const lastDbUpdateAtRef = useRef(0);
  const lastDbUpdatedCoordsRef = useRef({ latitude: null, longitude: null });
  const prevZoneCoordsRef = useRef({ latitude: null, longitude: null });
  const zoneDebounceRef = useRef(null);
  const mountedRef = useRef(true);

  const setEngineLocation = useCallback((loc) => {
    engineLocationRef.current = loc;
    setEngineLocationState(loc);
  }, []);

  // ---- persistence (locationPersistence.js) ----
  const persistDeliveryAddressMode = useCallback((mode) => {
    if (mode === "saved" || mode === "current") store.set(KEYS.locationMode, mode);
    else store.remove(KEYS.locationMode);
  }, []);

  const persistUserLocation = useCallback(
    (loc, { mode } = {}) => {
      if (!loc?.latitude || !loc?.longitude) return;
      storedLocationRef.current = loc;
      setStoredLocation(loc);
      writeCached(KEYS.location, loc, LOCATION_TTL_MS);
      if (mode === "saved" || mode === "current") persistDeliveryAddressMode(mode);
    },
    [persistDeliveryAddressMode],
  );

  const clearStoredUserLocation = useCallback(() => {
    storedLocationRef.current = null;
    setStoredLocation(null);
    store.remove(KEYS.location);
  }, []);

  const persistZoneContext = useCallback(({ zoneId: id = null, zone: data = null, status = null } = {}) => {
    storedZoneRef.current = { zoneId: id, zoneStatus: status, zone: data };
    if (id) store.set(KEYS.zoneId, id);
    else store.remove(KEYS.zoneId);
    if (status) store.set(KEYS.zoneStatus, status);
    else store.remove(KEYS.zoneStatus);
    if (data) writeCached(KEYS.zoneData, data, LOCATION_TTL_MS);
    else store.remove(KEYS.zoneData);
  }, []);

  // Replaces the web's "userLocationUpdated" event: engine and saved override follow it.
  const notifyLocationUpdated = useCallback(
    (loc) => {
      if (!loc) return;
      setEngineLocation(loc);
      setPermissionGranted(true);
      setLoading(false);
      setSavedLocationOverride(loc);
    },
    [setEngineLocation],
  );

  // ---- DB sync (logged-in users only) ----
  const updateLocationInDB = useCallback(async (loc) => {
    try {
      if (hasPlaceholder(loc) || !authRef.current) return;
      const moved = distanceMeters(
        lastDbUpdatedCoordsRef.current.latitude,
        lastDbUpdatedCoordsRef.current.longitude,
        loc.latitude,
        loc.longitude,
      );
      if (moved < DB_UPDATE_MIN_DISTANCE_METERS && Date.now() - lastDbUpdateAtRef.current < DB_UPDATE_MIN_INTERVAL_MS) return;
      const payload = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address || "",
        city: loc.city || "",
        state: loc.state || "",
        area: loc.area || "",
        formattedAddress: loc.formattedAddress || loc.address || "",
      };
      if (loc.accuracy !== undefined && loc.accuracy !== null) payload.accuracy = loc.accuracy;
      if (loc.postalCode) payload.postalCode = loc.postalCode;
      if (loc.street) payload.street = loc.street;
      if (loc.streetNumber) payload.streetNumber = loc.streetNumber;
      await locationApi.updateLocation(payload);
      lastDbUpdatedCoordsRef.current = { latitude: payload.latitude, longitude: payload.longitude };
      lastDbUpdateAtRef.current = Date.now();
    } catch {
      // Best effort, as on web.
    }
  }, []);

  const fetchLocationFromDB = useCallback(async () => {
    try {
      if (!authRef.current) return null;
      if (lastDbLocationRef.current && Date.now() - lastDbLocationFetchAtRef.current < DB_LOCATION_FETCH_TTL_MS) {
        return lastDbLocationRef.current;
      }
      const res = await locationApi.getLocation();
      const loc = res?.data?.location;
      if (!loc?.latitude || !loc?.longitude) return null;
      const remember = (value) => {
        lastDbLocationRef.current = value;
        lastDbLocationFetchAtRef.current = Date.now();
        return value;
      };
      if (!isInIndia(loc.latitude, loc.longitude)) {
        return remember({ latitude: loc.latitude, longitude: loc.longitude, ...PLACEHOLDER });
      }
      const usable =
        (loc.formattedAddress && loc.formattedAddress !== "Select location") ||
        (loc.address && loc.address !== "Select location") ||
        (loc.city && loc.city !== "Current Location");
      if (usable) {
        return remember({
          latitude: loc.latitude,
          longitude: loc.longitude,
          city: loc.city || "Current Location",
          area: loc.area || "",
          state: loc.state || "",
          country: loc.country || "",
          address: loc.address || loc.formattedAddress || "Select location",
          formattedAddress: loc.formattedAddress || loc.address || "Select location",
        });
      }
      try {
        const addr = await reverseGeocodeAddress(loc.latitude, loc.longitude);
        return remember({ ...addr, latitude: loc.latitude, longitude: loc.longitude });
      } catch {
        return remember({
          latitude: loc.latitude,
          longitude: loc.longitude,
          city: "Current Location",
          area: "",
          state: "",
          address: "Select location",
          formattedAddress: "Select location",
        });
      }
    } catch {
      return null;
    }
  }, []);

  // ---- GPS ----
  const ensurePermission = useCallback(async (prompt) => {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted" && prompt && perm.canAskAgain !== false) {
      perm = await Location.requestForegroundPermissionsAsync();
    }
    return perm.status === "granted";
  }, []);

  // High accuracy for 15 s, then a cached (<= 5 min) or balanced fix in 5 s, like the web retry.
  const readPosition = useCallback(async (forceFresh) => {
    if (!forceFresh) {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 300000 }).catch(() => null);
      if (last) return last;
    }
    try {
      return await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 15000);
    } catch (err) {
      if (err?.code !== TIMEOUT) throw err;
      const last = await Location.getLastKnownPositionAsync({ maxAge: 300000 }).catch(() => null);
      if (last) return last;
      return withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 5000);
    }
  }, []);

  const processPosition = useCallback(
    async (pos, { updateDB, showLoading }) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const done = (loc) => {
        setPermissionGranted(true);
        if (showLoading) setLoading(false);
        return loc;
      };
      try {
        let addr;
        if (!isInIndia(latitude, longitude)) {
          addr = { ...PLACEHOLDER };
        } else {
          try {
            addr = await reverseGeocodeAddress(latitude, longitude);
          } catch {
            addr = await reverseGeocodeDirect(latitude, longitude).catch(() => ({ ...PLACEHOLDER }));
            if (addr.city === "Current Location" || String(addr.address || "").includes(latitude.toFixed(4))) {
              addr = { ...PLACEHOLDER };
            }
          }
        }
        if (addr?.formattedAddress && addr.formattedAddress !== "Select location") {
          lastResolvedAddressRef.current = addr;
        }
        const formattedAddress = addr.formattedAddress || "";
        let displayAddress = addr.address || "";
        if (COORDS_PATTERN.test(displayAddress.trim())) {
          if (addr.area && addr.area.trim() !== "") displayAddress = addr.area;
          else if (addr.city && addr.city.trim() !== "" && addr.city !== "Unknown City") displayAddress = addr.city;
        }
        const finalLoc = {
          ...addr,
          latitude,
          longitude,
          accuracy: accuracy || null,
          address: displayAddress,
          formattedAddress: formattedAddress || addr.formattedAddress || displayAddress,
        };
        if (hasPlaceholder(finalLoc)) {
          // Shown, never persisted.
          const coordOnly = {
            latitude,
            longitude,
            accuracy: accuracy || null,
            city: finalLoc.city,
            address: finalLoc.address,
            formattedAddress: finalLoc.formattedAddress,
          };
          setEngineLocation(coordOnly);
          setError(null);
          return done(coordOnly);
        }
        persistUserLocation(finalLoc);
        setEngineLocation(finalLoc);
        setError(null);
        done(finalLoc);
        if (updateDB) await updateLocationInDB(finalLoc);
        return finalLoc;
      } catch {
        try {
          const last = await reverseGeocodeDirect(latitude, longitude);
          if (
            last &&
            last.city !== "Current Location" &&
            !String(last.address || "").includes(latitude.toFixed(4)) &&
            last.formattedAddress &&
            !last.formattedAddress.includes(latitude.toFixed(4))
          ) {
            const lastLoc = { ...last, latitude, longitude, accuracy: accuracy || null };
            persistUserLocation(lastLoc);
            setEngineLocation(lastLoc);
            setError(null);
            done(lastLoc);
            if (updateDB) await updateLocationInDB(lastLoc);
            return lastLoc;
          }
        } catch {
          // fall through to the placeholder
        }
        const fallback = { latitude, longitude, city: "Current Location", area: "", state: "", address: "Select location", formattedAddress: "Select location" };
        setEngineLocation(fallback);
        return done(fallback);
      }
    },
    [persistUserLocation, setEngineLocation, updateLocationInDB],
  );

  const handleGeoError = useCallback(
    async (err, dbLocation, showLoading) => {
      const message = err?.message || "Failed to get location";
      try {
        const fallback = dbLocation || (await fetchLocationFromDB()) || storedLocationRef.current;
        if (fallback) {
          setEngineLocation(fallback);
          if (err?.code !== TIMEOUT) setError(message);
          setPermissionGranted(true);
          if (showLoading) setLoading(false);
          return fallback;
        }
        setEngineLocation(SELECT_LOCATION);
        setError(err?.code === TIMEOUT ? "Location request timed out. Please try again." : message);
        setPermissionGranted(false);
        if (showLoading) setLoading(false);
        return SELECT_LOCATION;
      } catch {
        setEngineLocation(null);
        setError(err?.code === TIMEOUT ? "Location request timed out. Please try again." : message);
        setPermissionGranted(false);
        if (showLoading) setLoading(false);
        return null;
      }
    },
    [fetchLocationFromDB, setEngineLocation],
  );

  // Web getLocation(updateDB, forceFresh, showLoading): DB copy first unless forced, then GPS.
  const getLocation = useCallback(
    async (updateDB = true, forceFresh = false, showLoading = false) => {
      const dbLocation = !forceFresh ? await fetchLocationFromDB() : null;
      if (dbLocation && !forceFresh) {
        setEngineLocation(dbLocation);
        if (showLoading) setLoading(false);
        return dbLocation;
      }
      let pos;
      try {
        const granted = await ensurePermission(true);
        if (!granted) throw geoError(PERMISSION_DENIED, "Location permission denied");
        pos = await readPosition(forceFresh);
      } catch (err) {
        return handleGeoError(err, dbLocation, showLoading);
      }
      return processPosition(pos, { updateDB, showLoading });
    },
    [fetchLocationFromDB, setEngineLocation, ensurePermission, readPosition, handleGeoError, processPosition],
  );

  // ---- watch (only when a screen asks; the web never auto-starts it) ----
  const stopWatchingLocation = useCallback(() => {
    watchSubRef.current?.remove();
    watchSubRef.current = null;
    clearTimeout(updateTimerRef.current);
  }, []);

  const startWatchingLocation = useCallback(async () => {
    stopWatchingLocation();
    try {
      if (!(await ensurePermission(false))) {
        setError("Location permission denied");
        setPermissionGranted(false);
        return;
      }
      watchSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          // Geocode once: reuse the last resolved address instead of geocoding every tick.
          const addr =
            isInIndia(latitude, longitude) && lastResolvedAddressRef.current?.formattedAddress
              ? lastResolvedAddressRef.current
              : { ...PLACEHOLDER };
          let formattedAddress = addr.formattedAddress || "";
          let displayAddress = addr.address || "";
          if (COORDS_PATTERN.test(formattedAddress.trim()) || !formattedAddress || formattedAddress === "Select location") {
            const parts = [addr.area, addr.city, addr.state].filter((p) => p && p.trim() !== "");
            if (parts.length > 0) {
              formattedAddress = parts.join(", ");
              displayAddress = addr.area || addr.city || "Select location";
            } else {
              formattedAddress = addr.city || "Select location";
              displayAddress = addr.city || "Select location";
            }
          }
          if (COORDS_PATTERN.test(displayAddress.trim())) displayAddress = addr.area || addr.city || "Select location";
          const loc = { ...addr, latitude, longitude, accuracy: accuracy || null, address: displayAddress, formattedAddress };

          const current = engineLocationRef.current;
          if (current?.latitude && current?.longitude) {
            const moved = distanceMeters(current.latitude, current.longitude, latitude, longitude);
            const currentParts = (current.formattedAddress || "").split(",").filter((p) => p.trim()).length;
            const newParts = formattedAddress.split(",").filter((p) => p.trim()).length;
            if (moved <= 10 && newParts <= currentParts) return;
          }
          if (hasPlaceholder(loc)) return;

          const prev = prevWatchCoordsRef.current;
          const changed =
            !prev.latitude ||
            !prev.longitude ||
            Math.abs(prev.latitude - latitude) > 0.0001 ||
            Math.abs(prev.longitude - longitude) > 0.0001;
          const label = loc.label || storedLocationRef.current?.label;
          const persisted = label && String(label).trim() ? { ...loc, label: String(label).trim() } : loc;
          persistUserLocation(persisted);
          if (changed) {
            prevWatchCoordsRef.current = { latitude, longitude };
            setEngineLocation(persisted);
            setPermissionGranted(true);
            setError(null);
          }
          clearTimeout(updateTimerRef.current);
          updateTimerRef.current = setTimeout(() => updateLocationInDB(loc), 5000);
        },
      );
    } catch (err) {
      setError(err?.message || "Failed to watch location");
    }
  }, [stopWatchingLocation, ensurePermission, persistUserLocation, setEngineLocation, updateLocationInDB]);

  // ---- hydrate from storage ----
  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    Promise.all([
      readCached(KEYS.location),
      store.get(KEYS.locationMode),
      store.get(KEYS.zoneId),
      store.get(KEYS.zoneStatus),
      readCached(KEYS.zoneData),
    ]).then(([loc, mode, savedZoneId, savedZoneStatus, savedZone]) => {
      if (!active) return;
      storedLocationRef.current = loc || null;
      setStoredLocation(loc || null);
      if (mode === "saved" || mode === "current") setDeliveryAddressModeState(mode);
      storedZoneRef.current = { zoneId: savedZoneId || null, zoneStatus: savedZoneStatus || null, zone: savedZone || null };
      setZoneId(savedZoneId || null);
      setZone(savedZone || null);
      setZoneStatus(savedZoneId ? "IN_SERVICE" : savedZoneStatus || "loading");
      setHydrated(true);
    });
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, []);

  // ---- startup (web useLocationEngine INIT effect), once storage and auth are ready ----
  const startedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !authReady || startedRef.current) return undefined;
    startedRef.current = true;
    const loadingTimeout = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          const loc = engineLocationRef.current;
          if (!loc || (loc.formattedAddress === "Select location" && !loc.latitude && !loc.city)) {
            setEngineLocation(SELECT_LOCATION);
          }
        }
        return false;
      });
    }, 5000);

    (async () => {
      const stored = storedLocationRef.current;
      let hasInitial = false;
      let shouldForceRefresh = false;
      if (stored) {
        if (hasCoords(stored)) {
          setEngineLocation(stored);
          setPermissionGranted(true);
          setLoading(false);
          hasInitial = true;
        } else {
          shouldForceRefresh = true;
        }
      }
      if (!hasInitial) {
        const dbLoc = await fetchLocationFromDB();
        if (dbLoc && hasCoords(dbLoc)) {
          setEngineLocation(dbLoc);
          setPermissionGranted(true);
          setLoading(false);
          hasInitial = true;
        } else {
          setLoading(false);
          shouldForceRefresh = true;
        }
      }
      try {
        const perm = await Location.getForegroundPermissionsAsync().catch(() => ({ status: "undetermined" }));
        const granted = perm.status === "granted";
        const mode = (await store.get(KEYS.locationMode)) || "saved";
        const shouldAutoFetch = mode !== "saved" && !fetchedThisSession;
        if (!granted && !shouldAutoFetch && hasInitial) {
          setLoading(false);
          return;
        }
        if (shouldForceRefresh || !hasInitial || shouldAutoFetch) {
          fetchedThisSession = true;
          const loc = await getLocation(true, shouldForceRefresh || shouldAutoFetch);
          if (mountedRef.current && loc && loc.formattedAddress !== "Select location" && loc.city !== "Current Location") {
            setEngineLocation(loc);
            setPermissionGranted(true);
          }
        }
      } catch {
        setLoading(false);
      }
    })();

    return () => clearTimeout(loadingTimeout);
  }, [hydrated, authReady, fetchLocationFromDB, getLocation, setEngineLocation]);

  useEffect(() => () => stopWatchingLocation(), [stopWatchingLocation]);

  // The DB copy belongs to the previous user.
  useEffect(
    () =>
      onLogout(() => {
        lastDbLocationRef.current = null;
        lastDbLocationFetchAtRef.current = 0;
        lastDbUpdateAtRef.current = 0;
        lastDbUpdatedCoordsRef.current = { latitude: null, longitude: null };
      }),
    [onLogout],
  );

  // ---- provider actions (LocationProvider.jsx) ----
  const setDeliveryAddressMode = useCallback(
    (mode) => {
      persistDeliveryAddressMode(mode);
      setDeliveryAddressModeState(mode);
      if (mode === "current") setSavedLocationOverride(null);
    },
    [persistDeliveryAddressMode],
  );

  // options: {mode: "saved" | "current" (default "saved"), persistDb (default true)}
  const setSavedLocation = useCallback(
    async (payload, options = {}) => {
      if (!payload?.latitude || !payload?.longitude) return;
      const mode = options.mode || "saved";
      setSavedLocationOverride(payload);
      persistUserLocation(payload, { mode });
      notifyLocationUpdated(payload);
      setDeliveryAddressMode(mode);
      if (options.persistDb !== false && authRef.current) {
        try {
          await locationApi.updateLocation(payload);
        } catch {
          // ignore, as on web
        }
      }
    },
    [persistUserLocation, notifyLocationUpdated, setDeliveryAddressMode],
  );

  // Fresh GPS fix on user action; switches delivery to "current". Resolves to the location.
  const requestLocation = useCallback(
    async (updateDB = true, forceFresh = true) => {
      setSavedLocationOverride(null);
      setLoading(true);
      setError(null);
      let result;
      try {
        persistDeliveryAddressMode("current");
        setDeliveryAddressModeState("current");
        if (forceFresh) clearStoredUserLocation();
        result = await getLocation(updateDB, forceFresh, true);
      } catch (err) {
        setError(err?.message || "Failed to get location");
        throw err;
      } finally {
        setLoading(false);
      }
      if (result?.latitude) {
        persistUserLocation(result, { mode: "current" });
        setDeliveryAddressMode("current");
        notifyLocationUpdated(result);
      }
      return result;
    },
    [persistDeliveryAddressMode, clearStoredUserLocation, getLocation, persistUserLocation, setDeliveryAddressMode, notifyLocationUpdated],
  );

  useEffect(() => {
    if (engineLocation?.latitude && engineLocation?.longitude && deliveryAddressMode === "current") {
      persistUserLocation(engineLocation, { mode: "current" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineLocation?.latitude, engineLocation?.longitude, engineLocation?.formattedAddress, deliveryAddressMode]);

  const location = useMemo(() => {
    if (deliveryAddressMode === "saved" && savedLocationOverride) return savedLocationOverride;
    if (deliveryAddressMode === "saved" && storedLocation) return storedLocation;
    return engineLocation;
  }, [deliveryAddressMode, savedLocationOverride, storedLocation, engineLocation]);

  const effectiveLocation = useMemo(
    () => (deliveryAddressMode === "current" ? engineLocation || location : location),
    [deliveryAddressMode, engineLocation, location],
  );

  // ---- zone (useZone.jsx) ----
  const applyZonePayload = useCallback(
    (data) => {
      if (data?.status === "IN_SERVICE" && data.zoneId) {
        setZoneId(data.zoneId);
        setZone(data.zone || null);
        setZoneStatus("IN_SERVICE");
        persistZoneContext({ zoneId: data.zoneId, zone: data.zone || null, status: "IN_SERVICE" });
      } else {
        const status = data?.status || "OUT_OF_SERVICE";
        setZoneId(null);
        setZone(data?.zone || null);
        setZoneStatus(status);
        persistZoneContext({ zoneId: null, zone: data?.zone || null, status });
      }
    },
    [persistZoneContext],
  );

  const detectZone = useCallback(
    async (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setZoneStatus("IDLE");
        setZoneId(null);
        setZone(null);
        return;
      }
      try {
        setZoneLoading(true);
        setZoneError(null);
        const rLat = roundCoord(lat, 5);
        const rLng = roundCoord(lng, 5);
        const key = rLat === null || rLng === null ? null : `${rLat},${rLng}`;
        const now = Date.now();
        const cached = key ? zoneCache.get(key) : null;
        if (cached && now - cached.ts < ZONE_CACHE_TTL_MS) {
          applyZonePayload(cached.payload);
          return;
        }
        let promise = key ? zoneInFlight.get(key) : null;
        if (!promise) {
          promise = locationApi
            .detectZone(lat, lng)
            .then((res) => {
              if (!res?.success) throw new Error(res?.message || "Failed to detect zone");
              return res.data;
            })
            .finally(() => {
              if (key) zoneInFlight.delete(key);
            });
          if (key) zoneInFlight.set(key, promise);
        }
        const data = await promise;
        if (key) zoneCache.set(key, { ts: now, payload: data });
        applyZonePayload(data);
      } catch (err) {
        setZoneError(err?.message || "Failed to detect zone");
        setZoneStatus("OUT_OF_SERVICE");
        setZoneId(null);
        setZone(null);
        persistZoneContext({ status: "OUT_OF_SERVICE" });
      } finally {
        setZoneLoading(false);
      }
    },
    [applyZonePayload, persistZoneContext],
  );

  const rawLat = location?.latitude !== undefined ? location.latitude : location?.lat;
  const rawLng = location?.longitude !== undefined ? location.longitude : location?.lng;

  useEffect(() => {
    if (!hydrated) return undefined;
    const lat = roundCoord(rawLat, 6);
    const lng = roundCoord(rawLng, 6);
    const prev = prevZoneCoordsRef.current;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const changed =
        prev.latitude === null ||
        prev.longitude === null ||
        Math.abs(prev.latitude - lat) > 0.0001 ||
        Math.abs(prev.longitude - lng) > 0.0001;
      if (changed) {
        prevZoneCoordsRef.current = { latitude: lat, longitude: lng };
        setZoneStatus("loading");
        clearTimeout(zoneDebounceRef.current);
        zoneDebounceRef.current = setTimeout(() => detectZone(lat, lng), 350);
      }
    } else {
      const saved = storedZoneRef.current;
      if (saved.zoneId) {
        setZoneId(saved.zoneId);
        setZone(saved.zone || null);
        setZoneStatus(saved.zoneStatus || "IN_SERVICE");
      } else {
        setZoneStatus("IDLE");
        setZoneId(null);
        setZone(null);
      }
    }
    return () => clearTimeout(zoneDebounceRef.current);
  }, [hydrated, rawLat, rawLng, detectZone]);

  const refreshZone = useCallback(() => {
    if (Number.isFinite(rawLat) && Number.isFinite(rawLng)) detectZone(rawLat, rawLng);
  }, [rawLat, rawLng, detectZone]);

  // Zone headers on every API request (X-Zone-Id, X-User-Lat, X-User-Lng).
  useEffect(() => {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    setZoneContext({
      zoneId: zoneId || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    });
  }, [zoneId, rawLat, rawLng]);

  const value = useMemo(
    () => ({
      ready: hydrated,
      location,
      effectiveLocation,
      storedLocation,
      deliveryAddressMode,
      loading: loading || zoneLoading,
      error: error || zoneError,
      permissionGranted,
      zoneId,
      zone,
      zoneStatus,
      isInService: zoneStatus === "IN_SERVICE",
      isOutOfService: OUT_OF_SERVICE_STATUSES.has(zoneStatus),
      isOutOfRadius: zoneStatus === "OUT_OF_RADIUS",
      isOutOfZone: zoneStatus === "OUT_OF_ZONE" || zoneStatus === "OUT_OF_SERVICE",
      serviceUnavailableMessage: getServiceUnavailableMessage(zoneStatus),
      isLocationResolved: Boolean(location?.latitude && !loading),
      address: location?.address || location?.formattedAddress || "",
      requestLocation,
      setSavedLocation,
      setDeliveryAddressMode,
      refreshZone,
      startWatchingLocation,
      stopWatchingLocation,
      persistUserLocation,
      persistDeliveryAddressMode,
      clearStoredUserLocation,
      notifyLocationUpdated,
      reverseGeocode: reverseGeocodeAddress,
    }),
    [
      hydrated,
      location,
      effectiveLocation,
      storedLocation,
      deliveryAddressMode,
      loading,
      zoneLoading,
      error,
      zoneError,
      permissionGranted,
      zoneId,
      zone,
      zoneStatus,
      requestLocation,
      setSavedLocation,
      setDeliveryAddressMode,
      refreshZone,
      startWatchingLocation,
      stopWatchingLocation,
      persistUserLocation,
      persistDeliveryAddressMode,
      clearStoredUserLocation,
      notifyLocationUpdated,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

// Web hook name (hooks/useAppLocation.jsx); useLocationContext is the same hook.
export function useAppLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useAppLocation must be used inside LocationProvider");
  return ctx;
}

export const useLocationContext = useAppLocation;
