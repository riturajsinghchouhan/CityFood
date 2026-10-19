// One shared, ref-counted Socket.IO connection for order status and live tracking,
// ported from Frontend/src/modules/Food/utils/userSocketManager.js.
// The server auto-joins `user:<id>` from the token; tracking rooms are joined per order.
import { io } from "socket.io-client";
import { getAccessToken } from "../api/client";
import { SOCKET_URL } from "../config";

// Server -> client events the web listens to (useUserNotifications, userSocketManager).
export const SOCKET_EVENTS = [
  "order_status_update",
  "order_state",
  "delivery_drop_otp",
  "location-update",
  "admin_notification",
  "tracking-room-joined",
  "resync_complete",
];

let socket = null;
let refCount = 0;
let connected = false;
const roomCounts = new Map();
const eventListeners = new Map(SOCKET_EVENTS.map((e) => [e, new Set()]));
const connectionListeners = new Set();

function emitLocal(event, payload) {
  eventListeners.get(event)?.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      // A failing screen handler must not break the others.
    }
  });
}

function setConnected(next) {
  connected = next;
  connectionListeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      // ignore listener errors
    }
  });
}

function createSocket() {
  const sock = io(SOCKET_URL, {
    path: "/socket.io",
    transports: ["websocket"],
    reconnection: true,
    // Read on every (re)connect, so a refreshed access token is picked up.
    auth: (cb) => cb({ token: getAccessToken() || "" }),
  });

  sock.on("connect", () => {
    setConnected(true);
    roomCounts.forEach((_, id) => sock.emit("join-tracking", id));
    sock.emit("resync");
  });
  sock.on("disconnect", () => setConnected(false));
  sock.on("connect_error", () => setConnected(false));
  SOCKET_EVENTS.forEach((event) => {
    sock.on(event, (payload) => emitLocal(event, payload));
  });
  return sock;
}

function acquire() {
  if (!getAccessToken()) return false;
  refCount += 1;
  if (!socket) socket = createSocket();
  return true;
}

function release() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  roomCounts.clear();
  setConnected(false);
}

function addListeners(handlers) {
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

function normalizeIds(orderIds) {
  const list = Array.isArray(orderIds) ? orderIds : [orderIds];
  return [...new Set(list.map((id) => String(id || "").trim()).filter(Boolean))];
}

/**
 * Listen to app-wide user events while logged in.
 * handlers: {order_status_update, order_state, delivery_drop_otp, admin_notification, ...} keyed by event name.
 * Returns an unsubscribe; the connection closes when nothing is subscribed. Returns a no-op without a token.
 */
export function subscribeToUserEvents(handlers) {
  if (!acquire()) return () => {};
  const removeListeners = addListeners(handlers);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    removeListeners();
    release();
  };
}

/**
 * Track one or more orders. Pass both the Mongo _id and the "FOD-" id, as the web does.
 * handlers: {onLocation, onStatus, onState, onDropOtp, onRoomJoined, onResyncComplete}
 * or raw event names. Location/status payloads are not filtered by order; compare
 * payload.orderId / payload.orderMongoId with your ids if you track several orders.
 */
export function subscribeToOrder(orderIds, handlers = {}) {
  const ids = normalizeIds(orderIds);
  if (!ids.length || !acquire()) return () => {};

  const mapped = {
    "location-update": handlers.onLocation,
    order_status_update: handlers.onStatus,
    order_state: handlers.onState,
    delivery_drop_otp: handlers.onDropOtp,
    "tracking-room-joined": handlers.onRoomJoined,
    resync_complete: handlers.onResyncComplete,
  };
  Object.keys(handlers).forEach((key) => {
    if (eventListeners.has(key)) mapped[key] = handlers[key];
  });
  const removeListeners = addListeners(mapped);

  ids.forEach((id) => {
    const count = roomCounts.get(id) || 0;
    roomCounts.set(id, count + 1);
    if (count === 0 && socket?.connected) socket.emit("join-tracking", id);
  });

  let done = false;
  return () => {
    if (done) return;
    done = true;
    removeListeners();
    ids.forEach((id) => {
      const count = (roomCounts.get(id) || 1) - 1;
      if (count > 0) {
        roomCounts.set(id, count);
        return;
      }
      roomCounts.delete(id);
      if (socket?.connected) socket.emit("leave-tracking", id);
    });
    release();
  };
}

// Ask the server for the active-order snapshot again (replies with order_state, then resync_complete).
export function requestResync() {
  if (socket?.connected) socket.emit("resync");
}

export function isSocketConnected() {
  return connected;
}

export function subscribeSocketConnection(listener) {
  connectionListeners.add(listener);
  listener(connected);
  return () => connectionListeners.delete(listener);
}

// Hard stop on logout, regardless of remaining subscribers.
export function disconnectSocket() {
  refCount = 0;
  release();
}
