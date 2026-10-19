import { ASSET_ORIGIN } from "../config";

// Backend uploads come back as "/uploads/x.webp" when Cloudinary is off.
export function resolveAssetUrl(url) {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^(https?:|data:|file:|content:|blob:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${ASSET_ORIGIN}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

// profileImage is `{url}` on the restaurant list but a plain string elsewhere.
export function resolveImage(value) {
  if (!value) return null;
  if (typeof value === "string") return resolveAssetUrl(value);
  if (typeof value === "object" && typeof value.url === "string") return resolveAssetUrl(value.url);
  return null;
}
