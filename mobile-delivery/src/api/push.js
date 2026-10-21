// FCM token endpoints for the DELIVERY_PARTNER owner type (from the JWT role), audit #45-#50. Web:
// deliveryAPI.saveFcmToken/savePushDevice/removePushDevice/removeFcmToken and
// notificationAPI.sendTestNotification(contextModule "delivery"). lib/push.js drives these.
import { api } from "./client";

const SAVE_TTL_MS = 24 * 60 * 60 * 1000;
const savedAt = new Map();
const saveInFlight = new Map();

// POST /fcm-tokens/mobile/save (platform "mobile") or /fcm-tokens/save {token, platform}.
// Deduped for 24 h per token+platform, like createSaveFcmTokenOnce.
export function saveFcmToken(token, platform = "mobile") {
  if (!token) return Promise.reject(new Error("FCM token is required"));
  const p = platform === "mobile" ? "mobile" : "web";
  const normalizedToken = String(token);
  const key = `${p}:${normalizedToken}`;
  const last = savedAt.get(key);
  if (last && Date.now() - last < SAVE_TTL_MS) {
    return Promise.resolve({ success: true, message: "FCM token already saved", deduped: true });
  }
  if (saveInFlight.has(key)) return saveInFlight.get(key);
  const path = p === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
  const promise = api
    .post(path, { token: normalizedToken, platform: p })
    .then((res) => {
      savedAt.set(key, Date.now());
      return res;
    })
    .finally(() => saveInFlight.delete(key));
  saveInFlight.set(key, promise);
  return promise;
}

// POST /fcm-tokens/device/save {fcmToken, pushPlatform:"mobile", devicePlatform:"android", deviceId}.
// Preferred: fills pushDevices[] AND fcmTokenMobile (new-offer urgent push). Never send voipToken on Android.
export function savePushDevice(payload = {}) {
  return api.post("/fcm-tokens/device/save", payload ?? {});
}

// DELETE /fcm-tokens/device/remove {deviceId, fcmToken, voipToken?} (body and query, as on web)
export function removePushDevice(payload = {}) {
  return api.delete("/fcm-tokens/device/remove", { data: payload ?? {}, params: payload ?? {} });
}

// DELETE /fcm-tokens/remove {token, platform} (body + ?platform)
export function removeFcmToken(token, platform = "mobile") {
  if (!token) return Promise.reject(new Error("FCM token is required"));
  return api.delete("/fcm-tokens/remove", { params: { platform }, data: { token: String(token), platform } });
}

// POST /fcm-tokens/test {platform, channel:"fcm"|"voip"} (ProfileV2 "test notification").
export function sendTestNotification(platform = "mobile", channel = "fcm") {
  return api.post("/fcm-tokens/test", { platform, channel });
}
