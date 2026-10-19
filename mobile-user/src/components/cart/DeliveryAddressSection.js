// "Delivery at" card: current-location / saved mode, Home/Work/Other chips, saved address list and
// the chevron that opens the address selector (Cart.jsx "Delivery Address").
import { ChevronRight, MapPin } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui";
import { radius, tw } from "../../theme/tokens";
import {
  displayAddressLabel,
  formatFullAddress,
  getAddressId,
  normalizeLabel,
} from "../../screens/cart/cartUtils";
import { useCartPalette } from "./palette";

// animate-pulse
function PulseText({ style, children }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.Text style={[style, { opacity }]}>{children}</Animated.Text>;
}

export default function DeliveryAddressSection({
  deliveryAddressMode,
  currentLocationLoading,
  currentLocationAddress,
  defaultAddress,
  hasSavedAddress,
  addresses,
  selectedAddressId,
  onSelectLabel,
  onSelectAddress,
  onOpenSelector,
}) {
  const p = useCartPalette();
  const isCurrent = deliveryAddressMode === "current";
  return (
    <View style={[p.cardStyle, { paddingVertical: 20 }]}>
      <View style={styles.top}>
        <View style={styles.left}>
          <View style={[styles.pinBox, { backgroundColor: p.plumTint }]}>
            <MapPin size={20} color={p.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: p.t800 }]}>
              Delivery at <Text style={[styles.title, { fontWeight: "600", color: p.t800 }]}>
                {isCurrent ? "Current location" : "Location"}
              </Text>
            </Text>
            {isCurrent ? (
              <View style={{ marginTop: 4 }}>
                {currentLocationLoading || !currentLocationAddress ? (
                  <PulseText style={[styles.sub, { color: p.t500, fontFamily: "Poppins_400Regular" }]}>
                    Finding your current address...
                  </PulseText>
                ) : (
                  <Text numberOfLines={2} style={[styles.sub, { color: p.t500 }]}>
                    {formatFullAddress(currentLocationAddress) ||
                      currentLocationAddress?.formattedAddress ||
                      currentLocationAddress?.address ||
                      "Add delivery address"}
                  </Text>
                )}
                <View style={styles.gpsRow}>
                  <View style={[styles.gpsBadge, { backgroundColor: p.plumTint, borderColor: p.primary + "4D" }]}>
                    <Text style={[styles.gpsText, { color: p.primary }]}>GPS enabled</Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text numberOfLines={2} style={[styles.savedText, { color: p.t500 }]}>
                {defaultAddress
                  ? formatFullAddress(defaultAddress) ||
                    defaultAddress?.formattedAddress ||
                    defaultAddress?.address ||
                    "Add delivery address"
                  : "Add delivery address"}
              </Text>
            )}
            {!hasSavedAddress ? (
              <Text style={[styles.selectHint, { color: p.primary }]}>Select a delivery location to continue</Text>
            ) : null}

            <View style={styles.chips}>
              {["Home", "Work", "Other"].map((label) => {
                const exists = addresses.some((a) => normalizeLabel(a.label) === normalizeLabel(label));
                return (
                  <Pressable
                    key={label}
                    disabled={!exists}
                    onPress={() => onSelectLabel(label)}
                    style={[
                      styles.chip,
                      exists
                        ? { backgroundColor: p.isDark ? tw.gray800 : tw.slate100 }
                        : {
                            backgroundColor: p.isDark ? tw.gray900 : tw.gray50,
                            borderWidth: 1,
                            borderColor: tw.gray100,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: exists ? (p.isDark ? tw.gray300 : "#314158") : tw.gray400 },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {addresses.length > 0 ? (
              <View style={styles.list}>
                {addresses.map((address) => {
                  const addressId = getAddressId(address);
                  const isSelected = addressId && addressId === selectedAddressId;
                  return (
                    <Pressable
                      key={addressId || `${address.label}-${address.street}-${address.city}`}
                      onPress={() => onSelectAddress(address)}
                      style={[
                        styles.addr,
                        isSelected
                          ? { borderColor: p.primary, backgroundColor: p.isDark ? p.primary + "0D" : "#7e386605" }
                          : { borderColor: p.isDark ? tw.gray800 : tw.slate100 },
                      ]}
                    >
                      <View style={styles.addrRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.addrLabel, { color: p.t900 }]}>
                            {displayAddressLabel(address.label)}
                          </Text>
                          <Text numberOfLines={2} style={[styles.addrText, { color: p.t500 }]}>
                            {formatFullAddress(address) || address.address || "Address details"}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View style={[styles.selectedBadge, { backgroundColor: p.primary }]}>
                            <Text style={styles.selectedText}>SELECTED</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityLabel="Open location selector"
          onPress={onOpenSelector}
          style={[styles.chevron, { backgroundColor: p.isDark ? "#7e386615" : "#7e386605" }]}
        >
          <ChevronRight size={20} color={p.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "flex-start", gap: 16, flex: 1 },
  pinBox: { padding: 8, borderRadius: radius.xl, marginTop: 2 },
  title: { fontSize: 14 },
  sub: { fontSize: 12 },
  savedText: { fontSize: 14, marginTop: 4, paddingRight: 16 },
  gpsRow: { marginTop: 4, flexDirection: "row" },
  gpsBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  gpsText: { fontSize: 10, fontWeight: "600" },
  selectHint: { fontSize: 14, fontWeight: "500", marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: "600" },
  list: { marginTop: 16, gap: 12 },
  addr: { borderRadius: radius.xl, borderWidth: 2, padding: 12 },
  addrRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  addrLabel: { fontSize: 14, fontWeight: "700" },
  addrText: { fontSize: 12, marginTop: 4 },
  selectedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  selectedText: { fontSize: 10, fontWeight: "700", color: "#ffffff", letterSpacing: 0.5 },
  chevron: { padding: 8, borderRadius: 999 },
});
