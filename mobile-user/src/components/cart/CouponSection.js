// Free-delivery note, applied coupon, best coupon, "View all coupons" and manual code (Cart.jsx).
import { CheckCircle2, ChevronRight, Percent } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { inputFont, Text } from "../ui";
import { tw } from "../../theme/tokens";
import { RUPEE } from "../../screens/cart/cartUtils";
import { DashedDivider, useCartPalette } from "./palette";

function CouponHint({ coupon, subtotal, p, showDescription }) {
  if (coupon.customerGroup === "new") {
    return <Text style={[styles.hint11, { color: p.primary }]}>First-time users only</Text>;
  }
  if (subtotal < coupon.minOrder) {
    return (
      <Text numberOfLines={showDescription ? 1 : undefined} style={styles.unlock}>
        Add items worth {RUPEE}
        {(coupon.minOrder - subtotal).toFixed(0)} more to unlock
      </Text>
    );
  }
  if (showDescription) {
    return (
      <Text numberOfLines={1} style={[styles.desc, { color: tw.gray500 }]}>
        {coupon.description}
      </Text>
    );
  }
  return null;
}

export default function CouponSection({
  deliveryFee,
  savedDeliveryAmount,
  appliedCoupon,
  discount,
  onRemoveCoupon,
  loadingCoupons,
  availableCoupons,
  subtotal,
  userOrderCount,
  showCoupons,
  onToggleCoupons,
  onApplyCoupon,
  manualCouponCode,
  onChangeManualCode,
  onApplyManualCode,
}) {
  const p = useCartPalette();
  const isDisabled = (c) => subtotal < c.minOrder || (c.customerGroup === "new" && userOrderCount > 0);
  const best = availableCoupons[0];
  return (
    <View
      style={[
        p.cardStyle,
        { paddingHorizontal: 0, overflow: "hidden" },
      ]}
    >
      {deliveryFee === 0 ? (
        <View style={{ backgroundColor: p.isDark ? "rgba(20,83,45,0.1)" : "#f4fcf7" }}>
          <View style={styles.freeDelivery}>
            <CheckCircle2 size={20} color={tw.green600} fill={tw.green600 + "33"} />
            <Text style={[styles.freeText, { color: p.t800 }]}>
              You saved {RUPEE}
              {savedDeliveryAmount} on delivery
            </Text>
          </View>
          <DashedDivider color={p.divider} />
        </View>
      ) : null}

      {appliedCoupon ? (
        <View style={styles.appliedRow}>
          <View style={styles.appliedLeft}>
            <Percent size={20} color={p.primary} style={{ marginTop: 2 }} />
            <View>
              <Text style={[styles.appliedTitle, { color: p.t800 }]}>&apos;{appliedCoupon.code}&apos; applied</Text>
              <Text style={[styles.appliedSaved, { color: p.primary }]}>
                You saved {RUPEE}
                {discount}
              </Text>
            </View>
          </View>
          <Pressable onPress={onRemoveCoupon} hitSlop={6}>
            <Text style={[styles.remove, { color: p.primary }]}>REMOVE</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.listWrap}>
          {loadingCoupons ? (
            <Text style={{ fontSize: 14, color: tw.gray500 }}>Loading offers...</Text>
          ) : best ? (
            <View style={styles.couponRow}>
              <View style={styles.couponLeft}>
                <Percent size={20} color={p.t700} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.couponTitle, { color: p.t800 }]}>
                    {best.discountDisplay || `Save ${RUPEE}${best.discount}`} with &apos;{best.code}&apos;
                  </Text>
                  <CouponHint coupon={best} subtotal={subtotal} p={p} />
                  {availableCoupons.length > 1 ? (
                    <Pressable onPress={onToggleCoupons} style={styles.viewAll}>
                      <Text style={[styles.hint11, { color: p.primary, marginBottom: 0 }]}>View all coupons</Text>
                      <ChevronRight size={12} color={p.primary} style={{ marginLeft: 2 }} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <Pressable
                disabled={isDisabled(best)}
                onPress={() => onApplyCoupon(best)}
                style={[styles.applyPrimary, { borderColor: p.primary, opacity: isDisabled(best) ? 0.5 : 1 }]}
              >
                <Text style={[styles.applyText, { color: p.primary }]}>APPLY</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.noOffers}>
              <Percent size={20} color={tw.gray400} />
              <Text style={{ fontSize: 14, color: tw.gray500 }}>No offers available</Text>
            </View>
          )}

          {showCoupons && availableCoupons.length > 0 ? (
            <View style={styles.allList}>
              <DashedDivider color={p.divider} style={{ marginBottom: 0 }} />
              <View style={styles.manualRow}>
                <TextInput
                  value={manualCouponCode}
                  onChangeText={(v) => onChangeManualCode(v.toUpperCase())}
                  placeholder="Enter coupon code"
                  placeholderTextColor={p.t400}
                  selectionColor={p.primary}
                  autoCapitalize="characters"
                  style={[
                    styles.manualInput,
                    inputFont,
                    {
                      borderColor: p.isDark ? tw.gray700 : tw.gray300,
                      backgroundColor: p.inputBg,
                      color: p.t800,
                    },
                  ]}
                />
                <Pressable
                  onPress={onApplyManualCode}
                  style={[styles.manualApply, { borderColor: p.primary, backgroundColor: p.card }]}
                >
                  <Text style={[styles.applyText, { color: p.primary }]}>APPLY</Text>
                </Pressable>
              </View>
              {availableCoupons.slice(1).map((coupon) => (
                <View key={coupon.code} style={styles.couponRow}>
                  <View style={styles.couponLeft}>
                    <Percent size={20} color={p.t700} style={{ marginTop: 2, opacity: 0.5 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.couponTitle, { color: p.t800 }]}>
                        {coupon.discountDisplay || `Save ${RUPEE}${coupon.discount}`} with &apos;{coupon.code}&apos;
                      </Text>
                      <CouponHint coupon={coupon} subtotal={subtotal} p={p} showDescription />
                    </View>
                  </View>
                  <Pressable
                    disabled={isDisabled(coupon)}
                    onPress={() => onApplyCoupon(coupon)}
                    style={[
                      styles.applySecondary,
                      { borderColor: p.isDark ? tw.gray600 : tw.gray300, opacity: isDisabled(coupon) ? 0.5 : 1 },
                    ]}
                  >
                    <Text style={[styles.applyText, { color: p.isDark ? tw.gray400 : tw.gray600 }]}>APPLY</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  freeDelivery: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  freeText: { fontSize: 14, fontWeight: "600" },
  appliedRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appliedLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  appliedTitle: { fontSize: 14, fontWeight: "600" },
  appliedSaved: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  remove: { fontSize: 12, fontWeight: "600", paddingHorizontal: 8 },
  listWrap: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  couponRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  couponLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 },
  couponTitle: { fontSize: 14, fontWeight: "600", lineHeight: 18, marginBottom: 2 },
  hint11: { fontSize: 11, marginBottom: 4 },
  unlock: { fontSize: 12, fontWeight: "500", color: tw.blue600, marginBottom: 4 },
  desc: { fontSize: 12, marginBottom: 4 },
  viewAll: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  applyPrimary: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  applySecondary: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  applyText: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6 },
  noOffers: { flexDirection: "row", alignItems: "center", gap: 12 },
  allList: { marginTop: 12, gap: 16 },
  manualRow: { flexDirection: "row", gap: 8, marginBottom: 0 },
  manualInput: { flex: 1, height: 36, borderRadius: 4, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  manualApply: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 16, height: 36, justifyContent: "center" },
});
