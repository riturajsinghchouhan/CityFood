// Port of components/user/StickyCartCard.jsx: round orange cart button with the item count,
// floating bottom-right on Home (web: fixed bottom-[70px] right-4), opening the cart.
import { router } from "expo-router";
import { ShoppingCart } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useCart } from "../../context/CartContext";
import { useTheme } from "../../theme/ThemeContext";
import { ScalePressable } from "../ui/primitives";
import Text from "../ui/Text";
import { useFloatingBottom } from "./floating";

/** Render as the last child of the screen root. hasBottomNav: the screen is a tab with the bottom bar. */
export default function StickyCartCard({ hasBottomNav = true }) {
  const { itemCount } = useCart();
  const { isDark } = useTheme();
  const bottom = useFloatingBottom(70, hasBottomNav);

  if (itemCount === 0) return null;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <ScalePressable scaleTo={0.95} onPress={() => router.push("/cart")} style={styles.button} accessibilityLabel="Cart">
        <ShoppingCart size={24} color="#ffffff" />
        <View style={[styles.badge, { borderColor: isDark ? "#0a0a0a" : "#ffffff" }]}>
          <Text style={styles.badgeText}>{itemCount}</Text>
        </View>
      </ScalePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16, zIndex: 50 },
  button: {
    backgroundColor: "#ff6900",
    borderRadius: 9999,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 15px rgba(255,102,0,0.4)",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#000000",
    borderRadius: 9999,
    minWidth: 18,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    alignItems: "center",
  },
  badgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700", lineHeight: 12 },
});
