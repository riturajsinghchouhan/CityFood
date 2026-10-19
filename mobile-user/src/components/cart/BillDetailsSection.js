// Collapsible "To Pay" bill details with the other-platform comparison (Cart.jsx "Bill Details"),
// plus the cancellation policy note.
import { ChevronRight, FileText, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui";
import { radius, shadow, tw } from "../../theme/tokens";
import { RUPEE } from "../../screens/cart/cartUtils";
import { DashedDivider, useCartPalette } from "./palette";

function usePulse() {
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
  return opacity;
}

function Row({ label, value, p, valueStyle, onPressLabel }) {
  return (
    <View style={styles.line}>
      {onPressLabel ? (
        <Pressable onPress={onPressLabel}>
          <Text style={[styles.lineLabel, styles.gstLabel, { color: p.t600 }]}>{label}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.lineLabel, { color: p.t600 }]}>{label}</Text>
      )}
      <Text style={[styles.lineValue, { color: p.t800 }, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function BillDetailsSection({
  expanded,
  onToggle,
  total,
  subtotal,
  deliveryFee,
  deliveryFeeBreakdownText,
  freeDeliveryUpTo,
  platformFee,
  packagingFee,
  gstCharges,
  couponDiscount,
  platformSavings,
  onShowGst,
}) {
  const p = useCartPalette();
  const pulse = usePulse();
  const green = p.isDark ? tw.green500 : tw.green600;
  return (
    <>
      <View style={[p.cardStyle, { paddingVertical: 20 }]}>
        <Pressable onPress={onToggle} style={styles.header}>
          <View style={styles.headerLeft}>
            <FileText size={20} color={p.t500} />
            <View>
              <View style={styles.toPayRow}>
                <Text style={[styles.toPay, { color: green }]}>To Pay</Text>
                {platformSavings.hasPlatformPricing ? (
                  <Text style={[styles.strike, { color: p.isDark ? tw.gray500 : tw.gray400 }]}>
                    {RUPEE}
                    {platformSavings.totalPlatformPriceWithGst.toFixed(2)}
                  </Text>
                ) : null}
                <Text style={[styles.toPayAmount, { color: green }]}>
                  {RUPEE}
                  {total.toFixed(2)}
                </Text>
              </View>
              <Text style={[styles.incl, { color: p.t500 }]}>Incl. taxes and charges</Text>
            </View>
          </View>
          <ChevronRight
            size={20}
            color={tw.gray400}
            style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}
          />
        </Pressable>

        {expanded ? (
          <View style={styles.body}>
            <DashedDivider color={p.divider} style={{ marginBottom: 4 }} />
            <Row label="Item Total" value={`${RUPEE}${subtotal.toFixed(2)}`} p={p} />
            <Row
              label="Delivery Fee"
              value={deliveryFee === 0 ? "FREE" : `${RUPEE}${deliveryFee.toFixed(2)}`}
              valueStyle={deliveryFee === 0 ? { color: p.primary } : null}
              p={p}
            />
            {deliveryFeeBreakdownText ? (
              <View style={[styles.breakdown, { borderColor: tw.gray100 }]}>
                <Text style={[styles.breakdownText, { color: p.t500 }]}>{deliveryFeeBreakdownText}</Text>
              </View>
            ) : null}
            {freeDeliveryUpTo > 0 ? (
              <View style={{ marginTop: -6, flexDirection: "row" }}>
                <Animated.View
                  style={[
                    styles.freeChip,
                    { backgroundColor: p.primary + "26", borderColor: p.primary + "40", opacity: pulse },
                  ]}
                >
                  <Sparkles size={12} color={p.primary} />
                  <Text style={[styles.freeChipText, { color: p.primary }]}>Free delivery at</Text>
                  <Text style={[styles.freeChipText, { color: p.colors.secondary }]}>
                    {RUPEE}
                    {freeDeliveryUpTo.toFixed(0)}+
                  </Text>
                </Animated.View>
              </View>
            ) : null}
            <Row label="Platform Fee" value={`${RUPEE}${platformFee.toFixed(2)}`} p={p} />
            <Row label="Packaging Charges" value={`${RUPEE}${packagingFee.toFixed(2)}`} p={p} />
            <Row label="GST" value={`${RUPEE}${gstCharges.toFixed(2)}`} p={p} onPressLabel={onShowGst} />
            {couponDiscount > 0 ? (
              <View style={styles.line}>
                <Text style={[styles.lineLabel, { color: p.primary, fontWeight: "500" }]}>Coupon Discount</Text>
                <Text style={[styles.lineValue, { color: p.primary }]}>
                  -{RUPEE}
                  {couponDiscount.toFixed(2)}
                </Text>
              </View>
            ) : null}

            {platformSavings.hasPlatformPricing ? (
              <Animated.View
                style={[
                  styles.compare,
                  {
                    backgroundColor: p.primary + (p.isDark ? "26" : "14"),
                    borderColor: p.primary + "33",
                    opacity: pulse,
                  },
                ]}
              >
                <View style={styles.compareRow}>
                  <View style={styles.compareTitle}>
                    <Sparkles size={16} color={p.primary} />
                    <Text style={[styles.compareTitleText, { color: p.primary }]}>Other platform total</Text>
                  </View>
                  <Text style={[styles.lineValue, { color: p.t700 }]}>
                    {RUPEE}
                    {platformSavings.totalPlatformPrice.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.compareRow}>
                  <Text style={[styles.small, { color: p.t600 }]}>GST on other platforms</Text>
                  <Text style={[styles.small, { color: p.t600, fontWeight: "500" }]}>
                    {RUPEE}
                    {platformSavings.totalPlatformGst.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.compareRow}>
                  <Text style={[styles.lineLabel, { color: p.t800, fontWeight: "600" }]}>
                    Other platform total (incl. GST)
                  </Text>
                  <Text style={[styles.lineLabel, { color: p.t800, fontWeight: "600" }]}>
                    {RUPEE}
                    {platformSavings.totalPlatformPriceWithGst.toFixed(2)}
                  </Text>
                </View>
                {platformSavings.items.length > 0 ? (
                  <View style={[styles.compareItems, { borderColor: p.primary + "26" }]}>
                    {platformSavings.items.slice(0, 2).map((item, idx) => (
                      <View key={idx} style={styles.compareRow}>
                        <Text style={[styles.small, { color: p.t600 }]}>
                          {item.name} x{item.quantity}
                        </Text>
                        <Text style={[styles.small, { color: p.primary, fontWeight: "500" }]}>
                          -{RUPEE}
                          {item.savings.toFixed(0)}
                        </Text>
                      </View>
                    ))}
                    {platformSavings.items.length > 2 ? (
                      <Text style={[styles.small, { color: p.primary, fontWeight: "600", textAlign: "center" }]}>
                        +{platformSavings.items.length - 2} more items
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <View style={[styles.saveBar, { backgroundColor: p.primary }]}>
                  <Text style={styles.saveBarText}>You save approx</Text>
                  <Text style={styles.saveBarText}>
                    {RUPEE}
                    {platformSavings.totalSavings.toFixed(0)} ({platformSavings.savingsPercentage}%)
                  </Text>
                </View>
              </Animated.View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.policy, { backgroundColor: p.isDark ? "rgba(26,26,26,0.3)" : tw.gray50 }]}>
        <Text style={[styles.policyTitle, { color: p.isDark ? tw.gray500 : tw.gray400 }]}>Cancellation policy:</Text>
        <Text style={[styles.policyText, { color: p.isDark ? tw.gray500 : tw.gray400 }]}>
          Please double-check your order and address details.{"\n"}Orders are non-refundable once placed.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  toPayRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 2 },
  toPay: { fontSize: 16, fontWeight: "700", letterSpacing: 0.4 },
  strike: { fontSize: 16, fontWeight: "500", textDecorationLine: "line-through" },
  toPayAmount: { fontSize: 16, fontWeight: "700" },
  incl: { fontSize: 12, marginTop: 4 },
  body: { marginTop: 16, gap: 12 },
  line: { flexDirection: "row", justifyContent: "space-between" },
  lineLabel: { fontSize: 14 },
  gstLabel: { borderBottomWidth: 1, borderColor: tw.gray400 },
  lineValue: { fontSize: 14, fontWeight: "500" },
  breakdown: { marginTop: -6, marginLeft: 4, borderLeftWidth: 2, paddingLeft: 8 },
  breakdownText: { fontSize: 11 },
  freeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    ...shadow.sm,
  },
  freeChipText: { fontSize: 11, fontWeight: "600" },
  compare: { borderRadius: radius.md, borderWidth: 1, padding: 12, paddingBottom: 0, gap: 8, marginTop: 8, overflow: "hidden", ...shadow.sm },
  compareRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compareTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  compareTitleText: { fontSize: 14, fontWeight: "600" },
  compareItems: { borderTopWidth: 1, paddingTop: 8, gap: 4 },
  small: { fontSize: 12 },
  saveBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginHorizontal: -12,
  },
  saveBarText: { fontSize: 12, fontWeight: "700", color: "#ffffff" },
  policy: { paddingHorizontal: 16, paddingVertical: 16, borderRadius: radius["2xl"] },
  policyTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2, letterSpacing: -0.3 },
  policyText: { fontSize: 13, lineHeight: 18, letterSpacing: -0.3 },
});
