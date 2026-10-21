// Order identity + normalisation helpers. Ports of Food/utils/orderDispatchId.js and the pure helpers
// at the top of DeliveryV2/pages/DeliveryHomeV2.jsx (extractOrderLocation, normalizeDeliveryActiveOrder,
// getTripStatusForOrder, resolveActiveOrderMeta) and useProximityCheck's target selection.
import { parseLatLng } from "./geo";

const MONGO_ID_RE = /^[a-f0-9]{24}$/i;

// Trip phases (useDeliveryStore tripStatus).
export const TRIP_STATUS = {
  IDLE: "IDLE",
  PICKING_UP: "PICKING_UP",
  REACHED_PICKUP: "REACHED_PICKUP",
  PICKED_UP: "PICKED_UP",
  DELIVERING: "DELIVERING",
  REACHED_DROP: "REACHED_DROP",
  COMPLETED: "COMPLETED",
};

// Canonical Mongo id (accept API + lock comparisons): orderMongoId / order_mongo_id / _id / id.
export function getOrderMongoId(order) {
  if (!order) return "";
  for (const candidate of [order.orderMongoId, order.order_mongo_id, order._id, order.id]) {
    const value = String(candidate || "").trim();
    if (value && MONGO_ID_RE.test(value)) return value;
  }
  return "";
}

// Human-readable order id (ORD-xxx) when present.
export function getOrderDisplayId(order) {
  if (!order) return "";
  return String(order.orderId || order.order_id || order.orderMongoId || order._id || order.id || "").trim();
}

// Id for accept/pass APIs — the Mongo id when available.
export function getOrderAcceptId(order) {
  return getOrderMongoId(order) || getOrderDisplayId(order);
}

export function isSameOrder(a, b) {
  if (!a || !b) return false;
  const aMongo = getOrderMongoId(a);
  const bMongo = getOrderMongoId(b);
  if (aMongo && bMongo) return aMongo === bMongo;
  const aDisplay = getOrderDisplayId(a);
  const bDisplay = getOrderDisplayId(b);
  return Boolean(aDisplay && bDisplay && aDisplay === bDisplay);
}

// Normalise socket / RTDB / poll payloads so _id and orderMongoId always match.
export function normalizeIncomingOrder(order) {
  if (!order) return null;
  const mongoId = getOrderMongoId(order);
  const displayId = getOrderDisplayId(order);
  return {
    ...order,
    orderMongoId: mongoId || order.orderMongoId || order.order_mongo_id || undefined,
    _id: mongoId || order._id || order.id || undefined,
    orderId: displayId || order.orderId || order.order_id,
  };
}

export function getOrderAlertKey(order = {}) {
  return getOrderMongoId(order) || getOrderDisplayId(order);
}

export function upsertIncomingOrderInQueue(queue, order) {
  const normalized = normalizeIncomingOrder(order);
  const list = Array.isArray(queue) ? queue : [];
  if (!normalized) return list;
  if (list.some((item) => isSameOrder(item, normalized))) {
    return list.map((item) => (isSameOrder(item, normalized) ? { ...item, ...normalized } : item));
  }
  return [...list, normalized];
}

export function removeIncomingOrderFromQueue(queue, orderRef) {
  const list = Array.isArray(queue) ? queue : [];
  if (!orderRef) return list;
  return list.filter((item) => !isSameOrder(item, orderRef));
}

export function getPrimaryIncomingOrder(queue, selectedId = "") {
  const list = Array.isArray(queue) ? queue : [];
  if (!list.length) return null;
  const selected = String(selectedId || "").trim();
  if (selected) {
    const found = list.find(
      (item) => getOrderMongoId(item) === selected || isSameOrder(item, { orderMongoId: selected, _id: selected }),
    );
    if (found) return found;
  }
  return list[0];
}

// DeliveryHomeV2 extractOrderLocation: GeoJSON coordinates, {latitude,longitude}, {lat,lng}, flat keys.
export function extractOrderLocation(ref, keysLat = [], keysLng = []) {
  if (!ref) return null;
  const nested = ref.location && typeof ref.location === "object" ? ref.location : null;
  const candidate = nested || ref;
  const coords = Array.isArray(candidate?.coordinates)
    ? candidate.coordinates
    : Array.isArray(candidate?.location?.coordinates)
      ? candidate.location.coordinates
      : null;
  if (coords?.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const lat = Number(candidate?.latitude ?? candidate?.lat ?? candidate?.location?.latitude ?? candidate?.location?.lat);
  const lng = Number(candidate?.longitude ?? candidate?.lng ?? candidate?.location?.longitude ?? candidate?.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  for (const [index, key] of keysLat.entries()) {
    if (ref[key] != null) {
      const pLat = Number(ref[key]);
      const pLng = Number(ref[keysLng[index]]);
      if (Number.isFinite(pLat) && Number.isFinite(pLng)) return { lat: pLat, lng: pLng };
    }
  }
  return null;
}

// Active order with restaurantLocation / customerLocation {lat,lng} and items[] resolved.
export function normalizeDeliveryActiveOrder(rawOrder) {
  if (!rawOrder) return null;
  const restaurantLocation =
    extractOrderLocation(rawOrder.restaurantLocation) ||
    extractOrderLocation(rawOrder.restaurantId, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(rawOrder.restaurant, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(rawOrder, ["restaurant_lat", "restaurantLat"], ["restaurant_lng", "restaurantLng"]);
  const customerLocation =
    extractOrderLocation(rawOrder.customerLocation) ||
    extractOrderLocation(rawOrder.deliveryAddress, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(rawOrder.customer_address, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(rawOrder.user, ["latitude", "lat"], ["longitude", "lng"]) ||
    extractOrderLocation(rawOrder, ["customer_lat", "customerLat"], ["customer_lng", "customerLng"]);
  return {
    ...rawOrder,
    _id: rawOrder._id || rawOrder.orderMongoId || rawOrder.orderId,
    orderId: rawOrder.orderId || rawOrder.order_id || rawOrder._id || rawOrder.orderMongoId,
    restaurantLocation,
    customerLocation,
    items: Array.isArray(rawOrder.items) ? rawOrder.items : Array.isArray(rawOrder.orderItems) ? rawOrder.orderItems : [],
  };
}

// Backend status / deliveryState.currentPhase -> trip phase.
export function getTripStatusForOrder(order) {
  const backendStatus = String(
    order?.deliveryStatus || order?.orderState?.status || order?.orderStatus || order?.status || "",
  ).toLowerCase();
  const currentPhase = String(order?.deliveryState?.currentPhase || "").toLowerCase();
  if (["delivered", "completed"].includes(backendStatus)) return TRIP_STATUS.COMPLETED;
  if (currentPhase === "at_drop" || backendStatus === "reached_drop") return TRIP_STATUS.REACHED_DROP;
  if (["picked_up", "delivering"].includes(backendStatus)) return TRIP_STATUS.PICKED_UP;
  if (currentPhase === "at_pickup" || backendStatus === "reached_pickup") return TRIP_STATUS.REACHED_PICKUP;
  return TRIP_STATUS.PICKING_UP;
}

const idString = (v) => (v && typeof v === "object" ? String(v._id || v.id || "") : v ? String(v) : "");

// {orderId (Mongo id preferred), userId, restaurantId} for socket update-location.
export function resolveActiveOrderMeta(order) {
  if (!order) return null;
  return {
    orderId: getOrderMongoId(order) || getOrderAcceptId(order),
    userId: idString(order.userId) || idString(order.user) || undefined,
    restaurantId: idString(order.restaurantId) || undefined,
  };
}

// useProximityCheck target: restaurant while PICKING_UP/REACHED_PICKUP, customer while PICKED_UP/REACHED_DROP.
export function getProximityTarget(order, tripStatus) {
  if (!order) return null;
  if (tripStatus === TRIP_STATUS.PICKING_UP || tripStatus === TRIP_STATUS.REACHED_PICKUP) {
    return (
      parseLatLng(order.restaurantLocation) ||
      parseLatLng(order.restaurant_location) ||
      parseLatLng(order.restaurantId?.location) ||
      parseLatLng(order.restaurantId)
    );
  }
  if (tripStatus === TRIP_STATUS.PICKED_UP || tripStatus === TRIP_STATUS.REACHED_DROP) {
    return (
      parseLatLng(order.customerLocation) ||
      parseLatLng(order.customer_location) ||
      parseLatLng(order.deliveryAddress?.location) ||
      parseLatLng(order.deliveryAddress)
    );
  }
  return null;
}

// Payment helpers used by the verification flow (DeliveryVerificationModal PaymentModal).
export function getOrderPaymentState(order = {}) {
  const method = String(
    order.paymentMethod || order.payment?.method || order.transaction?.payment?.method || order.transaction?.paymentMethod || "",
  ).toLowerCase();
  const isCod = ["cash", "cod", "cash_on_delivery", "razorpay_qr"].includes(method);
  const isPrepaidOnline = !isCod && Boolean(method);
  const rawStatus = String(
    order.payment?.status || order.paymentStatus || order.transactionStatus || order.transaction?.status || order.status || "",
  ).toLowerCase();
  const isPaid = ["paid", "captured", "completed", "settled"].includes(rawStatus) || isPrepaidOnline;
  const total = Number(order.pricing?.total || order.amountToCollect || 0);
  return {
    method,
    isCod,
    isPrepaidOnline,
    isPaid,
    initialStatus: isPaid ? "paid" : method === "razorpay_qr" ? "pending" : "idle",
    total,
    amountToCollect: isPaid || isCod ? total : 0,
  };
}
