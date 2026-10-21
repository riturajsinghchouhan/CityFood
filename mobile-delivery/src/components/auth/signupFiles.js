// SignupStep2 photo persistence. The web compresses each photo to a WebP data URL and keeps it in
// IndexedDB ("DeliverySignupFiles") so a reload does not lose it; here each picked photo is copied
// into the app's document directory and its {uri, name, type} is kept in deliverySignupDocs.
import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";

export const DOC_TYPES = [
  "profilePhoto",
  "aadharFrontPhoto",
  "aadharBackPhoto",
  "panPhoto",
  "drivingLicenseFrontPhoto",
  "drivingLicenseBackPhoto",
  "rcPhoto",
];

// File names sent in the multipart body (web: profile.webp, aadhar_front.webp, ...).
export const DOC_FILE_NAMES = {
  profilePhoto: "profile",
  aadharFrontPhoto: "aadhar_front",
  aadharBackPhoto: "aadhar_back",
  panPhoto: "pan",
  drivingLicenseFrontPhoto: "dl_front",
  drivingLicenseBackPhoto: "dl_back",
  rcPhoto: "rc",
};

export const emptyDocs = () => Object.fromEntries(DOC_TYPES.map((k) => [k, null]));

const MAX_SIZE_MB = 5;
const QUALITY = 0.8;

function signupDir() {
  const dir = new Directory(Paths.document, "delivery-signup");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

// getImageValidationError (shared/utils/uploadErrors.js): images only, 5 MB max.
function validationError(asset) {
  const mime = asset.mimeType || "";
  if (mime && !mime.startsWith("image/")) return "Please select a valid image file.";
  if (Number(asset.fileSize || 0) > MAX_SIZE_MB * 1024 * 1024) return `Image size should be less than ${MAX_SIZE_MB}MB.`;
  return "";
}

/**
 * Opens the camera ("camera") or the gallery ("gallery"). Resolves to null when cancelled, or
 * {error} / {doc: {uri, name, type}} after copying the photo into the signup folder.
 */
export async function pickSignupPhoto(docType, source) {
  let result;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { error: "Camera permission is required to take a photo." };
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: QUALITY });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: QUALITY });
  }
  const asset = result?.canceled ? null : result?.assets?.[0];
  if (!asset?.uri) return null;
  const error = validationError(asset);
  if (error) return { error };

  const ext = (asset.mimeType || "").includes("png") ? "png" : "jpg";
  const target = new File(signupDir(), `${docType}-${Date.now()}.${ext}`);
  new File(asset.uri).copySync(target);
  return {
    doc: {
      uri: target.uri,
      name: `${DOC_FILE_NAMES[docType] || docType}.${ext}`,
      type: ext === "png" ? "image/png" : "image/jpeg",
    },
  };
}

export function deleteSignupPhoto(doc) {
  if (!doc?.uri) return;
  try {
    const f = new File(doc.uri);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}

// Saved docs whose file still exists (the web's IndexedDB hydrate).
export function hydrateSignupDocs(saved) {
  const docs = emptyDocs();
  if (!saved || typeof saved !== "object") return docs;
  DOC_TYPES.forEach((k) => {
    const d = saved[k];
    if (!d?.uri) return;
    try {
      if (new File(d.uri).exists) docs[k] = d;
    } catch {
      // unreadable: treat as not uploaded
    }
  });
  return docs;
}

// clearAllFilesFromDB
export function clearSignupPhotos() {
  try {
    const dir = new Directory(Paths.document, "delivery-signup");
    if (dir.exists) dir.delete();
  } catch {
    // nothing to clear
  }
}
