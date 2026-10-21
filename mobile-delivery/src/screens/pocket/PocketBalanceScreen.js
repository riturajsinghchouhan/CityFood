// DeliveryV2/pages/pocket/PocketBalanceV2 (/pocket/balance): withdrawable amount, Withdraw
// (bank details required first; POST /wallet/withdraw for the whole withdrawable amount) and the
// pocket detail rows.
import { router } from "expo-router";
import dayjs from "dayjs";
import { AlertTriangle } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { createWithdrawalRequest, getEarnings, getProfile, getWallet, getWalletTransactions } from "../../api";
import Spinner from "../../components/content/Spinner";
import { DetailRow, LoadingBlock, SubHeader, formatCurrency } from "../../components/pocket/common";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, dvColor, light, tw } from "../../theme/tokens";

const INITIAL = {
  pocketBalance: 0,
  weeklyEarnings: 0,
  totalBonus: 0,
  totalWithdrawn: 0,
  cashCollected: 0,
  deductions: 0,
  withdrawalLimit: 100,
  withdrawableAmount: 0,
  canWithdraw: false,
};

export default function PocketBalanceScreen() {
  const goBack = useAppBack();
  const [loading, setLoading] = useState(true);
  const [walletState, setWalletState] = useState(INITIAL);
  const [withdrawalStatus, setWithdrawalStatus] = useState({ status: "No request", updatedAt: null });
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [, earningsRes, walletRes, withdrawalRes] = await Promise.all([
          getProfile(),
          getEarnings({ period: "week" }),
          getWallet(),
          getWalletTransactions({ type: "withdrawal", limit: 1 }),
        ]);
        if (!alive) return;
        const summary = earningsRes?.data?.summary || {};
        const wallet = walletRes?.data?.wallet || {};
        const withdrawalTx = withdrawalRes?.data?.transactions?.[0] || null;

        const pocketBalance = Number(wallet.pocketBalance) || 0;
        const withdrawalLimit = Number(wallet.deliveryWithdrawalLimit) || 100;
        const withdrawableAmount = pocketBalance; // backend pocketBalance is already the withdrawable amount

        setWalletState({
          pocketBalance,
          lifetimeEarnings: Number(wallet.totalEarned) || 0,
          weeklyEarnings: Number(summary.totalEarnings) || 0,
          totalBonus: Number(wallet.totalBonus) || 0,
          totalWithdrawn: Number(wallet.totalWithdrawn) || 0,
          cashCollected: Number(wallet.cashInHand) || 0,
          deductions: 0, // the web shows a fixed 0
          withdrawalLimit,
          withdrawableAmount,
          canWithdraw: withdrawableAmount >= withdrawalLimit,
        });

        if (withdrawalTx) {
          const rawStatus = String(withdrawalTx.status || "Pending").toLowerCase();
          const statusLabel =
            rawStatus === "approved" || rawStatus === "completed"
              ? "Approved"
              : rawStatus === "rejected" || rawStatus === "denied"
                ? "Rejected"
                : "Pending";
          const updatedAt = withdrawalTx.processedAt || withdrawalTx.updatedAt || withdrawalTx.createdAt || null;
          setWithdrawalStatus({
            status: statusLabel,
            updatedAt: updatedAt ? dayjs(updatedAt).format("DD MMM YYYY, hh:mm a") : null,
          });
        } else {
          setWithdrawalStatus({ status: "No request", updatedAt: null });
        }
      } catch {
        if (alive) toast.error("Failed to load pocket details");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleWithdraw = async () => {
    // The web reads the profile again here without a try/catch: a failure just does nothing.
    let profile;
    try {
      const profileRes = await getProfile();
      profile = profileRes?.data?.profile || {};
    } catch {
      return;
    }
    const bank = profile?.documents?.bankDetails;
    if (!bank?.accountNumber) {
      toast.error("Please add bank details first");
      router.push("/profile/details");
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const res = await createWithdrawalRequest({
        amount: walletState.withdrawableAmount,
        paymentMethod: "bank_transfer",
      });
      if (res?.success) {
        toast.success("Withdrawal request submitted");
        goBack();
      }
    } catch {
      toast.error("Withdrawal failed");
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  return (
    <Screen edges={[]} background={brand.bg}>
      <SubHeader title="Pocket balance" onBack={goBack} />

      {loading ? (
        <LoadingBlock
          color={dvColor("text-orange-500", light)}
          label="LOADING BALANCE..."
          labelStyle={styles.loadingText}
          paddingVertical={80}
          gap={12}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
          {!walletState.canWithdraw && (
            <View style={styles.warning}>
              <AlertTriangle size={20} color={brand.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>Withdraw currently disabled</Text>
                <Text style={styles.warningText}>
                  {walletState.withdrawableAmount <= 0
                    ? "Withdrawable amount is ₹0"
                    : `Minimum withdrawal requirement is ₹${walletState.withdrawalLimit}`}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.top}>
            <Text style={styles.topLabel}>WITHDRAWABLE AMOUNT</Text>
            <Text style={styles.topValue}>₹{walletState.withdrawableAmount.toFixed(0)}</Text>
            <Pressable
              onPress={handleWithdraw}
              disabled={!walletState.canWithdraw || withdrawSubmitting}
              style={({ pressed }) => [
                styles.withdrawBtn,
                { backgroundColor: walletState.canWithdraw ? tw.black : tw.gray100 },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              {withdrawSubmitting ? <Spinner size={16} color={walletState.canWithdraw ? "#ffffff" : tw.gray400} /> : null}
              <Text style={[styles.withdrawText, { color: walletState.canWithdraw ? "#ffffff" : tw.gray400 }]}>
                {withdrawSubmitting ? "Processing..." : "Withdraw"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.sectionLabelWrap}>
            <Text style={styles.sectionLabel}>POCKET DETAILS</Text>
          </View>

          <View style={styles.rows}>
            <DetailRow label="Lifetime Earnings" value={formatCurrency(walletState.lifetimeEarnings)} />
            <DetailRow label="This Week's Earnings" value={formatCurrency(walletState.weeklyEarnings)} />
            <DetailRow label="Bonus" value={formatCurrency(walletState.totalBonus)} />
            <DetailRow label="Total Withdrawn (Lifetime)" value={formatCurrency(walletState.totalWithdrawn)} />
            <DetailRow label="Cash collected (To Deposit)" value={formatCurrency(walletState.cashCollected)} />
            <DetailRow label="Deductions" value={formatCurrency(walletState.deductions)} />
            <DetailRow label="Withdrawable balance" value={formatCurrency(walletState.pocketBalance)} />
            <DetailRow
              label="Withdrawal status"
              value={withdrawalStatus.status}
              subLabel={withdrawalStatus.updatedAt ? `Updated: ${withdrawalStatus.updatedAt}` : "Admin approval status"}
            />
            <DetailRow
              label="Min. withdrawal amount"
              value={formatCurrency(walletState.withdrawalLimit)}
              subLabel="Withdrawal allowed only when withdrawable amount reaches this limit."
            />
            <DetailRow label="Withdrawable amount" value={formatCurrency(walletState.withdrawableAmount)} />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingText: { color: tw.gray400, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  warning: {
    backgroundColor: dvColor("bg-yellow-400", light),
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(240,177,0,0.1)",
  },
  warningTitle: { fontSize: 12, fontWeight: "700" },
  warningText: { fontSize: 10, fontWeight: "500", opacity: 0.8, lineHeight: 12.5, marginTop: 4 },
  top: {
    backgroundColor: "#ffffff",
    padding: 32,
    marginBottom: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  topLabel: { fontSize: 12, fontWeight: "700", color: tw.gray400, letterSpacing: 1.2, marginBottom: 8 },
  topValue: { fontSize: 48, fontWeight: "900", color: tw.black, marginBottom: 24, letterSpacing: -2.4 },
  withdrawBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  withdrawText: { fontWeight: "700", fontSize: 14 },
  sectionLabelWrap: { backgroundColor: "rgba(243,244,246,0.5)", paddingVertical: 8, paddingHorizontal: 16 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: tw.gray400, letterSpacing: 1, textAlign: "center" },
  rows: { backgroundColor: "#ffffff", paddingHorizontal: 16 },
});
