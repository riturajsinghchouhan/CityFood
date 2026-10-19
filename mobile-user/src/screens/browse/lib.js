// Helpers for the browse screens (Under250, CategoryPage, ProfessionalSearch).
// Ports of utils/menuItems.js and the inline helpers of the three web pages.
import { getFoodDisplayPrice, getFoodVariants } from "../restaurant/lib";

export { calculateDistanceKm, extractImages, formatDistanceKm, normalizeImageUrl } from "../restaurant/lib";

export const RUPEE = "₹";

// utils/menuItems.js getMenuFromResponse. API functions return the body, so data.menu.
export const getMenuFromResponse = (response) => response?.data?.menu || response?.menu || null;

const normalizeItem = (item = {}, sectionName = "", subsectionName = "") => ({
  ...item,
  id: String(item?.id || item?._id || ""),
  sectionName,
  subsectionName,
  image: item?.image || item?.images?.[0] || "",
  name: item?.name || "Unnamed Item",
  category: item?.category || sectionName || "Varieties",
  foodType: item?.foodType || "Non-Veg",
  price: getFoodDisplayPrice(item),
  rating: Number(item?.rating || 0),
  reviews: Number(item?.reviews || 0),
  stock: item?.stock || "Unlimited",
  approvalStatus: item?.approvalStatus || "pending",
  isAvailable: item?.isAvailable !== false,
  variants: getFoodVariants(item),
  variations: getFoodVariants(item),
});

export const flattenMenuItems = (menu) => {
  if (!menu || !Array.isArray(menu.sections)) return [];
  const items = [];
  menu.sections.forEach((section = {}) => {
    const sectionName = section?.name || "Unknown Section";
    (section?.items || []).forEach((item = {}) => {
      items.push(normalizeItem(item, sectionName, ""));
    });
    (section?.subsections || []).forEach((subsection = {}) => {
      const subsectionName = subsection?.name || "Unknown Subsection";
      (subsection?.items || []).forEach((item = {}) => {
        items.push(normalizeItem(item, sectionName, subsectionName));
      });
    });
  });
  return items;
};

// Under250.jsx: item-specific discount, then smart rules, else the restaurant discount (%).
export const getUnder250DiscountPercent = (restaurant, item) => {
  let discountPercentage = restaurant?.discount || 0;
  const specific = (restaurant?.itemDiscounts || []).find((d) => String(d.itemId) === String(item?.id || item?._id));
  if (specific) {
    discountPercentage = specific.discountValue || 0;
  } else {
    const rule = (restaurant?.discountRules || []).find((r) => {
      const val = Number(r.conditionValue);
      if (r.conditionType === "PRICE_ABOVE" && item.price > val) return true;
      if (r.conditionType === "PRICE_BELOW" && item.price < val) return true;
      return false;
    });
    if (rule) discountPercentage = rule.discountValue || 0;
  }
  return discountPercentage;
};

export const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
