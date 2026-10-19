// Port of pages/restaurant/Feedback.jsx (Feedback tab, ?tab=reviews|complaints).
// Reviews are built on the client from delivered orders (getOrders limit 1000, up to 50 pages);
// complaints come from getComplaints with a date preset / custom range and an issue-type filter.
// The refresh button (window.location.reload on web) refetches everything. As on web, the
// reviews search box and filter button have no effect (the reviews filter sheet is never rendered).
import dayjs from "dayjs";
import { router, useLocalSearchParams } from "expo-router";
import { Calendar, HelpCircle, RotateCcw, Search, SlidersHorizontal, Star, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { getComplaints, getCurrentRestaurant, getOrders } from "../../api";
import { CenterSheet } from "../../components/menu/common";
import { pal } from "../../components/menu/palette";
import DateRangeCalendar from "../../components/orders/DateRangeCalendar";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { AppImage, ScalePressable, Text } from "../../components/ui";
import { useScopedFont } from "../../components/ui/Text";
import { withProtected } from "../../navigation/Protected";
import { useTheme } from "../../theme/ThemeContext";

const tabs = [
  { id: "complaints", label: "Complaints" },
  { id: "reviews", label: "Reviews" },
];

const DATE_RANGES = ["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "last5days", "custom"];
const ISSUE_TYPES = ["Missing Item", "Wrong Item", "Quality Issue", "Delivery Delay", "Other"];

const normalizeOrderStatus = (order) => String(order?.status || order?.orderStatus || "").toLowerCase();

const normalizeRating = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return null;
  return Math.min(5, Math.round(parsed * 10) / 10);
};

const extractReviewRating = (order) =>
  normalizeRating(order?.review?.rating ?? order?.ratings?.restaurant?.rating ?? order?.feedback?.rating ?? order?.rating);

const extractReviewText = (order) => {
  const raw =
    order?.review?.comment ??
    order?.review?.text ??
    order?.ratings?.restaurant?.comment ??
    order?.feedback?.comment ??
    order?.feedback?.text ??
    "";
  const normalized = String(raw || "").trim();
  return normalized || "No review text";
};

const toComparableId = (value) => String(value?._id || value || "").trim();

const getDateRanges = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const last5DaysStart = new Date(today);
  last5DaysStart.setDate(last5DaysStart.getDate() - 4);
  const thisWeekStart = new Date(today);
  const day = today.getDay();
  thisWeekStart.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  lastWeekEnd.setHours(23, 59, 59, 999);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  lastMonthEnd.setHours(23, 59, 59, 999);
  return {
    today,
    yesterday,
    thisWeekStart,
    thisWeekEnd: new Date(),
    lastWeekStart,
    lastWeekEnd,
    thisMonthStart,
    thisMonthEnd: new Date(),
    lastMonthStart,
    lastMonthEnd,
    last5DaysStart,
    last5DaysEnd: new Date(),
  };
};

const rangeLabel = (range) =>
  range === "last5days"
    ? "Last 5 Days"
    : range
        .replace(/([A-Z])/g, " $1")
        .trim()
        .replace(/(^|\s)\S/g, (m) => m.toUpperCase());

function ComplaintCard({ complaint }) {
  const open = complaint.status === "open";
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={[styles.statusPill, { backgroundColor: open ? pal.orange100 : pal.green100 }]}>
          <Text style={[styles.statusText, { color: open ? pal.orange600 : pal.green600 }]}>
            {String(complaint.status || "open").toUpperCase()}
          </Text>
        </View>
        <Text style={styles.complaintDate}>{dayjs(complaint.createdAt).format("M/D/YYYY")}</Text>
      </View>
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{complaint.userId?.name?.[0] || "U"}</Text>
        </View>
        <View>
          <Text style={styles.userName}>{complaint.userId?.name || "Customer"}</Text>
          <Text style={styles.orderRef}>ORDER #{String(complaint.orderId?.orderId || "N/A").toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.quoteBox}>
        <Text style={styles.issueType}>{String(complaint.issueType || "").toUpperCase()}</Text>
        <Text style={styles.complaintText}>{complaint.description}</Text>
      </View>
      {complaint.adminResponse ? (
        <View style={styles.adminBox}>
          <Text style={styles.adminLabel}>ADMIN RESPONSE</Text>
          <Text style={styles.adminText}>{complaint.adminResponse}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ReviewCard({ review }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.reviewMeta}>ORDER #{String(review.orderNumber).toUpperCase()}</Text>
        <Text style={styles.reviewMeta}>{review.date.toUpperCase()}</Text>
      </View>
      <View style={styles.userRow}>
        <AppImage src={review.userImage} width={32} style={styles.reviewAvatar} placeholderType="shop" />
        <Text style={styles.userName}>{review.userName}</Text>
        <View style={styles.ratingChip}>
          <Text style={styles.ratingChipText}>{review.rating}</Text>
          <Star size={8} color="#ffffff" fill="#ffffff" />
        </View>
      </View>
      <View style={styles.quoteBox}>
        <Text style={styles.reviewText}>&quot;{review.reviewText}&quot;</Text>
      </View>
    </View>
  );
}

function FeedbackScreen() {
  const { colors } = useTheme();
  const bottomInset = useShellBottomInset();
  const inputFont = useScopedFont("400");
  const { tab: tabFromUrl } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(tabFromUrl === "complaints" ? "complaints" : "reviews");
  const [reloadKey, setReloadKey] = useState(0);
  const reloadRef = useRef(0);

  useEffect(() => {
    setActiveTab(tabFromUrl === "complaints" ? "complaints" : "reviews");
  }, [tabFromUrl]);

  const [reviews, setReviews] = useState([]);
  const [filterValues] = useState({ duration: null, sortBy: "newest", reviewType: [] });
  const [complaintsFilterValues, setComplaintsFilterValues] = useState({ issueType: [], reasons: [] });
  const [isComplaintsFilterOpen, setIsComplaintsFilterOpen] = useState(false);
  const [complaintsSearchQuery, setComplaintsSearchQuery] = useState("");
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("last5days");
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const [isComplaintsLoading, setIsComplaintsLoading] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [restaurantData, setRestaurantData] = useState(null);
  const [isLoadingRestaurant, setIsLoadingRestaurant] = useState(true);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const flashLoading = useCallback(() => {
    setIsComplaintsLoading(true);
    timers.current.push(setTimeout(() => setIsComplaintsLoading(false), 200));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setIsLoadingRestaurant(true);
        const response = await getCurrentRestaurant(reloadKey ? { noCache: true } : {});
        if (alive && response?.success && response.data?.restaurant) setRestaurantData(response.data.restaurant);
      } catch {
        // header keeps "Restaurant"
      } finally {
        if (alive) setIsLoadingRestaurant(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (activeTab !== "complaints") return undefined;
    let alive = true;
    (async () => {
      try {
        setIsComplaintsLoading(true);
        const dateRanges = getDateRanges();
        let fromDate = null;
        let toDate = null;
        switch (selectedDateRange) {
          case "today":
            fromDate = dateRanges.today;
            toDate = new Date();
            break;
          case "yesterday":
            fromDate = dateRanges.yesterday;
            toDate = new Date(dateRanges.yesterday);
            toDate.setHours(23, 59, 59, 999);
            break;
          case "thisWeek":
            fromDate = dateRanges.thisWeekStart;
            toDate = dateRanges.thisWeekEnd;
            break;
          case "lastWeek":
            fromDate = dateRanges.lastWeekStart;
            toDate = dateRanges.lastWeekEnd;
            break;
          case "thisMonth":
            fromDate = dateRanges.thisMonthStart;
            toDate = dateRanges.thisMonthEnd;
            break;
          case "lastMonth":
            fromDate = dateRanges.lastMonthStart;
            toDate = dateRanges.lastMonthEnd;
            break;
          case "last5days":
            fromDate = dateRanges.last5DaysStart;
            toDate = dateRanges.last5DaysEnd;
            break;
          case "custom":
            if (customDateRange.start && customDateRange.end) {
              fromDate = customDateRange.start;
              toDate = customDateRange.end;
            }
            break;
          default:
            break;
        }
        const params = {};
        if (fromDate) params.fromDate = fromDate.toISOString();
        if (toDate) params.toDate = toDate.toISOString();
        if (complaintsFilterValues.issueType?.length > 0) params.complaintType = complaintsFilterValues.issueType[0];
        if (complaintsSearchQuery) params.search = complaintsSearchQuery;
        const response = await getComplaints(params);
        if (!alive) return;
        setComplaints(response?.success && response.data?.complaints ? response.data.complaints : []);
      } catch {
        if (alive) setComplaints([]);
      } finally {
        if (alive) setIsComplaintsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeTab, selectedDateRange, customDateRange, complaintsFilterValues, complaintsSearchQuery, reloadKey]);

  useEffect(() => {
    if (isLoadingRestaurant) return undefined;
    let alive = true;
    (async () => {
      let allOrders = [];
      let page = 1;
      let hasMore = true;
      const limit = 1000;
      const maxPages = 50;
      while (hasMore && page <= maxPages && alive) {
        try {
          const response = await getOrders({ page, limit, status: "delivered" }, { force: reloadRef.current > 0 });
          if (response?.success && response.data?.orders) {
            const orders = response.data.orders;
            allOrders = [...allOrders, ...orders];
            const totalPages = response.data.meta?.totalPages || 1;
            if (orders.length < limit || (totalPages > 0 && page >= totalPages)) hasMore = false;
            else page += 1;
          } else {
            hasMore = false;
          }
        } catch {
          hasMore = false;
        }
      }
      if (!alive) return;
      const transformed = allOrders
        .filter((order) => normalizeOrderStatus(order) === "delivered")
        .map((order, index) => {
          const orderDate = new Date(order.createdAt || order.deliveredAt || Date.now());
          const formattedDate = `${orderDate.getDate()} ${dayjs(orderDate).format("MMM")}, ${orderDate.getFullYear()}`;
          const userName = order.userId?.name || order.customerName || "Customer";
          const userImage =
            order.userId?.profileImage ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`;
          const outlet = order.restaurantName || restaurantData?.name || "Restaurant";
          const userOrdersCount = allOrders.filter((o) => toComparableId(o.userId) === toComparableId(order.userId)).length;
          return {
            id: order._id || order.orderId || `review-${index}`,
            orderNumber: order.orderId || order.orderNumber || String(index),
            outlet,
            userName,
            userImage,
            ordersCount: userOrdersCount,
            rating: extractReviewRating(order),
            date: formattedDate,
            dayTime: new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate()).getTime(),
            reviewText: extractReviewText(order),
          };
        })
        .filter((review) => review.rating !== null || (review.reviewText && review.reviewText !== "No review text"));
      setReviews(transformed);
    })();
    return () => {
      alive = false;
    };
  }, [isLoadingRestaurant, restaurantData]);

  const displayedReviews = useMemo(() => {
    const filtered = [...reviews];
    if (filterValues.sortBy) {
      // The web sorts by new Date(review.date) ("19 Oct, 2026"), i.e. by calendar day.
      filtered.sort((a, b) => {
        if (filterValues.sortBy === "newest") return b.dayTime - a.dayTime;
        if (filterValues.sortBy === "oldest") return a.dayTime - b.dayTime;
        if (filterValues.sortBy === "bestRated") return (b.rating ?? 0) - (a.rating ?? 0);
        if (filterValues.sortBy === "worstRated") return (a.rating ?? 0) - (b.rating ?? 0);
        return 0;
      });
    }
    return filtered;
  }, [reviews, filterValues]);

  const handleDateRangeSelect = (range) => {
    setSelectedDateRange(range);
    if (range === "custom") setIsCustomDateOpen(true);
    else {
      setIsDateSelectorOpen(false);
      flashLoading();
    }
  };

  const handleCustomDateApply = () => {
    setIsCustomDateOpen(false);
    setIsDateSelectorOpen(false);
    flashLoading();
  };

  const handleComplaintsFilterApply = () => {
    setIsComplaintsFilterOpen(false);
    flashLoading();
  };

  const handleComplaintsFilterReset = () => {
    setComplaintsFilterValues({ issueType: [], reasons: [] });
    setComplaintsSearchQuery("");
    flashLoading();
  };

  // Horizontal swipe switches tabs (left -> reviews, right -> complaints).
  const touch = useRef({ x: 0, y: 0, endX: 0, swiping: false });
  const onTouchStart = (e) => {
    touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, endX: e.nativeEvent.pageX, swiping: false };
  };
  const onTouchMove = (e) => {
    const dx = Math.abs(e.nativeEvent.pageX - touch.current.x);
    const dy = Math.abs(e.nativeEvent.pageY - touch.current.y);
    if (dx > dy && dx > 10) touch.current.swiping = true;
    if (touch.current.swiping) touch.current.endX = e.nativeEvent.pageX;
  };
  const onTouchEnd = () => {
    if (!touch.current.swiping) return;
    const distance = touch.current.x - touch.current.endX;
    if (Math.abs(distance) > 50) setActiveTab(distance > 0 ? "reviews" : "complaints");
  };

  const isComplaints = activeTab === "complaints";

  const listHeader = isComplaints ? (
    <View style={styles.controlsRow}>
      <Pressable onPress={() => setIsDateSelectorOpen(true)} style={[styles.controlBox, styles.dateBtn]}>
        <View>
          <Text style={styles.dateValue}>{selectedDateRange}</Text>
          <Text style={styles.dateHint}>Select date range</Text>
        </View>
        <Calendar size={16} color={pal.gray400} />
      </Pressable>
      <Pressable onPress={() => setIsComplaintsFilterOpen(true)} style={styles.controlBox}>
        <SlidersHorizontal size={16} color={pal.gray900} />
      </Pressable>
    </View>
  ) : (
    <View style={styles.controlsRow}>
      <View style={[styles.controlBox, styles.searchBox]}>
        <Search size={16} color={pal.gray400} />
        <TextInput
          placeholder="Search reviews"
          placeholderTextColor={pal.gray400}
          style={[styles.searchInput, inputFont]}
        />
      </View>
      <Pressable style={styles.controlBox}>
        <SlidersHorizontal size={16} color={pal.gray900} />
      </Pressable>
    </View>
  );

  let data = [];
  let empty = null;
  if (isComplaints) {
    if (isComplaintsLoading) {
      empty = (
        <View style={styles.loader}>
          <ActivityIndicator color={pal.gray400} />
        </View>
      );
    } else if (complaints.length === 0) {
      empty = (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No complaints found</Text>
        </View>
      );
    } else {
      data = complaints;
    }
  } else {
    data = displayedReviews;
  }

  return (
    <View style={styles.page} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.showing}>SHOWING DATA FOR</Text>
            <Text style={styles.restaurantName}>{restaurantData?.name || "Restaurant"}</Text>
          </View>
          <View style={styles.headerActions}>
            <ScalePressable
              scaleTo={0.95}
              onPress={() => {
                reloadRef.current += 1;
                setReloadKey((k) => k + 1);
              }}
              style={styles.headerBtn}
              accessibilityLabel="Refresh"
            >
              <RotateCcw size={20} color={pal.gray700} />
            </ScalePressable>
            <ScalePressable
              scaleTo={0.95}
              onPress={() => router.push("/help-centre/support")}
              style={styles.headerBtn}
              accessibilityLabel="Open support"
            >
              <HelpCircle size={20} color={pal.gray700} />
            </ScalePressable>
          </View>
        </View>
        <View style={styles.tabs}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tab, active ? { backgroundColor: colors.primary } : styles.tabInactive]}
              >
                <Text style={[styles.tabText, { color: active ? "#ffffff" : pal.gray600 }]}>{tab.label}</Text>
                {tab.id === "complaints" && complaints.length > 0 && !isComplaints ? <View style={styles.tabDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        key={activeTab}
        data={data}
        keyExtractor={(item, index) => String(item._id || item.id || index)}
        renderItem={({ item }) => (isComplaints ? <ComplaintCard complaint={item} /> : <ReviewCard review={item} />)}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={listHeader}
        ListHeaderComponentStyle={{ marginBottom: 16 }}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.content, { paddingBottom: (data.length ? 80 : 0) + 16 + bottomInset }]}
      />

      <CenterSheet open={isDateSelectorOpen} onClose={() => setIsDateSelectorOpen(false)} contentStyle={styles.sheetBody}>
        <View style={styles.sheetHandleWrap}>
          <View style={styles.sheetHandle} />
        </View>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Select Date Range</Text>
          <Pressable onPress={() => setIsDateSelectorOpen(false)} hitSlop={8}>
            <X size={20} color={pal.gray900} />
          </Pressable>
        </View>
        <View style={styles.rangeGrid}>
          {DATE_RANGES.map((range) => {
            const active = selectedDateRange === range;
            return (
              <Pressable
                key={range}
                onPress={() => handleDateRangeSelect(range)}
                style={[
                  styles.rangeBtn,
                  active
                    ? { borderColor: colors.primary, backgroundColor: colors.primary }
                    : { borderColor: pal.gray100, backgroundColor: "#ffffff" },
                ]}
              >
                <Text style={[styles.rangeText, { color: active ? "#ffffff" : pal.gray600 }]}>{rangeLabel(range)}</Text>
              </Pressable>
            );
          })}
        </View>
      </CenterSheet>

      <CenterSheet
        open={isCustomDateOpen}
        onClose={() => setIsCustomDateOpen(false)}
        panelStyle={styles.customPanel}
        contentStyle={styles.customBody}
      >
        <DateRangeCalendar
          startDate={customDateRange.start}
          endDate={customDateRange.end}
          onDateRangeChange={(start, end) => setCustomDateRange({ start, end })}
          onClose={() => setIsCustomDateOpen(false)}
        />
        <ScalePressable
          scaleTo={0.98}
          onPress={handleCustomDateApply}
          style={[styles.applyCustomBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.applyCustomText}>Apply Custom Range</Text>
        </ScalePressable>
      </CenterSheet>

      <CenterSheet
        open={isComplaintsFilterOpen}
        onClose={() => setIsComplaintsFilterOpen(false)}
        maxHeight="80%"
        backdrop="rgba(0,0,0,0.4)"
        panelStyle={{ borderRadius: 32 }}
        contentStyle={styles.filterBody}
        footer={
          <View style={styles.filterFooter}>
            <Pressable onPress={handleComplaintsFilterReset} style={styles.resetBtn}>
              {({ pressed }) => <Text style={[styles.resetText, pressed && { color: pal.slate900 }]}>Reset</Text>}
            </Pressable>
            <ScalePressable scaleTo={0.98} onPress={handleComplaintsFilterApply} style={styles.applyFiltersBtn}>
              <Text style={styles.applyFiltersText}>Apply Filters</Text>
            </ScalePressable>
          </View>
        }
        header={
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filters</Text>
            <Pressable
              onPress={() => setIsComplaintsFilterOpen(false)}
              style={({ pressed }) => [styles.filterClose, pressed && { backgroundColor: pal.slate50 }]}
            >
              <X size={20} color={pal.slate400} />
            </Pressable>
          </View>
        }
      >
        <Text style={styles.filterSection}>ISSUE TYPE</Text>
        <View style={styles.chips}>
          {ISSUE_TYPES.map((type) => {
            const active = complaintsFilterValues.issueType?.includes(type);
            return (
              <Pressable
                key={type}
                onPress={() => {
                  const current = complaintsFilterValues.issueType || [];
                  setComplaintsFilterValues({ ...complaintsFilterValues, issueType: current.includes(type) ? [] : [type] });
                }}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
              >
                <Text style={[styles.chipText, { color: active ? "#ffffff" : pal.slate600 }]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>
      </CenterSheet>
    </View>
  );
}

function Gap() {
  return <View style={{ height: 16 }} />;
}

export default withProtected(FeedbackScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: pal.gray100 },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: pal.gray200,
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  showing: { fontSize: 10, letterSpacing: 0.5, color: pal.gray500 },
  restaurantName: { fontSize: 16, fontWeight: "700", color: pal.gray900 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtn: { padding: 4, borderRadius: 9999 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 16 },
  tab: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 9999 },
  tabInactive: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: pal.gray200 },
  tabText: { fontSize: 14, fontWeight: "700" },
  tabDot: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 9999,
    backgroundColor: pal.red500,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  content: { padding: 16 },
  controlsRow: { flexDirection: "row", gap: 8 },
  controlBox: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pal.gray200,
    justifyContent: "center",
  },
  dateBtn: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateValue: { fontSize: 12, fontWeight: "700", color: pal.gray900 },
  dateHint: { fontSize: 10, color: pal.gray500 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 0 },
  searchInput: { flex: 1, fontSize: 14, color: pal.gray900, paddingVertical: 12 },
  loader: { alignItems: "center", padding: 40 },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 80,
    backgroundColor: pal.gray50,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: pal.gray200,
  },
  emptyText: { fontSize: 14, color: pal.gray500, fontWeight: "500" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: pal.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
    gap: 12,
  },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: -0.45 },
  complaintDate: { fontSize: 10, color: pal.gray400, fontWeight: "700" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 9999, backgroundColor: pal.gray100, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "700", color: pal.gray400 },
  userName: { fontWeight: "700", color: pal.gray900, fontSize: 14 },
  orderRef: { fontSize: 10, color: pal.gray500, fontWeight: "700" },
  quoteBox: { backgroundColor: pal.gray50, borderRadius: 12, padding: 12 },
  issueType: { fontSize: 10, fontWeight: "900", color: pal.red500, marginBottom: 4 },
  complaintText: { fontSize: 14, color: pal.gray800, fontWeight: "600", lineHeight: 22.75 },
  adminBox: { backgroundColor: pal.blue50, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: pal.blue100 },
  adminLabel: { fontSize: 9, fontWeight: "900", color: pal.blue600, marginBottom: 4 },
  adminText: { fontSize: 14, color: pal.blue900, fontWeight: "500" },
  reviewMeta: { fontSize: 10, color: pal.gray400, fontWeight: "700" },
  reviewAvatar: { width: 32, height: 32, borderRadius: 9999, borderWidth: 1, borderColor: pal.gray100 },
  ratingChip: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: pal.green600,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingChipText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  reviewText: { fontSize: 14, color: pal.gray800, fontWeight: "500", fontStyle: "italic" },
  sheetBody: { padding: 16 },
  sheetHandleWrap: { alignItems: "center", marginBottom: 16 },
  sheetHandle: { height: 4, width: 40, borderRadius: 9999, backgroundColor: pal.gray300 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: pal.gray900 },
  rangeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  rangeBtn: { flexBasis: "45%", flexGrow: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, alignItems: "center" },
  rangeText: { fontSize: 14, fontWeight: "700" },
  customPanel: { maxWidth: 384 },
  customBody: { padding: 24, alignItems: "center" },
  applyCustomBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
    boxShadow: "0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)",
  },
  applyCustomText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    marginBottom: 24,
  },
  filterTitle: { fontSize: 20, fontWeight: "700", color: pal.slate900 },
  filterClose: { padding: 8, borderRadius: 9999 },
  filterBody: { paddingHorizontal: 24, marginBottom: 24 },
  filterSection: { fontSize: 12, fontWeight: "700", color: pal.slate400, letterSpacing: 1.2, marginBottom: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  chipActive: { backgroundColor: pal.slate900, boxShadow: "0px 10px 15px -3px #e2e8f0" },
  chipInactive: { backgroundColor: pal.slate50 },
  chipText: { fontSize: 14, fontWeight: "700" },
  filterFooter: { flexDirection: "row", gap: 12, paddingHorizontal: 24, paddingBottom: 24 },
  resetBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  resetText: { fontWeight: "700", color: pal.slate400, fontSize: 16 },
  applyFiltersBtn: {
    flex: 2,
    backgroundColor: pal.slate900,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    boxShadow: "0px 20px 25px -5px #e2e8f0",
  },
  applyFiltersText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
});
