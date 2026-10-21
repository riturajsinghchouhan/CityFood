// Background location while ONLINE (user decision A). IMPORT THIS MODULE FROM THE ROOT LAYOUT: the
// TaskManager task is defined at module top level so it exists when Android starts the JS runtime for
// the foreground service (no screen mounted).
//
// How it works
// - Going online -> startBackgroundTracking(): Location.startLocationUpdatesAsync(LOCATION_TASK, {...})
//   with an Android foreground service ("You're online"); killServiceOnDestroy:false keeps it alive
//   when the app is swiped away. Requires FOREGROUND permission and must be called while the app is in
//   the foreground (Android forbids starting a foreground service from the background). Background
//   permission ("Allow all the time") is requested separately after an explanation, see
//   requestBackgroundLocation(); the foreground service works without it on a while-in-use grant.
// - Every fix the OS delivers is queued (persisted, so an offline backlog survives) and POSTed as a
//   batch to POST /food/delivery/location at most once per config.intervalMs. The response's
//   config {mode, intervalMs, distanceFilterMeters, stopTracking} is honoured: the update options are
//   re-applied when they change (only possible while the app is in the foreground — otherwise they are
//   applied on the next foreground via applyPendingTrackingConfig()), and stopTracking:true stops the
//   updates (the server says the rider is offline/not approved with no trip).
// - Backend issue #9: the server treats a trip in preparing/ready_for_pickup as "idle" (20 s / 50 m).
//   While DeliveryContext reports a local active order, the onTrip cadence (10 s / 20 m) is used instead.
// - In-process listeners (subscribeLocationFixes) receive each fix when the app's JS is alive, so
//   DeliveryContext can emit the socket update-location, write RTDB and run the 100 m auto-arrival.
// - Stops on going offline, logout, session expiry (401) and stopTracking.
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState, Linking, Platform } from "react-native";
import { getAccessToken, loadTokens } from "../api/client";
import { postLocationBatch } from "../api/duty";
import { KEYS, store } from "../storage";

export const LOCATION_TASK = "cityfood-delivery-location";
export const BRAND_COLOR = "#15498b";

// Server defaults (deliveryTracking.service.js) before the first response.
export const TRACKING_MODES = {
  offline: { mode: "offline", stopTracking: true, intervalMs: 30000, distanceFilterMeters: 100 },
  onTrip: { mode: "onTrip", stopTracking: false, intervalMs: 10000, distanceFilterMeters: 20 },
  idle: { mode: "idle", stopTracking: false, intervalMs: 20000, distanceFilterMeters: 50 },
};
const MAX_QUEUE = 200; // oldest points are dropped beyond this
const MAX_BATCH = 100;
const MIN_INTERVAL_MS = 5000;

let queue = null; // lazily loaded from storage
let lastPostAt = 0;
let posting = null;
let serverConfig = null; // last config from the server
let appliedOptionsKey = null; // timeInterval:distanceInterval:accuracy currently running
let pendingApply = false;
let localActiveOrderId = null;
const fixListeners = new Set();
const configListeners = new Set();

function emit(set, ...args) {
  set.forEach((fn) => {
    try {
      fn(...args);
    } catch {
      // ignore listener errors
    }
  });
}

async function loadQueue() {
  if (queue) return queue;
  const saved = await store.get(KEYS.locationQueue, []);
  queue = Array.isArray(saved) ? saved : [];
  if (!serverConfig) serverConfig = await store.get(KEYS.trackingConfig, null);
  if (localActiveOrderId === null) {
    const meta = await store.get(KEYS.trackingMeta, null);
    localActiveOrderId = meta?.activeOrderId || null;
  }
  return queue;
}

function persistQueue() {
  return store.set(KEYS.locationQueue, queue && queue.length ? queue : null);
}

const isMongoId = (v) => /^[a-f0-9]{24}$/i.test(String(v || ""));

function toPoint(loc) {
  const c = loc?.coords || {};
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null;
  const point = {
    lat: c.latitude,
    lng: c.longitude,
    capturedAt: new Date(loc.timestamp || Date.now()).toISOString(),
  };
  if (Number.isFinite(c.speed) && c.speed >= 0) point.speed = c.speed;
  if (Number.isFinite(c.heading) && c.heading >= 0) point.heading = c.heading;
  if (Number.isFinite(c.accuracy)) point.accuracy = c.accuracy;
  if (Number.isFinite(c.altitude)) point.altitude = c.altitude;
  if (isMongoId(localActiveOrderId)) point.orderId = String(localActiveOrderId);
  return point;
}

// The cadence actually used: the server's config, upgraded to onTrip while a local trip exists.
export function effectiveTrackingConfig() {
  const base = serverConfig && !serverConfig.stopTracking ? serverConfig : TRACKING_MODES.idle;
  if (localActiveOrderId && base.mode !== "onTrip") {
    return { ...TRACKING_MODES.onTrip, serverMode: base.mode };
  }
  return { ...TRACKING_MODES.idle, ...base };
}

function buildOptions() {
  const cfg = effectiveTrackingConfig();
  const timeInterval = Math.max(MIN_INTERVAL_MS, Number(cfg.intervalMs) || TRACKING_MODES.idle.intervalMs);
  const distanceInterval = Math.max(0, Number(cfg.distanceFilterMeters) || 0);
  const onTrip = cfg.mode === "onTrip";
  return {
    key: `${timeInterval}:${distanceInterval}:${onTrip ? "high" : "balanced"}`,
    options: {
      accuracy: onTrip ? Location.Accuracy.High : Location.Accuracy.Balanced,
      timeInterval,
      distanceInterval,
      deferredUpdatesInterval: 0,
      mayShowUserSettingsDialog: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: "You're online",
        notificationBody: "Sharing your location for orders",
        notificationColor: BRAND_COLOR,
        killServiceOnDestroy: false,
      },
    },
  };
}

async function startWithCurrentOptions() {
  const { key, options } = buildOptions();
  await Location.startLocationUpdatesAsync(LOCATION_TASK, options);
  appliedOptionsKey = key;
  pendingApply = false;
}

// Re-apply options after a config change. Only in the foreground (see header).
async function maybeReapplyOptions() {
  const { key } = buildOptions();
  if (key === appliedOptionsKey) return;
  if (!(await isBackgroundTrackingActive())) return;
  if (AppState.currentState !== "active") {
    pendingApply = true;
    return;
  }
  try {
    await startWithCurrentOptions();
  } catch {
    pendingApply = true;
  }
}

async function setServerConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return;
  const next = {
    mode: cfg.mode || serverConfig?.mode || "idle",
    stopTracking: Boolean(cfg.stopTracking),
    intervalMs: Number(cfg.intervalMs) || TRACKING_MODES.idle.intervalMs,
    distanceFilterMeters: Number(cfg.distanceFilterMeters) || TRACKING_MODES.idle.distanceFilterMeters,
    receivedAt: Date.now(),
  };
  serverConfig = next;
  await store.set(KEYS.trackingConfig, next);
  emit(configListeners, next);
  if (next.stopTracking && !localActiveOrderId) {
    await stopLocationUpdates();
    return;
  }
  await maybeReapplyOptions();
}

/**
 * POST the queued points (≤100 per request). Respects config.intervalMs unless force. Keeps points on
 * network/5xx errors (backlog), drops them on a 4xx validation error, stops tracking on 401.
 */
export async function flushLocationQueue({ force = false } = {}) {
  if (posting) return posting;
  posting = (async () => {
    await loadQueue();
    if (!queue.length) return null;
    const interval = effectiveTrackingConfig().intervalMs || TRACKING_MODES.idle.intervalMs;
    if (!force && Date.now() - lastPostAt < interval) return null;
    if (!getAccessToken()) await loadTokens();
    if (!getAccessToken()) {
      await stopLocationUpdates();
      return null;
    }
    const batch = queue.slice(0, MAX_BATCH);
    lastPostAt = Date.now();
    try {
      const res = await postLocationBatch(batch);
      queue = queue.slice(batch.length);
      await persistQueue();
      await setServerConfig(res?.data?.config);
      return res?.data || null;
    } catch (err) {
      if (err?.status === 401) {
        await stopLocationUpdates();
      } else if (err?.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        queue = queue.slice(batch.length); // invalid points; don't retry forever
        await persistQueue();
      }
      return null;
    }
  })().finally(() => {
    posting = null;
  });
  return posting;
}

async function handleLocations(locations) {
  await loadQueue();
  const points = (locations || []).map(toPoint).filter(Boolean);
  if (!points.length) return;
  queue = [...queue, ...points].slice(-MAX_QUEUE);
  await persistQueue();
  const latest = [...(locations || [])].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).pop();
  if (latest) emit(fixListeners, latest);
  await flushLocationQueue();
}

if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) return; // error.message has details; the OS keeps delivering
    try {
      await handleLocations(data?.locations);
    } catch {
      // never crash the task
    }
  });
}

// ---------- permissions ----------

/** {foreground:"granted"|"denied"|"undetermined", background:..., servicesEnabled:boolean, canAskAgain} */
export async function getLocationPermissions() {
  const [fg, bg, servicesEnabled] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => ({ status: "undetermined" })),
    Location.getBackgroundPermissionsAsync().catch(() => ({ status: "undetermined" })),
    Location.hasServicesEnabledAsync().catch(() => true),
  ]);
  return { foreground: fg.status, background: bg.status, servicesEnabled, canAskAgain: fg.canAskAgain !== false };
}

// Step 1: while-in-use permission (system dialog). Resolves true when granted.
export async function requestForegroundLocation() {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === "granted") return true;
  const res = await Location.requestForegroundPermissionsAsync();
  return res.status === "granted";
}

/**
 * Step 2, AFTER the UI explained why ("Allow all the time" keeps orders coming while you use Maps):
 * background permission. Android 11+ opens the app's location settings page instead of a dialog, so the
 * result may come back before the rider changes it — re-check with getLocationPermissions() on the next
 * foreground. Requires foreground permission first. Resolves true when granted.
 */
export async function requestBackgroundLocation() {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.status === "granted") return true;
  const res = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: "denied" }));
  return res.status === "granted";
}

export function openLocationSettings() {
  return Linking.openSettings().catch(() => {});
}

// ---------- start / stop ----------

export async function isBackgroundTrackingActive() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Start (or keep) background tracking. Call while the app is in the foreground after the rider went
 * online. Throws Error("LOCATION_PERMISSION") when foreground permission is missing.
 */
export async function startBackgroundTracking({ activeOrderId } = {}) {
  await loadQueue();
  if (activeOrderId !== undefined) await setTrackingActiveOrder(activeOrderId, { reapply: false });
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") throw new Error("LOCATION_PERMISSION");
  // A stale stopTracking from an earlier offline session must not block a fresh start.
  if (serverConfig?.stopTracking) serverConfig = null;
  const running = await isBackgroundTrackingActive();
  const { key } = buildOptions();
  if (running && key === appliedOptionsKey) return true;
  await startWithCurrentOptions();
  return true;
}

async function stopLocationUpdates() {
  appliedOptionsKey = null;
  pendingApply = false;
  if (await isBackgroundTrackingActive()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
    emit(configListeners, { ...(serverConfig || TRACKING_MODES.offline), stopped: true });
  }
}

/**
 * Stop tracking (going offline / logout). Sends whatever is queued first (best effort, unless
 * {flush:false}), then clears the queue.
 */
export async function stopBackgroundTracking({ flush = true } = {}) {
  if (flush) await flushLocationQueue({ force: true }).catch(() => {});
  await stopLocationUpdates();
  queue = [];
  await store.remove(KEYS.locationQueue);
}

/**
 * DeliveryContext reports the selected active order (Mongo _id) or null. Points carry it as orderId and
 * a trip switches the cadence to onTrip (10 s / 20 m).
 */
export async function setTrackingActiveOrder(orderId, { reapply = true } = {}) {
  const next = isMongoId(orderId) ? String(orderId) : orderId ? String(orderId) : null;
  if (next === localActiveOrderId) return;
  localActiveOrderId = next;
  await store.set(KEYS.trackingMeta, { activeOrderId: next });
  if (reapply) await maybeReapplyOptions();
}

// Call when the app returns to the foreground: applies a config change that arrived in the background.
export async function applyPendingTrackingConfig() {
  if (!pendingApply) return;
  if (Platform.OS === "android" && AppState.currentState !== "active") return;
  await maybeReapplyOptions();
}

export function getTrackingConfig() {
  return serverConfig;
}

// listener(locationObject) for every fix the task receives while the JS runtime is alive.
export function subscribeLocationFixes(listener) {
  fixListeners.add(listener);
  return () => fixListeners.delete(listener);
}

// listener(config) on every server config ({..., stopped:true} when updates were stopped).
export function subscribeTrackingConfig(listener) {
  configListeners.add(listener);
  return () => configListeners.delete(listener);
}
