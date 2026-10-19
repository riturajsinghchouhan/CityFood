// Orders. Web: orderAPI (user app).
import { api } from "./client";

// Params: {restaurantId, zoneId}. data: {available, count, reason}
export function checkRiderAvailability(params = {}) {
  return api.get("/food/orders/check-rider-availability", { params });
}

// data.pricing: {subtotal, tax, packagingFee, deliveryFee, platformFee, discount, total, couponCode,
// appliedCoupon, couponError, ...}. A bad coupon still succeeds with couponError set.
export function calculateOrder(payload) {
  return api.post("/food/orders/calculate", payload ?? {});
}

// data: {order, razorpay: {key, orderId, amount (paise), currency} | null}
export function createOrder(payload) {
  return api.post("/food/orders", payload ?? {});
}

// Body: {orderId (Mongo _id), razorpayOrderId, razorpayPaymentId, razorpaySignature}
export function verifyPayment(body) {
  return api.post("/food/orders/verify-payment", body ?? {});
}

// Params: page (default 1), limit (default 20). The backend's {data:[...], meta} is normalized,
// as on web, to data: {orders, pagination: {total, page, limit, pages}} (data/meta kept too).
// For the first-order coupon count use getOrders({limit: 1}) and read data.pagination.total.
export async function getOrders(params = {}) {
  const res = await api.get("/food/orders", { params: { limit: 20, page: 1, ...params } });
  const payload = res?.data;
  if (payload && typeof payload === "object" && Array.isArray(payload.data) && payload.meta && typeof payload.meta === "object") {
    const meta = payload.meta;
    return {
      ...res,
      data: {
        ...payload,
        orders: payload.data,
        pagination: {
          total: Number(meta.total || 0),
          page: Number(meta.page || 1),
          limit: Number(meta.limit || params.limit || 20),
          pages: Number(meta.totalPages || 1),
        },
      },
    };
  }
  return res;
}

// Mongo _id or "FOD-xxxx". Deduped with an 800 ms cache (poll + socket overlap); {force: true} skips it.
const detailsInFlight = new Map();
const detailsCache = new Map();
const DETAILS_CACHE_MS = 800;

export function getOrderDetails(orderId, options = {}) {
  const key = String(orderId ?? "").trim();
  if (!key) return Promise.reject(new Error("orderId required"));
  if (options.force !== true) {
    const hit = detailsCache.get(key);
    if (hit && Date.now() - hit.at < DETAILS_CACHE_MS) return Promise.resolve(hit.res);
  }
  const pending = detailsInFlight.get(key);
  if (pending) return pending;
  const p = api
    .get(`/food/orders/${key}`)
    .then((res) => {
      detailsCache.set(key, { at: Date.now(), res });
      return res;
    })
    .finally(() => {
      detailsInFlight.delete(key);
    });
  detailsInFlight.set(key, p);
  return p;
}

// Body: {reason?, refundDestination?: "source" | "wallet"}
export function cancelOrder(orderId, body = {}) {
  return api.patch(`/food/orders/${String(orderId)}/cancel`, body ?? {});
}

export function updateOrderInstructions(orderId, instructions) {
  return api.patch(`/food/orders/${String(orderId)}/instructions`, { instructions });
}

// Body: {restaurantRating* 1-5, deliveryPartnerRating?, restaurantComment?, deliveryPartnerComment?}
export function submitOrderRatings(orderId, body = {}) {
  return api.patch(`/food/orders/${String(orderId)}/ratings`, body ?? {});
}

// SubmitComplaint screen: {orderId, complaintType, subject?, description} -> support ticket of type "order".
export function submitComplaint(payload) {
  return api.post("/food/user/support/ticket", {
    type: "order",
    orderId: payload.orderId,
    issueType: payload.complaintType,
    description: payload.subject ? `${payload.subject}: ${payload.description}` : payload.description,
  });
}
