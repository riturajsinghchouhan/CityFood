// Go-online prerequisites from the web (DeliveryHomeV2 toggle + PhotoUploadModal):
//   1. a live GPS fix (getCurrentPosition, high accuracy, 10 s timeout) — else "Please enable your GPS
//      for current location";
//   2. a FRONT-camera selfie, JPEG quality 0.7, sent as RAW base64 (no data: prefix);
//   3. the shift-start address: Google Geocoding -> (native geocoder) -> Nominatim -> "lat, lng".
// Then DeliveryContext.goOnline({selfieBase64, address, coords}) PATCHes availability.
// Not reproducible: the web's FaceDetector "align your face" check (Chrome-only API with a 2.5 s fake
// fallback). The system camera UI is used instead; the screen may add its own confirmation.
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { GOOGLE_MAPS_API_KEY } from "../config";

const GPS_TIMEOUT_MS = 10000;

function withTimeout(promise, ms, code) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(code), { code })), ms)),
  ]);
}

/**
 * Step 1. Asks for foreground permission if needed and returns {lat, lng, heading, accuracy}.
 * Throws Error with code "PERMISSION_DENIED" | "SERVICES_DISABLED" | "TIMEOUT" | "UNAVAILABLE".
 */
export async function getCurrentFix() {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== "granted") ({ status } = await Location.requestForegroundPermissionsAsync());
  if (status !== "granted") throw Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" });
  if (!(await Location.hasServicesEnabledAsync().catch(() => true))) {
    throw Object.assign(new Error("SERVICES_DISABLED"), { code: "SERVICES_DISABLED" });
  }
  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      GPS_TIMEOUT_MS,
      "TIMEOUT",
    );
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      heading: pos.coords.heading || 0,
      accuracy: pos.coords.accuracy ?? null,
    };
  } catch (err) {
    if (err?.code === "TIMEOUT") throw err;
    throw Object.assign(new Error("UNAVAILABLE"), { code: "UNAVAILABLE", cause: err });
  }
}

/**
 * Step 2. Opens the front camera. Resolves {base64, uri} (base64 = raw JPEG q0.7) or null when the
 * rider cancels. Throws Error("CAMERA_PERMISSION") when the camera is denied.
 */
export async function captureShiftSelfie() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") throw Object.assign(new Error("CAMERA_PERMISSION"), { code: "CAMERA_PERMISSION" });
  const result = await ImagePicker.launchCameraAsync({
    cameraType: ImagePicker.CameraType.front,
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
    allowsEditing: false,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  return { base64: String(asset.base64).replace(/^data:[^,]+,/, ""), uri: asset.uri };
}

/** Step 3. Human-readable address for the shift start (never throws). */
export async function resolveShiftAddress(lat, lng) {
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const data = await res.json();
      if (data?.results?.[0]?.formatted_address) return data.results[0].formatted_address;
    } catch {
      // fall through
    }
  }
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const text =
      place?.formattedAddress ||
      [place?.name, place?.street, place?.district, place?.city, place?.region, place?.postalCode]
        .filter(Boolean)
        .join(", ");
    if (text) return text;
  } catch {
    // fall through
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "CityFoodDelivery/1.0 (com.cityfood.delivery)" } },
    );
    const data = await res.json();
    if (data?.display_name) return data.display_name;
  } catch {
    // fall through
  }
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}
