// Third-party geocoding calls AddressSelectorPage.jsx makes straight from the browser:
// Google Geocoding (when a Maps key is set) and Nominatim. Same URLs and parsing as the web.
import { GOOGLE_MAPS_API_KEY } from "../../config";

export const DEFAULT_COORDS = [22.7196, 75.8577];

const NOMINATIM_HEADERS = { "Accept-Language": "en", "User-Agent": "CityFood-App" };

// Haversine distance in meters.
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Keyword search: Nominatim top 10, sorted by distance from the reference point, top 4 kept.
export async function searchPlaces(query, refLat, refLng) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": NOMINATIM_HEADERS["User-Agent"] } });
  const json = await res.json();
  return (Array.isArray(json) ? json : [])
    .map((r) => ({
      id: r.place_id || r.osm_id,
      display: r.display_name || "",
      lat: Number(r.lat),
      lng: Number(r.lon),
      address: r.address || {},
    }))
    .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng))
    .map((x) => ({ ...x, distanceMeters: distanceMeters(refLat, refLng, x.lat, x.lng) }))
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
    .slice(0, 4);
}

// Typed address -> coordinates: Google first, then Nominatim. Resolves null when nothing matches.
export async function forwardGeocodeAddress(query) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return null;
  try {
    if (GOOGLE_MAPS_API_KEY) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanQuery)}&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const data = await res.json();
      if (data.status === "OK" && data.results?.length > 0) {
        const loc = data.results[0].geometry?.location;
        if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
          return {
            lat: loc.lat,
            lng: loc.lng,
            formattedAddress: data.results[0].formatted_address,
            components: data.results[0].address_components || [],
          };
        }
      }
    }
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(cleanQuery)}`,
      { headers: NOMINATIM_HEADERS },
    );
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      const lat = Number(json[0].lat);
      const lng = Number(json[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, formattedAddress: json[0].display_name, address: json[0].address || {} };
      }
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Map center -> form fields (web handleMapMoveEnd). Resolves
 * {formatted, fields, merge} where `merge(prev)` returns the next form state, or null.
 */
export async function reverseGeocodeForForm(lat, lng) {
  try {
    if (GOOGLE_MAPS_API_KEY) {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await res.json();
      if (data.status === "OK" && data.results?.length > 0) {
        const result = data.results[0];
        const c = result.address_components || [];
        const find = (type) => c.find((x) => x.types.includes(type))?.long_name;
        const area = find("sublocality_level_1") || find("sublocality") || find("neighborhood") || "";
        const city = find("locality") || "";
        const state = find("administrative_area_level_1") || "";
        const zip = find("postal_code") || "";
        return {
          formatted: result.formatted_address,
          merge: (prev) => ({
            ...prev,
            street: result.formatted_address.split(",")[0] || "",
            additionalDetails: area,
            city,
            state,
            zipCode: zip,
          }),
        };
      }
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: NOMINATIM_HEADERS,
    });
    const json = await res.json();
    if (json && json.address) {
      const addr = json.address;
      const formatted = json.display_name;
      const street =
        [addr.road, addr.suburb, addr.neighbourhood, addr.house_number].filter(Boolean).slice(0, 2).join(", ") ||
        addr.amenity ||
        addr.industrial ||
        "";
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
      const state = addr.state || "";
      const postcode = addr.postcode || "";
      return {
        formatted,
        merge: (prev) => ({
          ...prev,
          street: street || formatted.split(",")[0] || prev.street,
          city: city || prev.city,
          state: state || prev.state,
          zipCode: postcode || prev.zipCode,
        }),
      };
    }
  } catch {
    // ignore, as on web
  }
  return null;
}
