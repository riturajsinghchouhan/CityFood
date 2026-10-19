// Cart line items with steppers, variant pill and discount price (Cart.jsx "Cart Items").
import { Minus, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { AppImage, Text } from "../ui";
import { shadow, tw } from "../../theme/tokens";
import { getLineDisplayPrices, RUPEE } from "../../screens/cart/cartUtils";
import { DashedDivider, useCartPalette } from "./palette";

function VegBox({ isVeg }) {
  const color = isVeg ? tw.green600 : tw.red600;
  return (
    <View style={[styles.vegBox, { borderColor: color }]}>
      <View style={[styles.vegDot, { backgroundColor: color }]} />
    </View>
  );
}

function CartLine({ item, restaurantData, onQuantity, p }) {
  const { originalDisplayPrice, displayPrice } = getLineDisplayPrices(item, restaurantData);
  const qty = item.quantity || 1;
  const isVeg = item.isVeg === true || item.foodType === "Veg";
  const hasDiscount = originalDisplayPrice > displayPrice;
  return (
    <View style={styles.row}>
      <VegBox isVeg={isVeg} />
      <View style={styles.middle}>
        {item.image ? (
          <View style={[styles.imageWrap, { borderColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
            <AppImage src={item.image} width={64} style={styles.image} placeholderType="none" />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[styles.name, { color: p.t900 }]}>
            {item.name}
          </Text>
          {item.variantName ? (
            <View style={[styles.variant, { backgroundColor: p.isDark ? "rgba(31,41,55,0.5)" : tw.gray50 }]}>
              <Text style={[styles.variantText, { color: p.t500 }]}>{item.variantName}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.right}>
        <View
          style={[
            styles.stepper,
            { borderColor: p.primary + (p.isDark ? "66" : "4D"), backgroundColor: p.isDark ? tw.gray900 : "#ffffff" },
          ]}
        >
          <Pressable hitSlop={4} onPress={() => onQuantity(item.id, item.quantity - 1)} style={styles.stepBtn}>
            <Minus size={14} color={p.primary} />
          </Pressable>
          <Text style={[styles.qty, { color: p.primary }]}>{item.quantity}</Text>
          <Pressable hitSlop={4} onPress={() => onQuantity(item.id, item.quantity + 1)} style={styles.stepBtn}>
            <Plus size={14} color={p.primary} />
          </Pressable>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={styles.priceRow}>
            {hasDiscount ? (
              <Text style={styles.strike}>
                {RUPEE}
                {(originalDisplayPrice * qty).toFixed(0)}
              </Text>
            ) : null}
            <Text style={[styles.price, { color: p.t900 }]}>
              {RUPEE}
              {(displayPrice * qty).toFixed(0)}
            </Text>
          </View>
          {hasDiscount ? (
            <View style={styles.offBadge}>
              <Text style={styles.offText}>
                {Math.round(((originalDisplayPrice - displayPrice) / originalDisplayPrice) * 100)}% OFF
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function CartItemsCard({ cart, restaurantData, onQuantity, onAddMore }) {
  const p = useCartPalette();
  return (
    <View style={[p.cardStyle, { paddingVertical: 16 }]}>
      {cart.map((item, index) => (
        <View key={item.id}>
          <CartLine item={item} restaurantData={restaurantData} onQuantity={onQuantity} p={p} />
          {index < cart.length - 1 ? (
            <DashedDivider color={p.isDark ? "rgba(31,41,55,0.4)" : tw.gray100} style={styles.dashed} />
          ) : null}
        </View>
      ))}
      <Pressable onPress={onAddMore} style={styles.addMore}>
        <Plus size={16} color={p.primary} />
        <Text style={[styles.addMoreText, { color: p.primary }]}>Add more items</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  vegBox: { width: 16, height: 16, borderWidth: 2, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  middle: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 16 },
  imageWrap: { width: 64, height: 64, borderRadius: 16, overflow: "hidden", borderWidth: 1, ...shadow.sm },
  image: { width: "100%", height: "100%" },
  name: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  variant: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  variantText: { fontSize: 10, fontWeight: "500" },
  right: { alignItems: "flex-end", gap: 10 },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, overflow: "hidden", ...shadow.sm },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  qty: { paddingHorizontal: 8, minWidth: 28, textAlign: "center", fontSize: 14, fontWeight: "900" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  strike: { fontSize: 12, color: tw.gray400, textDecorationLine: "line-through" },
  price: { fontSize: 14, fontWeight: "900" },
  offBadge: {
    marginTop: 4,
    backgroundColor: tw.green50,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  offText: { fontSize: 10, fontWeight: "700", color: tw.green600, textTransform: "uppercase" },
  dashed: { marginTop: 24, marginBottom: 24 },
  addMore: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, alignSelf: "flex-start" },
  addMoreText: { fontSize: 14, fontWeight: "500" },
});
