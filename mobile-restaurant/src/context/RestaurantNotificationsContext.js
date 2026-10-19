// ONE provider for the restaurant realtime layer: a port of hooks/useRestaurantNotifications.js
// (socket, queue, alert ring, pickup OTP) plus the new-order popup state that lived in
// OrdersMain.jsx (180 s accept countdown, auto-reject, accept/reject/dismiss) so the shell can
// render the popup and the pickup-OTP modal on every screen. The web's window events
// (restaurantOrderStatusUpdate, restaurantPickupOtpReveal, notification-inbox-refresh) become
// subscribe(listener) events.
//
// REST fallback (decision): the web polled GET /food/restaurant/orders every 8 s regardless of the
// socket, which alone exceeds the backend limit of 100 requests / 15 min / user. Here:
//   - socket connected: no interval poll; one reconciliation fetch on every (re)connect;
//   - socket disconnected (or not yet connected): poll every 30 s (FALLBACK_POLL_MS);
//   - app returns to the foreground: one reconciliation fetch (the web's visibilitychange fetch).
// Worst case 30 requests / 15 min, plus 30 from the 30 s block-guard /current poll.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { getOrderById, getOrders, isCancelledStatus, normalizeOrderStatus, rejectOrder, acceptOrder as apiAcceptOrder, resolveOrderActionId } from "../api/orders";
import { setNewOrderPushHandler } from "../lib/push";
import { prepareRing, releaseRing, startRing, stopRing, subscribeRing } from "../lib/ring";
import {
  connectRestaurantSocket,
  disconnectRestaurantSocket,
  ensureSocketConnected,
  subscribeRestaurantEvents,
  subscribeSocketConnection,
} from "../lib/socket";
import { KEYS, store } from "../storage";
import { useAuth } from "./AuthContext";

export const FALLBACK_POLL_MS = 30000;
export const ACCEPT_WINDOW_SECONDS = 180;
export const ALERT_DEDUPE_MS = 15000;
const SOCKET_SCHEDULE_WINDOW_MS = 15 * 60000; // socket: ignore scheduled orders > 15 min ahead
const POLL_SCHEDULE_WINDOW_MS = 30 * 60000; // poll/popup: scheduled orders due within 30 min
const PICKUP_OTP_MAX_AGE_MS = 15 * 60000;
export const AUTO_REJECT_REASON = "No response from restaurant (Auto-rejected)";
const PICKUP_OTP_MESSAGE = "Delivery partner is requesting the Pickup OTP. Please share this code with them.";

const NotificationsContext = createContext(null);

// All ids an order-like payload may carry (orderMongoId, orderId display id, _id, id).
function orderKeys(o) {
  return [o?.orderMongoId, o?.order_mongo_id, o?.orderId, o?.order_id, o?._id, o?.id]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
}
const primaryKey = (o) => orderKeys(o)[0] || "";
const sameOrder = (a, b) => {
  const ka = orderKeys(a);
  return orderKeys(b).some((k) => ka.includes(k));
};
const markIds = (set, o) => orderKeys(o).forEach((k) => set.add(k));
const hasAnyId = (set, o) => orderKeys(o).some((k) => set.has(k));
const scheduledBeyond = (o, windowMs) =>
  Boolean(o?.scheduledAt) && new Date(o.scheduledAt).getTime() > Date.now() + windowMs;

// Socket new_order payload -> queue entry (useRestaurantNotifications normalizedOrder).
function normalizeIncoming(orderData = {}) {
  return {
    ...orderData,
    orderMongoId: orderData.orderMongoId || orderData._id || orderData.order_mongo_id,
    orderId: orderData.orderId || orderData.order_id || orderData._id,
    status: orderData.status ? normalizeOrderStatus(orderData.status) : normalizeOrderStatus(orderData.orderStatus),
    total: orderData.total ?? orderData.pricing?.total ?? 0,
    paymentMethod: orderData.paymentMethod || orderData.payment?.method || null,
  };
}

// REST row (already normalized by api/orders) -> popup shape (OrdersMain orderForPopup).
function fromRow(o) {
  return {
    ...o,
    orderId: o.orderId || o.order_id || o._id,
    orderMongoId: o._id || o.orderMongoId,
    total: o.pricing?.total ?? o.total ?? 0,
    paymentMethod: o.paymentMethod || o.payment?.method || null,
    estimatedDeliveryTime: o.estimatedDeliveryTime || 30,
  };
}

export function RestaurantNotificationsProvider({ children }) {
  const { isAuthenticated, restaurantId, onLogout } = useAuth();

  const [orderQueue, setOrderQueue] = useState([]);
  const [pickupOtpReveal, setPickupOtpRevealState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [muted, setMutedState] = useState(false);
  // New-order popup (OrdersMain): the order shown and when its 180 s window ends.
  const [popupOrder, setPopupOrder] = useState(null);
  const [acceptDeadline, setAcceptDeadline] = useState(null);
  const [actionInFlight, setActionInFlight] = useState(null); // "accept" | "reject" | null

  const listenersRef = useRef(new Set());
  const lastAlertAtRef = useRef(new Map());
  const cancelledIdsRef = useRef(new Set());
  const shownIdsRef = useRef(new Set()); // OrdersMain shownOrdersRef
  const acknowledgedIdsRef = useRef(new Set()); // accepted / rejected / dismissed here
  const activeOrderRef = useRef(null); // the order the ring loop is for
  const popupOrderRef = useRef(null);
  const pickupRef = useRef(null);
  const mutedRef = useRef(false);
  const actionRef = useRef(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    popupOrderRef.current = popupOrder;
  }, [popupOrder]);

  const emit = useCallback((event) => {
    listenersRef.current.forEach((fn) => {
      try {
        fn(event);
      } catch {
        // ignore listener errors
      }
    });
  }, []);

  // ---- pickup OTP (persisted like localStorage.restaurant_pickupOtpReveal) ----
  const setPickupOtpReveal = useCallback((data) => {
    pickupRef.current = data || null;
    setPickupOtpRevealState(data || null);
    store.set(KEYS.pickupOtpReveal, data || null);
  }, []);

  // ---- ring ----
  useEffect(() => subscribeRing((ringing) => setIsRinging(ringing)), []);

  const stopAlert = useCallback(() => {
    activeOrderRef.current = null;
    stopRing();
  }, []);

  const enqueueOrder = useCallback((order) => {
    setOrderQueue((prev) => (prev.some((o) => sameOrder(o, order)) ? prev : [...prev, order]));
  }, []);

  // useRestaurantNotifications.handleIncomingOrderAlert
  const handleIncomingOrderAlert = useCallback((order, source) => {
    if (scheduledBeyond(order, SOCKET_SCHEDULE_WINDOW_MS)) return;
    const key = primaryKey(order);
    const now = Date.now();
    const last = key ? lastAlertAtRef.current.get(key) || 0 : 0;
    const deduped = key && now - last < ALERT_DEDUPE_MS;
    if (key) lastAlertAtRef.current.set(key, now);
    // Socket events always ring (a "Resend" from the backend rings again); polls/pushes dedupe.
    if (deduped && source !== "socket") return;
    activeOrderRef.current = order || { id: now };
    if (!mutedRef.current) startRing(key || null);
  }, []);

  const removeOrderFromQueue = useCallback(
    (orderLike) => {
      setOrderQueue((prev) => prev.filter((o) => !sameOrder(o, orderLike)));
      if (activeOrderRef.current && sameOrder(activeOrderRef.current, orderLike)) stopAlert();
    },
    [stopAlert],
  );

  // web clearNewOrder + OrdersMain popup reset: stop ring, close popup, pop the queue head.
  const closePopupAndDequeue = useCallback(() => {
    const current = popupOrderRef.current;
    if (current) {
      markIds(shownIdsRef.current, current);
      markIds(acknowledgedIdsRef.current, current);
    }
    stopAlert();
    popupOrderRef.current = null;
    setPopupOrder(null);
    setAcceptDeadline(null);
    // Remove exactly the popup's order (it may already be gone, e.g. cancelled); never drop another.
    setOrderQueue((prev) => (current ? prev.filter((o) => !sameOrder(o, current)) : prev.slice(1)));
  }, [stopAlert]);

  // ---- popup from the queue head (OrdersMain useEffect on newOrder) ----
  const newOrder = orderQueue[0] || null;
  useEffect(() => {
    if (!newOrder) return;
    if (isCancelledStatus(newOrder.status || newOrder.orderStatus)) {
      setOrderQueue((prev) => prev.filter((o) => !sameOrder(o, newOrder)));
      return;
    }
    if (scheduledBeyond(newOrder, POLL_SCHEDULE_WINDOW_MS)) {
      emit({ type: "scheduled_order", order: newOrder, scheduledAt: newOrder.scheduledAt });
      setOrderQueue((prev) => prev.filter((o) => !sameOrder(o, newOrder)));
      return;
    }
    if (hasAnyId(shownIdsRef.current, newOrder)) {
      // Already shown and closed: drop it so it cannot block the orders queued behind it
      // (the web's queue could stall here).
      if (!popupOrderRef.current) setOrderQueue((prev) => prev.filter((o) => !sameOrder(o, newOrder)));
      return;
    }
    markIds(shownIdsRef.current, newOrder);
    if (!popupOrderRef.current) {
      popupOrderRef.current = newOrder;
      setPopupOrder(newOrder);
      setAcceptDeadline(Date.now() + ACCEPT_WINDOW_SECONDS * 1000);
      // A queued order surfacing after the previous popup closed rings for itself (the previous
      // close stopped the loop, as web clearNewOrder does). Same 6 s / 120 s loop.
      if (!mutedRef.current && !(activeOrderRef.current && sameOrder(activeOrderRef.current, newOrder))) {
        activeOrderRef.current = newOrder;
        startRing(primaryKey(newOrder) || null);
      }
    }
    emit({ type: "orders_refresh" });
  }, [newOrder, emit]);

  // ---- accept / reject / dismiss (OrdersMain handleAcceptOrder / handleRejectConfirm / handleRejectCancel) ----
  const acceptNewOrder = useCallback(
    async (prepTimeMins = null) => {
      const order = popupOrderRef.current || newOrder;
      if (actionRef.current) return null;
      let orderId = resolveOrderActionId(order);
      actionRef.current = "accept";
      setActionInFlight("accept");
      try {
        if (!orderId) {
          const latest = await getOrders({ page: 1, limit: 20 }, { force: true });
          const target = (latest?.data?.orders || []).find((o) => ["confirmed", "created"].includes(String(o.status || o.orderStatus).toLowerCase()));
          orderId = resolveOrderActionId(target);
        }
        if (!orderId) throw new Error("Unable to accept this order: order id missing");
        const res = await apiAcceptOrder(orderId, prepTimeMins);
        closePopupAndDequeue();
        emit({ type: "accepted", order, orderId });
        emit({ type: "orders_refresh" });
        return res;
      } finally {
        actionRef.current = null;
        setActionInFlight(null);
      }
    },
    [newOrder, closePopupAndDequeue, emit],
  );

  const rejectNewOrder = useCallback(
    async (reason = "") => {
      const order = popupOrderRef.current || newOrder;
      if (actionRef.current) return null;
      actionRef.current = "reject";
      setActionInFlight("reject");
      try {
        const orderId = order?.orderMongoId || order?.orderId || resolveOrderActionId(order);
        let res = null;
        if (orderId) res = await rejectOrder(orderId, reason);
        closePopupAndDequeue();
        emit({ type: "rejected", order, orderId, reason });
        emit({ type: "orders_refresh" });
        return res;
      } finally {
        actionRef.current = null;
        setActionInFlight(null);
      }
    },
    [newOrder, closePopupAndDequeue, emit],
  );

  // "Viewed": close the popup without an API call (web handleRejectCancel / clearNewOrder).
  const dismissNewOrder = useCallback(() => {
    closePopupAndDequeue();
  }, [closePopupAndDequeue]);

  // ---- 180 s auto-reject (OrdersMain countdown === 0) ----
  useEffect(() => {
    if (!popupOrder || !acceptDeadline) return undefined;
    const ms = Math.max(0, acceptDeadline - Date.now());
    const timer = setTimeout(async () => {
      if (actionRef.current === "accept") return; // web: skip while isAcceptingOrder
      const order = popupOrderRef.current;
      const orderId = resolveOrderActionId(order);
      if (orderId) {
        try {
          await rejectOrder(orderId, AUTO_REJECT_REASON);
          emit({ type: "auto_rejected", order, orderId });
          emit({ type: "orders_refresh" });
        } catch {
          // Web only hid the popup here; we also pop the queue so later orders are not stuck.
        }
      }
      closePopupAndDequeue();
    }, ms);
    return () => clearTimeout(timer);
  }, [popupOrder, acceptDeadline, closePopupAndDequeue, emit]);

  // ---- order_status_update (cancel / admin assignment / handled elsewhere) ----
  const handleStatusUpdate = useCallback(
    (data = {}) => {
      const raw = String(data.orderStatus || data.status || "").toLowerCase().trim().replace(/\s+/g, "_");
      if (isCancelledStatus(raw)) {
        markIds(cancelledIdsRef.current, data);
        removeOrderFromQueue(data);
      }
      const popup = popupOrderRef.current;
      const matchesPopup = popup && sameOrder(popup, data);
      if (isCancelledStatus(raw)) {
        if (matchesPopup) closePopupAndDequeue();
        emit({ type: "cancelled", order: data, byUser: raw === "cancelled_by_user" });
      } else if ((raw === "confirmed" || raw === "preparing") && data.updatedBy === "ADMIN") {
        if (matchesPopup) closePopupAndDequeue();
        else removeOrderFromQueue(data);
        emit({ type: "admin_assigned", order: data });
      } else if (raw && raw !== "created" && raw !== "pending") {
        // Handled elsewhere (another device, admin panel): RN addition so a phone does not keep
        // ringing for an order that is no longer waiting for this restaurant.
        if (matchesPopup && !actionRef.current) closePopupAndDequeue();
        else if (!matchesPopup) removeOrderFromQueue(data);
      }
      emit({ type: "status_update", order: data });
    },
    [removeOrderFromQueue, closePopupAndDequeue, emit],
  );

  // ---- REST reconciliation (the web's 8 s poll, here fallback-only) ----
  const reconcile = useCallback(
    async (limit = 30) => {
      let rows = [];
      try {
        const res = await getOrders({ page: 1, limit }, { force: true });
        rows = res?.data?.orders || [];
      } catch {
        return; // non-blocking, like the web
      }
      const waiting = rows
        .filter((o) => {
          if (String(o?.status || "").toLowerCase() !== "confirmed") return false;
          if (hasAnyId(cancelledIdsRef.current, o) || hasAnyId(acknowledgedIdsRef.current, o)) return false;
          return !scheduledBeyond(o, POLL_SCHEDULE_WINDOW_MS);
        })
        .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0))
        .slice(0, 5)
        .map(fromRow);
      waiting.forEach((o) => {
        handleIncomingOrderAlert(o, "poll");
        enqueueOrder(o);
      });

      // Missed cancellations for the order being alerted.
      const active = activeOrderRef.current || popupOrderRef.current;
      if (active) {
        const match = rows.find((o) => sameOrder(o, active));
        if (match && isCancelledStatus(match.orderStatus || match.status)) handleStatusUpdate(match);
      }

      // Missed pickup_otp_reveal: requested within 15 min, not verified, not already shown.
      const otpRows = rows
        .filter((o) => {
          const p = o?.deliveryVerification?.pickupOtp;
          if (!p?.requestedAt || p?.verified || !o?.pickupOtp) return false;
          if (Date.now() - new Date(p.requestedAt).getTime() > PICKUP_OTP_MAX_AGE_MS) return false;
          return pickupRef.current?.orderMongoId !== String(o._id);
        })
        .sort((a, b) => new Date(b.deliveryVerification.pickupOtp.requestedAt) - new Date(a.deliveryVerification.pickupOtp.requestedAt));
      if (otpRows.length) {
        const o = otpRows[0];
        setPickupOtpReveal({
          orderMongoId: String(o._id),
          orderId: o.orderId || o.order_id || String(o._id),
          otp: o.pickupOtp,
          message: PICKUP_OTP_MESSAGE,
        });
      }
    },
    [enqueueOrder, handleIncomingOrderAlert, handleStatusUpdate, setPickupOtpReveal],
  );

  // ---- foreground new-order push -> same path as a socket event (deduped) ----
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return setNewOrderPushHandler(async (data) => {
      const id = data?.orderMongoId || data?.orderId;
      if (!id || cancelledIdsRef.current.has(String(id))) return;
      let order = { orderMongoId: String(id), orderId: String(id) };
      try {
        const res = await getOrderById(id);
        if (res?.data?.order) order = fromRow({ ...res.data.order, status: normalizeOrderStatus(res.data.order.orderStatus || res.data.order.status) });
      } catch {
        // ring with the bare ids; the popup can load details itself
      }
      if (isCancelledStatus(order.orderStatus || order.status)) return;
      handleIncomingOrderAlert(order, "push");
      enqueueOrder(order);
    });
  }, [isAuthenticated, enqueueOrder, handleIncomingOrderAlert]);

  // ---- socket lifecycle ----
  useEffect(() => {
    if (!isAuthenticated || !restaurantId) return undefined;
    prepareRing();
    const offEvents = subscribeRestaurantEvents({
      new_order: (orderData) => {
        const order = normalizeIncoming(orderData);
        if (scheduledBeyond(order, SOCKET_SCHEDULE_WINDOW_MS)) return;
        // A socket new_order for an order already seen is a backend "resend": show it again.
        if (!(popupOrderRef.current && sameOrder(popupOrderRef.current, order))) {
          orderKeys(order).forEach((k) => {
            shownIdsRef.current.delete(k);
            acknowledgedIdsRef.current.delete(k);
          });
        }
        enqueueOrder(order);
        handleIncomingOrderAlert(order, "socket");
      },
      order_status_update: handleStatusUpdate,
      pickup_otp_reveal: (data) => {
        setPickupOtpReveal(data || null);
        emit({ type: "pickup_otp_reveal", data });
      },
      admin_notification: (payload) => emit({ type: "admin_notification", payload }),
    });
    const offConn = subscribeSocketConnection((next) => {
      const was = connectedRef.current;
      connectedRef.current = next;
      setIsConnected(next);
      if (next && !was) reconcile(); // catch up on anything missed while disconnected
    });
    connectRestaurantSocket(restaurantId);
    return () => {
      offEvents();
      offConn();
      disconnectRestaurantSocket();
    };
  }, [isAuthenticated, restaurantId, enqueueOrder, handleIncomingOrderAlert, handleStatusUpdate, setPickupOtpReveal, reconcile, emit]);

  // ---- fallback poll while the socket is down; foreground reconciliation ----
  useEffect(() => {
    if (!isAuthenticated || !restaurantId) return undefined;
    let timer = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      timer = setInterval(() => {
        if (!connectedRef.current) reconcile();
      }, FALLBACK_POLL_MS);
    };
    reconcile();
    if (AppState.currentState === "active" || AppState.currentState == null) start();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        ensureSocketConnected();
        reconcile(10);
        start();
      } else {
        stop();
      }
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [isAuthenticated, restaurantId, reconcile]);

  // ---- reset everything on logout (AuthContext listener) ----
  useEffect(
    () =>
      onLogout(() => {
        stopAlert();
        releaseRing();
        setOrderQueue([]);
        setPopupOrder(null);
        popupOrderRef.current = null;
        setAcceptDeadline(null);
        setPickupOtpRevealState(null);
        pickupRef.current = null;
        setIsConnected(false);
        lastAlertAtRef.current.clear();
        cancelledIdsRef.current.clear();
        shownIdsRef.current.clear();
        acknowledgedIdsRef.current.clear();
      }),
    [onLogout, stopAlert],
  );

  // ---- restore the persisted pickup OTP after login / app start ----
  useEffect(() => {
    if (!isAuthenticated) return;
    store.get(KEYS.pickupOtpReveal).then((saved) => {
      if (saved && !pickupRef.current) {
        pickupRef.current = saved;
        setPickupOtpRevealState(saved);
      }
    });
  }, [isAuthenticated]);

  const setMuted = useCallback((next) => {
    const value = typeof next === "function" ? next(mutedRef.current) : Boolean(next);
    mutedRef.current = value;
    setMutedState(value);
    if (value) stopRing();
    else if (activeOrderRef.current) startRing(primaryKey(activeOrderRef.current) || null);
  }, []);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const clearPickupOtpReveal = useCallback(() => setPickupOtpReveal(null), [setPickupOtpReveal]);

  // web clearNewOrder: stop the ring and pop the queue head (no popup state involved).
  const clearNewOrder = useCallback(() => {
    stopAlert();
    setOrderQueue((prev) => prev.slice(1));
  }, [stopAlert]);

  const value = useMemo(
    () => ({
      newOrder,
      orderQueue,
      isConnected,
      isRinging,
      muted,
      setMuted,
      stopAlert,
      clearNewOrder,
      // popup
      popupOrder,
      showNewOrderPopup: Boolean(popupOrder),
      acceptDeadline,
      actionInFlight,
      acceptNewOrder,
      rejectNewOrder,
      dismissNewOrder,
      // pickup OTP
      pickupOtpReveal,
      clearPickupOtpReveal,
      // misc
      refreshNow: reconcile,
      subscribe,
    }),
    [
      newOrder,
      orderQueue,
      isConnected,
      isRinging,
      muted,
      setMuted,
      stopAlert,
      clearNewOrder,
      popupOrder,
      acceptDeadline,
      actionInFlight,
      acceptNewOrder,
      rejectNewOrder,
      dismissNewOrder,
      pickupOtpReveal,
      clearPickupOtpReveal,
      reconcile,
      subscribe,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useRestaurantNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useRestaurantNotifications must be used inside RestaurantNotificationsProvider");
  return ctx;
}

// Seconds left in the 180 s accept window; ticks once a second only in the component using it
// (so the whole tree does not re-render every second). 0 when no popup is open.
export function useAcceptCountdown() {
  const { acceptDeadline } = useRestaurantNotifications();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!acceptDeadline) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [acceptDeadline]);
  if (!acceptDeadline) return 0;
  // `now` may predate a fresh deadline by < 1 s; clamp to the window.
  return Math.min(ACCEPT_WINDOW_SECONDS, Math.max(0, Math.ceil((acceptDeadline - now) / 1000)));
}

// Listen to provider events while mounted: {type: "status_update" | "cancelled" | "admin_assigned" |
// "accepted" | "rejected" | "auto_rejected" | "scheduled_order" | "orders_refresh" |
// "pickup_otp_reveal" | "admin_notification", ...}.
export function useRestaurantEvents(handler) {
  const { subscribe } = useRestaurantNotifications();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => subscribe((e) => ref.current?.(e)), [subscribe]);
}
