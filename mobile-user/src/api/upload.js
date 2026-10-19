// Multipart helpers. React Native's FormData takes {uri, name, type} file objects;
// the shared client drops the JSON Content-Type so the boundary is set natively.
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

export function postMultipart(url, fields, config = {}) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, value);
  });
  return api.post(url, formData, { timeout: UPLOAD_TIMEOUT_MS, ...config });
}
