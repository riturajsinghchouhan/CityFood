// Port of pages/user/orders/OrderTracking.jsx (live order tracking).
import dayjs from "dayjs";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useIsFocused, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  MessageSquare,
  Phone,
  Receipt,
  RefreshCw,
  Share2,
  Star,
  User,
  X,
} from "lucide-react-native";
import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Linking, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { cancelOrder, getOrderDetails, getOrders, getRestaurantById, submitOrderRatings, updateOrderInstructions } from "../../api";
import DashedLine from "../../components/orders/DashedLine";
import DeliveryTrackingMap from "../../components/orders/DeliveryTrackingMap";
import { CustomerPinIcon, RestaurantPinIcon, RiderBikeIcon } from "../../components/orders/MapIcons";
import Spinner from "../../components/orders/Spinner";
import {
  CancelOrderDialog,
  InstructionsDialog,
  OrderDetailsDialog,
  TrackingRatingDialog,
} from "../../components/orders/TrackingDialogs";
import {
  dialPhone,
  extractOrder,
  extractOrderList,
  isRazorpayPaid,
  mapOrderToTrackingUiStatus,
  normalizeLookupId,
  patchOrderFromSocketPayload,
  socketPayloadNeedsRefetch,
  transformOrderForTracking,
} from "../../components/orders/orderUtils";
import { AppImage, Button, ScalePressable, Screen, Text, toast } from "../../components/ui";
import { ASSET_ORIGIN } from "../../config";
import { useCompanyName } from "../../context/AppSettingsContext";
import { useAppLocation } from "../../context/LocationContext";
import { useOrders } from "../../context/OrdersContext";
import { useProfile } from "../../context/ProfileContext";
import { useNotificationEvent, useUserNotifications } from "../../context/UserNotificationContext";
import useLatest from "../../hooks/useLatest";
import { goTo, useAppBack } from "../../navigation/back";
import { withProtected } from "../../navigation/Protected";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";

const GREEN = "#00a63e"; // bg-green-600
const RED = "#e7000b"; // bg-red-600
const MAP_HEIGHT = 300;

// framer AnimatedCheckmark: circle then tick.
function AnimatedCheckmark() {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 800, delay: 100, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View style={{ alignSelf: "center", opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
      <Svg width={80} height={80} viewBox="0 0 80 80">
        <Circle cx="40" cy="40" r="36" fill="none" stroke="#22c55e" strokeWidth={4} />
        <Path d="M24 40 L35 51 L56 30" fill="none" stroke="#22c55e" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

// Animated "fade + slide up" like the web's motion.div cards.
function FadeIn({ delay = 0, style, children }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, delay: delay * 1000, useNativeDriver: true }).start();
  }, [anim, delay]);
  return (
    <Animated.View
      style={[style, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

function RefreshButton({ refreshing, onPress }) {
  const [rot] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!refreshing) return;
    rot.setValue(0);
    Animated.timing(rot, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [refreshing, rot]);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ marginLeft: 4 }}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshCw size={16} color="#ffffff" />
      </Animated.View>
    </Pressable>
  );
}

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      const { isDark } = this.props;
      return (
        <View
          style={[
            styles.mapFallback,
            { backgroundColor: isDark ? "#111827" : "#f3f4f6", borderColor: isDark ? "#1f2937" : "#e5e7eb", borderWidth: 1, borderRadius: 16 },
          ]}
        >
          <Text style={{ fontSize: 14, textAlign: "center", paddingHorizontal: 16, color: isDark ? "#9ca3af" : "#4b5563" }}>
            Live map unavailable right now
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function SectionItem({ Icon, iconNode, title, subtitle, onPress, showArrow = true, last = false, isDark }) {
  return (
    <>
      <ScalePressable scaleTo={0.99} onPress={onPress} disabled={!onPress} style={styles.sectionItem}>
        <View style={[styles.sectionIcon, { backgroundColor: isDark ? "#1f2937" : "#f3f4f6" }]}>
          {iconNode || <Icon size={20} color={isDark ? "#9ca3af" : "#4b5563"} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "500", color: isDark ? "#f3f4f6" : "#111827" }}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ fontSize: 14, color: isDark ? "#9ca3af" : "#6b7280" }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {showArrow ? <ChevronRight size={20} color={isDark ? "#6b7280" : "#9ca3af"} /> : null}
      </ScalePressable>
      {last ? null : <DashedLine color={isDark ? "#1f2937" : "#e5e7eb"} />}
    </>
  );
}

const toPoint = (coords) => {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

function resolveRestaurantPoint(order) {
  let coords = null;
  if (Array.isArray(order?.restaurantLocation?.coordinates) && order.restaurantLocation.coordinates.length >= 2) {
    coords = order.restaurantLocation.coordinates;
  } else if (Array.isArray(order?.restaurantId?.location?.coordinates) && order.restaurantId.location.coordinates.length >= 2) {
    coords = order.restaurantId.location.coordinates;
  } else if (order?.restaurantId?.location?.latitude && order?.restaurantId?.location?.longitude) {
    coords = [order.restaurantId.location.longitude, order.restaurantId.location.latitude];
  }
  const p = toPoint(coords);
  if (p) return p;
  const lat = Number(order?.restaurantId?.location?.latitude || order?.restaurant?.location?.latitude);
  const lng = Number(order?.restaurantId?.location?.longitude || order?.restaurant?.location?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// The web's DeliveryMap wrapper: resolves coordinates and renders the map or a grey block.
function DeliveryMap({ orderId, order, fallbackCustomerCoords, userLiveCoords, onEtaUpdate, isDark }) {
  const rp = resolveRestaurantPoint(order);
  const cp = toPoint(order?.address?.coordinates || order?.address?.location?.coordinates);
  const restaurantCoords = useMemo(() => (rp ? { lat: rp.lat, lng: rp.lng } : null), [rp?.lat, rp?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const customerCoords = useMemo(() => {
    if (cp) return { lat: cp.lat, lng: cp.lng };
    if (fallbackCustomerCoords && Number.isFinite(fallbackCustomerCoords.lat) && Number.isFinite(fallbackCustomerCoords.lng)) {
      return fallbackCustomerCoords;
    }
    return null;
  }, [cp?.lat, cp?.lng, fallbackCustomerCoords]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveCustomer = customerCoords || userLiveCoords || restaurantCoords || null;
  const effectiveRestaurant = restaurantCoords || effectiveCustomer || null;
  const trackingIds = useMemo(
    () => [order?.orderId, order?.mongoId, order?._id, orderId, order?.id].filter(Boolean),
    [order?.orderId, order?.mongoId, order?._id, orderId, order?.id],
  );

  if (!orderId || !order || !effectiveRestaurant || !effectiveCustomer) {
    return <View style={[styles.mapFallback, { backgroundColor: isDark ? "#121212" : "#e5e7eb" }]} />;
  }
  return (
    <View style={{ height: MAP_HEIGHT, width: "100%" }}>
      <DeliveryTrackingMap
        orderId={orderId}
        orderTrackingIds={trackingIds}
        restaurantCoords={effectiveRestaurant}
        customerCoords={effectiveCustomer}
        order={order}
        onEtaUpdate={onEtaUpdate}
      />
    </View>
  );
}

function isTerminal(o) {
  const ui = mapOrderToTrackingUiStatus(o);
  return ui === "delivered" || ui === "cancelled";
}

function getTimeRemaining(orderData) {
  if (!orderData) return null;
  const orderTime = new Date(orderData.scheduledAt || orderData.createdAt || orderData.orderDate || orderData.created_at || orderData.date || Date.now());
  const minutes = orderData.scheduledAt
    ? 0
    : orderData.estimatedDeliveryTime || orderData.estimatedTime || orderData.estimated_delivery_time || 35;
  const deliveryTime = new Date(orderTime.getTime() + minutes * 60000);
  return Math.max(0, Math.floor((deliveryTime - new Date()) / 60000));
}

function OrderTrackingScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const companyName = useCompanyName();
  const goBack = useAppBack();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams();
  const orderId = String(params.orderId || "");
  const confirmed = params.confirmed === "true";
  const { getOrderById } = useOrders();
  const { userProfile: profile, getDefaultAddress } = useProfile();
  const { location: userLiveLocation } = useAppLocation();
  const { isConnected: isSocketConnected, setOrderTrackingVisible } = useUserNotifications();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(confirmed);
  const [estimatedTime, setEstimatedTime] = useState(29);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [refundDestination, setRefundDestination] = useState("source");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [isUpdatingInstructions, setIsUpdatingInstructions] = useState(false);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [cancelSecondsRemaining, setCancelSecondsRemaining] = useState(0);
  const [socketDropOtpCode, setSocketDropOtpCode] = useState(null);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRestaurantRating, setSelectedRestaurantRating] = useState(null);
  const [selectedDeliveryRating, setSelectedDeliveryRating] = useState(null);
  const [restaurantFeedbackText, setRestaurantFeedbackText] = useState("");
  const [deliveryFeedbackText, setDeliveryFeedbackText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  const orderRef = useLatest(order);
  const lastRealtimeRefreshRef = useRef(0);
  const trackingOrderIdsRef = useRef(new Set());
  const terminalPollStopRef = useRef(false);
  const lookupIdsRef = useRef([]);
  const lastStatusToastRef = useRef({ key: "", at: 0 });
  const isRefreshingRef = useLatest(isRefreshing);

  // Suppress the app-wide status banners while this screen is focused (the web skipped its toasts here).
  useFocusEffect(
    useCallback(() => {
      setOrderTrackingVisible(true);
      return () => setOrderTrackingVisible(false);
    }, [setOrderTrackingVisible]),
  );

  // Free-cancel window: 65 s from creation, matching the backend.
  useEffect(() => {
    if (!order?.createdAt) return undefined;
    const calc = () => Math.max(0, Math.floor((65000 - (Date.now() - new Date(order.createdAt).getTime())) / 1000));
    setCancelSecondsRemaining(calc());
    const timer = setInterval(() => {
      const remaining = calc();
      setCancelSecondsRemaining(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [order?.createdAt]);

  // The web's `Number.isFinite(Number(null))` is true, so an unrated order counts as rated; kept as is.
  const hasRestaurantRating = Number.isFinite(Number(order?.ratings?.restaurant?.rating || order?.restaurantRating));
  const hasDeliveryPartner = !!(order?.deliveryPartnerId || order?.deliveryPartnerName);
  const hasDeliveryRating = Number.isFinite(Number(order?.ratings?.deliveryPartner?.rating || order?.deliveryPartnerRating));
  const isOrderRated = hasRestaurantRating && (!hasDeliveryPartner || hasDeliveryRating);

  const handleOpenRating = () => {
    setSelectedRestaurantRating(order?.ratings?.restaurant?.rating || order?.restaurantRating || null);
    setSelectedDeliveryRating(order?.ratings?.deliveryPartner?.rating || order?.deliveryPartnerRating || null);
    setRestaurantFeedbackText(order?.ratings?.restaurant?.comment || "");
    setDeliveryFeedbackText(order?.ratings?.deliveryPartner?.comment || "");
    setShowRatingModal(true);
  };

  const handleSubmitRating = async () => {
    const partner = !!(order?.deliveryPartnerId || order?.deliveryPartnerName);
    if (!order || selectedRestaurantRating === null || (partner && selectedDeliveryRating === null)) {
      toast.error("Please select all required ratings first");
      return;
    }
    try {
      setSubmittingRating(true);
      const res = await submitOrderRatings(order.mongoId || order._id || order.id, {
        restaurantRating: selectedRestaurantRating,
        deliveryPartnerRating: partner ? selectedDeliveryRating : undefined,
        restaurantComment: restaurantFeedbackText || undefined,
        deliveryPartnerComment: partner ? deliveryFeedbackText || undefined : undefined,
      });
      const updated = res?.data?.order || res?.order;
      if (updated) {
        setOrder((prev) => ({
          ...prev,
          ...updated,
          ratings: updated.ratings,
          restaurantRating: updated.ratings?.restaurant?.rating,
          deliveryPartnerRating: updated.ratings?.deliveryPartner?.rating,
        }));
      }
      toast.success("Thanks for your feedback!");
      setShowRatingModal(false);
    } catch (err) {
      toast.error(err?.data?.message || "Failed to submit ratings");
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleEtaUpdate = useCallback((newEta) => {
    if (typeof newEta === "string") {
      const match = newEta.match(/(\d+)/);
      if (match) {
        setEstimatedTime(parseInt(match[1], 10));
        return;
      }
    }
    if (typeof newEta === "number" && !Number.isNaN(newEta)) setEstimatedTime(newEta);
  }, []);

  // Drop OTP pushed over the socket (deliveryDropOtp).
  useNotificationEvent("deliveryDropOtp", (detail = {}) => {
    const otp = detail?.otp != null ? String(detail.otp) : null;
    const evtOrderId = detail?.orderId != null ? String(detail.orderId) : null;
    const evtMongoId = detail?.orderMongoId != null ? String(detail.orderMongoId) : null;
    if (!otp) return;
    const current = orderRef.current;
    const ids = [String(orderId)];
    if (current?.orderId) ids.push(String(current.orderId));
    if (current?.mongoId) ids.push(String(current.mongoId));
    if (current?._id) ids.push(String(current._id));
    if (!((evtOrderId && ids.includes(evtOrderId)) || (evtMongoId && ids.includes(evtMongoId)))) return;
    setSocketDropOtpCode(otp);
    setOrder((prev) => {
      if (!prev) return prev;
      const prevDV = prev.deliveryVerification || {};
      const prevDropOtp = prevDV.dropOtp || {};
      if (prevDropOtp.code === otp) return prev;
      return { ...prev, deliveryVerification: { ...prevDV, dropOtp: { ...prevDropOtp, required: true, verified: false, code: otp } } };
    });
  });

  // ETA, synced with the Home page's calculation every 30 s and counted down each minute.
  useEffect(() => {
    if (!order) return undefined;
    const tick = () => {
      const remaining = getTimeRemaining(order);
      if (remaining !== null) setEstimatedTime(remaining);
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [order]);

  useEffect(() => {
    const timer = setInterval(() => setEstimatedTime((prev) => Math.max(0, prev - 1)), 60000);
    return () => clearInterval(timer);
  }, []);

  // Ids that socket events may carry for this order.
  useEffect(() => {
    const s = trackingOrderIdsRef.current;
    s.add(String(orderId));
    if (order?.orderId) s.add(String(order.orderId));
    if (order?.mongoId) s.add(String(order.mongoId));
    if (order?.id) s.add(String(order.id));
  }, [orderId, order?.orderId, order?.mongoId, order?.id]);

  useEffect(() => {
    const ids = [orderId, order?.orderId, order?.mongoId, order?._id, order?.id].map(normalizeLookupId).filter(Boolean);
    lookupIdsRef.current = Array.from(new Set(ids));
  }, [orderId, order?.orderId, order?.mongoId, order?._id, order?.id]);

  const resolveOrderFromList = useCallback(async (rawLookupId) => {
    const needle = normalizeLookupId(rawLookupId);
    if (!needle) return null;
    for (let page = 1; page <= 3; page += 1) {
      const res = await getOrders({ page, limit: 50 });
      const list = extractOrderList(res);
      const matched = list.find((o) => [o?._id, o?.id, o?.orderId, o?.mongoId].map(normalizeLookupId).includes(needle));
      if (matched) return matched;
      const totalPages = Number(res?.data?.pagination?.pages) || Number(res?.data?.totalPages) || 1;
      if (page >= totalPages) break;
    }
    return null;
  }, []);

  const fetchOrderDetailsWithFallback = useCallback(async (options = {}) => {
    const ids = lookupIdsRef.current.length ? lookupIdsRef.current : [normalizeLookupId(orderId)].filter(Boolean);
    if (ids.length === 0) throw new Error("Order id required");
    let lastError = null;
    for (const id of ids) {
      try {
        return await getOrderDetails(id, options);
      } catch (err) {
        lastError = err;
        if (err?.status === 400 || err?.status === 404) continue;
        throw err;
      }
    }
    throw lastError || new Error("Failed to fetch order details");
  }, [orderId]);

  // Initial load + the poll function used by the interval.
  const pollRef = useRef(null);
  useEffect(() => {
    if (!orderId) return undefined;
    let subscribed = true;
    let inProgress = false;

    const poll = async (isInitial = false) => {
      if (!subscribed || inProgress) return;
      if (terminalPollStopRef.current && !isInitial) return;
      if (isInitial) {
        const seed = getOrderById(orderId);
        if (seed) {
          setOrder((prev) => transformOrderForTracking(seed, prev));
          setLoading(false);
        }
      }
      inProgress = true;
      try {
        const res = await fetchOrderDetailsWithFallback({ force: isInitial });
        if (!subscribed) return;
        let data = extractOrder(res);
        if (!data && isInitial) data = await resolveOrderFromList(orderId);
        if (data) {
          setOrder((prev) => {
            const next = transformOrderForTracking(data, prev);
            terminalPollStopRef.current = isTerminal(next);
            return next;
          });
          setError(null);
          setLoading(false);
          return;
        }
        if (isInitial && !orderRef.current) {
          setError(res?.message || "Order not found");
          terminalPollStopRef.current = true;
        }
      } catch (err) {
        if (isInitial && !orderRef.current) {
          try {
            const matched = await resolveOrderFromList(orderId);
            if (matched) {
              if (!subscribed) return;
              setOrder((prev) => transformOrderForTracking(matched, prev));
              setError(null);
              setLoading(false);
              return;
            }
          } catch {
            // fall through to the error state
          }
          if (!subscribed) return;
          setError(err?.data?.message || "Failed to fetch order details");
          terminalPollStopRef.current = true;
        } else if (err?.status === 404) {
          terminalPollStopRef.current = true;
          if (!subscribed) return;
          setError(err?.data?.message || "Order not found");
        }
      } finally {
        inProgress = false;
        if (isInitial && subscribed) setLoading(false);
      }
    };

    pollRef.current = poll;
    terminalPollStopRef.current = false;
    poll(true);
    return () => {
      subscribed = false;
    };
    // getOrderById changes with the local order list; the web re-ran too, but one load per order is enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, fetchOrderDetailsWithFallback, resolveOrderFromList]);

  // Polling fallback: 75 s while the socket is connected, 12 s while it is not.
  useEffect(() => {
    if (!orderId || !isFocused) return undefined;
    const interval = setInterval(
      () => {
        if (terminalPollStopRef.current || AppState.currentState !== "active") return;
        pollRef.current?.(false);
      },
      isSocketConnected ? 75000 : 12000,
    );
    return () => clearInterval(interval);
  }, [orderId, isSocketConnected, isFocused]);

  useEffect(() => {
    if (order) terminalPollStopRef.current = isTerminal(order);
  }, [order]);

  // Post-checkout splash: dismissed quickly once the order is ready.
  const hasOrder = Boolean(order);
  useEffect(() => {
    if (!confirmed) return undefined;
    const t = setTimeout(() => setShowConfirmation(false), hasOrder ? 700 : 1800);
    return () => clearTimeout(t);
  }, [confirmed, hasOrder]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchOrderDetailsWithFallback({ force: true });
      const apiOrder = extractOrder(res);
      if (apiOrder) {
        let restaurantCoords = null;
        let restaurantAddress = null;
        const loc = apiOrder.restaurantId?.location;
        if (Array.isArray(loc?.coordinates) && loc.coordinates.length >= 2) {
          restaurantCoords = loc.coordinates;
        } else if (loc?.latitude && loc?.longitude) {
          restaurantCoords = [loc.longitude, loc.latitude];
        } else if (apiOrder.restaurant?.location?.coordinates) {
          restaurantCoords = apiOrder.restaurant.location.coordinates;
        } else if (typeof apiOrder.restaurantId === "string") {
          try {
            const rRes = await getRestaurantById(apiOrder.restaurantId);
            const restaurant = rRes?.data?.restaurant;
            if (restaurant) {
              if (Array.isArray(restaurant.location?.coordinates) && restaurant.location.coordinates.length >= 2) {
                restaurantCoords = restaurant.location.coordinates;
              }
              restaurantAddress = restaurant?.location?.formattedAddress || restaurant?.location?.address || restaurant?.address || null;
            }
          } catch {
            // keep the order without restaurant coordinates
          }
        }
        setOrder((prev) => transformOrderForTracking(apiOrder, prev, restaurantCoords, restaurantAddress));
      }
    } catch {
      // the next poll retries
    } finally {
      setIsRefreshing(false);
    }
  };
  const handleRefreshRef = useLatest(handleRefresh);

  // Status updates from the shared socket (orderStatusNotification).
  useNotificationEvent("orderStatusNotification", (payload = {}) => {
    const { message, status, estimatedDeliveryTime, orderId: evtOrderId, orderMongoId } = payload;
    const evtKeys = [evtOrderId, orderMongoId, payload?._id].filter(Boolean).map(String);
    const idMatches =
      evtKeys.length === 0 || evtKeys.some((k) => k === String(orderId)) || evtKeys.some((k) => trackingOrderIdsRef.current.has(k));
    if (!idMatches) return;

    setOrder((prev) => (prev ? transformOrderForTracking(patchOrderFromSocketPayload(prev, payload), prev) : prev));
    const needsRefetch = socketPayloadNeedsRefetch(payload, payload.orderStatus || status);
    const now = Date.now();
    if (needsRefetch && now - lastRealtimeRefreshRef.current > 30000 && !isRefreshingRef.current) {
      lastRealtimeRefreshRef.current = now;
      handleRefreshRef.current();
    } else if (!orderRef.current && now - lastRealtimeRefreshRef.current > 2000) {
      lastRealtimeRefreshRef.current = now;
      handleRefreshRef.current();
    }

    if (message) {
      const key = `${String(evtOrderId || orderMongoId || orderId)}:${String(status || payload.orderStatus || "")}`;
      if (key === lastStatusToastRef.current.key && now - lastStatusToastRef.current.at < 4000) return;
      lastStatusToastRef.current = { key, at: now };
      toast.dismiss("order-tracking-status-update");
      toast.success(message, {
        id: "order-tracking-status-update",
        duration: 5000,
        description: estimatedDeliveryTime ? `Estimated delivery in ${Math.round(estimatedDeliveryTime / 60)} minutes` : undefined,
      });
      // navigator.vibrate([200, 100, 200])
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  });

  const orderStatus = order ? mapOrderToTrackingUiStatus(order) : "placed";
  const isFinal = orderStatus === "delivered" || orderStatus === "cancelled";

  const defaultAddress = getDefaultAddress();
  const fallbackCustomerCoords = useMemo(() => {
    const fromOrder = toPoint(order?.address?.coordinates || order?.address?.location?.coordinates);
    if (fromOrder) return fromOrder;
    const objO = order?.address?.location || order?.address;
    const oLat = Number(objO?.lat ?? objO?.latitude);
    const oLng = Number(objO?.lng ?? objO?.longitude);
    if (Number.isFinite(oLat) && Number.isFinite(oLng)) return { lat: oLat, lng: oLng };
    const fromDefault = toPoint(defaultAddress?.location?.coordinates);
    if (fromDefault) return fromDefault;
    const objD = defaultAddress?.location || defaultAddress;
    const dLat = Number(objD?.lat ?? objD?.latitude);
    const dLng = Number(objD?.lng ?? objD?.longitude);
    if (Number.isFinite(dLat) && Number.isFinite(dLng)) return { lat: dLat, lng: dLng };
    const lLat = Number(userLiveLocation?.latitude);
    const lLng = Number(userLiveLocation?.longitude);
    if (Number.isFinite(lLat) && Number.isFinite(lLng)) return { lat: lLat, lng: lLng };
    return null;
  }, [order?.address, defaultAddress, userLiveLocation?.latitude, userLiveLocation?.longitude]);

  const userLiveCoords = useMemo(() => {
    const lat = Number(userLiveLocation?.latitude);
    const lng = Number(userLiveLocation?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [userLiveLocation?.latitude, userLiveLocation?.longitude]);

  const isAdminAccepted = ["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up"].includes(order?.status);
  const acceptedAtMs = useMemo(() => {
    const ts = order?.tracking?.confirmed?.timestamp || order?.tracking?.preparing?.timestamp || order?.updatedAt || order?.createdAt;
    const parsed = ts ? new Date(ts).getTime() : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [order?.tracking?.confirmed?.timestamp, order?.tracking?.preparing?.timestamp, order?.updatedAt, order?.createdAt]);
  const editWindowRemainingMs = isAdminAccepted && acceptedAtMs ? Math.max(0, 60000 - (timerNow - acceptedAtMs)) : 0;
  const isEditWindowOpen = editWindowRemainingMs > 0;

  useEffect(() => {
    if (!isEditWindowOpen) return undefined;
    const interval = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isEditWindowOpen]);

  const customerDeliveryOtp = isFinal ? null : order?.deliveryVerification?.dropOtp?.code ?? socketDropOtpCode;

  const handleCallRestaurant = () =>
    dialPhone(
      order?.restaurantPhone ||
        order?.restaurantId?.phone ||
        order?.restaurantId?.ownerPhone ||
        order?.restaurantId?.contact?.phone ||
        order?.restaurant?.phone ||
        order?.restaurant?.ownerPhone ||
        order?.restaurantId?.location?.phone ||
        "",
      "Restaurant phone number not available",
    );
  const handleCallRider = () => dialPhone(order?.deliveryPartner?.phone || "", "Rider phone number not available");

  const handleCancelOrder = () => {
    if (!order) return;
    if (isAdminAccepted && !isEditWindowOpen) {
      toast.error("Cancellation window ended. You can no longer cancel this order.");
      return;
    }
    if (order.status === "cancelled") {
      toast.error("Order is already cancelled");
      return;
    }
    if (order.status === "delivered") {
      toast.error("Cannot cancel a delivered order");
      return;
    }
    setRefundDestination(isRazorpayPaid(order) ? "source" : "wallet");
    setShowCancelDialog(true);
  };

  const closeCancelDialog = () => {
    setShowCancelDialog(false);
    setCancellationReason("");
    setRefundDestination("source");
  };

  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }
    setIsCancelling(true);
    try {
      const lookupId = lookupIdsRef.current[0] || normalizeLookupId(orderId);
      const paid = isRazorpayPaid(order);
      const res = await cancelOrder(lookupId, { reason: cancellationReason.trim(), ...(paid ? { refundDestination } : {}) });
      if (res?.success) {
        const method = order?.payment?.method || order?.paymentMethod;
        toast.success(
          res?.message ||
            (method === "cash" || method === "cod"
              ? "Order cancelled successfully. No refund required as payment was not made."
              : refundDestination === "wallet"
                ? "Order cancelled successfully. Refund has been added to your wallet."
                : "Order cancelled successfully. Refund will be processed to your original payment method."),
        );
        closeCancelDialog();
        const fresh = await fetchOrderDetailsWithFallback({ force: true });
        const apiOrder = fresh?.success ? fresh?.data?.order : null;
        if (apiOrder) setOrder((prev) => transformOrderForTracking(apiOrder, prev));
      } else {
        toast.error(res?.message || "Failed to cancel order");
      }
    } catch (err) {
      toast.error(err?.data?.message || "Failed to cancel order");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateInstructions = async () => {
    try {
      setIsUpdatingInstructions(true);
      const res = await updateOrderInstructions(orderId, deliveryInstructions);
      if (res?.success) {
        toast.success("Delivery instructions updated");
        setIsInstructionsModalOpen(false);
        const updated = res?.data?.order;
        if (updated) setOrder((prev) => transformOrderForTracking(updated, prev));
        else setOrder((prev) => ({ ...prev, note: deliveryInstructions }));
      } else {
        toast.error(res?.message || "Failed to update instructions");
      }
    } catch (err) {
      toast.error(err?.data?.message || "Failed to update instructions");
    } finally {
      setIsUpdatingInstructions(false);
    }
  };

  const handleShare = async () => {
    const url = `${ASSET_ORIGIN}/food/user/orders/${orderId}`;
    try {
      await Share.share({
        title: `Track my order from ${order?.restaurant || companyName}`,
        message: `Hey! Track my order from ${order?.restaurant || companyName} with ID #${order?.orderId || order?.id}.\n${url}`,
      });
    } catch {
      toast.error("Failed to share link");
    }
  };

  const pageBg = isDark ? "#0a0a0a" : "#f3f4f6";
  const cardBg = isDark ? "#1a1a1a" : "#ffffff";

  if (loading || error || !order) {
    return (
      <Screen background={isDark ? "#0a0a0a" : "#f9fafb"}>
        <View style={{ padding: 16, paddingVertical: 80, alignItems: "center" }}>
          {loading ? (
            <>
              <Spinner size={32} color={isDark ? "#9ca3af" : "#4b5563"} style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 16, color: isDark ? "#9ca3af" : "#4b5563" }}>Loading order details...</Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 16, color: isDark ? "#f3f4f6" : "#111827" }}>Order Not Found</Text>
              <Text style={{ fontSize: 16, marginBottom: 24, textAlign: "center", color: isDark ? "#9ca3af" : "#4b5563" }}>
                {error || "The order you're looking for doesn't exist."}
              </Text>
              <Button title="Back to Orders" onPress={() => goTo("/orders")} />
            </>
          )}
        </View>
      </Screen>
    );
  }

  const statusConfig = {
    placed: { title: "Order Placed", subtitle: "Waiting for restaurant to accept", color: GREEN, iconType: "food" },
    confirmed: { title: "Order Confirmed", subtitle: "Restaurant has accepted your order", color: GREEN, iconType: "food" },
    preparing: { title: "Food is being prepared", subtitle: `Arriving in ${estimatedTime} mins`, color: GREEN, iconType: "food" },
    assigned: { title: "Rider is arriving", subtitle: "A delivery partner is arriving at the restaurant", color: GREEN, iconType: "rider" },
    at_pickup: { title: "Rider at restaurant", subtitle: "Rider is waiting for your order", color: GREEN, iconType: "rider" },
    ready: { title: "Handover in progress", subtitle: "Rider is picking up your order", color: GREEN, iconType: "rider" },
    on_way: { title: "Out for delivery", subtitle: `Arriving in ${estimatedTime} mins`, color: GREEN, iconType: "rider" },
    at_drop: { title: "Arrived at location", subtitle: "Please come to the door", color: GREEN, iconType: "rider" },
    delivered: { title: "Order delivered", subtitle: "Enjoy your meal!", color: GREEN, iconType: "delivered" },
    cancelled: { title: "Order cancelled", subtitle: order?.cancellationReason || "This order has been cancelled", color: RED, iconType: "cancelled" },
    dead: {
      title: "Order Delivery Failed",
      subtitle: "We're extremely sorry for the inconvenience. Your order could not be completed.",
      color: RED,
      iconType: "cancelled",
    },
  };
  const currentStatus = statusConfig[orderStatus] || statusConfig.placed;
  const isScheduledOrder = Boolean(order?.scheduledAt) && !isFinal;
  const scheduledEarly = isScheduledOrder && ["placed", "confirmed"].includes(orderStatus);
  const scheduledDateFormatted = order?.scheduledAt ? dayjs(order.scheduledAt).format("ddd, D MMM, hh:mm a") : null;
  const isDeliveredOrder = orderStatus === "delivered" || order?.status === "delivered" || Boolean(order?.deliveredAt);

  const iconBg = {
    rider: isDark ? "rgba(30,58,138,0.2)" : "#eff6ff",
    cancelled: isDark ? "rgba(127,29,29,0.2)" : "#fef2f2",
    delivered: isDark ? "rgba(20,83,45,0.2)" : "#f0fdf4",
    food: isDark ? "rgba(124,45,18,0.2)" : "#fff7ed",
  }[currentStatus.iconType];

  const deliverySubtitle = (() => {
    const a = order?.address;
    if (a?.formattedAddress && a.formattedAddress !== "Select location") return a.formattedAddress;
    if (a) {
      const parts = [a.street, a.additionalDetails, a.city, a.state, a.zipCode].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
    if (defaultAddress?.formattedAddress && defaultAddress.formattedAddress !== "Select location") return defaultAddress.formattedAddress;
    if (defaultAddress) {
      const parts = [defaultAddress.street, defaultAddress.additionalDetails, defaultAddress.city, defaultAddress.state, defaultAddress.zipCode].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
    return "Add delivery address";
  })();

  const textMain = isDark ? "#f3f4f6" : "#111827";
  const textSub = isDark ? "#9ca3af" : "#6b7280";
  const dashColor = isDark ? "#1f2937" : "#e5e7eb";
  const pillBg = "rgba(255,255,255,0.2)";

  return (
    <Screen edges={[]} background={pageBg} statusBarStyle="light">
      <View style={{ backgroundColor: currentStatus.color, paddingTop: insets.top, zIndex: 40 }}>
        <View style={styles.nav}>
          <ScalePressable scaleTo={0.9} onPress={goBack} style={styles.navBtn}>
            <ArrowLeft size={24} color="#ffffff" />
          </ScalePressable>
          <Text numberOfLines={1} style={styles.navTitle}>
            {order.restaurant}
          </Text>
          <ScalePressable scaleTo={0.9} onPress={handleShare} style={styles.navBtn}>
            <Share2 size={20} color="#ffffff" />
          </ScalePressable>
        </View>

        {scheduledEarly ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 20, alignItems: "center" }}>
            <View style={[styles.pill, { backgroundColor: pillBg, paddingVertical: 6, marginBottom: 12 }]}>
              <Clock size={16} color="#ffffff" />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ffffff" }}>Scheduled Order</Text>
            </View>
            <Text style={styles.statusTitle}>Order Scheduled</Text>
            <View style={[styles.pill, { backgroundColor: pillBg, paddingHorizontal: 20, paddingVertical: 10 }]}>
              <Calendar size={16} color="#ffffff" />
              <Text style={{ fontSize: 14, fontWeight: "500", color: "#ffffff" }}>{scheduledDateFormatted}</Text>
              <View style={styles.dotSmall} />
              <RefreshButton refreshing={isRefreshing} onPress={handleRefresh} />
            </View>
            <Text style={{ fontSize: 12, marginTop: 12, color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
              The restaurant will start preparing your order closer to the scheduled time
            </Text>
          </View>
        ) : !["at_pickup", "ready", "on_way", "at_drop", "delivered"].includes(orderStatus) ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, alignItems: "center" }}>
            <Text style={[styles.statusTitle, { marginBottom: 12 }]}>{currentStatus.title}</Text>
            <View style={[styles.pill, { backgroundColor: pillBg }]}>
              <Text style={{ fontSize: 14, color: "#ffffff", textAlign: "center", flexShrink: 1 }}>{currentStatus.subtitle}</Text>
              {orderStatus === "preparing" ? (
                <>
                  <View style={[styles.dotSmall, { backgroundColor: "#ffffff" }]} />
                  <Text style={{ fontSize: 14, color: "#fed7aa" }}>On time</Text>
                </>
              ) : null}
              <RefreshButton refreshing={isRefreshing} onPress={handleRefresh} />
            </View>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}>
        {!isDeliveredOrder && orderStatus !== "cancelled" && orderStatus !== "dead" && !scheduledEarly ? (
          <MapErrorBoundary isDark={isDark}>
            <DeliveryMap
              orderId={orderId}
              order={order}
              fallbackCustomerCoords={fallbackCustomerCoords}
              userLiveCoords={userLiveCoords}
              onEtaUpdate={handleEtaUpdate}
              isDark={isDark}
            />
          </MapErrorBoundary>
        ) : null}

        <View style={styles.content}>
          {customerDeliveryOtp && orderStatus !== "dead" ? (
            <FadeIn
              delay={0.28}
              style={[
                styles.otpCard,
                { backgroundColor: isDark ? "rgba(30,58,138,0.1)" : "#eff6ff", borderColor: isDark ? "rgba(30,58,138,0.3)" : "#dbeafe" },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.6, color: isDark ? "#60a5fa" : "#1d4ed8" }}>DELIVERY OTP</Text>
              <Text style={{ fontSize: 24, fontWeight: "800", letterSpacing: 2.4, marginTop: 4, color: isDark ? "#bfdbfe" : "#1e3a8a" }}>
                {String(customerDeliveryOtp)}
              </Text>
              <Text style={{ fontSize: 12, marginTop: 4, color: isDark ? "#60a5fa" : "#1d4ed8" }}>
                Share this 4-digit OTP with your delivery partner at drop-off.
              </Text>
            </FadeIn>
          ) : null}

          <FadeIn delay={0.3} style={[styles.card, { backgroundColor: cardBg, padding: 12 }]}>
            {scheduledEarly ? (
              <View style={styles.statusRow}>
                <View style={[styles.statusIcon, { backgroundColor: "#eff6ff", borderColor: "#dbeafe" }]}>
                  <Clock size={28} color="#2563eb" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: textMain }}>Order Scheduled</Text>
                  <Text style={{ fontSize: 14, marginTop: 4, color: textSub }}>{scheduledDateFormatted}</Text>
                  <Text style={{ fontSize: 12, marginTop: 4, color: isDark ? "#60a5fa" : "#2563eb" }}>
                    We&apos;ll notify you when the restaurant starts preparing
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.statusRow}>
                <View style={[styles.statusIcon, { backgroundColor: iconBg, borderColor: isDark ? "#1f2937" : "#f3f4f6" }]}>
                  {currentStatus.iconType === "rider" ? (
                    <RiderBikeIcon size={56} />
                  ) : currentStatus.iconType === "cancelled" ? (
                    <X size={40} color="#ef4444" />
                  ) : currentStatus.iconType === "delivered" ? (
                    <Check size={40} color="#22c55e" />
                  ) : (
                    <Receipt size={40} color="#f97316" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: textMain }}>{currentStatus.title}</Text>
                  <Text style={{ fontSize: 14, marginTop: 4, color: textSub }}>{currentStatus.subtitle}</Text>
                  {orderStatus === "dead" ? (
                    <View
                      style={[
                        styles.deadBox,
                        { backgroundColor: isDark ? "rgba(127,29,29,0.2)" : "#fef2f2", borderColor: isDark ? "rgba(127,29,29,0.3)" : "#fee2e2" },
                      ]}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "500", marginBottom: 8, color: isDark ? "#fca5a5" : "#b91c1c" }}>
                        If your money was deducted, it will be automatically refunded. Please reach out to support for instant help.
                      </Text>
                      <Pressable onPress={() => Linking.openURL("tel:+919755633147").catch(() => {})} style={styles.supportBtn}>
                        <Phone size={12} color="#ffffff" />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff" }}>Contact Admin Support</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </FadeIn>

          {orderStatus === "delivered" && !isOrderRated ? (
            <FadeIn delay={0.45} style={[styles.card, { backgroundColor: cardBg, padding: 24, borderWidth: 2, borderColor: colors.primary + "1A" }]}>
              <View style={{ alignItems: "center" }}>
                <View style={[styles.rateIcon, { backgroundColor: colors.primary + (isDark ? "33" : "1A") }]}>
                  <Star size={32} color={colors.primary} fill={colors.primary} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: "700", color: textMain }}>Enjoyed your food?</Text>
                <Text style={{ fontSize: 14, marginTop: 8, marginBottom: 24, maxWidth: 280, textAlign: "center", color: textSub }}>
                  Rate your experience with{" "}
                  <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? "#d1d5db" : "#374151" }}>{order?.restaurant}</Text> and help us
                  improve!
                </Text>
                <Pressable onPress={handleOpenRating} style={[styles.rateBtn, { backgroundColor: colors.primary }]}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>Rate Order</Text>
                </Pressable>
              </View>
            </FadeIn>
          ) : null}

          {orderStatus === "delivered" && isOrderRated ? (
            <FadeIn style={[styles.card, { backgroundColor: cardBg, padding: 20, borderWidth: 1, borderColor: isDark ? "#1f2937" : "#f3f4f6" }]}>
              <View style={[styles.feedbackHead, { borderBottomColor: isDark ? "rgba(31,41,55,0.5)" : "#f9fafb" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" }} />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: textMain }}>Your Feedback</Text>
                </View>
                <Pressable onPress={handleOpenRating} hitSlop={8}>
                  <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1, color: isDark ? "#fb923c" : colors.primary }}>EDIT RATING</Text>
                </Pressable>
              </View>
              <View style={{ gap: 16 }}>
                {[
                  ["Food & Restaurant", order?.ratings?.restaurant?.comment, order?.ratings?.restaurant?.rating || order?.restaurantRating, true],
                  ["Delivery Service", order?.ratings?.deliveryPartner?.comment, order?.ratings?.deliveryPartner?.rating || order?.deliveryPartnerRating, hasDeliveryPartner],
                ]
                  .filter((row) => row[3])
                  .map(([label, comment, value]) => (
                    <View key={label} style={styles.feedbackRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: isDark ? "#d1d5db" : "#374151" }}>{label}</Text>
                        {comment ? (
                          <Text numberOfLines={1} style={{ fontSize: 10, fontStyle: "italic", marginTop: 2, color: textSub }}>
                            &quot;{comment}&quot;
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={14}
                            color={star <= value ? "#facc15" : isDark ? "#1f2937" : "#e5e7eb"}
                            fill={star <= value ? "#facc15" : "transparent"}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
              </View>
            </FadeIn>
          ) : null}

          {order?.deliveryPartnerId ? (
            <FadeIn delay={0.55} style={[styles.card, { backgroundColor: cardBg, overflow: "hidden" }]}>
              <View style={styles.partnerRow}>
                <View
                  style={[
                    styles.partnerAvatar,
                    { backgroundColor: isDark ? "rgba(30,58,138,0.2)" : "#eff6ff", borderColor: isDark ? "rgba(30,58,138,0.3)" : "#dbeafe" },
                  ]}
                >
                  {order.deliveryPartner?.avatar ? (
                    <AppImage src={order.deliveryPartner.avatar} width={48} placeholderType="none" style={{ width: "100%", height: "100%" }} />
                  ) : (
                    <RiderBikeIcon size={32} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: textMain }}>{order.deliveryPartner?.name || "Delivery Partner"}</Text>
                  <Text style={{ fontSize: 14, color: textSub }}>
                    {orderStatus === "delivered" ? "Delivered your order" : "Your delivery partner is arriving"}
                  </Text>
                </View>
                <ScalePressable scaleTo={0.9} onPress={handleCallRider} style={[styles.callBtn, { backgroundColor: "#eff6ff" }]}>
                  <Phone size={20} color="#2563eb" />
                </ScalePressable>
              </View>
              <DashedLine color={dashColor} />
              {order?.note ? (
                <View
                  style={[
                    styles.riderNote,
                    { backgroundColor: isDark ? "rgba(30,58,138,0.1)" : "rgba(239,246,255,0.5)", borderColor: isDark ? "rgba(30,58,138,0.2)" : "#dbeafe" },
                  ]}
                >
                  <MessageSquare size={16} color="#3b82f6" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2, color: isDark ? "#60a5fa" : "#2563eb" }}>
                      INSTRUCTION FOR RIDER
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "500", color: isDark ? "#d1d5db" : "#374151" }}>&quot;{order.note}&quot;</Text>
                  </View>
                </View>
              ) : null}
            </FadeIn>
          ) : null}

          {!isFinal ? (
            <FadeIn
              delay={0.65}
              style={[styles.yellow, { backgroundColor: isDark ? "rgba(113,63,18,0.1)" : "#fefce8", borderColor: isDark ? "rgba(113,63,18,0.3)" : "#e5e7eb" }]}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", textAlign: "center", color: isDark ? "#facc15" : "#854d0e" }}>
                All your delivery details in one place 🥡
              </Text>
            </FadeIn>
          ) : null}

          <FadeIn delay={0.7} style={[styles.card, { backgroundColor: cardBg, overflow: "hidden" }]}>
            <SectionItem
              Icon={User}
              title={order?.userName || order?.userId?.fullName || order?.userId?.name || profile?.fullName || profile?.name || "Customer"}
              subtitle={order?.userPhone || order?.userId?.phone || profile?.phone || defaultAddress?.phone || "Phone number not available"}
              showArrow={false}
              isDark={isDark}
            />
            <SectionItem
              iconNode={<CustomerPinIcon size={24} />}
              title="Delivery at Location"
              subtitle={deliverySubtitle}
              showArrow={false}
              last={!(!isAdminAccepted && !isFinal)}
              isDark={isDark}
            />
            {!isAdminAccepted && !isFinal ? (
              <SectionItem
                Icon={MessageSquare}
                title={order?.note ? "Edit delivery instructions" : "Add delivery instructions"}
                subtitle={order?.note ? order.note.substring(0, 35) + (order.note.length > 35 ? "..." : "") : ""}
                onPress={() => {
                  setDeliveryInstructions(order?.note || "");
                  setIsInstructionsModalOpen(true);
                }}
                last
                isDark={isDark}
              />
            ) : null}
          </FadeIn>

          <FadeIn delay={0.75} style={[styles.card, { backgroundColor: cardBg, overflow: "hidden" }]}>
            <View style={styles.partnerRow}>
              <View style={[styles.restaurantIcon, { backgroundColor: "#ffedd5" }]}>
                <RestaurantPinIcon size={28} withDoors />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: textMain }}>{order.restaurant}</Text>
                <Text style={{ fontSize: 14, color: textSub }}>{order.restaurantAddress || "Restaurant location"}</Text>
              </View>
              <ScalePressable scaleTo={0.9} onPress={handleCallRestaurant} style={[styles.callBtn, { backgroundColor: "#fff7ed" }]}>
                <Phone size={20} color={colors.primary} />
              </ScalePressable>
            </View>
            <DashedLine color={dashColor} />
            <Pressable onPress={() => setShowOrderDetails(true)} style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <Receipt size={20} color="#6b7280" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  {order?.items?.map((item, index) => (
                    <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={styles.greenBox}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" }} />
                      </View>
                      <Text style={{ fontSize: 14, flexShrink: 1, color: isDark ? "#9ca3af" : "#4b5563" }}>
                        {item.quantity} x {item.name}
                        {item.variantName ? ` (${item.variantName})` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </View>
            </Pressable>
            <DashedLine color={dashColor} />
          </FadeIn>

          {cancelSecondsRemaining > 0 && !isFinal ? (
            <FadeIn delay={0.8} style={{ gap: 12 }}>
              <Pressable onPress={handleCancelOrder} style={styles.cancelBtn}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#dc2626" }}>Cancel Order ({cancelSecondsRemaining}s)</Text>
              </Pressable>
              <Text style={{ fontSize: 10, textAlign: "center", paddingHorizontal: 16, color: "#9ca3af" }}>
                You can cancel your order for free within the next {cancelSecondsRemaining} seconds.
              </Text>
            </FadeIn>
          ) : null}
        </View>
      </ScrollView>

      <CancelOrderDialog
        visible={showCancelDialog}
        order={order}
        reason={cancellationReason}
        onReason={setCancellationReason}
        refundDestination={refundDestination}
        onRefundDestination={setRefundDestination}
        cancelling={isCancelling}
        onClose={closeCancelDialog}
        onConfirm={handleConfirmCancel}
      />
      <OrderDetailsDialog visible={showOrderDetails} order={order} onClose={() => setShowOrderDetails(false)} />
      <InstructionsDialog
        visible={isInstructionsModalOpen}
        value={deliveryInstructions}
        onChange={setDeliveryInstructions}
        saving={isUpdatingInstructions}
        onSave={handleUpdateInstructions}
        onClose={() => setIsInstructionsModalOpen(false)}
      />
      <TrackingRatingDialog
        visible={showRatingModal}
        order={order}
        hasDeliveryPartner={hasDeliveryPartner}
        restaurantRating={selectedRestaurantRating}
        deliveryRating={selectedDeliveryRating}
        restaurantText={restaurantFeedbackText}
        deliveryText={deliveryFeedbackText}
        onRestaurantRating={setSelectedRestaurantRating}
        onDeliveryRating={setSelectedDeliveryRating}
        onRestaurantText={setRestaurantFeedbackText}
        onDeliveryText={setDeliveryFeedbackText}
        submitting={submittingRating}
        onSubmit={handleSubmitRating}
        onClose={() => setShowRatingModal(false)}
      />

      {showConfirmation ? (
        <View style={[StyleSheet.absoluteFill, styles.confirm, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
          <AnimatedCheckmark />
          <Text style={{ fontSize: 24, fontWeight: "700", marginTop: 24, textAlign: "center", color: textMain }}>
            {isScheduledOrder ? "Order Scheduled!" : "Order Confirmed!"}
          </Text>
          <Text style={{ fontSize: 16, marginTop: 8, textAlign: "center", color: isDark ? "#d1d5db" : "#4b5563" }}>
            {isScheduledOrder ? `Scheduled for ${scheduledDateFormatted}` : "Your order has been placed successfully"}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

export default withProtected(OrderTrackingScreen);

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600", color: "#ffffff" },
  statusTitle: { fontSize: 24, fontWeight: "700", color: "#ffffff", marginBottom: 8, textAlign: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  dotSmall: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)" },
  mapFallback: { height: MAP_HEIGHT, width: "100%", alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingVertical: 16, gap: 16 },
  otpCard: { borderRadius: 12, padding: 16, borderWidth: 1, ...shadow.sm },
  card: { borderRadius: 12, ...shadow.sm },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadow.sm,
  },
  deadBox: { marginTop: 12, padding: 12, borderRadius: 8, borderWidth: 1 },
  supportBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    ...shadow.sm,
  },
  rateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  rateBtn: { width: "100%", maxWidth: 200, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", ...shadow.lg },
  feedbackHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  feedbackRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  partnerRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    padding: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  callBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  riderNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, marginHorizontal: 16, marginBottom: 16, borderRadius: 8, borderWidth: 1 },
  yellow: { borderRadius: 12, padding: 16, borderWidth: 1 },
  sectionItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  sectionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  greenBox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: "#16a34a", alignItems: "center", justifyContent: "center" },
  cancelBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fee2e2",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  confirm: { zIndex: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
});
