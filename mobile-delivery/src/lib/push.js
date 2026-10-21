// Native FCM push for the rider. Replaces the web's firebaseMessaging.js + service worker.
// IMPORT THIS MODULE FROM THE ROOT LAYOUT: it defines the background-notification TaskManager task at
// module top level (data-only milestone pushes must be shown even when no screen is mounted).
//
// Pushes the rider receives (audit §3.4): new_order (notification+data, urgent, channel "default"),
// order_claimed, delivery_accepted, onboarding_approved/rejected, admin broadcasts (notification+data),
// and DATA-ONLY order_status_update (picked up / reached drop) and order_completed ({amountCollected,
// paymentMethod}); the backend copies title/body into data for those.
//
// Channels (decision B): "default" = importance MAX + delivery_alert.mp3 + vibration (the backend sends
// every push on channel_id "default", so this is the offer ringtone). Local milestone notifications use
// "order_updates" (HIGH, system sound) so trip updates don't play the offer ringtone.
// NOTE: Android fixes a channel's sound/importance at creation; changing them needs a reinstall.
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState, Platform } from "react-native";
import { removeFcmToken, removePushDevice, savePushDevice } from "../api/push";
import { KEYS, store } from "../storage";

const devicePlatform = Platform.OS === "ios" ? "ios" : "android";
export const OFFER_CHANNEL_ID = "default";
export const UPDATES_CHANNEL_ID = "order_updates";
// Base file name as the expo-notifications plugin copies it into res/raw (app.config.js "sounds").
export const OFFER_SOUND = "delivery_alert.mp3";
export const OFFER_VIBRATION = [0, 200, 100, 200, 100, 300];
export const BACKGROUND_PUSH_TASK = "cityfood-delivery-background-push";
const LOCAL_OFFER_DEDUPE_MS = 20000; // web BROWSER_NOTIFICATION_DEDUPE_MS

const MILESTONE_TYPES = new Set(["order_status_update", "order_completed"]);

let warned = false;
let registrationInFlight = null;
let channelsReady = null;
let foregroundPushHandler = null;
const lastLocalOfferAt = new Map();

// ---------- payload helpers ----------

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// Flatten whatever shape a remote message arrives in (handler, listener or background task) into the
// FCM data map {type, orderId, orderMongoId, link, title, body, ...}.
export function pushDataOf(source) {
  if (!source || typeof source !== "object") return {};
  const content = source?.request?.content;
  if (content) {
    const remote = source?.request?.trigger?.remoteMessage?.data;
    return { ...(remote || {}), ...(content.data || {}) };
  }
  let data = source.data !== undefined ? parseMaybeJson(source.data) : source;
  if (data && typeof data === "object" && typeof data.dataString === "string") {
    data = { ...data, ...(parseMaybeJson(data.dataString) || {}) };
  }
  if (data && typeof data === "object" && data.data && typeof data.data === "object") {
    data = { ...data, ...data.data };
  }
  return data && typeof data === "object" ? data : {};
}

const typeOf = (data) => String(data?.type || "").toLowerCase();

// ---------- background task (top level, decision: show data-only milestone pushes) ----------

async function showMilestoneNotification(data) {
  const title = data.title || (typeOf(data) === "order_completed" ? "Delivery successful!" : "Order update");
  const body = data.body || data.message || "";
  const key = `${typeOf(data)}:${data.orderMongoId || data.orderId || ""}:${data.orderStatus || ""}`;
  await ensureAndroidChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: `delivery-${key}`,
    content: { title, body, data: { ...data, localMilestone: "1" } },
    trigger: Platform.OS === "android" ? { channelId: UPDATES_CHANNEL_ID } : null,
  });
}

if (!TaskManager.isTaskDefined(BACKGROUND_PUSH_TASK)) {
  TaskManager.defineTask(BACKGROUND_PUSH_TASK, async ({ data, error }) => {
    if (error || !data) return;
    // A user tapping an action is delivered here too on Android; taps are handled by the tap listener.
    if (typeof data === "object" && "actionIdentifier" in data) return;
    const hasSystemNotification = Boolean(data?.notification?.title || data?.notification?.body);
    const flat = pushDataOf(data);
    if (hasSystemNotification || flat.localMilestone) return;
    if (!MILESTONE_TYPES.has(typeOf(flat))) return;
    try {
      await showMilestoneNotification(flat);
    } catch {
      // never crash the headless task
    }
  });
}

// ---------- foreground presentation ----------

/**
 * DeliveryContext registers here. handler(data) is called for every push received while the app is
 * in the foreground (new_order -> in-app ring + offer hydrate; order_claimed -> dismiss; ...).
 */
export function setForegroundPushHandler(handler) {
  foregroundPushHandler = typeof handler === "function" ? handler : null;
  return () => {
    if (foregroundPushHandler === handler) foregroundPushHandler = null;
  };
}

/**
 * new_order in the foreground: the in-app loop (lib/ring) is the alert, so the banner is shown without
 * the system sound (no double ring). Everything else shows normally. Call once at startup.
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = pushDataOf(notification);
      const isLocal = data.localMilestone !== undefined || data.localOffer !== undefined;
      if (!isLocal && AppState.currentState === "active") {
        try {
          foregroundPushHandler?.(data);
        } catch {
          // never block presentation
        }
      }
      if (typeOf(data) === "new_order") {
        return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false };
      }
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
}

export function ensureAndroidChannels() {
  if (Platform.OS !== "android") return Promise.resolve();
  if (!channelsReady) {
    channelsReady = Promise.all([
      Notifications.setNotificationChannelAsync(OFFER_CHANNEL_ID, {
        name: "New order offers",
        description: "New order offers and order alerts",
        // Re-exported via `export *` from a TS enum, which eslint-plugin-import can't resolve.
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.MAX,
        sound: OFFER_SOUND,
        vibrationPattern: OFFER_VIBRATION,
        enableVibrate: true,
        // eslint-disable-next-line import/namespace
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        // eslint-disable-next-line import/namespace
        audioAttributes: { usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE },
      }),
      Notifications.setNotificationChannelAsync(UPDATES_CHANNEL_ID, {
        name: "Trip updates",
        description: "Picked up, arrived and delivered updates",
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        enableVibrate: true,
      }),
    ]).catch((err) => {
      channelsReady = null;
      throw err;
    });
  }
  return channelsReady;
}

/**
 * Web showBackgroundOrderNotification: an offer that arrived over the socket/RTDB while the app is
 * backgrounded gets a local notification on channel "default" (ringtone). Deduped 20 s per order.
 */
export async function showLocalOfferNotification(order = {}) {
  const id = order.orderMongoId || order._id || order.orderId;
  const key = String(id || "new");
  const now = Date.now();
  if (now - (lastLocalOfferAt.get(key) || 0) < LOCAL_OFFER_DEDUPE_MS) return;
  lastLocalOfferAt.set(key, now);
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
  const total = Number(order.total || order.pricing?.total || order.orderTotal || 0);
  try {
    await ensureAndroidChannels();
    await Notifications.scheduleNotificationAsync({
      identifier: `delivery-order-${key}`,
      content: {
        title: `New order #${order.orderId || id || "New"}`,
        body: itemCount > 0 ? `${itemCount} item${itemCount === 1 ? "" : "s"} - ₹${total.toFixed(2)}` : "A new order is available to accept",
        data: { type: "new_order", orderId: String(order.orderId || ""), orderMongoId: String(order.orderMongoId || ""), localOffer: "1" },
        sound: OFFER_SOUND,
      },
      trigger: Platform.OS === "android" ? { channelId: OFFER_CHANNEL_ID } : null,
    });
  } catch {
    // best effort
  }
}

export async function dismissLocalOfferNotification(orderKey) {
  if (!orderKey) return;
  await Notifications.dismissNotificationAsync(`delivery-order-${orderKey}`).catch(() => {});
}

// ---------- token registration ----------

// Same id scheme as ProfileV2 logout: tuggo:delivery:<platform>:<last 16 of token>.
export function deviceIdFor(token) {
  const seed = String(token || "").trim().slice(-16);
  return seed ? ["tuggo", "delivery", devicePlatform, seed].join(":") : null;
}

/**
 * The FCM token for verify-otp / register {fcmToken, platform:"mobile"} WITHOUT a permission prompt.
 * verify-otp saves it even for pending/rejected riders, so the approval push arrives (audit §1.4).
 * Resolves to the token or null (e.g. no google-services.json in this build).
 */
export async function getPushTokenForLogin() {
  try {
    await ensureAndroidChannels();
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (token) await store.set(KEYS.fcmToken, token);
    return token || null;
  } catch {
    return null;
  }
}

function saveDevice(token) {
  return savePushDevice({
    fcmToken: token,
    pushPlatform: "mobile",
    devicePlatform,
    deviceId: deviceIdFor(token) || undefined,
  });
}

async function registerBackgroundTask() {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_PUSH_TASK))) {
      await Notifications.registerTaskAsync(BACKGROUND_PUSH_TASK);
    }
  } catch {
    // not available in this build (e.g. Expo Go)
  }
}

/**
 * Create the channels, ask permission, register the background push task, get the native FCM token
 * and save it with POST /fcm-tokens/device/save {fcmToken, pushPlatform:"mobile",
 * devicePlatform:"android", deviceId} (fills pushDevices[] + fcmTokenMobile). Call only while logged in.
 */
export function registerForPushNotifications() {
  if (registrationInFlight) return registrationInFlight;
  registrationInFlight = (async () => {
    try {
      await ensureAndroidChannels();
      await registerBackgroundTask();
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        ({ status } = await Notifications.requestPermissionsAsync());
      }
      await store.set(KEYS.notificationPermissionAsked, true);
      if (status !== "granted") return null;
      const { data: token } = await Notifications.getDevicePushTokenAsync();
      if (!token) return null;
      await store.set(KEYS.fcmToken, token);
      await saveDevice(token);
      return token;
    } catch (err) {
      if (!warned) {
        warned = true;
        console.warn("[push] Push registration unavailable:", err?.message || String(err));
      }
      return null;
    } finally {
      registrationInFlight = null;
    }
  })();
  return registrationInFlight;
}

// Re-register when FCM rotates the token. Returns an unsubscribe.
export function subscribePushTokenRefresh() {
  const sub = Notifications.addPushTokenListener(async ({ data: token }) => {
    if (!token) return;
    await store.set(KEYS.fcmToken, token);
    await saveDevice(token).catch(() => {});
  });
  return () => sub.remove();
}

// Web logout order (ProfileV2.jsx): remove the device, remove the token; AuthContext.logout then sends
// the token to /food/auth/logout and clears it. Never sends a voipToken on Android.
export async function unregisterPushDevice() {
  const fcmToken = await store.get(KEYS.fcmToken);
  if (!fcmToken) return;
  await removePushDevice({ deviceId: deviceIdFor(fcmToken), fcmToken }).catch(() => {});
  await removeFcmToken(fcmToken, "mobile").catch(() => {});
}

// ---------- taps ----------

function isDeliveryWebPath(p) {
  return typeof p === "string" && /^\/(food\/)?delivery(\/|$|\?)/.test(p);
}

/**
 * Web path for a tapped notification (map with navigation/links.toNativePath).
 * - Order pushes (new_order, order_claimed, delivery_accepted, order_status_update, order_completed):
 *   the backend link "/delivery/orders/<id>" has no web route and falls back to the feed, so -> "/food/delivery".
 * - onboarding_approved/rejected -> "/food/delivery/login" (Protected/redirects send a logged-in rider home).
 * - otherwise data.link / click_action / targetUrl when it is a delivery path, else "/food/delivery/notifications".
 */
export function getNotificationTarget(data = {}) {
  const type = typeOf(data);
  if (["new_order", "order_claimed", "delivery_accepted", "order_status_update", "order_completed"].includes(type)) {
    return "/food/delivery";
  }
  if (type.startsWith("onboarding_")) return "/food/delivery/login";
  const raw = String(data?.link || data?.click_action || data?.targetUrl || "");
  if (isDeliveryWebPath(raw)) return /^\/(food\/)?delivery\/orders\//.test(raw) ? "/food/delivery" : raw;
  return "/food/delivery/notifications";
}

/**
 * Route taps on notifications (including the one that cold-started the app).
 * navigate(webPath, data). Returns an unsubscribe.
 */
export function addNotificationTapListener(navigate) {
  let lastHandledId = null;
  const handle = (response) => {
    if (!response) return;
    const id = response.notification?.request?.identifier;
    if (id && id === lastHandledId) return;
    lastHandledId = id;
    const data = pushDataOf(response.notification);
    navigate(getNotificationTarget(data), data);
  };
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
