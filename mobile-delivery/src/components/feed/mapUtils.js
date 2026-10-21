// LiveMap helpers: the web's DirectionsService (Directions REST API), polyline decoding and the
// google.maps.geometry distance it used; plus the Google Maps links the trip cards open.
import { Linking } from "react-native";
import { GOOGLE_MAPS_API_KEY } from "../../config";
import { getHaversineDistance, parseLatLng } from "../../lib/delivery/geo";

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

export const distanceM = (a, b) => getHaversineDistance(a.lat, a.lng, b.lat, b.lng);

/**
 * DRIVING route (DirectionsService). Resolves {path:[{lat,lng}], polyline:"<encoded>"} or null
 * (failure counts as "fetched" for the throttle, as on web).
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
    const encoded = json.routes?.[0]?.overview_polyline?.points || "";
    const path = decodePolyline(encoded);
    return path.length ? { path, polyline: encoded } : null;
  } catch {
    return null;
  }
}

// LiveMap parsePoint: GeoJSON coordinates / {lat,lng} / {latitude,longitude}, also under .location.
export function parsePoint(raw) {
  if (!raw) return null;
  const nested = raw.location && typeof raw.location === "object" ? raw.location : null;
  const c = nested || raw;
  const coords = Array.isArray(c?.coordinates)
    ? c.coordinates
    : Array.isArray(c?.location?.coordinates)
      ? c.location.coordinates
      : null;
  if (coords?.length >= 2) {
    const lng = parseFloat(coords[0]);
    const lat = parseFloat(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const lat = parseFloat(c?.lat ?? c?.latitude ?? c?.location?.lat ?? c?.location?.latitude);
  const lng = parseFloat(c?.lng ?? c?.longitude ?? c?.location?.lng ?? c?.location?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

const open = (url) => Linking.openURL(url).catch(() => {});

export function openUrl(url) {
  if (url) open(url);
}

export function callPhone(number) {
  if (number) open(`tel:${number}`);
}

// PickupActionModal openRestaurantInMaps
export function openRestaurantInMaps(order, address) {
  const coords =
    parseLatLng(order?.restaurantLocation) ||
    parseLatLng(order?.restaurantId?.location) ||
    parseLatLng(order?.restaurant_location);
  if (coords) {
    open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`);
    return;
  }
  open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`);
}

// DeliveryHomeV2 openCustomerDropInMaps
export function openCustomerDropInMaps(order) {
  if (!order) return;
  const customer =
    parseLatLng(order.customerLocation) ||
    parseLatLng(order.customer_location) ||
    parseLatLng(order.deliveryAddress?.location) ||
    parseLatLng(order.deliveryAddress);
  const restaurant =
    parseLatLng(order.restaurantLocation) ||
    parseLatLng(order.restaurant_location) ||
    parseLatLng(order.restaurantId?.location) ||
    parseLatLng(order.restaurantId);
  if (customer && restaurant) {
    open(
      `https://www.google.com/maps/dir/?api=1&origin=${restaurant.lat},${restaurant.lng}&destination=${customer.lat},${customer.lng}&travelmode=driving`,
    );
    return;
  }
  if (customer) {
    open(`https://www.google.com/maps/dir/?api=1&destination=${customer.lat},${customer.lng}&travelmode=driving`);
    return;
  }
  const a = order.deliveryAddress || {};
  const address =
    order.customerAddress ||
    a.street ||
    [a.street, a.additionalDetails, a.city, a.state].filter(Boolean).join(", ") ||
    "Customer Location";
  open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
}
