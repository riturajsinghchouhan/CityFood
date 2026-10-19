// Port of pages/restaurant/HubFinance.jsx (/hub-finance, ?tab=invoices): Payouts (current cycle
// estimate + Withdraw modal, the latest 8 withdrawal requests, past cycles by date range with the
// "Get report -> Download PDF" statement) and Invoices & Taxes (summary + order list).
// window.alert becomes Alert.alert; the jsPDF/html2canvas statement becomes expo-print + sharing.
// restaurantAPI.getRestaurantByOwner is a hard-coded web stub, so the header uses
// getFinance().data.restaurant only. The past-cycle / invoice rows are the FlatList body.
import { router, useLocalSearchParams } from "expo-router";
import { Bell, Calendar, ChevronDown, Download, FileText, Menu, Wallet, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { createWithdrawalRequest, getFinance, getWithdrawalHistory } from "../../api";
import AnchoredMenu from "../../components/finance/AnchoredMenu";
import { buildReportData, shareFinanceReport } from "../../components/finance/financeReport";
import { fmtDateTimeIN2, formatINR } from "../../components/finance/format";
import { CenterSheet } from "../../components/menu/common";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { openShellRoute } from "../../components/shell/navigate";
import { Text } from "../../components/ui";
import { useScopedFont } from "../../components/ui/Text";
import { withProtected } from "../../navigation/Protected";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const money2 = (v) => formatINR(Number(v || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const amber100 = "#fef3c6";
const amber700 = "#bb4d00";
const red100 = "#ffe2e2";

// "REST-1768762345335-5678" -> "REST005678"
const formatRestaurantId = (restaurantId) => {
  if (!restaurantId) return "";
  const strId = String(restaurantId);
  const numericMatch = strId.match(/(\d+)$/);
  if (numericMatch) return `REST${numericMatch[1].slice(-6).padStart(6, "0")}`;
  return strId;
};

const withdrawalStatusColors = (statusRaw) => {
  const status = String(statusRaw || "").trim().toLowerCase();
  if (status === "approved") return { bg: tw.green100, fg: tw.green700 };
  if (status === "rejected") return { bg: red100, fg: tw.red700 };
  return { bg: amber100, fg: amber700 };
};

const formatWithdrawalStatus = (statusRaw) => {
  const status = String(statusRaw || "").trim().toLowerCase();
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDateTime = (dateValue) => {
  if (!dateValue) return "N/A";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "N/A";
  return fmtDateTimeIN2(date);
};

// The web's parseDateRange: relative labels, or "14 Nov - 14 Dec'25" style strings.
const parseDateRange = (dateRangeStr) => {
  try {
    if (!dateRangeStr || typeof dateRangeStr !== "string") return null;
    const today = new Date();
    if (dateRangeStr === "Last 7 days") {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      return { startDate: start.toISOString(), endDate: today.toISOString() };
    }
    if (dateRangeStr === "Last 30 days" || dateRangeStr === "Last 1 month") {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      return { startDate: start.toISOString(), endDate: today.toISOString() };
    }
    if (dateRangeStr === "This week") {
      const start = new Date();
      start.setDate(today.getDate() - today.getDay());
      return { startDate: start.toISOString(), endDate: today.toISOString() };
    }
    if (dateRangeStr === "This month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: start.toISOString(), endDate: today.toISOString() };
    }
    const parts = dateRangeStr.split(" - ");
    if (parts.length !== 2) return null;
    const startParts = parts[0].trim().split(" ");
    const endParts = parts[1].trim().replace("'", " ").split(" ");
    if (startParts.length < 2 || endParts.length < 2) return null;
    const startMonth = SHORT_MONTHS.indexOf(startParts[1]);
    const endMonth = SHORT_MONTHS.indexOf(endParts[1]);
    const startDay = parseInt(startParts[0], 10);
    const endDay = parseInt(endParts[0], 10);
    const year = endParts.length > 2 ? parseInt(`20${endParts[2]}`, 10) : new Date().getFullYear();
    if (startMonth < 0 || endMonth < 0 || Number.isNaN(startDay) || Number.isNaN(endDay)) return null;
    return {
      startDate: new Date(year, startMonth, startDay).toISOString(),
      endDate: new Date(year, endMonth, endDay).toISOString(),
    };
  } catch {
    return null;
  }
};

const formatDateForDisplay = (date) => `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}'${String(date.getFullYear()).slice(-2)}`;

function getDateOptions() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const last7DaysStart = new Date(today);
  last7DaysStart.setDate(today.getDate() - 7);
  last7DaysStart.setHours(0, 0, 0, 0);
  const last30DaysStart = new Date(today);
  last30DaysStart.setDate(today.getDate() - 30);
  last30DaysStart.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - daysFromMonday);
  thisWeekStart.setHours(0, 0, 0, 0);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
  thisWeekEnd.setHours(23, 59, 59, 999);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekEnd);
  lastWeekEnd.setDate(thisWeekEnd.getDate() - 7);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
  const range = (s, e) => `${formatDateForDisplay(s)} - ${formatDateForDisplay(e)}`;
  return [
    { label: "Last 7 days", startDate: last7DaysStart, endDate: today },
    { label: "Last 30 days", startDate: last30DaysStart, endDate: today },
    { label: "This week", startDate: thisWeekStart, endDate: thisWeekEnd },
    { label: "Last week", startDate: lastWeekStart, endDate: lastWeekEnd },
    { label: "This month", startDate: thisMonthStart, endDate: thisMonthEnd },
    { label: "Last month", startDate: lastMonthStart, endDate: lastMonthEnd },
  ].map((o) => ({ ...o, range: range(o.startDate, o.endDate) }));
}

const withdrawalList = (res) => {
  const payload = res?.data;
  return Array.isArray(payload) ? payload : Array.isArray(payload?.withdrawals) ? payload.withdrawals : [];
};

// One row of the white card that wraps a FlatList section (web `bg-white rounded-lg p-4 space-y-3`).
function CardSlice({ first, last, children, bordered }) {
  return (
    <View
      style={[
        styles.slice,
        bordered && styles.sliceBordered,
        first && styles.sliceFirst,
        first && bordered && { borderTopWidth: 1 },
        last && styles.sliceLast,
        last && bordered && { borderBottomWidth: 1 },
      ]}
    >
      {children}
    </View>
  );
}

function HubFinanceScreen() {
  const { colors } = useTheme();
  const bottomInset = useShellBottomInset();
  const inputFont = useScopedFont("400");
  const { tab } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(tab === "invoices" ? "invoices" : "payouts");
  const [selectedDateRange, setSelectedDateRange] = useState("Last 30 days");
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const downloadAnchor = useRef(null);
  const dateAnchor = useRef(null);
  const [financeData, setFinanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pastCyclesData, setPastCyclesData] = useState(null);
  const [loadingPastCycles, setLoadingPastCycles] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const response = await getFinance();
        if (alive && response?.success && response.data) setFinanceData(response.data);
      } catch {
        // header falls back to "Restaurant"
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingWithdrawals(true);
        const response = await getWithdrawalHistory();
        if (alive) setWithdrawalRequests(withdrawalList(response));
      } catch {
        if (alive) setWithdrawalRequests([]);
      } finally {
        if (alive) setLoadingWithdrawals(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const restaurantData = financeData?.restaurant || null;

  const currentCycleDates = useMemo(() => {
    if (financeData?.currentCycle) {
      return {
        start: financeData.currentCycle.start?.day,
        end: financeData.currentCycle.end?.day,
        month: financeData.currentCycle.start?.month,
        year: financeData.currentCycle.start?.year,
      };
    }
    return { start: "15", end: "21", month: "Dec", year: "25" };
  }, [financeData]);

  const invoiceOrders = useMemo(() => {
    const allOrdersMap = new Map();
    (financeData?.currentCycle?.orders || []).forEach((order) => {
      const id = order.orderId || order._id || order.id;
      if (id) allOrdersMap.set(id, order);
    });
    (pastCyclesData?.orders || []).forEach((order) => {
      const id = order.orderId || order._id || order.id;
      if (id && !allOrdersMap.has(id)) allOrdersMap.set(id, order);
    });
    return Array.from(allOrdersMap.values());
  }, [financeData, pastCyclesData]);

  const invoiceSummary = useMemo(() => {
    const earnings = invoiceOrders.reduce((sum, o) => sum + (o.payout || o.restaurantEarning || 0), 0);
    const commission = invoiceOrders.reduce((sum, o) => sum + (o.commission || 0), 0);
    const gross = invoiceOrders.reduce((sum, o) => sum + (o.totalAmount || o.orderTotal || 0), 0);
    return { earnings, commission, gross, count: invoiceOrders.length };
  }, [invoiceOrders]);

  const pastRequest = useRef(0);
  const fetchPastCyclesData = useCallback(async (startDate, endDate) => {
    if (!startDate || !endDate) {
      setPastCyclesData(null);
      return;
    }
    const reqId = ++pastRequest.current;
    try {
      setLoadingPastCycles(true);
      const startDateObj = startDate instanceof Date ? startDate : new Date(startDate);
      const endDateObj = endDate instanceof Date ? endDate : new Date(endDate);
      if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
        setPastCyclesData(null);
        return;
      }
      const response = await getFinance({
        startDate: startDateObj.toISOString().split("T")[0],
        endDate: endDateObj.toISOString().split("T")[0],
      });
      if (reqId !== pastRequest.current) return;
      setPastCyclesData(response?.success && response.data?.pastCycles ? response.data.pastCycles : null);
    } catch {
      if (reqId === pastRequest.current) setPastCyclesData(null);
    } finally {
      if (reqId === pastRequest.current) setLoadingPastCycles(false);
    }
  }, []);

  // As on web: the relative labels fetch here; a picked "d Mon'yy - d Mon'yy" range does not parse,
  // so this clears the data while the picker's own fetch fills it in.
  useEffect(() => {
    const dateRange = parseDateRange(selectedDateRange);
    if (dateRange?.startDate && dateRange?.endDate) fetchPastCyclesData(dateRange.startDate, dateRange.endDate);
    else setPastCyclesData(null);
  }, [selectedDateRange, fetchPastCyclesData]);

  const downloadPDF = async () => {
    setShowDownloadMenu(false);
    try {
      await shareFinanceReport(buildReportData({ financeData, pastCyclesData, selectedDateRange, currentCycleDates }));
    } catch (error) {
      Alert.alert("", `Failed to download PDF: ${error?.message}. Please check console for details.`);
    }
  };

  const available = financeData?.currentCycle?.estimatedPayout || 0;
  const parsedAmount = parseFloat(withdrawalAmount);
  const closeWithdrawal = () => {
    setShowWithdrawalModal(false);
    setWithdrawalAmount("");
  };

  const submitWithdrawal = async () => {
    const amount = parseFloat(withdrawalAmount);
    if (!amount || amount <= 0) {
      Alert.alert("", "Please enter a valid amount");
      return;
    }
    if (amount > available) {
      Alert.alert("", "Amount cannot exceed available balance");
      return;
    }
    try {
      setSubmittingWithdrawal(true);
      const response = await createWithdrawalRequest(amount);
      if (response?.success) {
        Alert.alert("", "Withdrawal request submitted successfully!");
        closeWithdrawal();
        const financeResponse = await getFinance();
        if (financeResponse?.success && financeResponse.data) setFinanceData(financeResponse.data);
        const withdrawalResponse = await getWithdrawalHistory();
        setWithdrawalRequests(withdrawalList(withdrawalResponse));
      } else {
        Alert.alert("", response?.message || "Failed to submit withdrawal request");
      }
    } catch (error) {
      Alert.alert("", error?.data?.message || "Failed to submit withdrawal request. Please try again.");
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const headerSubtitle = (() => {
    const restaurantId = restaurantData?.restaurantId;
    const address = restaurantData?.address || "";
    const parts = [];
    if (restaurantId) parts.push(`ID: ${formatRestaurantId(restaurantId)}`);
    if (address) parts.push(address.length > 40 ? `${address.substring(0, 40)}...` : address);
    return parts.length > 0 ? parts.join(" • ") : "Loading...";
  })();

  // ---- list data per tab ----
  const pastOrders = pastCyclesData?.orders;
  const currentOrders = financeData?.currentCycle?.orders || [];
  let listData = [];
  let listKind = "orders";
  if (activeTab === "payouts") {
    if (!loadingPastCycles) {
      if (pastOrders && pastOrders.length > 0) listData = pastOrders;
      else if ((!pastCyclesData || !pastOrders) && currentOrders.length > 0) listData = currentOrders;
    }
  } else {
    listKind = "invoice";
    listData = loading ? [] : invoiceOrders;
  }

  const renderItem = ({ item: order, index }) => {
    const first = index === 0;
    const last = index === listData.length - 1;
    if (listKind === "invoice") {
      return (
        <CardSlice first={false} last={last} bordered>
          <View style={[styles.invoiceRow, !first && { marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceId}>Order: {order.orderId || "N/A"}</Text>
              <Text style={styles.invoiceMeta}>
                {order.paymentMethod || "N/A"} | {order.orderStatus || "N/A"}
              </Text>
            </View>
            <View style={styles.alignRight}>
              <Text style={styles.invoiceAmount}>₹{money2(order.payout || order.restaurantEarning || 0)}</Text>
              <Text style={styles.earningLabel}>Earning</Text>
            </View>
          </View>
        </CardSlice>
      );
    }
    return (
      <CardSlice first={first} last={last}>
        <View style={[styles.orderRow, !last && styles.orderRowDivider, !first && { marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>Order ID: {order.orderId || "N/A"}</Text>
            <Text style={styles.orderItems}>
              {order.foodNames || (order.items && order.items.map((item) => item.name).join(", ")) || "N/A"}
            </Text>
          </View>
          <View style={[styles.alignRight, { marginLeft: 16 }]}>
            <Text style={styles.orderPayout}>₹{money2(order.payout || 0)}</Text>
            <Text style={styles.earningLabel}>Earning</Text>
          </View>
        </View>
      </CardSlice>
    );
  };

  const tabButton = (id, label) => {
    const active = activeTab === id;
    return (
      <Pressable
        onPress={() => setActiveTab(id)}
        style={[styles.tab, active ? { backgroundColor: colors.primary } : styles.tabInactive]}
      >
        <Text style={[styles.tabText, { color: active ? "#ffffff" : tw.gray600 }]}>{label}</Text>
      </Pressable>
    );
  };

  const payoutsHeader = (
    <View style={{ gap: 24 }}>
      <View>
        <Text style={styles.sectionTitle}>Current cycle</Text>
        <View style={styles.card}>
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : (
            <>
              <Text style={styles.payout}>₹{money2(available)}</Text>
              <Text style={styles.orderCount}>
                {financeData?.currentCycle?.totalOrders || 0} {financeData?.currentCycle?.totalOrders === 1 ? "order" : "orders"}
              </Text>
              <Pressable
                onPress={() => setShowWithdrawalModal(true)}
                disabled={!(available > 0)}
                style={[styles.withdrawBtn, { backgroundColor: available > 0 ? colors.primary : tw.gray200 }]}
              >
                <Wallet size={20} color={available > 0 ? "#ffffff" : tw.gray500} />
                <Text style={[styles.withdrawText, { color: available > 0 ? "#ffffff" : tw.gray500 }]}>Withdraw</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <View>
        <Text style={styles.sectionTitle}>Withdrawal requests</Text>
        <View style={styles.card}>
          {loadingWithdrawals ? (
            <Text style={styles.smallState}>Loading withdrawal requests...</Text>
          ) : withdrawalRequests.length === 0 ? (
            <Text style={styles.smallState}>No withdrawal requests found.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {withdrawalRequests.slice(0, 8).map((request, index) => {
                const st = withdrawalStatusColors(request?.status);
                return (
                  <View key={request?._id || request?.id || index} style={styles.requestRow}>
                    <View style={styles.requestInner}>
                      <View style={{ flexShrink: 1 }}>
                        <Text style={styles.requestAmount}>₹{money2(request?.amount)}</Text>
                        <Text style={styles.requestMeta}>Requested: {formatDateTime(request?.createdAt || request?.requestedAt)}</Text>
                        {request?.processedAt ? (
                          <Text style={[styles.requestMeta, { marginTop: 2 }]}>Processed: {formatDateTime(request?.processedAt)}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusText, { color: st.fg }]}>{formatWithdrawalStatus(request?.status)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
              {withdrawalRequests.length > 8 ? (
                <Pressable onPress={() => router.push("/withdrawal-history")} style={{ paddingTop: 4 }}>
                  <Text style={styles.viewAll}>View all requests</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Past cycles</Text>
        <View style={styles.controls}>
          <View ref={dateAnchor} collapsable={false} style={{ flex: 1 }}>
            <Pressable onPress={() => setShowDateRangePicker((v) => !v)} style={styles.rangeBtn}>
              <View style={styles.rangeLeft}>
                <Calendar size={16} color={tw.gray600} />
                <Text style={styles.rangeText} numberOfLines={1}>
                  {selectedDateRange}
                </Text>
              </View>
              <ChevronDown
                size={16}
                color={tw.gray600}
                style={{ transform: [{ rotate: showDateRangePicker ? "180deg" : "0deg" }] }}
              />
            </Pressable>
          </View>
          <View ref={downloadAnchor} collapsable={false}>
            <Pressable
              onPress={() => setShowDownloadMenu((v) => !v)}
              style={[styles.reportBtn, { backgroundColor: colors.primary }]}
            >
              <Download size={16} color="#ffffff" />
              <Text style={styles.reportText}>Get report</Text>
              <ChevronDown size={16} color="#ffffff" />
            </Pressable>
          </View>
        </View>
        {loadingPastCycles ? (
          <View style={styles.card}>
            <Text style={styles.pastLoading}>Loading past cycles...</Text>
          </View>
        ) : pastOrders && pastOrders.length === 0 ? (
          <View style={styles.pastEmpty}>
            <Text style={styles.pastEmptyText}>No orders found for this selected range.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const invoicesHeader = (
    <View style={{ gap: 16 }}>
      <View style={[styles.card, styles.cardBorder]}>
        <Text style={styles.cardTitle}>Invoices &amp; Taxes Summary</Text>
        <View style={{ gap: 12 }}>
          {[
            ["Orders", String(invoiceSummary.count)],
            ["Earnings", `₹${money2(invoiceSummary.earnings)}`],
            ["Commission", `₹${money2(invoiceSummary.commission)}`],
            ["Gross amount", `₹${money2(invoiceSummary.gross)}`],
          ].map(([label, value]) => (
            <View key={label} style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
      <CardSlice first last={listData.length === 0} bordered>
        <Text style={[styles.cardTitle, listData.length === 0 ? null : { marginBottom: 12 }]}>Order invoice details</Text>
        {loading ? (
          <Text style={styles.invoiceState}>Loading invoice data...</Text>
        ) : invoiceOrders.length === 0 ? (
          <Text style={styles.invoiceState}>No invoice data available for selected range.</Text>
        ) : null}
      </CardSlice>
    </View>
  );

  const showNoHistory =
    activeTab === "payouts" &&
    (!pastCyclesData || !pastOrders || pastOrders.length === 0) &&
    currentOrders.length === 0 &&
    !loadingPastCycles &&
    !loading;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {restaurantData?.name || financeData?.restaurant?.name || "Restaurant"}
            </Text>
            <ChevronDown size={16} color={tw.gray600} />
          </View>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/withdrawal-history")}
            style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: tw.gray100 }]}
            accessibilityLabel="Withdrawal History"
          >
            <Wallet size={20} color={tw.gray700} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: tw.gray100 }]}
            accessibilityLabel="Notifications"
          >
            <Bell size={20} color={tw.gray700} />
          </Pressable>
          <Pressable
            onPress={() => openShellRoute("/explore", "/hub-finance")}
            style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: tw.gray100 }]}
            accessibilityLabel="Explore"
          >
            <Menu size={20} color={tw.gray700} />
          </Pressable>
        </View>
      </View>

      <FlatList
        key={activeTab}
        data={listData}
        keyExtractor={(order, index) => `${order.orderId || order._id || index}-${listKind}`}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <View style={styles.tabs}>
              {tabButton("payouts", "Payouts")}
              {tabButton("invoices", "Invoices & Taxes")}
            </View>
            <View style={{ paddingTop: 24, marginBottom: activeTab === "payouts" && listData.length ? 12 : 0 }}>
              {activeTab === "payouts" ? payoutsHeader : invoicesHeader}
            </View>
          </View>
        }
        ListFooterComponent={
          showNoHistory ? (
            <View style={[styles.noHistory, { marginTop: 12 }]}>
              <Text style={styles.noHistoryTitle}>No transaction history available</Text>
              <Text style={styles.noHistorySub}>Your earnings and order payouts will appear here.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 112 + bottomInset }}
      />

      <AnchoredMenu
        open={showDateRangePicker}
        onClose={() => setShowDateRangePicker(false)}
        anchorRef={dateAnchor}
        style={styles.datePanel}
      >
        <View style={{ padding: 16 }}>
          <Text style={styles.dateTitle}>Select Date Range</Text>
          <View style={{ gap: 8 }}>
            {getDateOptions().map((option) => (
              <Pressable
                key={option.label}
                onPress={() => {
                  setSelectedDateRange(option.range);
                  setShowDateRangePicker(false);
                  fetchPastCyclesData(option.startDate, option.endDate);
                }}
                style={({ pressed }) => [styles.dateOption, pressed && { backgroundColor: tw.gray100 }]}
              >
                <Text style={styles.dateOptionLabel}>{option.label}</Text>
                <Text style={styles.dateOptionRange}>{option.range}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </AnchoredMenu>

      <AnchoredMenu
        open={showDownloadMenu}
        onClose={() => setShowDownloadMenu(false)}
        anchorRef={downloadAnchor}
        align="right"
        minWidth={180}
        style={styles.downloadPanel}
      >
        <Pressable onPress={downloadPDF} style={({ pressed }) => [styles.downloadItem, pressed && { backgroundColor: tw.gray50 }]}>
          <View style={styles.pdfIcon}>
            <FileText size={16} color={tw.red600} />
          </View>
          <Text style={styles.downloadText}>Download PDF</Text>
        </Pressable>
      </AnchoredMenu>

      <CenterSheet open={showWithdrawalModal} onClose={() => setShowWithdrawalModal(false)} panelStyle={styles.modalPanel} contentStyle={{ padding: 24 }}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Withdraw Amount</Text>
          <Pressable
            onPress={closeWithdrawal}
            style={({ pressed }) => [styles.modalClose, pressed && { backgroundColor: tw.gray100 }]}
            accessibilityLabel="Close"
          >
            <X size={20} color={tw.gray600} />
          </Pressable>
        </View>
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.availableText}>
            Available Balance: <Text style={styles.availableValue}>₹{money2(available)}</Text>
          </Text>
          <Text style={styles.amountLabel}>Enter Amount to Withdraw</Text>
          <TextInput
            value={withdrawalAmount}
            onChangeText={setWithdrawalAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={tw.gray400}
            style={[styles.amountInput, inputFont]}
          />
          {withdrawalAmount && parsedAmount > available ? (
            <Text style={styles.amountError}>Amount cannot exceed available balance</Text>
          ) : null}
        </View>
        <View style={styles.modalActions}>
          <Pressable
            onPress={closeWithdrawal}
            style={({ pressed }) => [styles.cancelBtn, pressed && { backgroundColor: tw.gray50 }]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          {(() => {
            const disabled = submittingWithdrawal || !withdrawalAmount || !(parsedAmount > 0) || parsedAmount > available;
            return (
              <Pressable
                onPress={submitWithdrawal}
                disabled={disabled}
                style={[styles.submitBtn, { backgroundColor: disabled ? tw.gray300 : colors.primary }]}
              >
                {submittingWithdrawal ? <ActivityIndicator size={14} color="#ffffff" /> : null}
                <Text style={styles.submitText}>{submittingWithdrawal ? "Submitting..." : "Submit Request"}</Text>
              </Pressable>
            );
          })()}
        </View>
      </CenterSheet>
    </View>
  );
}

export default withProtected(HubFinanceScreen);

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
    justifyContent: "space-between",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flexShrink: 1, fontSize: 18, fontWeight: "700", color: tw.gray900 },
  subtitle: { fontSize: 12, color: tw.gray600, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
  iconBtn: { padding: 8, borderRadius: 9999 },
  tabs: { flexDirection: "row", gap: 8, paddingVertical: 12 },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 9999, alignItems: "center" },
  tabInactive: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: tw.gray300 },
  tabText: { fontSize: 14, fontWeight: "500" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900, marginBottom: 12 },
  card: { backgroundColor: "#ffffff", borderRadius: 8, padding: 16 },
  cardBorder: { borderWidth: 1, borderColor: tw.gray200 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: tw.gray900, marginBottom: 12 },
  loadingText: { paddingVertical: 32, textAlign: "center", color: tw.gray500, fontSize: 16 },
  payout: { fontSize: 36, fontWeight: "700", color: tw.gray900, marginBottom: 8 },
  orderCount: { fontSize: 14, color: tw.gray600, marginBottom: 16 },
  withdrawBtn: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  withdrawText: { fontWeight: "600", fontSize: 16 },
  smallState: { paddingVertical: 24, textAlign: "center", fontSize: 14, color: tw.gray500 },
  requestRow: { borderWidth: 1, borderColor: tw.gray200, borderRadius: 8, padding: 12 },
  requestInner: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  requestAmount: { fontSize: 14, fontWeight: "600", color: tw.gray900 },
  requestMeta: { fontSize: 12, color: tw.gray500, marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 12, fontWeight: "600" },
  viewAll: { textAlign: "center", fontSize: 14, fontWeight: "500", color: "#000000" },
  controls: { flexDirection: "row", gap: 8 },
  rangeBtn: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: tw.gray200,
  },
  rangeLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  rangeText: { fontSize: 14, fontWeight: "500", color: tw.gray900, flexShrink: 1 },
  reportBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reportText: { fontSize: 14, fontWeight: "500", color: "#ffffff" },
  pastLoading: { fontSize: 14, color: tw.gray600, textAlign: "center" },
  pastEmpty: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tw.gray300,
  },
  pastEmptyText: { fontSize: 14, color: tw.gray500, fontStyle: "italic", textAlign: "center" },
  noHistory: { backgroundColor: "#ffffff", borderRadius: 8, padding: 48, alignItems: "center", borderWidth: 1, borderColor: tw.gray200 },
  noHistoryTitle: { color: tw.gray400, marginBottom: 8, fontSize: 16, textAlign: "center" },
  noHistorySub: { fontSize: 12, color: tw.gray500, textAlign: "center" },
  slice: { backgroundColor: "#ffffff", paddingHorizontal: 16 },
  sliceBordered: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: tw.gray200 },
  sliceFirst: { borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingTop: 16 },
  sliceLast: { borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingBottom: 16 },
  orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderRowDivider: { borderBottomWidth: 1, borderBottomColor: tw.gray200, paddingBottom: 12 },
  orderId: { fontSize: 14, fontWeight: "600", color: tw.gray900, marginBottom: 4 },
  orderItems: { fontSize: 12, color: tw.gray600 },
  orderPayout: { fontSize: 14, fontWeight: "700", color: tw.gray900 },
  alignRight: { alignItems: "flex-end" },
  earningLabel: { fontSize: 12, color: tw.gray500 },
  summaryCell: { borderRadius: 6, backgroundColor: tw.gray50, padding: 12 },
  summaryLabel: { fontSize: 12, color: tw.gray600 },
  summaryValue: { fontSize: 16, fontWeight: "600", color: tw.gray900 },
  invoiceState: { fontSize: 14, color: tw.gray500 },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: tw.gray100,
    borderRadius: 6,
    padding: 12,
  },
  invoiceId: { fontSize: 14, fontWeight: "500", color: tw.gray900 },
  invoiceMeta: { fontSize: 12, color: tw.gray600, marginTop: 2 },
  invoiceAmount: { fontSize: 14, fontWeight: "600", color: tw.gray900 },
  datePanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tw.gray200,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  dateTitle: { fontSize: 14, fontWeight: "600", color: tw.gray900, marginBottom: 12 },
  dateOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  dateOptionLabel: { fontSize: 14, fontWeight: "500", color: tw.gray900 },
  dateOptionRange: { fontSize: 12, color: tw.gray500 },
  downloadPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tw.gray200,
    paddingVertical: 8,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  downloadItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  pdfIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: tw.red50, alignItems: "center", justifyContent: "center" },
  downloadText: { fontSize: 14, color: tw.gray700 },
  modalPanel: { borderRadius: 8, maxWidth: 448 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: tw.gray900 },
  modalClose: { padding: 4, borderRadius: 9999 },
  availableText: { fontSize: 14, color: tw.gray600, marginBottom: 8 },
  availableValue: { fontSize: 14, fontWeight: "600", color: tw.gray900 },
  amountLabel: { fontSize: 14, fontWeight: "500", color: tw.gray700, marginBottom: 8 },
  amountInput: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: tw.gray300,
    borderRadius: 8,
    fontSize: 16,
    color: tw.gray900,
  },
  amountError: { fontSize: 14, color: tw.red600, marginTop: 4 },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: tw.gray300, borderRadius: 8, alignItems: "center" },
  cancelText: { fontWeight: "500", color: tw.gray700, fontSize: 16 },
  submitBtn: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  submitText: { fontWeight: "500", color: "#ffffff", fontSize: 16 },
});
