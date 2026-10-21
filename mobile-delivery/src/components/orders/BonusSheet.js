// HistoryV2 "Bonus Drawer (The Gift Modal)": Incentive Records from wallet type=bonus transactions.
import dayjs from "dayjs";
import { Gift, Search, X } from "lucide-react-native";
import { Dimensions, FlatList, Pressable, StyleSheet, View } from "react-native";
import Spinner from "../content/Spinner";
import Text from "../ui/Text";
import { BottomSheet } from "../ui/Sheet";
import { dvCard } from "../pocket/common";
import { dvColor, light, tw } from "../../theme/tokens";

const ACCENT = dvColor("text-[#10B981]", light);

function BonusRow({ tx }) {
  return (
    <View style={[styles.row, dvCard]}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={styles.amount}>₹{Number(tx.amount || 0).toFixed(2)}</Text>
        <Text style={styles.desc} numberOfLines={1}>
          {tx.description || "Bonus Payout"}
        </Text>
        {/* new Date(...).toLocaleDateString() (en-US) */}
        <Text style={styles.date}>{dayjs(tx.createdAt || tx.date).isValid() ? dayjs(tx.createdAt || tx.date).format("M/D/YYYY") : "Invalid Date"}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>DELIVERED</Text>
      </View>
    </View>
  );
}

export default function BonusSheet({ visible, onClose, loading, transactions }) {
  const maxHeight = Dimensions.get("window").height * 0.85;
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={maxHeight} style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={styles.iconBox}>
            <Gift size={24} color={ACCENT} />
          </View>
          <View>
            <Text style={styles.title}>Incentive Records</Text>
            <Text style={styles.subtitle}>Extra bonuses credited by team</Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={{ padding: 8 }}>
          <X size={20} color={tw.gray400} />
        </Pressable>
      </View>

      <View style={{ flexShrink: 1 }}>
        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: "center" }}>
            <Spinner size={32} color={ACCENT} />
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(tx, i) => String(tx?._id || tx?.id || i)}
            renderItem={({ item }) => <BonusRow tx={item} />}
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
            ListEmptyComponent={
              <View style={{ paddingVertical: 80, alignItems: "center" }}>
                <Search size={48} color={tw.gray100} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>Nothing to show</Text>
              </View>
            }
          />
        )}
      </View>

      <Pressable onPress={onClose} style={({ pressed }) => [styles.okBtn, dvCard, pressed && { transform: [{ scale: 0.95 }] }]}>
        <Text style={styles.okText}>Okay, Got it</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingBottom: 32 },
  handle: { width: 48, height: 4, backgroundColor: tw.gray100, borderRadius: 999, alignSelf: "center", marginBottom: 32 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 32 },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 },
  iconBox: {
    width: 48,
    height: 48,
    backgroundColor: dvColor("bg-green-50", light),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dvColor("border-green-100", light),
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: tw.gray950 },
  subtitle: { fontSize: 12, color: tw.gray400, fontWeight: "500" },
  row: {
    backgroundColor: tw.gray50,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amount: { fontSize: 18, fontWeight: "700", color: tw.gray950, marginBottom: 2 },
  desc: { fontSize: 14, fontWeight: "500", color: tw.gray600 },
  date: { fontSize: 10, color: tw.gray400, fontWeight: "500", marginTop: 4 },
  badge: { backgroundColor: tw.green100, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: ACCENT, fontSize: 10, fontWeight: "700" },
  emptyText: { fontSize: 14, fontWeight: "700", color: tw.gray400 },
  okBtn: { width: "100%", paddingVertical: 20, backgroundColor: tw.black, borderRadius: 16, marginTop: 32, alignItems: "center" },
  okText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
});
