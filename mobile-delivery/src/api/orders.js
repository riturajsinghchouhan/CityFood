// Offers, assignment and the active-order lifecycle. Web: deliveryAPI.getOrders/getActiveOrders/
// getCurrentDelivery/getOrderDetails/acceptOrder/passOrder/rejectOrder/confirmReachedPickup/
// requestPickupOtp/confirmOrderId/confirmReachedDrop/verifyDropOtp/completeDelivery/createCollectQr/
// getPaymentStatus. Audit #15-#28. :orderId may be the Mongo _id or the display order_id.
// NOT ported: updateOrderStatus (PATCH /orders/:id/status) — unused by web and unsafe (backend issue #3).
import { createInFlightCache, stableStringify, withoutTs } from "./cache";
import { api } from "./client";

const enc = (id) => encodeURIComponent(String(id));
const availableCache = createInFlightCache({ ttlMs: 2500 });
const detailsCache = createInFlightCache({ ttlMs: 1200 });

/**
 * GET /food/delivery/orders/available?page&limit (#15), deduped 2.5 s like the web.
 * data: {docs[] (raw lean orders: offered-to-me unassigned orders + all my non-terminal orders),
 * total, page, limit, cashLimit:{blocked(always false), message, totalCashLimit, cashInHand,
 * availableCashLimit}, orderCapacity}. options.noCache bypasses the dedupe.
 */
export function getOrders(params = {}, options = {}) {
  const query = { limit: 50, page: 1, ...withoutTs(params || {}) };
  if (options.noCache) return api.get("/food/delivery/orders/available", { params: query });
  return availableCache.getOrCreate(stableStringify(query), () =>
    api.get("/food/delivery/orders/available", { params: query }),
  );
}
export const getAvailableOrders = getOrders;

export function invalidateAvailableOrders() {
  availableCache.invalidate();
}

// GET /food/delivery/orders/active (#16) -> {activeOrders[] (sanitized, no OTPs), capacity:
// {enabled, maxConcurrentOrders, effectiveLimit, activeOrderCount, remainingSlots, canAcceptMore}}
export function getActiveOrders() {
  return api.get("/food/delivery/orders/active");
}

// GET /food/delivery/orders/current (#17) -> {activeOrder|null}
export function getCurrentDelivery() {
  return api.get("/food/delivery/orders/current");
}

// GET /food/delivery/orders/:orderId (unused by web, §2.11). Mongo ids only, 1.2 s dedupe (as web).
export function getOrderDetails(orderId) {
  const key = String(orderId || "").trim();
  if (!/^[a-f0-9]{24}$/i.test(key)) {
    return Promise.resolve({ success: false, message: "Invalid order id", data: null });
  }
  return detailsCache.getOrCreate(key, () => api.get(`/food/delivery/orders/${key}`));
}

/**
 * PATCH /orders/:id/accept {} (#18) -> {order} (sanitized, populated restaurantId/userId).
 * Errors: 403 "Order already accepted by another partner" / "belongs to another zone",
 * 400 "Maximum active order limit reached (N)", "Another order acceptance is being processed", ...
 */
export function acceptOrder(orderId, body = {}) {
  availableCache.invalidate();
  return api.patch(`/food/delivery/orders/${enc(orderId)}/accept`, body ?? {});
}

// PATCH /orders/:id/pass {} (#19) -> {orderId, passed:true}. 400 "Offer is no longer available".
export function passOrder(orderId) {
  availableCache.invalidate();
  return api.patch(`/food/delivery/orders/${enc(orderId)}/pass`, {});
}

/**
 * PATCH /orders/:id/reject {reason} (#28). The reason is IGNORED by the backend and the call unassigns
 * the rider even mid-trip (backend issue #5). Web calls it only on order_auto_killed (never emitted).
 */
export function rejectOrder(orderId, body = {}) {
  return api.patch(`/food/delivery/orders/${enc(orderId)}/reject`, body ?? {});
}

// PATCH /orders/:id/reached-pickup {} (#20) -> {order} (raw; includes pickupOtp/deliveryOtp — do not show).
export function confirmReachedPickup(orderId) {
  return api.patch(`/food/delivery/orders/${enc(orderId)}/reached-pickup`, {});
}

// POST /orders/:id/request-pickup-otp {} (#21) -> null, "OTP sent to restaurant". Needs reached-pickup first.
export function requestPickupOtp(orderId) {
  return api.post(`/food/delivery/orders/${enc(orderId)}/request-pickup-otp`, {});
}

/**
 * PATCH /orders/:id/confirm-pickup (#22) = "Picked up" with the restaurant's pickup OTP.
 * Body as web confirmOrderId: {confirmedOrderId, latitude, longitude, billImageUrl, otp}; only
 * billImageUrl and otp are read. otp "SKIP"/"BYPASS"/"NONE" bypasses the check (web "Skip OTP" button).
 */
export function confirmOrderId(orderId, confirmedOrderId, location = {}, data = {}) {
  return api.patch(`/food/delivery/orders/${enc(orderId)}/confirm-pickup`, {
    confirmedOrderId,
    latitude: location?.lat,
    longitude: location?.lng,
    billImageUrl: data.billImageUrl ?? null,
    otp: data.otp,
  });
}
export const confirmPickup = confirmOrderId;

// PATCH /orders/:id/reached-drop {} (#23) -> {order}. Sends the drop OTP to the customer; calling it
// again RESENDS the same OTP (web 30 s resend cooldown).
export function confirmReachedDrop(orderId) {
  return api.patch(`/food/delivery/orders/${enc(orderId)}/reached-drop`, {});
}

// POST /orders/:id/verify-drop-otp {otp:"1234"} (#24) -> {order}
export function verifyDropOtp(orderId, otp) {
  return api.post(`/food/delivery/orders/${enc(orderId)}/verify-drop-otp`, { otp: String(otp) });
}

/**
 * PATCH /orders/:id/complete (#25) {otp, rating:5, paymentOverride, paymentMethod}. otp missing or
 * "BYPASS"/"SKIP"/"NONE" bypasses the drop OTP. paymentMethod "cash" records COD as collected (adds to
 * cash in hand); a razorpay_qr order fails with 400 until the QR is paid. -> {order}.
 * A number/string body is treated as {rating} (web backward compatibility).
 */
export function completeDelivery(orderId, body = {}) {
  let payload = body ?? {};
  if (typeof payload === "number" || typeof payload === "string") payload = { rating: Number(payload) };
  return api.patch(`/food/delivery/orders/${enc(orderId)}/complete`, payload);
}

// POST /orders/:id/payment-qr {} (#26) -> {qrId, image_url, imageUrl, status, amount, expiresAt, reused}
export function createCollectQr(orderId, body = {}) {
  return api.post(`/food/delivery/orders/${enc(orderId)}/payment-qr`, body ?? {});
}

// GET /orders/:id/payment-status (#27) -> {status:'paid'|'pending'|'expired'|'failed', paid, payment, qr,
// ...}. Syncs with Razorpay on each call; the web polls it every 4 s while the QR is shown.
export function getPaymentStatus(orderId) {
  return api.get(`/food/delivery/orders/${enc(orderId)}/payment-status`);
}
