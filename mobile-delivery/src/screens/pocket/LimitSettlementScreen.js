// DeliveryV2/pages/pocket/LimitSettlementV2 (/pocket/limit-settlement): cash-limit settlement
// history = wallet deposit transactions (type=deposit, limit 100). Read only; the web settles
// (pays) only from PocketV2's "Deposit Cash" popup, not here.
import { Clock } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { getWalletTransactions } from "../../api";
import { LoadingBlock, SubHeader, formatDateTimeIN, getStatusInfo } from "../../components/pocket/common";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, tw } from "../../theme/tokens";

function SettlementCard({ tx }) {
  const statusInfo = getStatusInfo(tx.status);
  const StatusIcon = statusInfo.icon;
  return (
    <Pressable style={({ pressed }) => [styles.card, { borderColor: statusInfo.borderColor }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={styles.statusRow}>
        <StatusIcon size={16} color={statusInfo.color} />
        <View style={[styles.statusPill, { backgroundColor: statusInfo.bgColor }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{String(tx.status).toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.amount}>₹{tx.amount}</Text>
      <Text style={styles.description}>{tx.description}</Text>
      <Text style={styles.date}>Date: {tx.date}</Text>
    </Pressable>
  );
}

export default function LimitSettlementScreen() {
  const goBack = useAppBack();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const response = await getWalletTransactions({ type: "deposit", limit: 100 });
        if (alive && response?.success) {
          const fetched = response.data.transactions || [];
          setTransactions(
            fetched.map((t) => ({
              id: t._id || t.id,
              amount: t.amount || 0,
              status: t.status || "Pending",
              description: t.description || "Available limit settlement",
              date: formatDateTimeIN(t.date || t.createdAt),
            })),
          );
        }
      } catch {
        if (alive) toast.error("Failed to load settlement history");
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
      <SubHeader title="Available limit settlement" onBack={goBack} />
      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
          <LoadingBlock color={brand.primary} label="Loading transactions..." labelStyle={styles.loadingText} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, index) => String(item.id || index)}
          renderItem={({ item }) => <SettlementCard tx={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Clock size={32} color={tw.gray200} />
              </View>
              <Text style={styles.emptyTitle}>No settlement transactions</Text>
              <Text style={styles.emptyText}>
                Whenever you settle the available limit, the payment transactions will appear here.
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 128 },
  loadingText: { color: tw.gray600, fontSize: 14, fontWeight: "500" },
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
  description: { color: tw.gray600, fontSize: 14, marginBottom: 4, fontWeight: "500" },
  date: { color: tw.gray400, fontSize: 11, fontWeight: "600" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 16 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { color: tw.gray900, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: tw.gray400, fontSize: 12, fontWeight: "600", lineHeight: 19.5, textAlign: "center" },
});
