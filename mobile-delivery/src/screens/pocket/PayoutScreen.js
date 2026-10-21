// DeliveryV2/pages/pocket/PayoutV2 (/pocket/payout): withdrawal history from the wallet transactions
// (type=withdrawal, limit 100), each card coloured by status.
import { Clock } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { getWalletTransactions } from "../../api";
import { LoadingBlock, SubHeader, formatDateTimeIN, getStatusInfo } from "../../components/pocket/common";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, tw } from "../../theme/tokens";

function WithdrawalCard({ withdrawal }) {
  const statusInfo = getStatusInfo(withdrawal.status);
  const StatusIcon = statusInfo.icon;
  return (
    <View style={[styles.card, { borderColor: statusInfo.borderColor }]}>
      <View style={styles.statusRow}>
        <StatusIcon size={20} color={statusInfo.color} />
        <View style={[styles.statusPill, { backgroundColor: statusInfo.bgColor }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{String(withdrawal.status).toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.amount}>₹{withdrawal.amount}</Text>
      <Text style={styles.meta}>Requested: {withdrawal.date}</Text>
      {withdrawal.processedAt ? <Text style={[styles.meta, { marginTop: 4 }]}>Processed: {withdrawal.processedAt}</Text> : null}
      {withdrawal.failureReason ? <Text style={styles.reason}>Reason: {withdrawal.failureReason}</Text> : null}
    </View>
  );
}

export default function PayoutScreen() {
  const goBack = useAppBack();
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const response = await getWalletTransactions({ type: "withdrawal", limit: 100 });
        if (alive && response?.success) {
          const transactions = response.data.transactions || [];
          setWithdrawals(
            transactions.map((t) => ({
              id: t._id || t.id,
              amount: t.amount || 0,
              status: t.status || "Pending",
              date: formatDateTimeIN(t.date || t.createdAt),
              processedAt: t.processedAt ? formatDateTimeIN(t.processedAt) : null,
              failureReason: t.failureReason || null,
            })),
          );
        }
      } catch {
        if (alive) toast.error("Failed to load payout history");
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
      <SubHeader title="Withdrawal History" onBack={goBack} />
      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
          <LoadingBlock color={tw.gray400} label="Loading withdrawal history..." labelStyle={styles.loadingText} />
        </View>
      ) : (
        <FlatList
          data={withdrawals}
          keyExtractor={(item, index) => String(item.id || index)}
          renderItem={({ item }) => <WithdrawalCard withdrawal={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Clock size={32} color={tw.gray200} />
              </View>
              <Text style={styles.emptyTitle}>No withdrawal history</Text>
              <Text style={styles.emptyText}>
                You haven&apos;t made any withdrawal requests yet. Your withdrawal history will appear here.
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 96 },
  loadingText: { color: tw.gray600, fontSize: 16 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    paddingBottom: 28, // inner "mb-3" wrapper
    borderWidth: 1,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  amount: { color: tw.gray900, fontSize: 20, fontWeight: "700", marginBottom: 4 },
  meta: { color: tw.gray500, fontSize: 11, fontWeight: "500" },
  reason: { color: tw.red600, fontSize: 11, marginTop: 8, fontWeight: "700" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 32 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  emptyTitle: { color: tw.gray900, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: tw.gray400, fontSize: 14, fontWeight: "500", textAlign: "center" },
});
