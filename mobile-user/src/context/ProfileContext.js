// Profile, saved addresses, favourites and veg mode, ported from
// Frontend/src/modules/Food/context/ProfileContext.jsx. Addresses are server-backed;
// favourites, dish favourites and veg mode are device-local, as on web.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useLatest from "../hooks/useLatest";
import * as addressesApi from "../api/addresses";
import { getCurrentUser } from "../api/profile";
import { KEYS, store } from "../storage";
import { useAuth } from "./AuthContext";
import { useAppLocation } from "./LocationContext";

const getAddressId = (address) => address?.id || address?._id || null;

export function normalizeAddressLabel(label) {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === "home") return "Home";
  if (normalized === "office" || normalized === "work") return "Office";
  return "Other";
}

function normalizeAddress(address) {
  if (!address || typeof address !== "object") return null;
  const id = getAddressId(address);
  return { ...address, label: normalizeAddressLabel(address.label), ...(id ? { id: String(id) } : {}) };
}

// Latest address per label wins, so a newly saved Home/Office/Other replaces the old one.
function dedupeAddressesByLabel(list = []) {
  const map = new Map();
  list.forEach((addr, index) => {
    const normalized = normalizeAddress(addr);
    if (!normalized) return;
    map.set(normalized.label || getAddressId(normalized) || index, normalized);
  });
  return Array.from(map.values());
}

// Saved address -> location object used by LocationContext (web setDefaultAddress sync).
export function addressToLocation(address, existing = {}) {
  const coords = address?.location?.coordinates;
  const lngFromCoords = Array.isArray(coords) && coords.length >= 2 ? Number(coords[0]) : null;
  const latFromCoords = Array.isArray(coords) && coords.length >= 2 ? Number(coords[1]) : null;
  const lat = Number(Number.isFinite(latFromCoords) ? latFromCoords : address?.latitude ?? address?.lat);
  const lng = Number(Number.isFinite(lngFromCoords) ? lngFromCoords : address?.longitude ?? address?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const parts = [address?.additionalDetails, address?.street, address?.city, address?.state, address?.zipCode].filter(Boolean);
  const resolved = parts.length > 0 ? parts.join(", ") : address?.formattedAddress || address?.address || "";
  return {
    ...existing,
    latitude: lat,
    longitude: lng,
    area: address?.additionalDetails || address?.street || address?.area || existing?.area || "",
    city: address?.city || existing?.city || "",
    state: address?.state || existing?.state || "",
    address: resolved || existing?.address || "",
    formattedAddress: resolved || existing?.formattedAddress || "",
  };
}

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { ready: authReady, isAuthenticated, user, updateUser, onLogout } = useAuth();
  const { location, setSavedLocation } = useAppLocation();
  const [hydrated, setHydrated] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [dishFavorites, setDishFavorites] = useState([]);
  const [vegMode, setVegMode] = useState(false);
  const [vegModeOption, setVegModeOption] = useState("all");
  const locationRef = useLatest(location);
  const addressesRef = useLatest(addresses);

  useEffect(() => {
    let active = true;
    Promise.all([
      store.get(KEYS.profile),
      store.get(KEYS.favorites, []),
      store.get(KEYS.dishFavorites, []),
      store.get(KEYS.vegMode),
      store.get(KEYS.vegModeOption),
    ]).then(([profile, favs, dishFavs, veg, vegOption]) => {
      if (!active) return;
      setUserProfile((prev) => prev || profile || null);
      setFavorites(Array.isArray(favs) ? favs : []);
      setDishFavorites(Array.isArray(dishFavs) ? dishFavs : []);
      setVegMode(veg === true || veg === "true");
      if (typeof vegOption === "string") setVegModeOption(vegOption);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Auth's cached user is the first value, like the web reading user_user before userProfile.
  useEffect(() => {
    if (user) setUserProfile((prev) => prev || user);
  }, [user]);

  // Web persistence rules: write when non-empty or logged in.
  useEffect(() => {
    if (hydrated && (userProfile || isAuthenticated)) store.set(KEYS.profile, userProfile);
  }, [userProfile, isAuthenticated, hydrated]);
  useEffect(() => {
    if (hydrated && (addresses.length > 0 || isAuthenticated)) store.set(KEYS.addresses, addresses);
  }, [addresses, isAuthenticated, hydrated]);
  useEffect(() => {
    if (hydrated && (favorites.length > 0 || isAuthenticated)) store.set(KEYS.favorites, favorites);
  }, [favorites, isAuthenticated, hydrated]);
  useEffect(() => {
    if (hydrated && (dishFavorites.length > 0 || isAuthenticated)) store.set(KEYS.dishFavorites, dishFavorites);
  }, [dishFavorites, isAuthenticated, hydrated]);
  useEffect(() => {
    if (hydrated && isAuthenticated) {
      store.set(KEYS.vegMode, vegMode);
      store.set(KEYS.vegModeOption, vegModeOption);
    }
  }, [vegMode, vegModeOption, isAuthenticated, hydrated]);

  const resetLocal = useCallback(() => {
    setUserProfile(null);
    setAddresses([]);
    setFavorites([]);
    setDishFavorites([]);
    setVegMode(false);
    setVegModeOption("all");
    store.removeMany([
      KEYS.profile,
      KEYS.addresses,
      KEYS.favorites,
      KEYS.dishFavorites,
      KEYS.vegMode,
      KEYS.vegModeOption,
      KEYS.under250Filters,
    ]);
  }, []);

  useEffect(() => onLogout(resetLocal), [onLogout, resetLocal]);

  const loadSavedAddresses = useCallback(async () => {
    const saved = await store.get(KEYS.addresses);
    if (Array.isArray(saved)) setAddresses(dedupeAddressesByLabel(saved));
  }, []);

  // Fetch profile then addresses; on failure fall back to the cached addresses.
  const refreshProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCurrentUser();
      const userData = res?.data?.user || res?.data || null;
      if (userData) {
        setUserProfile(userData);
        updateUser(() => userData);
      }
      try {
        const addrRes = await addressesApi.getAddresses();
        const list = dedupeAddressesByLabel(addrRes?.data?.addresses || []);
        setAddresses(list);
        store.set(KEYS.addresses, list);
      } catch {
        await loadSavedAddresses();
      }
    } catch {
      await loadSavedAddresses();
    } finally {
      setLoading(false);
    }
  }, [updateUser, loadSavedAddresses]);

  useEffect(() => {
    if (!authReady || !hydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    refreshProfile();
  }, [authReady, hydrated, isAuthenticated, refreshProfile]);

  const addAddress = useCallback(async (address) => {
    const res = await addressesApi.addAddress(address);
    const created = res?.data?.address;
    if (!created) return undefined;
    const normalized = normalizeAddress(created);
    setAddresses((prev) => {
      const filtered = prev.filter((a) => normalizeAddressLabel(a?.label) !== normalizeAddressLabel(normalized?.label));
      const next = dedupeAddressesByLabel([...filtered, normalized]);
      store.set(KEYS.addresses, next);
      return next;
    });
    return normalized;
  }, []);

  const updateAddress = useCallback(async (id, updated) => {
    const res = await addressesApi.updateAddress(id, updated);
    const saved = res?.data?.address;
    if (!saved) return undefined;
    const normalized = normalizeAddress(saved);
    setAddresses((prev) => {
      const next = dedupeAddressesByLabel(
        prev.map((a) => (String(getAddressId(a)) === String(id) ? normalized : normalizeAddress(a))),
      );
      store.set(KEYS.addresses, next);
      return next;
    });
    return normalized;
  }, []);

  const deleteAddress = useCallback(async (id) => {
    await addressesApi.deleteAddress(id);
    setAddresses((prev) => {
      const next = prev.filter((a) => String(getAddressId(a)) !== String(id));
      store.set(KEYS.addresses, next);
      return next;
    });
  }, []);

  // Optimistic: marks the default, switches delivery to this saved address, then calls the API
  // (failures are ignored, as on web).
  const setDefaultAddress = useCallback(
    async (id) => {
      const next = addressesRef.current.map((a) => ({ ...a, isDefault: String(getAddressId(a)) === String(id) }));
      const selected = next.find((a) => a.isDefault) || next[0] || null;
      addressesRef.current = next;
      setAddresses(next);
      store.set(KEYS.addresses, next);
      const synced = selected ? addressToLocation(selected, locationRef.current || {}) : null;
      if (synced) setSavedLocation(synced, { mode: "saved", persistDb: false });
      try {
        await addressesApi.setDefaultAddress(id);
      } catch {
        // Keep the UI stable even if the backend call fails.
      }
    },
    [setSavedLocation],
  );

  const getDefaultAddress = useCallback(() => addresses.find((a) => a.isDefault) || addresses[0] || null, [addresses]);
  const getAddressById = useCallback(
    (id) => addresses.find((a) => String(getAddressId(a)) === String(id)),
    [addresses],
  );

  const addFavorite = useCallback((restaurant) => {
    setFavorites((prev) => (prev.find((f) => f.slug === restaurant.slug) ? prev : [...prev, restaurant]));
  }, []);
  const removeFavorite = useCallback((slug) => {
    setFavorites((prev) => prev.filter((f) => f.slug !== slug));
  }, []);
  const isFavorite = useCallback((slug) => favorites.some((f) => f.slug === slug), [favorites]);
  const getFavorites = useCallback(() => favorites, [favorites]);

  const addDishFavorite = useCallback((dish) => {
    setDishFavorites((prev) =>
      prev.find((f) => f.id === dish.id && f.restaurantId === dish.restaurantId) ? prev : [...prev, dish],
    );
  }, []);
  const removeDishFavorite = useCallback((dishId, restaurantId) => {
    setDishFavorites((prev) => prev.filter((f) => !(f.id === dishId && f.restaurantId === restaurantId)));
  }, []);
  const isDishFavorite = useCallback(
    (dishId, restaurantId) => dishFavorites.some((f) => f.id === dishId && f.restaurantId === restaurantId),
    [dishFavorites],
  );
  const getDishFavorites = useCallback(() => dishFavorites, [dishFavorites]);

  const updateUserProfile = useCallback((updated) => {
    setUserProfile((prev) => ({ ...prev, ...updated }));
  }, []);

  const value = useMemo(
    () => ({
      userProfile,
      loading,
      isAuthenticated,
      refreshProfile,
      updateUserProfile,
      addresses,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      favorites,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      dishFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
      vegMode,
      setVegMode,
      vegModeOption,
      setVegModeOption,
    }),
    [
      userProfile,
      loading,
      isAuthenticated,
      refreshProfile,
      updateUserProfile,
      addresses,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      favorites,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      dishFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
      vegMode,
      vegModeOption,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
