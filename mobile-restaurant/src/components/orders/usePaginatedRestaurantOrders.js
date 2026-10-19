// Port of hooks/usePaginatedRestaurantOrders.js: one page (30) of GET /food/restaurant/orders for
// a status tab, reset to page 1 when the status or refreshToken changes, with an optional silent
// poll. The web skipped the poll while the tab was hidden (document.hidden); here it is skipped
// while the screen is unfocused or the app is in the background.
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { getOrders } from "../../api";

export const RESTAURANT_ORDERS_PAGE_SIZE = 30;

const emptyMeta = (page) => ({ total: 0, page, limit: RESTAURANT_ORDERS_PAGE_SIZE, totalPages: 1 });

export default function usePaginatedRestaurantOrders({
  status = "all",
  refreshToken = 0,
  enablePoll = false,
  pollMs = 15000,
}) {
  const isFocused = useIsFocused();
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState(() => emptyMeta(1));
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(
    async (pageNum, { silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const res = await getOrders({ page: pageNum, limit: RESTAURANT_ORDERS_PAGE_SIZE, status }, { force: true });
        if (res?.success) {
          const rows = res.data?.orders || [];
          const m = res.data?.meta || {};
          setOrders(rows);
          setMeta({
            total: Number(m.total ?? rows.length),
            page: Number(m.page ?? pageNum),
            limit: Number(m.limit ?? RESTAURANT_ORDERS_PAGE_SIZE),
            totalPages: Number(m.totalPages ?? 1),
          });
        } else {
          setOrders([]);
          setMeta(emptyMeta(pageNum));
        }
      } catch {
        setOrders([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    setPage(1);
  }, [status, refreshToken]);

  useEffect(() => {
    fetchOrders(page);
  }, [page, refreshToken, fetchOrders]);

  useEffect(() => {
    if (!enablePoll || !isFocused) return undefined;
    const id = setInterval(() => {
      if (AppState.currentState !== "active") return;
      fetchOrders(page, { silent: true });
    }, pollMs);
    return () => clearInterval(id);
  }, [enablePoll, pollMs, page, fetchOrders, isFocused]);

  const goToPage = (nextPage) => {
    setPage(() => {
      const max = meta.totalPages || 1;
      return Math.max(1, Math.min(nextPage, max));
    });
  };

  return {
    orders,
    meta,
    page,
    loading,
    setPage: goToPage,
    refetch: () => fetchOrders(page),
  };
}
