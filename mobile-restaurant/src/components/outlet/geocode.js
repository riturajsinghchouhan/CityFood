// ZoneSetup's google.maps.Geocoder reverse lookups, over the Geocoding REST API with the app key
// (the web calls Google straight from the browser too). Resolves to the formatted address or null,
// matching the web's "status OK && results[0]" check; callers fall back to "lat, lng".
import { GOOGLE_MAPS_API_KEY } from "../../config";

export async function reverseGeocode(lat, lng) {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json?.status === "OK" && json.results?.[0]?.formatted_address) return json.results[0].formatted_address;
    return null;
  } catch {
    return null;
  }
}

// Google Places details for a search suggestion: {lat, lng, address} (ZoneSetup's place_changed).
export async function getPlaceLocation(placeId) {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=formatted_address,name,geometry&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const place = json?.result;
    const loc = place?.geometry?.location;
    if (json?.status !== "OK" || !loc) return null;
    return { lat: Number(loc.lat), lng: Number(loc.lng), address: place.formatted_address || place.name || "" };
  } catch {
    return null;
  }
}
