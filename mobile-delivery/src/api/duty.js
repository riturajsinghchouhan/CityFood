// Duty (online/offline) and location. Web: deliveryAPI.updateOnlineStatus/updateLocation (#14) plus
// the native-oriented batch endpoint POST /food/delivery/location (audit §4.2, never called by web).
import { UPLOAD_TIMEOUT_MS } from "../config";
import { api } from "./client";

/**
 * PATCH /food/delivery/availability {status:"online"|"offline", shiftStartPicBase64?, shiftStartAddress?}
 * (web updateOnlineStatus). shiftStartPicBase64 is RAW base64 JPEG (no "data:" prefix); the selfie is
 * stored only when going online. data: {availabilityStatus}.
 */
export function updateOnlineStatus(isOnline, shiftStartPicBase64 = null, shiftStartAddress = null) {
  return api.patch(
    "/food/delivery/availability",
    { status: isOnline ? "online" : "offline", shiftStartPicBase64, shiftStartAddress },
    { timeout: shiftStartPicBase64 ? UPLOAD_TIMEOUT_MS : undefined },
  );
}

/**
 * PATCH /food/delivery/availability {status, latitude, longitude, ...extras} (web updateLocation).
 * Writes lastLat/lastLng (what dispatch uses). ALWAYS sends status: a body without a valid status sets
 * the rider OFFLINE (backend issue #11). heading/speed/accuracy extras are ignored by the backend.
 */
export function updateLocation(latitude, longitude, isOnline, extras = {}) {
  return api.patch("/food/delivery/availability", {
    status: isOnline ? "online" : "offline",
    latitude,
    longitude,
    ...extras,
  });
}

/**
 * POST /food/delivery/location — batch of points (audit §4.2). point: {lat, lng, capturedAt:ISO,
 * orderId?:<24-hex>, speed?, heading?, accuracy?, altitude?, battery?}. Deduped per (rider, capturedAt),
 * so a re-sent backlog is safe. data: {processedCount, totalReceived, activeOrderId,
 * config:{stopTracking, mode:"offline"|"onTrip"|"idle", intervalMs, distanceFilterMeters}}.
 * Updates lastLat/lastLng/lastLocationAt, RTDB delivery_boys + active_orders, and emits location-update
 * to tracking rooms. It does NOT set the rider online.
 */
export function postLocationBatch(locations) {
  const list = Array.isArray(locations) ? locations : [locations];
  return api.post("/food/delivery/location", { locations: list.filter(Boolean) });
}
