// The new-order popup and the reject-reason popup from pages/restaurant/OrdersMain.jsx, mounted
// once by the protected layout so an order can be accepted from any screen (the web showed it only
// on OrdersMain). State (queue, 180 s deadline, auto-reject, ring) lives in
// RestaurantNotificationsContext; this renders it and owns the toasts OrdersMain showed for it.
// It is an RN Modal so it stays above any screen sheet; a Toaster inside the Modal keeps the
// toasts visible above it, as sonner's were on web. Android back closes only the reject popup
// (as its Cancel does); the order popup itself cannot be dismissed by back, as on web.
import dayjs from "dayjs";
import { Calendar, ChevronDown, ChevronUp, FileText, Minus, Plus, Printer } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { isCancelledStatus } from "../../api/orders";
import {
  ACCEPT_WINDOW_SECONDS,
  useAcceptCountdown,
  useRestaurantEvents,
  useRestaurantNotifications,
} from "../../context/RestaurantNotificationsContext";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";
import { toast, Toaster } from "../ui/Toast";
import { printOrderReceipt } from "./printReceipt";

const REJECT_REASONS = [
  "Restaurant is too busy",
  "Item not available",
  "Outside delivery area",
  "Kitchen closing soon",
  "Technical issue",
  "Other reason",
];
const DEFAULT_PREP_TIME = 11;

const C = {
  red500: "#fb2c36",
  red600: "#e7000b",
  red700: "#c10007",
  red200: "#ffc9c9",
  green50: "#f0fdf4",
  green100: "#dcfce7",
  green200: "#b9f8cf",
  green500: "#00c950",
  green600: "#00a63e",
  green800: "#016630",
  green900: "#0d542b",
  blue50: "#eff6ff",
  blue200: "#bedbff",
  blue600: "#155dfc",
  blue800: "#193cb8",
  blue900: "#1c398e",
  orange50: "#fff7ed",
  orange600: "#f54900",
  orange700: "#ca3500",
  amber600: "#e17100",
};

const normalizeStatus = (v) =>
  String(v || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

// OrdersMain getPopupOrderTotal
function getPopupOrderTotal(o) {
  if (!o) return 0;
  const direct = Number(o.total);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const pricing = Number(o.pricing?.total);
  if (Number.isFinite(pricing) && pricing > 0) return pricing;
  const due = Number(o.payment?.amountDue);
  if (Number.isFinite(due) && due > 0) return due;
  const items = Array.isArray(o.items) ? o.items : [];
  const sum = items.reduce((acc, item) => {
    const price = Number(item?.price || 0);
    const qty = Number(item?.quantity || 0);
    return acc + (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 0);
  }, 0);
  return Number.isFinite(sum) ? sum : 0;
}

const orderKey = (o) => String(o?.orderMongoId || o?._id || o?.orderId || o?.id || "");

function DocIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </Svg>
  );
}

function CartIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </Svg>
  );
}

function ReceiptIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 13l4 4L19 7" />
    </Svg>
  );
}

// animate-pulse
function usePulse() {
  const [anim] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return anim;
}

function MoreBadge({ count }) {
  const pulse = usePulse();
  return (
    <Animated.View style={[styles.moreBadge, { opacity: pulse }]}>
      <Text style={styles.moreBadgeText}>+{count} more</Text>
    </Animated.View>
  );
}

// "Slide to accept (mm:ss)": blue countdown bar over a gray-900 track and a white handle. A tap
// on the handle accepts too (the web's onClick on the handle).
function AcceptSlider({ countdown, accepting, onAccept, progress }) {
  const [width, setWidth] = useState(0);
  const [bar] = useState(() => new Animated.Value(countdown / ACCEPT_WINDOW_SECONDS));
  const start = useRef({ x: 0, y: 0 });
  useEffect(() => {
    Animated.timing(bar, {
      toValue: countdown / ACCEPT_WINDOW_SECONDS,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [countdown, bar]);

  // getAcceptSliderMetrics: maxTravel = width - 56 - 8 * 2 (swipe progress)
  const maxTravel = Math.max((width || 320) - 56 - 16, 1);
  // handle travel as displayed: width - 40 - 16
  const travel = Math.max((width || 320) - 40 - 16, 0);
  const progressFor = (e) => Math.min(Math.max(e.nativeEvent.pageX - start.current.x, 0) / maxTravel, 1);

  return (
    <View style={styles.slider} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.sliderBar, { transform: [{ scaleX: bar }] }]} />
      <View style={styles.sliderLabelWrap} pointerEvents="none">
        <Text style={styles.sliderLabel}>
          {accepting ? "Accepting order..." : `Slide to accept (${formatTime(countdown)})`}
        </Text>
      </View>
      <Animated.View
        accessibilityRole="button"
        accessibilityLabel="Slide to accept"
        onStartShouldSetResponder={() => !accepting}
        onMoveShouldSetResponder={() => !accepting}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        }}
        onResponderMove={(e) => {
          if (!accepting) progress.setValue(progressFor(e));
        }}
        onResponderRelease={(e) => {
          if (accepting) return;
          const dx = e.nativeEvent.pageX - start.current.x;
          const dy = e.nativeEvent.pageY - start.current.y;
          // A tap on the handle accepts (web onClick); a swipe past 45 % accepts.
          if ((Math.abs(dx) < 6 && Math.abs(dy) < 6) || progressFor(e) >= 0.45) onAccept();
          else progress.setValue(0);
        }}
        onResponderTerminate={() => {
          if (!accepting) progress.setValue(0);
        }}
        style={[
          styles.handle,
          accepting && styles.disabled,
          { transform: [{ translateX: Animated.multiply(progress, travel) }] },
        ]}
      >
        <Text style={styles.handleText}>›</Text>
      </Animated.View>
    </View>
  );
}

function PopupBody({ order, queueLength, onReject }) {
  const { acceptNewOrder } = useRestaurantNotifications();
  const countdown = useAcceptCountdown();
  const [prepTime, setPrepTime] = useState(DEFAULT_PREP_TIME);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const acceptingRef = useRef(false);
  const [progress] = useState(() => new Animated.Value(0));
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleAcceptOrder = async () => {
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    setAccepting(true);
    try {
      const res = await acceptNewOrder(prepTime);
      if (res !== null) toast.success("Order accepted successfully");
    } catch (error) {
      const msg = error?.message || "Failed to accept order. Please try again.";
      if (error?.status === 404) toast.error("Order not found. It may have been cancelled or already processed.");
      else toast.error(msg);
      acceptingRef.current = false;
      setAccepting(false);
      progress.setValue(0);
    }
  };

  const triggerSwipeAccept = () => {
    if (acceptingRef.current) return;
    progress.setValue(1);
    clearTimeout(timer.current);
    timer.current = setTimeout(handleAcceptOrder, 160);
  };

  const handlePrint = async () => {
    try {
      toast.info("Preparing thermal receipt...");
      await printOrderReceipt(order);
    } catch {
      toast.error("Failed to prepare thermal receipt.");
    }
  };

  const status = order?.orderStatus || order?.status;
  const anyCancelled = isCancelledStatus(normalizeStatus(status));
  const userCancelled = normalizeStatus(status) === "cancelled_by_user";
  const items = order?.items;
  const itemCount = items?.length || 0;
  const noCutlery = order?.sendCutlery === false;
  const rawPay = order?.paymentMethod || order?.payment?.method;
  const payMethod = rawPay != null ? String(rawPay).toLowerCase().trim() : "";
  const isCod = payMethod === "cash" || payMethod === "cod";

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.orderId}>{order?.orderId || "#Order"}</Text>
            {queueLength > 1 ? <MoreBadge count={queueLength - 1} /> : null}
          </View>
          <Text style={styles.restaurantName}>{order?.restaurantName || "Restaurant"}</Text>
        </View>
        <Pressable onPress={handlePrint} style={styles.printBtn} accessibilityLabel="Print">
          <Printer size={20} color={tw.gray700} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {order?.scheduledAt ? (
          <View style={styles.scheduled}>
            <View style={styles.scheduledIcon}>
              <Calendar size={16} color={C.green600} />
            </View>
            <View>
              <Text style={styles.scheduledLabel}>SCHEDULED ORDER</Text>
              <Text style={styles.scheduledTime}>For {dayjs(order.scheduledAt).format("MMM D, hh:mm A")}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.mb2}>
          <Text style={styles.firstItem}>{items?.[0]?.name || "New Order"}</Text>
          <Text style={styles.createdAt}>
            {order?.createdAt ? dayjs(order.createdAt).format("D MMM, HH:mm") : "Just now"}
          </Text>
        </View>

        {order?.restaurantNote ? (
          <View style={styles.note}>
            <View style={styles.noteHead}>
              <FileText size={16} color={C.blue600} />
              <Text style={styles.noteLabel}>NOTE FOR RESTAURANT</Text>
            </View>
            <Text style={styles.noteText}>{order.restaurantNote}</Text>
          </View>
        ) : null}

        <View style={styles.mb2}>
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.create(200, "easeInEaseOut", "opacity"));
              setIsDetailsExpanded((v) => !v);
            }}
            style={styles.detailsBtn}
          >
            <View style={styles.rowGap2}>
              <DocIcon color={tw.gray700} />
              <Text style={styles.semibold}>Details</Text>
              <Text style={styles.itemCount}>
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </Text>
            </View>
            {isDetailsExpanded ? <ChevronUp size={16} color={tw.gray600} /> : <ChevronDown size={16} color={tw.gray600} />}
          </Pressable>
          {isDetailsExpanded ? (
            <View style={styles.itemsList}>
              {Array.isArray(items) ? (
                items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={[styles.vegDot, { backgroundColor: item.isVeg ? C.green500 : C.red500 }]} />
                    <View style={styles.itemMain}>
                      <Text style={styles.itemName}>
                        {item.quantity} x {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noItems}>No items</Text>
              )}
            </View>
          ) : null}
        </View>

        <View style={[styles.cutlery, { backgroundColor: noCutlery ? C.orange50 : tw.gray50 }]}>
          <CartIcon color={noCutlery ? C.orange600 : tw.gray600} />
          <Text style={[styles.cutleryText, { color: noCutlery ? C.orange700 : tw.gray700 }]}>
            {noCutlery ? "Don't send cutlery" : "Send cutlery"}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <View style={styles.rowGap2}>
            <ReceiptIcon color={tw.gray700} />
            <Text style={styles.semibold}>Total bill</Text>
          </View>
          <Text style={styles.total}>₹{getPopupOrderTotal(order)}</Text>
        </View>

        <View style={styles.payRow}>
          <Text style={styles.mediumLabel}>Payment</Text>
          <Text style={[styles.payValue, { color: isCod ? C.amber600 : C.green600 }]}>
            {isCod ? "Cash on Delivery" : "Online"}
          </Text>
        </View>

        <View style={styles.prepRow}>
          <Text style={styles.mediumLabel}>Preparation time</Text>
          <View style={styles.rowGap2}>
            <Pressable onPress={() => setPrepTime((p) => Math.max(1, p - 1))} style={styles.stepBtn} accessibilityLabel="Decrease">
              <Minus size={16} color={tw.gray700} />
            </Pressable>
            <Text style={styles.prepValue}>{prepTime} mins</Text>
            <Pressable onPress={() => setPrepTime((p) => p + 1)} style={styles.stepBtn} accessibilityLabel="Increase">
              <Plus size={16} color={tw.gray700} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {anyCancelled ? (
          <View style={styles.cancelledBox}>
            <Text style={styles.cancelledTitle}>{userCancelled ? "Order canceled by user" : "Order cancelled"}</Text>
            <Text style={styles.cancelledText}>This order is no longer available for acceptance.</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <AcceptSlider countdown={countdown} accepting={accepting} onAccept={triggerSwipeAccept} progress={progress} />
            <Pressable
              onPress={onReject}
              disabled={accepting}
              style={[styles.rejectBtn, accepting && styles.disabled]}
            >
              <Text style={styles.rejectText}>Reject Order</Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}

function RejectDialog({ order, onCancel }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { rejectNewOrder, actionInFlight } = useRestaurantNotifications();
  const [rejectReason, setRejectReason] = useState("");
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, damping: 25, stiffness: 300, mass: 1, useNativeDriver: true }).start();
  }, [anim]);

  const confirm = async () => {
    if (!rejectReason || actionInFlight) return;
    try {
      await rejectNewOrder(rejectReason);
    } catch {
      Alert.alert("Failed to reject order. Please try again.");
    }
  };

  return (
    <Animated.View
      style={[styles.rejectOverlay, { opacity: anim, paddingTop: 16 + insets.top, paddingBottom: 110 + insets.bottom }]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <Animated.View
        style={[
          styles.rejectPanel,
          { transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] },
        ]}
      >
        <View style={styles.rejectHeader}>
          <Text style={styles.rejectTitle}>Reject Order {order?.orderId || "#Order"}</Text>
          <Text style={styles.rejectSub}>Please select a reason for rejecting this order</Text>
        </View>
        <ScrollView style={styles.rejectBody} contentContainerStyle={styles.rejectBodyInner}>
          {REJECT_REASONS.map((reason) => {
            const selected = rejectReason === reason;
            return (
              <Pressable
                key={reason}
                onPress={() => setRejectReason(reason)}
                style={[
                  styles.reason,
                  selected
                    ? { borderColor: colors.primary, backgroundColor: `${colors.primary}1A` }
                    : { borderColor: tw.gray200, backgroundColor: "#ffffff" },
                ]}
              >
                <Text style={[styles.reasonText, { color: selected ? colors.primary : tw.gray900 }]}>{reason}</Text>
                {selected ? (
                  <View style={[styles.reasonCheck, { backgroundColor: colors.primary }]}>
                    <CheckIcon />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.rejectFooter}>
          <Pressable onPress={onCancel} style={styles.rejectCancel}>
            <Text style={styles.rejectCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={confirm}
            disabled={!rejectReason}
            style={[styles.rejectConfirm, { backgroundColor: rejectReason ? colors.primary : tw.gray200 }]}
          >
            <Text style={[styles.rejectConfirmText, { color: rejectReason ? "#ffffff" : tw.gray400 }]}>
              Confirm Rejection
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// Toasts OrdersMain showed for events that drive the popup.
function usePopupEventToasts() {
  useRestaurantEvents((e) => {
    if (e.type === "auto_rejected") toast.info("Order auto-rejected due to no response");
    else if (e.type === "cancelled") toast.info(e.byUser ? "Order canceled by user" : "Order cancelled");
    else if (e.type === "admin_assigned") toast.success("Order assigned by admin to you");
    else if (e.type === "scheduled_order" && e.scheduledAt) {
      toast.info(`New scheduled order received for ${dayjs(e.scheduledAt).format("hh:mm A")}`);
    }
  });
}

export default function NewOrderPopup() {
  const { popupOrder, newOrder, orderQueue, showNewOrderPopup, dismissNewOrder } = useRestaurantNotifications();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // The reject popup belongs to the order it was opened for (closed when the order changes).
  const [rejectFor, setRejectFor] = useState(null);
  const [anim] = useState(() => new Animated.Value(0));
  usePopupEventToasts();

  const order = popupOrder || newOrder;
  // Keep the last order on screen while the Modal fades out.
  const [lastOrder, setLastOrder] = useState(order);
  if (showNewOrderPopup && order && order !== lastOrder) setLastOrder(order);
  const shown = showNewOrderPopup ? order : lastOrder;

  const key = orderKey(popupOrder);
  const showReject = Boolean(key) && rejectFor === key;
  useEffect(() => {
    if (!key) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, damping: 25, stiffness: 300, mass: 1, useNativeDriver: true }).start();
  }, [key, anim]);

  const cancelReject = () => {
    // handleRejectCancel: closes both popups and clears the order without an API call.
    setRejectFor(null);
    dismissNewOrder();
  };

  // p-4 pb-[110px], max-h-[85vh]
  const maxHeight = Math.min(height * 0.85, height - insets.top - insets.bottom - 16 - 110);

  return (
    <Modal
      transparent
      visible={showNewOrderPopup}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (showReject) cancelReject();
      }}
    >
      <View style={[styles.overlay, { paddingTop: 16 + insets.top, paddingBottom: 110 + insets.bottom }]}>
        {shown ? (
          <Animated.View
            style={[
              styles.panel,
              {
                maxHeight,
                opacity: anim,
                transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
              },
            ]}
          >
            <PopupBody key={orderKey(shown)} order={shown} queueLength={orderQueue.length} onReject={() => setRejectFor(key)} />
          </Animated.View>
        ) : null}
      </View>
      {showReject && shown ? <RejectDialog order={shown} onCancel={cancelReject} /> : null}
      <Toaster />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 448,
    backgroundColor: "#ffffff",
    borderRadius: 32,
    overflow: "hidden",
    padding: 4,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderId: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  moreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: C.red500 },
  moreBadgeText: { fontSize: 12, fontWeight: "600", color: "#ffffff" },
  restaurantName: { fontSize: 12, color: tw.gray500, marginTop: 2 },
  printBtn: { padding: 8, borderRadius: 10 },
  content: { flexGrow: 0, flexShrink: 1 },
  contentInner: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  scheduled: {
    marginBottom: 12,
    backgroundColor: C.green50,
    borderWidth: 1,
    borderColor: C.green200,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scheduledIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.green100,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduledLabel: { fontSize: 10, fontWeight: "700", color: C.green800, letterSpacing: 0.5 },
  scheduledTime: { fontSize: 14, fontWeight: "600", color: C.green900, marginTop: 2 },
  mb2: { marginBottom: 8 },
  firstItem: { fontSize: 14, fontWeight: "600", color: tw.gray900 },
  createdAt: { fontSize: 12, color: tw.gray500, marginTop: 4 },
  note: {
    marginBottom: 12,
    backgroundColor: C.blue50,
    borderWidth: 1,
    borderColor: C.blue200,
    borderRadius: 10,
    padding: 10,
  },
  noteHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  noteLabel: { fontSize: 10, fontWeight: "700", color: C.blue800, letterSpacing: 0.5 },
  noteText: { fontSize: 14, fontWeight: "500", color: C.blue900 },
  detailsBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
  },
  rowGap2: { flexDirection: "row", alignItems: "center", gap: 8 },
  semibold: { fontSize: 14, fontWeight: "600", color: tw.gray900 },
  itemCount: { fontSize: 12, color: tw.gray500 },
  itemsList: { paddingVertical: 12, gap: 12 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  vegDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  itemName: { flexShrink: 1, fontSize: 14, fontWeight: "500", color: tw.gray900 },
  itemPrice: { fontSize: 12, color: tw.gray600, marginLeft: 8 },
  noItems: { fontSize: 14, color: tw.gray500 },
  cutlery: { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 8 },
  cutleryText: { fontSize: 14, fontWeight: "500" },
  totalRow: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tw.gray200,
  },
  total: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  payRow: { marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  mediumLabel: { fontSize: 14, fontWeight: "500", color: tw.gray700 },
  payValue: { fontSize: 14, fontWeight: "600" },
  prepRow: { marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBtn: { padding: 6, backgroundColor: tw.gray100, borderRadius: 9999 },
  prepValue: { fontSize: 16, fontWeight: "600", color: tw.gray900, minWidth: 60, textAlign: "center" },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tw.gray200,
    backgroundColor: "#ffffff",
  },
  cancelledBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.red200,
    backgroundColor: tw.red50,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelledTitle: { fontSize: 14, fontWeight: "600", color: C.red700 },
  cancelledText: { marginTop: 4, fontSize: 12, color: C.red600 },
  actions: { gap: 12 },
  slider: { height: 56, borderRadius: 16, backgroundColor: tw.gray900, overflow: "hidden", justifyContent: "center" },
  sliderBar: { ...StyleSheet.absoluteFill, backgroundColor: C.blue600, transformOrigin: "left" },
  sliderLabelWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 64 },
  sliderLabel: { fontSize: 14, fontWeight: "600", color: "#ffffff", textAlign: "center" },
  handle: {
    position: "absolute",
    left: 8,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
  },
  handleText: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: tw.gray900 },
  rejectBtn: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: C.red500,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  rejectText: { color: C.red600, fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.6 },
  rejectOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  rejectPanel: {
    width: "100%",
    maxWidth: 448,
    maxHeight: "85%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  rejectHeader: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: tw.gray200 },
  rejectTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  rejectSub: { fontSize: 14, color: tw.gray500, marginTop: 4 },
  rejectBody: { flexGrow: 0, flexShrink: 1 },
  rejectBodyInner: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  reason: {
    width: "100%",
    padding: 16,
    borderRadius: 10,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reasonText: { fontSize: 14, fontWeight: "500" },
  reasonCheck: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rejectFooter: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: tw.gray50,
    borderTopWidth: 1,
    borderTopColor: tw.gray200,
    flexDirection: "row",
    gap: 12,
  },
  rejectCancel: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: tw.gray300,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  rejectCancelText: { color: tw.gray700, fontWeight: "600", fontSize: 14 },
  rejectConfirm: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  rejectConfirmText: { fontWeight: "600", fontSize: 14 },
});
