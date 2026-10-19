// Port of pages/restaurant/AllOrdersPage.jsx ("/orders/all", Order History): every order the
// backend returns (one request, filtered by date range on the client), search by order ID, the
// status filter (the Ratings and Complaints filters can be picked but, as on web, are not applied),
// date-range presets and a custom range calendar. New orders from the socket are added to the top.
// On phone the web opened OrderDetails as a full-screen overlay; here it is pushed as /orders/:id.
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ArrowLeft, Calendar, Check, ChevronDown, ChevronRight, Copy, Filter, HelpCircle, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCurrentRestaurant, getOrders } from "../../api";
import DateRangeCalendar from "../../components/orders/DateRangeCalendar";
import InlineToast from "../../components/orders/InlineToast";
import { fmtDayMonthGB, fmtMonthDay, fmtTime, pal } from "../../components/orders/ordersUtils";
import { useShellBottomInset } from "../../components/shell";
import Text, { useScopedFont } from "../../components/ui/Text";
import { useRestaurantNotifications } from "../../context/RestaurantNotificationsContext";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const getCurrentWeek = () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() + 1); // Monday
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};
const getLastWeek = () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - 6);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};
const getLast2Days = () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 2);
  return { start, end: today };
};
const getLast30Days = () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 30);
  return { start, end: today };
};

const DATE_RANGE_OPTIONS = [
  { label: "last 2 days", getDates: getLast2Days },
  { label: "this week", getDates: getCurrentWeek },
  { label: "last week", getDates: getLastWeek },
  { label: "last 30 days", getDates: getLast30Days },
  { label: "custom date range", custom: true },
];

const FILTER_CATEGORIES = [
  { id: "Order status", label: "Order status" },
  { id: "Ratings", label: "Ratings" },
  { id: "Complaints", label: "Complaints" },
];

const FILTER_OPTIONS = {
  "Order status": [
    { id: "preparing", label: "Preparing", key: "orderStatus" },
    { id: "ready", label: "Ready", key: "orderStatus" },
    { id: "out-for-delivery", label: "Out for delivery", key: "orderStatus" },
    { id: "delivered", label: "Delivered", key: "orderStatus" },
    { id: "rejected", label: "Rejected", key: "orderStatus" },
    { id: "cancelled", label: "Cancelled", key: "orderStatus" },
  ],
  Ratings: [
    { id: "5-star", label: "5★ or less", key: "ratings", value: 5 },
    { id: "4-star", label: "4★ or less", key: "ratings", value: 4 },
    { id: "3-star", label: "3★ or less", key: "ratings", value: 3 },
    { id: "2-star", label: "2★ or less", key: "ratings", value: 2 },
    { id: "1-star", label: "1★", key: "ratings", value: 1 },
  ],
  Complaints: [
    { id: "order-delayed", label: "Order delayed", key: "complaints" },
    { id: "wrong-items", label: "Wrong item(s) delivered", key: "complaints" },
    { id: "missing-items", label: "Item(s) missing or not delivered", key: "complaints" },
    { id: "poor-taste", label: "Poor taste or quality", key: "complaints" },
    { id: "poor-packaging", label: "Poor packaging or spillage", key: "complaints" },
    { id: "out-of-stock", label: "Item(s) out of stock", key: "complaints" },
    { id: "not-delivered", label: "Order not delivered", key: "complaints" },
  ],
};

const STATUS_MAP = {
  preparing: "PREPARING",
  ready: "READY",
  "out-for-delivery": "OUT FOR DELIVERY",
  delivered: "DELIVERED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
};

const STATUS_BG = {
  REJECTED: tw.red700,
  CANCELLED: tw.red700,
  DELIVERED: pal.green600,
  PREPARING: pal.yellow600,
  READY: tw.blue600,
  "OUT FOR DELIVERY": pal.purple600,
};

const EMPTY_FILTERS = { orderStatus: [], ratings: [], complaints: [] };

// AllOrdersPage transformOrder
function transformOrder(order, restaurantData) {
  const addr = order.deliveryAddress || order.address || null;
  const address =
    addr?.formattedAddress ||
    addr?.address ||
    (addr?.street ? `${addr.street}, ${addr.city || ""}`.trim() : "") ||
    "Address not available";
  const restaurantName = restaurantData?.name || order.restaurantId?.name || "Restaurant";
  const customerName = order.userId?.name || order.customerName || "Customer";
  const items = (order.items || []).map((item) => ({
    name: item.name || "Item",
    quantity: item.quantity || 1,
    price: item.price || 0,
  }));

  let status = String(order.orderStatus || order.status || "created").toUpperCase();
  if (status === "OUT_FOR_DELIVERY" || status === "OUT FOR DELIVERY") status = "OUT FOR DELIVERY";

  let reason = null;
  if (status === "REJECTED" && order.rejectionReason) reason = `Rejected by Restaurant: ${order.rejectionReason}`;
  else if (status === "CANCELLED" && order.cancellationReason) {
    reason = `Cancelled by ${order.cancelledBy === "customer" ? "customer" : "restaurant"}: ${order.cancellationReason}`;
  } else if (status === "REJECTED") reason = "Rejected by Restaurant";
  else if (status === "CANCELLED") reason = "Cancelled by customer";

  const tags = [];
  if (order.scheduledAt) tags.push("SCHEDULED");
  if (order.sendCutlery) tags.push("CUTLERY");
  tags.push("HOME DELIVERY");
  const allVeg = items.every((item) => item.isVeg !== false);
  if (allVeg && items.length > 0) tags.push("VEG ONLY");

  let restaurantPayout = 0;
  if (order.pricing) {
    const p = order.pricing;
    const itemSubtotal = p.subtotal || p.itemsTotal || p.itemSubtotal || 0;
    restaurantPayout = Math.max(
      0,
      itemSubtotal +
        (p.packagingFee || 0) -
        (p.restaurantCommission || 0) -
        (p.gstOnItem || 0) -
        (p.gstOnCommission || 0) -
        (p.paymentGatewayFee || 0) -
        (p.tcs || 0),
    );
  }

  return {
    id: order.order_id || order.orderId || order._id?.toString() || "",
    status,
    date: fmtDayMonthGB(order.createdAt),
    time: fmtTime(order.createdAt),
    restaurant: restaurantName,
    address,
    customer: customerName,
    items,
    totalPrice: restaurantPayout || order.pricing?.total || 0,
    reason,
    tags: tags.length > 0 ? tags : undefined,
    createdAt: order.createdAt,
    mongoId: order._id?.toString(),
  };
}

function inRange(createdAt, startDate, endDate) {
  if (!createdAt) return false;
  const d = new Date(createdAt);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

// restaurant-modal-sheet / restaurant-modal-inline: centred, content-sized panels at phone width.
function CenterModal({ visible, onClose, children, panelStyle }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom }]}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
        <View style={panelStyle}>{children}</View>
      </View>
    </Modal>
  );
}

function Spinner({ size = 32, color }) {
  return <ActivityIndicator size={size} color={color} />;
}

function OrderRow({ order, onPress, onCopy }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
        ],
      }}
    >
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <View style={styles.cardTop}>
          <View style={styles.tags}>
            <View style={[styles.tag, { backgroundColor: STATUS_BG[order.status] || tw.gray600 }]}>
              <Text style={styles.tagText}>{order.status}</Text>
            </View>
            {order.tags?.map((tag, i) => (
              <View key={i} style={[styles.tag, { backgroundColor: pal.green600 }]}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <View style={styles.when}>
            <Text style={styles.whenText}>
              {order.date}, {order.time}
            </Text>
            <ChevronRight size={16} color={tw.gray400} />
          </View>
        </View>

        <View style={styles.idRow}>
          <Text style={styles.idText}>ID: {order.id}</Text>
          <Pressable onPress={onCopy} hitSlop={6} style={styles.copyBtn} accessibilityLabel="Copy order ID">
            <Copy size={16} color={tw.gray500} />
          </Pressable>
        </View>

        <Text style={styles.restaurantText}>
          {order.restaurant}, {order.address}
        </Text>
        <Text style={styles.customerText}>Ordered by {order.customer}</Text>

        <View style={styles.dashed} />

        <View style={{ gap: 8 }}>
          {order.items.slice(0, 2).map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {item.quantity} x {item.name}
              </Text>
              <Text style={styles.itemPrice}>{formatMoney(item.price)}</Text>
            </View>
          ))}
          {order.items.length > 2 ? <Text style={styles.moreItems}>+{order.items.length - 2} more items</Text> : null}
        </View>

        <View style={styles.payoutRow}>
          <Text style={styles.payoutLabel}>NET PAYOUT</Text>
          <Text style={styles.payoutValue}>{formatMoney(order.totalPrice)}</Text>
        </View>

        {order.reason ? (
          <View style={styles.reasonRow}>
            <Text style={styles.reasonText}>{order.reason}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export default function AllOrdersScreen() {
  const goBack = useAppBack();
  const { colors } = useTheme();
  const bottomInset = useShellBottomInset();
  const inputFont = useScopedFont("400");
  const { newOrder } = useRestaurantNotifications();

  const [searchQuery, setSearchQuery] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDateRangePopup, setShowDateRangePopup] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState(DATE_RANGE_OPTIONS[1]);
  const [{ startDate, endDate }, setRange] = useState(() => {
    const w = getCurrentWeek();
    return { startDate: w.start, endDate: w.end };
  });

  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [activeFilterCategory, setActiveFilterCategory] = useState("Order status");
  const [filterSearch, setFilterSearch] = useState("");
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef(null);
  const applyTimer = useRef(null);

  const [rawOrders, setRawOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restaurantData, setRestaurantData] = useState(null);

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(applyTimer.current);
    },
    [],
  );

  useEffect(() => {
    getCurrentRestaurant()
      .then((res) => {
        const data = res?.data?.restaurant;
        if (data) setRestaurantData(data);
      })
      .catch(() => {});
  }, []);

  // Web refetched when the transform changed (restaurant loaded); here the transform is applied
  // on render so the orders are fetched once per date range.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getOrders({ page: 1, limit: 1000 }, { force: true });
        if (!alive) return;
        if (res?.success && res.data?.orders) {
          setRawOrders(res.data.orders.filter((o) => inRange(o.createdAt, startDate, endDate)));
        } else {
          setRawOrders([]);
        }
      } catch (err) {
        if (!alive) return;
        if (err?.status !== 401) setError(err?.message || "Failed to fetch orders");
        setRawOrders([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  // Realtime: prepend the new order if it is not listed yet.
  useEffect(() => {
    if (!newOrder) return;
    setRawOrders((prev) => {
      const id = String(newOrder?.orderId || newOrder?._id || "");
      if (!id) return prev;
      const exists = prev.some((o) => {
        const t = transformOrder(o, null);
        return String(t.id) === id || String(t.mongoId) === String(newOrder?._id);
      });
      return exists ? prev : [newOrder, ...prev];
    });
  }, [newOrder]);

  const orders = useMemo(() => rawOrders.map((o) => transformOrder(o, restaurantData)), [rawOrders, restaurantData]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase().trim();
          const numericPart = order.id.replace(/\D/g, "");
          if (!order.id.toLowerCase().includes(q) && !numericPart.includes(q)) return false;
        }
        if (filters.orderStatus.length > 0) {
          if (!filters.orderStatus.some((s) => STATUS_MAP[s] === order.status)) return false;
        }
        return true;
      }),
    [orders, searchQuery, filters],
  );

  const handleDateRangeChange = (start, end) => {
    setRange({ startDate: start, endDate: end });
    setSelectedDateRange({ label: "custom date range", start, end, custom: true });
    setShowCalendar(false);
  };

  const handleDateRangeSelect = (option) => {
    if (option.custom) {
      setShowDateRangePopup(false);
      setShowCalendar(true);
    } else {
      const dates = option.getDates();
      setSelectedDateRange(option);
      setRange({ startDate: dates.start, endDate: dates.end });
      setShowDateRangePopup(false);
    }
  };

  const formatDateRange = () => {
    if (!startDate || !endDate) return "Select date range";
    const month = fmtMonthDay(startDate).split(" ")[0];
    const year = startDate.getFullYear().toString().slice(-2);
    return `${startDate.getDate()} - ${endDate.getDate()} ${month}'${year}`;
  };

  const handleCopyOrderId = useCallback(async (orderId) => {
    try {
      await Clipboard.setStringAsync(orderId);
    } catch {
      // ignore
    }
    setShowToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), 2000);
  }, []);

  const handleFilterToggle = (option) => {
    const { key, id } = option;
    if (key === "ratings") {
      setFilters((prev) => ({ ...prev, [key]: prev[key].includes(id) ? [] : [id] }));
    } else {
      setFilters((prev) => ({
        ...prev,
        [key]: prev[key].includes(id) ? prev[key].filter((v) => v !== id) : [...prev[key], id],
      }));
    }
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setFilterSearch("");
  };

  const handleApplyFilters = () => {
    setIsApplyingFilters(true);
    applyTimer.current = setTimeout(() => {
      setIsApplyingFilters(false);
      setShowFilterPopup(false);
    }, 800);
  };

  const activeFilterCount = Object.values(filters).flat().length;
  const hasActiveFilters = activeFilterCount > 0;

  const openOrder = (order) =>
    router.push({ pathname: "/orders/[id]", params: { id: order.id, ...(order.mongoId ? { mongoId: order.mongoId } : {}) } });

  const listHeader = (
    <View>
      <View style={styles.controls}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={20} color={tw.gray400} style={styles.searchIcon} />
            <TextInput
              placeholder="Search by order ID"
              placeholderTextColor={tw.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, inputFont]}
              selectionColor={colors.primary}
            />
          </View>
          <Pressable
            onPress={() => setShowFilterPopup(true)}
            style={[styles.filterBtn, hasActiveFilters ? styles.filterBtnActive : null]}
            accessibilityLabel="Filter"
          >
            <Filter size={20} color={hasActiveFilters ? tw.blue600 : tw.gray900} />
            {hasActiveFilters ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Pressable
          onPress={() => setShowDateRangePopup(true)}
          style={({ pressed }) => [styles.dateBtn, pressed && { backgroundColor: tw.gray50 }]}
        >
          <View>
            <Text style={styles.dateLabel}>{selectedDateRange.label}</Text>
            <Text style={styles.dateRange}>{formatDateRange()}</Text>
          </View>
          <View style={styles.dateIcons}>
            <Calendar size={16} color={tw.gray400} />
            <ChevronDown size={16} color={tw.gray400} />
          </View>
        </Pressable>
      </View>

      {hasActiveFilters ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={styles.activeSummary}>
            <View style={styles.activeSummaryLeft}>
              <Filter size={16} color={tw.blue600} />
              <Text style={styles.activeSummaryText}>
                <Text style={[styles.activeSummaryText, { fontWeight: "600" }]}>{activeFilterCount}</Text> filter
                {activeFilterCount !== 1 ? "s" : ""} applied
              </Text>
            </View>
            <Pressable onPress={handleClearFilters} hitSlop={6}>
              <Text style={styles.clearAll}>Clear all</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );

  const listEmpty = loading ? (
    <View style={styles.stateBox}>
      <Spinner color={tw.blue600} />
      <Text style={styles.stateText}>Loading orders...</Text>
    </View>
  ) : error ? (
    <View style={styles.stateBox}>
      <Text style={styles.errorTitle}>Error loading orders</Text>
      <Text style={styles.stateSub}>{error}</Text>
    </View>
  ) : (
    <View style={styles.stateBox}>
      <Text style={styles.emptyTitle}>No orders found</Text>
      <Text style={styles.stateSub}>Try changing the date range or search filters.</Text>
    </View>
  );

  const windowH = Dimensions.get("window").height;
  const filterOptions = (FILTER_OPTIONS[activeFilterCategory] || []).filter((o) =>
    o.label.toLowerCase().includes(filterSearch.toLowerCase()),
  );

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.iconBtn} hitSlop={4} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={tw.gray900} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Order History</Text>
          <Text style={styles.headerSub}>
            {filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"} found
          </Text>
        </View>
        <Pressable onPress={() => router.push("/help-centre/support")} style={styles.helpBtn} accessibilityLabel="Help">
          <HelpCircle size={20} color={tw.gray900} />
        </Pressable>
      </View>

      <FlatList
        data={loading || error ? [] : filteredOrders}
        keyExtractor={(o, i) => o.id || o.mongoId || String(i)}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <OrderRow order={item} onPress={() => openOrder(item)} onCopy={() => handleCopyOrderId(item.id)} />
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<View style={{ paddingHorizontal: 16 }}>{listEmpty}</View>}
        contentContainerStyle={{ paddingBottom: 96 + bottomInset }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
      />

      {/* Date range popup */}
      <CenterModal visible={showDateRangePopup} onClose={() => setShowDateRangePopup(false)} panelStyle={styles.sheetPanel}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Select date range</Text>
          <Pressable onPress={() => setShowDateRangePopup(false)} style={styles.iconBtn} accessibilityLabel="Close">
            <X size={20} color={tw.gray900} />
          </Pressable>
        </View>
        <View style={styles.rangeList}>
          {DATE_RANGE_OPTIONS.map((option) => {
            const isSelected = selectedDateRange?.label?.toLowerCase() === option.label.toLowerCase();
            let sub = null;
            if (!option.custom) {
              const dates = option.getDates();
              sub = `${fmtMonthDay(dates.start)} - ${fmtMonthDay(dates.end)}`;
            }
            return (
              <Pressable
                key={option.label}
                onPress={() => handleDateRangeSelect(option)}
                style={({ pressed }) => [
                  styles.rangeOption,
                  isSelected ? styles.rangeOptionSelected : pressed && { backgroundColor: tw.gray50 },
                ]}
              >
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.rangeOptionLabel}>{option.label}</Text>
                  {sub ? <Text style={styles.dateRange}>{sub}</Text> : null}
                </View>
                {isSelected ? <Text style={styles.selectedText}>Selected</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </CenterModal>

      {/* Calendar popup */}
      <CenterModal visible={showCalendar} onClose={() => setShowCalendar(false)} panelStyle={styles.calendarPanel}>
        <DateRangeCalendar
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={handleDateRangeChange}
          onClose={() => setShowCalendar(false)}
        />
      </CenterModal>

      {/* Filter popup */}
      <CenterModal
        visible={showFilterPopup}
        onClose={() => setShowFilterPopup(false)}
        panelStyle={[styles.sheetPanel, { height: windowH * 0.65 }]}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Filters</Text>
          <Pressable onPress={() => setShowFilterPopup(false)} style={styles.iconBtn} accessibilityLabel="Close">
            <X size={20} color={tw.gray900} />
          </Pressable>
        </View>

        <View style={styles.filterBody}>
          <ScrollView style={styles.sidebar}>
            {FILTER_CATEGORIES.map((c) => {
              const active = activeFilterCategory === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setActiveFilterCategory(c.id);
                    setFilterSearch("");
                  }}
                  style={[styles.category, active && styles.categoryActive]}
                >
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flex: 1 }}>
            <View style={styles.filterSearchWrap}>
              <View>
                <Search size={16} color={tw.gray400} style={styles.filterSearchIcon} />
                <TextInput
                  placeholder="Search"
                  placeholderTextColor={tw.gray400}
                  value={filterSearch}
                  onChangeText={setFilterSearch}
                  style={[styles.filterSearchInput, inputFont]}
                  selectionColor={colors.primary}
                />
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.optionsList} keyboardShouldPersistTaps="handled">
              {filterOptions.map((option) => {
                const checked = filters[option.key]?.includes(option.id) || false;
                const isRadio = activeFilterCategory === "Ratings";
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => handleFilterToggle(option)}
                    style={({ pressed }) => [styles.option, pressed && { backgroundColor: tw.gray50 }]}
                  >
                    {isRadio ? (
                      <View style={[styles.radio, { borderColor: checked ? tw.blue600 : tw.gray300 }]}>
                        {checked ? <View style={styles.radioDot} /> : null}
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.checkbox,
                          checked ? { backgroundColor: tw.blue600, borderColor: tw.blue600 } : { borderColor: tw.gray300 },
                        ]}
                      >
                        {checked ? <Check size={14} strokeWidth={3} color="#fff" /> : null}
                      </View>
                    )}
                    <Text style={styles.optionText}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={styles.filterFooter}>
          <Pressable
            onPress={handleClearFilters}
            style={({ pressed }) => [styles.footerBtn, styles.footerBtnOutline, pressed && { backgroundColor: tw.gray50 }]}
          >
            <Text style={styles.footerBtnText}>Clear all</Text>
          </Pressable>
          <Pressable
            onPress={handleApplyFilters}
            disabled={isApplyingFilters}
            style={({ pressed }) => [
              styles.footerBtn,
              { backgroundColor: pressed ? colors.primaryStrong : colors.primary },
              isApplyingFilters && { opacity: 0.5 },
            ]}
          >
            {isApplyingFilters ? <ActivityIndicator size={16} color="#fff" /> : null}
            <Text style={[styles.footerBtnText, { color: "#fff" }]}>{isApplyingFilters ? "Applying..." : "Apply"}</Text>
          </Pressable>
        </View>
      </CenterModal>

      <InlineToast visible={showToast} message="Order ID copied to clipboard" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tw.gray100 },
  list: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  helpBtn: { padding: 8, borderRadius: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  headerSub: { fontSize: 12, color: tw.gray500 },
  controls: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchBox: { flex: 1, justifyContent: "center" },
  searchIcon: { position: "absolute", left: 12, zIndex: 1 },
  searchInput: {
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 10,
    backgroundColor: tw.gray50,
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 8,
    fontSize: 14,
    color: tw.gray900,
  },
  filterBtn: { padding: 10, borderWidth: 1, borderRadius: 8, backgroundColor: tw.gray50, borderColor: tw.gray200 },
  filterBtnActive: { backgroundColor: tw.blue50, borderColor: pal.blue500 },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 9999,
    backgroundColor: tw.blue600,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { fontSize: 12, lineHeight: 14, fontWeight: "700", color: "#fff" },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 8,
  },
  dateLabel: { fontSize: 14, fontWeight: "500", color: tw.gray900, textTransform: "capitalize" },
  dateRange: { fontSize: 12, color: tw.gray500, marginTop: 2 },
  dateIcons: { flexDirection: "row", alignItems: "center", gap: 8 },
  activeSummary: {
    backgroundColor: tw.blue50,
    borderWidth: 1,
    borderColor: pal.blue200,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeSummaryLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  activeSummaryText: { fontSize: 14, color: pal.blue900 },
  clearAll: { fontSize: 12, fontWeight: "500", color: tw.blue600 },
  stateBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 48,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tw.gray200,
  },
  stateText: { fontSize: 14, color: tw.gray600 },
  stateSub: { fontSize: 12, color: tw.gray500, textAlign: "center", paddingHorizontal: 16 },
  errorTitle: { fontSize: 14, fontWeight: "500", color: tw.red600 },
  emptyTitle: { fontSize: 14, fontWeight: "500", color: tw.gray900 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: tw.gray200, borderRadius: 8, padding: 16 },
  cardPressed: { boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8 },
  tags: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  tagText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  when: { flexDirection: "row", alignItems: "center", gap: 8 },
  whenText: { fontSize: 12, color: tw.gray500 },
  idRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  idText: { flexShrink: 1, fontSize: 16, fontWeight: "700", color: tw.gray900 },
  copyBtn: { padding: 4, borderRadius: 4 },
  restaurantText: { fontSize: 14, color: tw.gray900, marginBottom: 4 },
  customerText: { fontSize: 14, color: tw.gray600, marginBottom: 12 },
  dashed: { borderTopWidth: 1, borderStyle: "dashed", borderColor: tw.gray300, marginVertical: 12 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemName: { flexShrink: 1, fontSize: 14, color: tw.gray900 },
  itemPrice: { fontSize: 14, color: tw.gray500 },
  moreItems: { fontSize: 12, fontWeight: "500", color: tw.blue600 },
  payoutRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tw.gray100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payoutLabel: { fontSize: 12, fontWeight: "500", color: tw.gray500, letterSpacing: 0.6 },
  payoutValue: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  reasonRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: tw.gray200 },
  reasonText: { fontSize: 14, color: tw.red600 },
  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  sheetPanel: {
    width: "100%",
    minWidth: 280,
    maxWidth: 448,
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  calendarPanel: { width: "100%", maxWidth: 384, alignItems: "center" },
  handleWrap: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 9999, backgroundColor: tw.gray300 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  rangeList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 8 },
  rangeOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tw.gray200,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rangeOptionSelected: { borderColor: pal.blue500, backgroundColor: tw.blue50 },
  rangeOptionLabel: { fontSize: 14, fontWeight: "600", color: tw.gray900, textTransform: "capitalize" },
  selectedText: { fontSize: 12, fontWeight: "600", color: tw.blue600 },
  filterBody: { flex: 1, flexDirection: "row", overflow: "hidden" },
  sidebar: { width: 112, flexGrow: 0, backgroundColor: tw.gray50, borderRightWidth: 1, borderRightColor: tw.gray200 },
  category: { paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tw.gray200 },
  categoryActive: { backgroundColor: "#fff", borderWidth: 2, borderColor: tw.gray200, borderLeftColor: "#000" },
  categoryText: { fontSize: 12, color: tw.gray600 },
  categoryTextActive: { color: tw.gray900, fontWeight: "600" },
  filterSearchWrap: { padding: 12, borderBottomWidth: 1, borderBottomColor: tw.gray200 },
  filterSearchIcon: { position: "absolute", left: 12, top: 11, zIndex: 1 },
  filterSearchInput: {
    paddingLeft: 36,
    paddingRight: 12,
    paddingVertical: 8,
    backgroundColor: tw.gray50,
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 8,
    fontSize: 14,
    color: tw.gray900,
  },
  optionsList: { paddingHorizontal: 12, paddingVertical: 8 },
  option: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  radio: { width: 20, height: 20, borderRadius: 9999, borderWidth: 2, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  radioDot: { width: 12, height: 12, borderRadius: 9999, backgroundColor: tw.blue600 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  optionText: { marginLeft: 12, flexShrink: 1, fontSize: 14, color: tw.gray900 },
  filterFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: tw.gray200,
    backgroundColor: "#fff",
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  footerBtnOutline: { borderWidth: 1, borderColor: tw.gray300 },
  footerBtnText: { fontSize: 14, fontWeight: "500", color: tw.gray900 },
});
