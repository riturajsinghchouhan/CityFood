// Realtime order notifications + notification inbox. Merges the web's UserNotificationContext /
// hooks/useUserNotifications.js (socket events, toasts, window CustomEvents),
// hooks/useNotificationInbox.js ("user" inbox, no polling) and the local
// food_user_notifications list kept by HomeHeader / Notifications.
// Web toasts become `banner` (render it with the app's Toast); window events become addNotificationListener.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useLatest from "../hooks/useLatest";
import * as notificationsApi from "../api/notifications";
import { subscribeSocketConnection, subscribeToUserEvents } from "../lib/socket";
import { KEYS, store } from "../storage";
import { useAuth } from "./AuthContext";

const DROP_OTP_DEDUPE_MS = 15000;
const ORDER_STATUS_DEDUPE_MS = 4000;
const IMPORTANT_STATUSES = new Set([
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "ready",
  "reached_pickup",
  "picked_up",
  "reached_drop",
  "delivered",
  "dead",
]);

const normalizeInboxItems = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((item, index) => ({
    id: String(item?._id || item?.id || `broadcast-${index}`),
    source: "broadcast",
    title: String(item?.title || "Notification").trim(),
    message: String(item?.message || "").trim(),
    link: String(item?.link || "").trim(),
    read: Boolean(item?.isRead),
    createdAt: item?.createdAt || item?.updatedAt || new Date().toISOString(),
    category: String(item?.category || "broadcast"),
  }));

const UserNotificationContext = createContext(null);

export function UserNotificationProvider({ children }) {
  const { ready: authReady, isAuthenticated, onLogout } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [banner, setBanner] = useState(null);
  const [items, setItems] = useState([]);
  const itemsRef = useLatest(items);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [localNotifications, setLocalState] = useState([]);
  const listeners = useRef(new Map());
  const lastOrderBanner = useRef({ key: "", at: 0 });
  const lastOtpBanner = useRef({ key: "", at: 0 });
  const trackingVisible = useRef(false);
  const inboxLimit = useRef(20);
  const authRef = useLatest(isAuthenticated);

  const emit = useCallback((type, detail) => {
    listeners.current.get(type)?.forEach((fn) => {
      try {
        fn(detail);
      } catch {
        // ignore listener errors
      }
    });
  }, []);

  // type: "orderStatusNotification" | "deliveryDropOtp" (same detail shapes as the web CustomEvents).
  const addNotificationListener = useCallback((type, fn) => {
    if (!listeners.current.has(type)) listeners.current.set(type, new Set());
    listeners.current.get(type).add(fn);
    return () => listeners.current.get(type)?.delete(fn);
  }, []);

  const showBanner = useCallback((next) => {
    setBanner({ ...next, shownAt: Date.now() });
  }, []);
  const dismissBanner = useCallback(() => setBanner(null), []);

  // ---- inbox ----
  const refreshInbox = useCallback(async (limit) => {
    if (limit) inboxLimit.current = limit;
    if (!authRef.current) return;
    try {
      setInboxLoading(true);
      const res = await notificationsApi.getInbox({ page: 1, limit: inboxLimit.current });
      const payload = res?.data || {};
      setItems(normalizeInboxItems(payload.items));
      setUnreadCount(Number(payload.unreadCount || 0));
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  const markAsRead = useCallback(
    async (id) => {
      if (!id) return;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await notificationsApi.markAsRead(id);
      } catch {
        refreshInbox();
      }
    },
    [refreshInbox],
  );

  const dismiss = useCallback(
    async (id) => {
      if (!id) return;
      const removed = itemsRef.current.find((item) => item.id === id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (removed && !removed.read) setUnreadCount((count) => Math.max(0, count - 1));
      try {
        await notificationsApi.dismiss(id);
      } catch {
        refreshInbox();
      }
    },
    [refreshInbox],
  );

  const dismissAll = useCallback(async () => {
    setItems([]);
    setUnreadCount(0);
    try {
      await notificationsApi.dismissAll();
    } catch {
      refreshInbox();
    }
  }, [refreshInbox]);

  // ---- local list (food_user_notifications) ----
  useEffect(() => {
    store.get(KEYS.localNotifications, []).then((saved) => {
      if (Array.isArray(saved)) setLocalState(saved);
    });
  }, []);

  const setLocalNotifications = useCallback((updater) => {
    setLocalState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const list = Array.isArray(next) ? next : [];
      store.set(KEYS.localNotifications, list);
      return list;
    });
  }, []);

  const addLocalNotification = useCallback(
    (notification) => setLocalNotifications((prev) => [notification, ...prev]),
    [setLocalNotifications],
  );
  const removeLocalNotification = useCallback(
    (id) => setLocalNotifications((prev) => prev.filter((n) => n.id !== id)),
    [setLocalNotifications],
  );

  // ---- socket ----
  useEffect(() => {
    if (!authReady || !isAuthenticated) return undefined;
    refreshInbox();

    const onOrderStatus = (data = {}) => {
      const title = data.title || `Order #${data.orderId || "Update"}`;
      const message = data.message || `Your order status is now ${String(data.orderStatus || "").replace(/_/g, " ")}`;
      const isImportant = String(data.orderStatus).includes("cancel") || IMPORTANT_STATUSES.has(data.orderStatus);
      const key = `${String(data.orderId || "")}:${String(data.orderStatus || "")}`;
      const now = Date.now();
      const duplicate = key === lastOrderBanner.current.key && now - lastOrderBanner.current.at < ORDER_STATUS_DEDUPE_MS;
      if (isImportant && !trackingVisible.current && !duplicate) {
        lastOrderBanner.current = { key, at: now };
        showBanner({ kind: "order_status", title, message, duration: 6000, orderId: data.orderId, orderMongoId: data.orderMongoId });
      }
      emit("orderStatusNotification", {
        orderMongoId: data.orderMongoId,
        orderId: data.orderId,
        status: data.orderStatus,
        orderStatus: data.orderStatus,
        title,
        message,
        deliveryState: data.deliveryState,
        deliveryVerification: data.deliveryVerification,
        dispatch: data.dispatch,
        deliveryPartner: data.deliveryPartner,
        deliveryPartnerId: data.deliveryPartnerId,
        timestamp: new Date().toISOString(),
      });
    };

    const onOrderState = (activeOrder) => {
      if (!activeOrder) return;
      emit("orderStatusNotification", {
        orderMongoId: activeOrder.orderMongoId || activeOrder._id,
        orderId: activeOrder.orderId || activeOrder.order_id,
        status: activeOrder.orderStatus || activeOrder.status,
        orderStatus: activeOrder.orderStatus || activeOrder.status,
        deliveryState: activeOrder.deliveryState,
        deliveryVerification: activeOrder.deliveryVerification,
        dispatch: activeOrder.dispatch,
        resynced: true,
        timestamp: new Date().toISOString(),
      });
    };

    const onDropOtp = (payload) => {
      const otp = payload?.otp != null ? String(payload.otp) : "";
      const orderId = payload?.orderId != null ? String(payload.orderId) : "";
      const message = payload?.message != null ? String(payload.message) : "";
      const key = `${orderId}:${otp}`;
      const now = Date.now();
      if (key === lastOtpBanner.current.key && now - lastOtpBanner.current.at < DROP_OTP_DEDUPE_MS) return;
      lastOtpBanner.current = { key, at: now };
      emit("deliveryDropOtp", { orderMongoId: payload?.orderMongoId, orderId, otp, message });
      const parts = [message, otp ? `OTP: ${otp}` : ""].filter(Boolean);
      showBanner({
        kind: "drop_otp",
        title: orderId ? `Order ${orderId}` : "Delivery OTP",
        message: parts.join(" — ") || "Handover OTP from your delivery partner.",
        duration: 12000,
        orderId,
        otp,
      });
    };

    const onAdminNotification = (payload) => {
      showBanner({
        kind: "admin",
        title: payload?.title || "Notification",
        message: payload?.message || "New broadcast notification received.",
        duration: 8000,
      });
      refreshInbox();
    };

    const unsubscribeEvents = subscribeToUserEvents({
      order_status_update: onOrderStatus,
      order_state: onOrderState,
      delivery_drop_otp: onDropOtp,
      admin_notification: onAdminNotification,
    });
    const unsubscribeConnection = subscribeSocketConnection(setIsConnected);
    return () => {
      unsubscribeEvents();
      unsubscribeConnection();
      setIsConnected(false);
    };
  }, [authReady, isAuthenticated, emit, showBanner, refreshInbox]);

  useEffect(
    () =>
      onLogout(() => {
        setItems([]);
        setUnreadCount(0);
        setBanner(null);
        setLocalState([]);
        store.remove(KEYS.localNotifications);
      }),
    [onLogout],
  );

  // OrderTracking calls this while focused; the web skipped status toasts on that screen.
  const setOrderTrackingVisible = useCallback((visible) => {
    trackingVisible.current = Boolean(visible);
  }, []);

  const value = useMemo(() => {
    const localUnread = localNotifications.filter((n) => !n.read).length;
    return {
      isConnected,
      banner,
      dismissBanner,
      addNotificationListener,
      setOrderTrackingVisible,
      items,
      unreadCount,
      inboxLoading,
      refreshInbox,
      markAsRead,
      dismiss,
      dismissAll,
      localNotifications,
      setLocalNotifications,
      addLocalNotification,
      removeLocalNotification,
      totalUnreadCount: localUnread + unreadCount,
    };
  }, [
    isConnected,
    banner,
    dismissBanner,
    addNotificationListener,
    setOrderTrackingVisible,
    items,
    unreadCount,
    inboxLoading,
    refreshInbox,
    markAsRead,
    dismiss,
    dismissAll,
    localNotifications,
    setLocalNotifications,
    addLocalNotification,
    removeLocalNotification,
  ]);

  return <UserNotificationContext.Provider value={value}>{children}</UserNotificationContext.Provider>;
}

export function useUserNotifications() {
  const ctx = useContext(UserNotificationContext);
  if (!ctx) throw new Error("useUserNotifications must be used inside UserNotificationProvider");
  return ctx;
}

// Subscribe a screen to "orderStatusNotification" or "deliveryDropOtp" for its lifetime.
export function useNotificationEvent(type, handler) {
  const { addNotificationListener } = useUserNotifications();
  const ref = useLatest(handler);
  useEffect(() => addNotificationListener(type, (detail) => ref.current?.(detail)), [type, addNotificationListener]);
}
