// In-flight dedupe + short TTL caches, ported from Frontend/src/services/api/index.js
// (createInFlightCache, publicGetOnce and the per-endpoint "Once" helpers).

export function stableStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

export function createInFlightCache({ ttlMs }) {
  const inFlight = new Map();
  const cached = new Map();

  const getCached = (key) => {
    const hit = cached.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > ttlMs) {
      cached.delete(key);
      return null;
    }
    return hit.v;
  };

  const getOrCreate = (key, factory) => {
    const cachedValue = getCached(key);
    if (cachedValue) return Promise.resolve(cachedValue);
    if (inFlight.has(key)) return inFlight.get(key);
    const p = Promise.resolve()
      .then(factory)
      .then((res) => {
        cached.set(key, { t: Date.now(), v: res });
        return res;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, p);
    return p;
  };

  const invalidate = (key) => {
    if (key === undefined) cached.clear();
    else cached.delete(key);
  };

  return { getOrCreate, invalidate };
}

// Single-key variant used by the web for /auth/me, /user/wallet and /user/addresses.
export function createSingleFlight(fetcher, ttlMs) {
  let inFlight = null;
  let cached = null;
  let cacheTime = 0;

  const run = () => {
    if (cached && Date.now() - cacheTime < ttlMs) return Promise.resolve(cached);
    if (!inFlight) {
      inFlight = fetcher()
        .then((res) => {
          cached = res;
          cacheTime = Date.now();
          return res;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  };

  run.invalidate = () => {
    cached = null;
    cacheTime = 0;
  };

  return run;
}

// `_ts` is a cache-buster at several web call sites; it never takes part in the key.
export function withoutTs(params) {
  if (!params || typeof params !== "object") return params;
  const next = { ...params };
  delete next._ts;
  return next;
}
