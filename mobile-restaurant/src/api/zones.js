// Zones (public). Web: zoneAPI.getPublicZones/detectZone via userClient (Onboarding, EditOwner, ZoneSetup).
import { api } from "./client";

// GET /food/zones/public -> the zone list
export function getPublicZones(params = {}, config = {}) {
  return api.get("/food/zones/public", { params: params ?? {}, skipAuthRefresh: true, ...config });
}

// GET /food/zones/detect?lat&lng -> data {status: IN_SERVICE | OUT_OF_RADIUS | OUT_OF_ZONE, zoneId, zone}
export function detectZone(lat, lng) {
  return api.get("/food/zones/detect", { params: { lat, lng }, skipAuthRefresh: true });
}
