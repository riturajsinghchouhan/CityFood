// Port of Frontend/src/shared/utils/uploadErrors.js for picker assets and ApiError.
const FILE_SIZE_LIMIT_RE = /(file size|too large|max(?:imum)?(?: allowed)?(?: file)? size|limit exceeded)/i;
const INVALID_TYPE_RE = /(invalid file type|only .* allowed|unsupported media type|mime|format not supported)/i;

export const DEFAULT_IMAGE_UPLOAD_LIMIT_MB = 5;

// expo-image-picker asset: mimeType / fileSize (type is "image" | "video").
export function assetMimeType(asset) {
  if (!asset) return "";
  if (asset.mimeType) return String(asset.mimeType);
  if (typeof asset.type === "string" && asset.type.includes("/")) return asset.type;
  if (asset.type === "image") return "image/jpeg";
  return "";
}

export function getImageValidationError(asset, { maxSizeMb = DEFAULT_IMAGE_UPLOAD_LIMIT_MB } = {}) {
  if (!asset) return "Please select an image file";
  if (!assetMimeType(asset).startsWith("image/")) return "Please select a valid image file.";
  if (Number(asset.fileSize || asset.size || 0) > maxSizeMb * 1024 * 1024) {
    return `Image size should be less than ${maxSizeMb}MB.`;
  }
  return "";
}

export function getUploadErrorMessage(error, { fallback = "Failed to upload image.", maxSizeMb = DEFAULT_IMAGE_UPLOAD_LIMIT_MB } = {}) {
  const status = Number(error?.status || 0);
  const candidates = [error?.data?.message, error?.data?.error, error?.message]
    .filter(Boolean)
    .map((value) => String(value).trim());

  for (const message of candidates) {
    if (FILE_SIZE_LIMIT_RE.test(message) || message.includes("LIMIT_FILE_SIZE")) {
      return `Image size should be less than ${maxSizeMb}MB.`;
    }
    if (INVALID_TYPE_RE.test(message)) {
      return "Invalid image format. Please upload JPG, PNG, WEBP, or GIF.";
    }
  }

  if (status === 413) return `Image size should be less than ${maxSizeMb}MB.`;
  if (status === 415) return "Invalid image format. Please upload JPG, PNG, WEBP, or GIF.";
  if (status >= 500) return "Upload failed on the server. Please try again.";

  return candidates.length > 0 ? candidates[0] : fallback;
}
