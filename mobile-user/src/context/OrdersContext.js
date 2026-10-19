// Device-local list of placed orders, ported from Frontend/src/modules/Food/context/OrdersContext.jsx.
// OrderTracking seeds from it, OrderInvoice/OrderHelp read it. Real data comes from api/orders.
// The web filled it through the "order-placed" window event; here the Cart screen calls upsertOrder(order).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { KEYS, store } from "../storage";
import { useAuth } from "./AuthContext";

const normalizeId = (value) => (value == null ? "" : String(value).trim());

function orderLookupIds(order) {
  if (!order) return [];
  return [order._id, order.mongoId, order.orderMongoId, order.orderId, order.id].map(normalizeId).filter(Boolean);
}

const OrdersContext = createContext(null);

export function OrdersProvider({ children }) {
  const { isAuthenticated, onLogout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    store.get(KEYS.orders, []).then((saved) => {
      if (!active) return;
      setOrders(Array.isArray(saved) ? saved : []);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated && (orders.length > 0 || isAuthenticated)) store.set(KEYS.orders, orders);
  }, [orders, hydrated, isAuthenticated]);

  useEffect(
    () =>
      onLogout(() => {
        setOrders([]);
        store.remove(KEYS.orders);
      }),
    [onLogout],
  );

  // Merge an API order into the list, matching on any of its ids.
  const upsertOrder = useCallback((apiOrder) => {
    if (!apiOrder || typeof apiOrder !== "object") return;
    const incomingIds = orderLookupIds(apiOrder);
    if (incomingIds.length === 0) return;
    setOrders((prev) => {
      const idx = prev.findIndex((existing) => {
        const existingIds = orderLookupIds(existing);
        return incomingIds.some((id) => existingIds.includes(id));
      });
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...apiOrder };
        return next;
      }
      return [apiOrder, ...prev];
    });
  }, []);

  const getOrderById = useCallback(
    (orderId) => {
      const needle = normalizeId(orderId);
      if (!needle) return null;
      return orders.find((order) => orderLookupIds(order).includes(needle)) || null;
    },
    [orders],
  );

  const getAllOrders = useCallback(
    () => [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [orders],
  );

  const value = useMemo(
    () => ({ orders, upsertOrder, getOrderById, getAllOrders }),
    [orders, upsertOrder, getOrderById, getAllOrders],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider");
  return ctx;
}
