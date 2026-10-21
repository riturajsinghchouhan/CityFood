// Food/hooks/useNotificationInbox("delivery", {limit}) with the parts NotificationsV2 needs that the
// feed's copy (components/feed/useNotificationInbox) leaves out: `loading` (true during every fetch,
// as on the web) and `dismiss(id)`. Refetches on the provider's inbox_refresh event.
import { useCallback, useEffect, useMemo, useState } from "react";
import { dismiss as apiDismiss, dismissAll as apiDismissAll, getInbox, markAsRead as apiMarkAsRead } from "../../api/notifications";
import { useDelivery } from "../../context/DeliveryContext";

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

export default function useNotificationInboxPage({ limit = 50 } = {}) {
  const { subscribe } = useDelivery();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    () =>
      getInbox({ page: 1, limit })
        .then(
          (res) => {
            setItems(normalizeInboxItems(res?.data?.items));
            setUnreadCount(Number(res?.data?.unreadCount || 0));
          },
          () => {
            setItems([]);
            setUnreadCount(0);
          },
        )
        .finally(() => setLoading(false)),
    [limit],
  );

  const fetchInbox = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  // first load: `loading` already starts true
  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () =>
      subscribe((event) => {
        if (event?.type === "inbox_refresh") fetchInbox();
      }),
    [fetchInbox, subscribe],
  );

  const markAsRead = useCallback(
    async (id) => {
      if (!id) return;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await apiMarkAsRead(id);
      } catch {
        fetchInbox();
      }
    },
    [fetchInbox],
  );

  const dismiss = useCallback(
    async (id) => {
      if (!id) return;
      const removed = items.find((item) => item.id === id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (removed && !removed.read) setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await apiDismiss(id);
      } catch {
        fetchInbox();
      }
    },
    [fetchInbox, items],
  );

  const dismissAll = useCallback(async () => {
    setItems([]);
    setUnreadCount(0);
    try {
      await apiDismissAll();
    } catch {
      fetchInbox();
    }
  }, [fetchInbox]);

  return useMemo(
    () => ({ items, unreadCount, loading, refresh: fetchInbox, markAsRead, dismiss, dismissAll }),
    [dismiss, dismissAll, fetchInbox, items, loading, markAsRead, unreadCount],
  );
}
