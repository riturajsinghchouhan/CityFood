// Native FCM push for the restaurant owner. Replaces the web's firebaseMessaging.js + service worker.
// New-order pushes (audit §3.3) are notification+data messages on Android channel "default" with
// data {type:"new_order", orderId:<mongoId>, orderMongoId, link:"/restaurant/orders/<id>"}; the sound
// comes from the CHANNEL, so channel "default" carries the ringtone.
// NOTE: Android fixes a channel's sound/importance at creation. If a build ever created "default"
// without the ringtone, only reinstalling (or clearing app data) applies the new settings.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { removeFcmToken, removePushDevice, savePushDevice } from "../api/push";
import { KEYS, store } from "../storage";

const devicePlatform = Platform.OS === "ios" ? "ios" : "android";
export const ORDER_CHANNEL_ID = "default";
// Base name as the expo-notifications plugin copies it into res/raw (app.config.js "sounds").
export const ORDER_RING_SOUND = "restaurant_order_ring.wav";
export const ORDER_VIBRATION = [0, 200, 100, 200, 100, 300];

let warned = false;
let registrationInFlight = null;
let channelReady = null;
let newOrderPushHandler = null;

/**
 * The notifications provider registers the in-app ring here. Called with the push data for a
 * foreground new-order push (socket and push may both deliver the same order; the provider dedupes).
 */
export function setNewOrderPushHandler(handler) {
  newOrderPushHandler = typeof handler === "function" ? handler : null;
  return () => {
    if (newOrderPushHandler === handler) newOrderPushHandler = null;
  };
}

function isNewOrderData(data) {
  return String(data?.type || "").toLowerCase() === "new_order";
}

/**
 * Foreground presentation. New-order pushes start the in-app ring (lib/ring via the provider) and
 * are shown without the system sound, so the ringtone does not double up (the web also kept the
 * generic FCM sound off inside the restaurant panel). Other pushes show normally with sound.
 * On Android the channel sound may still play once for the banner; that is OS-controlled.
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification?.request?.content?.data || notification?.request?.trigger?.remoteMessage?.data || {};
      if (isNewOrderData(data)) {
        try {
          newOrderPushHandler?.(data);
        } catch {
          // never block presentation
        }
        return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false };
      }
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
}

// Channel "default": importance MAX, ringtone sound, vibration, visible on the lock screen.
export function ensureAndroidChannel() {
  if (Platform.OS !== "android") return Promise.resolve();
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(ORDER_CHANNEL_ID, {
      name: "New orders",
      description: "New order alerts and order updates",
      // Re-exported via `export *` from a TS enum, which eslint-plugin-import can't resolve.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.MAX,
      sound: ORDER_RING_SOUND,
      vibrationPattern: ORDER_VIBRATION,
      enableVibrate: true,
      // eslint-disable-next-line import/namespace
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      // eslint-disable-next-line import/namespace
      audioAttributes: { usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE },
    }).catch((err) => {
      channelReady = null;
      throw err;
    });
  }
  return channelReady;
}

// Same id scheme as ExploreMore.jsx logout: tuggo:restaurant:<platform>:<last 16 of token>.
export function deviceIdFor(token) {
  const seed = String(token || "").trim().slice(-16);
  return seed ? ["tuggo", "restaurant", devicePlatform, seed].join(":") : null;
}

/**
 * The FCM token for verify-otp {fcmToken, platform:"mobile"} WITHOUT a permission prompt
 * (an FCM token does not need POST_NOTIFICATIONS). verify-otp saves it even for pending/rejected
 * accounts. Resolves to the token or null (e.g. no google-services.json in this build).
 */
export async function getPushTokenForLogin() {
  try {
    await ensureAndroidChannel();
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

/**
 * Create the channel, ask permission, get the native FCM token and register it with
 * POST /fcm-tokens/device/save {fcmToken, pushPlatform:"mobile", devicePlatform:"android", deviceId}
 * (fills pushDevices[] + fcmTokenMobile). Call only while logged in. Resolves to the token or null.
 */
export function registerForPushNotifications() {
  if (registrationInFlight) return registrationInFlight;
  registrationInFlight = (async () => {
    try {
      await ensureAndroidChannel();
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

// Web logout order (ExploreMore.jsx): remove the device, remove the token; useAuth().logout() then
// sends the token to /food/auth/logout and clears it. Never sends a voipToken on Android.
export async function unregisterPushDevice() {
  const fcmToken = await store.get(KEYS.fcmToken);
  if (!fcmToken) return;
  await removePushDevice({ deviceId: deviceIdFor(fcmToken), fcmToken }).catch(() => {});
  await removeFcmToken(fcmToken, "mobile").catch(() => {});
}

function dataOf(response) {
  const request = response?.notification?.request;
  return request?.content?.data || request?.trigger?.remoteMessage?.data || {};
}

/**
 * Web path for a tapped notification.
 * - new_order -> "/restaurant/orders/<orderMongoId|orderId>" (the backend's own link)
 * - order_status_update carries link "/food/user/orders/<id>" (a USER route, audit §6 backend #12),
 *   so it is rewritten to "/restaurant/orders/<id>"
 * - otherwise data.link / click_action / targetUrl when it is an app path, else "/".
 * Map the result with navigation/links.toNativePath.
 */
export function getNotificationTarget(data = {}) {
  const type = String(data?.type || "").toLowerCase();
  const orderId = data?.orderMongoId || data?.orderId;
  if ((type === "new_order" || type === "order_status_update") && orderId) {
    return `/restaurant/orders/${orderId}`;
  }
  const raw = String(data?.link || data?.click_action || data?.targetUrl || "/");
  const userOrder = /^\/(?:food\/)?user\/orders\/([^/?]+)/.exec(raw);
  if (userOrder) return `/restaurant/orders/${userOrder[1]}`;
  return raw.startsWith("/") ? raw : "/";
}

/**
 * Route taps on notifications (including the one that cold-started the app).
 * navigate(webPath, data) gets e.g. "/restaurant/orders/<id>"; the caller maps it with toNativePath.
 * Returns an unsubscribe.
 */
export function addNotificationTapListener(navigate) {
  let lastHandledId = null;
  const handle = (response) => {
    if (!response) return;
    const id = response.notification?.request?.identifier;
    if (id && id === lastHandledId) return;
    lastHandledId = id;
    const data = dataOf(response);
    navigate(getNotificationTarget(data), data);
  };
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
