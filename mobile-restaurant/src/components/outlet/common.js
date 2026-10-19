// Shared pieces for the Explore / outlet screens: the white sticky page header with a back arrow,
// the shadcn Switch (components/ui/switch.tsx: h-6 w-11 track, h-5 w-5 thumb), the dark bottom
// toast DeliverySettings renders itself, and the address formatters the web screens repeat.
import { ArrowLeft, CheckCircle } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { tw } from "../../theme/tokens";
import { Text } from "../ui";

export const extra = {
  green400: "#05df72",
  green900: "#0d542b",
  red900: "#82181a",
  red200: "#ffc9c9",
  green200: "#b9f8cf",
  blue200: "#bedbff",
  amber50: "#fffbeb",
  amber100: "#fef3c6",
  amber200: "#fee685",
  amber600: "#e17100",
  amber700: "#bb4d00",
  amber900: "#7b3306",
  orange600: "#f54900",
  emerald50: "#ecfdf5",
  emerald100: "#d0fae5",
  emerald300: "#5ee9b5",
  emerald500: "#00bc7d",
  emerald600: "#009966",
  blue100: "#dbeafe",
  blue300: "#8ec5ff",
  blue500: "#2b7fff",
};

// "bg-white border-b border-gray-200 px-4 py-3 sticky top-0": back arrow + title (+ subtitle).
export function PageHeader({ title, subtitle, onBack, right, titleStyle, style }) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: tw.gray100 }]}
            hitSlop={6}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={tw.gray900} />
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, titleStyle]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

// components/ui/switch.tsx with the screens' data-[state] colours (green-500 / gray-300).
export function ShadSwitch({ checked, onCheckedChange, disabled, checkedColor = tw.green500, uncheckedColor = tw.gray300 }) {
  const [x] = useState(() => new Animated.Value(checked ? 1 : 0));
  useEffect(() => {
    Animated.timing(x, { toValue: checked ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [checked, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(checked), disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onCheckedChange?.(!checked)}
      style={[styles.track, { backgroundColor: checked ? checkedColor : uncheckedColor, opacity: disabled ? 0.5 : 1 }]}
    >
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]}
      />
    </Pressable>
  );
}

// DeliverySettings' own "fixed bottom-6" toast: bg-gray-900, green check, spring in from below.
export function DarkToast({ visible, message, bottom = 24 }) {
  const [anim] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    const a = visible
      ? Animated.spring(anim, { toValue: 1, damping: 25, stiffness: 300, mass: 1, useNativeDriver: true })
      : Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true });
    a.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim]);
  if (!mounted) return null;
  return (
    <View pointerEvents="none" style={[styles.toastWrap, { bottom }]}>
      <Animated.View
        style={[
          styles.toast,
          { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] },
        ]}
      >
        <CheckCircle size={20} color={extra.green400} />
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const trimmed = (v) => (typeof v === "string" ? v.trim() : v ? String(v).trim() : "");

// ExploreMore.jsx formatAddress.
export function formatExploreAddress(location) {
  if (!location) return "";
  if (location.formattedAddress && location.formattedAddress.trim() !== "" && location.formattedAddress !== "Select location") {
    return location.formattedAddress.trim();
  }
  if (location.address && location.address.trim() !== "") return location.address.trim();
  const parts = [];
  if (location.addressLine1) parts.push(trimmed(location.addressLine1));
  else if (location.street) parts.push(trimmed(location.street));
  if (location.addressLine2) parts.push(trimmed(location.addressLine2));
  if (location.area) parts.push(trimmed(location.area));
  if (location.landmark) parts.push(trimmed(location.landmark));
  if (location.city) {
    const city = trimmed(location.city);
    if (!parts.some((p) => p.includes(city))) parts.push(city);
  }
  if (location.state) {
    const state = trimmed(location.state);
    if (!parts.some((p) => p.includes(state))) parts.push(state);
  }
  if (location.zipCode || location.pincode || location.postalCode) {
    parts.push(trimmed(location.zipCode || location.pincode || location.postalCode));
  }
  return parts.join(", ") || "";
}

// ZoneSetup.jsx formatAddress.
export function formatZoneAddress(location) {
  if (!location) return "";
  if (location.formattedAddress && location.formattedAddress.trim() !== "") return location.formattedAddress.trim();
  if (location.address && location.address.trim() !== "") return location.address.trim();
  const parts = [];
  if (location.addressLine1) parts.push(trimmed(location.addressLine1));
  if (location.addressLine2) parts.push(trimmed(location.addressLine2));
  if (location.area) parts.push(trimmed(location.area));
  if (location.city) parts.push(trimmed(location.city));
  if (location.state) parts.push(trimmed(location.state));
  if (location.zipCode || location.pincode) parts.push(trimmed(location.zipCode || location.pincode));
  return parts.length > 0 ? parts.join(", ") : "";
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { padding: 6, borderRadius: 8 },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: tw.gray500 },
  track: {
    width: 44,
    height: 24,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "center",
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 9999,
    backgroundColor: "#ffffff",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 16, zIndex: 200 },
  toast: {
    maxWidth: 448,
    backgroundColor: tw.gray900,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  toastText: { flexShrink: 1, fontSize: 14, fontWeight: "500", color: "#ffffff" },
});
