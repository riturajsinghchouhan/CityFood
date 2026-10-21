// Firebase JS SDK v11: app + Realtime Database only, WITHOUT Firebase auth — exactly like the web
// (@food/firebase ensureFirebaseInitialized({enableAuth:false}) + @food/realtimeTracking.js).
// Config is the public client config from mobile-delivery/.env (EXPO_PUBLIC_FIREBASE_*).
// Ported paths:
//   delivery_partner_offers/<riderId>   read  (second offer feed; a removed key = claimed/expired)
//   delivery_boys/<riderId>             write (rider position for the admin live map)
// NOTE (backend issue #8): these paths only work if the RTDB rules allow unauthenticated access.
import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase, onValue, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};

let db = null;
let initFailed = false;

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.databaseURL);
}

// Lazily create the app + database. Returns null (never throws) when config is missing or init fails.
export function getRealtimeDb() {
  if (db) return db;
  if (initFailed || !isFirebaseConfigured()) return null;
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    db = getDatabase(app, firebaseConfig.databaseURL);
    return db;
  } catch (err) {
    initFailed = true;
    console.warn("[firebase] Realtime Database unavailable:", err?.message || String(err));
    return null;
  }
}

function sanitizeRealtimeKey(value) {
  return String(value || "").trim().replace(/[.#$/[\]]/g, "_");
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * subscribeDeliveryPartnerOffers(riderId, onChange(offersMap, path), onError(error)) — onValue on
 * delivery_partner_offers/<riderId>. offersMap: {<orderMongoId>: <socket offer payload> + status:'offered',
 * offeredAt, last_updated}. Returns an unsubscribe. onError is called (and the listener ends) when the
 * read is denied or the DB is not configured.
 */
export function subscribeDeliveryPartnerOffers(riderId, onChange, onError) {
  if (!riderId || typeof onChange !== "function") return () => {};
  const database = getRealtimeDb();
  if (!database) {
    onError?.(new Error("Firebase Realtime Database is not configured"));
    return () => {};
  }
  const path = `delivery_partner_offers/${sanitizeRealtimeKey(riderId)}`;
  try {
    return onValue(
      ref(database, path),
      (snapshot) => onChange(snapshot.val() || {}, path),
      (error) => onError?.(error, path),
    );
  } catch (err) {
    onError?.(err, path);
    return () => {};
  }
}

/**
 * writeDeliveryLocation — set(delivery_boys/<riderId>, {lat, lng, heading, speed, accuracy, timestamp,
 * last_updated, isOnline, activeOrderId, status}) exactly as the web. Resolves true/false, never throws.
 */
export async function writeDeliveryLocation({
  deliveryId,
  lat,
  lng,
  heading = 0,
  speed = 0,
  isOnline = true,
  activeOrderId = null,
  accuracy = null,
  timestamp = Date.now(),
  status = null,
}) {
  if (!deliveryId) return false;
  const database = getRealtimeDb();
  if (!database) return false;
  try {
    const payload = {
      lat: toFiniteNumber(lat),
      lng: toFiniteNumber(lng),
      heading: toFiniteNumber(heading) || 0,
      speed: toFiniteNumber(speed) || 0,
      accuracy: toFiniteNumber(accuracy),
      timestamp: toFiniteNumber(timestamp) || Date.now(),
      last_updated: Date.now(),
      isOnline: Boolean(isOnline),
      activeOrderId: activeOrderId ? String(activeOrderId) : null,
      status: status != null ? String(status) : isOnline ? "online" : "offline",
    };
    await set(ref(database, `delivery_boys/${sanitizeRealtimeKey(deliveryId)}`), payload);
    return true;
  } catch {
    return false;
  }
}
