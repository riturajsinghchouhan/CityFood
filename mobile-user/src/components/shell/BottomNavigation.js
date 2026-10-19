// Port of components/user/BottomNavigation.jsx (mobile tab bar: Home, Under ₹X, Orders, Profile).
// Dining shows this bar too but has no tab, so nothing is highlighted there.
import { House, ShoppingBag, Tag, User } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPublicLandingSettings } from "../../api/content";
import { useAppLocation } from "../../context/LocationContext";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";
import Text from "../ui/Text";

const TABS = [
  { name: "index", label: () => "Home", Icon: House },
  { name: "under-250", label: (limit) => `Under ₹${limit}`, Icon: Tag },
  { name: "orders", label: () => "Orders", Icon: ShoppingBag },
  { name: "profile", label: () => "Profile", Icon: User },
];

export default function BottomNavigation({ state, navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { zoneId, isOutOfService } = useAppLocation();
  const [limit, setLimit] = useState(250);

  useEffect(() => {
    let cancelled = false;
    getPublicLandingSettings(zoneId || null)
      .then((settings) => {
        if (!cancelled && typeof settings?.under250PriceLimit === "number") {
          setLimit(settings.under250PriceLimit);
        }
      })
      .catch(() => {
        if (!cancelled) setLimit(250);
      });
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  if (isOutOfService) return null;

  const activeName = state.routes[state.index]?.name;
  const inactive = isDark ? tw.gray400 : tw.slate500;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
          borderTopColor: isDark ? tw.gray800 : tw.gray100,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <View style={styles.row}>
        {TABS.map(({ name, label, Icon }) => {
          const active = activeName === name;
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                const route = state.routes.find((r) => r.name === name);
                const event = navigation.emit({ type: "tabPress", target: route?.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) navigation.navigate(name);
              }}
              style={[
                styles.tab,
                active && { backgroundColor: isDark ? `${colors.primary}33` : "#ffeef2" },
              ]}
            >
              <Icon size={20} color={active ? colors.primary : inactive} strokeWidth={active ? 2.5 : 2} />
              <Text
                style={[
                  styles.label,
                  { color: active ? colors.primary : inactive, fontWeight: active ? "700" : "600" },
                ]}
                numberOfLines={1}
              >
                {label(limit)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    ...shadow.bottomNav,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 64,
  },
  tab: {
    width: "22%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 24,
  },
  label: { fontSize: 10 },
});
