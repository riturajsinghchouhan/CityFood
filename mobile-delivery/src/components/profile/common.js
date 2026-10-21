// Shared bits of the DeliveryV2 profile pages: deliveryTheme.css card rule, the web's error-message
// fallbacks (err.response.data.message / shared/utils/uploadErrors.js), image picking for the profile
// photo and the UPI QR (web <input type=file accept="image/*" capture="environment">), and a few
// Tailwind v4 colours the theme tokens do not list.
import * as ImagePicker from "expo-image-picker";
import { brand } from "../../theme/tokens";

export const twp = {
  purple50: "#faf5ff",
  purple100: "#f3e8ff",
  purple300: "#dab2ff",
  purple400: "#c27aff",
  purple600: "#9810fa",
  blue200: "#bedbff",
  blue700: "#1447e6",
  red200: "#ffc9c9",
  red100: "#ffe2e2",
  blue50: "#eff6ff",
  orange500: "#ff6900",
};

// deliveryTheme.css: [class~=rounded-2xl], [class~=rounded-3xl] get this shadow and --dv-border.
export const dvCard = { borderColor: brand.dvBorder, ...brand.cardShadow };

// deliveryTheme.css forces every input/textarea/select: border #e8dee7, white background, --dv-text.
export const dvInput = { borderColor: brand.inputBorder, backgroundColor: "#ffffff", color: brand.text };
export const FOCUS_RING = "0px 0px 0px 4px rgba(21,73,139,0.15)";

// web: err?.response?.data?.message || fallback
export function serverMessage(err, fallback) {
  const msg = err?.data?.message;
  return typeof msg === "string" && msg ? msg : fallback;
}

const MAX_MB = 5;
const SIZE_RE = /(file size|too large|max(?:imum)?(?: allowed)?(?: file)? size|limit exceeded)/i;
const TYPE_RE = /(invalid file type|only .* allowed|unsupported media type|mime|format not supported)/i;

// shared/utils/uploadErrors.js getUploadErrorMessage
export function uploadErrorMessage(err, fallback = "Failed to upload image.") {
  const status = Number(err?.status || 0);
  const candidates = [err?.data?.message, err?.data?.error, err?.message]
    .filter(Boolean)
    .map((v) => String(v).trim());
  for (const message of candidates) {
    if (SIZE_RE.test(message) || message.includes("LIMIT_FILE_SIZE")) return `Image size should be less than ${MAX_MB}MB.`;
    if (TYPE_RE.test(message)) return "Invalid image format. Please upload JPG, PNG, WEBP, or GIF.";
  }
  if (status === 413) return `Image size should be less than ${MAX_MB}MB.`;
  if (status === 415) return "Invalid image format. Please upload JPG, PNG, WEBP, or GIF.";
  if (status >= 500) return "Upload failed on the server. Please try again.";
  return candidates.length > 0 ? candidates[0] : fallback;
}

// shared/utils/uploadErrors.js getImageValidationError
export function imageValidationError(file) {
  if (!file) return "Please select an image file";
  if (!String(file.type || "").startsWith("image/")) return "Please select a valid image file.";
  if (Number(file.size || 0) > MAX_MB * 1024 * 1024) return `Image size should be less than ${MAX_MB}MB.`;
  return "";
}

/**
 * Opens the rear camera ("camera") or the gallery ("gallery"). Resolves to null when cancelled,
 * {error} when the camera permission is refused, or {file: {uri, name, type, size}}.
 */
export async function pickImage(source, baseName = "photo") {
  let result;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { error: "Camera permission is required to take a photo." };
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  }
  const asset = result?.canceled ? null : result?.assets?.[0];
  if (!asset?.uri) return null;
  const type = asset.mimeType || "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  return { file: { uri: asset.uri, name: `${baseName}-${Date.now()}.${ext}`, type, size: asset.fileSize || 0 } };
}
