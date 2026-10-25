// PocketV2 "DEPOSIT MODAL": rounded-t-[2.5rem] sheet with the cash-in-hand row, amount input and
// "Proceed to Pay" / "Maybe Later". Android back closes it (web: history.pushState + popstate).
import { IndianRupee, ShieldCheck } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Spinner from "../content/Spinner";
import Text, { useScopedFont } from "../ui/Text";
import { BottomSheet } from "../ui/Sheet";
import { brand, dvColor, light, tw } from "../../theme/tokens";
import { dvCard } from "./common";

export default function DepositSheet({ visible, onClose, cashInHand, amount, onChangeAmount, depositing, onSubmit }) {
  const inputFont = useScopedFont("700");
  return (
    <BottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <View style={styles.handle} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.head}>
          <View style={[styles.iconBox, dvCard]}>
            <IndianRupee size={40} color={dvColor("text-primary", light)} />
          </View>
          <Text style={styles.title}>Deposit Cash</Text>
          <Text style={styles.subtitle}>Settle Hand Dues</Text>
        </View>

        <View style={[styles.box, dvCard]}>
          <View style={styles.cashRow}>
            <Text style={styles.cashLabel}>CASH IN YOUR HAND</Text>
            <Text style={styles.cashValue}>₹{Number(cashInHand || 0).toFixed(2)}</Text>
          </View>
          <View>
            <View style={styles.inputIcon} pointerEvents="none">
              <IndianRupee size={20} color={tw.gray400} />
            </View>
            <TextInput
              value={amount}
              onChangeText={onChangeAmount}
              placeholder="Enter amount to deposit"
              placeholderTextColor={tw.gray400}
              keyboardType="decimal-pad"
              selectionColor={brand.primary}
              style={[styles.input, inputFont]}
            />
          </View>
          <Text style={styles.hint}>MINIMUM DEPOSIT ₹1 • INSTANT LIMIT UPDATE</Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={onSubmit}
          disabled={depositing}
          style={({ pressed }) => [
            styles.payBtn,
            dvCard,
            { backgroundColor: depositing ? tw.gray300 : brand.primary },
            depositing && { boxShadow: "none" },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          {depositing ? <Spinner size={20} color="#ffffff" /> : <ShieldCheck size={20} color="#ffffff" />}
          <Text style={styles.payText}>{depositing ? "Securely Processing..." : "Proceed to Pay"}</Text>
        </Pressable>
        <Pressable onPress={onClose} style={styles.laterBtn}>
          <Text style={styles.laterText}>MAYBE LATER</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingTop: 16 },
  handle: { width: 64, height: 6, backgroundColor: tw.gray100, borderRadius: 999, alignSelf: "center", marginBottom: 16 },
  // The sheet is capped at 90% of the screen (less when the keyboard is up), so the scroll area
  // takes whatever is left after the handle and the pinned action buttons.
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 4 },
  head: { alignItems: "center", marginBottom: 24 },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: dvColor("bg-orange-50", light),
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "900", color: tw.black, marginBottom: 4 },
  subtitle: { fontSize: 14, color: tw.gray400, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
  box: { backgroundColor: tw.gray50, borderRadius: 16, padding: 20, borderWidth: 1 },
  actions: { gap: 8, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 12 },
  cashRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cashLabel: { fontSize: 12, fontWeight: "700", color: tw.gray400 },
  cashValue: { fontSize: 16, fontWeight: "900", color: tw.black },
  inputIcon: { position: "absolute", left: 16, top: 0, bottom: 0, justifyContent: "center", zIndex: 1 },
  input: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: brand.inputBorder,
    borderRadius: 14,
    paddingVertical: 16,
    paddingLeft: 48,
    paddingRight: 16,
    fontSize: 20,
    color: brand.text,
  },
  hint: { fontSize: 10, fontWeight: "700", color: tw.gray400, marginTop: 12, textAlign: "center" },
  payBtn: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  payText: { color: "#ffffff", fontWeight: "900", fontSize: 14 },
  laterBtn: { width: "100%", paddingVertical: 12, alignItems: "center" },
  laterText: { color: tw.gray400, fontWeight: "700", fontSize: 12, letterSpacing: 1.2 },
});
