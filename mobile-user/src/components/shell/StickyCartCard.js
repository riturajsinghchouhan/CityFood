// Port of components/user/StickyCartCard.jsx: Home page cart bar with the dish photos,
// restaurant + "Menu" link, "N items | ₹total / Checkout" and a clear-cart button
// (web: fixed bottom-17.5 inset-x-0 px-3, max-w-xl).
import { router } from "expo-router";
import { ChevronRight, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Animated, Pressable, StyleSheet, View } from "react-native";
import { useCart } from "../../context/CartContext";
import { useTheme } from "../../theme/ThemeContext";
import { FOOD_IMAGES } from "../restaurant-cards";
import AppImage from "../ui/AppImage";
import { ScalePressable } from "../ui/primitives";
import Text from "../ui/Text";
import { useFloatingBottom } from "./floating";

const MAX_THUMBS = 2;

/** Render as the last child of the screen root. hasBottomNav: the screen is a tab with the bottom bar. */
export default function StickyCartCard({ hasBottomNav = true }) {
  const { cart, itemCount, clearCart } = useCart();
  const { isDark } = useTheme();
  const bottom = useFloatingBottom(70, hasBottomNav);
  const [slide] = useState(() => new Animated.Value(0));
  const visible = itemCount > 0;

  useEffect(() => {
    Animated.spring(slide, { toValue: visible ? 1 : 0, stiffness: 320, damping: 28, mass: 1, useNativeDriver: true }).start();
  }, [visible, slide]);

  if (!visible) return null;

  const items = Array.isArray(cart) ? cart : [];
  // One photo per dish (variants of the same dish share a photo), newest first.
  const dishes = [];
  const seen = new Set();
  for (const item of [...items].reverse()) {
    const key = String(item?.itemId || item?.id || item?.name || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    dishes.push(item);
  }
  const thumbs = dishes.slice(0, MAX_THUMBS);
  const extra = dishes.length - thumbs.length;

  const restaurantName = items[0]?.restaurant || "Restaurant";
  const restaurantSlug = restaurantName.toLowerCase().replace(/\s+/g, "-");
  const totalPrice = items.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0), 0);

  const handleClear = () => {
    Alert.alert("Clear cart", `Remove all items from ${restaurantName} from your cart?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: clearCart },
    ]);
  };

  const ring = isDark ? "#1a1a1a" : "#ffffff";

  return (
    <Animated.View
      style={[
        styles.wrap,
        { bottom, opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.card,
          { backgroundColor: ring, borderColor: isDark ? "#1e2939" : "#f3f4f6" },
        ]}
      >
        <View style={styles.thumbs}>
          {thumbs.map((item, i) => (
            <View
              key={String(item.itemId || item.id || i)}
              style={[styles.thumb, { borderColor: ring, zIndex: MAX_THUMBS - i + 1 }, i > 0 && { marginLeft: -16 }]}
            >
              <AppImage src={item.image} width={48} style={StyleSheet.absoluteFill} fallbackSrc={FOOD_IMAGES[i % FOOD_IMAGES.length]} />
            </View>
          ))}
          {extra > 0 ? (
            <View style={[styles.thumb, styles.extra, { borderColor: ring, marginLeft: -16, zIndex: 0 }]}>
              <Text style={styles.extraText}>+{extra}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.middle}>
          <Text numberOfLines={1} style={[styles.name, { color: isDark ? "#ffffff" : "#101828" }]}>
            {restaurantName}
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: "/restaurants/[slug]", params: { slug: restaurantSlug } })}
            style={[styles.menuLink, { backgroundColor: isDark ? "rgba(255,105,0,0.1)" : "#fff7ed" }]}
          >
            <Text style={styles.menuText}>Menu</Text>
            <ChevronRight size={14} color="#f54a00" strokeWidth={2.5} />
          </Pressable>
        </View>

        <ScalePressable scaleTo={0.98} onPress={() => router.push("/cart")} style={styles.checkout}>
          <Text style={styles.checkoutSub}>
            {itemCount} {itemCount === 1 ? "item" : "items"} | ₹{Math.round(totalPrice)}
          </Text>
          <Text style={styles.checkoutTitle}>Checkout</Text>
        </ScalePressable>

        <ScalePressable
          scaleTo={0.95}
          onPress={handleClear}
          accessibilityLabel="Clear cart"
          style={[styles.clear, { backgroundColor: isDark ? "rgba(251,44,54,0.1)" : "#fef2f2" }]}
        >
          <Trash2 size={20} color="#fb2c36" />
        </ScalePressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, zIndex: 50, paddingHorizontal: 12, alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 576,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    padding: 10,
    boxShadow: "0px 8px 30px rgba(0,0,0,0.14)",
  },
  thumbs: { flexDirection: "row", alignItems: "center" },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  extra: { backgroundColor: "#fff7ed", alignItems: "center", justifyContent: "center" },
  extraText: { fontSize: 13, fontWeight: "700", color: "#f54a00" },
  middle: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "700", lineHeight: 19 },
  menuLink: {
    marginTop: 4,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 2,
  },
  menuText: { fontSize: 13, fontWeight: "600", color: "#f54a00" },
  checkout: {
    backgroundColor: "#1f6b2e",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
  },
  checkoutSub: { fontSize: 11, fontWeight: "500", color: "#ffffff", lineHeight: 14 },
  checkoutTitle: { fontSize: 16, fontWeight: "700", color: "#ffffff", lineHeight: 20 },
  clear: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
