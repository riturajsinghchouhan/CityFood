// DeliveryV2/pages/pocket/CashLimitInfoV2 (/pocket/cash-limit): total cash limit, cash in hand,
// deductions, pocket balance and the available limit (wallet + GET /cash-limit fallback).
import { HelpCircle, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { getCashLimit, getWallet } from "../../api";
import { DetailRow, LoadingBlock, SubHeader, formatCurrency, twx } from "../../components/pocket/common";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, dvColor, light, tw } from "../../theme/tokens";

export default function CashLimitScreen() {
  const goBack = useAppBack();
  const [loading, setLoading] = useState(true);
  const [walletState, setWalletState] = useState({
    totalCashLimit: 0,
    cashInHand: 0,
    deductions: 0,
    pocketBalance: 0,
    availableCashLimit: 0,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [walletRes, limitRes] = await Promise.all([getWallet(), getCashLimit().catch(() => null)]);
        if (!alive) return;
        const wallet = walletRes?.data?.wallet || {};
        const limitSettings = limitRes?.data || {};

        const totalLimit = Number(wallet.totalCashLimit ?? limitSettings.deliveryCashLimit ?? 0) || 0;
        const cashInHand = Number(wallet.cashInHand) || 0;
        const deductions = Number(wallet.deductions) || 0;
        const pocketBalance = Number(wallet.pocketBalance) || 0;
        const availableRaw = Number(wallet.availableCashLimit);
        const available = Number.isFinite(availableRaw)
          ? availableRaw
          : Math.max(0, totalLimit - cashInHand - deductions + pocketBalance);

        setWalletState({
          totalCashLimit: totalLimit,
          cashInHand,
          deductions,
          pocketBalance,
          availableCashLimit: available,
        });
      } catch {
        if (alive) toast.error("Failed to load cash limit details");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Screen edges={[]} background={brand.bg}>
      <SubHeader title="Available cash limit" onBack={goBack} />

      {loading ? (
        <LoadingBlock
          color={dvColor("text-orange-500", light)}
          label="CHECKING LIMITS..."
          labelStyle={styles.loadingText}
          paddingVertical={80}
          gap={12}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { padding: 20, marginBottom: 24 }]}>
            <View style={styles.cardHead}>
              <View style={styles.headIcon}>
                <ShieldCheck size={24} color={dvColor("text-emerald-600", light)} />
              </View>
              <View>
                <Text style={styles.headTitle}>Total cash limit</Text>
                <Text style={styles.headValue}>{formatCurrency(walletState.totalCashLimit).toUpperCase()}</Text>
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <DetailRow
                label="Total cash limit"
                value={formatCurrency(walletState.totalCashLimit)}
                subLabel="Resets every Monday and increases with earnings"
              />
              <DetailRow label="Cash in hand" value={formatCurrency(walletState.cashInHand)} />
              <DetailRow label="Deductions" value={formatCurrency(walletState.deductions)} />
              <DetailRow label="Pocket balance" value={formatCurrency(walletState.pocketBalance)} />

              <View style={styles.availableRow}>
                <Text style={styles.availableLabel}>AVAILABLE CASH LIMIT</Text>
                <Text style={styles.availableValue}>{formatCurrency(walletState.availableCashLimit)}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, styles.howCard]}>
            <HelpCircle size={32} color={tw.gray200} style={{ marginBottom: 16 }} />
            <Text style={styles.howTitle}>HOW IT WORKS?</Text>
            <Text style={styles.howText}>
              Your available limit is the maximum cash you can carry in hand. As you receive cash orders, this limit
              decreases. Settling your dues or earning more will increase this limit.
            </Text>
          </View>

          <View style={{ paddingHorizontal: 8 }}>
            <Pressable onPress={goBack} style={({ pressed }) => [styles.okBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
              <Text style={styles.okText}>Okay</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingText: { color: tw.gray400, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 128 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  headIcon: {
    width: 40,
    height: 40,
    backgroundColor: dvColor("bg-emerald-50", light),
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headTitle: { fontSize: 17, fontWeight: "900", letterSpacing: -0.4, lineHeight: 17, marginBottom: 4, color: brand.text },
  headValue: { fontSize: 10, fontWeight: "700", color: tw.gray400, letterSpacing: 1 },
  availableRow: {
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(236,253,245,0.5)", // bg-emerald-50/50 is not remapped
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  availableLabel: { fontSize: 14, fontWeight: "900", color: twx.emerald900, letterSpacing: -0.35 },
  availableValue: { fontSize: 18, fontWeight: "900", color: dvColor("text-emerald-600", light) },
  howCard: { padding: 32, alignItems: "center", marginBottom: 24 },
  howTitle: { fontSize: 12, fontWeight: "700", color: tw.gray400, letterSpacing: 1.2, marginBottom: 8 },
  howText: { fontSize: 11, color: tw.gray500, fontWeight: "500", lineHeight: 17.9, paddingHorizontal: 16, textAlign: "center" },
  okBtn: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: tw.black,
    borderRadius: 14,
    alignItems: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  okText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
});
