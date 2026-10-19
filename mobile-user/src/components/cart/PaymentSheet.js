// "Payment Method" bottom sheet: Online (Razorpay), Quick Wallet, Cash on Delivery (Cart.jsx).
import { Banknote, Check, Wallet, X, Zap } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BottomSheet, Text } from "../ui";
import { radius, shadow, tw } from "../../theme/tokens";
import { RUPEE } from "../../screens/cart/cartUtils";
import { useCartPalette } from "./palette";

export default function PaymentSheet({ visible, onClose, selected, onSelect, walletBalance, total, isCodHidden }) {
  const p = useCartPalette();
  const options = [
    {
      id: "razorpay",
      name: "Online Payment",
      description: "UPI, Cards, Netbanking",
      Icon: Zap,
      bg: p.isDark ? "rgba(6,78,59,0.4)" : "#ecfdf5",
      fg: p.isDark ? "#00d492" : "#009966",
      badge: "SECURE",
    },
    {
      id: "wallet",
      name: "Quick Wallet",
      description: "Pay from your wallet",
      Icon: Wallet,
      bg: p.isDark ? "rgba(30,58,138,0.4)" : tw.blue50,
      fg: p.isDark ? "#51a2ff" : tw.blue600,
      subInfo: `Bal: ${RUPEE}${walletBalance.toFixed(0)}`,
      disabled: walletBalance < total,
      disabledText: "Low Balance",
    },
    {
      id: "cash",
      name: "Cash on Delivery",
      description: "Pay when order arrives",
      Icon: Banknote,
      bg: p.isDark ? "rgba(124,45,18,0.4)" : tw.orange50,
      fg: p.isDark ? "#ff8904" : p.colors.foreground,
      hidden: isCodHidden,
    },
  ].filter((o) => !o.hidden);

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="82%" style={styles.sheet}>
      <View style={styles.inner}>
        <View style={[styles.handle, { backgroundColor: p.isDark ? tw.gray800 : tw.gray200 }]} />
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: p.white900 }]}>Payment Method</Text>
            <Text style={styles.subtitle}>SELECT HOW YOU WANT TO PAY</Text>
          </View>
          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
            <X size={16} color={tw.gray500} />
          </Pressable>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
          {options.map((o) => {
            const active = selected === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => {
                  if (!o.disabled) {
                    onSelect(o.id);
                    onClose();
                  }
                }}
                style={({ pressed }) => [
                  styles.option,
                  active
                    ? { borderColor: p.primary, backgroundColor: p.primary, boxShadow: `0px 10px 15px -3px ${p.primary}4D` }
                    : {
                        borderColor: p.isDark ? "rgba(31,41,55,0.8)" : tw.gray100,
                        backgroundColor: p.isDark ? "#222222" : "#ffffff",
                        ...shadow.sm,
                      },
                  o.disabled && { opacity: 0.4 },
                  pressed && !o.disabled && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={styles.optLeft}>
                  <View style={[styles.optIcon, { backgroundColor: active ? "rgba(255,255,255,0.2)" : o.bg }]}>
                    <o.Icon size={20} color={active ? "#ffffff" : o.fg} />
                  </View>
                  <View>
                    <View style={styles.nameRow}>
                      <Text style={[styles.optName, { color: active ? "#ffffff" : p.t900 }]}>{o.name}</Text>
                      {o.badge ? (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: active ? "rgba(255,255,255,0.2)" : p.isDark ? "rgba(6,78,59,0.3)" : "#d0fae5" },
                          ]}
                        >
                          <Text style={[styles.badgeText, { color: active ? "#ffffff" : p.isDark ? "#00d492" : "#007a55" }]}>
                            {o.badge}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.descRow}>
                      <Text style={[styles.desc, { color: active ? "rgba(255,255,255,0.8)" : tw.gray400 }]}>
                        {o.description}
                      </Text>
                      {o.subInfo && !o.disabled ? (
                        <>
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: active ? "rgba(255,255,255,0.4)" : p.isDark ? "#ca3500" : "#ffb86a" },
                            ]}
                          />
                          <Text style={[styles.subInfo, { color: active ? "#ffffff" : p.isDark ? tw.green500 : tw.green600 }]}>
                            {o.subInfo.toUpperCase()}
                          </Text>
                        </>
                      ) : null}
                    </View>
                    {o.disabled ? <Text style={styles.disabledText}>{o.disabledText.toUpperCase()}</Text> : null}
                  </View>
                </View>
                <View
                  style={[
                    styles.radio,
                    active ? { backgroundColor: "#ffffff", borderColor: "#ffffff" } : { borderColor: p.isDark ? tw.gray700 : tw.gray200 },
                  ]}
                >
                  {active ? <Check size={14} strokeWidth={4} color={p.primary} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { borderColor: p.isDark ? tw.gray800 : tw.gray100, backgroundColor: p.card }]}>
          <View>
            <Text style={styles.totalLabel}>TOTAL PAY</Text>
            <Text style={[styles.totalValue, { color: p.primary }]}>
              {RUPEE}
              {total.toFixed(0)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.confirm,
              { backgroundColor: p.primary, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Text style={styles.confirmText}>Confirm Order</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  inner: { padding: 20, flexShrink: 1 },
  handle: { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "800", lineHeight: 24 },
  subtitle: { fontSize: 11, fontWeight: "700", color: tw.gray400, letterSpacing: -0.3, marginTop: 4 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  list: { flexGrow: 0, flexShrink: 1 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: radius["2xl"],
    borderWidth: 2,
  },
  optLeft: { flexDirection: "row", alignItems: "center", gap: 16, flex: 1 },
  optIcon: { width: 44, height: 44, borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  optName: { fontSize: 14, fontWeight: "900", letterSpacing: -0.3 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  descRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  desc: { fontSize: 11, fontWeight: "700" },
  dot: { width: 4, height: 4, borderRadius: 2 },
  subInfo: { fontSize: 10, fontWeight: "900", letterSpacing: -0.3 },
  disabledText: { fontSize: 9, fontWeight: "900", color: tw.red500, marginTop: 4, letterSpacing: 0.3 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  footer: { paddingTop: 16, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 16 },
  totalLabel: { fontSize: 10, fontWeight: "700", color: tw.gray400, letterSpacing: 1, marginBottom: 4 },
  totalValue: { fontSize: 20, fontWeight: "900" },
  confirm: { flex: 1, height: 44, borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
  confirmText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
});
