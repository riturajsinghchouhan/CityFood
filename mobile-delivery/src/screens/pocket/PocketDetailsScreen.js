// DeliveryV2/pages/pocket/PocketDetailsV2 (/pocket/details, "Pocket statement" tile): week selector,
// black payout summary card and the week's trips with earning + bonus (GET /pocket-details).
import dayjs from "dayjs";
import { ArrowLeft, Package, Receipt, TrendingUp } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPocketDetails } from "../../api";
import WeekSelector, { computeWeekRange } from "../../components/pocket/WeekSelector";
import { LoadingBlock, dvCard, formatCurrency, twx } from "../../components/pocket/common";
import { Screen, Text } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, dvColor, light, tw } from "../../theme/tokens";

const PRIMARY_TEXT = dvColor("text-primary", light);
const GREEN_TEXT = dvColor("text-green-500", light);

// framer: initial {opacity:0, y:10} -> animate, delay idx * 0.05 s.
function FadeIn({ index, children }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, 20) * 50,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [anim, index]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function TripRow({ order, earning, bonus }) {
  const oid = order.orderId || order._id || order.id;
  const isCod = String(order.paymentMethod || "").toLowerCase() === "cod";
  return (
    <Pressable style={({ pressed }) => [styles.trip, dvCard, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={styles.tripLeft}>
        <View style={styles.tripIcon}>
          <Package size={24} color={tw.gray900} />
        </View>
        <View style={{ flexShrink: 1 }}>
          <View style={styles.tripIdRow}>
            <Text style={styles.tripId}>#{String(oid ?? "").slice(-6).toUpperCase()}</Text>
            <Text style={styles.tripDate}>
              • {dayjs(order.deliveredAt || order.createdAt).format("DD MMM").toUpperCase()}
            </Text>
          </View>
          <Text style={styles.tripRestaurant} numberOfLines={1}>
            {String(order.restaurantName || order.restaurantId?.name || "Premium Restaurant").toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.tripAmount}>{formatCurrency(earning + bonus)}</Text>
        <View style={styles.tripBadges}>
          {bonus > 0 ? <Text style={styles.bp}>+{formatCurrency(bonus)} BP</Text> : null}
          <View
            style={[
              styles.payBadge,
              isCod
                ? { backgroundColor: twx.amber50, borderColor: twx.amber100 }
                : { backgroundColor: dvColor("bg-green-50", light), borderColor: dvColor("border-green-100", light) },
            ]}
          >
            <Text style={[styles.payBadgeText, { color: isCod ? twx.amber600 : dvColor("text-green-600", light) }]}>
              {String(order.paymentMethod || "Online").toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function PocketDetailsScreen() {
  const goBack = useAppBack();
  const insets = useSafeAreaInsets();
  const [weekRange, setWeekRange] = useState(() => computeWeekRange(new Date(), 0));
  const [orders, setOrders] = useState([]);
  const [paymentTransactions, setPaymentTransactions] = useState([]);
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [summaryData, setSummaryData] = useState({ totalEarning: 0, totalBonus: 0, grandTotal: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const response = await getPocketDetails({
          startDate: weekRange.start.toISOString(),
          endDate: weekRange.end.toISOString(),
          limit: 2000,
          _t: Date.now(),
        });
        if (!alive) return;
        const payload = response?.data || {};
        const trips = payload?.trips || payload?.orders || [];
        const payments = payload?.transactions?.payment || [];
        const bonuses = payload?.transactions?.bonus || [];
        const summary = payload?.summary || {};
        setOrders(Array.isArray(trips) ? trips : []);
        setPaymentTransactions(Array.isArray(payments) ? payments : []);
        setBonusTransactions(Array.isArray(bonuses) ? bonuses : []);
        setSummaryData({
          totalEarning: Number(summary.totalEarning) || 0,
          totalBonus: Number(summary.totalBonus) || 0,
          grandTotal: Number(summary.grandTotal) || 0,
        });
      } catch {
        if (!alive) return;
        setOrders([]);
        setPaymentTransactions([]);
        setBonusTransactions([]);
        setSummaryData({ totalEarning: 0, totalBonus: 0, grandTotal: 0 });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [weekRange]);

  const summary = useMemo(() => {
    let totalEarning = 0;
    let totalBonus = 0;
    paymentTransactions.forEach((p) => {
      totalEarning += p.amount || 0;
    });
    bonusTransactions.forEach((b) => {
      totalBonus += b.amount || 0;
    });
    return {
      totalEarning: summaryData.totalEarning || totalEarning,
      totalBonus: summaryData.totalBonus || totalBonus,
      grandTotal:
        summaryData.grandTotal || (summaryData.totalEarning || totalEarning) + (summaryData.totalBonus || totalBonus),
    };
  }, [paymentTransactions, bonusTransactions, summaryData]);

  const getOrderEarning = useCallback(
    (orderId) => {
      const p = paymentTransactions.find((x) => (x.orderId || x.metadata?.orderId) === orderId);
      if (p) return p.amount || 0;
      const order = orders.find((o) => (o.orderId || o._id || o.id) === orderId);
      return order?.deliveryEarning || order?.earningAmount || order?.amount || 0;
    },
    [orders, paymentTransactions],
  );

  const getOrderBonus = useCallback(
    (orderId) => {
      const b = bonusTransactions.find((x) => (x.orderId || x.metadata?.orderId) === orderId);
      return b ? b.amount : 0;
    },
    [bonusTransactions],
  );

  const header = (
    <View style={{ gap: 24, marginBottom: 16 }}>
      <View style={[styles.weekCard, dvCard]}>
        <WeekSelector onChange={setWeekRange} weekStartsOn={0} />
      </View>

      <View style={[styles.summary, dvCard]}>
        <View style={styles.summaryGlow} />
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>TOTAL PAYOUT</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary.grandTotal)}</Text>
          </View>
          <View style={styles.summaryIcon}>
            <TrendingUp size={24} color={PRIMARY_TEXT} />
          </View>
        </View>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCell, dvCard]}>
            <Text style={styles.cellLabel}>TRIP EARNINGS</Text>
            <Text style={styles.cellValue}>{formatCurrency(summary.totalEarning)}</Text>
          </View>
          <View style={[styles.summaryCell, dvCard]}>
            <Text style={styles.cellLabel}>WEEKLY BONUS</Text>
            <Text style={[styles.cellValue, { color: GREEN_TEXT }]}>+{formatCurrency(summary.totalBonus)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.listHead}>
        <Text style={styles.listTitle}>TRIPS HISTORY</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{orders.length} Orders</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Screen edges={[]} background={tw.gray50}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={goBack} style={({ pressed }) => [styles.backBtn, pressed && { transform: [{ scale: 0.9 }] }]}>
            <ArrowLeft size={20} color={tw.gray900} />
          </Pressable>
          <View>
            <Text style={styles.title}>POCKET DETAILS</Text>
            <Text style={styles.subtitle}>TRIPS & EARNINGS HISTORY</Text>
          </View>
        </View>
        <View style={styles.headerIcon}>
          <Receipt size={20} color={dvColor("text-blue-600", light)} />
        </View>
      </View>

      <FlatList
        data={loading ? [] : orders}
        keyExtractor={(order, idx) => String(order.orderId || order._id || order.id || idx)}
        renderItem={({ item, index }) => {
          const oid = item.orderId || item._id || item.id;
          return (
            <FadeIn index={index}>
              <TripRow order={item} earning={getOrderEarning(oid)} bonus={getOrderBonus(oid)} />
            </FadeIn>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <LoadingBlock
              color={PRIMARY_TEXT}
              size={40}
              label="SYNCING HISTORY..."
              labelStyle={styles.syncText}
              paddingVertical={80}
            />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Package size={32} color={tw.gray200} />
              </View>
              <Text style={styles.emptyTitle}>NO TRIPS FOUND</Text>
              <Text style={styles.emptyText}>CHECK ANOTHER WEEK RANGE</Text>
            </View>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    paddingHorizontal: 18,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 100,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tw.gray50,
    borderWidth: 1,
    borderColor: tw.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "900", color: tw.gray950, letterSpacing: -1 },
  subtitle: { fontSize: 10, fontWeight: "700", color: tw.gray400, letterSpacing: 1, marginTop: 2 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: dvColor("bg-blue-50", light),
    borderWidth: 1,
    borderColor: dvColor("border-blue-100", light),
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  weekCard: { backgroundColor: "#ffffff", padding: 16, borderRadius: 16, borderWidth: 1 },
  summary: { backgroundColor: tw.black, borderRadius: 24, padding: 18, overflow: "hidden" },
  summaryGlow: {
    position: "absolute",
    top: -64,
    right: -64,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  summaryLabel: { fontSize: 10, fontWeight: "700", color: tw.gray400, letterSpacing: 2, marginBottom: 4 },
  summaryValue: { fontSize: 36, fontWeight: "900", color: "#ffffff", letterSpacing: -1.8 },
  summaryIcon: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryGrid: { flexDirection: "row", gap: 16 },
  summaryCell: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 16, borderWidth: 1 },
  cellLabel: { fontSize: 9, fontWeight: "700", color: tw.gray400, letterSpacing: 1, marginBottom: 4 },
  cellValue: { fontSize: 18, fontWeight: "900", color: "#ffffff" },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  listTitle: { fontSize: 12, fontWeight: "900", color: tw.gray950, letterSpacing: 1.2 },
  countPill: { backgroundColor: tw.gray200, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  countText: { color: tw.gray600, fontSize: 10, fontWeight: "700" },
  syncText: { fontSize: 12, fontWeight: "700", color: tw.gray400, letterSpacing: 1.2 },
  trip: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tripLeft: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 },
  tripIcon: {
    width: 48,
    height: 48,
    backgroundColor: tw.gray50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.dvBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  tripIdRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  tripId: { fontSize: 14, fontWeight: "900", color: tw.gray950, letterSpacing: -0.35 },
  tripDate: { fontSize: 9, fontWeight: "700", color: tw.gray400, letterSpacing: 0.9 },
  tripRestaurant: { fontSize: 10, fontWeight: "700", color: tw.gray500, letterSpacing: -0.25, maxWidth: 140 },
  tripAmount: { fontSize: 16, fontWeight: "900", color: tw.gray950, lineHeight: 18, marginBottom: 4 },
  tripBadges: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  bp: { fontSize: 9, fontWeight: "700", color: GREEN_TEXT },
  payBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  payBadgeText: { fontSize: 8, fontWeight: "900" },
  empty: {
    paddingVertical: 80,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 32,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: tw.gray100,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    backgroundColor: tw.gray50,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    ...brand.cardShadow,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: tw.gray950, letterSpacing: -0.45 },
  emptyText: { fontSize: 12, fontWeight: "700", color: tw.gray400, letterSpacing: 1.2, marginTop: 4 },
});
