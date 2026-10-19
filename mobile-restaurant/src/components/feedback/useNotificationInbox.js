// Port of hooks/useNotificationInbox.js for the restaurant module. The web's
// foodNotificationInboxRefresh window event is replaced by pushing the unread count to the shell
// store (setInboxUnreadCount), which drives the navbar bell and the Feedback dot.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dismiss as dismissApi, dismissAll as dismissAllApi, getInbox, markAsRead as markAsReadApi } from "../../api";
import { setInboxUnreadCount } from "../shell/stores";

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

export default function useNotificationInbox({ limit = 50, pollMs = 0 } = {}) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const unreadRef = useRef(0);

  const applyUnread = useCallback((next) => {
    const value = Math.max(0, typeof next === "function" ? next(unreadRef.current) : next);
    unreadRef.current = value;
    setUnreadCount(value);
    setInboxUnreadCount(value);
  }, []);

  const fetchInbox = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getInbox({ page: 1, limit });
      const payload = response?.data || {};
      setItems(normalizeInboxItems(payload?.items));
      applyUnread(Number(payload?.unreadCount || 0));
    } catch {
      setItems([]);
      applyUnread(0);
    } finally {
      setLoading(false);
    }
  }, [limit, applyUnread]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  useEffect(() => {
    const ms = Number(pollMs || 0);
    if (!ms || ms < 1000) return undefined;
    const timer = setInterval(fetchInbox, ms);
    return () => clearInterval(timer);
  }, [fetchInbox, pollMs]);

  const markAsRead = useCallback(
    async (id) => {
      if (!id) return;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
      applyUnread((prev) => prev - 1);
      try {
        await markAsReadApi(id);
      } catch {
        fetchInbox();
      }
    },
    [fetchInbox, applyUnread],
  );

  const dismiss = useCallback(
    async (id) => {
      if (!id) return;
      const removed = items.find((item) => item.id === id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (removed && !removed.read) applyUnread((prev) => prev - 1);
      try {
        await dismissApi(id);
      } catch {
        fetchInbox();
      }
    },
    [fetchInbox, items, applyUnread],
  );

  const dismissAll = useCallback(async () => {
    setItems([]);
    applyUnread(0);
    try {
      await dismissAllApi();
    } catch {
      fetchInbox();
    }
  }, [fetchInbox, applyUnread]);

  return useMemo(
    () => ({ items, unreadCount, loading, refresh: fetchInbox, markAsRead, dismiss, dismissAll }),
    [dismiss, dismissAll, fetchInbox, items, loading, markAsRead, unreadCount],
  );
}
