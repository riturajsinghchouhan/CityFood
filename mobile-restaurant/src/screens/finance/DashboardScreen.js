// Port of pages/restaurant/RestaurantDashboard.jsx (/dashboard): the period picker, 8 KPI cards,
// the revenue area chart, order-status donut, payment-method pie, monthly bar chart, top dishes,
// recent orders and the open-complaints banner, all from getDashboardStats({period}). The
// recharts charts are redrawn with react-native-svg (components/finance/charts.js).
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  IndianRupee,
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import dayjs from "dayjs";
import { getDashboardStats } from "../../api";
import { AreaLineChart, GroupedBarChart, PieDonutChart } from "../../components/finance/charts";
import { formatINR } from "../../components/finance/format";
import { SelectField } from "../../components/menu/common";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import RestaurantPageShell from "../../components/shell/RestaurantPageShell";
import { Text } from "../../components/ui";
import { withProtected } from "../../navigation/Protected";
import { brand, mixWithWhite, tw } from "../../theme/tokens";

const INR = "₹";
const PRIMARY = "#B80B3D";
const STRONG = "#66001D";

const formatCurrency = (value) => `${INR}${formatINR(Number(value || 0), { maximumFractionDigits: 3 })}`;

const ACCENTS = {
  primary: { from: "rgba(184,11,61,0.1)", to: "rgba(102,0,29,0.05)", fg: PRIMARY },
  green: { from: "#ecfdf5", to: "rgba(208,250,229,0.5)", fg: "#007a55" },
  amber: { from: "#fffbeb", to: "rgba(254,243,198,0.5)", fg: "#bb4d00" },
  blue: { from: "#eff6ff", to: "rgba(219,234,254,0.5)", fg: "#1447e6" },
  violet: { from: "#f5f3ff", to: "rgba(237,233,254,0.5)", fg: "#7008e7" },
};

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "overall", label: "Overall" },
];

const BENTO_BORDER = mixWithWhite(brand.rtBorder, 0.65);

function BentoCard({ children, style }) {
  return <View style={[styles.bento, style]}>{children}</View>;
}

function CardHeader({ title, subtitle, right }) {
  return (
    <View style={styles.cardHeader}>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon, accent = "primary" }) {
  const a = ACCENTS[accent] || ACCENTS.primary;
  return (
    <BentoCard style={styles.kpi}>
      <View style={styles.kpiRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.kpiTitle}>{String(title).toUpperCase()}</Text>
          <Text style={styles.kpiValue} numberOfLines={1}>
            {value}
          </Text>
          {subtitle ? <Text style={styles.kpiSub}>{subtitle}</Text> : null}
        </View>
        <LinearGradient colors={[a.from, a.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.kpiIcon}>
          <Icon size={20} color={a.fg} />
        </LinearGradient>
      </View>
    </BentoCard>
  );
}

function DashboardScreen() {
  const bottomInset = useShellBottomInset();
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getDashboardStats({ period });
        if (!cancelled && res?.success) setData(res.data);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const kpis = data?.kpis || {};
  const orderPie = data?.orderStatusBreakdown || [];
  const paymentPie = data?.paymentMethodBreakdown || [];
  const revenueTrend = data?.revenueTrend || [];
  const monthlyTrend = data?.monthlyTrend || [];
  const topItems = data?.topItems || [];
  const recentOrders = data?.recentOrders || [];

  const periodLabel = useMemo(() => {
    switch (period) {
      case "today":
        return "Today";
      case "week":
        return "This week";
      case "month":
        return "This month";
      case "year":
        return "This year";
      default:
        return "Overall";
    }
  }, [period]);

  if (loading && !data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomInset }}>
      <RestaurantPageShell style={{ gap: 24 }}>
        <View style={{ gap: 16 }}>
          <View>
            <Text style={styles.overline}>RESTAURANT OVERVIEW</Text>
            <Text style={styles.h1}>{data?.restaurant?.name || "Dashboard"}</Text>
            <Text style={styles.periodLine}>
              {periodLabel} performance ·{" "}
              <Text style={{ fontSize: 14, fontWeight: "600", color: data?.restaurant?.isOnline ? "#009966" : tw.gray400 }}>
                {data?.restaurant?.isOnline ? "Online" : "Offline"}
              </Text>
            </Text>
          </View>
          <SelectField
            value={period}
            options={PERIOD_OPTIONS}
            onChange={setPeriod}
            placeholder="Period"
            style={styles.select}
            textStyle={styles.selectText}
            iconColor="rgba(106,114,130,0.5)"
          />
        </View>

        <View style={styles.grid}>
          <KpiCard
            title="Total revenue"
            value={formatCurrency(kpis.totalRevenue)}
            subtitle={`${kpis.deliveredOrders || 0} delivered orders`}
            icon={IndianRupee}
            accent="primary"
          />
          <KpiCard
            title="Today's orders"
            value={kpis.todayOrders ?? 0}
            subtitle={`${kpis.pendingOrders || 0} pending · ${kpis.processingOrders || 0} processing`}
            icon={ShoppingBag}
            accent="blue"
          />
          <KpiCard
            title="Available balance"
            value={formatCurrency(kpis.availableBalance)}
            subtitle={`Cycle earnings ${formatCurrency(kpis.cycleEarnings)}`}
            icon={Wallet}
            accent="green"
          />
          <KpiCard
            title="Average rating"
            value={Number(kpis.averageRating || 0).toFixed(1)}
            subtitle={`${kpis.totalRatings || 0} reviews`}
            icon={Star}
            accent="amber"
          />
          <KpiCard
            title="Total orders"
            value={kpis.totalOrders ?? 0}
            subtitle={`${kpis.completionRate || 0}% completion rate`}
            icon={CheckCircle2}
            accent="green"
          />
          <KpiCard
            title="Avg order value"
            value={formatCurrency(kpis.averageOrderValue)}
            subtitle="Per delivered order"
            icon={TrendingUp}
            accent="violet"
          />
          <KpiCard
            title="Menu items"
            value={kpis.menuItems ?? 0}
            subtitle={`${kpis.activeMenuItems || 0} active · ${kpis.addons || 0} add-ons`}
            icon={UtensilsCrossed}
            accent="primary"
          />
          <KpiCard
            title="Cancelled"
            value={kpis.cancelledOrders ?? 0}
            subtitle={`${kpis.cancellationRate || 0}% cancellation rate`}
            icon={XCircle}
            accent="amber"
          />
        </View>

        <View style={styles.grid}>
          <BentoCard style={styles.chartCard}>
            <CardHeader title="Revenue trend" subtitle="Daily revenue & orders (last 14 days)" />
            <View style={styles.chartBody}>
              <AreaLineChart
                data={revenueTrend}
                xKey="date"
                height={288}
                series={[
                  { key: "revenue", name: "Revenue (₹)", color: PRIMARY, kind: "area", gradient: [PRIMARY, 0.25] },
                  { key: "orders", name: "Orders", color: STRONG, kind: "line", strokeWidth: 2 },
                ]}
              />
            </View>
          </BentoCard>

          <BentoCard style={styles.chartCard}>
            <CardHeader title="Order status" subtitle={`Donut breakdown · ${periodLabel}`} />
            <View style={styles.chartBody}>
              <PieDonutChart data={orderPie} height={288} innerRadius={58} outerRadius={88} paddingAngle={3} />
            </View>
          </BentoCard>

          <BentoCard style={styles.chartCard}>
            <CardHeader title="Payment methods" subtitle="Pie chart by payment type" />
            <View style={styles.chartBody}>
              <PieDonutChart data={paymentPie} height={256} outerRadius={90} paddingAngle={2} />
            </View>
          </BentoCard>

          <BentoCard style={styles.chartCard}>
            <CardHeader title="Monthly momentum" subtitle="Bar chart — orders & revenue by month" />
            <View style={styles.chartBody}>
              <GroupedBarChart
                data={monthlyTrend}
                xKey="month"
                height={256}
                series={[
                  { key: "orders", name: "Orders", color: PRIMARY, radius: 6 },
                  { key: "revenue", name: "Revenue (₹)", color: STRONG, radius: 6 },
                ]}
              />
            </View>
          </BentoCard>

          <BentoCard style={styles.chartCard}>
            <CardHeader
              title="Top dishes"
              subtitle="Best sellers in selected period"
              right={<Package size={20} color={PRIMARY} />}
            />
            <View style={styles.listBody}>
              {topItems.length === 0 ? (
                <Text style={styles.emptyText}>No item data yet</Text>
              ) : (
                topItems.map((item, idx) => (
                  <View key={item.name} style={styles.listRow}>
                    <View style={styles.listLeft}>
                      <View style={styles.rank}>
                        <Text style={styles.rankText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    <View style={styles.listRight}>
                      <Text style={styles.rowStrong}>{item.orders} sold</Text>
                      <Text style={styles.rowSub}>{formatCurrency(item.revenue)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </BentoCard>

          <BentoCard style={styles.chartCard}>
            <CardHeader
              title="Recent orders"
              subtitle="Latest activity from your outlet"
              right={
                <Pressable onPress={() => router.push("/orders/all")} style={styles.viewAll} hitSlop={6}>
                  <Text style={styles.viewAllText}>View all</Text>
                  <ArrowUpRight size={14} color={PRIMARY} />
                </Pressable>
              }
            />
            <View style={[styles.listBody, { gap: 8 }]}>
              {recentOrders.length === 0 ? (
                <Text style={styles.emptyText}>No orders yet</Text>
              ) : (
                recentOrders.map((order) => (
                  <Pressable
                    key={order.orderId}
                    onPress={() => router.push(`/orders/${order.orderId}`)}
                    style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: tw.gray50 }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowStrong}>#{order.orderId}</Text>
                      <View style={styles.timeRow}>
                        <Clock size={12} color={tw.gray500} />
                        <Text style={styles.rowSub}>
                          {order.createdAt ? dayjs(order.createdAt).format("D MMM, hh:mm a") : "—"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.listRight}>
                      <Text style={styles.rowStrong}>{formatCurrency(order.total)}</Text>
                      <Text style={styles.statusText}>{String(order.status || "").replace(/_/g, " ").toUpperCase()}</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </BentoCard>
        </View>

        {(kpis.complaints || 0) > 0 ? (
          <View style={styles.complaints}>
            <AlertTriangle size={32} color="#e17100" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.complaintsTitle}>
                {kpis.complaints} open complaint{kpis.complaints !== 1 ? "s" : ""}
              </Text>
              <Text style={styles.complaintsSub}>Review customer issues in the feedback section.</Text>
            </View>
            <Pressable
              onPress={() => router.dismissTo("/feedback?tab=complaints")}
              style={({ pressed }) => [styles.complaintsBtn, pressed && { backgroundColor: "#bb4d00" }]}
            >
              <Text style={styles.complaintsBtnText}>View</Text>
            </Pressable>
          </View>
        ) : null}
      </RestaurantPageShell>
    </ScrollView>
  );
}

export default withProtected(DashboardScreen);

const styles = StyleSheet.create({
  loading: { flex: 1, minHeight: 400, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 16, fontSize: 14, fontWeight: "500", color: tw.gray500 },
  overline: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: PRIMARY },
  h1: { fontSize: 24, fontWeight: "900", color: tw.gray900, marginTop: 4 },
  periodLine: { fontSize: 14, color: tw.gray500, marginTop: 4 },
  select: { borderRadius: 12, borderColor: tw.gray200, backgroundColor: "#ffffff", height: 36, paddingHorizontal: 12, paddingVertical: 8 },
  selectText: { fontSize: 14, color: tw.gray900 },
  grid: { gap: 16 },
  bento: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: BENTO_BORDER,
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0px 1px 2px rgba(15,23,42,0.04), 0px 8px 24px -10px rgba(15,23,42,0.08)",
  },
  kpi: { paddingVertical: 44, paddingHorizontal: 20 },
  kpiRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  kpiTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, color: tw.gray500 },
  kpiValue: { marginTop: 8, fontSize: 24, fontWeight: "900", color: tw.gray900 },
  kpiSub: { marginTop: 4, fontSize: 12, color: tw.gray500, fontWeight: "500" },
  kpiIcon: { borderRadius: 16, padding: 12 },
  chartCard: { paddingVertical: 24, gap: 24 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900, lineHeight: 20 },
  cardSub: { fontSize: 12, color: tw.gray500 },
  chartBody: { paddingHorizontal: 24, paddingTop: 8 },
  listBody: { paddingHorizontal: 24, gap: 12 },
  emptyText: { fontSize: 14, color: tw.gray500, paddingVertical: 32, textAlign: "center" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tw.gray100,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  listRight: { alignItems: "flex-end" },
  rank: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#fdf2f5", alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 12, fontWeight: "900", color: PRIMARY },
  itemName: { flex: 1, fontSize: 14, fontWeight: "600", color: tw.gray900 },
  rowStrong: { fontSize: 14, fontWeight: "700", color: tw.gray900 },
  rowSub: { fontSize: 12, color: tw.gray500 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  statusText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.25, color: tw.gray500 },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewAllText: { fontSize: 12, fontWeight: "700", color: PRIMARY },
  complaints: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fee685",
    backgroundColor: "rgba(255,251,235,0.8)",
    boxShadow: "0px 1px 2px rgba(15,23,42,0.04), 0px 8px 24px -10px rgba(15,23,42,0.08)",
  },
  complaintsTitle: { fontWeight: "700", color: "#7b3306", fontSize: 16 },
  complaintsSub: { fontSize: 14, color: "rgba(151,60,0,0.8)" },
  complaintsBtn: { borderRadius: 12, backgroundColor: "#e17100", paddingHorizontal: 16, paddingVertical: 8 },
  complaintsBtnText: { fontSize: 12, fontWeight: "700", color: "#ffffff" },
});
