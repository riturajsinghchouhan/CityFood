// Order helpers shared by the orders screens. Ported from Orders.jsx, OrderTracking.jsx
// and utils/orderSocketPatch.js.
import dayjs from "dayjs";
import { Linking } from "react-native";
import { toast } from "../ui";

// Web responses were `res.data.data.order` (or a bare order in data); here the body is `res`.
export function extractOrder(res) {
  if (res?.success && res?.data?.order) return res.data.order;
  if (res?.success && res?.data && (res.data._id || res.data.orderId || res.data.id)) return res.data;
  if (res?.success && res?.order) return res.order;
  if (res?.order && typeof res.order === "object") return res.order;
  return null;
}

export function extractOrderList(res) {
  if (res?.success && res?.data?.orders) return res.data.orders || [];
  if (res?.orders) return res.orders || [];
  if (Array.isArray(res?.data?.data)) return res.data.data || [];
  if (Array.isArray(res?.data)) return res.data || [];
  return [];
}

export const money = (value) => Number(value || 0).toFixed(2);

// tel: links. The web strips everything except digits and "+".
export function dialPhone(rawPhone, missingMessage) {
  const clean = String(rawPhone || "").replace(/[^\d+]/g, "");
  if (!clean || clean.length < 5) {
    toast.error(missingMessage);
    return;
  }
  Linking.openURL(`tel:${clean}`).catch(() => {});
}

// ---------------- Orders list (Orders.jsx) ----------------

export function getListOrderStatus(order) {
  const status = order.status;
  if (status === "delivered" || status === "completed") return "delivered";
  if (status === "out_for_delivery" || status === "outForDelivery") return "outForDelivery";
  if (status === "ready" || status === "preparing") return "preparing";
  if (String(status).toLowerCase().includes("cancel")) return "cancelled";
  if (status === "dead") return "dead";
  return status || "confirmed";
}

const RESTAURANT_CANCEL_RE =
  /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue|order not accepted within time limit|restaurant did not respond/i;

export function transformListOrder(order) {
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const backendStatus = order.orderStatus || order.status;
  const isCancelled =
    backendStatus === "cancelled" ||
    backendStatus === "cancelled_by_user" ||
    backendStatus === "cancelled_by_restaurant" ||
    backendStatus === "cancelled_by_admin" ||
    backendStatus === "dead";
  const cancellationReason = order.cancellationReason || "";
  const isRestaurantCancelled =
    isCancelled && (order.cancelledBy === "restaurant" || RESTAURANT_CANCEL_RE.test(cancellationReason));
  const isUserCancelled = isCancelled && order.cancelledBy === "user";
  const restaurantRating = order.ratings?.restaurant?.rating || null;
  const deliveryPartnerRating = order.ratings?.deliveryPartner?.rating || null;

  return {
    id: order._id?.toString() || order.orderId || `ORD-${order._id}`,
    mongoId: order._id,
    orderId: order.orderId || order._id?.toString(),
    status: isRestaurantCancelled ? "restaurant_cancelled" : getListOrderStatus({ ...order, status: backendStatus }),
    originalStatus: backendStatus,
    createdAt: createdAt.toISOString(),
    address: order.address || order.deliveryAddress || {},
    items: (order.items || []).map((item) => ({
      itemId: item.itemId || item._id || item.id,
      name: item.name || item.foodName || "Item",
      variantName: item.variantName || "",
      quantity: item.quantity || 1,
      price: item.price || 0,
      originalPrice: item.originalPrice ?? item.price ?? 0,
      image: item.image || null,
      description: item.description || null,
      isVeg: item.isVeg === true || item.foodType === "Veg" || item.category === "veg" || item.type === "veg",
      _id: item._id || item.id,
      id: item.id || item._id,
    })),
    total: order.pricing?.total || order.total || 0,
    subtotal: order.pricing?.subtotal || 0,
    deliveryFee: order.pricing?.deliveryFee || 0,
    tax: order.pricing?.tax || 0,
    pricing: order.pricing || {},
    payment: order.payment || {},
    paymentMethod: order.payment?.method || order.paymentMethod,
    restaurant: order.restaurantId?.restaurantName || order.restaurantId?.name || order.restaurantName || "Restaurant",
    restaurantId: order.restaurantId?._id || order.restaurantId,
    restaurantSlug: order.restaurantId?.slug || null,
    restaurantImage: order.restaurantId?.profileImage?.url || order.restaurantId?.profileImage || null,
    restaurantLocation:
      order.restaurantId?.location?.area ||
      order.restaurantId?.location?.city ||
      order.address?.city ||
      order.deliveryAddress?.city ||
      "",
    restaurantRating,
    deliveryPartnerRating,
    ratings: order.ratings || {},
    rating: restaurantRating || null,
    review: order.review || null,
    tracking: order.tracking || {},
    cancellationReason,
    isRestaurantCancelled,
    isUserCancelled,
    isDead: backendStatus === "dead",
    cancelledBy: order.cancelledBy,
    eta: order.eta || { min: order.estimatedDeliveryTime || 30, max: order.estimatedDeliveryTime || 30 },
    estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
    preparationTime: order.preparationTime || 0,
    deliveredAt: order.deliveredAt || null,
    deliveryPartnerId: order.deliveryPartnerId?._id || order.deliveryPartnerId || null,
    deliveryPartnerName: order.deliveryPartnerId?.name || order.deliveryPartnerName || null,
    deliveryPartnerPhone: order.deliveryPartnerId?.phone || order.deliveryPartnerPhone || null,
    note: order.note || null,
  };
}

// "17 Oct, 5:14PM"
export const formatListDate = (value) => dayjs(value).format("DD MMM, h:mmA");

export function isToday(value) {
  if (!value) return false;
  return dayjs(value).isSame(dayjs(), "day");
}

// ---------------- Tracking (OrderTracking.jsx) ----------------

export function getRestaurantCoordsFromOrder(apiOrder, fallback = null) {
  const loc = apiOrder?.restaurantId?.location;
  if (Array.isArray(loc?.coordinates) && loc.coordinates.length >= 2) return loc.coordinates;
  if (loc?.latitude && loc?.longitude) return [loc.longitude, loc.latitude];
  const rLoc = apiOrder?.restaurant?.location;
  if (Array.isArray(rLoc?.coordinates) && rLoc.coordinates.length >= 2) return rLoc.coordinates;
  return fallback || null;
}

function getRestaurantAddressFromOrder(apiOrder, previousOrder, explicit) {
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  const location = apiOrder?.restaurantId?.location || apiOrder?.restaurant?.location || {};
  if (location?.formattedAddress && String(location.formattedAddress).trim()) return String(location.formattedAddress).trim();
  if (location?.address && String(location.address).trim()) return String(location.address).trim();
  if (location?.addressLine1 && String(location.addressLine1).trim()) return String(location.addressLine1).trim();
  const parts = [location?.street, location?.area, location?.city, location?.state, location?.zipCode]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return previousOrder?.restaurantAddress || apiOrder?.restaurantAddress || apiOrder?.restaurant?.address || "Restaurant location";
}

function getCustomerCoordsFromApiOrder(apiOrder, previousOrder) {
  const addr = apiOrder?.address || apiOrder?.deliveryAddress || {};
  const fromLoc = addr?.location?.coordinates;
  if (Array.isArray(fromLoc) && fromLoc.length >= 2) return fromLoc;
  const flat = addr?.coordinates;
  if (Array.isArray(flat) && flat.length >= 2) return flat;
  const objectCoord = addr?.location || addr;
  const objLat = Number(objectCoord?.lat ?? objectCoord?.latitude);
  const objLng = Number(objectCoord?.lng ?? objectCoord?.longitude);
  if (Number.isFinite(objLat) && Number.isFinite(objLng)) return [objLng, objLat];
  const prev = previousOrder?.address?.coordinates || previousOrder?.address?.location?.coordinates;
  if (Array.isArray(prev) && prev.length >= 2) return prev;
  return null;
}

export function transformOrderForTracking(apiOrder, previousOrder = null, explicitRestaurantCoords = null, explicitRestaurantAddress = null) {
  const restaurantCoords =
    explicitRestaurantCoords || getRestaurantCoordsFromOrder(apiOrder, previousOrder?.restaurantLocation?.coordinates);
  const restaurantAddress = getRestaurantAddressFromOrder(apiOrder, previousOrder, explicitRestaurantAddress);
  const addr = apiOrder?.address || apiOrder?.deliveryAddress || {};
  const customerCoordsResolved = getCustomerCoordsFromApiOrder(apiOrder, previousOrder);

  // API responses strip the drop OTP; keep the one received over the socket.
  const deliveryVerification = (() => {
    const prevDV = previousOrder?.deliveryVerification || null;
    const apiDV = apiOrder?.deliveryVerification || null;
    const handoverOtp = apiOrder?.handoverOtp || null;
    if (!prevDV && !apiDV && !handoverOtp) return null;
    const prevDropOtp = prevDV?.dropOtp || null;
    const apiDropOtp = apiDV?.dropOtp || null;
    const merged = { ...(prevDV || {}), ...(apiDV || {}) };
    const finalCode = handoverOtp || prevDropOtp?.code || apiDropOtp?.code;
    if (finalCode || prevDropOtp?.required || apiDropOtp?.required) {
      merged.dropOtp = { ...(prevDropOtp || {}), ...(apiDropOtp || {}), code: finalCode };
    }
    return merged;
  })();

  return {
    id: apiOrder?.orderId || apiOrder?._id,
    mongoId: apiOrder?._id || null,
    orderId: apiOrder?.orderId || apiOrder?._id,
    restaurant:
      apiOrder?.restaurantName ||
      apiOrder?.restaurantId?.restaurantName ||
      apiOrder?.restaurantId?.name ||
      apiOrder?.restaurant?.restaurantName ||
      apiOrder?.restaurant?.name ||
      previousOrder?.restaurant ||
      "Restaurant",
    restaurantPhone:
      apiOrder?.restaurantPhone ||
      apiOrder?.restaurantId?.phone ||
      apiOrder?.restaurantId?.ownerPhone ||
      apiOrder?.restaurant?.phone ||
      apiOrder?.restaurant?.ownerPhone ||
      previousOrder?.restaurantPhone ||
      "",
    restaurantAddress,
    restaurantId: apiOrder?.restaurantId || previousOrder?.restaurantId || null,
    userId: apiOrder?.userId || previousOrder?.userId || null,
    userName: apiOrder?.userName || apiOrder?.userId?.name || apiOrder?.userId?.fullName || previousOrder?.userName || "",
    userPhone: apiOrder?.userPhone || apiOrder?.userId?.phone || previousOrder?.userPhone || "",
    address: {
      street: addr?.street || previousOrder?.address?.street || "",
      city: addr?.city || previousOrder?.address?.city || "",
      state: addr?.state || previousOrder?.address?.state || "",
      zipCode: addr?.zipCode || previousOrder?.address?.zipCode || "",
      additionalDetails: addr?.additionalDetails || previousOrder?.address?.additionalDetails || "",
      formattedAddress:
        addr?.formattedAddress ||
        (addr?.street && addr?.city
          ? `${addr.street}${addr.additionalDetails ? `, ${addr.additionalDetails}` : ""}, ${addr.city}${addr.state ? `, ${addr.state}` : ""}${addr.zipCode ? ` ${addr.zipCode}` : ""}`
          : previousOrder?.address?.formattedAddress || addr?.city || ""),
      coordinates: customerCoordsResolved || addr?.location?.coordinates || previousOrder?.address?.coordinates || null,
    },
    restaurantLocation: { coordinates: restaurantCoords },
    items:
      apiOrder?.items?.map((item) => ({
        ...item,
        name: item.name,
        variantName: item.variantName || "",
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice ?? item.price,
      })) ||
      previousOrder?.items ||
      [],
    total: apiOrder?.pricing?.total || previousOrder?.total || 0,
    status: apiOrder?.orderStatus || apiOrder?.status || previousOrder?.status || "pending",
    deliveryPartner: apiOrder?.deliveryPartnerId
      ? {
          name: apiOrder.deliveryPartnerId.name || apiOrder.deliveryPartnerId.fullName || "Delivery Partner",
          phone: apiOrder.deliveryPartnerId.phone || apiOrder.deliveryPartnerId.phoneNumber || "",
          avatar: apiOrder.deliveryPartnerId.avatar || apiOrder.deliveryPartnerId.profilePicture || null,
        }
      : previousOrder?.deliveryPartner || null,
    deliveryPartnerId:
      apiOrder?.deliveryPartnerId?._id ||
      apiOrder?.deliveryPartnerId ||
      apiOrder?.dispatch?.deliveryPartnerId?._id ||
      apiOrder?.dispatch?.deliveryPartnerId ||
      apiOrder?.assignmentInfo?.deliveryPartnerId ||
      null,
    dispatch: apiOrder?.dispatch || previousOrder?.dispatch || null,
    assignmentInfo: apiOrder?.assignmentInfo || previousOrder?.assignmentInfo || null,
    tracking: apiOrder?.tracking || previousOrder?.tracking || {},
    deliveryState: apiOrder?.deliveryState || previousOrder?.deliveryState || null,
    scheduledAt: apiOrder?.scheduledAt || previousOrder?.scheduledAt || null,
    createdAt: apiOrder?.createdAt || previousOrder?.createdAt || null,
    totalAmount: apiOrder?.pricing?.total || apiOrder?.totalAmount || previousOrder?.totalAmount || 0,
    deliveryFee: apiOrder?.pricing?.deliveryFee || apiOrder?.deliveryFee || previousOrder?.deliveryFee || 0,
    gst: apiOrder?.pricing?.tax || apiOrder?.pricing?.gst || apiOrder?.gst || apiOrder?.tax || previousOrder?.gst || 0,
    packagingFee: apiOrder?.pricing?.packagingFee || apiOrder?.packagingFee || 0,
    platformFee: apiOrder?.pricing?.platformFee || apiOrder?.platformFee || 0,
    discount: apiOrder?.pricing?.discount || apiOrder?.discount || 0,
    subtotal: apiOrder?.pricing?.subtotal || apiOrder?.subtotal || 0,
    paymentMethod: apiOrder?.paymentMethod || apiOrder?.payment?.method || previousOrder?.paymentMethod || null,
    payment: apiOrder?.payment || previousOrder?.payment || null,
    deliveryVerification,
    cancellationReason: apiOrder?.cancellationReason || previousOrder?.cancellationReason || null,
    ratings: apiOrder?.ratings || previousOrder?.ratings || {},
    restaurantRating: apiOrder?.ratings?.restaurant?.rating || apiOrder?.restaurantRating || previousOrder?.restaurantRating || null,
    deliveryPartnerRating:
      apiOrder?.ratings?.deliveryPartner?.rating || apiOrder?.deliveryPartnerRating || previousOrder?.deliveryPartnerRating || null,
  };
}

export function isFoodOrderCancelledStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  return s === "cancelled" || s.includes("cancelled") || s === "dead";
}

export function mapBackendOrderStatusToUi(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s || s === "pending" || s === "created") return "placed";
  if (s === "confirmed" || s === "accepted") return "confirmed";
  if (s === "preparing" || s === "processed") return "preparing";
  if (s === "ready" || s === "ready_for_pickup" || s === "reached_pickup" || s === "order_confirmed") return "ready";
  if (s === "picked_up" || s === "out_for_delivery" || s === "en_route_to_delivery") return "on_way";
  if (s === "reached_drop" || s === "at_drop" || s === "at_delivery") return "at_drop";
  if (s === "delivered" || s === "completed") return "delivered";
  if (s.includes("cancelled") || s === "cancelled") return "cancelled";
  if (s === "dead") return "dead";
  return "placed";
}

export function mapOrderToTrackingUiStatus(orderLike) {
  if (!orderLike) return "placed";
  const statusRaw = orderLike.status || orderLike.orderStatus;
  const phase = orderLike.deliveryState?.currentPhase;
  if (isFoodOrderCancelledStatus(statusRaw)) return "cancelled";
  if (statusRaw === "delivered" || statusRaw === "completed") return "delivered";
  const isRiderAccepted =
    orderLike.dispatch?.status === "accepted" ||
    orderLike.assignmentInfo?.status === "accepted" ||
    orderLike.deliveryPartner?.status === "accepted";
  if (phase === "reached_drop" || phase === "at_drop" || statusRaw === "at_drop") return "at_drop";
  if (phase === "en_route_to_delivery" || statusRaw === "picked_up" || statusRaw === "out_for_delivery") return "on_way";
  if (phase === "at_pickup" && orderLike.deliveryPartnerId && isRiderAccepted) return "at_pickup";
  if (phase === "en_route_to_pickup" && orderLike.deliveryPartnerId && isRiderAccepted) return "assigned";
  return mapBackendOrderStatusToUi(statusRaw);
}

export function normalizeLookupId(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw || raw === "undefined" || raw === "null") return "";
  return raw;
}

// utils/orderSocketPatch.js lives with the shell components.
export { patchOrderFromSocketPayload, socketPayloadNeedsRefetch } from "../shell/orderSocketPatch";

export function isRazorpayPaid(order) {
  const method = String(order?.payment?.method || order?.paymentMethod || "").toLowerCase();
  const status = String(order?.payment?.status || "").toLowerCase();
  return method === "razorpay" && ["paid", "authorized", "captured", "settled", "refunded"].includes(status);
}
