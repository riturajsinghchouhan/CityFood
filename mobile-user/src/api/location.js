// Location and zones. Web: locationAPI.*, zoneAPI.*, userAPI.getLocation/updateLocation.
import { api } from "./client";

// Public. data: {results:[{formatted_address, address_components:{area, city, state, country, postal_code}}],
// location:{latitude, longitude, area, city, state, country, postalCode, formattedAddress, address, source}}
export function reverseGeocode(latitude, longitude) {
  return api.get("/food/location/reverse-geocode", {
    params: { lat: latitude, lng: longitude },
    skipAuthRefresh: true,
  });
}

// Body: {rider?, restaurant?, customer?: {lat, lng}} -> data.legs
export function computeDistance(body) {
  return api.post("/food/location/distance", body ?? {});
}

// Public. data: {status: IN_SERVICE | OUT_OF_RADIUS | OUT_OF_ZONE, zoneId, zone}
export function detectZone(lat, lng) {
  return api.get("/food/zones/detect", { params: { lat, lng }, skipAuthRefresh: true });
}

export function getPublicZones(params = {}, config = {}) {
  return api.get("/food/zones/public", { params: params ?? {}, ...config });
}

// Bearer. data.location: null | {latitude, longitude, address, formattedAddress, city, state, area, accuracy, updatedAt}
export function getLocation() {
  return api.get("/food/user/location");
}

// Bearer. Body: {latitude, longitude, address?, formattedAddress?, city?, state?, area?, accuracy?}
export function updateLocation(payload) {
  return api.put("/food/user/location", payload ?? {});
}
