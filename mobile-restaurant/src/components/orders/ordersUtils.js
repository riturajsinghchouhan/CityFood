// Shared helpers for the orders screens (OrdersMain, AllOrdersPage, OrderDetails): the Tailwind v4
// colours those pages use that are not in theme/tokens, the web's toLocale* date formats (dayjs, so
// the output does not depend on the device's Intl data) and the list transforms from OrdersMain.jsx.
import dayjs from "dayjs";
import { tw } from "../../theme/tokens";

export const pal = {
  ...tw,
  slate50: "#f8fafc",
  slate300: "#cad5e2",
  slate600: "#45556c",
  slate800: "#1d293d",
  emerald50: "#ecfdf5",
  emerald100: "#d0fae5",
  emerald200: "#a4f4cf",
  emerald500: "#00bc7d",
  emerald600: "#009966",
  emerald700: "#007a55",
  emerald800: "#006045",
  amber50: "#fffbeb",
  amber100: "#fef3c6",
  amber200: "#fee685",
  amber600: "#e17100",
  amber700: "#bb4d00",
  amber900: "#7b3306",
  rose50: "#fff1f2",
  rose200: "#ffccd3",
  rose500: "#ff2056",
  rose600: "#ec003f",
  zinc100: "#f4f4f5",
  zinc200: "#e4e4e7",
  zinc500: "#71717b",
  zinc600: "#52525c",
  orange200: "#ffd6a7",
  orange600: "#f54900",
  blue100: "#dbeafe",
  blue200: "#bedbff",
  blue300: "#8ec5ff",
  blue400: "#51a2ff",
  blue500: "#2b7fff",
  blue700: "#1447e6",
  blue900: "#1c398e",
  green500: "#00c950",
  green600: "#00a63e",
  green700: "#008236",
  red200: "#ffc9c9",
  yellow200: "#fff085",
  yellow600: "#d08700",
  purple600: "#9810fa",
};

// error.response?.data?.message || fallback (ApiError keeps the body in .data).
export function apiMessage(err, fallback) {
  const m = err?.data?.message;
  return typeof m === "string" && m ? m : fallback;
}

const d = (v) => dayjs(v ?? undefined);

// toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"}) -> "03:45 PM"
export const fmtTime = (v) => d(v).format("hh:mm A");
// toLocaleDateString("en-US", {month:"short", day:"numeric", hour, minute}) -> "Oct 19, 03:45 PM"
export const fmtMonthDayTime = (v) => d(v).format("MMM D, hh:mm A");
// ... plus year:"numeric" -> "Oct 19, 2026, 03:45 PM"
export const fmtMonthDayYearTime = (v) => d(v).format("MMM D, YYYY, hh:mm A");
// toLocaleDateString("en-GB", {day:"numeric", month:"short"}) -> "19 Oct"
export const fmtDayMonthGB = (v) => d(v).format("D MMM");
// toLocaleDateString("en-US", {day:"numeric", month:"short"}) -> "Oct 19"
export const fmtMonthDay = (v) => d(v).format("MMM D");
// toLocaleString("en-GB") -> "19/10/2026, 15:45:12"
export const fmtFullGB = (v) => d(v).format("DD/MM/YYYY, HH:mm:ss");

const allOrdersStatusPriority = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  out_for_delivery: 4,
  scheduled: 5,
  delivered: 6,
  completed: 6,
  cancelled: 7,
  dead: 8,
};

export const sortAllOrders = (a, b) => {
  const diff = (allOrdersStatusPriority[a.status] ?? 999) - (allOrdersStatusPriority[b.status] ?? 999);
  if (diff !== 0) return diff;
  return b.sortTimestamp - a.sortTimestamp;
};

const getAllOrdersTimestamp = (order) =>
  order?.cancelledAt || order?.deliveredAt || order?.updatedAt || order?.createdAt || new Date().toISOString();

export const itemsSummaryOf = (order) =>
  order.items?.map((item) => `${item.quantity}x ${item.name}`).join(", ") || "No items";

// OrdersMain transformOrderForList (All, New, Scheduled tabs and search results).
export const transformOrderForList = (order) => ({
  orderId: order.orderId || order._id,
  mongoId: order._id,
  status: order.status || "pending",
  customerName: order.userId?.name || order.customerName || "Customer",
  type: "Home Delivery",
  tableOrToken: null,
  timePlaced: fmtMonthDayTime(getAllOrdersTimestamp(order)),
  eta: null,
  itemsSummary: itemsSummaryOf(order),
  photoUrl: order.items?.[0]?.image || null,
  photoAlt: order.items?.[0]?.name || "Order",
  paymentMethod: order.paymentMethod || order.payment?.method || null,
  deliveryPartnerId: order.deliveryPartnerId || null,
  dispatchStatus: order.dispatch?.status || null,
  preparingTimestamp: order.tracking?.preparing?.timestamp
    ? new Date(order.tracking.preparing.timestamp)
    : new Date(order.createdAt || Date.now()),
  initialETA: order.estimatedDeliveryTime || 30,
  sortTimestamp: new Date(getAllOrdersTimestamp(order)).getTime(),
  scheduledAt: order.scheduledAt || null,
  restaurantNote: order.restaurantNote || null,
});

// Preparing / Ready / Out for delivery tabs.
export const transformActiveOrder = (order, fallbackStatus) => ({
  orderId: order.orderId || order._id,
  mongoId: order._id,
  status: order.status || fallbackStatus,
  customerName: order.userId?.name || "Customer",
  type: order.deliveryFleet === "standard" ? "Home Delivery" : "Express Delivery",
  tableOrToken: null,
  timePlaced: fmtTime(order.createdAt),
  eta: null,
  itemsSummary: itemsSummaryOf(order),
  photoUrl: order.items?.[0]?.image || null,
  photoAlt: order.items?.[0]?.name || "Order",
  paymentMethod: order.paymentMethod || order.payment?.method || null,
  deliveryPartnerId: order.deliveryPartnerId || null,
  dispatchStatus: order.dispatch?.status || null,
  scheduledAt: order.scheduledAt || null,
  restaurantNote: order.restaurantNote || null,
  // Out for delivery does not pass pickupOtp on web.
  pickupOtp: fallbackStatus === "out_for_delivery" ? null : order.pickupOtp || null,
  initialETA: order.estimatedDeliveryTime || 30,
  preparingTimestamp: order.tracking?.preparing?.timestamp
    ? new Date(order.tracking.preparing.timestamp)
    : new Date(order.createdAt),
});

// Completed / Cancelled / Dead tabs.
export const transformHistoryOrder = (order, kind) => ({
  orderId: order.orderId || order._id,
  mongoId: order._id,
  status: kind === "dead" ? "dead" : order.status || kind,
  customerName: order.userId?.name || order.customerName || "Customer",
  type: "Home Delivery",
  tableOrToken: null,
  deliveredAt: order.deliveredAt || order.updatedAt || order.createdAt,
  cancelledAt: order.cancelledAt || order.updatedAt || order.createdAt,
  cancelledBy: order.cancelledBy || "unknown",
  cancellationReason:
    kind === "dead"
      ? order.cancellationReason || "Auto-killed: Order was not delivered within 1 hour"
      : kind === "cancelled"
        ? order.cancellationReason || "No reason provided"
        : null,
  itemsSummary: itemsSummaryOf(order),
  photoUrl: order.items?.[0]?.image || null,
  photoAlt: order.items?.[0]?.name || "Order",
  amount: order.pricing?.total || order.total || 0,
  paymentMethod: order.paymentMethod || order.payment?.method || null,
});

// The ETA countdown shown for preparing orders (AllOrders + PreparingOrders).
export function etaDisplayFor(order, now) {
  const elapsedMs = now - order.preparingTimestamp;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const remainingMinutes = Math.max(0, order.initialETA - elapsedMinutes);
  if (remainingMinutes <= 0) {
    const remainingSeconds = Math.max(0, Math.floor(order.initialETA * 60 - elapsedMs / 1000));
    return remainingSeconds > 0 ? `${remainingSeconds} secs` : "0 mins";
  }
  return `${remainingMinutes} mins`;
}
