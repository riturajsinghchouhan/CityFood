// Port of Frontend/src/modules/Food/pages/user/Wallet.jsx.
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  IndianRupee,
  Plus,
  RefreshCw,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { getWallet } from "../../api";
import AddMoneyModal from "../../components/account/AddMoneyModal";
import { Screen, Text, toast } from "../../components/ui";
import { useCompanyName } from "../../context/AppSettingsContext";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";

const FILTERS = [
  { id: "all", label: "All Transactions" },
  { id: "additions", label: "Additions" },
  { id: "deductions", label: "Deductions" },
  { id: "refunds", label: "Refunds" },
];

const isReferralTx = (t) =>
  t?.metadata?.source === "referral_signup" || String(t?.description || "").toLowerCase().startsWith("referral reward");

const formatAmount = (amount) => {
  const numeric = Number(amount ?? 0);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  return `₹${safe.toLocaleString("en-IN")}`;
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const formattedDate = date.toLocaleDateString("en-IN", { year: "numeric", month: "2-digit", day: "2-digit" });
  const formattedTime = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${formattedDate} | ${formattedTime}`;
};

function txColor(type, isDark) {
  if (type === "addition") return isDark ? "#05df72" : tw.green600;
  if (type === "deduction") return isDark ? "#ff6467" : tw.red600;
  if (type === "refund") return isDark ? "#51a2ff" : tw.blue600;
  return isDark ? tw.gray400 : tw.gray600;
}

function TxIcon({ type, isDark }) {
  const color = txColor(type, isDark);
  if (type === "addition") return <ArrowDownCircle size={24} color={color} />;
  if (type === "deduction") return <ArrowUpCircle size={24} color={color} />;
  if (type === "refund") return <RefreshCw size={24} color={color} />;
  return null;
}

export default function WalletScreen() {
  const companyName = useCompanyName();
  const goBack = useAppBack();
  const { isDark } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addMoneyModalOpen, setAddMoneyModalOpen] = useState(false);

  const fetchWalletData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getWallet();
      const walletData = response?.data?.wallet;
      if (walletData) {
        setWallet(walletData);
        setTransactions(walletData.transactions || []);
      }
    } catch (err) {
      setError(err?.status ? err.message : "Failed to load wallet");
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const currentBalance = wallet?.balance || 0;

  const referralEarnings = useMemo(() => {
    if (wallet?.referralEarnings != null) return Number(wallet.referralEarnings) || 0;
    return transactions
      .filter((t) => t.type === "addition" && t.status === "Completed" && isReferralTx(t))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [wallet, transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedFilter === "all") return transactions;
    const type = { additions: "addition", deductions: "deduction", refunds: "refund" }[selectedFilter];
    return transactions.filter((t) => t.type === type);
  }, [selectedFilter, transactions]);

  const cardBg = isDark ? "#1a1a1a" : "#ffffff";
  const muted = isDark ? tw.gray400 : tw.gray500;
  const strong = isDark ? "#ffffff" : tw.gray900;

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.balanceBlock}>
        <View style={styles.iconOuter}>
          <LinearGradient
            colors={["#fb2c36", "#dc2626", "#c10007"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <View style={styles.iconInner}>
              <IndianRupee size={40} color="#ffffff" strokeWidth={2.5} />
            </View>
          </LinearGradient>
        </View>

        <View style={styles.balanceText}>
          <Text style={[styles.brandTitle, { color: strong }]}>{companyName} Money</Text>
          <View style={styles.mb8}>
            <Text style={[styles.smallLabel, { color: muted }]}>Current Balance</Text>
            <Text style={[styles.balance, { color: strong }]}>{formatAmount(currentBalance)}</Text>
          </View>
          <View style={styles.mb8}>
            <Text style={[styles.smallLabel, { color: muted }]}>Referral Earnings</Text>
            <Text style={[styles.referral, { color: isDark ? "#05df72" : tw.green600 }]}>
              {formatAmount(referralEarnings)}
            </Text>
          </View>
          <Text style={[styles.tagline, { color: muted }]}>Add money to enjoy one-tap, seamless payments</Text>
        </View>
      </View>

      <Pressable
        onPress={() => setAddMoneyModalOpen(true)}
        style={({ pressed }) => [styles.addBtn, { backgroundColor: pressed ? tw.green700 : tw.green600 }]}
      >
        <Plus size={16} color="#ffffff" />
        <Text style={styles.addText}>Add money</Text>
      </Pressable>

      <View style={styles.historyHead}>
        <Text style={[styles.historyTitle, { color: isDark ? tw.gray500 : tw.gray400 }]}>TRANSACTION HISTORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((filter) => {
            const isSelected = selectedFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => setSelectedFilter(filter.id)}
                style={[
                  styles.filter,
                  { backgroundColor: cardBg },
                  isSelected
                    ? { borderWidth: 2, borderColor: isDark ? tw.green500 : tw.green600, ...shadow.sm }
                    : { borderWidth: 1, borderColor: isDark ? tw.gray800 : tw.gray200 },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: isSelected ? (isDark ? "#05df72" : tw.green600) : isDark ? tw.gray300 : tw.gray600 },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  const empty = (
    <View style={styles.empty}>
      <View style={styles.emptyRows}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.emptyRow, { backgroundColor: isDark ? tw.gray800 : tw.gray100, opacity: 0.3 + i * 0.15 }]}
          >
            <View style={[styles.emptyThumb, { backgroundColor: isDark ? tw.gray700 : tw.gray200 }]} />
            <View style={styles.emptyLines}>
              <View style={[styles.lineLong, { backgroundColor: isDark ? tw.gray700 : tw.gray200 }]} />
              <View style={[styles.lineShort, { backgroundColor: isDark ? tw.gray700 : tw.gray200 }]} />
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.emptyText, { color: isDark ? tw.gray400 : tw.gray600 }]}>
        Your transactions will appear here
      </Text>
    </View>
  );

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.txCard,
        { backgroundColor: cardBg, borderColor: isDark ? tw.gray800 : tw.gray100 },
      ]}
    >
      <View style={styles.txLeft}>
        <View style={[styles.txIcon, { backgroundColor: isDark ? "rgba(31,41,55,0.5)" : tw.gray50 }]}>
          <TxIcon type={item.type} isDark={isDark} />
        </View>
        <View style={styles.txInfo}>
          <Text numberOfLines={1} style={[styles.txDesc, { color: strong }]}>
            {item.description}
          </Text>
          {isReferralTx(item) ? (
            <Text style={[styles.txTag, { color: isDark ? "#05df72" : tw.green600 }]}>Referral reward</Text>
          ) : null}
          <Text style={[styles.txDate, { color: muted }]}>{formatDate(item.date || item.createdAt)}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, { color: txColor(item.type, isDark) }]}>
        {item.type === "deduction" ? "-" : "+"}
        {formatAmount(item.amount)}
      </Text>
    </View>
  );

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
      <View
        style={[
          styles.topBar,
          { backgroundColor: cardBg, borderBottomColor: isDark ? tw.gray800 : tw.gray100 },
        ]}
      >
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={6}>
          <ArrowLeft size={20} color={isDark ? "#ffffff" : tw.gray700} />
        </Pressable>
        <Text style={[styles.topTitle, { color: strong }]}>Wallet</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size={32} color={isDark ? tw.gray400 : tw.gray600} />
        </View>
      ) : error ? (
        <View style={styles.content}>
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: isDark ? "rgba(127,29,29,0.2)" : tw.red50,
                borderColor: isDark ? "#9f0712" : "#ffc9c9",
              },
            ]}
          >
            <Text style={[styles.errorText, { color: isDark ? "#ff6467" : tw.red600 }]}>{error}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item, index) => String(item.id || item._id || index)}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={Separator}
        />
      )}

      <AddMoneyModal open={addMoneyModalOpen} onOpenChange={setAddMoneyModalOpen} onSuccess={fetchWalletData} />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  topTitle: { fontSize: 18, fontWeight: "700" },
  loading: { paddingVertical: 48, alignItems: "center" },
  content: { paddingHorizontal: 16, paddingVertical: 24 },
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 16 },
  errorText: { fontSize: 14 },
  headerBlock: { gap: 24, marginBottom: 16 },
  balanceBlock: { gap: 16 },
  iconOuter: { width: 80, height: 80, transform: [{ rotate: "-5deg" }], borderRadius: 12, ...shadow.lg },
  iconGradient: { flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceText: { alignItems: "center" },
  brandTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  mb8: { marginBottom: 8, alignItems: "center" },
  smallLabel: { fontSize: 12, marginBottom: 4 },
  balance: { fontSize: 24, fontWeight: "700" },
  referral: { fontSize: 18, fontWeight: "600" },
  tagline: { fontSize: 12, textAlign: "center" },
  addBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addText: { color: "#ffffff", fontWeight: "600", fontSize: 14 },
  historyHead: { gap: 16 },
  historyTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 1.2 },
  filters: { gap: 8, paddingBottom: 8 },
  filter: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  filterText: { fontSize: 12, fontWeight: "500" },
  separator: { height: 12 },
  txCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    ...shadow.sm,
  },
  txLeft: { flexDirection: "row", alignItems: "center", gap: 16, flex: 1, minWidth: 0 },
  txIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1, minWidth: 0 },
  txDesc: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  txTag: { fontSize: 11, fontWeight: "500", marginBottom: 4 },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 18, fontWeight: "700" },
  empty: { paddingVertical: 48 },
  emptyRows: { gap: 12, marginBottom: 24 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  emptyThumb: { width: 40, height: 40, borderRadius: 8 },
  emptyLines: { flex: 1, gap: 8 },
  lineLong: { height: 12, width: "75%", borderRadius: 4 },
  lineShort: { height: 8, width: "50%", borderRadius: 4 },
  emptyText: { fontSize: 14, fontWeight: "500", textAlign: "center" },
});
