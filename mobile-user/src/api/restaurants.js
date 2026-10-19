// Restaurants, menus, catalog, offers and search. Web: restaurantAPI (public user-app part),
// getPublicCategories, getPublicFoods, searchAPI, userAPI promocode calls.
// Pass `{ noCache: true }` as config to bypass the dedupe caches, as on web.
import { api } from "./client";
import { createInFlightCache, stableStringify, withoutTs } from "./cache";

const restaurantsCache = createInFlightCache({ ttlMs: 1000 });
const menuCache = createInFlightCache({ ttlMs: 300000 });
const outletTimingsCache = createInFlightCache({ ttlMs: 300000 });
const categoriesCache = createInFlightCache({ ttlMs: 300000 });
const foodsCache = createInFlightCache({ ttlMs: 300000 });

const EMPTY = { success: false, data: null };

const round5 = (v) => Math.round(Number(v) * 100000) / 100000;

// GET /food/restaurant/restaurants. Params: limit (default 1000), page, zoneId, lat, lng, radiusKm,
// sortBy, cuisine, minRating, maxDeliveryTime, maxPrice, hasOffers, topRated, trusted, search, city, area.
// data: {restaurants, total, page, limit}. Banned restaurants are included (isBanned: true).
export function getRestaurants(params = {}, config = {}) {
  const { noCache, ...rest } = config || {};
  const request = () => api.get("/food/restaurant/restaurants", { params: { limit: 1000, ...params }, ...rest });
  if (noCache) return request();
  const keyParams = withoutTs({ limit: 1000, ...params });
  // Round coords so GPS jitter does not bust the cache.
  if (Number.isFinite(Number(keyParams.lat))) keyParams.lat = round5(keyParams.lat);
  if (Number.isFinite(Number(keyParams.lng))) keyParams.lng = round5(keyParams.lng);
  return restaurantsCache.getOrCreate(`restaurants:${stableStringify(keyParams)}`, request);
}

// Id or dash-separated slug. Params: lat, lng. data.restaurant (raw doc + offers, rating, distanceInfo).
export function getRestaurantById(id, config = {}) {
  return api.get(`/food/restaurant/restaurants/${String(id)}`, { ...config });
}

// data.menu: {sections:[{id, categoryId, name, items, subsections}], categories}
export function getMenuByRestaurantId(id, config = {}) {
  const safeId = String(id || "").trim();
  if (!safeId) return Promise.resolve(EMPTY);
  const { noCache, ...rest } = config || {};
  const request = () => api.get(`/food/restaurant/restaurants/${safeId}/menu`, { ...rest });
  if (noCache) return request();
  return menuCache.getOrCreate(`menu:${safeId}`, request);
}

// ObjectId only. data.outletTimings: {Monday: {isOpen, openingTime, closingTime}, ...}
export function getOutletTimingsByRestaurantId(id, config = {}) {
  const safeId = String(id || "").trim();
  if (!safeId) return Promise.resolve(EMPTY);
  const { noCache, ...rest } = config || {};
  const request = () => api.get(`/food/restaurant/restaurants/${safeId}/outlet-timings`, { ...rest });
  if (noCache) return request();
  return outletTimingsCache.getOrCreate(`outletTimings:${safeId}`, request);
}

// data.addons: [{id, _id, name, description, price, image, images}]
export function getAddonsByRestaurantId(id, config = {}) {
  return api.get(`/food/restaurant/restaurants/${String(id)}/addons`, { ...config });
}

// data: {allOffers, groupedByOffer}. The backend ignores params.
export function getPublicOffers(params = {}) {
  return api.get("/food/restaurant/offers", { params });
}

// Cart helper: adapts public offers into the coupon shape the Cart screen reads (data.coupons).
export function getCouponsByItemIdPublic(restaurantId) {
  return api.get("/food/restaurant/offers").then((res) => {
    const list = res?.data?.allOffers || res?.allOffers || [];
    const now = Date.now();
    const coupons = list
      .filter((o) => {
        if (String(o?.restaurantScope) === "selected") {
          if (!restaurantId) return false;
          return String(o.restaurantId || "") === String(restaurantId || "");
        }
        return true;
      })
      .map((o) => {
        const isPct = o.discountType === "percentage";
        const discountValue = Number(o.discountValue) || 0;
        const flatDiscount = isPct ? 0 : discountValue;
        return {
          couponCode: o.couponCode,
          discountType: o.discountType,
          discountValue,
          discountPercentage: isPct ? discountValue : 0,
          discount: flatDiscount,
          originalPrice: flatDiscount,
          discountedPrice: 0,
          minOrderValue: Number(o.minOrderValue || 0),
          minOrder: Number(o.minOrderValue || 0),
          maxDiscount: o.maxDiscount != null ? Number(o.maxDiscount) : null,
          customerGroup: o.customerScope === "first-time" ? "new" : "all",
          isGlobalCoupon: true,
          endDate: o.endDate || null,
          showInCart: o.showInCart !== false,
          _ts: now,
        };
      });
    return { success: true, data: { coupons } };
  });
}

// Resolves to the unwrapped data: {categories, total, page, limit}.
export function getPublicCategories(zoneId = null, config = {}) {
  const params = zoneId ? { zoneId } : {};
  const { noCache, ...rest } = config || {};
  const request = () => api.get("/food/restaurant/categories/public", { params, ...rest });
  const p = noCache ? request() : categoriesCache.getOrCreate(`categories:${stableStringify(params)}`, request);
  return p.then((res) => res?.data ?? res ?? {});
}

// Params: zoneId, maxPrice, limit, page. Resolves to the unwrapped data: {foods, total, page, limit}.
export function getPublicFoods(params = {}, config = {}) {
  const keyParams = withoutTs(params && typeof params === "object" ? params : {});
  const { noCache, ...rest } = config || {};
  const request = () => api.get("/food/restaurant/foods/public", { params: keyParams, ...rest });
  const p = noCache ? request() : foodsCache.getOrCreate(`foods:${stableStringify(keyParams)}`, request);
  return p.then((res) => res?.data ?? res ?? {});
}

// Params: q, categoryId, lat, lng, zoneId, radiusKm, isVeg, minRating, maxDeliveryTime, page, limit.
export function unifiedSearch(params = {}) {
  return api.get("/food/search/unified", { params });
}

// Public despite its name; replaces the web's undefined adminAPI.getPublicCategories
// (Categories.jsx, ProfessionalSearch.jsx). Params: zoneId. data.categories.
export function getSearchCategories(params = {}) {
  return api.get("/food/search/categories/admin", { params });
}

// data.promocodeList
export function getActivePromocodes(restaurantId) {
  return api.get(`/food/promocodes/restaurant/${restaurantId}`);
}

// Body: {code, restaurantId, orderAmount} -> data: {promocode, discountAmount, finalAmount}
export function validatePromocode(data) {
  return api.post("/food/promocodes/validate", data);
}
