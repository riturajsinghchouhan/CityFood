// Port of pages/user/orders/Orders.jsx (the Orders tab).
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Search } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { getOrders, submitOrderRatings } from "../../api";
import OrderListCard from "../../components/orders/OrderListCard";
import OrdersRatingModal from "../../components/orders/OrdersRatingModal";
import ShareRestaurantModal, { systemShare } from "../../components/orders/ShareRestaurantModal";
import { extractOrderList, isToday, transformListOrder } from "../../components/orders/orderUtils";
import { inputFont, Screen, Text, toast } from "../../components/ui";
import { ASSET_ORIGIN } from "../../config";
import { getCompanyNameAsync } from "../../context/AppSettingsContext";
import { useCart } from "../../context/CartContext";
import { withProtected } from "../../navigation/Protected";
import { store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";

const FETCH_LIMIT = 100;
const POLL_MS = 60000;
// Web localStorage key "shownRatingForOrders".
const SHOWN_RATING_KEY = "shownRatingForOrders";

async function fetchAllOrders() {
  const first = await getOrders({ limit: FETCH_LIMIT, page: 1 });
  const firstPage = extractOrderList(first);
  const totalPages = first?.data?.pagination?.pages || 1;
  if (totalPages <= 1) return firstPage;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => getOrders({ limit: FETCH_LIMIT, page: i + 2 })),
  );
  return [...firstPage, ...rest.flatMap(extractOrderList)];
}

function calculateCountdown(order) {
  if (!order || order.status === "delivered" || String(order.status).toLowerCase().includes("cancel")) return null;
  const elapsedMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const maxETA = order.eta?.max || order.estimatedDeliveryTime || 30;
  const remaining = Math.max(0, maxETA - elapsedMinutes);
  return remaining > 0 ? remaining : null;
}

function isDeliveredForRating(order) {
  const original = String(order.originalStatus || order.status || "");
  const transformed = String(order.status || "");
  return [original, transformed].some((s) => s.toLowerCase() === "delivered" || s.toLowerCase() === "completed");
}

function OrdersScreen() {
  const { colors, isDark } = useTheme();
  const { replaceCart } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  const [ratingOrder, setRatingOrder] = useState(null);
  const [activeMenuOrderId, setActiveMenuOrderId] = useState(null);
  const [sharePayload, setSharePayload] = useState(null);
  const [restaurantRating, setRestaurantRating] = useState(null);
  const [deliveryRating, setDeliveryRating] = useState(null);
  const [restaurantText, setRestaurantText] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [countdowns, setCountdowns] = useState({});
  const [shownRating, setShownRating] = useState(null); // Set once loaded from storage
  const loadedOnce = useRef(false);

  useEffect(() => {
    store.get(SHOWN_RATING_KEY, []).then((saved) => setShownRating(new Set(Array.isArray(saved) ? saved : [])));
  }, []);

  const markRatingShown = useCallback((orderId) => {
    setShownRating((prev) => {
      const next = new Set([...(prev || []), orderId]);
      store.set(SHOWN_RATING_KEY, Array.from(next));
      return next;
    });
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      if (!loadedOnce.current) setLoading(true);
      const data = await fetchAllOrders();
      const transformed = data.map(transformListOrder);
      transformed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(transformed);
    } catch (error) {
      toast.error(error?.status === 401 ? "Please login to view your orders" : error?.data?.message || "Failed to load orders");
      setOrders([]);
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  // The web fetched on mount (each visit), polled every 60 s while visible and on visibilitychange.
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      const interval = setInterval(() => {
        if (AppState.currentState === "active") fetchOrders();
      }, POLL_MS);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") fetchOrders();
      });
      return () => {
        clearInterval(interval);
        sub.remove();
      };
    }, [fetchOrders]),
  );

  // ETA countdowns, refreshed every 10 s.
  useEffect(() => {
    const update = () => {
      const next = {};
      orders.forEach((order) => {
        const remaining = calculateCountdown(order);
        if (remaining !== null) next[order.id] = remaining;
      });
      setCountdowns(next);
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [orders]);

  // Auto-open the rating modal once for a delivered, unrated order (same checks as the web).
  useEffect(() => {
    if (!shownRating || orders.length === 0 || ratingOrder) return undefined;
    const toRate = orders.find((order) => {
      const hasRestaurantRating = Number.isFinite(Number(order.restaurantRating));
      const hasDeliveryPartner = !!(order.deliveryPartnerId || order.deliveryPartnerName);
      const hasDeliveryRating = Number.isFinite(Number(order.deliveryPartnerRating));
      const hasRating = hasRestaurantRating && (!hasDeliveryPartner || hasDeliveryRating);
      const id = order.id || order._id || order.mongoId;
      const hasDeliveredAt = order.deliveredAt !== null && order.deliveredAt !== undefined;
      return (isDeliveredForRating(order) || hasDeliveredAt) && !hasRating && !shownRating.has(id);
    });
    if (!toRate) return undefined;
    markRatingShown(toRate.id || toRate._id || toRate.mongoId);
    const t = setTimeout(() => {
      setRatingOrder(toRate);
      setRestaurantRating(null);
      setDeliveryRating(null);
      setRestaurantText("");
      setDeliveryText("");
    }, 800);
    return () => clearTimeout(t);
  }, [orders, shownRating, ratingOrder, markRatingShown]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const orderIsToday = isToday(order.createdAt);
        const isActiveStatus = ["preparing", "outForDelivery", "confirmed"].includes(order.status);
        if (activeTab === "today") {
          if (!orderIsToday && !isActiveStatus) return false;
        } else if (orderIsToday || isActiveStatus) {
          return false;
        }
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          order.restaurant?.toLowerCase().includes(query) ||
          order.items.some((item) => (item.name || item.foodName || "").toLowerCase().includes(query))
        );
      }),
    [orders, activeTab, searchQuery],
  );

  const handleReorder = useCallback(
    (order) => {
      const target = order.restaurantSlug || order.restaurantId;
      if (!target || !order.items?.length) {
        toast.info("Order items or restaurant information not available");
        return;
      }
      const items = order.items
        .map((item, index) => {
          const itemId = item.id || item.itemId || item._id;
          if (!itemId) return null;
          return {
            id: itemId,
            name: item.name || item.foodName || "Item",
            price: Number(item.price) || 0,
            originalPrice: Math.max(Number(item.price) || 0, Number(item.originalPrice) || 0),
            image: item.image || "",
            restaurant: order.restaurant || "Restaurant",
            restaurantId: order.restaurantId,
            description: item.description || "",
            isVeg: item.isVeg !== false,
            quantity: Math.max(1, Number(item.quantity) || 1),
            reorderIndex: index,
          };
        })
        .filter(Boolean);
      if (!items.length) {
        toast.error("No reorderable items found in this order");
        return;
      }
      replaceCart(items);
      toast.success("Items added to cart");
      router.push(`/restaurants/${target}`);
    },
    [replaceCart],
  );

  const toggleMenu = useCallback((id) => setActiveMenuOrderId((cur) => (cur === id ? null : id)), []);

  const handleShareRestaurant = useCallback(async (order) => {
    try {
      const companyName = await getCompanyNameAsync();
      const location = order.restaurantLocation || `${order.address?.city || ""}, ${order.address?.state || ""}`.trim();
      const path = order.restaurantSlug || order.restaurantId;
      const url = path ? `${ASSET_ORIGIN}/food/user/restaurants/${path}` : `${ASSET_ORIGIN}/food/user/orders/${order.id}`;
      const text = `Check out ${order.restaurant} on ${companyName}.
Location: ${location || "Location not available"}
Order again from this restaurant in the ${companyName} app.`;
      const payload = { title: order.restaurant, text, url };
      if (await systemShare(payload)) {
        toast.success("Restaurant shared successfully");
        return;
      }
      setSharePayload(payload);
    } catch {
      toast.error("Failed to share restaurant");
    } finally {
      setActiveMenuOrderId(null);
    }
  }, []);

  const openOrder = useCallback((order, terminal) => {
    router.push(terminal ? `/orders/${order.id}/details` : `/orders/${order.id}`);
  }, []);

  const handleViewDetails = useCallback(
    (order) => {
      setActiveMenuOrderId(null);
      const status = String(order.status || "").toLowerCase();
      const terminal = ["delivered", "cancelled", "completed", "failed"].includes(status) || status.includes("cancelled");
      openOrder(order, terminal);
    },
    [openOrder],
  );

  const handleOpenRating = useCallback((order) => {
    setRatingOrder(order);
    setRestaurantRating(order.restaurantRating || null);
    setDeliveryRating(order.deliveryPartnerRating || null);
    setRestaurantText(order.ratings?.restaurant?.comment || "");
    setDeliveryText(order.ratings?.deliveryPartner?.comment || "");
  }, []);

  const handleCloseRating = () => {
    setRatingOrder(null);
    setRestaurantRating(null);
    setDeliveryRating(null);
    setRestaurantText("");
    setDeliveryText("");
  };

  const handleSubmitRating = async () => {
    const order = ratingOrder;
    const hasDeliveryPartner = !!(order?.deliveryPartnerId || order?.deliveryPartnerName);
    if (!order || restaurantRating === null || (hasDeliveryPartner && deliveryRating === null)) {
      toast.error("Please select all required ratings first");
      return;
    }
    try {
      setSubmittingRating(true);
      const res = await submitOrderRatings(order.id, {
        restaurantRating,
        deliveryPartnerRating: hasDeliveryPartner ? deliveryRating : undefined,
        restaurantComment: restaurantText || undefined,
        deliveryPartnerComment: hasDeliveryPartner ? deliveryText || undefined : undefined,
      });
      const updated = res?.data?.order || res?.order || null;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                restaurantRating: updated?.ratings?.restaurant?.rating ?? restaurantRating,
                deliveryPartnerRating: updated?.ratings?.deliveryPartner?.rating ?? (hasDeliveryPartner ? deliveryRating : null),
                ratings: updated?.ratings || {
                  restaurant: { rating: restaurantRating, comment: restaurantText || "" },
                  deliveryPartner: hasDeliveryPartner ? { rating: deliveryRating, comment: deliveryText || "" } : undefined,
                },
                rating: updated?.ratings?.restaurant?.rating ?? restaurantRating,
              }
            : o,
        ),
      );
      toast.success("Thanks for rating your order!");
      markRatingShown(order.id || order._id || order.mongoId);
      handleCloseRating();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to submit ratings. Please try again.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const c = {
    page: isDark ? "#0a0a0a" : "#f9fafb",
    bar: isDark ? "#121212" : "#ffffff",
    border: isDark ? "#1f2937" : "#e5e7eb",
  };

  const header = (
    <View style={[styles.header, { backgroundColor: c.bar, borderBottomColor: c.border }]}>
      <Pressable onPress={() => router.navigate("/")} hitSlop={8}>
        <ArrowLeft size={24} color={isDark ? "#d1d5db" : "#374151"} />
      </Pressable>
      <Text style={[styles.title, { color: isDark ? "#f3f4f6" : "#1f2937" }]}>Your Orders</Text>
    </View>
  );

  const renderItem = useCallback(
    ({ item }) => {
      if (item.kind === "search") {
        return (
          <View style={[styles.searchWrap, { backgroundColor: c.bar, borderBottomColor: c.border }]}>
            <View style={[styles.search, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: c.border }]}>
              <Search size={20} color={colors.primary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by restaurant or dish"
                placeholderTextColor="#9ca3af"
                selectionColor={colors.primary}
                style={[styles.searchInput, { color: isDark ? "#d1d5db" : "#4b5563" }]}
              />
            </View>
          </View>
        );
      }
      if (item.kind === "tabs") {
        return (
          <View style={[styles.tabs, { backgroundColor: c.bar, borderBottomColor: c.border }]}>
            {[
              ["today", "Today's Orders"],
              ["past", "Order History"],
            ].map(([key, label]) => (
              <Pressable key={key} onPress={() => setActiveTab(key)} style={styles.tab}>
                <Text style={[styles.tabText, { color: activeTab === key ? colors.primary : "#6b7280" }]}>{label}</Text>
                {activeTab === key ? <View style={[styles.tabBar, { backgroundColor: colors.primary }]} /> : null}
              </Pressable>
            ))}
          </View>
        );
      }
      if (item.kind === "empty") {
        return (
          <View style={styles.cardWrap}>
            <View style={[styles.emptyCard, { backgroundColor: c.bar, borderColor: isDark ? "#1f2937" : "#f3f4f6" }]}>
              <Text style={{ fontSize: 14, textAlign: "center", color: isDark ? "#9ca3af" : "#4b5563" }}>
                No orders found matching your search
              </Text>
            </View>
          </View>
        );
      }
      const order = item.order;
      return (
        <View style={styles.cardWrap}>
          <OrderListCard
            order={order}
            countdown={countdowns[order.id]}
            menuOpen={activeMenuOrderId === order.id}
            onToggleMenu={toggleMenu}
            onShare={handleShareRestaurant}
            onViewDetails={handleViewDetails}
            onOpenRating={handleOpenRating}
            onReorder={handleReorder}
            onOpen={openOrder}
            onViewMenu={(o) => router.push(`/restaurants/${o.restaurantId}`)}
          />
        </View>
      );
    },
    [c.bar, c.border, isDark, colors.primary, searchQuery, activeTab, activeMenuOrderId, countdowns, toggleMenu, handleShareRestaurant, handleViewDetails, handleOpenRating, handleReorder, openOrder],
  );

  const data = useMemo(
    () => [
      { kind: "search", key: "search" },
      { kind: "tabs", key: "tabs" },
      ...(filteredOrders.length === 0 ? [{ kind: "empty", key: "empty" }] : filteredOrders.map((order) => ({ kind: "order", key: order.id, order }))),
    ],
    [filteredOrders],
  );

  if (loading) {
    return (
      <Screen background={c.page}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (orders.length === 0) {
    return (
      <Screen background={c.page}>
        {header}
        <View style={{ paddingHorizontal: 16, paddingVertical: 32, alignItems: "center" }}>
          <Text style={{ fontSize: 14, color: isDark ? "#9ca3af" : "#4b5563" }}>You haven&apos;t placed any orders yet</Text>
          <Pressable onPress={() => router.navigate("/")} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "500" }}>Start Ordering</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen background={c.page}>
      {header}
      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 16 }}
        ListFooterComponent={
          <View style={styles.brandWrap}>
            <Text style={[styles.brand, { color: isDark ? "#1f2937" : "#e5e7eb" }]}>CITYFOOD</Text>
          </View>
        }
      />
      {ratingOrder ? (
        <OrdersRatingModal
          order={ratingOrder}
          restaurantRating={restaurantRating}
          deliveryRating={deliveryRating}
          restaurantText={restaurantText}
          deliveryText={deliveryText}
          onRestaurantRating={setRestaurantRating}
          onDeliveryRating={setDeliveryRating}
          onRestaurantText={setRestaurantText}
          onDeliveryText={setDeliveryText}
          submitting={submittingRating}
          onSubmit={handleSubmitRating}
          onClose={handleCloseRating}
        />
      ) : null}
      <ShareRestaurantModal visible={Boolean(sharePayload)} payload={sharePayload} onClose={() => setSharePayload(null)} />
    </Screen>
  );
}

export default withProtected(OrdersScreen);

const styles = StyleSheet.create({
  header: { padding: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, zIndex: 10, ...shadow.sm },
  title: { marginLeft: 16, fontSize: 20, fontWeight: "600" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  searchWrap: { padding: 16, marginTop: 4, borderBottomWidth: 1 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow.sm,
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, paddingVertical: 0, ...inputFont },
  tabs: { paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", gap: 24, borderBottomWidth: 1, ...shadow.sm },
  tab: { paddingBottom: 12 },
  tabText: { fontSize: 15, fontWeight: "600" },
  tabBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  cardWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 32, ...shadow.sm },
  brandWrap: { alignItems: "center", marginTop: 32, marginBottom: 16 },
  brand: { fontSize: 36, fontWeight: "900", fontStyle: "italic", letterSpacing: -1.8 },
});
