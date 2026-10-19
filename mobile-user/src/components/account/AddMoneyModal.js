// Port of Frontend/src/modules/Food/components/user/AddMoneyModal.jsx (Razorpay wallet top-up).
import { IndianRupee } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { createWalletTopupOrder } from "../../api";
import { payForWalletTopup } from "../../lib/razorpay";
import AccountDialog from "./AccountDialog";
import { Button, Text, toast } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { fontFamilyByWeight, tw } from "../../theme/tokens";

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];

export default function AddMoneyModal({ open, onOpenChange, onSuccess }) {
  const { colors, isDark } = useTheme();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const busy = loading || processing;

  const handleAmountChange = (text) => {
    const value = text.replace(/[^0-9.]/g, "");
    if (value === "" || (parseFloat(value) >= 1 && parseFloat(value) <= 50000)) {
      setAmount(value);
    }
  };

  const handleAddMoney = async () => {
    const amountNum = parseFloat(amount);
    if (!amount || Number.isNaN(amountNum) || amountNum < 1) {
      toast.error("Please enter a valid amount (minimum ₹1)");
      return;
    }
    if (amountNum > 50000) {
      toast.error("Maximum amount is ₹50,000");
      return;
    }
    try {
      setLoading(true);
      const orderResponse = await createWalletTopupOrder(amountNum);
      const razorpay = orderResponse?.data?.razorpay;
      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        throw new Error("Failed to initialize payment gateway");
      }
      setLoading(false);
      onOpenChange(false);
      await new Promise((resolve) => setTimeout(resolve, 100));
      setProcessing(true);

      let result;
      try {
        result = await payForWalletTopup({ amount: amountNum, razorpay });
      } catch (error) {
        // Checkout succeeded but /topup/verify failed.
        toast.error(error?.status ? error.message : "Payment verification failed. Please contact support.");
        setProcessing(false);
        return;
      }
      if (result.status === "paid") {
        toast.success(`₹${amountNum} added to wallet successfully!`);
        setAmount("");
        setProcessing(false);
        onOpenChange(false);
        onSuccess?.();
      } else {
        if (result.status === "failed") toast.error(result.message || "Payment failed. Please try again.");
        setProcessing(false);
      }
    } catch (error) {
      toast.error(error?.message || "Failed to initialize payment. Please try again.");
      setLoading(false);
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!busy) {
      setAmount("");
      onOpenChange(false);
    }
  };

  const labelColor = isDark ? tw.gray300 : tw.gray700;
  const amountValid = amount && !(parseFloat(amount) < 1);

  return (
    <AccountDialog
      visible={open}
      onClose={handleClose}
      maxWidth={352}
      closeColor={tw.gray400}
      style={styles.dialog}
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? "#ffffff" : tw.gray900 }]}>Add Money to Wallet</Text>
          <Text style={[styles.description, { color: isDark ? tw.gray400 : tw.gray600 }]}>
            Enter the amount you want to add to your wallet
          </Text>
        </View>

        <View style={styles.sections}>
          <View style={styles.section}>
            <Text style={[styles.label, { color: labelColor }]}>Enter Amount</Text>
            <View>
              <View style={styles.rupee}>
                <IndianRupee size={20} color={tw.gray400} />
              </View>
              <TextInput
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="Enter amount"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                editable={!busy}
                selectionColor={colors.primary}
                style={[
                  styles.input,
                  {
                    borderColor: colors.input,
                    color: colors.text,
                    backgroundColor: isDark ? "rgba(39,39,42,0.3)" : "transparent",
                    opacity: busy ? 0.5 : 1,
                  },
                ]}
              />
            </View>
            <Text style={[styles.hint, { color: isDark ? tw.gray400 : tw.gray500 }]}>
              Minimum: {"₹"}1 | Maximum: {"₹"}50,000
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: labelColor }]}>Quick Select</Text>
            <View style={styles.grid}>
              {QUICK_AMOUNTS.map((quickAmount) => (
                <View key={quickAmount} style={styles.gridCell}>
                  <Button
                    variant={amount === quickAmount.toString() ? "default" : "outline"}
                    title={`₹${quickAmount}`}
                    style={styles.quick}
                    disabled={busy}
                    onPress={() => setAmount(quickAmount.toString())}
                  />
                </View>
              ))}
            </View>
          </View>

          <Pressable
            onPress={handleAddMoney}
            disabled={!amountValid || busy}
            style={[styles.addBtn, (!amountValid || busy) && styles.disabled]}
          >
            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator size={16} color="#ffffff" />
                <Text style={styles.addText}>{loading ? "Processing..." : "Opening Payment Gateway..."}</Text>
              </View>
            ) : (
              <Text style={styles.addText}>{`Add ₹${amount || "0"}`}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </AccountDialog>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: 24 },
  body: { padding: 20 },
  header: { paddingRight: 40, gap: 8, alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  description: { fontSize: 14, textAlign: "center" },
  sections: { paddingTop: 20, gap: 24 },
  section: { gap: 8 },
  label: { fontSize: 14, fontWeight: "500" },
  rupee: { position: "absolute", left: 12, top: 0, bottom: 0, justifyContent: "center", zIndex: 1 },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingLeft: 40,
    paddingRight: 12,
    fontSize: 18,
    fontFamily: fontFamilyByWeight["400"],
  },
  hint: { fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, rowGap: 8 },
  gridCell: { width: "33.333%", paddingHorizontal: 4 },
  quick: { height: 40 },
  addBtn: {
    width: "100%",
    height: 48,
    borderRadius: 8,
    backgroundColor: tw.green600,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
});
