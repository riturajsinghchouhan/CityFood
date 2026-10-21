// Zones (public). Web: zoneAPI.getPublicZones (SignupStep1, LiveMap; audit #8) and
// deliveryAPI.getZonesInRadius (§2.11, unused by DV2 but working).
import { api } from "./client";

// GET /food/zones/public -> {zones[]} (signup zone picker, map polygons)
export function getPublicZones(params = {}, config = {}) {
  return api.get("/food/zones/public", { params: params ?? {}, skipAuthRefresh: true, ...config });
}

// GET /food/zones/nearby?lat&lng&radius (km)
export function getZonesInRadius(lat, lng, radiusKm = 10) {
  return api.get("/food/zones/nearby", { params: { lat, lng, radius: radiusKm } });
}
