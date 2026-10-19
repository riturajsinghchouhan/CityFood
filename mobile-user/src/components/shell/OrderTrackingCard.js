// Port of components/user/OrderTrackingCard.jsx: the floating "active order" card on Home.
// Picks the newest in-flight order from GET /food/orders (every 90 s while the app is in
// the foreground, as on web) merged with the device-local orders, patches it from socket
// order updates, counts down "arriving in", and opens the order on tap.
import { router } from "expo-router";
import { ChevronRight, X } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Easing, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { getOrderDetails, getOrders } from "../../api/orders";
import { useAuth } from "../../context/AuthContext";
import { useOrders } from "../../context/OrdersContext";
import { useNotificationEvent } from "../../context/UserNotificationContext";
import { useTheme } from "../../theme/ThemeContext";
import Text from "../ui/Text";
import { useFloatingBottom } from "./floating";
import { patchOrderFromSocketPayload, socketPayloadNeedsRefetch } from "./orderSocketPatch";

const getOrderKey = (order) => order?.id || order?._id || order?.orderId || null;

const normalizeOrderToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

const getOrderStatus = (order) =>
  normalizeOrderToken(order?.orderStatus || order?.status || order?.deliveryState?.status || order?.deliveryStatus || "");

const getOrderPhase = (order) => normalizeOrderToken(order?.deliveryState?.currentPhase || order?.currentPhase || "");

const ACTIVE_PHASES = new Set([
  "created",
  "confirmed",
  "preparing",
  "accepted",
  "ready",
  "ready_for_pickup",
  "reached_pickup",
  "picked_up",
  "out_for_delivery",
  "en_route_to_delivery",
  "at_pickup",
  "at_drop",
]);

const TERMINAL_STATUSES = new Set([
  "delivered",
  "cancelled",
  "canceled",
  "completed",
  "failed",
  "cancelled_by_user",
  "canceled_by_user",
  "cancelled_by_restaurant",
  "canceled_by_restaurant",
  "cancelled_by_admin",
  "canceled_by_admin",
  "dead",
]);

const isActiveOrder = (order) => {
  if (!order) return false;
  const status = getOrderStatus(order);
  const phase = getOrderPhase(order);
  if (TERMINAL_STATUSES.has(status)) return false;
  if (phase === "completed" || phase === "delivered") return false;
  // Scheduled orders stay "confirmed" until the restaurant starts them; no live tracker yet.
  if (order.scheduledAt && (status === "confirmed" || status === "created" || status === "pending")) return false;
  if (!status && phase) return ACTIVE_PHASES.has(phase);
  if (!status) return false;
  return true;
};

const getTimeRemaining = (order) => {
  if (!order) return null;
  const orderTime = new Date(
    order.scheduledAt || order.createdAt || order.orderDate || order.created_at || order.date || Date.now(),
  );
  const isScheduled = !!order.scheduledAt;
  const estimatedMinutes = isScheduled
    ? 0
    : order.estimatedDeliveryTime || order.estimatedTime || order.estimated_delivery_time || 35;
  const deliveryTime = new Date(orderTime.getTime() + estimatedMinutes * 60000);
  return Math.max(0, Math.floor((deliveryTime - new Date()) / 60000));
};

function ordersFingerprint(orders) {
  if (!Array.isArray(orders) || orders.length === 0) return "";
  return orders.map((o) => `${getOrderKey(o)}:${getOrderStatus(o)}`).join("|");
}

function useLoop(duration, delay = 0, easing = Easing.inOut(Easing.ease)) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay, easing]);
  return v;
}

function Steam({ delay, rise }) {
  const t = useLoop(1500, delay, Easing.out(Easing.ease));
  return (
    <Animated.View
      style={[
        styles.steam,
        {
          opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.8, 0] }),
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -rise[0], -rise[1]] }) },
            { scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.2, 1] }) },
          ],
        },
      ]}
    />
  );
}

const CookingAnimation = memo(function CookingAnimation({ color }) {
  const wobble = useLoop(600);
  const flame = useLoop(600);
  return (
    <View style={styles.cook}>
      <View style={styles.steamRow}>
        <Steam delay={0} rise={[8, 12]} />
        <Steam delay={500} rise={[10, 15]} />
        <Steam delay={1000} rise={[8, 12]} />
      </View>
      <Animated.View
        style={{
          marginTop: 4,
          zIndex: 10,
          transform: [{ rotate: wobble.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-2deg", "2deg", "-2deg"] }) }],
        }}
      >
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 10h12v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-6z" />
          <Rect x="5" y="8" width="14" height="2" rx="1" />
          <Path d="M12 8V5" />
          <Path d="M11 5h2v2h-2z" fill={color} />
          <Path d="M19 9l3-1v2l-3 1" fill={color} strokeWidth={1} />
          <Path d="M5 10H3v2h2" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.flameWrap,
          {
            opacity: flame.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.8, 0.4] }),
            transform: [{ scaleX: flame.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.2, 0.8] }) }],
          },
        ]}
      >
        <View style={[styles.flame, { backgroundColor: color }]} />
      </Animated.View>
    </View>
  );
});

/** Render as the last child of Home's root. hasBottomNav: web bottom-20 above the nav, else bottom-6. */
function OrderTrackingCard({ hasBottomNav = true }) {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const { orders: contextOrders } = useOrders();
  const bottom = useFloatingBottom(hasBottomNav ? 80 : 24, hasBottomNav);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [apiOrders, setApiOrders] = useState([]);
  const [hasFetchedApi, setHasFetchedApi] = useState(false);
  const [activeOrderOverride, setActiveOrderOverride] = useState(null);
  const [invalidOrderIds, setInvalidOrderIds] = useState(() => new Set());
  const [dismissedKey, setDismissedKey] = useState(null);
  const lastRefreshRef = useRef(0);
  const lastApiFingerprintRef = useRef("");
  const activeOrderKeyRef = useRef("");
  const activeOrderSnapshotRef = useRef(null);
  const [slide] = useState(() => new Animated.Value(100));

  const fetchOrders = useCallback(async () => {
    // Logged out: the web request always fails with 401; skip it.
    if (!isAuthenticated) {
      setHasFetchedApi(true);
      return;
    }
    try {
      const res = await getOrders({ limit: 10, page: 1 });
      const body = res?.data;
      let nextOrders = [];
      if (Array.isArray(body?.orders)) nextOrders = body.orders;
      else if (Array.isArray(body?.data)) nextOrders = body.data;
      else if (Array.isArray(body?.docs)) nextOrders = body.docs;
      else if (Array.isArray(body)) nextOrders = body;
      const fp = ordersFingerprint(nextOrders);
      if (fp !== lastApiFingerprintRef.current) {
        lastApiFingerprintRef.current = fp;
        setApiOrders(nextOrders);
      }
    } catch {
      if (lastApiFingerprintRef.current !== "") {
        lastApiFingerprintRef.current = "";
        setApiOrders([]);
      }
    } finally {
      setHasFetchedApi(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      if (AppState.currentState !== "active") return;
      fetchOrders();
    }, 90000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Web listened for the "order-placed" window event; natively a new local order
  // (useOrders().upsertOrder after checkout) triggers the same refresh.
  const contextCountRef = useRef(contextOrders.length);
  useEffect(() => {
    if (contextOrders.length > contextCountRef.current) fetchOrders();
    contextCountRef.current = contextOrders.length;
  }, [contextOrders.length, fetchOrders]);

  const uniqueOrders = useMemo(() => {
    const isMongoObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ""));
    const serverKeys = new Set((apiOrders || []).map((o) => String(getOrderKey(o) || "")).filter(Boolean));
    const seen = new Set();
    return [...apiOrders, ...contextOrders].filter((order) => {
      const key = getOrderKey(order);
      if (!key || seen.has(key)) return false;
      if (invalidOrderIds.has(key)) return false;
      // After the first API sync, ignore stale local Mongo ids the server no longer has.
      if (hasFetchedApi && isMongoObjectId(key) && !serverKeys.has(String(key))) return false;
      seen.add(key);
      return true;
    });
  }, [contextOrders, apiOrders, invalidOrderIds, hasFetchedApi]);

  const activeOrder = useMemo(() => {
    const candidate = uniqueOrders.find((order) => isActiveOrder(order)) || null;
    if (!candidate) return null;
    const overrideKey = getOrderKey(activeOrderOverride);
    const candidateKey = getOrderKey(candidate);
    if (overrideKey && candidateKey && overrideKey === candidateKey) return activeOrderOverride;
    return candidate;
  }, [uniqueOrders, activeOrderOverride]);

  useEffect(() => {
    activeOrderKeyRef.current = String(getOrderKey(activeOrder) || "");
    activeOrderSnapshotRef.current = activeOrder;
  }, [activeOrder]);

  const markInvalid = useCallback((key) => {
    setInvalidOrderIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  useNotificationEvent("orderStatusNotification", async (detail = {}) => {
    const incomingKey = String(detail?.orderMongoId || detail?.orderId || "").trim();
    const currentKey = activeOrderKeyRef.current;
    if (!incomingKey || !currentKey || incomingKey !== currentKey) return;

    const snap = activeOrderSnapshotRef.current;
    setActiveOrderOverride((prev) => patchOrderFromSocketPayload(prev || snap || {}, detail));

    if (!socketPayloadNeedsRefetch(detail, detail?.orderStatus)) return;
    const now = Date.now();
    if (now - lastRefreshRef.current < 30000) return;
    lastRefreshRef.current = now;
    try {
      const res = await getOrderDetails(incomingKey);
      const fresh = res?.data?.order || res?.data || null;
      if (fresh) setActiveOrderOverride(fresh);
    } catch (error) {
      if (error?.status === 404 || error?.status === 400) markInvalid(incomingKey);
    }
  });

  useEffect(() => {
    if (!activeOrder) {
      setTimeRemaining((prev) => (prev !== null ? null : prev));
      return undefined;
    }
    const tick = () => {
      const next = getTimeRemaining(activeOrder);
      setTimeRemaining((prev) => (prev === next ? prev : next));
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [activeOrder]);

  // Verify an active order that is not in the recent server list still exists.
  useEffect(() => {
    const key = getOrderKey(activeOrder);
    if (!key || invalidOrderIds.has(key)) return;
    if (apiOrders.some((o) => getOrderKey(o) === key)) return;
    getOrderDetails(key).catch((error) => {
      if (error?.status === 404 || error?.status === 400) markInvalid(key);
    });
  }, [activeOrder, apiOrders, invalidOrderIds, markInvalid]);

  const currentOrderKey = activeOrder ? activeOrder.id || activeOrder._id || activeOrder.orderId : null;
  const orderStatus = getOrderStatus(activeOrder) || "preparing";
  const orderPhase = getOrderPhase(activeOrder);
  const visible =
    Boolean(activeOrder) &&
    dismissedKey !== currentOrderKey &&
    !TERMINAL_STATUSES.has(orderStatus) &&
    orderPhase !== "cancelled" &&
    orderPhase !== "canceled";

  useEffect(() => {
    if (!visible) return;
    slide.setValue(100);
    Animated.spring(slide, { toValue: 0, damping: 25, stiffness: 200, useNativeDriver: true }).start();
  }, [visible, slide]);

  if (!visible) return null;

  const restaurantName = activeOrder.restaurant || activeOrder.restaurantName || "Restaurant";
  const statusText = (() => {
    const s = String(orderStatus);
    const p = String(orderPhase);
    if (s === "confirmed") return "Order confirmed";
    if (s === "preparing" || s === "created" || s === "pending") return "Preparing your order";
    if (s === "ready_for_pickup") return "Ready for pickup";
    if (s === "reached_pickup" || p === "at_pickup") return "Delivery partner reached restaurant";
    if (s === "picked_up" || p === "en_route_to_delivery") return "On the way";
    if (s === "reached_drop" || p === "at_drop") return "Arrived near you";
    if (s === "delivered" || p === "delivered" || p === "completed") return "Delivered";
    return "Preparing your order";
  })();

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          bottom,
          opacity: slide.interpolate({ inputRange: [0, 100], outputRange: [1, 0] }),
          transform: [{ translateY: slide }],
        },
      ]}
    >
      <Pressable onPress={() => router.push(`/orders/${currentOrderKey}`)} style={styles.card}>
        <LinearGradient
          colors={["rgba(255,247,237,0.5)", "rgba(255,255,255,0.4)", "rgba(255,255,255,0.8)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, styles.mesh]}
          pointerEvents="none"
        />
        <Pressable onPress={() => setDismissedKey(currentOrderKey)} style={styles.close} hitSlop={6} accessibilityLabel="Dismiss">
          <X size={14} color="#ff8904" />
        </Pressable>

        <View style={styles.row}>
          <CookingAnimation color={colors.primary} />
          <View style={styles.info}>
            <Text numberOfLines={1} style={styles.name}>
              {restaurantName}
            </Text>
            <View style={styles.statusRow}>
              <Text numberOfLines={1} style={styles.status}>
                {statusText}
              </Text>
              <ChevronRight size={14} color={colors.primary} />
            </View>
          </View>
          <LinearGradient
            colors={[colors.primary, "#D94E0A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.eta, { boxShadow: `0px 10px 15px -3px ${colors.primary}33` }]}
          >
            <Text style={styles.etaLabel}>ARRIVING IN</Text>
            <Text style={styles.etaValue}>{timeRemaining !== null ? `${Math.max(1, timeRemaining)} min` : "--"}</Text>
          </LinearGradient>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default memo(OrderTrackingCard);

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 9999 },
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,237,213,0.6)",
    boxShadow: "0px 8px 30px rgba(235,89,14,0.15)",
  },
  mesh: { borderRadius: 20, opacity: 0.6 },
  close: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 6,
    borderRadius: 9999,
    backgroundColor: "rgba(255,247,237,0.8)",
    zIndex: 20,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 16, zIndex: 10 },
  info: { flex: 1, minWidth: 0, paddingRight: 16 },
  name: { color: "#101828", fontWeight: "700", fontSize: 16, letterSpacing: -0.4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  status: { color: "#6a7282", fontWeight: "500", fontSize: 12, flexShrink: 1 },
  eta: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ffd6a7",
  },
  etaLabel: { color: "#fff7ed", fontSize: 10, fontWeight: "700", letterSpacing: 0.5, opacity: 0.95, lineHeight: 12, marginBottom: 2 },
  etaValue: { color: "#ffffff", fontSize: 16, fontWeight: "900", lineHeight: 20 },
  cook: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#ffedd4",
    boxShadow: "0px 4px 15px rgba(235,89,14,0.15)",
  },
  steamRow: { position: "absolute", top: -12, flexDirection: "row", gap: 6 },
  steam: { width: 6, height: 12, borderRadius: 3, backgroundColor: "rgba(251,146,60,0.6)" },
  flameWrap: { position: "absolute", bottom: 0, width: "100%", alignItems: "center" },
  flame: { width: 16, height: 4, borderRadius: 2, opacity: 0.8 },
});
