// Helpers ported from Frontend/src/modules/Food/utils (foodVariants.js, restaurantAvailability.js,
// common.js) and the inline helpers of RestaurantDetails.jsx.
import { resolveMediaUrl } from "../../components/ui";
import { ASSET_ORIGIN } from "../../config";

export const RUPEE = "₹";

// Public web origin used in share links (window.location.origin on web).
export const WEB_ORIGIN = ASSET_ORIGIN;

// ---- foodVariants.js ----
const toArray = (value) => (Array.isArray(value) ? value : []);

export const normalizeFoodVariants = (value) =>
  toArray(value)
    .map((entry = {}, index) => {
      const id = String(entry?.id || entry?._id || `variant-${index}`);
      const name = String(entry?.name || "").trim();
      const price = Number(entry?.price);
      if (!name || !Number.isFinite(price) || price <= 0) return null;
      return { id, _id: id, name, price };
    })
    .filter(Boolean);

export const getFoodVariants = (item = {}) => normalizeFoodVariants(item?.variants || item?.variations || []);
export const hasFoodVariants = (item = {}) => getFoodVariants(item).length > 0;
export const getDefaultFoodVariant = (item = {}) => getFoodVariants(item)[0] || null;

export const getFoodDisplayPrice = (item = {}) => {
  const variants = getFoodVariants(item);
  if (variants.length > 0) return Math.min(...variants.map((v) => Number(v.price) || 0));
  const price = Number(item?.price);
  return Number.isFinite(price) ? price : 0;
};

export const getFoodPriceLabel = (item = {}) => {
  const price = getFoodDisplayPrice(item);
  return hasFoodVariants(item) ? `Starting from ${RUPEE}${Math.round(price)}` : `${RUPEE}${Math.round(price)}`;
};

// ---- common.js ----
export const normalizeImageUrl = (value) => {
  if (typeof value !== "string") return "";
  return resolveMediaUrl(value) || "";
};

export const extractImages = (source) => {
  if (!source) return [];
  const normalize = (val) => {
    if (!val) return "";
    if (typeof val === "string") return normalizeImageUrl(val);
    if (Array.isArray(val)) return val.length === 0 ? "" : normalize(val[0]);
    if (typeof val === "object") {
      const src = val.url || val.secure_url || val.imageUrl || val.image || val.src || "";
      return typeof src === "string" ? normalizeImageUrl(src) : "";
    }
    return "";
  };
  const candidates = Array.isArray(source) ? source.map(normalize) : [normalize(source)];
  return candidates.filter(Boolean);
};

// Haversine with the web's 1.35 routing multiplier.
export const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1.35;
};

export const formatDistanceKm = (km) =>
  km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`;

export { getRestaurantAvailabilityStatus } from "../../components/restaurant-cards/restaurantAvailability";

// ---- RestaurantDetails.jsx helpers ----
export const buildCartLineId = (itemId, variantId = "") => `${String(itemId || "")}::${String(variantId || "base")}`;

export const isRecommendedItem = (item) =>
  Boolean(item?.isRecommended || item?.recommended || item?.isPopular || item?.popular || item?.isBestseller);

export const isRecommendedSection = (section) => {
  const name = section?.name || section?.title || "";
  if (typeof name !== "string") return false;
  const n = name.trim().toLowerCase();
  return n === "recommended for you" || n === "result for your search";
};

export const getSectionDisplayName = (section) => {
  if (isRecommendedSection(section)) return "Recommended for you";
  if (section?.name && typeof section.name === "string" && section.name.trim()) return section.name.trim();
  if (section?.title && typeof section.title === "string" && section.title.trim()) return section.title.trim();
  return "Unnamed Section";
};

export const normalizeMenuCategoryId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const toRenderableArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.values(value).filter((entry) => entry && typeof entry === "object");
};

export const getSectionCategoryImage = (section) => {
  const direct = typeof section?.image === "string" ? section.image.trim() : "";
  if (direct) return direct;
  const first = toRenderableArray(section?.items).find((i) => typeof i?.image === "string" && i.image.trim())?.image;
  if (first) return first;
  return (
    toRenderableArray(section?.subsections)
      .flatMap((sub) => toRenderableArray(sub?.items))
      .find((i) => typeof i?.image === "string" && i.image.trim())?.image || ""
  );
};

// Item-specific discount, restaurant discount rules and the global discount: the best one wins.
export const calculateBestDiscount = (restaurant, item, priceNum) => {
  let bestAmount = 0;
  let bestValue = 0;
  let bestFlat = false;
  const itemDiscount = (restaurant?.itemDiscounts || []).find((d) => String(d.itemId) === String(item.id || item._id));
  if (itemDiscount) {
    const value = itemDiscount.discountValue || 0;
    const flat = String(itemDiscount.discountType || "").toUpperCase() === "FLAT";
    const amount = flat ? value : (priceNum * value) / 100;
    if (amount > bestAmount) {
      bestAmount = amount;
      bestValue = value;
      bestFlat = flat;
    }
  }
  const rule = (restaurant?.discountRules || []).find((r) => {
    const val = Number(r.conditionValue);
    if (r.conditionType === "PRICE_ABOVE" && priceNum > val) return true;
    if (r.conditionType === "PRICE_BELOW" && priceNum < val) return true;
    return false;
  });
  if (rule) {
    const value = rule.discountValue || 0;
    const amount = (priceNum * value) / 100;
    if (amount > bestAmount) {
      bestAmount = amount;
      bestValue = value;
      bestFlat = false;
    }
  }
  const global = Number(restaurant?.discount || 0);
  if (global > 0) {
    const amount = (priceNum * global) / 100;
    if (amount > bestAmount) {
      bestAmount = amount;
      bestValue = global;
      bestFlat = false;
    }
  }
  return { discountValue: bestValue, isFlatDiscount: bestFlat, discountAmount: bestAmount };
};

export const getFinalPrice = (restaurant, item) => {
  let priceNum = item.price || 0;
  if (typeof priceNum === "string") {
    const parsed = parseFloat(priceNum.replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(parsed)) priceNum = parsed;
  }
  const { discountAmount } = calculateBestDiscount(restaurant, item, priceNum);
  return discountAmount > 0 ? Math.max(0, priceNum - discountAmount) : Math.max(0, priceNum);
};

export function formatRestaurantAddress(loc) {
  if (!loc) return "Location";
  if (typeof loc === "string") return loc;
  const isCoords = (s) => /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(s.trim());
  const stripPlusCode = (s) => s.replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, "");
  const fa = typeof loc.formattedAddress === "string" ? loc.formattedAddress.trim() : "";
  if (fa && fa !== "Select location" && !isCoords(fa)) {
    if (/\b\d{6}\b/.test(fa) || fa.split(",").length >= 3) return stripPlusCode(fa);
  }
  const parts = [];
  const push = (v) => {
    if (v && String(v).trim() !== "") parts.push(String(v).trim());
  };
  push(loc.addressLine1);
  push(loc.addressLine2);
  push(loc.area);
  push(loc.city);
  push(loc.state);
  push(loc.pincode || loc.zipCode || loc.postalCode);
  if (parts.length >= 2) return parts.join(", ");
  if (fa && fa !== "Select location" && !isCoords(fa)) return stripPlusCode(fa);
  if (typeof loc.address === "string" && loc.address.trim()) return loc.address.trim();
  return loc.area || loc.city || "Location";
}
