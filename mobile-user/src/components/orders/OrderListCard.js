// One order card from the Orders.jsx list (mobile layout: sm:* lines hidden).
import { AlertCircle, ChevronRight, Clock, MoreVertical, Phone, RotateCcw, Star } from "lucide-react-native";
import { memo } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";
import { AppImage, Text } from "../ui";
import DashedLine from "./DashedLine";
import { formatListDate } from "./orderUtils";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1604908176997-125188eb3c52?auto=format&fit=crop&w=200&q=80";
const ERROR_IMAGE = "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=100&q=80";

function VegBox({ isVeg }) {
  const color = isVeg ? "#00a63e" : "#dc2626";
  return (
    <View style={[styles.vegBox, { borderColor: color }]}>
      <View style={{ flex: 1, alignSelf: "stretch", borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

function paymentLabel(method) {
  if (method === "cash" || method === "cod") return "Cash on Delivery";
  if (method === "wallet") return "Wallet";
  if (method === "razorpay") return "Online";
  return method || "N/A";
}

function OrderListCard({ order, countdown, menuOpen, onToggleMenu, onShare, onViewDetails, onOpenRating, onReorder, onOpen, onViewMenu }) {
  const { colors, isDark } = useTheme();
  const c = {
    card: isDark ? "#121212" : "#ffffff",
    border: isDark ? "#1e2939" : "#f3f4f6",
    title: isDark ? "#f3f4f6" : "#1e2939",
    muted: isDark ? "#99a1af" : "#6a7282",
    strong: isDark ? "#d1d5dc" : "#364153",
    body: isDark ? "#e5e7eb" : "#1e2939",
    faint: isDark ? "#6a7282" : "#99a1af",
  };

  const isCodOrWallet = ["cash", "cod", "wallet"].includes(order.payment?.method) || ["cash", "cod", "wallet"].includes(order.paymentMethod);
  const isCancelled = order.status === "cancelled" || order.status === "restaurant_cancelled" || order.status === "dead" || order.isDead;
  const paymentFailed = !isCodOrWallet && !isCancelled && order.payment?.status === "failed";
  const isDelivered = order.status === "delivered";
  const isRestaurantCancelled = order.isRestaurantCancelled || order.status === "restaurant_cancelled";
  const isUserCancelled = order.isUserCancelled || (isCancelled && order.cancelledBy === "user");
  const isDead = order.isDead || order.status === "dead";
  const image = order.items?.[0]?.image || order.restaurantImage || FALLBACK_IMAGE;
  const location =
    order.restaurantLocation || `${order.address?.city || ""}, ${order.address?.state || ""}`.trim() || "Location not available";

  const payStatus = order.payment?.status;
  const paidLike = payStatus === "completed" || (isDelivered && isCodOrWallet);
  const badge = paidLike
    ? { bg: isDark ? "rgba(20,83,45,0.3)" : "#dcfce7", fg: isDark ? "#05df72" : "#008236" }
    : payStatus === "failed"
      ? { bg: isDark ? "rgba(127,29,29,0.3)" : "#ffe2e2", fg: isDark ? "#ff6467" : "#c10007" }
      : payStatus === "pending" || payStatus === "cod_pending"
        ? { bg: isDark ? "rgba(113,63,18,0.3)" : "#fef9c2", fg: isDark ? "#fdc700" : "#a65f00" }
        : { bg: isDark ? "#1e2939" : "#f3f4f6", fg: isDark ? "#d1d5dc" : "#364153" };

  const redIcon = (
    <View style={[styles.alertCircle, { backgroundColor: isDark ? "rgba(127,29,29,0.3)" : "#ffe2e2" }]}>
      <AlertCircle size={16} color={isDark ? "#ff6467" : "#fb2c36"} />
    </View>
  );
  const red = isDark ? "#ff6467" : "#fb2c36";

  let footerLeft;
  if (isRestaurantCancelled) {
    footerLeft = (
      <View style={{ gap: 4, flexShrink: 1 }}>
        <View style={styles.rowCenter}>
          {redIcon}
          <Text style={[styles.xsSemibold, { color: red }]}>Restaurant Cancelled</Text>
        </View>
        {order.cancellationReason ? (
          <Text style={[styles.xs, { color: isDark ? "#ff6467" : "#dc2626", fontWeight: "500", marginLeft: 28, marginBottom: 4 }]}>
            Reason: {order.cancellationReason}
          </Text>
        ) : null}
        <Text style={[styles.xs, { color: isDark ? "#99a1af" : "#4a5565", marginLeft: 28 }]}>Refund will be processed in 24-48 hours</Text>
      </View>
    );
  } else if (isDead) {
    footerLeft = (
      <View style={{ gap: 8, flex: 1, paddingRight: 16 }}>
        <View style={styles.rowCenter}>
          {redIcon}
          <Text style={[styles.xsSemibold, { color: red }]}>Order Delivery Failed</Text>
        </View>
        <Text style={{ fontSize: 10, lineHeight: 13, color: isDark ? "#99a1af" : "#4a5565", marginLeft: 28 }}>
          We apologize, but your order could not be completed.
        </Text>
        <Pressable
          onPress={() => Linking.openURL("tel:+919755633147").catch(() => {})}
          style={[
            styles.supportBtn,
            {
              backgroundColor: isDark ? "rgba(127,29,29,0.1)" : "#fef2f2",
              borderColor: isDark ? "rgba(127,29,29,0.3)" : "#ffe2e2",
            },
          ]}
        >
          <Phone size={12} color={isDark ? "#ff6467" : "#dc2626"} />
          <Text style={{ fontSize: 10, fontWeight: "500", color: isDark ? "#ff6467" : "#dc2626" }}>Support / Refund</Text>
        </Pressable>
      </View>
    );
  } else if (paymentFailed) {
    footerLeft = (
      <View style={styles.rowCenter}>
        {redIcon}
        <Text style={[styles.xsSemibold, { color: red }]}>Payment failed</Text>
      </View>
    );
  } else if (isDelivered && order.restaurantRating && (!order.deliveryPartnerId || order.deliveryPartnerRating)) {
    footerLeft = (
      <View style={[styles.rowCenter, { flexWrap: "wrap" }]}>
        <Text style={{ fontSize: 14, color: c.body }}>You rated</Text>
        <View style={[styles.ratePill, { backgroundColor: "#fdc700" }]}>
          <Text style={styles.ratePillText}>R {order.restaurantRating}</Text>
          <Star size={8} color="#ffffff" fill="#ffffff" />
        </View>
        {order.deliveryPartnerId ? (
          <View style={[styles.ratePill, { backgroundColor: "#2b7fff" }]}>
            <Text style={styles.ratePillText}>D {order.deliveryPartnerRating}</Text>
            <Star size={8} color="#ffffff" fill="#ffffff" />
          </View>
        ) : null}
      </View>
    );
  } else if (isDelivered) {
    footerLeft = (
      <View>
        <Text style={[styles.xs, { color: c.muted }]}>Order delivered</Text>
        <Pressable onPress={() => onOpenRating(order)} hitSlop={6}>
          <Text style={[styles.xs, { color: colors.primary, fontWeight: "500", marginTop: 2 }]}>
            Rate restaurant & delivery {">"}
          </Text>
        </Pressable>
      </View>
    );
  } else {
    const label =
      order.status === "preparing"
        ? "Preparing"
        : order.status === "outForDelivery"
          ? "Out for delivery"
          : order.status === "confirmed"
            ? "Order confirmed"
            : "";
    footerLeft = (
      <View>
        <Text style={[styles.xs, { color: "#6a7282" }]}>{label}</Text>
        {countdown > 0 ? (
          <View style={[styles.rowCenter, { gap: 4, marginTop: 4 }]}>
            <Clock size={12} color={colors.primary} />
            <Text style={[styles.xs, { color: colors.primary, fontWeight: "500" }]}>
              {countdown} min{countdown !== 1 ? "s" : ""} remaining
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <AppImage src={image} fallbackSrc={ERROR_IMAGE} width={48} placeholderType="food" style={[styles.thumb, { backgroundColor: "#e5e7eb" }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, lineHeight: 20, fontWeight: "600", color: c.title }}>
              {order.restaurant}
            </Text>
            <Text style={{ fontSize: 10, color: c.muted, marginTop: 2 }}>
              Order ID: <Text style={{ fontSize: 10, fontWeight: "600", color: c.strong }}>{order.orderId || order.id}</Text>
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
              {location}
            </Text>
            {order.deliveryPartnerName ? (
              <Text style={[styles.xs, { color: "#4a5565", marginTop: 4 }]}>
                <Text style={[styles.xs, { color: "#4a5565", fontWeight: "500" }]}>Delivery:</Text> {order.deliveryPartnerName}
                {order.deliveryPartnerPhone ? ` | ${order.deliveryPartnerPhone}` : ""}
              </Text>
            ) : null}
            {order.restaurantId ? (
              <Pressable onPress={() => onViewMenu(order)} hitSlop={4} style={{ alignSelf: "flex-start" }}>
                <Text style={[styles.xs, { color: colors.primary, fontWeight: "500", marginTop: 4 }]}>View menu {">"}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <Pressable onPress={() => onToggleMenu(order.id)} hitSlop={6} style={styles.moreBtn}>
          <MoreVertical size={20} color="#99a1af" />
        </Pressable>
      </View>

      {menuOpen ? (
        <View style={[styles.menu, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: c.border }]}>
          <Pressable onPress={() => onShare(order)} style={styles.menuItem}>
            <Text style={[styles.xs, { color: isDark ? "#e5e7eb" : "#1e2939" }]}>Share restaurant</Text>
          </Pressable>
          <Pressable onPress={() => onViewDetails(order)} style={styles.menuItem}>
            <Text style={[styles.xs, { color: isDark ? "#e5e7eb" : "#1e2939" }]}>Order details</Text>
          </Pressable>
        </View>
      ) : null}

      <DashedLine color={isDark ? "#1e2939" : "#e5e7eb"} style={styles.dashed} />

      <View style={styles.items}>
        {order.items && order.items.length > 0 ? (
          order.items.map((item, idx) => {
            const quantity = item.quantity || 1;
            const price = item.price || 0;
            return (
              <View key={item._id || item.id || item.itemId || idx} style={styles.itemRow}>
                <View style={{ marginTop: 2 }}>
                  <VegBox isVeg={item.isVeg === true || item.foodType === "Veg" || item.category === "veg" || item.type === "veg"} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: c.body }}>
                    {quantity} x {item.name || item.foodName || "Item"}
                  </Text>
                  {item.variantName ? <Text style={[styles.xs, { color: c.muted, marginTop: 2 }]}>{item.variantName}</Text> : null}
                  {item.description ? (
                    <Text numberOfLines={1} style={[styles.xs, { color: c.muted, marginTop: 2 }]}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.xs, { fontWeight: "600", color: isDark ? "#f3f4f6" : "#1e2939" }]}>
                  {"₹"}
                  {(quantity * price).toFixed(2)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={{ fontSize: 14, color: "#6a7282" }}>No items found</Text>
        )}
      </View>

      <View style={[styles.summary, { backgroundColor: isDark ? "#1a1a1a" : "#f9fafb" }]}>
        {order.pricing?.discount > 0 ? (
          <View style={[styles.between, { marginBottom: 4 }]}>
            <Text style={{ fontSize: 11, color: "#00a63e" }}>Discount Applied</Text>
            <Text style={{ fontSize: 11, color: "#00a63e", fontWeight: "500" }}>
              -{"₹"}
              {Number(order.pricing.discount).toFixed(2)}
            </Text>
          </View>
        ) : null}
        <View style={styles.between}>
          <Text style={[styles.xs, { fontWeight: "600", color: isDark ? "#e5e7eb" : "#1e2939" }]}>Total Bill</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: isDark ? "#f3f4f6" : "#101828" }}>
            {"₹"}
            {Number(order.total).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.xs, { color: c.faint }]}>Order placed on {formatListDate(order.createdAt)}</Text>
          {order.deliveredAt ? (
            <Text style={[styles.xs, { color: c.faint, marginTop: 2 }]}>Delivered on {formatListDate(order.deliveredAt)}</Text>
          ) : null}
          {order.payment ? (
            <View style={[styles.rowCenter, { gap: 0, marginTop: 4, flexWrap: "wrap" }]}>
              <Text style={[styles.xs, { color: c.muted }]}>Payment: </Text>
              <Text style={[styles.xs, { fontWeight: "500", color: isDark ? "#e5e7eb" : "#1e2939", textTransform: "capitalize" }]}>
                {paymentLabel(order.payment.method)}
              </Text>
              {payStatus ? (
                <View style={[styles.payBadge, { backgroundColor: badge.bg }]}>
                  <Text style={{ fontSize: 10, fontWeight: "500", color: badge.fg }}>{isDelivered && isCodOrWallet ? "Paid" : payStatus}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {isDelivered && !paymentFailed ? (
            <Text style={[styles.xs, { fontWeight: "500", color: "#00a63e", marginTop: 4 }]}>Delivered</Text>
          ) : null}
          {isRestaurantCancelled ? (
            <View style={{ gap: 2 }}>
              <Text style={[styles.xs, { fontWeight: "500", color: "#fb2c36", marginTop: 4 }]}>Restaurant Cancelled</Text>
              {order.cancellationReason ? (
                <Text style={{ fontSize: 10, color: "#ff6467", fontStyle: "italic" }}>Reason: {order.cancellationReason}</Text>
              ) : null}
            </View>
          ) : null}
          {isUserCancelled ? <Text style={[styles.xs, { fontWeight: "500", color: "#6a7282", marginTop: 4 }]}>Cancelled by you</Text> : null}
          {isDead ? <Text style={[styles.xs, { fontWeight: "500", color: "#fb2c36", marginTop: 4 }]}>Delivery Failed</Text> : null}
          {isCancelled && !isRestaurantCancelled && !isUserCancelled && !isDead ? (
            <Text style={[styles.xs, { fontWeight: "500", color: "#6a7282", marginTop: 4 }]}>Cancelled</Text>
          ) : null}
        </View>
        <Pressable onPress={() => onOpen(order, isDelivered || isCancelled)} hitSlop={6} style={[styles.rowCenter, { gap: 4, marginLeft: 16 }]}>
          <Text style={[styles.xs, { color: colors.primary, fontWeight: "500" }]}>View Details</Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      </View>

      <View style={[styles.solidSep, { backgroundColor: c.border }]} />

      <View style={styles.footer}>
        {footerLeft}
        {isDelivered && !paymentFailed ? (
          <Pressable onPress={() => onReorder(order)} style={[styles.reorder, { backgroundColor: colors.primary }]}>
            <RotateCcw size={14} color="#ffffff" />
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#ffffff" }}>Reorder</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default memo(OrderListCard);

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden", ...shadow.sm },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16, paddingBottom: 8 },
  headLeft: { flexDirection: "row", gap: 12, flex: 1 },
  thumb: { width: 48, height: 48, borderRadius: 8, overflow: "hidden" },
  moreBtn: { padding: 4, borderRadius: 999 },
  menu: {
    position: "absolute",
    right: 12,
    top: 40,
    zIndex: 20,
    elevation: 6,
    width: 160,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    ...shadow.lg,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 8 },
  dashed: { marginHorizontal: 16, marginVertical: 4 },
  items: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  vegBox: { width: 16, height: 16, borderWidth: 1, padding: 2, alignItems: "center", justifyContent: "center" },
  summary: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginHorizontal: 12, marginBottom: 8 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateRow: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  payBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  solidSep: { height: 1, marginHorizontal: 16 },
  footer: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertCircle: { padding: 4, borderRadius: 999 },
  xs: { fontSize: 12 },
  xsSemibold: { fontSize: 12, fontWeight: "600" },
  supportBtn: {
    marginLeft: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  ratePill: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 4, borderRadius: 4, height: 16 },
  ratePillText: { fontSize: 10, color: "#ffffff" },
  reorder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    ...shadow.sm,
  },
});
