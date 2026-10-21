// DeliveryV2/pages/pocket/DeductionStatementV2 (/pocket/deductions): week selector + deductions.
// Ported as on web: it asks the wallet for type=deduction and then keeps only withdrawal/deposit
// rows inside the week, so the list is always empty today (API_MAP "skipped and dead call sites").
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { getWalletTransactions } from "../../api";
import WeekSelector from "../../components/pocket/WeekSelector";
import { LoadingBlock, SubHeader, formatCurrency } from "../../components/pocket/common";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, dvColor, light, tw } from "../../theme/tokens";

// bg-green-500 / bg-orange-500 / bg-blue-500 all render as the primary.
const DOT_COLORS = [dvColor("bg-green-500", light), dvColor("bg-orange-500", light), dvColor("bg-blue-500", light)];

// Same expression as the web's initial state (Sunday..Saturday at the current time of day).
function initialWeek() {
  return {
    start: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())),
    end: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 6)),
  };
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={{ gap: 8, marginBottom: 24 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.ghostCard}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View style={[styles.dot, { marginTop: 4, backgroundColor: DOT_COLORS[i] }]} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.ghostLine, { width: "75%" }]} />
                <View style={[styles.ghostLine, { width: "50%" }]} />
              </View>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.emptyTitle}>No transactions</Text>
      <Text style={styles.emptyText}>Is hafton mein koi deduction nahi hui.</Text>
    </View>
  );
}

function DeductionRow({ item, index }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={styles.rowInner}>
        <View style={styles.rowLeft}>
          <View style={[styles.dot, { backgroundColor: DOT_COLORS[index % 3] }]} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.rowTitle}>{item.description || "System Deduction"}</Text>
            <Text style={styles.rowDate}>{dayjs(item.createdAt).format("DD MMM, hh:mm A")}</Text>
          </View>
        </View>
        <Text style={styles.rowAmount}>-{formatCurrency(item.amount)}</Text>
      </View>
    </Pressable>
  );
}

export default function DeductionsScreen() {
  const goBack = useAppBack();
  const [loading, setLoading] = useState(true);
  const [deductions, setDeductions] = useState([]);
  const [weekRange, setWeekRange] = useState(initialWeek);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const response = await getWalletTransactions({ type: "deduction", limit: 100 });
        if (alive && response?.success) {
          const all = response.data.transactions || [];
          const filtered = all.filter((t) => {
            const type = String(t.type || "").trim().toLowerCase();
            const isManualDeduction = type === "withdrawal" || type === "deposit";
            if (!isManualDeduction) return false;
            const d = new Date(t.date || t.createdAt);
            return d >= weekRange.start && d <= weekRange.end;
          });
          setDeductions(filtered);
        }
      } catch {
        if (alive) toast.error("Failed to load deductions");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [weekRange]);

  return (
    <Screen edges={[]} background={brand.bg}>
      <SubHeader title="Deduction statement" titleSize={20} onBack={goBack} />
      <FlatList
        data={loading ? [] : deductions}
        keyExtractor={(item, index) => String(item._id || index)}
        renderItem={({ item, index }) => <DeductionRow item={item} index={index} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<WeekSelector onChange={setWeekRange} />}
        ListEmptyComponent={
          loading ? (
            <LoadingBlock color={dvColor("text-orange-500", light)} label="Loading deductions..." labelStyle={styles.loadingText} />
          ) : (
            <EmptyState />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 128 },
  loadingText: { color: tw.gray600, fontSize: 14, fontWeight: "500" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  ghostCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: tw.gray100,
    width: 256,
    opacity: 0.5,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  ghostLine: { height: 6, backgroundColor: tw.gray100, borderRadius: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  emptyTitle: { color: tw.gray600, fontSize: 16, fontWeight: "700" },
  emptyText: { color: tw.gray400, fontSize: 12, fontWeight: "500", marginTop: 4 },
  row: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  rowInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  rowTitle: { color: tw.gray900, fontSize: 14, fontWeight: "700", lineHeight: 17.5 },
  rowDate: { color: tw.gray400, fontSize: 10, fontWeight: "700", marginTop: 4, letterSpacing: -0.25, textTransform: "uppercase" },
  rowAmount: { color: tw.red600, fontSize: 16, fontWeight: "700" },
});
