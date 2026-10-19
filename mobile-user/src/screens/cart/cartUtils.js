// Pure helpers ported from Frontend/src/modules/Food/pages/user/cart/Cart.jsx and the parts of
// utils/restaurantAvailability.js the schedule picker needs.

export const RUPEE = "₹";

// Admin fee settings (GET /food/admin/fee-settings/public) need an admin token, so the web's call
// always fails for customers and Cart keeps these defaults. The native app never makes the call.
export const DEFAULT_FEE_SETTINGS = {
  deliveryFee: 0,
  deliveryFeeRanges: [],
  freeDeliveryUpTo: 0,
  freeDeliveryThreshold: 149,
  platformFee: 0,
  packagingFee: 0,
  gstRate: 0,
};

const looksLikeLatLng = (s) => {
  if (!s) return false;
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(String(s).trim());
};

export function formatFullAddress(address) {
  if (!address) return "";
  if (address.formattedAddress && address.formattedAddress !== "Select location") {
    if (!looksLikeLatLng(address.formattedAddress)) return address.formattedAddress;
  }
  const parts = [];
  if (address.street) parts.push(address.street);
  if (address.additionalDetails) parts.push(address.additionalDetails);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.zipCode) parts.push(address.zipCode);
  if (parts.length > 0) return parts.join(", ");
  if (address.address && address.address !== "Select location") return address.address;
  return "";
}

export const getAddressId = (address) => address?.id || address?._id || null;

export function normalizeLabel(label) {
  if (!label) return "";
  const value = String(label).trim().toLowerCase();
  if (value === "work" || value === "office") return "office";
  if (value === "home") return "home";
  if (value === "other") return "other";
  return value;
}

export function displayAddressLabel(label) {
  const normalized = normalizeLabel(label);
  if (normalized === "office") return "Work";
  if (normalized === "home") return "Home";
  if (normalized === "other") return "Other";
  return label || "Saved address";
}

export const sanitizeRecipientPhone = (value) => String(value || "").replace(/[^\d+]/g, "").slice(0, 14);

// Local YYYY-MM-DD (the web's toLocaleDateString("en-CA") / timezone-shifted ISO date).
export function localDateString(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}

// The cart line payload the web sends to /food/orders/calculate when applying or removing a coupon.
export function toPricingItems(cart, { withOriginalPrice = true, vegRule = "notFalse" } = {}) {
  return cart.map((item) => ({
    itemId: item.itemId || item.id,
    name: item.name,
    price: item.price,
    ...(withOriginalPrice ? { originalPrice: item.originalPrice ?? item.price } : {}),
    variantId: item.variantId || undefined,
    variantName: item.variantName || undefined,
    variantPrice: item.variantPrice || item.price,
    quantity: item.quantity || 1,
    image: item.image,
    description: item.description,
    isVeg: vegRule === "explicit" ? item.isVeg === true || item.foodType === "Veg" : item.isVeg !== false,
  }));
}

// ---- restaurantAvailability.js (opening/closing time resolution only) ----
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const normalizeDay = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  const match = DAY_NAMES.find((day) => day.toLowerCase() === trimmed);
  if (match) return match;
  return DAY_NAMES.find((day) => day.toLowerCase().startsWith(trimmed.slice(0, 3))) || null;
};

function getTodayTiming(restaurant, dayName) {
  const nested = restaurant?.outletTimings?.timings;
  if (Array.isArray(nested)) {
    const exact = nested.find((entry) => normalizeDay(entry?.day) === dayName);
    if (exact) return exact;
  }
  if (Array.isArray(restaurant?.outletTimings)) {
    const exact = restaurant.outletTimings.find((entry) => normalizeDay(entry?.day) === dayName);
    if (exact) return exact;
  }
  const obj = restaurant?.outletTimings;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const direct = obj[dayName];
    if (direct && typeof direct === "object") return direct;
  }
  return null;
}

// Same early returns as getRestaurantAvailabilityStatus: only an open restaurant reports its times.
function getOpeningWindow(restaurant, now) {
  if (!restaurant) return {};
  if (restaurant.isActive === false || restaurant.isAcceptingOrders === false) return {};
  const dayName = DAY_NAMES[now.getDay()];
  const todayTiming = getTodayTiming(restaurant, dayName);
  const openDays = Array.isArray(restaurant.openDays) ? restaurant.openDays : [];
  if (!todayTiming && openDays.length > 0) {
    const normalized = new Set(openDays.map((d) => normalizeDay(d)).filter(Boolean));
    if (normalized.size > 0 && !normalized.has(dayName)) return {};
  }
  if (todayTiming?.isOpen === false) return {};
  return {
    openingTime: todayTiming?.openingTime || restaurant?.deliveryTimings?.openingTime || restaurant?.openingTime || null,
    closingTime: todayTiming?.closingTime || restaurant?.deliveryTimings?.closingTime || restaurant?.closingTime || null,
  };
}

// Hourly slots between opening and closing for the chosen date (Cart.jsx availableTimeSlots).
export function buildTimeSlots(restaurant, scheduledDate) {
  if (!scheduledDate || !restaurant) return [];
  try {
    const status = getOpeningWindow(restaurant, new Date(scheduledDate));
    let openingHour = 9;
    let closingHour = 22;
    if (status.openingTime) openingHour = parseInt(status.openingTime.split(":")[0], 10);
    if (status.closingTime) closingHour = parseInt(status.closingTime.split(":")[0], 10);
    if (closingHour < openingHour) closingHour += 24;
    const slots = [];
    const now = new Date();
    const isToday = scheduledDate === localDateString(now);
    const currentHour = now.getHours();
    for (let h = openingHour; h <= closingHour; h += 1) {
      const actualHour = h % 24;
      if (isToday && h <= currentHour) continue;
      const period = actualHour >= 12 ? "PM" : "AM";
      const display12 = actualHour % 12 || 12;
      slots.push({ value: `${String(actualHour).padStart(2, "0")}:00`, label: `${display12}:00 ${period}` });
    }
    return slots;
  } catch {
    return [];
  }
}

// Per-line display price with restaurant discounts for older cart entries (Cart.jsx item rows).
export function getLineDisplayPrices(item, restaurantData) {
  const storedPrice = Number(item.price) || 0;
  const originalDisplayPrice = Math.max(storedPrice, Number(item.originalPrice) || 0);
  let displayPrice = storedPrice;
  let bestDiscountAmount = 0;

  if (originalDisplayPrice <= storedPrice && restaurantData?.itemDiscounts?.length > 0) {
    const rule = restaurantData.itemDiscounts.find((r) => String(r.itemId) === String(item.itemId || item.id));
    if (rule) {
      const discountVal = Number(rule.discountValue) || 0;
      if (discountVal > 0) {
        bestDiscountAmount =
          rule.discountType === "FLAT"
            ? Math.min(originalDisplayPrice, discountVal)
            : originalDisplayPrice * (discountVal / 100);
      }
    }
  }
  if (originalDisplayPrice <= storedPrice) {
    const matchingRule = (restaurantData?.discountRules || []).find((rule) => {
      const conditionValue = Number(rule.conditionValue);
      return (
        (rule.conditionType === "PRICE_ABOVE" && originalDisplayPrice > conditionValue) ||
        (rule.conditionType === "PRICE_BELOW" && originalDisplayPrice < conditionValue)
      );
    });
    if (matchingRule) {
      bestDiscountAmount = Math.max(
        bestDiscountAmount,
        originalDisplayPrice * ((Number(matchingRule.discountValue) || 0) / 100),
      );
    }
  }
  if (originalDisplayPrice <= storedPrice && restaurantData?.discount > 0) {
    const globalAmount = originalDisplayPrice * (Number(restaurantData.discount) / 100);
    if (globalAmount > bestDiscountAmount) bestDiscountAmount = globalAmount;
  }
  if (originalDisplayPrice <= storedPrice && bestDiscountAmount > 0) {
    displayPrice = Math.max(0, originalDisplayPrice - bestDiscountAmount);
  }
  return { originalDisplayPrice, displayPrice };
}

// "Other platform" price comparison (Cart.jsx platformPricingSavings).
export function computePlatformSavings(cart, total) {
  let totalPlatformPrice = 0;
  let totalPlatformGst = 0;
  let hasPlatformPricing = false;
  const items = [];
  cart.forEach((item) => {
    if (item.priceOnOtherPlatforms && item.priceOnOtherPlatforms > 0) {
      hasPlatformPricing = true;
      const quantity = item.quantity || 1;
      const platformPrice = (item.priceOnOtherPlatforms || 0) * quantity;
      const platformGstRate = Number(item.otherPlatformGst || 0);
      const platformGst = platformGstRate > 0 ? Math.round(platformPrice * (platformGstRate / 100)) : 0;
      const ourPrice = (item.price || 0) * quantity;
      totalPlatformPrice += platformPrice;
      totalPlatformGst += platformGst;
      items.push({
        name: item.name,
        foodelloPrice: item.price || 0,
        platformPrice: item.priceOnOtherPlatforms,
        platformGstRate,
        platformGst,
        savings: Math.max(0, platformPrice + platformGst - ourPrice),
        quantity,
      });
    }
  });
  const totalPlatformPriceWithGst = totalPlatformPrice + totalPlatformGst;
  const totalSavings = Math.max(0, totalPlatformPriceWithGst - total);
  const savingsPercentage =
    totalPlatformPriceWithGst > 0 ? ((totalSavings / totalPlatformPriceWithGst) * 100).toFixed(1) : 0;
  return {
    hasPlatformPricing,
    totalPlatformPrice,
    totalPlatformGst,
    totalPlatformPriceWithGst,
    totalSavings,
    savingsPercentage,
    items,
  };
}

// Web coupon shape built from the offers endpoint (Cart.jsx fetchCouponsForCartItems).
export function toCartCoupon(coupon, cartItem, couponItemId) {
  const isPercentage = coupon.discountType === "percentage";
  const flatDiscount = isPercentage ? 0 : Number(coupon.discountValue || coupon.discount || coupon.originalPrice || 0);
  const pctDiscount = isPercentage ? Number(coupon.discountPercentage || coupon.discountValue || 0) : 0;
  return {
    code: coupon.couponCode,
    discount: flatDiscount,
    discountValue: Number(coupon.discountValue || flatDiscount || pctDiscount || 0),
    discountPercentage: pctDiscount,
    discountDisplay: isPercentage ? `${pctDiscount}% OFF` : `${RUPEE}${flatDiscount} OFF`,
    minOrder: coupon.minOrderValue || coupon.minOrder || 0,
    description: isPercentage
      ? `${pctDiscount}% OFF with '${coupon.couponCode}'`
      : `Save ${RUPEE}${flatDiscount} with '${coupon.couponCode}'`,
    originalPrice: coupon.originalPrice,
    discountedPrice: coupon.discountedPrice,
    customerGroup: coupon.customerGroup || "all",
    isGlobalCoupon: Boolean(coupon.isGlobalCoupon),
    discountType: coupon.discountType,
    itemId: couponItemId,
    itemName: cartItem.name,
  };
}
