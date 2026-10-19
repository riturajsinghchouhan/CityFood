// Public client configuration, read from mobile-restaurant/.env (EXPO_PUBLIC_*).
// Only client-side values belong here; backend secrets never ship in the app.

function required(name, value) {
  if (!value) {
    throw new Error(`${name} is not set. Add it to mobile-restaurant/.env`);
  }
  return value.replace(/\/+$/, "");
}

export const API_BASE_URL = required(
  "EXPO_PUBLIC_API_BASE_URL",
  process.env.EXPO_PUBLIC_API_BASE_URL,
);

export const SOCKET_URL = required("EXPO_PUBLIC_SOCKET_URL", process.env.EXPO_PUBLIC_SOCKET_URL);

export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Host that serves relative upload paths such as "/uploads/x.jpg".
export const ASSET_ORIGIN = API_BASE_URL.replace(/\/api(\/v\d+)?$/i, "");

export const REQUEST_TIMEOUT_MS = 30000;
export const UPLOAD_TIMEOUT_MS = 300000;
