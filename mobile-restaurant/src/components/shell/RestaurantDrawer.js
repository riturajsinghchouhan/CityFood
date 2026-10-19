// Port of components/restaurant/RestaurantSidebar.jsx at phone width: a w-72 panel that slides in
// from the left over a bg-gray-900/50 overlay. Closes on X, on an overlay tap, on Android back
// and on every route change (RestaurantLayout effect).
import { usePathname } from "expo-router";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, BackHandler, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { resolveMediaUrl } from "../ui/AppImage";
import Text from "../ui/Text";
import { isSidebarItemActive, RESTAURANT_SIDEBAR_SECTIONS } from "./layoutConfig";
import { openShellRoute } from "./navigate";
import { useBusinessSettings } from "./stores";

const WIDTH = 288; // w-72

export default function RestaurantDrawer({ open, onClose }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { companyName, logoUrl } = useBusinessSettings();
  const [mounted, setMounted] = useState(open);
  const [anim] = useState(() => new Animated.Value(0));
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    // transition-transform duration-300 ease-in-out
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, anim]);

  useEffect(() => {
    if (!open) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!mounted) return null;

  const logo = resolveMediaUrl(logoUrl);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      {open ? <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close menu" /> : null}
      <Animated.View
        style={[
          styles.panel,
          {
            borderRightColor: colors.rtBorder,
            transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-WIDTH, 0] }) }],
          },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: colors.rtBorder, paddingTop: 16 + insets.top }]}>
          <View style={styles.brand}>
            {logo ? <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" /> : null}
            <View style={styles.brandText}>
              <Text numberOfLines={1} style={[styles.company, { color: colors.text }]}>
                {companyName || "Restaurant Panel"}
              </Text>
              <Text style={[styles.caption, { color: colors.captionMuted }]}>PARTNER PANEL</Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close menu" hitSlop={4}>
            <X size={20} color={tw.gray500} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.nav}
          contentContainerStyle={[styles.navContent, { paddingBottom: 16 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {RESTAURANT_SIDEBAR_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.captionMuted }]}>{section.title.toUpperCase()}</Text>
              <View style={styles.items}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isSidebarItemActive(item.route, pathname);
                  const fg = active ? colors.primary : tw.gray600;
                  return (
                    <Pressable
                      key={item.route}
                      onPress={() => {
                        onClose();
                        openShellRoute(item.route, pathname);
                      }}
                      style={({ pressed }) => [
                        styles.item,
                        active ? { backgroundColor: colors.primarySoft } : pressed ? styles.itemPressed : null,
                      ]}
                    >
                      {Icon ? <Icon size={20} color={fg} /> : null}
                      <Text numberOfLines={1} style={[styles.itemLabel, { color: fg }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(16,24,40,0.5)" },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  logo: { width: 36, height: 36, borderRadius: 10 },
  brandText: { flex: 1, minWidth: 0 },
  company: { fontSize: 14, fontWeight: "900" },
  caption: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  close: { borderRadius: 8, padding: 8 },
  nav: { flex: 1 },
  navContent: { paddingHorizontal: 12, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { marginBottom: 8, paddingHorizontal: 8, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  items: { gap: 2 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemPressed: { backgroundColor: tw.gray50 },
  itemLabel: { fontSize: 14, fontWeight: "500", flexShrink: 1 },
});
