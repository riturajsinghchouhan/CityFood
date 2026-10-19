// Small app-wide stores that replace the web navbar's window events and localStorage reads:
//   business settings  (utils/businessSettings.js, "businessSettingsUpdated")
//   online status      (localStorage.restaurant_online_status, "restaurantStatusChanged")
//   navbar search      ("restaurantSearchUpdated")
//   inbox unread count (useNotificationInbox in the navbar and bottom nav)
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { getBusinessSettings } from "../../api/content";
import { getInbox } from "../../api/notifications";
import { KEYS, store } from "../../storage";

function createStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      value = typeof next === "function" ? next(value) : next;
      listeners.forEach((fn) => fn(value));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

function useStore(s) {
  return useSyncExternalStore(s.subscribe, s.get);
}

// ---- business settings (companyName, restaurant logo) ----
const businessStore = createStore(null);
let businessLoad = null;

function loadBusinessSettings() {
  if (businessLoad) return businessLoad;
  businessLoad = (async () => {
    const cached = await store.get(KEYS.businessSettings);
    if (cached && !businessStore.get()) businessStore.set(cached);
    try {
      const res = await getBusinessSettings();
      if (res?.data) {
        businessStore.set(res.data);
        store.set(KEYS.businessSettings, res.data);
      }
    } catch {
      businessLoad = null; // retry on the next mount
    }
  })();
  return businessLoad;
}

/** {companyName, logoUrl, settings}: logoUrl is restaurantLogo.url || logo.url (useAppLogo). */
export function useBusinessSettings() {
  const settings = useStore(businessStore);
  useEffect(() => {
    loadBusinessSettings();
  }, []);
  return {
    settings,
    companyName: settings?.companyName || "",
    logoUrl: settings?.restaurantLogo?.url || settings?.logo?.url || null,
  };
}

// ---- online status pill ----
// undefined = not read yet, null = nothing stored (navbar falls back to isAcceptingOrders).
const onlineStore = createStore(undefined);

/** Stored online flag (true/false) or null when none is stored. */
export function useStoredOnlineStatus() {
  const value = useStore(onlineStore);
  useEffect(() => {
    if (onlineStore.get() !== undefined) return;
    store.get(KEYS.onlineStatus).then((saved) => {
      if (onlineStore.get() === undefined) onlineStore.set(typeof saved === "boolean" ? saved : null);
    });
  }, []);
  return value === undefined ? null : value;
}

/**
 * Web: localStorage.setItem("restaurant_online_status", JSON.stringify(isOnline)) followed by
 * dispatchEvent("restaurantStatusChanged", {isOnline}). Updates the navbar pill.
 */
export function setRestaurantOnlineStatus(isOnline) {
  const v = Boolean(isOnline);
  onlineStore.set(v);
  store.set(KEYS.onlineStatus, v);
}

// ---- navbar search ----
const EMPTY_SEARCH = { query: "", results: [], isLoading: false, error: null };
const searchStore = createStore(EMPTY_SEARCH);

/** {query, results, isLoading, error}: the web's restaurantSearchUpdated detail. */
export function useRestaurantSearch() {
  return useStore(searchStore);
}

export function setRestaurantSearch(next) {
  searchStore.set({ ...EMPTY_SEARCH, ...next });
}

// ---- notification inbox unread count ----
const inboxStore = createStore(0);

/** GET /food/notifications/inbox (limit 20) and update the unread dot. */
export async function refreshInboxUnread() {
  try {
    const res = await getInbox({ page: 1, limit: 20 });
    inboxStore.set(Number(res?.data?.unreadCount || 0));
  } catch {
    inboxStore.set(0);
  }
}

/** Set the count directly after a local change (mark as read, dismiss, dismiss all). */
export function setInboxUnreadCount(count) {
  inboxStore.set(Math.max(0, Number(count) || 0));
}

export function useInboxUnreadCount() {
  return useStore(inboxStore);
}

// The bottom nav polled every 60 s and the navbar every 5 min; one 60 s poll serves both here,
// paused while the app is in the background.
export function useInboxUnreadPolling(enabled, pollMs = 60000) {
  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    const start = () => {
      if (timer) clearInterval(timer);
      refreshInboxUnread();
      timer = setInterval(refreshInboxUnread, pollMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === "active" || AppState.currentState == null) start();
    const sub = AppState.addEventListener("change", (next) => (next === "active" ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [enabled, pollMs]);
}

// Logout clears the stored key (RESTAURANT_SESSION_CACHE_KEYS); forget the in-memory copy too.
export function resetShellStores() {
  onlineStore.set(undefined);
  searchStore.set(EMPTY_SEARCH);
  inboxStore.set(0);
}
