// Third-party address search the web Onboarding calls straight from the browser: Google Places
// autocomplete + details (the web loads the Maps JS "places" library; here the same Places API over
// REST with the app key), falling back to Nominatim when no key is configured.
import { GOOGLE_MAPS_API_KEY } from "../../../config";

const NOMINATIM_HEADERS = { Accept: "application/json", "User-Agent": "CityFood-Restaurant-App" };

export const hasGooglePlaces = Boolean(GOOGLE_MAPS_API_KEY);

// -> [{id, display, isGoogle:true}] or [{id, display, lat, lng, addr, isGoogle:false}]
export async function searchLocations(q) {
  if (hasGooglePlaces) {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:in&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json?.status === "OK" && Array.isArray(json.predictions)) {
      return json.predictions.map((p) => ({ id: p.place_id, display: p.description, isGoogle: true }));
    }
    // ZERO_RESULTS or an error: empty list, as the web's callback does.
    return [];
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}&countrycodes=in`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  const json = await res.json();
  return (Array.isArray(json) ? json : []).map((r) => ({
    id: String(r.place_id),
    display: r.display_name || "",
    lat: Number(r.lat),
    lng: Number(r.lon),
    addr: r.address || {},
    isGoogle: false,
  }));
}

// Google place -> parsed address fields (PlacesService.getDetails on web). Null on failure.
export async function getPlaceDetails(placeId, fallbackDisplay) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=formatted_address,address_components,geometry&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const place = json?.result;
    if (json?.status !== "OK" || !place) return null;
    const comps = Array.isArray(place.address_components) ? place.address_components : [];
    const get = (types) => comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || "";
    return {
      formattedAddress: place.formatted_address || fallbackDisplay,
      area: get(["sublocality_level_1", "sublocality", "neighborhood"]) || get(["locality"]),
      city: get(["locality"]) || get(["administrative_area_level_2"]),
      state: get(["administrative_area_level_1"]) || get(["administrative_area_level_2"]),
      pincode: get(["postal_code"]),
      latitude: place.geometry?.location?.lat ?? "",
      longitude: place.geometry?.location?.lng ?? "",
    };
  } catch {
    return null;
  }
}

// Nominatim suggestion -> parsed address fields.
export function parseNominatim(s) {
  const addr = s.addr || {};
  return {
    formattedAddress: s.display,
    area: addr.suburb || addr.neighbourhood || addr.city_district || addr.locality || "",
    city: addr.city || addr.town || addr.village || "",
    state: addr.state || "",
    pincode: addr.postcode || "",
    latitude: s.lat,
    longitude: s.lng,
  };
}
