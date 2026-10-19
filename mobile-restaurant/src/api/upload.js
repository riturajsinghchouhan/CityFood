// Multipart helpers and the generic /uploads endpoints. Web: uploadAPI.uploadMedia/uploadFile
// (Frontend/src/services/api/index.js). React Native's FormData takes {uri, name, type} file
// objects; the shared client drops the JSON Content-Type so the boundary is set natively.
// The web's "/uploads/single" fallback is a 404 in production and is not ported.
import { UPLOAD_TIMEOUT_MS } from "../config";
import { api } from "./client";

const EXT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  pdf: "application/pdf",
};

// Accepts an expo-image-picker / document-picker asset or a ready {uri, name, type}.
export function toUploadFile(asset) {
  if (!asset?.uri) throw new Error("File is required");
  const fromUri = asset.uri.split("?")[0].split("/").pop() || "";
  const name = asset.name || asset.fileName || fromUri || `upload-${Date.now()}.jpg`;
  const ext = (name.split(".").pop() || "").toLowerCase();
  const type = asset.type && asset.type.includes("/")
    ? asset.type
    : asset.mimeType || EXT_TYPES[ext] || (asset.type === "image" ? "image/jpeg" : "application/octet-stream");
  return { uri: asset.uri, name, type };
}

// fields: {name: string | {uri,name,type} | Array<{uri,name,type}>}. Arrays append one part each
// (multer upload.array / upload.fields with maxCount > 1). null/undefined fields are skipped.
export function buildFormData(fields = {}) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((v) => formData.append(key, v));
      return;
    }
    formData.append(key, typeof value === "boolean" || typeof value === "number" ? String(value) : value);
  });
  return formData;
}

export function postMultipart(url, fields, config = {}) {
  return api.post(url, buildFormData(fields), { timeout: UPLOAD_TIMEOUT_MS, ...config });
}

/**
 * POST /uploads/image (unauthenticated). file: picker asset or {uri,name,type}.
 * options.folder: "food/categories" | "tuggo/restaurant/addons" | "food/restaurants/{profile,pan,gst,fssai,upi-qr}" | ...
 * data: {url, publicId:null}. A relative url ("/uploads/x.webp") needs resolveAssetUrl for display.
 */
export function uploadMedia(file, options = {}) {
  if (!file) return Promise.reject(new Error("File is required for upload"));
  return postMultipart("/uploads/image", { file: toUploadFile(file), folder: options.folder });
}

// POST /uploads/file (PDF only, unauthenticated). data: {url, publicId:null}
export function uploadFile(file, options = {}) {
  if (!file) return Promise.reject(new Error("File is required for upload"));
  return postMultipart("/uploads/file", { file: toUploadFile(file), folder: options.folder });
}
