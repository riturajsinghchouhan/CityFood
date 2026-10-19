// Port of pages/restaurant/WithdrawalHistoryPage.jsx (/withdrawal-history): Pending and
// Successful (approved) withdrawal requests from getWithdrawalHistory. As on web, rejected
// requests are not listed. Back goes to /hub-finance.
import { ArrowLeft, Wallet } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { getWithdrawalHistory } from "../../api";
import { fmtDateTimeIN, formatINR } from "../../components/finance/format";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { Text } from "../../components/ui";
import { withProtected } from "../../navigation/Protected";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const yellow100 = "#fef9c2";
const yellow800 = "#894b00";

function WithdrawalHistoryScreen() {
  const { colors } = useTheme();
  const goBack = useAppBack();
  const bottomInset = useShellBottomInset();
  const [tab, setTab] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const response = await getWithdrawalHistory();
        const history = Array.isArray(response?.data) ? response.data : [];
        if (!alive) return;
        setRequests(
          history.map((h) => ({
            id: h._id,
            amount: h.amount,
            status: h.status === "approved" ? "Approved" : h.status === "rejected" ? "Rejected" : "Pending",
            requestedAt: h.createdAt,
            processedAt: h.processedAt,
          })),
        );
      } catch {
        // list stays empty
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(
    () =>
      tab === "pending"
        ? requests.filter((r) => r.status === "Pending")
        : requests.filter((r) => r.status === "Approved" || r.status === "Processed"),
    [requests, tab],
  );

  const renderItem = ({ item }) => {
    const pending = tab === "pending";
    const when = pending ? item.requestedAt : item.processedAt;
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardBody}>
            <Text style={styles.amount}>
              ₹{item.amount != null ? formatINR(item.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
            </Text>
            <Text style={styles.when}>
              {pending ? "Requested" : "Processed"}: {when ? fmtDateTimeIN(when) : "N/A"}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: pending ? yellow100 : tw.green100 }]}>
            <Text style={[styles.pillText, { color: pending ? yellow800 : tw.green800 }]}>
              {pending ? "Pending" : item.status === "Approved" ? "Approved" : "Processed"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const tabButton = (id, label) => {
    const active = tab === id;
    return (
      <Pressable
        onPress={() => setTab(id)}
        style={({ pressed }) => [
          styles.tab,
          { backgroundColor: active ? colors.primary : pressed ? tw.gray200 : tw.gray100 },
        ]}
      >
        <Text style={[styles.tabText, { color: active ? "#ffffff" : tw.gray600 }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: tw.gray100 }]}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={tw.gray900} />
        </Pressable>
        <Text style={styles.title}>Withdrawal History</Text>
      </View>
      <View style={styles.tabsBar}>
        <View style={styles.tabs}>
          {tabButton("pending", "Withdrawal Pending")}
          {tabButton("successful", "Withdrawal Successful")}
        </View>
      </View>
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={renderItem}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 + bottomInset }}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.loading}>Loading...</Text>
          ) : (
            <View style={styles.empty}>
              <Wallet size={64} color={tw.gray300} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyText}>
                {tab === "pending" ? "No pending withdrawal requests" : "No successful withdrawals"}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function Gap() {
  return <View style={{ height: 12 }} />;
}

export default withProtected(WithdrawalHistoryScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tw.gray100 },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: { padding: 6, borderRadius: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: tw.gray900 },
  tabsBar: { backgroundColor: "#ffffff", paddingHorizontal: 16, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: tw.gray200 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 14, fontWeight: "500", textAlign: "center" },
  loading: { paddingVertical: 32, textAlign: "center", color: tw.gray500, fontSize: 16 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: tw.gray500, fontSize: 18, fontWeight: "500", textAlign: "center" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: tw.gray200,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardBody: { flex: 1 },
  amount: { fontSize: 18, fontWeight: "700", color: tw.gray900, marginBottom: 8 },
  when: { fontSize: 12, color: tw.gray600 },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  pillText: { fontSize: 12, fontWeight: "500" },
});
