// The ONE restaurant Socket.IO connection (the web opened a second one from GlobalPickupOtpModal;
// here everything goes through RestaurantNotificationsContext). Ported from the socket part of
// useRestaurantNotifications.js. The server auto-joins `restaurant:<id>` from the JWT; the client
// also emits `join-restaurant <id>` on every connect and once more after 2 s, as the web does.
import { io } from "socket.io-client";
import { getAccessToken } from "../api/client";
import { SOCKET_URL } from "../config";

// Server -> client events the backend actually emits for restaurants (audit §3.1).
// new_dining_booking and play_notification_sound are never emitted and are not listened to.
export const RESTAURANT_SOCKET_EVENTS = [
  "new_order",
  "order_status_update",
  "pickup_otp_reveal",
  "admin_notification",
  "restaurant-room-joined",
];

let socket = null;
let currentRestaurantId = null;
let connected = false;
let rejoinTimer = null;
const eventListeners = new Map(RESTAURANT_SOCKET_EVENTS.map((e) => [e, new Set()]));
const connectionListeners = new Set();

function emitLocal(event, payload) {
  eventListeners.get(event)?.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      // A failing handler must not break the others.
    }
  });
}

function setConnected(next) {
  if (connected === next) return;
  connected = next;
  connectionListeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      // ignore listener errors
    }
  });
}

function joinRoom() {
  if (!socket?.connected || !currentRestaurantId) return;
  socket.emit("join-restaurant", currentRestaurantId);
  clearTimeout(rejoinTimer);
  rejoinTimer = setTimeout(() => {
    if (socket?.connected && currentRestaurantId) socket.emit("join-restaurant", currentRestaurantId);
  }, 2000);
}

/**
 * Open (or keep) the connection for this restaurant id. Safe to call repeatedly.
 * Options as the web: websocket first with polling fallback, infinite reconnection 1-5 s, 20 s timeout.
 * The token is read on every (re)connect, so a refreshed access token is used.
 */
export function connectRestaurantSocket(restaurantId) {
  const id = restaurantId ? String(restaurantId) : null;
  if (!id || !getAccessToken()) return false;
  if (socket && currentRestaurantId === id) {
    if (!socket.connected) socket.connect();
    return true;
  }
  disconnectRestaurantSocket();
  currentRestaurantId = id;
  socket = io(SOCKET_URL, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    auth: (cb) => cb({ token: getAccessToken() || "" }),
  });
  socket.on("connect", () => {
    setConnected(true);
    joinRoom();
  });
  socket.on("disconnect", (reason) => {
    setConnected(false);
    // The server dropped us (e.g. after an auth change): reconnect manually, like the web.
    if (reason === "io server disconnect") socket?.connect();
  });
  socket.on("connect_error", () => setConnected(false));
  RESTAURANT_SOCKET_EVENTS.forEach((event) => {
    socket.on(event, (payload) => emitLocal(event, payload));
  });
  return true;
}

export function disconnectRestaurantSocket() {
  clearTimeout(rejoinTimer);
  rejoinTimer = null;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentRestaurantId = null;
  setConnected(false);
}

// Nudge a reconnect (e.g. app back in the foreground). No-op when connected or not set up.
export function ensureSocketConnected() {
  if (socket && !socket.connected) socket.connect();
}

/**
 * handlers: {new_order, order_status_update, pickup_otp_reveal, admin_notification,
 * "restaurant-room-joined"}. Returns an unsubscribe. Listening does not open the connection.
 */
export function subscribeRestaurantEvents(handlers) {
  const added = [];
  Object.entries(handlers || {}).forEach(([event, fn]) => {
    const set = eventListeners.get(event);
    if (set && typeof fn === "function") {
      set.add(fn);
      added.push([set, fn]);
    }
  });
  return () => added.forEach(([set, fn]) => set.delete(fn));
}

export function isSocketConnected() {
  return connected;
}

// listener(isConnected) is called immediately and on every change. Returns an unsubscribe.
export function subscribeSocketConnection(listener) {
  connectionListeners.add(listener);
  listener(connected);
  return () => connectionListeners.delete(listener);
}
