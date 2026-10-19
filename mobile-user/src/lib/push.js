// Native FCM push. Replaces the web's firebaseMessaging.js + firebase-messaging-sw.js.
// The backend sends Android notifications on channel "default"; tapping one opens
// data.link (e.g. "/food/user/orders/<id>"), like the service worker's notificationclick.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { removeFcmToken, removePushDevice, savePushDevice } from "../api/push";
import { KEYS, store } from "../storage";

const devicePlatform = Platform.OS === "ios" ? "ios" : "android";
let warned = false;
let registrationInFlight = null;

// Foreground pushes show as a normal system notification with sound.
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    // Re-exported via `export *` from a TS enum, which eslint-plugin-import can't resolve.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.HIGH,
    sound: "zomato_sms.mp3",
    vibrationPattern: [200, 100, 200, 100, 300],
  });
}

// Same id scheme as Profile.jsx logout; the backend accepts but does not persist it.
function deviceIdFor(token) {
  const seed = String(token || "").trim().slice(-16);
  return seed ? ["tuggo", "user", devicePlatform, seed].join(":") : null;
}

/**
 * Create the channel, ask permission, get the native FCM token and register it with
 * POST /fcm-tokens/device/save. Call only while logged in. Resolves to the token or null.
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
      if (status !== "granted") return null;

      const { data: token } = await Notifications.getDevicePushTokenAsync();
      if (!token) return null;
      await store.set(KEYS.fcmToken, token);
      await savePushDevice({
        fcmToken: token,
        pushPlatform: "mobile",
        devicePlatform,
        deviceId: deviceIdFor(token) || undefined,
      });
      return token;
    } catch (err) {
      // Expected until google-services.json is added (FCM not initialised).
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
    await savePushDevice({ fcmToken: token, pushPlatform: "mobile", devicePlatform, deviceId: deviceIdFor(token) || undefined }).catch(() => {});
  });
  return () => sub.remove();
}

// Web logout order: remove the device, remove the token, then /food/auth/logout.
// Call this before useAuth().logout(), which sends the token to /food/auth/logout and clears it.
export async function unregisterPushDevice() {
  const fcmToken = await store.get(KEYS.fcmToken);
  if (!fcmToken) return;
  await removePushDevice({ deviceId: deviceIdFor(fcmToken), fcmToken }).catch(() => {});
  await removeFcmToken(fcmToken, { platform: "mobile" }).catch(() => {});
}

function dataOf(response) {
  const request = response?.notification?.request;
  return request?.content?.data || request?.trigger?.remoteMessage?.data || {};
}

// Same precedence as the service worker: link, click_action, targetUrl; only app paths, else "/".
export function getNotificationTarget(data = {}) {
  const raw = data?.link || data?.click_action || data?.targetUrl || "/";
  return String(raw || "/").startsWith("/") ? String(raw) : "/";
}

/**
 * Route taps on notifications (including the one that cold-started the app).
 * navigate(webPath, data) receives the web path, e.g. "/food/user/orders/<id>" or
 * "/food/user/orders/<id>/tracking"; map it to the matching Expo Router screen.
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
