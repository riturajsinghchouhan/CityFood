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

// Keys shared across modules. Token keys mirror the web's user_* names.
export const KEYS = {
  accessToken: "user_accessToken",
  refreshToken: "user_refreshToken",
  user: "auth:user:user",
  cart: "cart",
  theme: "userAppTheme",
  location: "location:current",
  locationMode: "location:mode",
  zoneId: "zone:id",
  zoneStatus: "zone:status",
  zoneData: "zone:data",
  addresses: "userAddresses",
  fcmToken: "auth-meta:fcm:user",
  businessSettings: "settings/business",
  appConfig: "settings/app-config",
  profile: "userProfile",
  favorites: "userFavorites",
  dishFavorites: "userDishFavorites",
  vegMode: "userVegMode",
  vegModeOption: "userVegModeOption",
  under250Filters: "food-under-250-filters",
  orders: "userOrders",
  localNotifications: "food_user_notifications",
  editProfileDraft: "user_edit_profile_draft",
};
