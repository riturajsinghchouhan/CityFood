// ONE provider for the rider's realtime + trip layer. Ports, in one place:
//   - Food/hooks/useDeliveryNotifications.js (socket, RTDB offers, FCM relay, recovery, alert loop)
//   - DeliveryV2/store/useDeliveryStore.js (isOnline persisted as delivery-v2-online-pref, riderLocation,
//     activeOrder, acceptedOrders, orderCapacity, tripStatus, settings)
//   - DeliveryV2/hooks/useOrderManager.js + useProximityCheck.js
//   - the data logic of DeliveryV2/pages/DeliveryHomeV2.jsx (offer queue + ghost-assign lock, poll,
//     claimed/cancel handling, duty toggle, location throttles, heartbeat, 100 m auto-arrival)
//   - the API logic of NewOrderModal (60 s countdown -> auto-pass), PickupActionModal and
//     DeliveryVerificationModal (drop OTP + resend cooldown, COD cash / Razorpay QR polling every 4 s).
// UI comes later; screens read state and call actions from useDelivery().
//
// Location channels while online (decision A + web parity):
//   - lib/locationTask: Android foreground-service updates -> batched POST /food/delivery/location
//     (lastLat/lastLng for dispatch; works in the background).
//   - socket update-location (customer tracking) — only with an active order, ≥50 m or ≥10 s, as web.
//   - Firebase RTDB delivery_boys/<id> — same 50 m / 10 s throttle, on status change, and the heartbeat.
//   - PATCH /availability with lat/lng every 45 s (heartbeat) — NOT on every GPS fix (web bug F1).
//   Fixes come from the background task listener and, while the app is in the foreground, a
//   watchPositionAsync (3 s / 5 m) for a live map; both feed the same throttles.
//
// Deliberate fixes over the web (documented in docs/API_MAP.md):
//   - order_status_update cancellations are detected on `orderStatus` too (web read only `status`, so a
//     socket cancel never reset the trip); order_deleted removes the order; an admin-assigned order
//     (dispatch accepted) triggers a GET /orders/active refresh.
//   - recoverDeliveryState looks at data.activeOrder (web always took the `{activeOrder:null}` wrapper as
//     "a current trip" and never recovered available offers).
//   - On launch the server's availabilityStatus wins over the persisted preference (web re-sent "online"
//     without a selfie, F4).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { getMe } from "../api/auth";
import { updateLocation, updateOnlineStatus } from "../api/duty";
import {
  acceptOrder as apiAcceptOrder,
  completeDelivery as apiCompleteDelivery,
  confirmOrderId,
  confirmReachedDrop,
  confirmReachedPickup,
  createCollectQr,
  getActiveOrders,
  getCurrentDelivery,
  getOrders,
  getPaymentStatus,
  passOrder as apiPassOrder,
  rejectOrder,
  requestPickupOtp as apiRequestPickupOtp,
  verifyDropOtp as apiVerifyDropOtp,
} from "../api/orders";
import { toast } from "../components/ui/Toast";
import { calculateDistance, calculateETA, calculateHeading, getHaversineDistance } from "../lib/delivery/geo";
import {
  TRIP_STATUS,
  getOrderAcceptId,
  getOrderMongoId,
  getPrimaryIncomingOrder,
  getProximityTarget,
  getTripStatusForOrder,
  isSameOrder,
  normalizeDeliveryActiveOrder,
  normalizeIncomingOrder,
  removeIncomingOrderFromQueue,
  resolveActiveOrderMeta,
  upsertIncomingOrderInQueue,
} from "../lib/delivery/orders";
import { subscribeDeliveryPartnerOffers, writeDeliveryLocation } from "../lib/firebase";
import {
  applyPendingTrackingConfig,
  getLocationPermissions,
  isBackgroundTrackingActive,
  requestBackgroundLocation as requestBgLocation,
  setTrackingActiveOrder,
  startBackgroundTracking,
  stopBackgroundTracking,
  subscribeLocationFixes,
  subscribeTrackingConfig,
} from "../lib/locationTask";
import { dismissLocalOfferNotification, setForegroundPushHandler, showLocalOfferNotification } from "../lib/push";
import { OFFER_WINDOW_MS, prepareRing, pulseAlert, startRing, stopRing, subscribeRing } from "../lib/ring";
import { captureShiftSelfie, getCurrentFix, resolveShiftAddress } from "../lib/shift";
import {
  connectDeliverySocket,
  disconnectDeliverySocket,
  emitLocation,
  ensureSocketConnected,
  subscribeDeliveryEvents,
  subscribeSocketConnection,
} from "../lib/socket";
import useLatest from "../hooks/useLatest";
import { KEYS, store } from "../storage";
import { useAuth } from "./AuthContext";

export const OFFER_SECONDS = OFFER_WINDOW_MS / 1000; // NewOrderModal countdown
export const POLL_MS_SOCKET = 45000; // available/active poll while the socket is connected
export const POLL_MS_NO_SOCKET = 15000; // ... and while it is not
export const HEARTBEAT_MS = 45000; // PATCH /availability with lat/lng
export const EMIT_MIN_DISTANCE_M = 50; // socket update-location + RTDB throttle
export const EMIT_MIN_INTERVAL_MS = 10000;
export const AUTO_ARRIVAL_M = 100; // geofence auto reached-pickup / reached-drop (production builds)
export const AUTO_ARRIVAL_REARM_M = 200;
export const QR_POLL_MS = 4000;
export const DROP_OTP_RESEND_COOLDOWN_S = 30;
const DEFAULT_RANGE_M = 1500; // useDeliveryStore settings pickup/deliveryRangeLimit
const RANGE_BYPASS = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_RANGE_BYPASS === "true";
const AUTO_ARRIVAL_ENABLED = !__DEV__; // web: disabled in DEV builds

const DEFAULT_CAPACITY = {
  enabled: false,
  maxConcurrentOrders: 1,
  effectiveLimit: 1,
  activeOrderCount: 0,
  remainingSlots: 1,
  canAcceptMore: true,
};

const DeliveryContext = createContext(null);

const errMessage = (err, fallback) => err?.data?.error || err?.data?.message || err?.message || fallback;
const keyOf = (o) => getOrderMongoId(o) || getOrderAcceptId(o) || "";

function isOfferable(order) {
  const dispatchStatus = String(order?.dispatch?.status || "").toLowerCase();
  const orderStatus = String(order?.orderStatus || order?.status || "").toLowerCase();
  return ["unassigned", "assigned"].includes(dispatchStatus) && ["confirmed", "preparing", "ready_for_pickup"].includes(orderStatus);
}

function docsOf(payload) {
  if (Array.isArray(payload?.docs)) return payload.docs;
  if (Array.isArray(payload?.items)) return payload.items;
  return Array.isArray(payload) ? payload : [];
}

export function DeliveryProvider({ children }) {
  const { isAuthenticated, riderId, onLogout, refreshProfile } = useAuth();

  // ---- duty / location ----
  const [isOnline, setIsOnline] = useState(false);
  const [onlineHydrated, setOnlineHydrated] = useState(false);
  const [goingOnline, setGoingOnline] = useState(false);
  const [riderLocation, setRiderLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [locationPermission, setLocationPermission] = useState(null);
  const [trackingConfig, setTrackingConfig] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  // ---- offers ----
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [selectedIncomingId, setSelectedIncomingId] = useState(null);
  const [offerDeadline, setOfferDeadline] = useState(null);
  const [offerTimeLeft, setOfferTimeLeft] = useState(OFFER_SECONDS);
  const [cashLimitNotice, setCashLimitNotice] = useState(null);

  // ---- trip ----
  const [activeOrder, setActiveOrderState] = useState(null);
  const [acceptedOrders, setAcceptedOrdersState] = useState([]);
  const [orderCapacity, setOrderCapacityState] = useState(DEFAULT_CAPACITY);
  const [tripStatus, setTripStatus] = useState(TRIP_STATUS.IDLE);
  const [settings, setSettingsState] = useState({ pickupRangeLimit: DEFAULT_RANGE_M, deliveryRangeLimit: DEFAULT_RANGE_M });
  const [actionInFlight, setActionInFlight] = useState(null);
  const [pickupOtpRequested, setPickupOtpRequested] = useState(false);
  const [dropOtpResendAt, setDropOtpResendAt] = useState(0);
  const [payment, setPayment] = useState({ status: "idle", qr: null, loading: false });
  const [activePolyline, setActivePolylineState] = useState(null);

  // ---- realtime misc ----
  const [isConnected, setIsConnected] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [orderReady, setOrderReady] = useState(null);
  const [adminNotification, setAdminNotification] = useState(null);
  const [autoKilledOrder, setAutoKilledOrder] = useState(null);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");

  // ---- refs (latest values for listeners) ----
  const listenersRef = useRef(new Set());
  const offerFirstShownRef = useRef(new Map()); // key -> deadline (ms)
  const lockedIncomingIdRef = useRef(null); // GhostAssignFix
  const acceptInFlightRef = useRef(false);
  const lastFirebaseOfferAtRef = useRef(new Map());
  const prevFirebaseKeysRef = useRef(new Set());
  const lastEmitAtRef = useRef(0);
  const lastEmitCoordRef = useRef(null);
  const lastHttpSyncAtRef = useRef(0);
  const lastCoordRef = useRef(null);
  const lastRealPosRef = useRef(null);
  const rollingSpeedRef = useRef([]);
  const autoArrivalRef = useRef({ PICKING_UP: false, PICKED_UP: false });
  const lastPolylineRef = useRef("");
  const qrPollRef = useRef(null);
  const etaRef = useRef(null);

  const onlineRef = useLatest(isOnline);
  const riderIdRef = useLatest(riderId);
  const activeOrderRef = useLatest(activeOrder);
  const acceptedOrdersRef = useLatest(acceptedOrders);
  const tripStatusRef = useLatest(tripStatus);
  const incomingRef = useLatest(incomingOrders);
  const selectedIdRef = useLatest(selectedIncomingId);
  const polylineRef = useLatest(activePolyline);
  const appActiveRef = useLatest(appActive);
  const riderLocationRef = useLatest(riderLocation);

  const emit = useCallback((event) => {
    listenersRef.current.forEach((fn) => {
      try {
        fn(event);
      } catch {
        // ignore listener errors
      }
    });
  }, []);

  // ======================= store actions (useDeliveryStore) =======================

  const setActiveOrder = useCallback((order) => {
    setActiveOrderState(order || null);
    if (order) {
      setAcceptedOrdersState((prev) => [
        ...prev.filter((item) => String(item?._id || item?.orderId) !== String(order?._id || order?.orderId)),
        order,
      ]);
      setTripStatus((prev) => (prev === TRIP_STATUS.IDLE ? TRIP_STATUS.PICKING_UP : prev));
    } else {
      setTripStatus(TRIP_STATUS.IDLE);
    }
  }, []);

  const setAcceptedOrders = useCallback((orders = []) => {
    const list = Array.isArray(orders) ? orders : [];
    setAcceptedOrdersState(list);
    setActiveOrderState((current) => {
      const selectedId = String(current?._id || current?.orderId || "");
      return list.find((item) => String(item?._id || item?.orderId || "") === selectedId) || list[0] || null;
    });
  }, []);

  const removeAcceptedOrder = useCallback(
    (orderId) => {
      const id = String(orderId || "");
      const sameId = (item) => String(item?._id || item?.orderId || "") === id;
      const prev = acceptedOrdersRef.current;
      const next = prev.filter((item) => !sameId(item));
      acceptedOrdersRef.current = next;
      setAcceptedOrdersState(next);
      setOrderCapacityState((cap) => ({
        ...cap,
        activeOrderCount: Math.max(0, Number(cap.activeOrderCount || prev.length) - 1),
        remainingSlots: Math.max(0, Number(cap.effectiveLimit || 1) - next.length),
        canAcceptMore: next.length < Number(cap.effectiveLimit || 1),
      }));
      if (sameId(activeOrderRef.current)) {
        activeOrderRef.current = null;
        setActiveOrderState(null);
        setTripStatus(TRIP_STATUS.IDLE);
      }
    },
    [acceptedOrdersRef, activeOrderRef],
  );

  const setOrderCapacity = useCallback((capacity = {}) => {
    setOrderCapacityState((prev) => ({ ...prev, ...(capacity || {}) }));
  }, []);

  const clearActiveOrder = useCallback(() => {
    setActiveOrderState(null);
    setTripStatus(TRIP_STATUS.IDLE);
  }, []);

  const setSettings = useCallback((next) => setSettingsState((prev) => ({ ...prev, ...(next || {}) })), []);

  const persistOnline = useCallback((value) => {
    setIsOnline(value);
    store.set(KEYS.onlinePref, { isOnline: Boolean(value) });
  }, []);

  // ======================= offers queue =======================

  const syncSelectionAfterQueueChange = useCallback((nextQueue) => {
    setSelectedIncomingId((current) => {
      const stillExists = (nextQueue || []).some(
        (item) => current && (keyOf(item) === current || isSameOrder(item, { orderMongoId: current, _id: current, orderId: current })),
      );
      if (stillExists) return current;
      const nextId = nextQueue?.[0] ? keyOf(nextQueue[0]) : null;
      lockedIncomingIdRef.current = nextId;
      return nextId;
    });
  }, []);

  // Offers count only while the rider is online (web isRiderOnline()).
  const enqueueOffer = useCallback(
    (order) => {
      if (!onlineRef.current) return false;
      const normalized = normalizeIncomingOrder(order);
      const id = keyOf(normalized);
      if (!id) return false;
      setIncomingOrders((prev) => upsertIncomingOrderInQueue(prev, normalized));
      setSelectedIncomingId((prev) => {
        if (prev) return prev;
        lockedIncomingIdRef.current = id;
        return id;
      });
      if (!appActiveRef.current) showLocalOfferNotification(normalized);
      emit({ type: "offer_received", order: normalized });
      return true;
    },
    [appActiveRef, emit, onlineRef],
  );

  const selectIncomingOrder = useCallback((order) => {
    const id = keyOf(normalizeIncomingOrder(order));
    if (!id) return;
    lockedIncomingIdRef.current = id;
    setSelectedIncomingId(id);
  }, []);

  // DeliveryHomeV2 removeClaimedOrderFromQueue
  const removeOfferFromQueue = useCallback(
    (claimedRef, { notify = true } = {}) => {
      const target = {
        orderMongoId: claimedRef?.orderMongoId || claimedRef?.orderId || claimedRef?._id,
        orderId: claimedRef?.orderId,
        _id: claimedRef?._id,
      };
      const queue = incomingRef.current;
      const visible = getPrimaryIncomingOrder(queue, selectedIdRef.current);
      const wasVisible = Boolean(visible && isSameOrder(visible, target));
      const wasQueued = queue.some((item) => isSameOrder(item, target) && visible && !isSameOrder(item, visible));
      setIncomingOrders((prev) => {
        const next = removeIncomingOrderFromQueue(prev, target);
        syncSelectionAfterQueueChange(next);
        return next;
      });
      dismissLocalOfferNotification(keyOf(target));
      if (notify && wasVisible) {
        if (claimedRef?.claimedBy === "cancelled") toast.error("Order was cancelled.", { duration: 4000 });
        else toast.info("Order was taken by another delivery partner.", { duration: 4000 });
      } else if (notify && wasQueued) {
        toast.info("One of your queued orders was taken.", { duration: 3000 });
      }
      emit({ type: "offer_removed", orderRef: target, reason: claimedRef?.claimedBy || "removed" });
    },
    [emit, incomingRef, selectedIdRef, syncSelectionAfterQueueChange],
  );

  const handleClaimed = useCallback(
    (claimed) => {
      if (!claimed?.orderId && !claimed?.orderMongoId) return;
      const ref = {
        orderId: claimed.orderId,
        orderMongoId: claimed.orderMongoId || claimed.orderId,
        _id: claimed.orderMongoId || claimed.orderId,
        claimedBy: claimed.claimedBy,
      };
      if (claimed.claimedBy && String(claimed.claimedBy) === String(riderIdRef.current)) {
        removeOfferFromQueue(ref, { notify: false });
        return;
      }
      if (incomingRef.current.some((item) => isSameOrder(item, ref))) removeOfferFromQueue(ref, { notify: true });
    },
    [incomingRef, removeOfferFromQueue, riderIdRef],
  );

  const clearOffers = useCallback(() => {
    setIncomingOrders([]);
    setSelectedIncomingId(null);
    lockedIncomingIdRef.current = null;
    stopRing();
  }, []);

  // ======================= server sync =======================

  const refreshAcceptedOrders = useCallback(async () => {
    const res = await getActiveOrders();
    const payload = res?.data || {};
    const orders = (Array.isArray(payload.activeOrders) ? payload.activeOrders : []).map(normalizeDeliveryActiveOrder);
    setAcceptedOrders(orders);
    setOrderCapacity(payload.capacity || {});
    return orders;
  }, [setAcceptedOrders, setOrderCapacity]);

  // Initial sync (DeliveryHomeV2 effect 1): pick the first active order and derive the trip phase.
  const syncWithServer = useCallback(async () => {
    try {
      const orders = await refreshAcceptedOrders();
      if (orders.length > 0) {
        setActiveOrder(orders[0]);
        setTripStatus(getTripStatusForOrder(orders[0]));
      } else {
        setAcceptedOrders([]);
        clearActiveOrder();
      }
    } catch {
      clearActiveOrder();
    }
  }, [clearActiveOrder, refreshAcceptedOrders, setAcceptedOrders, setActiveOrder]);

  // Recovered/active order from resync (active_order) or GET /orders/current.
  const applyRecoveredOrder = useCallback(
    (payload) => {
      if (!payload || !(payload._id || payload.orderId || payload.orderMongoId)) return;
      const normalized = normalizeDeliveryActiveOrder(payload);
      const current = activeOrderRef.current;
      if (!current || isSameOrder(current, normalized)) {
        setActiveOrder(normalized);
        setTripStatus(getTripStatusForOrder(normalized));
      } else {
        const list = acceptedOrdersRef.current;
        const exists = list.some((o) => isSameOrder(o, normalized));
        setAcceptedOrdersState(exists ? list.map((o) => (isSameOrder(o, normalized) ? normalized : o)) : [...list, normalized]);
      }
    },
    [acceptedOrdersRef, activeOrderRef, setActiveOrder],
  );

  // GET /orders/active + /orders/available?limit=20 (the web poll / hydrateAvailableOrder).
  const hydrateAvailableOrders = useCallback(async () => {
    try {
      await refreshAcceptedOrders();
      const res = await getOrders({ limit: 20, page: 1 });
      const payload = res?.data || {};
      setCashLimitNotice(payload?.cashLimit?.blocked ? payload.cashLimit : null);
      if (payload?.orderCapacity && typeof payload.orderCapacity === "object") setOrderCapacity(payload.orderCapacity);
      const offers = docsOf(payload).map(normalizeIncomingOrder).filter(isOfferable);
      if (offers.length) {
        setCashLimitNotice(null);
        offers.forEach((o) => enqueueOffer(o));
      }
    } catch {
      // fallback sync failures are silent on web
    }
  }, [enqueueOffer, refreshAcceptedOrders, setOrderCapacity]);

  // useDeliveryNotifications.recoverDeliveryState (on connect, foreground, FCM alert).
  const recoverDeliveryState = useCallback(async () => {
    if (!riderIdRef.current) return;
    const [availableResult, currentResult] = await Promise.allSettled([
      getOrders({ limit: 20, page: 1 }),
      getCurrentDelivery(),
    ]);
    const currentTrip = currentResult.status === "fulfilled" ? currentResult.value?.data?.activeOrder || null : null;
    if (currentTrip) applyRecoveredOrder(currentTrip);
    if (availableResult.status !== "fulfilled" || !onlineRef.current) return;
    docsOf(availableResult.value?.data)
      .map(normalizeIncomingOrder)
      .filter(isOfferable)
      .forEach((o) => enqueueOffer(o));
  }, [applyRecoveredOrder, enqueueOffer, onlineRef, riderIdRef]);

  // ======================= location =======================

  const writeRtdb = useCallback(
    (coords, extra = {}) => {
      const id = riderIdRef.current;
      if (!id) return;
      const order = activeOrderRef.current;
      writeDeliveryLocation({
        deliveryId: id,
        lat: coords?.lat,
        lng: coords?.lng,
        heading: coords?.heading || 0,
        speed: coords?.speed || 0,
        accuracy: coords?.accuracy ?? null,
        isOnline: onlineRef.current,
        status: onlineRef.current ? "online" : "offline",
        activeOrderId: order?._id || order?.orderId || null,
        ...extra,
      }).catch(() => {});
    },
    [activeOrderRef, onlineRef, riderIdRef],
  );

  const reachPickupRef = useRef(null);
  const reachDropRef = useRef(null);

  // One GPS fix from the task listener or the foreground watch (DeliveryHomeV2 watchPosition callback).
  const handleFix = useCallback(
    (loc) => {
      if (!onlineRef.current || !loc?.coords) return;
      const { latitude: lat, longitude: lng, heading, speed, accuracy } = loc.coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const now = Date.now();

      let resolvedHeading = Number.isFinite(heading) && heading > 0 ? heading : 0;
      const prev = lastRealPosRef.current;
      if (!resolvedHeading && prev) {
        const moved = getHaversineDistance(prev.lat, prev.lng, lat, lng);
        resolvedHeading = moved > 1.5 ? calculateHeading(prev.lat, prev.lng, lat, lng) : prev.heading || 0;
      }
      lastRealPosRef.current = { lat, lng, heading: resolvedHeading };
      const pos = { lat, lng, heading: resolvedHeading, speed: speed > 0 ? speed : 0, accuracy: accuracy ?? null };
      lastCoordRef.current = pos;
      setRiderLocation(pos);
      setLocationError("");
      if (speed && speed > 0) rollingSpeedRef.current = [...rollingSpeedRef.current.slice(-4), speed];

      // Geofence auto-arrival (production only, once per phase, re-armed beyond 200 m).
      const order = activeOrderRef.current;
      const phase = tripStatusRef.current;
      const target = getProximityTarget(order, phase);
      const distance = target ? calculateDistance(lat, lng, target.lat, target.lng) : Infinity;
      if (AUTO_ARRIVAL_ENABLED && distance <= AUTO_ARRIVAL_M && !autoArrivalRef.current[phase]) {
        if (phase === TRIP_STATUS.PICKING_UP) {
          autoArrivalRef.current[phase] = true;
          reachPickupRef.current?.().catch(() => {
            autoArrivalRef.current[phase] = false;
          });
        } else if (phase === TRIP_STATUS.PICKED_UP) {
          autoArrivalRef.current[phase] = true;
          reachDropRef.current?.().catch(() => {
            autoArrivalRef.current[phase] = false;
          });
        }
      }
      if (distance > AUTO_ARRIVAL_REARM_M) autoArrivalRef.current[phase] = false;

      // Socket + RTDB: moved ≥50 m or ≥10 s since the last send.
      const last = lastEmitCoordRef.current;
      const moved = last ? getHaversineDistance(lat, lng, last.lat, last.lng) : 1000;
      if (moved >= EMIT_MIN_DISTANCE_M || now - lastEmitAtRef.current >= EMIT_MIN_INTERVAL_MS) {
        lastEmitAtRef.current = now;
        lastEmitCoordRef.current = { lat, lng };
        const meta = resolveActiveOrderMeta(order);
        const poly = polylineRef.current;
        if (meta?.orderId) {
          emitLocation({
            lat,
            lng,
            heading: resolvedHeading,
            speed: pos.speed,
            accuracy: pos.accuracy,
            ...meta,
            status: "on_the_way",
            polyline: typeof poly === "string" ? poly : poly?.points || null,
            eta: etaRef.current,
          });
        }
        writeRtdb(pos, { isOnline: true, status: "online", activeOrderId: meta?.orderId || null });
      }
    },
    [activeOrderRef, onlineRef, polylineRef, tripStatusRef, writeRtdb],
  );

  // Task fixes (foreground service). Subscribed for the provider's lifetime.
  useEffect(() => subscribeLocationFixes(handleFix), [handleFix]);
  useEffect(
    () =>
      subscribeTrackingConfig((cfg) => {
        setTrackingConfig(cfg);
        if (!cfg?.stopped) return;
        setIsTracking(false);
        // The server answered stopTracking (offline / not approved, no trip): mirror it locally so the
        // UI does not show "online" without tracking. No PATCH — the server already has the rider offline.
        if (cfg.stopTracking && cfg.mode === "offline" && onlineRef.current) {
          persistOnline(false);
          onlineRef.current = false;
          setIncomingOrders([]);
          setSelectedIncomingId(null);
          stopRing();
          emit({ type: "tracking_stopped", config: cfg });
        }
      }),
    [emit, onlineRef, persistOnline],
  );

  // Foreground watch while online + app active (live map, socket cadence).
  useEffect(() => {
    if (!isOnline || !appActive || !isAuthenticated) return undefined;
    let sub = null;
    let cancelled = false;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
      handleFix,
      () => setLocationError("Unable to get your current location. Retrying GPS…"),
    )
      .then((s) => {
        if (cancelled) s.remove();
        else sub = s;
      })
      .catch(() => setLocationError("Location is off or unavailable. Enable precise location to go online."));
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [appActive, handleFix, isAuthenticated, isOnline]);

  // 45 s heartbeat: PATCH /availability {online, lat, lng} + RTDB (web ping interval).
  useEffect(() => {
    if (!isOnline || !isAuthenticated) return undefined;
    const timer = setInterval(() => {
      const c = lastCoordRef.current;
      if (!c || Date.now() - lastHttpSyncAtRef.current < HEARTBEAT_MS - 1000) return;
      lastHttpSyncAtRef.current = Date.now();
      updateLocation(c.lat, c.lng, true, { heading: c.heading || 0, speed: c.speed || 0, accuracy: c.accuracy ?? null }).catch(() => {});
      writeRtdb(c, { isOnline: true, status: "online" });
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated, isOnline, writeRtdb]);

  // RTDB status write when online/offline or the selected order changes (web effect 2, minus the
  // per-fix PATCH).
  useEffect(() => {
    if (!isAuthenticated || !onlineHydrated) return;
    writeRtdb(lastCoordRef.current || riderLocationRef.current, {});
  }, [activeOrder?._id, activeOrder?.orderId, isAuthenticated, isOnline, onlineHydrated, riderLocationRef, writeRtdb]);

  // Tell the background task which trip is active (point orderId + onTrip cadence).
  useEffect(() => {
    const id = activeOrder && tripStatus !== TRIP_STATUS.COMPLETED ? getOrderMongoId(activeOrder) || null : null;
    setTrackingActiveOrder(id).catch(() => {});
  }, [activeOrder, tripStatus]);

  const refreshLocationPermission = useCallback(async () => {
    const p = await getLocationPermissions().catch(() => null);
    if (p) setLocationPermission(p);
    return p;
  }, []);

  const ensureTracking = useCallback(async () => {
    try {
      await startBackgroundTracking({ activeOrderId: getOrderMongoId(activeOrderRef.current) || null });
      setIsTracking(true);
      return true;
    } catch (err) {
      setIsTracking(false);
      if (err?.message === "LOCATION_PERMISSION") {
        setLocationError("Location is off or unavailable. Enable precise location to go online.");
      }
      return false;
    }
  }, [activeOrderRef]);

  // ======================= duty =======================

  /**
   * Go-online step 1 (web toggle): GPS fix (asks foreground permission). Sets riderLocation.
   * Resolves {lat,lng,...}; throws with code PERMISSION_DENIED | SERVICES_DISABLED | TIMEOUT | UNAVAILABLE
   * (web toast: "Please enable your GPS for current location").
   */
  const prepareGoOnline = useCallback(async () => {
    const fix = await getCurrentFix();
    setRiderLocation(fix);
    lastCoordRef.current = fix;
    setLocationError("");
    refreshLocationPermission();
    return fix;
  }, [refreshLocationPermission]);

  /**
   * Go-online step 3: PATCH /availability {status:"online", shiftStartPicBase64, shiftStartAddress},
   * set online (persisted), immediate location sync, start background tracking.
   * selfieBase64 = raw base64 JPEG from captureShiftSelfie(); address from resolveShiftAddress().
   * Resolves {backgroundPermission}. Throws on API failure (web toast "Failed to start shift. Please try again.").
   */
  const goOnline = useCallback(
    async ({ selfieBase64, address, coords } = {}) => {
      setGoingOnline(true);
      try {
        await updateOnlineStatus(true, selfieBase64 || null, address || null);
        persistOnline(true);
        onlineRef.current = true;
        const c = coords || lastCoordRef.current;
        if (c?.lat != null) {
          lastHttpSyncAtRef.current = Date.now();
          updateLocation(c.lat, c.lng, true).catch(() => {});
        }
        await ensureTracking();
        const perms = await refreshLocationPermission();
        toast.success("Shift started successfully!");
        return { backgroundPermission: perms?.background || "undetermined" };
      } finally {
        setGoingOnline(false);
      }
    },
    [ensureTracking, onlineRef, persistOnline, refreshLocationPermission],
  );

  // Steps 1-3 in one call for screens without a custom selfie UI. Resolves null when the selfie is cancelled.
  const startShift = useCallback(async () => {
    const coords = await prepareGoOnline();
    const selfie = await captureShiftSelfie();
    if (!selfie) return null;
    const address = await resolveShiftAddress(coords.lat, coords.lng);
    return goOnline({ selfieBase64: selfie.base64, address, coords });
  }, [goOnline, prepareGoOnline]);

  // Go offline (toggle, GPS loss, forced): local first, then stop tracking and PATCH offline.
  const goOffline = useCallback(
    async ({ notifyServer = true } = {}) => {
      persistOnline(false);
      onlineRef.current = false;
      clearOffers();
      setIsTracking(false);
      await stopBackgroundTracking().catch(() => {});
      if (notifyServer) await updateOnlineStatus(false).catch(() => {});
      writeRtdb(lastCoordRef.current, { isOnline: false, status: "offline" });
    },
    [clearOffers, onlineRef, persistOnline, writeRtdb],
  );

  const requestBackgroundLocation = useCallback(async () => {
    const granted = await requestBgLocation();
    await refreshLocationPermission();
    return granted;
  }, [refreshLocationPermission]);

  // ======================= order lifecycle (useOrderManager) =======================

  const resolveOrderId = useCallback((order) => getOrderAcceptId(order || activeOrderRef.current), [activeOrderRef]);

  const runAction = useCallback(async (name, fn) => {
    setActionInFlight(name);
    try {
      return await fn();
    } finally {
      setActionInFlight((cur) => (cur === name ? null : cur));
    }
  }, []);

  /**
   * acceptOffer(order) — slide to accept. GhostAssignFix: the target must be the visible/locked offer.
   * PATCH accept -> active order (locations resolved) -> PICKING_UP -> refresh /orders/active.
   * A 403 / "already accepted" removes the offer ("This order was just taken by another delivery partner.").
   */
  const acceptOffer = useCallback(
    async (orderArg) => {
      const visible = getPrimaryIncomingOrder(incomingRef.current, selectedIdRef.current);
      const target = normalizeIncomingOrder(orderArg || visible);
      const lockedId = lockedIncomingIdRef.current;
      if (lockedId && target && !isSameOrder({ orderMongoId: lockedId, _id: lockedId }, target)) {
        toast.error("Order changed while accepting. Please try again.", { duration: 4000 });
        return null;
      }
      if (visible && target && !isSameOrder(visible, target)) {
        toast.error("Order mismatch detected. Please try again.", { duration: 4000 });
        return null;
      }
      if (acceptInFlightRef.current) {
        toast.info("Already processing this order...");
        return null;
      }
      const orderId = getOrderAcceptId(target);
      if (!orderId) {
        toast.error("Invalid order data");
        return null;
      }
      acceptInFlightRef.current = true;
      stopRing();
      try {
        const res = await runAction("accept", () => apiAcceptOrder(orderId));
        const full = res?.data?.order || target;
        const normalized = normalizeDeliveryActiveOrder({ ...full, orderId: full.orderId || orderId });
        setActiveOrder({ ...normalized, orderId });
        setTripStatus(TRIP_STATUS.PICKING_UP);
        autoArrivalRef.current = { PICKING_UP: false, PICKED_UP: false };
        setPickupOtpRequested(false);
        removeOfferFromQueue(target, { notify: false });
        await refreshAcceptedOrders().catch(() => {});
        emit({ type: "offer_accepted", order: normalized });
        return normalized;
      } catch (err) {
        const msg = errMessage(err, "Network error. Please try again.");
        const taken = err?.status === 403 || /already accepted|another partner/i.test(msg);
        if (taken) {
          toast.error("This order was just taken by another delivery partner.", { duration: 4000 });
          removeOfferFromQueue(target, { notify: false });
        } else {
          toast.error(msg);
        }
        throw err;
      } finally {
        acceptInFlightRef.current = false;
      }
    },
    [emit, incomingRef, refreshAcceptedOrders, removeOfferFromQueue, runAction, selectedIdRef, setActiveOrder],
  );

  // passOffer(order) — "Pass" button and the 60 s auto-pass. Always removes the offer locally.
  const passOffer = useCallback(
    async (orderArg, { auto = false } = {}) => {
      const order = orderArg || getPrimaryIncomingOrder(incomingRef.current, selectedIdRef.current);
      const orderId = keyOf(order);
      if (!orderId) return;
      stopRing();
      try {
        await apiPassOrder(orderId);
        removeOfferFromQueue(order, { notify: false });
        toast.success("Order passed");
      } catch (err) {
        removeOfferFromQueue(order, { notify: false });
        toast.error(errMessage(err, "This offer is no longer available"));
      }
      emit({ type: "offer_passed", order, auto });
    },
    [emit, incomingRef, removeOfferFromQueue, selectedIdRef],
  );

  // Mark "Reached pickup" (button or 100 m geofence) -> REACHED_PICKUP.
  const reachPickup = useCallback(async () => {
    const orderId = resolveOrderId();
    if (!orderId) {
      toast.error("Order id not found. Please refresh current trip.");
      throw new Error("Missing order id");
    }
    try {
      await runAction("reachPickup", () => confirmReachedPickup(orderId));
      setTripStatus(TRIP_STATUS.REACHED_PICKUP);
    } catch (err) {
      toast.error(errMessage(err, "Failed to update status"));
      throw err;
    }
  }, [resolveOrderId, runAction]);

  // PickupActionModal "Request OTP" / "Resend": the restaurant receives the pickup OTP.
  const requestPickupOtp = useCallback(async () => {
    const orderId = resolveOrderId();
    if (!orderId) throw new Error("Missing order id");
    const res = await runAction("requestPickupOtp", () => apiRequestPickupOtp(orderId));
    setPickupOtpRequested(true);
    return res;
  }, [resolveOrderId, runAction]);

  /**
   * Picked up: confirm-pickup with the restaurant's 4-digit OTP, or "SKIP" (web "Skip OTP" button —
   * a product decision, see API_MAP). billImageUrl is null on web. -> PICKED_UP.
   */
  const pickUpOrder = useCallback(
    async (otp, billImageUrl = null) => {
      const order = activeOrderRef.current;
      const orderId = resolveOrderId();
      if (!orderId) {
        toast.error("Order id not found. Please refresh current trip.");
        throw new Error("Missing order id");
      }
      try {
        await runAction("pickUp", () =>
          confirmOrderId(orderId, order?.displayOrderId || orderId, lastCoordRef.current || {}, { billImageUrl, otp }),
        );
        setTripStatus(TRIP_STATUS.PICKED_UP);
      } catch (err) {
        toast.error(errMessage(err, "Error confirming pickup"));
        throw err;
      }
    },
    [activeOrderRef, resolveOrderId, runAction],
  );

  // Reached customer (sends the drop OTP to the customer) -> REACHED_DROP.
  const reachDrop = useCallback(async () => {
    const orderId = resolveOrderId();
    if (!orderId) {
      toast.error("Order id not found. Please refresh current trip.");
      throw new Error("Missing order id");
    }
    try {
      await runAction("reachDrop", () => confirmReachedDrop(orderId));
      setTripStatus(TRIP_STATUS.REACHED_DROP);
      setDropOtpResendAt(Date.now() + DROP_OTP_RESEND_COOLDOWN_S * 1000);
    } catch (err) {
      toast.error(errMessage(err, "Failed to notify arrival"));
      throw err;
    }
  }, [resolveOrderId, runAction]);

  useEffect(() => {
    reachPickupRef.current = reachPickup;
    reachDropRef.current = reachDrop;
  }, [reachDrop, reachPickup]);

  // "Customer didn't get OTP? Resend" — reached-drop again, 30 s cooldown.
  const resendDropOtp = useCallback(async () => {
    const order = activeOrderRef.current;
    if (Date.now() < dropOtpResendAt || order?.deliveryVerification?.dropOtp?.verified) return false;
    const orderId = order?.order_id || order?.orderId || order?._id;
    try {
      await runAction("resendDropOtp", () => confirmReachedDrop(orderId));
      toast.success("OTP resent to customer via screen & push notification");
      setDropOtpResendAt(Date.now() + DROP_OTP_RESEND_COOLDOWN_S * 1000);
      return true;
    } catch (err) {
      toast.error(errMessage(err, "Failed to resend OTP to customer"));
      return false;
    }
  }, [activeOrderRef, dropOtpResendAt, runAction]);

  // Drop OTP verify (4 digits); marks deliveryVerification.dropOtp {verified, code} on the active order.
  const verifyDropOtp = useCallback(
    async (otp) => {
      const order = activeOrderRef.current;
      const orderId = order?.order_id || order?.orderId || order?._id;
      const code = String(otp || "");
      if (code.length < 4) return false;
      try {
        const res = await runAction("verifyDropOtp", () => apiVerifyDropOtp(orderId, code));
        if (!res?.success) return false;
        setActiveOrderState((cur) =>
          cur
            ? {
                ...cur,
                deliveryVerification: {
                  ...cur.deliveryVerification,
                  dropOtp: { ...cur.deliveryVerification?.dropOtp, verified: true, code },
                },
              }
            : cur,
        );
        return true;
      } catch (err) {
        toast.error(errMessage(err, "Invalid OTP entered"));
        throw err;
      }
    },
    [activeOrderRef, runAction],
  );

  /**
   * useOrderManager.completeDelivery(otp, paymentOverride, targetOrder): verify the drop OTP unless
   * already verified / bypassed ("BYPASS"/"SKIP"/empty), then PATCH complete {otp, rating:5,
   * paymentOverride, paymentMethod:paymentOverride}. paymentOverride "cash" = COD collected,
   * "online" = paid by QR/prepaid. "already at status"/"delivered" errors count as success. -> COMPLETED.
   */
  const completeDelivery = useCallback(
    async (otp, paymentOverride, targetOrder) => {
      const target = targetOrder || activeOrderRef.current;
      const orderId = target?.order_id || target?.orderId || target?._id || target?.orderMongoId || resolveOrderId();
      if (!orderId) {
        toast.error("Order id not found. Please refresh current trip.");
        throw new Error("Missing order id");
      }
      try {
        const alreadyVerified = target?.deliveryVerification?.dropOtp?.verified;
        const bypassed = !otp || otp === "BYPASS" || otp === "SKIP";
        if (!alreadyVerified && !bypassed) {
          const v = await apiVerifyDropOtp(orderId, otp);
          if (!v?.success) {
            toast.error("Invalid OTP. Please check with customer.");
            throw new Error("Invalid OTP");
          }
        }
        const otpToUse = otp || target?.deliveryVerification?.dropOtp?.code || "BYPASS";
        let finalOrder = target;
        try {
          const res = await runAction("complete", () =>
            apiCompleteDelivery(orderId, { otp: otpToUse, rating: 5, paymentOverride, paymentMethod: paymentOverride }),
          );
          if (res?.success && res?.data?.order) finalOrder = res.data.order;
        } catch (completeErr) {
          const m = String(completeErr?.data?.error || completeErr?.data?.message || "").toLowerCase();
          if (!m.includes("already at status") && !m.includes("delivered")) throw completeErr;
        }
        clearInterval(qrPollRef.current);
        if (finalOrder) setActiveOrder(normalizeDeliveryActiveOrder(finalOrder));
        setTripStatus(TRIP_STATUS.COMPLETED);
        emit({ type: "trip_completed", order: finalOrder });
        return finalOrder;
      } catch (err) {
        toast.error(errMessage(err, "Verification failed"));
        throw err;
      }
    },
    [activeOrderRef, emit, resolveOrderId, runAction, setActiveOrder],
  );

  // COD: confirm cash collected (completes with paymentMethod "cash").
  const collectCash = useCallback(
    async (otp) => {
      const res = await completeDelivery(otp || activeOrderRef.current?.deliveryVerification?.dropOtp?.code || "BYPASS", "cash");
      toast.success("Cash collection recorded");
      return res;
    },
    [activeOrderRef, completeDelivery],
  );

  // GET payment-status once: 'paid' stops polling; 'expired'/'failed' stop polling; else pending.
  const checkPaymentStatus = useCallback(async () => {
    const order = activeOrderRef.current;
    const orderId = order?.order_id || order?.orderId || order?._id;
    if (!orderId) return null;
    try {
      const res = await getPaymentStatus(orderId);
      const data = res?.data || {};
      const status = String(data?.status || data?.payment?.status || "pending").toLowerCase();
      if (status === "paid") {
        clearInterval(qrPollRef.current);
        setPayment((p) => ({ ...p, status: "paid" }));
        toast.success("Payment verified by Razorpay");
      } else if (["expired", "failed"].includes(status)) {
        clearInterval(qrPollRef.current);
        setPayment((p) => ({ ...p, status }));
      } else {
        setPayment((p) => ({ ...p, status: "pending" }));
      }
      return status;
    } catch {
      return null; // a failed check is never treated as payment
    }
  }, [activeOrderRef]);

  const stopQrPolling = useCallback(() => {
    clearInterval(qrPollRef.current);
    qrPollRef.current = null;
  }, []);

  // COD: create the Razorpay UPI QR and poll payment-status every 4 s until paid/expired/failed.
  const startCollectQr = useCallback(async () => {
    const order = activeOrderRef.current;
    const orderId = order?.order_id || order?.orderId || order?._id;
    setPayment((p) => ({ ...p, loading: true }));
    try {
      const res = await createCollectQr(orderId);
      const data = res?.data || {};
      const imageUrl = data.image_url || data.imageUrl || null;
      if (!imageUrl) {
        toast.error("Could not generate QR code");
        setPayment((p) => ({ ...p, loading: false }));
        return null;
      }
      const qr = { ...data, imageUrl };
      setPayment({ status: "pending", qr, loading: false });
      stopQrPolling();
      qrPollRef.current = setInterval(checkPaymentStatus, QR_POLL_MS);
      checkPaymentStatus();
      return qr;
    } catch (err) {
      toast.error(errMessage(err, "QR Generation failed"));
      setPayment((p) => ({ ...p, loading: false }));
      return null;
    }
  }, [activeOrderRef, checkPaymentStatus, stopQrPolling]);

  // Reset the payment step when the verification flow opens for an order.
  const resetPayment = useCallback(
    (order) => {
      stopQrPolling();
      const o = order || activeOrderRef.current || {};
      const method = String(o.paymentMethod || o.payment?.method || o.transaction?.payment?.method || o.transaction?.paymentMethod || "").toLowerCase();
      const isCod = ["cash", "cod", "cash_on_delivery", "razorpay_qr"].includes(method);
      const rawStatus = String(o.payment?.status || o.paymentStatus || o.transactionStatus || o.transaction?.status || o.status || "").toLowerCase();
      const paid = ["paid", "captured", "completed", "settled"].includes(rawStatus) || (!isCod && Boolean(method));
      setPayment({ status: paid ? "paid" : method === "razorpay_qr" ? "pending" : "idle", qr: null, loading: false });
    },
    [activeOrderRef, stopQrPolling],
  );

  // Summary "Done": drop the completed order and go back to IDLE.
  const resetTrip = useCallback(() => {
    const id = resolveOrderId();
    if (id) removeAcceptedOrder(id);
    clearActiveOrder();
    stopQrPolling();
    setPickupOtpRequested(false);
    autoArrivalRef.current = { PICKING_UP: false, PICKED_UP: false };
    refreshAcceptedOrders().catch(() => {});
  }, [clearActiveOrder, refreshAcceptedOrders, removeAcceptedOrder, resolveOrderId, stopQrPolling]);

  // OrdersV2 "open" on an accepted order: select it and derive its phase.
  const openAcceptedOrder = useCallback(
    (order) => {
      const normalized = normalizeDeliveryActiveOrder(order);
      setActiveOrder(normalized);
      setTripStatus(getTripStatusForOrder(normalized));
      setPickupOtpRequested(false);
    },
    [setActiveOrder],
  );

  // order_auto_killed reason prompt -> PATCH /reject {reason} (reason ignored by backend; never emitted).
  const submitAutoKillReason = useCallback(async (reason) => {
    const o = autoKilledOrder;
    setAutoKilledOrder(null);
    if (!o || !String(reason || "").trim()) return false;
    try {
      await rejectOrder(o.orderId || o.orderMongoId || o._id, { reason });
      toast.success("Reason saved successfully.");
      return true;
    } catch {
      toast.error("Failed to save reason.");
      return false;
    }
  }, [autoKilledOrder]);

  // Route polyline from the map (Directions): kept for update-location and pushed once per change.
  const setActivePolyline = useCallback(
    (polyline) => {
      setActivePolylineState(polyline || null);
      const encoded = typeof polyline === "string" ? polyline : polyline?.points || "";
      if (!encoded || encoded === lastPolylineRef.current) return;
      const meta = resolveActiveOrderMeta(activeOrderRef.current);
      const c = lastCoordRef.current || riderLocationRef.current;
      if (!meta?.orderId || c?.lat == null) return;
      lastPolylineRef.current = encoded;
      emitLocation({ ...meta, lat: c.lat, lng: c.lng, heading: c.heading || 0, polyline: encoded, status: tripStatusRef.current, eta: etaRef.current });
    },
    [activeOrderRef, riderLocationRef, tripStatusRef],
  );

  useEffect(() => {
    lastPolylineRef.current = "";
  }, [activeOrder?._id, tripStatus]);

  // ======================= proximity / ETA (useProximityCheck) =======================

  const proximityTarget = useMemo(() => getProximityTarget(activeOrder, tripStatus), [activeOrder, tripStatus]);
  const distanceToTarget = useMemo(() => {
    if (!riderLocation || !proximityTarget) return Infinity;
    return calculateDistance(riderLocation.lat, riderLocation.lng, proximityTarget.lat, proximityTarget.lng);
  }, [proximityTarget, riderLocation]);
  const actionLimit =
    tripStatus === TRIP_STATUS.PICKING_UP
      ? settings.pickupRangeLimit || DEFAULT_RANGE_M
      : tripStatus === TRIP_STATUS.PICKED_UP
        ? settings.deliveryRangeLimit || DEFAULT_RANGE_M
        : DEFAULT_RANGE_M;
  const isWithinRange = RANGE_BYPASS ? true : !proximityTarget ? true : distanceToTarget <= actionLimit;
  const [eta, setEta] = useState(null);
  useEffect(() => {
    let next = null;
    if (distanceToTarget != null && distanceToTarget !== Infinity) {
      const speeds = rollingSpeedRef.current;
      const avg = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 8;
      next = calculateETA(distanceToTarget, avg);
    }
    etaRef.current = next;
    setEta(next);
  }, [distanceToTarget]);

  // ======================= offer countdown + ring (NewOrderModal, decision B) =======================

  const visibleOffer = useMemo(
    () => (orderCapacity.canAcceptMore !== false ? getPrimaryIncomingOrder(incomingOrders, selectedIncomingId) : null),
    [incomingOrders, orderCapacity.canAcceptMore, selectedIncomingId],
  );
  const visibleKey = visibleOffer ? keyOf(visibleOffer) : null;

  useEffect(() => subscribeRing((ringing) => setIsRinging(ringing)), []);
  useEffect(() => {
    prepareRing();
  }, []);

  useEffect(() => {
    if (!visibleKey || !isOnline) {
      setOfferDeadline(null);
      stopRing();
      return undefined;
    }
    let deadline = offerFirstShownRef.current.get(visibleKey);
    if (!deadline) {
      deadline = Date.now() + OFFER_WINDOW_MS;
      offerFirstShownRef.current.set(visibleKey, deadline);
    }
    setOfferDeadline(deadline);
    startRing(visibleKey, { maxMs: deadline - Date.now() });
    return undefined;
  }, [isOnline, visibleKey]);

  // 1 s tick; at 0 the offer is auto-passed (web NewOrderModal onReject).
  const visibleOfferRef = useLatest(visibleOffer);
  useEffect(() => {
    if (!offerDeadline) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((offerDeadline - Date.now()) / 1000));
      setOfferTimeLeft(left);
      if (left <= 0) {
        clearInterval(timer);
        const o = visibleOfferRef.current;
        if (o) passOffer(o, { auto: true });
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
  }, [offerDeadline, passOffer, visibleOfferRef]);

  // Forget deadlines of offers no longer queued.
  useEffect(() => {
    const keys = new Set(incomingOrders.map(keyOf));
    offerFirstShownRef.current.forEach((_, k) => {
      if (!keys.has(k)) offerFirstShownRef.current.delete(k);
    });
  }, [incomingOrders]);

  // ======================= socket =======================

  useEffect(() => subscribeSocketConnection(setIsConnected), []);

  useEffect(() => {
    if (!isAuthenticated || !riderId) {
      disconnectDeliverySocket();
      return undefined;
    }
    connectDeliverySocket(riderId);
    const offerHandler = (data) => {
      if (onlineRef.current) enqueueOffer(data);
    };
    const unsub = subscribeDeliveryEvents({
      connect: () => {
        recoverDeliveryState();
      },
      reconnect: () => {
        recoverDeliveryState();
      },
      active_order: (order) => {
        if (order) applyRecoveredOrder(order);
      },
      pending_offers: ({ offers = [] } = {}) => {
        if (!onlineRef.current || !Array.isArray(offers)) return;
        offers.forEach((o) => enqueueOffer(o));
      },
      new_order_available: offerHandler,
      new_order: offerHandler,
      play_notification_sound: (data) =>
        offerHandler({ orderId: data?.orderId || data?.order_id, orderMongoId: data?.orderMongoId || data?.order_mongo_id, ...data }),
      order_ready: (data) => {
        setOrderReady(data || null);
        pulseAlert();
        emit({ type: "order_ready", data });
      },
      order_status_update: (data) => {
        if (!data) return;
        const status = String(data.status || data.orderStatus || "").toLowerCase();
        if (status.includes("cancel")) {
          toast.error("Order cancelled");
          const id = getOrderMongoId(data) || getOrderAcceptId(data);
          if (incomingRef.current.some((o) => isSameOrder(o, data))) {
            removeOfferFromQueue({ ...data, claimedBy: "cancelled" }, { notify: false });
          }
          if (!id || isSameOrder(activeOrderRef.current, data)) resetTrip();
          else removeAcceptedOrder(id);
          emit({ type: "order_cancelled", data });
          return;
        }
        const assignedToMe =
          String(data.dispatchStatus || data.dispatch?.status || "").toLowerCase() === "accepted" &&
          !acceptedOrdersRef.current.some((o) => isSameOrder(o, data));
        if (assignedToMe) refreshAcceptedOrders().catch(() => {});
        emit({ type: "order_status_update", data });
      },
      order_cancelled: (data) => {
        handleClaimed({ orderId: getOrderMongoId(data) || data?.orderId, claimedBy: "cancelled" });
        const id = getOrderMongoId(data) || getOrderAcceptId(data);
        if (id && isSameOrder(activeOrderRef.current, data)) resetTrip();
        else if (id) removeAcceptedOrder(id);
      },
      order_deleted: (data) => {
        const id = getOrderMongoId(data) || getOrderAcceptId(data);
        if (!id) return;
        removeOfferFromQueue(data, { notify: false });
        if (isSameOrder(activeOrderRef.current, data)) resetTrip();
        else removeAcceptedOrder(id);
      },
      order_auto_killed: (data) => {
        handleClaimed({ orderId: getOrderMongoId(data) || data?.orderId, claimedBy: "cancelled" });
        setAutoKilledOrder(data || null);
      },
      order_reassigned_elsewhere: (data) => {
        const id = getOrderMongoId(data) || data?.orderId;
        if (id) handleClaimed({ orderId: id, orderMongoId: getOrderMongoId(data) || id, claimedBy: data?.claimedBy || "reassigned" });
      },
      order_claimed: (data) => {
        const id = getOrderMongoId(data) || data?.orderId || data?.order_id;
        if (id) handleClaimed({ orderId: id, orderMongoId: getOrderMongoId(data) || id, claimedBy: data?.claimedBy });
      },
      admin_notification: (payload) => {
        setAdminNotification(payload || null);
        toast.info(payload?.title || "New Notification", {
          description: payload?.message || payload?.body || "",
          duration: 8000,
        });
        emit({ type: "admin_notification", data: payload });
        emit({ type: "inbox_refresh" });
      },
      admin_force_status: (payload) => {
        const online = payload?.status === "online";
        if (online) {
          persistOnline(true);
          onlineRef.current = true;
          if (appActiveRef.current) ensureTracking();
          toast.success(payload?.message || "You have been marked online by the Admin.", { duration: 5000 });
        } else {
          goOffline({ notifyServer: false });
          toast.error(payload?.message || "You have been marked offline by the Admin.", { duration: 8000 });
        }
        emit({ type: "admin_force_status", data: payload });
      },
    });
    return unsub;
  }, [
    acceptedOrdersRef,
    activeOrderRef,
    appActiveRef,
    applyRecoveredOrder,
    emit,
    enqueueOffer,
    ensureTracking,
    goOffline,
    handleClaimed,
    incomingRef,
    isAuthenticated,
    onlineRef,
    persistOnline,
    recoverDeliveryState,
    refreshAcceptedOrders,
    removeAcceptedOrder,
    removeOfferFromQueue,
    resetTrip,
    riderId,
  ]);

  // ======================= Firebase RTDB offers =======================

  useEffect(() => {
    if (!isAuthenticated || !riderId) return undefined;
    const unsub = subscribeDeliveryPartnerOffers(
      riderId,
      (offersMap = {}) => {
        if (!onlineRef.current) return;
        const currentKeys = new Set(Object.keys(offersMap || {}));
        prevFirebaseKeysRef.current.forEach((prevKey) => {
          if (!currentKeys.has(prevKey)) handleClaimed({ orderId: prevKey, orderMongoId: prevKey, claimedBy: "claimed" });
        });
        prevFirebaseKeysRef.current = currentKeys;
        Object.entries(offersMap || {}).forEach(([orderMongoId, offer]) => {
          if (!offer || typeof offer !== "object") return;
          if (String(offer.status || "offered").toLowerCase() !== "offered") return;
          const offeredAt = Number(offer.offeredAt || offer.last_updated || 0);
          const lastSeen = lastFirebaseOfferAtRef.current.get(orderMongoId) || 0;
          if (!offeredAt || offeredAt <= lastSeen) return;
          lastFirebaseOfferAtRef.current.set(orderMongoId, offeredAt);
          enqueueOffer({ ...offer, orderMongoId, _id: offer._id || orderMongoId, source: "firebase" });
        });
      },
      () => {
        // RTDB denied / not configured: socket + poll + FCM remain.
      },
    );
    return () => {
      prevFirebaseKeysRef.current = new Set();
      unsub();
    };
  }, [enqueueOffer, handleClaimed, isAuthenticated, onlineRef, riderId]);

  // ======================= FCM foreground relay =======================

  useEffect(
    () =>
      setForegroundPushHandler((data) => {
        const type = String(data?.type || "").toLowerCase();
        if (type === "new_order") {
          if (!onlineRef.current) return;
          const hinted = normalizeIncomingOrder({
            orderId: data?.orderId || data?.orderMongoId,
            orderMongoId: data?.orderMongoId || data?.orderId,
          });
          if (hinted && (hinted.orderId || hinted.orderMongoId)) enqueueOffer(hinted);
          recoverDeliveryState();
        } else if (type === "order_claimed") {
          const id = data?.orderMongoId || data?.orderId;
          if (id) handleClaimed({ orderId: id, orderMongoId: id, claimedBy: data?.claimedBy });
        } else if (type === "delivery_accepted") {
          refreshAcceptedOrders().catch(() => {});
        } else if (type.startsWith("onboarding_")) {
          refreshProfile({ noCache: true }).catch(() => {});
        }
      }),
    [enqueueOffer, handleClaimed, onlineRef, recoverDeliveryState, refreshAcceptedOrders, refreshProfile],
  );

  // ======================= poll (DeliveryHomeV2) =======================

  useEffect(() => {
    if (!isAuthenticated || !isOnline || !appActive) return undefined;
    hydrateAvailableOrders();
    const timer = setInterval(hydrateAvailableOrders, isConnected ? POLL_MS_SOCKET : POLL_MS_NO_SOCKET);
    return () => clearInterval(timer);
  }, [appActive, hydrateAvailableOrders, isAuthenticated, isConnected, isOnline]);

  // ======================= lifecycle: launch, foreground, logout =======================

  useEffect(() => {
    if (!isAuthenticated) {
      setOnlineHydrated(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const pref = await store.get(KEYS.onlinePref, null);
      let localOnline = Boolean(pref?.isOnline);
      let serverStatus = null;
      try {
        const res = await getMe();
        serverStatus = String(res?.data?.user?.availabilityStatus || "").toLowerCase() || null;
      } catch {
        // offline launch: trust the local preference
      }
      if (cancelled) return;
      if (serverStatus === "offline" && localOnline) localOnline = false;
      if (serverStatus === "online" && !localOnline) updateOnlineStatus(false).catch(() => {}); // web effect 2 on mount
      persistOnline(localOnline);
      onlineRef.current = localOnline;
      setOnlineHydrated(true);
      await refreshLocationPermission();
      if (localOnline) await ensureTracking();
      else if (await isBackgroundTrackingActive()) await stopBackgroundTracking({ flush: true });
      syncWithServer();
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureTracking, isAuthenticated, onlineRef, persistOnline, refreshLocationPermission, syncWithServer]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const active = state === "active";
      setAppActive(active);
      if (!active) return;
      ensureSocketConnected();
      applyPendingTrackingConfig().catch(() => {});
      if (!riderIdRef.current) return;
      recoverDeliveryState();
      refreshLocationPermission().then((p) => {
        if (!onlineRef.current) return;
        if (p && p.foreground !== "granted") {
          // Permission revoked while online: ineligible for orders (web forced offline on GPS denial).
          setLocationError("Location is off or unavailable. Enable precise location to go online.");
          toast.error("Location unavailable", { description: "Location is off or unavailable. Enable precise location to go online." });
          goOffline();
        } else {
          isBackgroundTrackingActive().then((running) => {
            if (!running) ensureTracking();
          });
        }
      });
    });
    return () => sub.remove();
  }, [ensureTracking, goOffline, onlineRef, recoverDeliveryState, refreshLocationPermission, riderIdRef]);

  useEffect(
    () =>
      onLogout(() => {
        disconnectDeliverySocket();
        stopQrPolling();
        stopRing();
        setIsOnline(false);
        setOnlineHydrated(false);
        setIncomingOrders([]);
        setSelectedIncomingId(null);
        setActiveOrderState(null);
        setAcceptedOrdersState([]);
        setOrderCapacityState(DEFAULT_CAPACITY);
        setTripStatus(TRIP_STATUS.IDLE);
        setRiderLocation(null);
        setCashLimitNotice(null);
        setPayment({ status: "idle", qr: null, loading: false });
        setIsTracking(false);
        lastCoordRef.current = null;
        lastFirebaseOfferAtRef.current = new Map();
        offerFirstShownRef.current = new Map();
      }),
    [onLogout, stopQrPolling],
  );

  useEffect(() => () => stopQrPolling(), [stopQrPolling]);

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const value = useMemo(
    () => ({
      // duty / location
      isOnline,
      onlineHydrated,
      goingOnline,
      riderLocation,
      locationError,
      locationPermission,
      trackingConfig,
      isTracking,
      prepareGoOnline,
      captureShiftSelfie,
      resolveShiftAddress,
      goOnline,
      startShift,
      goOffline,
      requestBackgroundLocation,
      refreshLocationPermission,
      // offers
      incomingOrders,
      visibleOffer,
      selectedIncomingId,
      selectIncomingOrder,
      offerTimeLeft,
      offerDeadline,
      acceptOffer,
      passOffer,
      cashLimitNotice,
      isRinging,
      // trip
      activeOrder,
      acceptedOrders,
      orderCapacity,
      tripStatus,
      settings,
      setSettings,
      actionInFlight,
      distanceToTarget,
      isWithinRange,
      actionLimit,
      eta,
      pickupOtpRequested,
      dropOtpResendAt,
      payment,
      openAcceptedOrder,
      reachPickup,
      requestPickupOtp,
      pickUpOrder,
      reachDrop,
      resendDropOtp,
      verifyDropOtp,
      completeDelivery,
      collectCash,
      startCollectQr,
      checkPaymentStatus,
      stopQrPolling,
      resetPayment,
      resetTrip,
      refreshAcceptedOrders,
      recoverDeliveryState,
      setActivePolyline,
      // realtime
      isConnected,
      orderReady,
      clearOrderReady: () => setOrderReady(null),
      adminNotification,
      clearAdminNotification: () => setAdminNotification(null),
      autoKilledOrder,
      submitAutoKillReason,
      subscribe,
    }),
    [
      isOnline,
      onlineHydrated,
      goingOnline,
      riderLocation,
      locationError,
      locationPermission,
      trackingConfig,
      isTracking,
      prepareGoOnline,
      goOnline,
      startShift,
      goOffline,
      requestBackgroundLocation,
      refreshLocationPermission,
      incomingOrders,
      visibleOffer,
      selectedIncomingId,
      selectIncomingOrder,
      offerTimeLeft,
      offerDeadline,
      acceptOffer,
      passOffer,
      cashLimitNotice,
      isRinging,
      activeOrder,
      acceptedOrders,
      orderCapacity,
      tripStatus,
      settings,
      setSettings,
      actionInFlight,
      distanceToTarget,
      isWithinRange,
      actionLimit,
      eta,
      pickupOtpRequested,
      dropOtpResendAt,
      payment,
      openAcceptedOrder,
      reachPickup,
      requestPickupOtp,
      pickUpOrder,
      reachDrop,
      resendDropOtp,
      verifyDropOtp,
      completeDelivery,
      collectCash,
      startCollectQr,
      checkPaymentStatus,
      stopQrPolling,
      resetPayment,
      resetTrip,
      refreshAcceptedOrders,
      recoverDeliveryState,
      setActivePolyline,
      isConnected,
      orderReady,
      adminNotification,
      autoKilledOrder,
      submitAutoKillReason,
      subscribe,
    ],
  );

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}

export function useDelivery() {
  const ctx = useContext(DeliveryContext);
  if (!ctx) throw new Error("useDelivery must be used inside DeliveryProvider");
  return ctx;
}
