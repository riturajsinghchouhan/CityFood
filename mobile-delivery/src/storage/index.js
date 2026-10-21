// Web localStorage replacement: SecureStore for tokens, AsyncStorage for the rest.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const PREFIX = "food:v1:";

export const secure = {
  async get(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    if (value === null || value === undefined || value === "") {
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return;
    }
    await SecureStore.setItemAsync(key, String(value));
  },
  async remove(key) {
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

// JSON values in AsyncStorage, namespaced like the web's appStorage.js.
export const store = {
  async get(key, fallback = null) {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  async set(key, value) {
    try {
      if (value === undefined || value === null) {
        await AsyncStorage.removeItem(PREFIX + key);
      } else {
        await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
      }
    } catch {
      // Storage is a cache; a failed write must not break the screen.
    }
  },
  async remove(key) {
    await AsyncStorage.removeItem(PREFIX + key).catch(() => {});
  },
  async removeMany(keys) {
    await AsyncStorage.multiRemove(keys.map((k) => PREFIX + k)).catch(() => {});
  },
};

// Delivery (rider) keys. Token keys are the web's legacy delivery_* names (SecureStore); the rest
// are AsyncStorage keys under the web's "food:v1:" namespace, named after the web localStorage keys
// (audit api-and-auth §1.6, routes-and-design §4.8).
export const KEYS = {
  accessToken: "delivery_accessToken",
  refreshToken: "delivery_refreshToken",
  user: "delivery_user", // web delivery_user (verify-otp `user`, then /food/auth/me `user`)
  authData: "deliveryAuthData", // web localStorage.deliveryAuthData (OTP hand-off {phone, ...})
  draftPhone: "delivery_draft_phone",
  needsRegistration: "deliveryNeedsRegistration",
  signupDetails: "deliverySignupDetails",
  signupDocs: "deliverySignupDocs",
  onlinePref: "delivery-v2-online-pref", // web zustand persist {isOnline}
  fcmToken: "fcm_web_registered_token_delivery", // here: the native FCM token sent to the backend
  notificationPermissionAsked: "delivery_notification_permission_asked",
  businessSettings: "settings/business",
  appConfig: "settings/app-config:delivery_app",
  appLogo: "delivery_app_logo",
  // Native-only (background location task, lib/locationTask.js)
  locationQueue: "delivery_location_queue", // unsent POST /food/delivery/location points
  trackingConfig: "delivery_tracking_config", // last {mode, intervalMs, distanceFilterMeters, stopTracking}
  trackingMeta: "delivery_tracking_meta", // {riderId, activeOrderId} for the headless task
};

// Removed on logout (clearModuleAuth("delivery") + the keys the web leaves behind, audit §6 F4).
export const DELIVERY_SESSION_CACHE_KEYS = [
  KEYS.authData,
  KEYS.onlinePref,
  "app:isOnline",
  KEYS.locationQueue,
  KEYS.trackingConfig,
  KEYS.trackingMeta,
];
