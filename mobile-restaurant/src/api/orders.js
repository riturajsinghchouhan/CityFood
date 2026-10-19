// Orders lifecycle + dining bookings. Web: restaurantAPI.getOrders/getOrderById/updateOrderStatus/
// acceptOrder/rejectOrder/markOrderReady/resendDeliveryNotification and
// diningAPI.getRestaurantBookings/updateBookingStatusRestaurant.
// Pickup OTP: the restaurant only DISPLAYS it (orders carry `pickupOtp`; the socket sends
// pickup_otp_reveal). The rider verifies it, so there is no restaurant "handover" endpoint;
// handover = the rider's pickup, which moves the order to picked_up.
import { api } from "./client";

// usePaginatedRestaurantOrders tab -> backend ?status value.
export const RESTAURANT_ORDER_TAB_STATUS = {
  new: "new",
  preparing: "preparing",
  ready: "ready",
  "out-for-delivery": "out_for_delivery",
  scheduled: "scheduled",
  completed: "completed",
  cancelled: "cancelled",
  dead: "dead",
  all: "all",
};

// Backend -> UI status, as the web's getOrders does: created -> confirmed,
// ready_for_pickup -> ready, picked_up -> out_for_delivery, *cancel* -> cancelled.
export function normalizeOrderStatus(s) {
  const v = String(s || "").toLowerCase();
  if (v === "created") return "confirmed";
  if (v === "ready_for_pickup") return "ready";
  if (v === "picked_up") return "out_for_delivery";
  if (v.includes("cancel")) return "cancelled";
  return v || "confirmed";
}

// UI -> backend enum for PATCH .../status.
export function toBackendOrderStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (v === "ready") return "ready_for_pickup";
  if (v === "out_for_delivery") return "picked_up";
  if (v === "cancelled") return "cancelled_by_restaurant";
  return v;
}

export function isCancelledStatus(s) {
  // cancelled, cancelled_by_user / _restaurant / _admin (and "canceled" spellings).
  return String(s || "").toLowerCase().includes("cancel");
}

// OrdersMain resolveOrderActionId: the id to send to the status endpoints.
export function resolveOrderActionId(order) {
  if (!order) return null;
  const raw = order._id || order.orderMongoId || order.mongoId || order.orderId || order.order_id || order.id || null;
  const id = String(raw || "").trim();
  return id || null;
}

// Single-flight + 800 ms cache per params, like the web (socket + poll + screen overlap).
const ORDERS_CACHE_MS = 800;
let ordersInFlight = null;
let ordersInFlightKey = "";
let ordersCache = null;
let ordersCacheKey = "";
let ordersCacheAt = 0;

/**
 * GET /food/restaurant/orders?page&limit(<=100, default 30)&status. status: new | preparing | ready |
 * out_for_delivery | scheduled | completed | cancelled | all (see RESTAURANT_ORDER_TAB_STATUS).
 * `search` is ignored by the backend (audit §6 #9). Resolves to the body with
 * data: {orders, meta}; each order gets UI fields status (normalized), address, total, paymentMethod
 * and keeps orderStatus, pickupOtp, deliveryVerification, userId{name,phone,...}.
 * options.force skips the 800 ms cache.
 */
export function getOrders(params = {}, options = {}) {
  const query = { limit: 30, page: 1, ...params };
  const key = JSON.stringify(query);
  const now = Date.now();
  if (!options.force && ordersCache && ordersCacheKey === key && now - ordersCacheAt < ORDERS_CACHE_MS) {
    return Promise.resolve(ordersCache);
  }
  if (ordersInFlight && ordersInFlightKey === key) return ordersInFlight;
  ordersInFlightKey = key;
  ordersInFlight = api
    .get("/food/restaurant/orders", { params: query })
    .then((res) => {
      const payload = res?.data || {};
      const rowsRaw = Array.isArray(payload.orders) ? payload.orders : Array.isArray(payload.data) ? payload.data : [];
      const orders = rowsRaw.map((o) => ({
        ...o,
        status: normalizeOrderStatus(o.orderStatus || o.status),
        address: o.deliveryAddress || o.address,
        total: o.pricing?.total ?? o.total ?? 0,
        paymentMethod: o.payment?.method || o.paymentMethod || null,
      }));
      const meta = payload.meta || payload.pagination || {};
      const normalized = { ...res, data: { orders, meta } };
      ordersCache = normalized;
      ordersCacheKey = key;
      ordersCacheAt = Date.now();
      return normalized;
    })
    .finally(() => {
      ordersInFlight = null;
      ordersInFlightKey = "";
    });
  return ordersInFlight;
}

function invalidateOrders() {
  ordersCache = null;
  ordersCacheAt = 0;
}

// GET /food/restaurant/orders/:orderId (Mongo _id or order_id) -> data.order
export function getOrderById(orderId) {
  return api.get(`/food/restaurant/orders/${String(orderId)}`);
}

/**
 * PATCH /food/restaurant/orders/:orderId/status {orderStatus, note?} -> data.order.
 * orderStatus (UI names are translated): confirmed | preparing | ready_for_pickup | picked_up |
 * delivered | cancelled_by_restaurant. Status only moves forward; cancel allowed until delivered.
 */
export function updateOrderStatus(orderId, body = {}) {
  const outgoing = { ...(body ?? {}) };
  if (outgoing.orderStatus) outgoing.orderStatus = toBackendOrderStatus(outgoing.orderStatus);
  return api.patch(`/food/restaurant/orders/${String(orderId)}/status`, outgoing).then((res) => {
    invalidateOrders();
    return res;
  });
}

// Accept: "preparing", retried with "confirmed" on 400 (web). The prep time is NOT sent; the
// backend has no field for it (audit §6 #6). Kept in the signature for parity.
export async function acceptOrder(orderId, _prepTimeMins = null) {
  try {
    return await updateOrderStatus(orderId, { orderStatus: "preparing" });
  } catch (error) {
    if (Number(error?.status) === 400) {
      return updateOrderStatus(orderId, { orderStatus: "confirmed" });
    }
    throw error;
  }
}

// Reject/cancel by the restaurant: cancelled_by_restaurant + note (reason).
export function rejectOrder(orderId, reason = "") {
  return updateOrderStatus(orderId, { orderStatus: "cancelled_by_restaurant", note: reason });
}

// Mark ready for the rider: ready_for_pickup.
export function markOrderReady(orderId) {
  return updateOrderStatus(orderId, { orderStatus: "ready_for_pickup" });
}

// POST /food/restaurant/orders/:orderId/resend-notification {voipToken:""} -> re-offers the order to riders.
export function resendDeliveryNotification(orderId, voipToken = "") {
  return api.post(`/food/restaurant/orders/${String(orderId)}/resend-notification`, { voipToken });
}

// GET /food/dining/bookings/restaurant/:restaurantId -> data: bookings[]. Accepts an id or a restaurant object.
export function getRestaurantBookings(candidate) {
  const id = candidate?._id || candidate?.id || candidate;
  return api.get(`/food/dining/bookings/restaurant/${String(id)}`);
}

// PATCH /food/dining/bookings/:bookingId/status {status} -> the booking
export function updateBookingStatusRestaurant(bookingId, status) {
  return api.patch(`/food/dining/bookings/${String(bookingId)}/status`, { status });
}
