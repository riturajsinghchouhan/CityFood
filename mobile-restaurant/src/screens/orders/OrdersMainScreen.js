// Port of pages/restaurant/OrdersMain.jsx (the Orders home, "/"): status filter pills (swipe the
// list left/right to change them), one paginated list per filter, the order preview dialog, mark
// ready, navbar search results, and the pending-update / verification / dining banners.
// The new-order popup, its reject dialog, the ring, the 180 s auto-reject and the thermal print
// live in the shell (RestaurantNotificationsContext + NewOrderPopup); this screen only refetches on
// the provider's events and never repeats the popup's toasts.
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { ChevronRight, Loader2, Search } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, AppState, FlatList, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { getCurrentRestaurant, getOrders, getPendingDiningRequest, getRestaurantBookings, markOrderReady, RESTAURANT_ORDER_TAB_STATUS } from "../../api";
import FilterTabsBar from "../../components/orders/FilterTabsBar";
import { HistoryOrderCard, OrderCard } from "../../components/orders/OrderCard";
import OrderPreviewDialog from "../../components/orders/OrderPreviewDialog";
import OrdersPagination from "../../components/orders/OrdersPagination";
import { DiningPendingCard, PendingUpdateBanner, VerificationCard } from "../../components/orders/OrdersStatusCards";
import {
  apiMessage,
  etaDisplayFor,
  sortAllOrders,
  transformActiveOrder,
  transformHistoryOrder,
  transformOrderForList,
} from "../../components/orders/ordersUtils";
import usePaginatedRestaurantOrders, { RESTAURANT_ORDERS_PAGE_SIZE } from "../../components/orders/usePaginatedRestaurantOrders";
import { useRestaurantSearch, useShellBottomInset } from "../../components/shell";
import Text from "../../components/ui/Text";
import { toast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { useRestaurantEvents, useRestaurantNotifications } from "../../context/RestaurantNotificationsContext";
import { checkOnboardingStatus, isRestaurantOnboardingComplete } from "../../lib/onboarding";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "out-for-delivery", label: "Out for delivery" },
  { id: "scheduled", label: "Scheduled" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "dead", label: "Dead Orders" },
];

// Per tab: title, count style, empty text, whether it follows refreshToken / polls (web values).
const TAB_CONFIG = {
  all: { title: "All orders", count: "paren", empty: "No orders found", poll: 15000, history: true },
  new: { title: "New orders", count: "paren", empty: "No new orders found", poll: 15000 },
  preparing: { title: "Preparing orders", count: "active", empty: "No orders in preparation", poll: 20000, refresh: true },
  ready: { title: "Ready for pickup", count: "active", empty: "No orders ready for pickup", poll: 20000, refresh: true },
  "out-for-delivery": { title: "Out for delivery", count: "active", empty: "No orders out for delivery", refresh: true },
  scheduled: { title: "Scheduled orders", count: "paren", empty: "No scheduled orders found", refresh: true, history: true, italic: true, bigSpinner: true },
  completed: { title: "Completed orders", count: "total", empty: "No completed orders yet", refresh: true },
  cancelled: { title: "Cancelled orders", count: "total", empty: "No cancelled orders yet", refresh: true },
  dead: { title: "Dead orders", count: "total", empty: "No dead orders found", refresh: true },
};

const REFRESH_EVENTS = new Set(["orders_refresh", "status_update", "accepted", "rejected", "auto_rejected"]);

function useEnterAnim(key) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [anim, key]);
  return {
    opacity: anim,
    transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };
}

function SectionTitle({ title, count, countStyle, loading, onFullHistory }) {
  const left = (
    <View style={styles.titleLeft}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!loading && countStyle === "paren" ? <Text style={styles.countText}>({count})</Text> : null}
    </View>
  );
  let right = null;
  if (loading) right = <Loader2Spin />;
  else if (countStyle === "total") right = <Text style={styles.countText}>{count} total</Text>;
  else if (countStyle === "active") right = <Text style={styles.countText}>{count} active</Text>;
  else if (onFullHistory) {
    right = (
      <Pressable onPress={onFullHistory} hitSlop={6} style={styles.fullHistory}>
        <Text style={styles.fullHistoryText}>Full History</Text>
        <ChevronRight size={12} strokeWidth={3} color={tw.blue600} />
      </Pressable>
    );
  }
  return (
    <View style={styles.titleRow}>
      {left}
      {right}
    </View>
  );
}

function Loader2Spin({ size = 16, color = tw.gray500 }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true, isInteraction: false }));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}

// One status tab (web: NewOrders, AllOrders, PreparingOrders, ReadyOrders, OutForDeliveryOrders,
// ScheduledOrders, CompletedOrders, CancelledOrders, DeadOrders). Mounted per tab (keyed), so the
// page resets to 1 on every tab change as on web.
function TabBody({ kind, refreshToken, focusToken, isConnected, leadingRows, renderLeading, onSelectOrder, bottomInset, panHandlers }) {
  const cfg = TAB_CONFIG[kind];
  const isFocused = useIsFocused();
  const enterStyle = useEnterAnim(kind);
  const { orders: rawOrders, meta, page, loading, setPage, refetch } = usePaginatedRestaurantOrders({
    status: RESTAURANT_ORDER_TAB_STATUS[kind],
    // New and All only poll on web; every tab refetches when the screen regains focus (the web
    // remounted OrdersMain when you came back to it).
    refreshToken: `${cfg.refresh ? refreshToken : 0}:${focusToken}`,
    enablePoll: Boolean(cfg.poll),
    pollMs: isConnected ? 45000 : cfg.poll || 15000,
  });

  const ticking = kind === "all" || kind === "preparing";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking || !isFocused) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ticking, isFocused]);

  const [marking, setMarking] = useState({});
  const [overrides, setOverrides] = useState({});
  const [hidden, setHidden] = useState(() => new Set());

  // AllOrders handleMarkReady
  const markReadyFromAll = async ({ orderId, mongoId }) => {
    const key = mongoId || orderId;
    if (!key || marking[key]) return;
    try {
      setMarking((p) => ({ ...p, [key]: true }));
      await markOrderReady(key);
      setOverrides((p) => ({ ...p, [key]: { status: "ready", eta: null, sortTimestamp: Date.now() } }));
      toast.success("Order marked as ready");
    } catch (err) {
      toast.error(apiMessage(err, "Failed to mark order as ready"));
    } finally {
      setMarking((p) => ({ ...p, [key]: false }));
    }
  };

  // PreparingOrders handleMarkReady
  const markReadyFromPreparing = async ({ orderId, mongoId, customerName }) => {
    const key = mongoId || orderId;
    if (!key || marking[key]) return;
    try {
      setMarking((p) => ({ ...p, [key]: true }));
      await markOrderReady(key);
      setHidden((p) => new Set(p).add(key));
      toast.success(`Order ${orderId} marked ready${customerName ? ` for ${customerName}` : ""}`);
      refetch();
    } catch (err) {
      const message = apiMessage(err, "Failed to mark order as ready");
      if (err?.status === 400 && String(message).toLowerCase().includes("current status")) {
        setHidden((p) => new Set(p).add(key));
        toast.success(`Order ${orderId} is already ready`);
        refetch();
      } else {
        toast.error(message);
      }
    } finally {
      setMarking((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  const items = useMemo(() => {
    switch (kind) {
      case "new":
        return rawOrders.map(transformOrderForList).sort((a, b) => b.sortTimestamp - a.sortTimestamp);
      case "all":
        return rawOrders
          .map(transformOrderForList)
          .map((o) => {
            const key = o.mongoId || o.orderId;
            return overrides[key] ? { ...o, ...overrides[key] } : o;
          })
          .sort(sortAllOrders);
      case "scheduled":
        return rawOrders
          .map(transformOrderForList)
          .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime());
      case "preparing":
        return rawOrders
          .map((o) => transformActiveOrder(o, "preparing"))
          .filter((o) => !hidden.has(o.mongoId || o.orderId));
      case "ready":
        return rawOrders.map((o) => transformActiveOrder(o, "ready"));
      case "out-for-delivery":
        return rawOrders.map((o) => transformActiveOrder(o, "out_for_delivery"));
      case "completed":
        return rawOrders.map((o) => transformHistoryOrder(o, "delivered"));
      case "cancelled":
        return rawOrders.map((o) => transformHistoryOrder(o, "cancelled"));
      case "dead":
        return rawOrders.map((o) => transformHistoryOrder(o, "dead"));
      default:
        return [];
    }
  }, [kind, rawOrders, overrides, hidden]);

  const renderOrder = (order) => {
    const key = order.mongoId || order.orderId;
    if (kind === "completed" || kind === "cancelled" || kind === "dead") {
      return <HistoryOrderCard order={order} kind={kind === "completed" ? "delivered" : kind} onSelect={onSelectOrder} />;
    }
    if (kind === "all") {
      const st = String(order.status || "").toLowerCase();
      const eta = st === "preparing" && order.preparingTimestamp ? etaDisplayFor(order, now) : order.eta;
      return (
        <OrderCard
          {...order}
          eta={eta}
          onSelect={onSelectOrder}
          onMarkReady={st === "preparing" ? markReadyFromAll : undefined}
          isMarkingReady={Boolean(marking[key])}
        />
      );
    }
    if (kind === "preparing") {
      // Web passed only these props here (no scheduledAt / restaurantNote / pickupOtp).
      return (
        <OrderCard
          orderId={order.orderId}
          mongoId={order.mongoId}
          status={order.status}
          customerName={order.customerName}
          type={order.type}
          tableOrToken={order.tableOrToken}
          timePlaced={order.timePlaced}
          eta={etaDisplayFor(order, now)}
          itemsSummary={order.itemsSummary}
          photoUrl={order.photoUrl}
          photoAlt={order.photoAlt}
          paymentMethod={order.paymentMethod}
          deliveryPartnerId={order.deliveryPartnerId}
          dispatchStatus={order.dispatchStatus}
          onSelect={onSelectOrder}
          onMarkReady={markReadyFromPreparing}
          isMarkingReady={Boolean(marking[key])}
        />
      );
    }
    return <OrderCard {...order} onSelect={onSelectOrder} />;
  };

  const body = [{ key: "__title", type: "title" }];
  if (loading) body.push({ key: "__loading", type: "loading" });
  else if (items.length === 0) body.push({ key: "__empty", type: "empty" });
  else items.forEach((o, i) => body.push({ key: `o:${o.orderId || o.mongoId || i}`, type: "order", order: o }));
  if (!loading) body.push({ key: "__pagination", type: "pagination" });
  const data = [...leadingRows, ...body];

  const renderItem = ({ item }) => {
    if (item.type === "leading") return renderLeading(item);
    let content = null;
    if (item.type === "title") {
      if (loading && cfg.bigSpinner) return null;
      content = (
        <SectionTitle
          title={cfg.title}
          count={meta.total}
          countStyle={cfg.count}
          loading={loading}
          onFullHistory={cfg.history ? () => router.push("/orders/all") : null}
        />
      );
    } else if (item.type === "loading") {
      content = cfg.bigSpinner ? (
        <View style={styles.bigSpinner}>
          <BigSpinner />
        </View>
      ) : (
        <Text style={styles.centerText}>Loading...</Text>
      );
    } else if (item.type === "empty") {
      content = <Text style={[styles.centerText, cfg.italic && { fontStyle: "italic" }]}>{cfg.empty}</Text>;
    } else if (item.type === "order") {
      content = renderOrder(item.order);
    } else if (item.type === "pagination") {
      content = (
        <View style={{ paddingBottom: 24 }}>
          <OrdersPagination
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit || RESTAURANT_ORDERS_PAGE_SIZE}
            onPageChange={setPage}
          />
        </View>
      );
    }
    return <Animated.View style={[styles.bodyPad, enterStyle]}>{content}</Animated.View>;
  };

  const stickyIdx = leadingRows.findIndex((r) => r.sticky);
  return (
    <View style={styles.page} {...panHandlers}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        extraData={`${now}:${loading}:${JSON.stringify(marking)}`}
        stickyHeaderIndices={stickyIdx >= 0 ? [stickyIdx] : undefined}
        contentContainerStyle={{ paddingBottom: Math.max(96, bottomInset) }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function BigSpinner() {
  const { colors } = useTheme();
  return <ActivityIndicator size={32} color={colors.primary} />;
}

// SearchResults: the navbar search (useRestaurantSearch) replaces the tab list while a query is set.
function SearchBody({ query, results, isLoading, leadingRows, renderLeading, onSelectOrder, bottomInset }) {
  const { colors } = useTheme();
  const transformed = useMemo(() => (results || []).map(transformOrderForList), [results]);

  const body = [];
  if (isLoading) body.push({ key: "__searching", type: "searching" });
  else {
    body.push({ key: "__title", type: "title" });
    if (transformed.length === 0) body.push({ key: "__empty", type: "empty" });
    else transformed.forEach((o, i) => body.push({ key: `o:${o.orderId || o.mongoId || i}`, type: "order", order: o }));
  }
  const data = [...leadingRows, ...body];

  const renderItem = ({ item }) => {
    if (item.type === "leading") return renderLeading(item);
    if (item.type === "searching") {
      return (
        <View style={styles.searching}>
          <ActivityIndicator size={32} color={colors.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.searchingText}>Searching for &quot;{query}&quot;...</Text>
        </View>
      );
    }
    if (item.type === "title") {
      return (
        <View style={[styles.bodyPad, styles.searchTitleRow]}>
          <Text style={styles.sectionTitle}>Search results for</Text>
          <View style={styles.queryChip}>
            <Text style={styles.queryChipText}>&quot;{query}&quot;</Text>
          </View>
          <Text style={[styles.countText, { fontWeight: "500", marginLeft: 4 }]}>({transformed.length})</Text>
        </View>
      );
    }
    if (item.type === "empty") {
      return (
        <View style={styles.bodyPad}>
          <View style={styles.noResults}>
            <View style={styles.noResultsIcon}>
              <Search size={32} color={tw.gray300} />
            </View>
            <Text style={styles.noResultsTitle}>No results found</Text>
            <Text style={styles.noResultsText}>Try searching for a different order ID or customer name</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.bodyPad}>
        <OrderCard {...item.order} onSelect={onSelectOrder} />
      </View>
    );
  };

  const stickyIdx = leadingRows.findIndex((r) => r.sticky);
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      stickyHeaderIndices={stickyIdx >= 0 ? [stickyIdx] : undefined}
      contentContainerStyle={{ paddingBottom: Math.max(96, bottomInset) }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );
}

export default function OrdersMainScreen() {
  const bottomInset = useShellBottomInset();
  const { restaurant: authRestaurant } = useAuth();
  const { isConnected } = useRestaurantNotifications();
  const search = useRestaurantSearch();
  const filterBarRef = useRef(null);

  const [activeFilter, setActiveFilter] = useState("all");
  const transitionUntil = useRef(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const [refreshToken, setRefreshToken] = useState(0);
  const [focusToken, setFocusToken] = useState(0);
  const requestOrdersRefresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  const [restaurantStatus, setRestaurantStatus] = useState({
    isActive: null,
    rejectionReason: null,
    onboarding: null,
    isLoading: true,
  });
  const [isReverifying, setIsReverifying] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [pendingDiningRequest, setPendingDiningRequest] = useState(null);
  const pendingBookingsRef = useRef(0);

  useRestaurantEvents((e) => {
    if (REFRESH_EVENTS.has(e?.type)) requestOrdersRefresh();
  });

  // ---- restaurant verification status (+ onboarding redirect) ----
  const fetchRestaurantStatus = useCallback(async () => {
    try {
      const res = await getCurrentRestaurant();
      const restaurant = res?.data?.restaurant;
      if (!restaurant) return;
      setRestaurantStatus({
        isActive: restaurant.isActive,
        status: restaurant.status,
        approvedAt: restaurant.approvedAt,
        pendingUpdateReason: restaurant.pendingUpdateReason,
        rejectionReason: restaurant.rejectionReason || null,
        onboarding: restaurant.onboarding || null,
        isLoading: false,
      });
      if (!isRestaurantOnboardingComplete(restaurant)) {
        const step = await checkOnboardingStatus();
        if (step) router.replace({ pathname: "/onboarding", params: { step: String(step) } });
      }
    } catch {
      setRestaurantStatus((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // ---- pending counts (web: every 30 s while mounted) ----
  const fetchCounts = useCallback(async () => {
    try {
      let restaurant = authRestaurant;
      if (!(restaurant?._id || restaurant?.id)) {
        const r = await getCurrentRestaurant();
        restaurant = r?.data?.restaurant || null;
      }
      if (restaurant?._id || restaurant?.id) {
        const res = await getRestaurantBookings(restaurant);
        if (res?.success) {
          const bookings = Array.isArray(res.data) ? res.data : [];
          const pending = bookings.filter((b) => String(b.status).toLowerCase() === "pending").length;
          if (pending > pendingBookingsRef.current) {
            toast.info('New table booking request! Check the "Table Booking" tab.');
          }
          pendingBookingsRef.current = pending;
        }
        const reqRes = await getPendingDiningRequest();
        setPendingDiningRequest(reqRes?.success && reqRes.data ? reqRes.data : null);
      }
      const ordersRes = await getOrders({ page: 1, limit: 100 });
      if (ordersRes?.success) {
        const orders = Array.isArray(ordersRes.data?.orders) ? ordersRes.data.orders : [];
        setPendingOrdersCount(
          orders.filter((o) => ["pending", "created", "confirmed"].includes(String(o.status).toLowerCase())).length,
        );
      }
    } catch {
      // non-blocking, as on web
    }
  }, [authRestaurant]);

  const fetchCountsRef = useRef(fetchCounts);
  useEffect(() => {
    fetchCountsRef.current = fetchCounts;
  }, [fetchCounts]);

  // Mount + every return to the screen (the web remounted OrdersMain on each visit).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      fetchRestaurantStatus();
      fetchCountsRef.current();
      if (firstFocus.current) firstFocus.current = false;
      else setFocusToken((t) => t + 1);
      const interval = setInterval(() => {
        if (AppState.currentState === "active") fetchCountsRef.current();
      }, 30000);
      return () => clearInterval(interval);
    }, [fetchRestaurantStatus]),
  );

  // Web: restaurantAPI.reverify() is undefined, so the call threw and the catch alerted this.
  const handleReverify = () => {
    setIsReverifying(true);
    Alert.alert("Failed to reverify restaurant. Please try again.");
    setIsReverifying(false);
  };

  const changeFilter = useCallback((id) => {
    if (Date.now() < transitionUntil.current) return;
    transitionUntil.current = Date.now() + 300;
    setActiveFilter(id);
  }, []);

  // Horizontal swipe on the list switches to the next / previous filter (web touch handlers).
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 10,
        // Let the native scroll views (the filter pills, the list) still take over the gesture.
        onShouldBlockNativeResponder: () => false,
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, g) => {
          const swipeDistance = -g.dx;
          if (Math.abs(swipeDistance) <= 50) return;
          setTimeout(() => {
            setActiveFilter((current) => {
              const idx = FILTER_TABS.findIndex((t) => t.id === current);
              if (swipeDistance > 0 && idx < FILTER_TABS.length - 1) return FILTER_TABS[idx + 1].id;
              if (swipeDistance < 0 && idx > 0) return FILTER_TABS[idx - 1].id;
              return current;
            });
          }, 50);
        },
      }),
    [],
  );

  const handleSelectOrder = useCallback((order) => {
    if (!order) return;
    setSelectedOrder(order);
    setIsSheetOpen(true);
  }, []);

  const showPendingBanner =
    !restaurantStatus.isLoading &&
    restaurantStatus.status === "pending" &&
    Boolean(
      restaurantStatus.approvedAt ||
        (restaurantStatus.pendingUpdateReason && restaurantStatus.pendingUpdateReason !== "New Registration"),
    );
  const showVerification =
    !restaurantStatus.isLoading && !restaurantStatus.isActive && restaurantStatus.onboarding?.completedSteps === 4;

  const leadingRows = [];
  if (showPendingBanner) leadingRows.push({ key: "__banner", type: "leading", part: "banner" });
  leadingRows.push({ key: "__filters", type: "leading", part: "filters", sticky: true });
  if (showVerification) leadingRows.push({ key: "__verify", type: "leading", part: "verify" });
  if (pendingDiningRequest) leadingRows.push({ key: "__dining", type: "leading", part: "dining" });

  const renderLeading = (row) => {
    if (row.part === "banner") return <PendingUpdateBanner reason={restaurantStatus.pendingUpdateReason} />;
    if (row.part === "filters") {
      return (
        <FilterTabsBar
          ref={filterBarRef}
          tabs={FILTER_TABS}
          activeId={activeFilter}
          onSelect={changeFilter}
          pendingOrdersCount={pendingOrdersCount}
        />
      );
    }
    if (row.part === "verify") {
      return (
        <View style={styles.bodyPad}>
          <VerificationCard
            rejectionReason={restaurantStatus.rejectionReason}
            isReverifying={isReverifying}
            onReverify={handleReverify}
          />
        </View>
      );
    }
    if (row.part === "dining") {
      return (
        <View style={styles.bodyPad}>
          <DiningPendingCard request={pendingDiningRequest} />
        </View>
      );
    }
    return null;
  };

  const searching = String(search.query || "").trim() !== "";

  return (
    <View style={styles.page}>
      {searching ? (
        <SearchBody
          query={search.query}
          results={search.results}
          isLoading={search.isLoading}
          leadingRows={leadingRows}
          renderLeading={renderLeading}
          onSelectOrder={handleSelectOrder}
          bottomInset={bottomInset}
        />
      ) : (
        <TabBody
          key={activeFilter}
          kind={activeFilter}
          refreshToken={refreshToken}
          focusToken={focusToken}
          isConnected={isConnected}
          leadingRows={leadingRows}
          renderLeading={renderLeading}
          onSelectOrder={handleSelectOrder}
          bottomInset={bottomInset}
          panHandlers={panResponder.panHandlers}
        />
      )}

      <OrderPreviewDialog
        visible={isSheetOpen}
        order={selectedOrder}
        onClose={() => setIsSheetOpen(false)}
        onViewDetails={(o) => {
          setIsSheetOpen(false);
          router.push({ pathname: "/orders/[id]", params: { id: String(o.mongoId || o.orderId) } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tw.gray100 },
  bodyPad: { paddingHorizontal: 16 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    marginBottom: 12,
  },
  titleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#000" },
  countText: { fontSize: 12, color: tw.gray500 },
  fullHistory: { flexDirection: "row", alignItems: "center", gap: 4 },
  fullHistoryText: { fontSize: 12, fontWeight: "700", color: tw.blue600 },
  centerText: { textAlign: "center", paddingVertical: 32, fontSize: 14, color: tw.gray500 },
  bigSpinner: { alignItems: "center", padding: 40 },
  searching: { alignItems: "center", justifyContent: "center", padding: 80 },
  searchingText: { fontSize: 14, color: tw.gray500, textAlign: "center" },
  searchTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, paddingTop: 4, marginBottom: 16 },
  queryChip: { backgroundColor: tw.gray200, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  queryChipText: { fontSize: 14, fontStyle: "italic", color: tw.gray700 },
  noResults: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  noResultsIcon: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: tw.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  noResultsTitle: { fontWeight: "700", color: tw.gray900, marginBottom: 4 },
  noResultsText: { fontSize: 12, color: tw.gray500, textAlign: "center" },
});

