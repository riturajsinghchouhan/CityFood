// TTL-wrapped values, the AsyncStorage version of the web's
// readScopedCachedValue / writeScopedCachedValue (appStorage.js).
import { store } from "./index";

export async function readCached(key) {
  const entry = await store.get(key);
  if (!entry || typeof entry !== "object" || !("v" in entry)) return null;
  if (entry.exp && Date.now() > entry.exp) {
    store.remove(key);
    return null;
  }
  return entry.v;
}

export function writeCached(key, value, ttlMs) {
  if (value === null || value === undefined) return store.remove(key);
  return store.set(key, { v: value, exp: Date.now() + ttlMs });
}
