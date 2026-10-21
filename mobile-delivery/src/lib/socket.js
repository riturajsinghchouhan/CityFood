// The ONE rider Socket.IO connection, ported from the socket part of
// Frontend/src/modules/Food/hooks/useDeliveryNotifications.js. DeliveryContext owns it.
// - Options as the web: path /socket.io/, websocket first with polling fallback, infinite
//   reconnection 1-5 s, 20 s timeout, token in auth AND query (read on every (re)connect).
// - The server auto-joins delivery:<riderId> and all_delivery from the JWT; the client also emits
//   `join-delivery <riderId>` and `resync` on every connect (server replies active_order,
//   pending_offers + new_order_available{recovered:true} per offer, resync_complete).
// - `reconnect` / `reconnect_attempt` are MANAGER events in socket.io v4: the web bound them on the
//   socket so they never fired; here they are bound on socket.io (the Manager) and forwarded.
// - emitLocation() = web emitLocation: join-tracking once per order id, then update-location.
import { io } from "socket.io-client";
import { getAccessToken } from "../api/client";
import { SOCKET_URL } from "../config";

// Server -> client events the web listens to (all forwarded to subscribers). Never emitted to riders
// by the backend today (kept for parity, audit §3.1): new_order (restaurant rooms only),
// play_notification_sound, order_cancelled, order_auto_killed, order_reassigned_elsewhere.
export const DELIVERY_SOCKET_EVENTS = [
  "delivery-room-joined",
  "resync_complete",
  "active_order",
  "pending_offers",
  "new_order",
  "new_order_available",
  "play_notification_sound",
  "order_ready",
  "order_status_update",
  "order_cancelled",
  "order_deleted",
  "order_auto_killed",
  "order_reassigned_elsewhere",
  "order_claimed",
  "admin_notification",
  "admin_force_status",
];
// Connection-level events, forwarded too: connect, disconnect, connect_error, reconnect, reconnect_attempt.
export const DELIVERY_CONNECTION_EVENTS = ["connect", "disconnect", "connect_error", "reconnect", "reconnect_attempt"];

let socket = null;
let currentRiderId = null;
let connected = false;
const joinedTrackingOrders = new Set();
const eventListeners = new Map(
  [...DELIVERY_SOCKET_EVENTS, ...DELIVERY_CONNECTION_EVENTS].map((e) => [e, new Set()]),
);
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

function tokenAuth(cb) {
  cb({ token: getAccessToken() || "" });
}

/**
 * Open (or keep) the connection for this rider id. Safe to call repeatedly.
 * Returns false when there is no rider id or access token yet.
 */
export function connectDeliverySocket(riderId) {
  const id = riderId ? String(riderId) : null;
  if (!id || !getAccessToken()) return false;
  if (socket && currentRiderId === id) {
    if (!socket.connected) socket.connect();
    return true;
  }
  disconnectDeliverySocket();
  currentRiderId = id;
  const token = getAccessToken();
  socket = io(SOCKET_URL, {
    path: "/socket.io/",
    transports: ["websocket", "polling"],
    upgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    auth: tokenAuth,
    query: token ? { token } : undefined,
  });

  socket.on("connect", () => {
    joinedTrackingOrders.clear();
    // The query token is fixed at creation; refresh it so the next reconnect carries the current token.
    if (socket?.io?.opts) socket.io.opts.query = { token: getAccessToken() || "" };
    socket.emit("join-delivery", currentRiderId);
    socket.emit("resync");
    setConnected(true);
    emitLocal("connect", { socketId: socket.id });
  });
  socket.on("disconnect", (reason) => {
    joinedTrackingOrders.clear();
    setConnected(false);
    emitLocal("disconnect", reason);
    // The server dropped us (e.g. auth change): reconnect manually, like the web.
    if (reason === "io server disconnect") socket?.connect();
  });
  socket.on("connect_error", (error) => {
    setConnected(false);
    emitLocal("connect_error", error);
  });
  socket.io.on("reconnect_attempt", (attempt) => emitLocal("reconnect_attempt", attempt));
  socket.io.on("reconnect", (attempt) => emitLocal("reconnect", attempt));
  DELIVERY_SOCKET_EVENTS.forEach((event) => {
    socket.on(event, (payload) => emitLocal(event, payload));
  });
  return true;
}

export function disconnectDeliverySocket() {
  if (socket) {
    socket.io?.off?.("reconnect_attempt");
    socket.io?.off?.("reconnect");
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentRiderId = null;
  joinedTrackingOrders.clear();
  setConnected(false);
}

// Web reconnectSocketWithToken: drop and reconnect so the server re-auths with the current token.
export function reconnectDeliverySocket() {
  if (!socket) return;
  if (socket.io?.opts) socket.io.opts.query = { token: getAccessToken() || "" };
  if (socket.connected) socket.disconnect();
  socket.connect();
}

// Nudge a reconnect (app back in the foreground). No-op when connected or not set up.
export function ensureSocketConnected() {
  if (socket && !socket.connected) socket.connect();
}

// Ask the server to replay active_order / pending_offers (web: on connect, focus and visibility).
export function requestResync() {
  if (socket?.connected) socket.emit("resync");
}

/**
 * Web emitLocation(data): requires a connected socket and an order id (Mongo _id preferred — the user
 * app joins tracking rooms by it). Emits join-tracking once per order, then update-location
 * {...data, orderId, userId, restaurantId}. The server throttles broadcasts to 1 / 10 s / order.
 * Returns true when emitted.
 */
export function emitLocation(data) {
  if (!socket?.connected || !data) return false;
  const orderId = String(data.orderId || "").trim();
  if (!orderId) return false;
  if (!joinedTrackingOrders.has(orderId)) {
    joinedTrackingOrders.add(orderId);
    socket.emit("join-tracking", orderId);
  }
  socket.emit("update-location", { ...data, orderId, userId: data.userId, restaurantId: data.restaurantId });
  return true;
}

/**
 * handlers: {<event>: fn} for any DELIVERY_SOCKET_EVENTS / DELIVERY_CONNECTION_EVENTS entry.
 * Returns an unsubscribe. Listening does not open the connection.
 */
export function subscribeDeliveryEvents(handlers) {
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
