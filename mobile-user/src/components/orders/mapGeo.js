// Geometry for the tracking map. The web used google.maps.geometry (decodePath,
// computeDistanceBetween) and DirectionsService; these are small local equivalents.
import { GOOGLE_MAPS_API_KEY } from "../../config";

// Google encoded polyline -> [{lat, lng}]
export function decodePolyline(encoded) {
  const points = [];
  if (!encoded || typeof encoded !== "string") return points;
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export function normEncodedPolyline(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.points || value.encodedPath || "";
}

// Spherical distance in meters (same radius as google.maps.geometry.spherical).
export function distanceMeters(a, b) {
  const R = 6378137;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceToPathMeters(path, point) {
  if (!path?.length || !point) return Infinity;
  let min = Infinity;
  for (const pt of path) {
    if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) continue;
    const d = distanceMeters(point, pt);
    if (d < min) min = d;
  }
  return min;
}

export function findClosestPointIndex(path, point) {
  if (!path || path.length === 0 || !point) return 0;
  let min = Infinity;
  let idx = 0;
  for (let i = 0; i < path.length; i += 1) {
    const d = distanceMeters(path[i], point);
    if (d < min) {
      min = d;
      idx = i;
    }
  }
  return idx;
}

export function calcHeading(lat1, lon1, lat2, lon2) {
  const l1 = Number(lat1);
  const ln1 = Number(lon1);
  const l2 = Number(lat2);
  const ln2 = Number(lon2);
  if (![l1, ln1, l2, ln2].every(Number.isFinite)) return 0;
  const lat1Rad = (l1 * Math.PI) / 180;
  const lat2Rad = (l2 * Math.PI) / 180;
  const dLon = ((ln2 - ln1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function getHeadingFromRoutePath(path, point) {
  if (!path || path.length < 2 || !point) return null;
  const idx = findClosestPointIndex(path, point);
  let a;
  let b;
  if (idx < path.length - 1) {
    a = path[idx];
    b = path[idx + 1];
  } else if (idx > 0) {
    a = path[idx - 1];
    b = path[idx];
  } else {
    return null;
  }
  return calcHeading(a.lat, a.lng, b.lat, b.lng);
}

export function resolveRiderHeading(dataHeading, prevPos, newLat, newLng, routePath) {
  const rawHead = Number(dataHeading);
  let head = Number.isFinite(rawHead) && rawHead !== 0 ? rawHead : null;
  if (head === null && prevPos && Number.isFinite(prevPos.lat) && Number.isFinite(prevPos.lng)) {
    const dist = distanceMeters(prevPos, { lat: newLat, lng: newLng });
    if (dist > 1.5) {
      head = calcHeading(prevPos.lat, prevPos.lng, newLat, newLng);
    } else if (Number.isFinite(prevPos.heading) && prevPos.heading !== 0) {
      head = prevPos.heading;
    }
  }
  if ((head === null || head === 0) && routePath && routePath.length > 1) {
    const pathHead = getHeadingFromRoutePath(routePath, { lat: newLat, lng: newLng });
    if (Number.isFinite(pathHead)) head = pathHead;
  }
  return head ?? prevPos?.heading ?? 0;
}

/**
 * Driving route between two points (the web's DirectionsService, via the Directions REST API).
 * Resolves to {path: [{lat, lng}], durationText} or null.
 */
export async function fetchDrivingRoute(origin, destination) {
  if (!GOOGLE_MAPS_API_KEY || !origin || !destination) return null;
  const url =
    "https://maps.googleapis.com/maps/api/directions/json" +
    `?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}` +
    `&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json?.status !== "OK") return null;
    const route = json.routes?.[0];
    return {
      path: decodePolyline(route?.overview_polyline?.points),
      durationText: route?.legs?.[0]?.duration?.text || null,
    };
  } catch {
    return null;
  }
}
