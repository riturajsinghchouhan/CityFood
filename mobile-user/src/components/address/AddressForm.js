// "Add delivery location" form view of AddressSelectorPage.jsx: map with fixed center pin, floating
// place search, "Use My Location", address fields, "Save address as" and the sticky save bar.
import { ChevronLeft, MapPin, Navigation, Search } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GOOGLE_MAPS_API_KEY } from "../../config";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadow, tw } from "../../theme/tokens";
import { Button, Input, Screen, Text } from "../ui";
import CenterPin from "./CenterPin";

// Web map styles: hide POIs and transit.
const MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function AddressForm({
  mapRef,
  initialPosition,
  mapLoading,
  onMapReady,
  onRegionChangeComplete,
  searchValue,
  onChangeSearch,
  isSearching,
  suggestions,
  onPickSuggestion,
  onUseMyLocation,
  currentAddress,
  form,
  onChangeField,
  onSyncTyped,
  onSave,
  saving,
  onCancel,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mapHeight = Math.max(260, Math.min(420, Math.round(height * 0.45)));
  const [scrollY] = useState(() => new Animated.Value(0));

  const fieldStyle = { height: 48, borderRadius: radius.xl };
  const labelColor = colors.foreground;

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={[styles.header, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray100 }]}>
          <Pressable onPress={onCancel} style={styles.iconBtn} hitSlop={6}>
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Add delivery location</Text>
        </View>

        <Animated.ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 96 }}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        >
          <Animated.View
            style={{
              height: mapHeight,
              zIndex: 0,
              transform: [{ translateY: Animated.multiply(scrollY, 0.4) }],
              opacity: scrollY.interpolate({ inputRange: [0, 300], outputRange: [1, 0.4], extrapolate: "clamp" }),
            }}
          >
            {GOOGLE_MAPS_API_KEY ? (
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                initialCamera={{
                  center: { latitude: initialPosition[0], longitude: initialPosition[1] },
                  zoom: 16,
                  heading: 0,
                  pitch: 0,
                }}
                customMapStyle={MAP_STYLE}
                zoomControlEnabled
                toolbarEnabled={false}
                showsMyLocationButton={false}
                onMapReady={onMapReady}
                onRegionChangeComplete={onRegionChangeComplete}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]} />
            )}

            <CenterPin />

            {mapLoading ? (
              <View style={[StyleSheet.absoluteFill, styles.loading]}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : null}

            <View style={styles.useLocWrap}>
              <Pressable
                onPress={onUseMyLocation}
                style={({ pressed }) => [styles.useLoc, { backgroundColor: pressed ? tw.gray100 : "#ffffff" }]}
              >
                <Navigation size={16} color={colors.primary} />
                <Text style={styles.useLocText}>Use My Location</Text>
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <View style={[styles.searchBox, shadow["2xl"]]}>
                <Search size={20} color={tw.gray400} style={styles.searchIcon} />
                <Input
                  value={searchValue}
                  onChangeText={onChangeSearch}
                  placeholder="Search area, street, landmark..."
                  style={[
                    styles.searchInput,
                    { backgroundColor: isDark ? "rgba(26,26,26,0.95)" : "rgba(255,255,255,0.95)" },
                  ]}
                />
                {isSearching ? (
                  <ActivityIndicator size="small" color={colors.primary} style={styles.searchSpinner} />
                ) : null}
              </View>
              {suggestions.length > 0 ? (
                <View
                  style={[
                    styles.suggestions,
                    { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray100 },
                  ]}
                >
                  <Text style={[styles.suggestHead, { backgroundColor: isDark ? "rgba(31,41,55,0.5)" : tw.gray50 }]}>
                    SUGGESTIONS
                  </Text>
                  {suggestions.map((s, i) => (
                    <Pressable
                      key={String(s.id)}
                      onPress={() => onPickSuggestion(s)}
                      style={({ pressed }) => [
                        styles.suggestRow,
                        i < suggestions.length - 1 && { borderBottomWidth: 1, borderColor: isDark ? tw.gray800 : tw.gray50 },
                        pressed && { backgroundColor: colors.primary + "0D" },
                      ]}
                    >
                      <MapPin size={16} color={tw.gray400} style={{ marginTop: 4 }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={[styles.suggestTitle, { color: isDark ? "#ffffff" : tw.gray900 }]}>
                          {s.display}
                        </Text>
                        <Text numberOfLines={1} style={[styles.suggestSub, { color: isDark ? tw.gray400 : tw.gray500 }]}>
                          {s.address?.city || s.address?.state}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </Animated.View>

          <View style={[styles.sheet, { backgroundColor: isDark ? "#0a0a0a" : "#ffffff" }]}>
            <View
              style={[
                styles.pinned,
                { backgroundColor: colors.primary + (isDark ? "1A" : "0D"), borderColor: colors.primary + (isDark ? "33" : "1A") },
              ]}
            >
              <MapPin size={20} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.pinnedLabel, { color: isDark ? colors.primary + "CC" : colors.primary }]}>
                  PINNNED LOCATION
                </Text>
                <Text numberOfLines={2} style={[styles.pinnedText, { color: isDark ? tw.gray300 : tw.gray700 }]}>
                  {currentAddress || "Select a location on map"}
                </Text>
              </View>
            </View>

            <View>
              <Text style={[styles.labelBold, { color: labelColor }]}>Primary Address (Street / Area / Landmark)</Text>
              <Input
                placeholder="Search or drag to update street/area"
                value={form.street}
                onChangeText={(v) => onChangeField("street", v)}
                onBlur={onSyncTyped}
                style={[fieldStyle, { marginBottom: 16, backgroundColor: isDark ? "rgba(31,41,55,0.5)" : tw.gray50 }]}
              />
              <Text style={[styles.labelBold, { color: isDark ? tw.gray300 : tw.gray700 }]}>
                Secondary Address (House No. / Flat / Floor)
              </Text>
              <Input
                placeholder="E.g. Flat 402, 4th Floor, CityFood Building"
                value={form.additionalDetails}
                onChangeText={(v) => onChangeField("additionalDetails", v)}
                style={[fieldStyle, { borderColor: isDark ? tw.gray800 : tw.gray200 }]}
              />
            </View>

            <View style={styles.grid}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.labelSmall, { color: labelColor }]}>City</Text>
                <Input value={form.city} onChangeText={(v) => onChangeField("city", v)} onBlur={onSyncTyped} style={fieldStyle} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.labelSmall, { color: labelColor }]}>State</Text>
                <Input value={form.state} onChangeText={(v) => onChangeField("state", v)} onBlur={onSyncTyped} style={fieldStyle} />
              </View>
            </View>

            <View>
              <Text style={[styles.labelSmall, { color: labelColor }]}>Pincode / ZIP</Text>
              <Input
                placeholder="Pincode"
                value={form.zipCode || ""}
                onChangeText={(v) => onChangeField("zipCode", v)}
                style={fieldStyle}
              />
            </View>

            <View>
              <Text style={[styles.labelBold, { color: labelColor }]}>Save address as</Text>
              <View style={styles.labels}>
                {["Home", "Work", "Other"].map((l) => {
                  const active = form.label === l;
                  return (
                    <Button
                      key={l}
                      title={l}
                      variant={active ? "default" : "outline"}
                      onPress={() => onChangeField("label", l)}
                      style={[{ flex: 1 }, active && { backgroundColor: "#dc2626" }]}
                      textStyle={active ? { color: "#ffffff" } : null}
                    />
                  );
                })}
              </View>
            </View>
          </View>
        </Animated.ScrollView>

        <View
          style={[
            styles.saveBar,
            {
              backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
              borderColor: isDark ? tw.gray800 : tw.gray200,
              paddingBottom: 16 + insets.bottom,
            },
          ]}
        >
          <Button
            title={saving ? "Saving..." : "Save Address & Proceed"}
            onPress={onSave}
            disabled={saving}
            style={styles.saveBtn}
            textStyle={styles.saveText}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  loading: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.5)" },
  useLocWrap: { position: "absolute", bottom: 40, right: 16 },
  useLoc: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tw.gray200,
    ...shadow.xl,
  },
  useLocText: { color: "#000000", fontWeight: "500" },
  searchWrap: { position: "absolute", top: 16, left: 16, right: 16, zIndex: 20 },
  searchBox: { borderRadius: radius.xl, justifyContent: "center" },
  searchIcon: { position: "absolute", left: 12, zIndex: 1 },
  searchInput: { height: 48, paddingLeft: 40, borderWidth: 0, borderRadius: radius.xl, ...shadow.lg },
  searchSpinner: { position: "absolute", right: 12 },
  suggestions: { marginTop: 8, borderRadius: radius.xl, borderWidth: 1, overflow: "hidden", ...shadow["2xl"] },
  suggestHead: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 10, fontWeight: "700", color: tw.gray400, letterSpacing: 1 },
  suggestRow: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  suggestTitle: { fontSize: 14, fontWeight: "600" },
  suggestSub: { fontSize: 12 },
  sheet: {
    marginTop: -32,
    zIndex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 16,
    gap: 24,
    boxShadow: "0px -12px 24px -10px rgba(0,0,0,0.1)",
  },
  pinned: { borderWidth: 1, borderRadius: radius.xl, padding: 16, flexDirection: "row", gap: 12 },
  pinnedLabel: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  pinnedText: { fontSize: 14 },
  labelBold: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  labelSmall: { fontSize: 12, marginBottom: 4, fontWeight: "500" },
  grid: { flexDirection: "row", gap: 16 },
  labels: { flexDirection: "row", gap: 8 },
  saveBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, borderTopWidth: 1 },
  saveBtn: { height: 48, backgroundColor: "#dc2626" },
  saveText: { color: "#ffffff", fontWeight: "700", fontSize: 18 },
});
