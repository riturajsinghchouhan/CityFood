// Location picker, ported from Frontend/src/modules/Food/pages/user/cart/AddressSelectorPage.jsx:
// current location, saved addresses (select / edit / delete) and the add/edit address form.
import { router } from "expo-router";
import { Briefcase, Building2, ChevronLeft, ChevronRight, Home, MapPin, Navigation, Pencil, Plus, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import AddressForm from "../../components/address/AddressForm";
import { Screen, Text, toast } from "../../components/ui";
import { useAppLocation } from "../../context/LocationContext";
import { useProfile } from "../../context/ProfileContext";
import useLatest from "../../hooks/useLatest";
import { useAppBack, useBackOverride } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadow, tw } from "../../theme/tokens";
import { getAddressId } from "./cartUtils";
import { DEFAULT_COORDS, distanceMeters, forwardGeocodeAddress, reverseGeocodeForForm, searchPlaces } from "./geocoding";

const EMPTY_FORM = { street: "", city: "", state: "", zipCode: "", additionalDetails: "", label: "Home", phone: "" };

function getAddressIcon(address) {
  const label = (address.label || address.additionalDetails || "").toLowerCase();
  if (label.includes("home")) return Home;
  if (label.includes("work") || label.includes("office")) return Briefcase;
  if (label.includes("building") || label.includes("apt")) return Building2;
  return Home;
}

function buildLocationDataFromAddress(address) {
  const coordinates = address?.location?.coordinates || [];
  const longitude = Number(coordinates[0] ?? address?.longitude);
  const latitude = Number(coordinates[1] ?? address?.latitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const street = String(address?.street || "").trim();
  const city = String(address?.city || "").trim();
  const state = String(address?.state || "").trim();
  const area = String(address?.additionalDetails || "").trim();
  const zipCode = String(address?.zipCode || "").trim();
  const stateAndZip = [state, zipCode].filter(Boolean).join(" ");
  return {
    city,
    state,
    area,
    zipCode,
    latitude,
    longitude,
    address: [street, city].filter(Boolean).join(", "),
    formattedAddress: area
      ? [area, street, city, stateAndZip].filter(Boolean).join(", ")
      : [street, city, stateAndZip].filter(Boolean).join(", "),
    label: address?.label || "Home",
  };
}

export default function AddressSelectorScreen() {
  const { colors, isDark } = useTheme();
  const goBack = useAppBack();
  const { addresses = [], addAddress, updateAddress, deleteAddress, setDefaultAddress, isAuthenticated } = useProfile();
  const {
    location,
    storedLocation,
    requestLocation,
    setSavedLocation,
    setDeliveryAddressMode,
    persistUserLocation,
    persistDeliveryAddressMode,
    clearStoredUserLocation,
    notifyLocationUpdated,
  } = useAppLocation();

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [mapPosition, setMapPosition] = useState(() =>
    storedLocation?.latitude && storedLocation?.longitude
      ? [Number(storedLocation.latitude), Number(storedLocation.longitude)]
      : DEFAULT_COORDS,
  );
  // Camera the form's map opens at (the web map is created centered on mapPosition).
  const [formInitialPosition, setFormInitialPosition] = useState(mapPosition);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const mapRef = useRef(null);
  const backTimer = useRef(null);
  const mapPositionRef = useLatest(mapPosition);

  useEffect(() => () => clearTimeout(backTimer.current), []);

  const handleBack = useCallback(() => goBack(), [goBack]);

  useBackOverride(() => {
    if (!showAddressForm) return false;
    setShowAddressForm(false);
    return true;
  });

  const panTo = (lat, lng, zoom) => {
    mapRef.current?.animateCamera({ center: { latitude: lat, longitude: lng }, zoom }, { duration: 500 });
  };

  // Nominatim keyword search, debounced 350 ms.
  const refLat = location?.latitude ?? DEFAULT_COORDS[0];
  const refLng = location?.longitude ?? DEFAULT_COORDS[1];
  useEffect(() => {
    if (!showAddressForm) return undefined;
    const q = String(searchValue || "").trim();
    let active = true;
    const t = setTimeout(
      async () => {
        if (q.length < 3) {
          setSuggestions([]);
          setIsSearching(false);
          return;
        }
        try {
          setIsSearching(true);
          const list = await searchPlaces(q, refLat, refLng);
          if (active) setSuggestions(list);
        } catch {
          if (active) setSuggestions([]);
        } finally {
          if (active) setIsSearching(false);
        }
      },
      q.length < 3 ? 0 : 350,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [searchValue, showAddressForm, refLat, refLng]);

  const handleMapMoveEnd = useCallback(async (lat, lng) => {
    const result = await reverseGeocodeForForm(lat, lng);
    if (!result) return;
    setCurrentAddress(result.formatted);
    setForm(result.merge);
  }, []);

  const handleUseCurrentLocation = async () => {
    try {
      toast.loading("Getting location...", { id: "geo" });
      clearStoredUserLocation();
      const loc = await requestLocation(true);
      if (loc?.latitude) {
        setMapPosition([loc.latitude, loc.longitude]);
        setCurrentAddress(loc.formattedAddress || loc.address || "");
        persistDeliveryAddressMode("current");
        persistUserLocation(loc, { mode: "current" });
        toast.success(`Location ready: ${loc.area || loc.city || "Current Location"}`, { id: "geo" });
        backTimer.current = setTimeout(handleBack, 200);
      }
    } catch {
      toast.error("Failed to get location", { id: "geo" });
    }
  };

  const handleSelectSavedAddress = async (address) => {
    const id = getAddressId(address);
    if (!id) return;
    const locationData = buildLocationDataFromAddress(address);
    if (!locationData) {
      toast.error("Selected address does not have valid coordinates");
      return;
    }
    await setDefaultAddress(id);
    await setSavedLocation(locationData, { mode: "saved", persistDb: true });
    persistDeliveryAddressMode("saved");
    setDeliveryAddressMode("saved");
    toast.success("Address selected");
    handleBack();
  };

  const openForm = (position) => {
    setFormInitialPosition(position);
    setMapPosition(position);
    setSearchValue("");
    setSuggestions([]);
    setMapLoading(true);
    setShowAddressForm(true);
  };

  const handleEditAddress = (addr) => {
    setForm({
      id: getAddressId(addr),
      street: addr.street || "",
      city: addr.city || "",
      state: addr.state || "",
      zipCode: addr.zipCode || "",
      additionalDetails: addr.additionalDetails || "",
      label: addr.label || "Home",
      phone: addr.phone || "",
    });
    let lat = DEFAULT_COORDS[0];
    let lng = DEFAULT_COORDS[1];
    if (addr.location?.coordinates) {
      lng = addr.location.coordinates[0];
      lat = addr.location.coordinates[1];
    } else if (addr.latitude && addr.longitude) {
      lat = addr.latitude;
      lng = addr.longitude;
    }
    setCurrentAddress([addr.additionalDetails, addr.street, addr.city].filter(Boolean).join(", "));
    openForm([lat, lng]);
  };

  const handleDeleteAddress = (addr) => {
    Alert.alert("", "Are you sure you want to delete this address?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "OK",
        onPress: async () => {
          const id = getAddressId(addr);
          if (!id) return;
          try {
            await deleteAddress(id);
            toast.success("Address deleted successfully");
          } catch {
            toast.error("Failed to delete address");
          }
        },
      },
    ]);
  };

  const handleLocateInForm = async () => {
    try {
      toast.loading("Getting current location...", { id: "geo-form" });
      const loc = await requestLocation(true);
      if (loc?.latitude && loc?.longitude) {
        setMapPosition([loc.latitude, loc.longitude]);
        panTo(loc.latitude, loc.longitude, 17);
        await handleMapMoveEnd(loc.latitude, loc.longitude);
        toast.success(`Location updated: ${loc.area || loc.city || "Current Location"}`, { id: "geo-form" });
      } else {
        toast.error("Could not obtain GPS location", { id: "geo-form" });
      }
    } catch {
      toast.error("Failed to get location", { id: "geo-form" });
    }
  };

  const handleAddAddressClick = () => {
    if (!isAuthenticated) {
      toast.info("Please login to add an address");
      router.push("/login");
      return;
    }
    setForm(EMPTY_FORM);
    const targetLoc = location?.latitude && location?.longitude ? location : storedLocation;
    let start = mapPositionRef.current;
    if (targetLoc?.latitude && targetLoc?.longitude) {
      start = [Number(targetLoc.latitude), Number(targetLoc.longitude)];
    }
    openForm(start);
    // Background high-accuracy fix, as on web; re-centers the map when it arrives.
    requestLocation(false)
      .then((fresh) => {
        if (fresh?.latitude && fresh?.longitude) {
          setMapPosition([fresh.latitude, fresh.longitude]);
          panTo(fresh.latitude, fresh.longitude, 17);
          handleMapMoveEnd(fresh.latitude, fresh.longitude);
        }
      })
      .catch(() => {});
  };

  // Typed address far (>15 km) from the pin -> move the map there.
  const syncMapWithTypedAddress = async () => {
    const query = [form.street, form.additionalDetails, form.city, form.state, form.zipCode].filter(Boolean).join(", ");
    if (!query || (!form.city && !form.street)) return;
    const geocoded = await forwardGeocodeAddress(query);
    if (!geocoded) return;
    const [lat, lng] = mapPositionRef.current;
    if (distanceMeters(lat, lng, geocoded.lat, geocoded.lng) > 15000) {
      setMapPosition([geocoded.lat, geocoded.lng]);
      panTo(geocoded.lat, geocoded.lng, 16);
      setCurrentAddress(geocoded.formattedAddress || query);
    }
  };

  const handlePickSuggestion = (s) => {
    const { lat, lng, display, address: a } = s;
    setMapPosition([lat, lng]);
    panTo(lat, lng, 17);
    setSearchValue(display);
    const city = a.city || a.town || a.village || a.county || "";
    const state = a.state || "";
    const zipCode = a.postcode || "";
    setForm((prev) => ({
      ...prev,
      street: display || prev.street,
      city: city || prev.city,
      state: state || prev.state,
      zipCode: zipCode || prev.zipCode,
    }));
    setSuggestions([]);
  };

  const handleSave = async () => {
    if (!form.street || !form.city) {
      toast.error("Please fill required fields");
      return;
    }
    setLoadingAddress(true);
    try {
      let [finalLat, finalLng] = mapPositionRef.current;
      const typedQuery = [form.street, form.additionalDetails, form.city, form.state, form.zipCode].filter(Boolean).join(", ");
      const isDefaultIndore = distanceMeters(finalLat, finalLng, DEFAULT_COORDS[0], DEFAULT_COORDS[1]) < 2000;
      if (typedQuery) {
        const geocoded = await forwardGeocodeAddress(typedQuery);
        if (geocoded) {
          const dist = distanceMeters(finalLat, finalLng, geocoded.lat, geocoded.lng);
          if (isDefaultIndore || dist > 15000) {
            finalLat = geocoded.lat;
            finalLng = geocoded.lng;
            setMapPosition([finalLat, finalLng]);
          }
        }
      }

      if (!isAuthenticated) {
        const locData = {
          latitude: finalLat,
          longitude: finalLng,
          address: [form.additionalDetails, form.street, form.city].filter(Boolean).join(", "),
          formattedAddress: currentAddress || typedQuery,
          city: form.city,
          state: form.state,
          area: form.additionalDetails || "",
          label: form.label,
        };
        persistUserLocation(locData, { mode: "saved" });
        setDeliveryAddressMode("saved");
        notifyLocationUpdated(locData);
        toast.success("Location set successfully");
        handleBack();
        return;
      }

      const payload = {
        ...form,
        label: form.label === "Work" ? "Office" : form.label,
        location: { type: "Point", coordinates: [finalLng, finalLat] },
        latitude: finalLat,
        longitude: finalLng,
      };
      const saved = form.id ? await updateAddress(form.id, payload) : await addAddress(payload);
      if (saved) {
        const id = getAddressId(saved);
        if (id) await setDefaultAddress(id);
        const locationData = buildLocationDataFromAddress({ ...saved, ...payload, id, _id: saved?._id || id });
        if (locationData) {
          await setSavedLocation(locationData, { mode: "saved", persistDb: true });
          persistDeliveryAddressMode("saved");
          setDeliveryAddressMode("saved");
        }
        toast.success(form.id ? "Address updated" : "Address saved");
        handleBack();
      }
    } catch {
      toast.error("Failed to save address");
    } finally {
      setLoadingAddress(false);
    }
  };

  if (showAddressForm) {
    return (
      <AddressForm
        mapRef={mapRef}
        initialPosition={formInitialPosition}
        mapLoading={mapLoading}
        onMapReady={() => setMapLoading(false)}
        onRegionChangeComplete={(region) => {
          setMapPosition([region.latitude, region.longitude]);
          handleMapMoveEnd(region.latitude, region.longitude);
        }}
        searchValue={searchValue}
        onChangeSearch={setSearchValue}
        isSearching={isSearching}
        suggestions={suggestions}
        onPickSuggestion={handlePickSuggestion}
        onUseMyLocation={handleLocateInForm}
        currentAddress={currentAddress}
        form={form}
        onChangeField={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
        onSyncTyped={syncMapWithTypedAddress}
        onSave={handleSave}
        saving={loadingAddress}
        onCancel={() => setShowAddressForm(false)}
      />
    );
  }

  const muted = isDark ? tw.gray400 : tw.gray500;
  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
      <View style={[styles.header, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray100 }]}>
        <Pressable onPress={handleBack} style={styles.iconBtn} hitSlop={6}>
          <ChevronLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Select Location</Text>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(addr, idx) => String(getAddressId(addr) || idx)}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            <View style={[styles.currentWrap, { backgroundColor: isDark ? tw.gray900 : tw.gray50, borderColor: isDark ? tw.gray800 : tw.gray200 }]}>
              <Pressable
                onPress={handleUseCurrentLocation}
                style={[styles.currentBtn, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}
              >
                <View style={[styles.navCircle, { backgroundColor: isDark ? "#7e386620" : "#7e386610" }]}>
                  <Navigation size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.currentTitle, { color: colors.primary }]}>Use Current Location</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: tw.gray500 }}>
                    {currentAddress || "Enable GPS for accuracy"}
                  </Text>
                </View>
                <ChevronRight size={20} color={tw.gray400} />
              </Pressable>
            </View>
            <View style={styles.savedHeader}>
              <Text style={styles.savedTitle}>SAVED ADDRESSES</Text>
              <Pressable onPress={handleAddAddressClick} style={styles.addNew} hitSlop={6}>
                <Plus size={16} color={colors.primary} />
                <Text style={[styles.addNewText, { color: colors.primary }]}>Add New</Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MapPin size={48} color={tw.gray400} />
            <Text style={{ color: colors.foreground, marginTop: 8 }}>No addresses saved yet</Text>
          </View>
        }
        renderItem={({ item: addr }) => {
          const Icon = getAddressIcon(addr);
          return (
            <Pressable
              onPress={() => handleSelectSavedAddress(addr)}
              style={({ pressed }) => [
                styles.addrItem,
                {
                  backgroundColor: pressed
                    ? isDark
                      ? "#7e386620"
                      : "#7e386610"
                    : isDark
                      ? "#1a1a1a"
                      : "#f8fafc",
                },
              ]}
            >
              <View style={[styles.addrIcon, { backgroundColor: isDark ? tw.gray800 : "#ffffff" }]}>
                <Icon size={20} color={isDark ? tw.gray400 : tw.gray600} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.addrLabel, { color: isDark ? "#ffffff" : tw.gray900 }]}>
                  {addr.label ? addr.label.charAt(0).toUpperCase() + addr.label.slice(1) : "Address"}
                </Text>
                <Text numberOfLines={2} style={[styles.addrText, { color: muted }]}>
                  {[addr.additionalDetails, addr.street, addr.city, addr.state].filter(Boolean).join(", ")}
                </Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => handleEditAddress(addr)} style={styles.actionBtn} hitSlop={4}>
                  <Pencil size={16} color={tw.gray500} />
                </Pressable>
                <Pressable onPress={() => handleDeleteAddress(addr)} style={styles.actionBtn} hitSlop={4}>
                  <Trash2 size={16} color={tw.red500} />
                </Pressable>
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 16, borderBottomWidth: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  currentWrap: { padding: 16, borderBottomWidth: 1 },
  currentBtn: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: radius.xl, ...shadow.sm },
  navCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  currentTitle: { fontWeight: "700", fontSize: 14 },
  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 16,
  },
  savedTitle: { fontSize: 14, fontWeight: "700", letterSpacing: 0.7, color: tw.gray500 },
  addNew: { flexDirection: "row", alignItems: "center", gap: 4 },
  addNewText: { fontWeight: "700", fontSize: 14 },
  empty: { alignItems: "center", paddingVertical: 40, opacity: 0.5 },
  addrItem: { marginHorizontal: 16, flexDirection: "row", alignItems: "flex-start", gap: 16, padding: 16, borderRadius: radius.xl },
  addrIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", ...shadow.sm },
  addrLabel: { fontWeight: "700", fontSize: 14 },
  addrText: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
