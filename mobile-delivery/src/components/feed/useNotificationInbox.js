// Port of Food/hooks/useNotificationInbox.js for the rider ("delivery" context): fetch once, refresh
// on the provider's inbox_refresh event (web REFRESH_EVENT), optimistic read / dismiss-all.
import { useCallback, useEffect, useMemo, useState } from "react";
import { dismissAll as apiDismissAll, getInbox, markAsRead as apiMarkAsRead } from "../../api/notifications";
import { useDelivery } from "../../context/DeliveryContext";

const normalizeInboxItems = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((item, index) => ({
    id: String(item?._id || item?.id || `broadcast-${index}`),
    title: String(item?.title || "Notification").trim(),
    message: String(item?.message || "").trim(),
    link: String(item?.link || "").trim(),
    read: Boolean(item?.isRead),
    createdAt: item?.createdAt || item?.updatedAt || null,
    category: String(item?.category || "broadcast"),
  }));

export default function useNotificationInbox({ limit = 50 } = {}) {
  const { subscribe } = useDelivery();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchInbox = useCallback(
    () =>
      getInbox({ page: 1, limit }).then(
        (res) => {
          setItems(normalizeInboxItems(res?.data?.items));
          setUnreadCount(Number(res?.data?.unreadCount || 0));
        },
        () => {
          setItems([]);
          setUnreadCount(0);
        },
      ),
    [limit],
  );

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

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
    () => ({ items, unreadCount, refresh: fetchInbox, markAsRead, dismissAll }),
    [dismissAll, fetchInbox, items, markAsRead, unreadCount],
  );
}
