// Port of components/user/AddToCartButton.jsx: "Add to Cart", or a -/qty/+ stepper once the
// item is in the cart. Logged-out users get the web toast and go to login.
import { router, usePathname } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useTheme } from "../../theme/ThemeContext";
import { ScalePressable } from "../ui/primitives";
import Text from "../ui/Text";
import { toast } from "../ui/Toast";

/** item: a cart line (CartContext shape; item.id is the line id). style: outer container style. */
export default function AddToCartButton({ item, style }) {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const { addToCart, isInCart, getCartItem, updateQuantity } = useCart();
  const inCart = isInCart(item.id);
  const cartItem = getCartItem(item.id);

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast.error("Please login to add items to cart");
      router.push({ pathname: "/login", params: { from: pathname } });
      return;
    }
    const result = addToCart(item);
    if (result && !result.ok && result.error) toast.error(result.error);
  };

  if (inCart) {
    return (
      <View style={[styles.row, style]}>
        <View style={[styles.stepper, { backgroundColor: colors.primary }]}>
          <Pressable
            onPress={() => updateQuantity(item.id, (cartItem?.quantity || 0) - 1)}
            style={({ pressed }) => [styles.stepBtn, pressed && { backgroundColor: colors.secondary }]}
            accessibilityLabel="Decrease quantity"
          >
            <Minus size={16} color="#ffffff" />
          </Pressable>
          <Text style={styles.qty}>{cartItem?.quantity || 0}</Text>
          <Pressable
            onPress={() => updateQuantity(item.id, (cartItem?.quantity || 0) + 1)}
            style={({ pressed }) => [styles.stepBtn, pressed && { backgroundColor: colors.secondary }]}
            accessibilityLabel="Increase quantity"
          >
            <Plus size={16} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={style}>
      <ScalePressable scaleTo={0.95} onPress={handleAddToCart} style={[styles.add, { backgroundColor: colors.primary }]}>
        <Text style={styles.addText}>Add to Cart</Text>
      </ScalePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  stepBtn: { height: 32, width: 24, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  qty: { paddingHorizontal: 4, fontSize: 14, fontWeight: "700", minWidth: 16, textAlign: "center", color: "#ffffff" },
  add: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
  },
  addText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
});
