// Port of pages/restaurant/ZoneSetup.jsx (/zone-setup): set the outlet location on a Google map
// with the service-zone polygons, Places search, tap/drag to place the marker, current location,
// the zone check (GET /zones/detect, falling back to a local point-in-polygon test) and
// "Save Location" (PATCH /profile {location, zoneId}), reported with alerts as on web.
import * as Location from "expo-location";
import { ArrowLeft, MapPin, Navigation, Save, Search } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { detectZone, getCurrentRestaurant, getPublicZones, updateProfile } from "../../api";
import { searchLocations } from "../../components/auth/onboarding/places";
import { confirmAsync } from "../../components/menu/common";
import { formatZoneAddress } from "../../components/outlet/common";
import { getPlaceLocation, reverseGeocode } from "../../components/outlet/geocode";
import ZoneMap, { Spinner, containsLocation, zonePaths } from "../../components/outlet/ZoneMap";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { Text, inputFont } from "../../components/ui";
import { GOOGLE_MAPS_API_KEY } from "../../config";
import { useAuth } from "../../context/AuthContext";
import { useAppBack } from "../../navigation/back";
import { tw } from "../../theme/tokens";

const GREEN = {
  50: tw.green50,
  100: tw.green100,
  200: "#b9f8cf",
  600: tw.green600,
  700: tw.green700,
  900: "#0d542b",
};
const RED = { 50: tw.red50, 100: tw.red100, 200: "#ffc9c9", 600: tw.red600, 700: tw.red700, 900: "#82181a" };

const parseCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function getSavedLocationCoords(location) {
  if (!location) return null;
  let lat = null;
  let lng = null;
  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    lng = parseCoordinate(location.coordinates[0]);
    lat = parseCoordinate(location.coordinates[1]);
  }
  if (lat === null || lng === null) {
    lat = parseCoordinate(location.latitude);
    lng = parseCoordinate(location.longitude);
  }
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const swappedLat = lng;
    const swappedLng = lat;
    if (swappedLat >= -90 && swappedLat <= 90 && swappedLng >= -180 && swappedLng <= 180) {
      return { lat: swappedLat, lng: swappedLng };
    }
    return null;
  }
  return { lat, lng };
}

const coordsText = (lat, lng) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
const alert = (message) => Alert.alert("", message);
const NO_KEY_ERROR = "Google Maps API key is not configured. Please contact your administrator.";

export default function ZoneSetupScreen() {
  const goBack = useAppBack();
  const shellInset = useShellBottomInset();
  const { updateRestaurant } = useAuth();
  const mapRef = useRef(null);
  const typedRef = useRef(false);
  const zonesRef = useRef([]);

  const [mapLoading, setMapLoading] = useState(Boolean(GOOGLE_MAPS_API_KEY));
  const [mapError, setMapError] = useState(GOOGLE_MAPS_API_KEY ? "" : NO_KEY_ERROR);
  const [saving, setSaving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [restaurantData, setRestaurantData] = useState(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [zones, setZones] = useState([]);
  const [currentZone, setCurrentZone] = useState(null);
  const [isInZone, setIsInZone] = useState(false);
  const [checkingZone, setCheckingZone] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  const bootstrapZoneMap = useCallback(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapLoading(false);
      setMapError(NO_KEY_ERROR);
      return;
    }
    setMapError("");
    setMapLoading(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCurrentRestaurant()
      .then((res) => {
        const data = res?.data?.restaurant;
        if (data && !cancelled) setRestaurantData(data);
      })
      .catch(() => {});
    getPublicZones()
      .then((res) => {
        const list = res?.data?.zones || [];
        if (!cancelled) setZones(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const checkLocationInZone = useCallback(async (lat, lng) => {
    try {
      setCheckingZone(true);
      const res = await detectZone(lat, lng);
      const detected = res?.data?.zone;
      setCurrentZone(detected || null);
      setIsInZone(Boolean(detected));
    } catch {
      // Fallback: local containsLocation over the drawn polygons.
      const list = zonesRef.current;
      if (list.length > 0) {
        const hit = list.find((z) => {
          const paths = zonePaths(z);
          return paths && containsLocation(lat, lng, paths);
        });
        setCurrentZone(hit ? { name: hit.name || hit.zoneName, _id: hit._id || hit.id } : null);
        setIsInZone(Boolean(hit));
      }
    } finally {
      setCheckingZone(false);
    }
  }, []);

  const placeAt = useCallback(
    (lat, lng, address) => {
      typedRef.current = false;
      setSuggestions([]);
      setLocationSearch(address);
      setSelectedAddress(address);
      setSelectedLocation({ lat, lng, address });
      checkLocationInZone(lat, lng);
    },
    [checkLocationInZone],
  );

  // Geocoder lookup, then the "lat, lng" fallback.
  const placeWithGeocode = useCallback(
    async (lat, lng, fallback) => {
      const address = await reverseGeocode(lat, lng);
      placeAt(lat, lng, address || fallback || coordsText(lat, lng));
    },
    [placeAt],
  );

  // Existing restaurant location once the map and data are ready.
  useEffect(() => {
    if (!restaurantData?.location || mapLoading || mapError) return undefined;
    const location = restaurantData.location;
    const saved = getSavedLocationCoords(location);
    if (!saved) return undefined;
    const { lat, lng } = saved;
    mapRef.current?.focus(lat, lng, 17);
    const existingAddress = location.formattedAddress || location.address || formatZoneAddress(location) || "";
    const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(existingAddress.trim());
    // Deferred like the web's geocoder callback.
    const t = setTimeout(() => {
      if (!existingAddress || isCoordinates) placeWithGeocode(lat, lng, existingAddress);
      else placeAt(lat, lng, existingAddress);
    }, 0);
    return () => clearTimeout(t);
  }, [restaurantData, mapLoading, mapError, placeAt, placeWithGeocode]);

  // Places autocomplete while typing.
  useEffect(() => {
    const q = locationSearch.trim();
    if (!typedRef.current || !q) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const list = await searchLocations(q);
        if (!cancelled && typedRef.current) setSuggestions(list);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [locationSearch]);

  const handleSelectSuggestion = async (s) => {
    typedRef.current = false;
    setSuggestions([]);
    let place = null;
    if (s.isGoogle) place = await getPlaceLocation(s.id);
    else if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) place = { lat: s.lat, lng: s.lng, address: s.display };
    if (!place) return;
    mapRef.current?.focus(place.lat, place.lng, 17);
    placeAt(place.lat, place.lng, place.address || s.display || "");
  };

  const handleSaveLocation = async () => {
    if (!selectedLocation) {
      alert("Please select a location on the map first");
      return;
    }
    if (!isInZone) {
      const ok = await confirmAsync(
        "The selected location is outside all active service zones. Your restaurant may not receive orders in this location. Do you still want to save?",
      );
      if (!ok) return;
    }
    try {
      setSaving(true);
      const { lat, lng, address } = selectedLocation;
      const payload = {
        location: {
          ...(restaurantData?.location || {}),
          latitude: lat,
          longitude: lng,
          coordinates: [lng, lat],
          formattedAddress: address,
        },
      };
      if (currentZone && (currentZone._id || currentZone.id)) payload.zoneId = currentZone._id || currentZone.id;
      const res = await updateProfile(payload);
      const restaurant = res?.data?.restaurant;
      if (!restaurant) throw new Error("Failed to save location");
      alert("Location saved successfully!");
      // Web reloads the page so the navbar picks up the new address.
      updateRestaurant(restaurant);
      setRestaurantData(restaurant);
    } catch (error) {
      alert((!error?.isNetworkError && error?.data?.message) || "Failed to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("denied");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      mapRef.current?.focus(lat, lng, 17);
      await placeWithGeocode(lat, lng);
    } catch {
      alert("Failed to get your current location. Please allow location access in your browser.");
    } finally {
      setFetchingLocation(false);
    }
  };

  const zoneTone = isInZone ? GREEN : RED;
  const locationDisabled = fetchingLocation || mapLoading;
  const saveDisabled = !selectedLocation || saving;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingBottom: 16 + shellInset }]}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scrollEnabled}
    >
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: tw.gray100 }]}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={tw.gray700} />
        </Pressable>
        <View style={styles.headerIcon}>
          <MapPin size={20} color="#ffffff" />
        </View>
        <View style={styles.flexShrink}>
          <Text style={styles.title}>Zone Setup</Text>
          <Text style={styles.subtitle}>Set your restaurant location on the map</Text>
        </View>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchCol}>
          <View>
            <View style={styles.searchIcon} pointerEvents="none">
              <Search size={20} color={tw.gray400} />
            </View>
            <TextInput
              value={locationSearch}
              onChangeText={(text) => {
                typedRef.current = true;
                setLocationSearch(text);
              }}
              placeholder="Search for your restaurant location..."
              placeholderTextColor={tw.gray500}
              style={[styles.searchInput, inputFont]}
            />
            {suggestions.length > 0 ? (
              <View style={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <Pressable
                    key={String(s.id)}
                    onPress={() => handleSelectSuggestion(s)}
                    style={({ pressed }) => [
                      styles.suggestion,
                      i < suggestions.length - 1 && styles.suggestionBorder,
                      pressed && { backgroundColor: tw.gray100 },
                    ]}
                  >
                    <MapPin size={16} color={tw.gray400} />
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {s.display}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={handleUseCurrentLocation}
            disabled={locationDisabled}
            style={({ pressed }) => [
              styles.currentBtn,
              pressed && { backgroundColor: tw.gray200 },
              locationDisabled && styles.disabled,
            ]}
            accessibilityLabel="Use current location"
          >
            {fetchingLocation ? <Spinner size={20} color={tw.gray700} /> : <Navigation size={20} color={tw.gray700} />}
          </Pressable>

          <Pressable
            onPress={handleSaveLocation}
            disabled={saveDisabled}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: saveDisabled ? tw.gray400 : pressed ? tw.red700 : tw.red600 },
            ]}
          >
            {saving ? (
              <>
                <Spinner size={20} color="#ffffff" />
                <Text style={styles.saveText}>Saving...</Text>
              </>
            ) : (
              <>
                <Save size={20} color="#ffffff" />
                <Text style={styles.saveText}>Save Location</Text>
              </>
            )}
          </Pressable>
        </View>
        {selectedLocation ? (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedText}>
              <Text style={styles.bold}>Selected Location:</Text> {selectedAddress}
            </Text>
            <Text style={styles.selectedCoords}>
              Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
            </Text>
          </View>
        ) : null}
      </View>

      {selectedLocation ? (
        <View style={[styles.zoneBanner, { backgroundColor: zoneTone[50], borderColor: zoneTone[200] }]}>
          <View style={styles.zoneLeft}>
            <View style={[styles.zoneIcon, { backgroundColor: zoneTone[100] }]}>
              <MapPin size={20} color={zoneTone[600]} />
            </View>
            <View style={styles.flexShrink}>
              <Text style={[styles.zoneTitle, { color: zoneTone[900] }]}>
                {checkingZone
                  ? "Checking service zone..."
                  : isInZone
                    ? `Operating in ${currentZone?.name || "Service Zone"}`
                    : "Outside Service Area"}
              </Text>
              <Text style={[styles.zoneText, { color: zoneTone[700] }]}>
                {isInZone
                  ? "Your selected location is within a serviced area. You can proceed with this setup."
                  : "Orders cannot be placed from this location as it's outside all active zones."}
              </Text>
            </View>
          </View>
          {checkingZone ? <Spinner size={20} color={tw.gray400} /> : null}
        </View>
      ) : null}

      <ZoneMap
        ref={mapRef}
        zones={zones}
        assignedZoneId={restaurantData?.zoneId}
        marker={selectedLocation}
        markerTitle={selectedAddress}
        loading={mapLoading}
        error={mapError}
        onRetry={bootstrapZoneMap}
        onReady={() => {
          setMapLoading(false);
          setMapError("");
        }}
        onMapPress={(lat, lng) => placeWithGeocode(lat, lng)}
        onMarkerDragEnd={(lat, lng) => placeWithGeocode(lat, lng)}
        onTouchStart={() => setScrollEnabled(false)}
        onTouchEnd={() => setScrollEnabled(true)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tw.gray50 },
  content: { padding: 16 },
  flexShrink: { flexShrink: 1 },
  bold: { fontWeight: "700" },
  disabled: { opacity: 0.5 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 40 },
  backBtn: { padding: 8, borderRadius: 9999 },
  headerIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: tw.red500, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", color: tw.gray900 },
  subtitle: { fontSize: 14, color: tw.gray600 },
  searchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tw.gray200,
    padding: 16,
    marginBottom: 24,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)",
  },
  searchCol: { gap: 12 },
  searchIcon: { position: "absolute", left: 12, top: 0, height: 42, justifyContent: "center", zIndex: 1 },
  searchInput: {
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: tw.gray300,
    borderRadius: 8,
    fontSize: 16,
    color: tw.gray900,
  },
  suggestions: {
    marginTop: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0px 2px 6px rgba(0,0,0,0.3)",
  },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: tw.gray100 },
  suggestionText: { flex: 1, fontSize: 13, color: tw.gray700 },
  currentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: tw.gray100,
    borderWidth: 1,
    borderColor: tw.gray300,
    borderRadius: 8,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveText: { fontSize: 16, color: "#ffffff" },
  selectedBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: GREEN[50],
    borderWidth: 1,
    borderColor: GREEN[200],
    borderRadius: 8,
  },
  selectedText: { fontSize: 14, color: tw.gray700 },
  selectedCoords: { marginTop: 4, fontSize: 12, color: tw.gray500 },
  zoneBanner: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  zoneLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  zoneIcon: { padding: 8, borderRadius: 9999 },
  zoneTitle: { fontSize: 14, fontWeight: "700" },
  zoneText: { fontSize: 12 },
});
