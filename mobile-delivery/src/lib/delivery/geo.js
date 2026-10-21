// Ports of DeliveryV2/utils/geo.js, hooks/proximity.utils.js and utils/trackingInterval.js (pure JS).

const toRad = (d) => (d * Math.PI) / 180;

// Haversine distance in metres.
export function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ETA in minutes (min 1) from metres and a rolling average speed (m/s); falls back to 4.5 m/s.
export function calculateETA(distanceInMeters, averageSpeedMetersPerSec) {
  if (!distanceInMeters || distanceInMeters <= 0) return 0;
  const speed = averageSpeedMetersPerSec > 1 ? averageSpeedMetersPerSec : 4.5;
  return Math.max(1, Math.round(distanceInMeters / speed / 60));
}

// Bearing in degrees [0, 360).
export function calculateHeading(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// {lat,lng} | {latitude,longitude} | {coordinates:[lng,lat]} | {location:{coordinates}} -> {lat,lng}|null
export function parseLatLng(raw) {
  if (!raw) return null;
  let lat = Number(raw.lat ?? raw.latitude);
  let lng = Number(raw.lng ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const coords = raw.coordinates || raw.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      lng = Number(coords[0]);
      lat = Number(coords[1]);
    }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Distance in metres, Infinity when any coordinate is invalid (proximity.utils calculateDistance).
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const v = [lat1, lon1, lat2, lon2].map(Number);
  if (!v.every(Number.isFinite)) return Infinity;
  return getHaversineDistance(v[0], v[1], v[2], v[3]);
}

// utils/trackingInterval.js (dead code on web; kept for screens/maps that want a speed-adaptive throttle).
export function minMovementForSpeed(speedMs = 0) {
  const speed = Number(speedMs) || 0;
  if (speed > 8) return 15;
  if (speed > 3) return 10;
  return 5;
}

export function dynamicTrackingIntervalMs(speedMs = 0, distanceSinceLastM = 0) {
  const speed = Math.max(0, Number(speedMs) || 0);
  const dist = Math.max(0, Number(distanceSinceLastM) || 0);
  if (speed > 10) return 2000;
  if (speed > 5) return 3000;
  if (speed > 1) return 5000;
  if (dist < 5) return 15000;
  return 8000;
}

export function shouldSendLocationUpdate({ speedMs = 0, lastCoord, lat, lng, lastSentAt = 0, now = Date.now() }) {
  const distanceM = lastCoord ? getHaversineDistance(lastCoord.lat, lastCoord.lng, lat, lng) || 0 : 9999;
  const minDist = minMovementForSpeed(speedMs);
  const minInterval = dynamicTrackingIntervalMs(speedMs, distanceM);
  const elapsed = now - lastSentAt;
  if (distanceM >= minDist) return true;
  if (elapsed >= minInterval && distanceM >= 3) return true;
  return elapsed >= minInterval * 2;
}
