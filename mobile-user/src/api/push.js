// FCM token endpoints. Web: userAPI.saveFcmToken/savePushDevice/removePushDevice/removeFcmToken/
// testFcmNotification and notificationAPI.sendTestNotification. All need the USER Bearer token
// except removeFcmToken, where it is optional.
import { api } from "./client";

const SAVE_TTL_MS = 24 * 60 * 60 * 1000;
const savedAt = new Map();
const saveInFlight = new Map();

// Deduped for 24 h per token+platform, like the web's createSaveFcmTokenOnce.
// platform "mobile" posts to /fcm-tokens/mobile/save, otherwise /fcm-tokens/save.
export function saveFcmToken(token, options = {}) {
  if (!token) return Promise.reject(new Error("FCM token is required"));
  const platform = options?.platform === "mobile" ? "mobile" : "web";
  const normalizedToken = String(token);
  const key = `${platform}:${normalizedToken}`;
  const last = savedAt.get(key);
  if (last && Date.now() - last < SAVE_TTL_MS) {
    return Promise.resolve({ success: true, message: "FCM token already saved", deduped: true });
  }
  if (saveInFlight.has(key)) return saveInFlight.get(key);
  const path = platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
  const p = api
    .post(path, { token: normalizedToken, platform })
    .then((res) => {
      savedAt.set(key, Date.now());
      return res;
    })
    .finally(() => {
      saveInFlight.delete(key);
    });
  saveInFlight.set(key, p);
  return p;
}

// Body: {fcmToken, voipToken?, pushPlatform: "mobile", devicePlatform: "android" | "ios", deviceId?}
export function savePushDevice(payload = {}) {
  return api.post("/fcm-tokens/device/save", payload ?? {});
}

// Body: {fcmToken | voipToken | deviceId}; sent as both body and query, as on web.
export function removePushDevice(payload = {}) {
  return api.delete("/fcm-tokens/device/remove", { data: payload ?? {}, params: payload ?? {} });
}

export function removeFcmToken(token, options = {}) {
  if (!token) return Promise.reject(new Error("FCM token is required"));
  const platform = options?.platform === "mobile" ? "mobile" : "web";
  return api.delete("/fcm-tokens/remove", { params: { platform }, data: { token: String(token), platform } });
}

// Profile "test notification" button. data: {successCount, failureCount, ...}
export function sendTestNotification(platform = "mobile", channel = "fcm") {
  return api.post("/fcm-tokens/test", { platform, channel });
}

export function testFcmNotification(options = {}) {
  const platform = options?.platform === "mobile" ? "mobile" : "web";
  return api.post("/fcm-tokens/test", { platform });
}
