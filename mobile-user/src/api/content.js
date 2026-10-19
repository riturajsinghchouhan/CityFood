// Landing, banners, CMS pages, business settings and app config.
// Web: publicGetOnce, getPublicLandingSettings/ExploreIcons/GourmetRestaurants, publicAPI,
// and the direct `api.get` calls in Home, Under250, Gourmet, AppIntroSplash and the CMS pages.
import { api } from "./client";
import { createInFlightCache, stableStringify, withoutTs } from "./cache";

const genericGetCache = createInFlightCache({ ttlMs: 300000 });

// Cached GET for public endpoints (5 min TTL, in-flight dedupe). Config: {params, noCache, ...axios}.
export function publicGetOnce(url, config = {}) {
  const safeUrl = typeof url === "string" ? url.trim() : "";
  const { noCache, params, ...rest } = config || {};
  if (!safeUrl) return Promise.reject(new Error("url is required"));
  if (noCache) return api.get(safeUrl, { params, ...rest });
  const key = `GET:${safeUrl}:${stableStringify(withoutTs(params))}`;
  return genericGetCache.getOrCreate(key, () => api.get(safeUrl, { params, ...rest }));
}

const zoneParams = (zoneId) => (zoneId ? { zoneId } : {});

// Resolves to the settings doc: showHeroBanners, showUnder250, showDining, showExploreIcons, showTop10,
// showGourmet, under250PriceLimit, mealsUnder, festBannerImages, stats, appLinks, socialLinks, ...
export function getPublicLandingSettings(zoneId = null) {
  return publicGetOnce("/food/landing/settings/public", { params: zoneParams(zoneId) }).then(
    (res) => res?.data ?? res ?? {},
  );
}

// Resolves to {items:[{_id, label, iconUrl, linkType, link, order}]}
export function getPublicExploreIcons(zoneId = null) {
  return publicGetOnce("/food/explore-icons/public", { params: zoneParams(zoneId) }).then(
    (res) => res?.data ?? res ?? {},
  );
}

// Resolves to an array of restaurants.
export function getPublicGourmetRestaurants(zoneId = null) {
  return publicGetOnce("/food/hero-banners/gourmet/public", { params: zoneParams(zoneId) }).then((res) => {
    const data = res?.data;
    if (Array.isArray(data?.restaurants)) return data.restaurants;
    return Array.isArray(data) ? data : [];
  });
}

// Gourmet page fetches uncached (Gourmet.jsx). Body; data.restaurants.
export function getGourmetRestaurants(zoneId = null) {
  return api.get("/food/hero-banners/gourmet/public", { params: zoneParams(zoneId) });
}

// Home hero banners (cached). Body; data.banners.
export function getHeroBanners(zoneId = null) {
  return publicGetOnce("/food/hero-banners/public", { params: { zoneId } });
}

// Home ad / dining banners (cached, Home.jsx passes zoneId). Body; data.banners.
export function getAdBanners(zoneId = null) {
  return publicGetOnce("/food/hero-banners/ads/public", { params: { zoneId } });
}

// Under250 page banners (uncached on web). Body; data.banners.
export function getUnder250Banners(zoneId = null) {
  return api.get("/food/hero-banners/under-250/public", { params: { zoneId } });
}

// Body: {success, data:[{_id, title, mediaUrl, mediaType, duration, order, restaurantId}]}
export function getAppIntroAds() {
  return api.get("/food/app-intro-ads/public");
}

// key: about | terms | privacy | refund | shipping | cancellation. data is null if never saved.
export function getPage(key) {
  return api.get(`/food/pages/${key}`);
}

export const getPrivacy = (key = "privacy") => getPage(key);
export const getTerms = (key = "terms") => getPage(key);
export const getAbout = () => getPage("about");
export const getRefund = () => getPage("refund");
export const getShipping = () => getPage("shipping");
export const getCancellation = () => getPage("cancellation");

// Body; data: {companyName, email, phone, address, logo/userLogo/favicon {url}, supportEmail,
// supportPhone, supportHours, onlinePaymentOnly, maxCodAmount, maintenanceMode, ...}.
// AppSettingsContext caches it for 6 h; call this directly only for a forced fresh read.
export function getBusinessSettings() {
  return api.get("/food/admin/business-settings/public");
}

// Body; data: {appName, primaryColor, secondaryColor, logoUrl, fontFamily}. 404 if not configured.
export function getAppConfig(appName = "user_app") {
  return publicGetOnce(`/app-config/${appName}`, { noCache: true });
}
