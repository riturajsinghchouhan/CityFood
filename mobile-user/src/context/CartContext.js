// Local, single-restaurant cart, ported from Frontend/src/modules/Food/context/CartContext.jsx.
// Line items keep the web shape exactly (id = "<itemId>::<variantId|base>", price, quantity,
// restaurant (name), restaurantId, variantId, variantName, variantPrice, image, ...),
// so the Cart screen's pricing math and /orders/calculate payloads match the web.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useLatest from "../hooks/useLatest";
import { KEYS, store } from "../storage";
import { useAuth } from "./AuthContext";

export const buildCartLineId = (itemId, variantId = "") =>
  `${String(itemId || "")}::${String(variantId || "base")}`;

export function normalizeCartData(rawCart) {
  if (!Array.isArray(rawCart)) return [];
  return rawCart
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const parsedQuantity = Number(item.quantity);
      const parsedPrice = Number(item.price);
      const restaurantName =
        typeof item.restaurant === "string"
          ? item.restaurant
          : typeof item.restaurant?.name === "string"
            ? item.restaurant.name
            : "";
      const restaurantId =
        item.restaurantId || item.restaurant_id || item.restaurant?._id || item.restaurant?.restaurantId || null;
      const image = item.image || item.imageUrl || item.product?.imageUrl || item.product?.image || "";
      const baseItemId =
        item.itemId ||
        item.productId ||
        item.foodId ||
        item.baseItemId ||
        item.menuItemId ||
        item.id ||
        item._id ||
        `cart-item-${index}`;
      const variantId = item.variantId || item.variant?._id || item.variant?.id || "";
      const variantName =
        typeof item.variantName === "string"
          ? item.variantName
          : typeof item.variant?.name === "string"
            ? item.variant.name
            : "";
      const parsedVariantPrice = Number(item.variantPrice ?? item.variant?.price ?? item.price);
      const lineItemId = item.lineItemId || item.cartLineId || buildCartLineId(baseItemId, variantId);

      return {
        ...item,
        id: lineItemId,
        lineItemId,
        itemId: String(baseItemId),
        productId: String(baseItemId),
        variantId: variantId ? String(variantId) : "",
        variantName,
        variantPrice: Number.isFinite(parsedVariantPrice) ? parsedVariantPrice : 0,
        name: item.name || item.product?.name || "Item",
        quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.floor(parsedQuantity) : 1,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        restaurant: restaurantName,
        restaurantId,
        image,
        imageUrl: image,
      };
    });
}

function resolveCartEntryId(items, itemId, variantId = "") {
  const normalizedItemId = String(itemId || "");
  const safeItems = Array.isArray(items) ? items : [];
  const directMatch = safeItems.find((item) => item.id === normalizedItemId);
  if (directMatch) return directMatch.id;
  const preferredId = buildCartLineId(normalizedItemId, variantId);
  const exactMatch = safeItems.find((item) => item.id === preferredId);
  if (exactMatch) return exactMatch.id;
  if (!variantId) {
    const legacyBaseMatch = safeItems.find(
      (item) =>
        String(item.itemId || item.productId || item.id || "") === normalizedItemId &&
        !String(item.variantId || "").trim(),
    );
    if (legacyBaseMatch) return legacyBaseMatch.id;
  }
  return preferredId;
}

const normalizeName = (name) => (name ? String(name).trim().toLowerCase() : "");

// Web rule: compare restaurant names first (ids come in several formats), ids only when both names are missing.
function restaurantConflict(cart, item) {
  if (cart.length === 0) return null;
  const first = cart[0];
  const firstName = normalizeName(first?.restaurant);
  const newName = normalizeName(item?.restaurant);
  const nameMismatch = firstName && newName && firstName !== newName;
  const idMismatch =
    !firstName &&
    !newName &&
    first?.restaurantId &&
    item?.restaurantId &&
    String(first.restaurantId) !== String(item.restaurantId);
  if (!nameMismatch && !idMismatch) return null;
  return {
    ok: false,
    error: `Cart already contains items from "${first?.restaurant || "another restaurant"}". Please clear cart or complete order first.`,
    code: "RESTAURANT_MISMATCH",
    cartRestaurant: { id: first?.restaurantId || null, name: first?.restaurant || "" },
  };
}

function keepOnlyRestaurant(items, restaurantId, restaurantName) {
  const target = normalizeName(restaurantName);
  return items.filter((item) => {
    const itemName = normalizeName(item?.restaurant);
    if (target && itemName) return itemName === target;
    if (restaurantId && item?.restaurantId) return String(item.restaurantId) === String(restaurantId);
    return false;
  });
}

const ANIMATION_CLEAR_MS = 1500;

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated, onLogout } = useAuth();
  const [cart, setCart] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [lastAddEvent, setLastAddEvent] = useState(null);
  const [lastRemoveEvent, setLastRemoveEvent] = useState(null);
  const cartRef = useLatest(cart);
  const timers = useRef(new Set());

  const later = useCallback((fn) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ANIMATION_CLEAR_MS);
    timers.current.add(t);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // Load the saved cart, then apply the web's one-time cleanup of mixed-restaurant carts.
  useEffect(() => {
    let active = true;
    store.get(KEYS.cart, []).then((saved) => {
      if (!active) return;
      let items = normalizeCartData(saved);
      const ids = [...new Set(items.map((i) => i.restaurantId).filter(Boolean))];
      const names = [...new Set(items.map((i) => i.restaurant).filter(Boolean))];
      if (ids.length > 1 || new Set(names.map(normalizeName)).size > 1) {
        items = keepOnlyRestaurant(items, ids[0], names[0]);
      }
      setCart(items);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Web: persist when non-empty or logged in.
  useEffect(() => {
    if (!hydrated) return;
    if (cart.length > 0 || isAuthenticated) store.set(KEYS.cart, normalizeCartData(cart));
    else store.remove(KEYS.cart);
  }, [cart, hydrated, isAuthenticated]);

  useEffect(
    () =>
      onLogout(() => {
        setCart([]);
        store.remove(KEYS.cart);
      }),
    [onLogout],
  );

  const recordAdd = useCallback(
    (item, sourcePosition) => {
      if (!sourcePosition) return;
      setLastAddEvent({
        product: { id: item.id, name: item.name, imageUrl: item.image || item.imageUrl },
        sourcePosition,
      });
      later(() => setLastAddEvent(null));
    },
    [later],
  );

  const recordRemove = useCallback(
    (existing, sourcePosition, productInfo) => {
      if (!existing || !sourcePosition || !productInfo) return;
      setLastRemoveEvent({
        product: {
          id: productInfo.id || existing.id,
          name: productInfo.name || existing.name,
          imageUrl: productInfo.imageUrl || productInfo.image || existing.image || existing.imageUrl,
        },
        sourcePosition,
      });
      later(() => setLastRemoveEvent(null));
    },
    [later],
  );

  // item must carry the web line shape (id = buildCartLineId(itemId, variantId), restaurant, restaurantId, price, ...).
  // Returns {ok: true} or {ok: false, code: "RESTAURANT_MISMATCH" | "MISSING_RESTAURANT", error}.
  const addToCart = useCallback(
    (item, sourcePosition = null) => {
      const current = normalizeCartData(cartRef.current);
      const conflict = restaurantConflict(current, item);
      if (conflict) return conflict;
      if (!item?.restaurantId && !item?.restaurant) {
        return {
          ok: false,
          error: "Item is missing restaurant information. Please refresh the page.",
          code: "MISSING_RESTAURANT",
        };
      }
      const existing = current.find((i) => i.id === item.id);
      const next = existing
        ? current.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...current, { ...item, quantity: 1 }];
      cartRef.current = next;
      setCart(next);
      recordAdd(item, sourcePosition);
      return { ok: true };
    },
    [recordAdd],
  );

  // Web conflict path: the user chose to start a new cart with this item.
  const clearCartAndAdd = useCallback(
    (item, sourcePosition = null) => {
      cartRef.current = [];
      setCart([]);
      return addToCart(item, sourcePosition);
    },
    [addToCart],
  );

  const removeFromCart = useCallback(
    (itemId, sourcePosition = null, productInfo = null) => {
      const current = normalizeCartData(cartRef.current);
      const resolved = resolveCartEntryId(current, itemId);
      recordRemove(current.find((i) => i.id === resolved), sourcePosition, productInfo);
      const next = current.filter((i) => i.id !== resolved);
      cartRef.current = next;
      setCart(next);
    },
    [recordRemove],
  );

  const updateQuantity = useCallback(
    (itemId, quantity, sourcePosition = null, productInfo = null) => {
      const current = normalizeCartData(cartRef.current);
      const resolved = resolveCartEntryId(current, itemId);
      const existing = current.find((i) => i.id === resolved);
      let next;
      if (quantity <= 0) {
        recordRemove(existing, sourcePosition, productInfo);
        next = current.filter((i) => i.id !== resolved);
      } else {
        if (existing && quantity < existing.quantity) recordRemove(existing, sourcePosition, productInfo);
        next = current.map((i) => (i.id === resolved ? { ...i, quantity } : i));
      }
      cartRef.current = next;
      setCart(next);
    },
    [recordRemove],
  );

  const clearCart = useCallback(() => {
    cartRef.current = [];
    setCart([]);
  }, []);

  // Reorder: replaces the whole cart. Returns {ok: true, count}.
  const replaceCart = useCallback((items) => {
    const next = normalizeCartData(items).filter((item) => {
      const quantity = Number(item?.quantity);
      return item?.id && (item?.restaurantId || item?.restaurant) && Number.isFinite(quantity) && quantity > 0;
    });
    cartRef.current = next;
    setCart(next);
    return { ok: true, count: next.length };
  }, []);

  const cleanCartForRestaurant = useCallback((restaurantId, restaurantName) => {
    const current = normalizeCartData(cartRef.current);
    if (current.length === 0) return;
    const next = keepOnlyRestaurant(current, restaurantId, restaurantName);
    cartRef.current = next;
    setCart(next);
  }, []);

  const value = useMemo(() => {
    const safeCart = normalizeCartData(cart);
    const itemCount = safeCart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const total = safeCart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    return {
      ready: hydrated,
      cart,
      items: safeCart.map((item) => ({
        product: { id: item.id, name: item.name, imageUrl: item.image || item.imageUrl },
        quantity: item.quantity || 1,
      })),
      itemCount,
      total,
      restaurantId: safeCart[0]?.restaurantId || null,
      restaurantName: safeCart[0]?.restaurant || "",
      lastAddEvent,
      lastRemoveEvent,
      addToCart,
      clearCartAndAdd,
      removeFromCart,
      updateQuantity,
      getCartCount: () => itemCount,
      isInCart: (itemId, variantId = "") => {
        const resolved = resolveCartEntryId(safeCart, itemId, variantId);
        return safeCart.some((i) => i.id === resolved);
      },
      getCartItem: (itemId, variantId = "") => {
        const resolved = resolveCartEntryId(safeCart, itemId, variantId);
        return safeCart.find((i) => i.id === resolved) || null;
      },
      clearCart,
      replaceCart,
      cleanCartForRestaurant,
    };
  }, [
    cart,
    hydrated,
    lastAddEvent,
    lastRemoveEvent,
    addToCart,
    clearCartAndAdd,
    removeFromCart,
    updateQuantity,
    clearCart,
    replaceCart,
    cleanCartForRestaurant,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
