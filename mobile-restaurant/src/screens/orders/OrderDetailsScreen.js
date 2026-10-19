// Port of pages/restaurant/OrderDetails.jsx ("/orders/:id"): order summary with pickup OTP and
// resend-to-riders, customer, items, the restaurant payout breakdown (collapsible GST & fees),
// delivery info and the order timeline. "Download" builds the receipt PDF (jsPDF on web) with
// expo-print and opens the share sheet. `mongoId` (web location.state / mongoIdProp) is the
// fallback id when the readable id does not resolve.
import dayjs from "dayjs";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  MapPin,
  User,
  Volume2,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { getOrderById } from "../../api";
import InlineToast from "../../components/orders/InlineToast";
import { buildOrderReceiptHtml, shareReceiptPdf } from "../../components/orders/orderReceiptPdf";
import { fmtDayMonthGB, fmtFullGB, fmtTime, pal } from "../../components/orders/ordersUtils";
import ResendNotificationButton from "../../components/orders/ResendNotificationButton";
import { useShellBottomInset } from "../../components/shell";
import AppImage from "../../components/ui/AppImage";
import Text from "../../components/ui/Text";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const firstNumber = (...values) => {
  for (const v of values) {
    const n = toNumber(v);
    if (n !== null) return n;
  }
  return null;
};
const firstText = (...values) => {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};
const formatMoney = (v) => `₹${Number(v || 0).toFixed(2)}`;
const formatDiscount = (v) => `-₹${Math.abs(Number(v || 0)).toFixed(2)}`;

// OrderDetails fetchOrder transform.
function transformOrder(order) {
  const orderStatusRaw = String(order.status || order.orderStatus || "").toLowerCase();
  const pricing = order.pricing || {};
  const computedSubtotal = Array.isArray(order.items)
    ? order.items.reduce((sum, item) => {
        const price = Number(item?.price || 0);
        const qty = Number(item?.quantity || 1);
        return sum + (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 1);
      }, 0)
    : 0;

  const itemSubtotal =
    firstNumber(pricing.subtotal, pricing.itemsTotal, pricing.itemSubtotal, order.itemSubtotal, order.subtotal) ??
    computedSubtotal;
  const taxes = firstNumber(pricing.tax, pricing.gst, order.tax, order.gst) ?? 0;
  const packagingFee = firstNumber(pricing.packagingFee, order.packagingFee) ?? 0;
  const deliveryFee = firstNumber(pricing.deliveryFee, order.deliveryFee) ?? 0;
  const platformFee = firstNumber(pricing.platformFee, order.platformFee) ?? 0;
  const discount = firstNumber(pricing.discount, order.discount) ?? 0;
  const couponDiscount = firstNumber(pricing.couponDiscount, order.couponDiscount) ?? 0;
  const referralDiscount = firstNumber(pricing.referralDiscount, order.referralDiscount) ?? 0;
  const total =
    firstNumber(pricing.total, order.payment?.amountDue, order.totalAmount, order.total, order.amount) ??
    Math.max(0, itemSubtotal + taxes + packagingFee + deliveryFee + platformFee - discount);
  const paidAmount = firstNumber(order.payment?.amountDue, order.payment?.amount, total) ?? total;

  const deliveryCostToAdmin = firstNumber(order.riderEarning, 30);
  const deliveryGstToAdmin = deliveryCostToAdmin * 0.18;
  const restaurantCommission = Number(pricing.restaurantCommission) || 0;
  const gstOnItem = Number(pricing.gstOnItem) || 0;
  const gstOnCommission = Number(pricing.gstOnCommission) || 0;
  const paymentGatewayFee = Number(pricing.paymentGatewayFee) || 0;
  const tcs = Number(pricing.tcs) || 0;
  const totalAdminReceivable =
    deliveryCostToAdmin +
    deliveryGstToAdmin +
    platformFee +
    taxes +
    packagingFee +
    restaurantCommission +
    gstOnItem +
    gstOnCommission +
    paymentGatewayFee +
    tcs;
  const restaurantGets = Math.max(
    0,
    itemSubtotal + packagingFee - restaurantCommission - gstOnItem - gstOnCommission - paymentGatewayFee - tcs,
  );
  const deliveryDistance = firstNumber(order.deliveryDistance, order.customer?.distance, 0);

  const addressParts = [order.address?.street, order.address?.area, order.address?.city, order.address?.state, order.address?.pincode].filter(
    Boolean,
  );
  const fullAddress =
    order.address?.formattedAddress ||
    order.address?.address ||
    order.deliveryAddress?.formattedAddress ||
    order.deliveryAddress?.address ||
    [order.deliveryAddress?.street, order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.zipCode]
      .filter(Boolean)
      .join(", ") ||
    (addressParts.length > 0 ? addressParts.join(", ") : "") ||
    "Address not available";

  const customerName =
    firstText(
      order.userId?.name,
      order.customerName,
      order.customer?.name,
      order.customerInfo?.name,
      order.deliveryAddress?.name,
      order.deliveryAddress?.fullName,
      order.address?.name,
    ) || "Customer";
  const restaurantName =
    firstText(
      order.restaurantName,
      order.restaurant?.restaurantName,
      order.restaurant?.name,
      order.restaurantId?.restaurantName,
      order.restaurantId?.name,
      order.outletName,
    ) || "Restaurant";

  const rawPaymentStatus = String(order.payment?.status || order.paymentStatus || "").toLowerCase();
  const paymentMethod = String(order.payment?.method || "").toLowerCase();
  let paymentStatus = "PENDING";
  if (["completed", "paid", "captured", "success", "succeeded"].includes(rawPaymentStatus)) paymentStatus = "PAID";
  else if (["failed", "declined"].includes(rawPaymentStatus)) paymentStatus = "FAILED";
  else if (["refunded", "refund"].includes(rawPaymentStatus)) paymentStatus = "REFUNDED";
  else if (paymentMethod === "cash") paymentStatus = orderStatusRaw === "delivered" ? "PAID" : "COD";

  const s = orderStatusRaw;
  const t = order.tracking || {};
  const reached = {
    confirmed: t.confirmed?.status || ["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"].includes(s),
    preparing: t.preparing?.status || ["preparing", "ready", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"].includes(s),
    ready: t.ready?.status || ["ready", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"].includes(s),
    outForDelivery: t.outForDelivery?.status || ["picked_up", "out_for_delivery", "delivered"].includes(s),
    delivered: t.delivered?.status || s === "delivered",
  };
  const ts = (v) => (v ? fmtFullGB(v) : "");

  return {
    id: order.orderId || order._id,
    status: orderStatusRaw.toUpperCase() || "PENDING",
    date: fmtDayMonthGB(order.createdAt),
    time: fmtTime(order.createdAt),
    restaurant: restaurantName,
    address: fullAddress,
    customer: {
      name: customerName,
      orderCount: order.userId?.orderCount || 1,
      location: fullAddress,
      distance: deliveryDistance ? `${deliveryDistance} km` : "-",
    },
    items:
      order.items?.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
        type: item.isVeg || item.foodType === "Veg" ? "Veg" : "Non-Veg",
      })) || [],
    billing: {
      itemSubtotal,
      taxes,
      packagingFee,
      deliveryFee,
      platformFee,
      discount,
      couponDiscount,
      referralDiscount,
      total,
      paidAmount,
      paymentStatus,
      deliveryCostToAdmin,
      deliveryGstToAdmin,
      totalAdminReceivable,
      restaurantCommission,
      gstOnItem,
      gstOnCommission,
      paymentGatewayFee,
      tcs,
      restaurantGets,
      deliveryDistance,
    },
    deliveryPartnerId: order.deliveryPartnerId || order.dispatch?.deliveryPartnerId || null,
    dispatchStatus: order.dispatch?.status || null,
    reason: order.cancellationReason || "",
    restaurantNote: order.restaurantNote || "",
    timeline: [
      { event: "Order placed", timestamp: fmtFullGB(order.createdAt), status: "completed" },
      ...(reached.confirmed ? [{ event: "Order confirmed", timestamp: ts(t.confirmed?.timestamp), status: "completed" }] : []),
      ...(reached.preparing ? [{ event: "Preparing", timestamp: ts(t.preparing?.timestamp), status: "completed" }] : []),
      ...(reached.ready ? [{ event: "Ready for pickup", timestamp: ts(t.ready?.timestamp), status: "completed" }] : []),
      ...(reached.outForDelivery ? [{ event: "Out for delivery", timestamp: ts(t.outForDelivery?.timestamp), status: "completed" }] : []),
      ...(reached.delivered ? [{ event: "Delivered", timestamp: ts(t.delivered?.timestamp), status: "completed" }] : []),
      ...(s === "cancelled"
        ? [{ event: "Cancelled", timestamp: ts(order.cancelledAt), status: "rejected", reason: order.cancellationReason }]
        : []),
    ],
    pickupOtp: order.pickupOtp || null,
  };
}

function Pulse({ style }) {
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
  return <Animated.View style={[{ backgroundColor: tw.gray100, borderRadius: 4, opacity: anim }, style]} />;
}

function Spin({ children }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View style={{ transform: [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      {children}
    </Animated.View>
  );
}

const STATUS_BG = { REJECTED: tw.red700, CANCELLED: tw.red700, DELIVERED: pal.green600 };

export default function OrderDetailsScreen() {
  const { id: orderId, mongoId } = useLocalSearchParams();
  const goBack = useAppBack();
  const { colors } = useTheme();
  const bottomInset = useShellBottomInset();

  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toastState, setToastState] = useState({ visible: false, message: "" });
  const toastTimer = useRef(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPayoutBreakdown, setShowPayoutBreakdown] = useState(false);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((message, hideAfter) => {
    clearTimeout(toastTimer.current);
    setToastState({ visible: true, message });
    if (hideAfter) toastTimer.current = setTimeout(() => setToastState((s) => ({ ...s, visible: false })), hideAfter);
  }, []);

  useEffect(() => {
    if (!orderId) return undefined;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        let res;
        try {
          res = await getOrderById(orderId);
          if (!res?.success) throw new Error("Readable ID fetch failed");
        } catch (e) {
          const fallbackId = mongoId;
          if (fallbackId && fallbackId !== orderId) res = await getOrderById(fallbackId);
          else throw e;
        }
        if (!alive) return;
        if (res?.success) {
          const order = res.data?.order || res.data;
          if (!order) throw new Error("Order data is missing");
          setOrderData(transformOrder(order));
        } else {
          throw new Error("Order not found");
        }
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Failed to fetch order");
        setOrderData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId, mongoId, reloadKey]);

  const handleCopyOrderId = async () => {
    if (!orderData?.id) return;
    try {
      await Clipboard.setStringAsync(String(orderData.id));
    } catch {
      // ignore
    }
    showToast("Order ID copied to clipboard", 2000);
  };

  const handlePrintReceipt = async () => {
    try {
      setIsGeneratingPDF(true);
      showToast("Generating receipt...");
      await new Promise((r) => setTimeout(r, 300));
      if (!orderData) throw new Error("Order data not found");
      const html = buildOrderReceiptHtml(orderData, dayjs().format("M/D/YYYY, h:mm:ss A"));
      await shareReceiptPdf(html, `Order_Receipt_${orderData.id}.pdf`);
      setIsGeneratingPDF(false);
      showToast("Receipt downloaded successfully!", 2000);
    } catch (err) {
      setIsGeneratingPDF(false);
      showToast(`Failed: ${err?.message || "Unknown error"}`, 3000);
    }
  };

  if (loading) {
    return (
      <View style={[styles.page, { backgroundColor: tw.gray50 }]}>
        <View style={[styles.header, { paddingVertical: 16, borderBottomColor: tw.gray100 }]}>
          <Pulse style={{ width: 32, height: 32, borderRadius: 8 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Pulse style={{ height: 16, width: "33%" }} />
            <Pulse style={{ height: 12, width: "50%" }} />
          </View>
        </View>
        <View style={{ padding: 16, gap: 16 }}>
          <View style={styles.skelCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Pulse style={{ height: 24, width: 96 }} />
              <Pulse style={{ height: 24, width: 80 }} />
            </View>
            <Pulse style={{ height: 16, width: "75%" }} />
            <Pulse style={{ height: 16, width: "50%" }} />
          </View>
          <View style={styles.skelCard}>
            <Pulse style={{ height: 20, width: 160 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Pulse style={{ width: 48, height: 48, borderRadius: 9999 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Pulse style={{ height: 16, width: "50%" }} />
                <Pulse style={{ height: 12, width: "33%" }} />
              </View>
            </View>
          </View>
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <View style={{ marginBottom: 16 }}>
              <Spin>
                <Loader2 size={32} color={colors.primary} />
              </Spin>
            </View>
            <Text style={styles.fetching}>Fetching order details...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error && !orderData) {
    return (
      <View style={[styles.page, styles.centerPage, { backgroundColor: tw.gray50, padding: 24 }]}>
        <View style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <XCircle size={40} color={tw.red500} />
          </View>
          <Text style={styles.errorTitle}>Order Not Found</Text>
          <Text style={styles.errorText}>
            {error ||
              "We couldn't retrieve the details for this order. It might have been removed or the ID is incorrect."}
          </Text>
          <View style={{ gap: 12, alignSelf: "stretch" }}>
            <Pressable
              onPress={() => setReloadKey((k) => k + 1)}
              style={({ pressed }) => [styles.errorBtn, { backgroundColor: colors.primary }, pressed && { transform: [{ scale: 0.95 }] }]}
            >
              <Text style={[styles.errorBtnText, { color: "#fff" }]}>Try Again</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/orders/all")}
              style={({ pressed }) => [styles.errorBtn, styles.errorBtnOutline, pressed && { transform: [{ scale: 0.95 }] }]}
            >
              <Text style={[styles.errorBtnText, { color: tw.gray700 }]}>Back to History</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (!orderData) {
    return (
      <View style={[styles.page, styles.centerPage]}>
        <View style={styles.notFoundCard}>
          <XCircle size={64} color={tw.red500} style={{ alignSelf: "center", marginBottom: 16 }} />
          <Text style={[styles.errorTitle, { marginBottom: 8 }]}>Order Not Found</Text>
          <Text style={[styles.errorText, { color: tw.gray600, marginBottom: 24 }]}>The order you&apos;re looking for doesn&apos;t exist.</Text>
          {/* Web linked to /restaurant/orders, which no route matches; the Orders home is "/". */}
          <Pressable onPress={() => router.dismissTo("/")} style={styles.notFoundBtn}>
            <Text style={styles.notFoundBtnText}>Back to Orders</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const b = orderData.billing;
  const feesTotal =
    (Number(b.restaurantCommission) || 0) +
    (Number(b.gstOnItem) || 0) +
    (Number(b.gstOnCommission) || 0) +
    (Number(b.paymentGatewayFee) || 0) +
    (Number(b.tcs) || 0);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.iconBtn} hitSlop={4} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={tw.gray900} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>Order details</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            ID: {orderData.id}, {orderData.restaurant?.substring(0, 20) || "Restaurant"}...
          </Text>
        </View>
        <Pressable
          onPress={handlePrintReceipt}
          disabled={isGeneratingPDF}
          style={({ pressed }) => [styles.downloadBtn, pressed && { backgroundColor: tw.gray200 }, isGeneratingPDF && { opacity: 0.5 }]}
          accessibilityLabel="Download Invoice"
        >
          {isGeneratingPDF ? <ActivityIndicator size={16} color={tw.gray800} /> : <Download size={16} color={tw.gray800} />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 + bottomInset }}>
        {/* Order summary */}
        <View style={styles.whiteCard}>
          <View style={styles.summaryTop}>
            <View style={styles.statusCol}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[orderData.status] || tw.gray600 }]}>
                <Text style={styles.statusBadgeText}>{orderData.status}</Text>
              </View>
              <Text style={styles.small}>
                {orderData.date}, {orderData.time}
              </Text>
              {(orderData.status === "PREPARING" || orderData.status === "READY" || orderData.status === "CONFIRMED") &&
              orderData.dispatchStatus !== "accepted" ? (
                <View style={{ marginTop: 8 }}>
                  <ResendNotificationButton orderId={orderId} onSuccess={() => setReloadKey((k) => k + 1)} />
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.idRow}>
            <Text style={styles.idText}>ID: {orderData.id}</Text>
            <Pressable onPress={handleCopyOrderId} hitSlop={6} style={styles.copyBtn} accessibilityLabel="Copy order ID">
              <Copy size={16} color={tw.gray500} />
            </Pressable>
          </View>

          <Text style={[styles.body14, { marginBottom: 12 }]}>
            {orderData.restaurant}, {orderData.address}
          </Text>

          <View style={styles.rule} />

          {orderData.reason ? <Text style={[styles.body14, { color: tw.red600 }]}>{orderData.reason}</Text> : null}

          {orderData.restaurantNote ? (
            <View style={styles.noteBox}>
              <View style={styles.noteHead}>
                <Volume2 size={16} color={pal.blue700} />
                <Text style={styles.noteLabel}>NOTE FOR RESTAURANT</Text>
              </View>
              <Text style={styles.noteText}>{orderData.restaurantNote}</Text>
            </View>
          ) : null}

          {orderData.pickupOtp ? (
            <View style={styles.otpBox}>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.otpLabel}>PICKUP VERIFICATION OTP</Text>
                <Text style={styles.otpHint}>
                  Share this code with the delivery partner when they arrive to pick up the order.
                </Text>
              </View>
              <View style={styles.otpValueWrap}>
                <Text style={styles.otpValue}>{orderData.pickupOtp}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Customer details */}
        <View>
          <Text style={styles.sectionTitle}>Customer details</Text>
          <View style={[styles.whiteCard, { gap: 32 }]}>
            <View style={styles.rowCenter}>
              <View style={styles.avatar}>
                <User size={20} color={tw.gray600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{orderData.customer.name}</Text>
                <Text style={[styles.small, { marginTop: 2 }]}>{orderData.customer.orderCount} order with you</Text>
              </View>
            </View>
            <View style={styles.rowCenter}>
              <MapPin size={20} color={tw.gray600} />
              <Text style={[styles.body14, { flex: 1 }]}>{orderData.customer.location}</Text>
              <Text style={[styles.body14, { color: tw.gray600 }]}>{orderData.customer.distance}</Text>
            </View>
          </View>
        </View>

        {/* Item details */}
        <View>
          <Text style={styles.sectionTitle}>Item details</Text>
          {orderData.items.map((item, index) => {
            const nonVeg = String(item.type).toLowerCase().includes("non");
            const vegColor = nonVeg ? tw.red600 : pal.green600;
            return (
              <View key={index} style={styles.whiteCard}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
                  {item.image ? (
                    <View style={styles.itemImage}>
                      <AppImage src={item.image} width={64} style={{ width: "100%", height: "100%" }} placeholderType="none" />
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemTop}>
                      <View style={[styles.rowCenter, { gap: 8, flexShrink: 1 }]}>
                        <View style={[styles.vegOuter, { borderColor: vegColor }]}>
                          <View style={[styles.vegInner, { backgroundColor: vegColor }]} />
                        </View>
                        <Text style={[styles.itemName, { flexShrink: 1 }]}>
                          {item.quantity} x {item.name}
                        </Text>
                      </View>
                      <Text style={styles.itemName}>{formatMoney(item.price)}</Text>
                    </View>
                    {item.type ? <Text style={styles.small}>{item.type}</Text> : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Restaurant payout */}
        <View style={styles.payoutCard}>
          <Text style={styles.payoutTitle}>Restaurant Payout</Text>
          <View style={{ gap: 10 }}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item subtotal</Text>
              <Text style={styles.billValue}>{formatMoney(b.itemSubtotal)}</Text>
            </View>
            {Number(b.packagingFee) > 0 ? (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Packaging fee</Text>
                <Text style={styles.billValue}>{formatMoney(b.packagingFee)}</Text>
              </View>
            ) : null}
            <Pressable onPress={() => setShowPayoutBreakdown((v) => !v)} style={styles.billRow}>
              {({ pressed }) => (
                <>
                  <View style={[styles.rowCenter, { gap: 6 }]}>
                    <Text style={[styles.billLabel, pressed && { color: tw.blue600 }]}>GST & Fees</Text>
                    {showPayoutBreakdown ? (
                      <ChevronUp size={14} color={pressed ? pal.blue500 : tw.gray400} />
                    ) : (
                      <ChevronDown size={14} color={pressed ? pal.blue500 : tw.gray400} />
                    )}
                  </View>
                  <Text style={[styles.billValue, { color: tw.red600 }]}>{formatDiscount(feesTotal)}</Text>
                </>
              )}
            </Pressable>

            {showPayoutBreakdown ? (
              <View style={styles.breakdown}>
                <View style={styles.billRow}>
                  <Text style={styles.breakLabel}>Restaurant commission</Text>
                  <Text style={styles.breakValue}>{formatDiscount(b.restaurantCommission)}</Text>
                </View>
                {Number(b.gstOnItem) > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={styles.breakLabel}>GST on item</Text>
                    <Text style={styles.breakValue}>{formatDiscount(b.gstOnItem)}</Text>
                  </View>
                ) : null}
                {Number(b.gstOnCommission) > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={styles.breakLabel}>GST on commission</Text>
                    <Text style={styles.breakValue}>{formatDiscount(b.gstOnCommission)}</Text>
                  </View>
                ) : null}
                {Number(b.paymentGatewayFee) > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={styles.breakLabel}>Payment gateway fee</Text>
                    <Text style={styles.breakValue}>{formatDiscount(b.paymentGatewayFee)}</Text>
                  </View>
                ) : null}
                {Number(b.tcs) > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={styles.breakLabel}>TCS</Text>
                    <Text style={styles.breakValue}>{formatDiscount(b.tcs)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.getsRow}>
              <Text style={styles.gets}>Restaurant gets</Text>
              <Text style={styles.gets}>{formatMoney(b.restaurantGets)}</Text>
            </View>
          </View>
        </View>

        {/* Delivery info */}
        <View style={styles.deliveryCard}>
          <Text style={[styles.payoutTitle, { color: tw.gray900 }]}>Delivery Info</Text>
          <View style={{ gap: 10 }}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Distance for this order</Text>
              <Text style={styles.billValue}>{b.deliveryDistance ? `${b.deliveryDistance} km` : "-"}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { flexShrink: 1 }]}>User delivery charge (distance based)</Text>
              <Text style={styles.billValue}>{formatMoney(b.deliveryFee)}</Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View>
          <Text style={styles.sectionTitle}>Order timeline</Text>
          <View style={styles.timelineCard}>
            <View style={styles.timelineLine} />
            <View style={{ gap: 16 }}>
              {orderData.timeline.map((event, index) => (
                <View key={index} style={styles.event}>
                  <View
                    style={[
                      styles.eventIcon,
                      {
                        backgroundColor:
                          event.status === "completed" ? tw.gray900 : event.status === "rejected" ? tw.red600 : tw.gray400,
                      },
                    ]}
                  >
                    {event.status === "completed" ? <CheckCircle size={16} color="#fff" /> : <XCircle size={16} color="#fff" />}
                  </View>
                  <View style={{ flex: 1, paddingTop: 4 }}>
                    <Text style={styles.body14}>{event.event}</Text>
                    <Text style={[styles.small, { marginTop: 2 }]}>{event.timestamp}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <InlineToast visible={toastState.visible} message={toastState.message} loading={isGeneratingPDF} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tw.gray100 },
  centerPage: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
    zIndex: 1,
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  headerSub: { fontSize: 12, color: tw.gray600 },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tw.gray100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tw.gray200,
  },
  skelCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: tw.gray50,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  fetching: { fontWeight: "500", color: tw.gray500, letterSpacing: -0.3 },
  errorCard: {
    width: "100%",
    maxWidth: 384,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)",
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    backgroundColor: tw.red50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  errorTitle: { fontSize: 24, fontWeight: "700", color: tw.gray900, marginBottom: 12, textAlign: "center" },
  errorText: { fontSize: 16, lineHeight: 26, color: tw.gray500, marginBottom: 32, textAlign: "center" },
  errorBtn: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 16, alignItems: "center" },
  errorBtnOutline: { backgroundColor: "#fff", borderWidth: 2, borderColor: tw.gray100 },
  errorBtnText: { fontSize: 16, fontWeight: "700" },
  notFoundCard: {
    width: "100%",
    maxWidth: 448,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 32,
    marginHorizontal: 16,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  notFoundBtn: { alignSelf: "center", backgroundColor: tw.gray200, paddingVertical: 8, paddingHorizontal: 24, borderRadius: 8 },
  notFoundBtnText: { fontWeight: "600", color: tw.gray800 },
  whiteCard: { backgroundColor: "#fff", borderRadius: 8, padding: 16 },
  summaryTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  statusCol: { alignItems: "flex-end", gap: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  small: { fontSize: 12, color: tw.gray500 },
  idRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  idText: { flexShrink: 1, fontSize: 16, fontWeight: "700", color: tw.gray900 },
  copyBtn: { padding: 4, borderRadius: 4 },
  body14: { fontSize: 14, color: tw.gray900 },
  rule: { height: 1, backgroundColor: tw.gray200, marginVertical: 12 },
  noteBox: { marginTop: 12, padding: 12, backgroundColor: tw.blue50, borderWidth: 1, borderColor: pal.blue100, borderRadius: 8 },
  noteHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  noteLabel: { fontSize: 12, fontWeight: "700", color: pal.blue700, letterSpacing: 0.6 },
  noteText: { fontSize: 14, fontWeight: "500", color: pal.blue900 },
  otpBox: {
    marginTop: 12,
    padding: 16,
    backgroundColor: pal.emerald50,
    borderWidth: 1,
    borderColor: pal.emerald100,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  otpLabel: { fontSize: 12, fontWeight: "700", color: pal.emerald700, letterSpacing: 0.6, marginBottom: 4 },
  otpHint: { fontSize: 10, lineHeight: 12, fontWeight: "500", color: pal.emerald600, maxWidth: 200 },
  otpValueWrap: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: pal.emerald200,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  otpValue: { fontSize: 20, fontWeight: "900", color: pal.emerald800, letterSpacing: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900, marginBottom: 12 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 9999, backgroundColor: tw.gray200, alignItems: "center", justifyContent: "center" },
  customerName: { fontSize: 14, fontWeight: "600", color: tw.gray900 },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8 },
  vegOuter: { width: 12, height: 12, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  vegInner: { width: 6, height: 6, borderRadius: 9999 },
  itemName: { fontSize: 14, fontWeight: "600", color: tw.gray900 },
  payoutCard: {
    backgroundColor: "rgba(239,246,255,0.5)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: pal.blue100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  payoutTitle: { fontSize: 14, fontWeight: "700", color: pal.blue900, marginBottom: 12, letterSpacing: 0.35 },
  billRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  billLabel: { fontSize: 13, fontWeight: "500", color: tw.gray600 },
  billValue: { fontSize: 13, color: tw.gray900 },
  breakdown: { paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: pal.blue100, gap: 8, marginVertical: 4 },
  breakLabel: { fontSize: 12, fontWeight: "500", color: tw.gray500 },
  breakValue: { fontSize: 12, color: "rgba(251,44,54,0.8)" },
  getsRow: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: pal.blue200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gets: { fontSize: 14, fontWeight: "700", color: pal.blue900 },
  deliveryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tw.slate100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  timelineCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: tw.gray200, borderRadius: 8, padding: 16 },
  timelineLine: { position: "absolute", left: 32, top: 16, bottom: 16, width: 2, backgroundColor: tw.gray300 },
  event: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  eventIcon: { width: 32, height: 32, borderRadius: 9999, alignItems: "center", justifyContent: "center", zIndex: 1 },
});
