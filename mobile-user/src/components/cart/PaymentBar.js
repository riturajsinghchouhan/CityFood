// Sticky bottom bar: "PAYING WITH x / CHANGE" and the orange Place Order button (Cart.jsx).
import { Banknote, ChevronRight, Wallet, Zap } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScalePressable, Text } from "../ui";
import { radius, shadow, tw } from "../../theme/tokens";
import { RUPEE } from "../../screens/cart/cartUtils";
import { useCartPalette } from "./palette";

export default function PaymentBar({
  method,
  label,
  walletBalance,
  total,
  isPlacingOrder,
  hasSavedAddress,
  onChange,
  onPlaceOrder,
}) {
  const p = useCartPalette();
  const insets = useSafeAreaInsets();
  const Icon = method === "wallet" ? Wallet : method === "razorpay" ? Zap : Banknote;
  const disabled = isPlacingOrder || (method === "wallet" && walletBalance < total);
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: p.card, borderColor: p.isDark ? tw.gray800 : tw.gray200, paddingBottom: 12 + insets.bottom },
      ]}
    >
      <ScalePressable
        scaleTo={0.98}
        onPress={onChange}
        style={[
          styles.payRow,
          { backgroundColor: p.isDark ? "#222222" : tw.gray50, borderColor: p.isDark ? tw.gray800 : tw.gray100 },
        ]}
      >
        <View style={styles.payLeft}>
          <View style={[styles.payIcon, { backgroundColor: p.isDark ? "#7e386620" : "#7e386610" }]}>
            <Icon size={20} color={p.primary} />
          </View>
          <View>
            <Text style={[styles.payingWith, { color: p.t500 }]}>PAYING WITH</Text>
            <View style={styles.methodRow}>
              <Text style={[styles.method, { color: p.isDark ? tw.gray100 : tw.gray800 }]}>{label}</Text>
              {method === "wallet" ? (
                <View style={[styles.balPill, { backgroundColor: p.isDark ? "rgba(20,83,45,0.2)" : tw.green50 }]}>
                  <Text style={[styles.balText, { color: p.isDark ? "#05df72" : tw.green600 }]}>
                    {RUPEE}
                    {walletBalance.toFixed(0)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View style={[styles.change, { backgroundColor: p.plumTint }]}>
          <Text style={[styles.changeText, { color: p.primary }]}>CHANGE</Text>
          <ChevronRight size={14} color={p.primary} />
        </View>
      </ScalePressable>

      <Pressable
        onPress={onPlaceOrder}
        disabled={disabled}
        style={({ pressed }) => [
          styles.place,
          { opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] },
        ]}
      >
        <View style={styles.totalBox}>
          <Text style={styles.totalAmount}>
            {RUPEE}
            {total.toFixed(2)}
          </Text>
          <Text style={styles.totalLabel}>TOTAL</Text>
        </View>
        <View style={styles.placeCenter}>
          <Text style={styles.placeText}>
            {isPlacingOrder ? "Processing..." : !hasSavedAddress ? "Select Address" : "Place Order"}
          </Text>
          <ChevronRight size={16} color="#ffffff" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    ...shadow.lg,
  },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    ...shadow.sm,
  },
  payLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  payIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  payingWith: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, opacity: 0.8 },
  methodRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  method: { fontSize: 14, fontWeight: "700" },
  balPill: { paddingHorizontal: 4, borderRadius: 4 },
  balText: { fontSize: 10, fontWeight: "700" },
  change: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md },
  changeText: { fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  place: {
    height: 48,
    borderRadius: radius["2xl"],
    backgroundColor: tw.orange500,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    boxShadow: "0px 10px 15px -3px rgba(249,115,22,0.3)",
  },
  totalBox: { borderRightWidth: 1.5, borderColor: "rgba(255,255,255,0.2)", paddingRight: 16, justifyContent: "center" },
  totalAmount: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
  totalLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5, color: "rgba(255,255,255,0.8)", marginTop: -2 },
  placeCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  placeText: { fontSize: 14, fontWeight: "700", color: "#ffffff", letterSpacing: 0.4 },
});
