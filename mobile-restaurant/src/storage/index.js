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

// Restaurant keys. Token keys are the web's legacy restaurant_* names (SecureStore);
// the rest are AsyncStorage keys under the web's "food:v1:" namespace.
export const KEYS = {
  accessToken: "restaurant_accessToken",
  refreshToken: "restaurant_refreshToken",
  user: "auth:restaurant:user", // web restaurant_user (the verify-otp `user`, then /current)
  pendingPhone: "auth-meta:restaurant:pendingPhone", // web restaurant_pendingPhone
  fcmToken: "auth-meta:fcm:restaurant", // web fcm_web_registered_token_restaurant
  pickupOtpReveal: "restaurant_pickupOtpReveal",
  notificationPermissionAsked: "restaurant_notification_permission_asked",
  onboardingData: "restaurant_onboarding_data",
  onlineStatus: "restaurant_online_status",
  businessSettings: "settings/business",
  appConfig: "settings/app-config:restaurant_app",
};

// clearRestaurantSessionCache() in Frontend/src/modules/Food/utils/auth.js: removed on logout
// so the next account never sees the previous one's cached UI state.
export const RESTAURANT_SESSION_CACHE_KEYS = [
  "restaurant_owner_contact",
  "restaurant_onboarding",
  KEYS.onboardingData,
  "restaurant_invited_users",
  "restaurant_schedule_off",
  KEYS.onlineStatus,
  "restaurant_outlet_timings",
  "restaurant_hub_menu_active_tab",
  "restaurant_name",
  "restaurantName",
  KEYS.pickupOtpReveal,
];
