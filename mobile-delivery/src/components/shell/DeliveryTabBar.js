// DeliveryHomeV2 "3. BOTTOM NAV": white bar, border-t gray-100, px-8 py-3 pb-6, 4 items (icon 24,
// label 11 medium). Active text-gray-950 scale-110; inactive text-gray-400 opacity-70.
// History is a shell tab without a nav item, so no item is active there.
//
// Custom tabBar for src/app/(app)/(tabs)/_layout.js. Expo Router SDK 58 passes
// {state, descriptors, emitter, navigateToTab, insets} (no `navigation`).
import { LayoutGrid, Package, User, Wallet } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";

export const NAV_ITEMS = [
  { name: "index", label: "Feed", icon: LayoutGrid },
  { name: "pocket", label: "Pocket", icon: Wallet },
  { name: "orders", label: "Orders", icon: Package },
  { name: "profile", label: "Profile", icon: User },
];

const PAD_TOP = 12; // py-3
const PAD_BOTTOM = 24; // pb-6
const CONTENT = 24 + 4 + 16; // icon + gap-1 + label line

/** Full bar height (including the bottom safe area). The web's overlays sit at bottom-[92px]. */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return 1 + PAD_TOP + CONTENT + Math.max(PAD_BOTTOM, insets.bottom);
}

export function DeliveryTabBarView({ activeName, onPress, bottomInset = 0 }) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(PAD_BOTTOM, bottomInset) }]}>
      {NAV_ITEMS.map((item) => {
        const active = item.name === activeName;
        const Icon = item.icon;
        const color = active ? tw.gray950 : tw.gray400;
        return (
          <Pressable
            key={item.name}
            onPress={() => onPress(item)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            hitSlop={8}
            style={[styles.item, active ? styles.active : styles.inactive]}
          >
            <Icon size={24} color={color} />
            <Text style={[styles.label, { color }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DeliveryTabBar({ state, emitter, navigateToTab, insets }) {
  const focused = state.routes[state.index];
  const onPress = (item) => {
    const route = state.routes.find((r) => r.name === item.name);
    if (!route) return;
    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (route.key !== focused?.key && !event.defaultPrevented) navigateToTab(route.key);
  };
  return <DeliveryTabBarView activeName={focused?.name} onPress={onPress} bottomInset={insets?.bottom || 0} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: tw.gray100,
    paddingHorizontal: 32,
    paddingTop: PAD_TOP,
    zIndex: 200,
    boxShadow: "0px -5px 20px rgba(0,0,0,0.05)",
  },
  item: { alignItems: "center", gap: 4 },
  active: { transform: [{ scale: 1.1 }] },
  inactive: { opacity: 0.7 },
  label: { fontSize: 11, lineHeight: 16, fontWeight: "500" },
});
