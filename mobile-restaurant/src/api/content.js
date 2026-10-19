// CMS pages, business settings and app config (all public). Web: PrivacyPolicyPage/TermsAndConditionsPage
// api.get, utils/businessSettings.js and utils/themeSettings.js (publicGetOnce).
import { createInFlightCache, stableStringify } from "./cache";
import { api } from "./client";

const genericGetCache = createInFlightCache({ ttlMs: 300000 });

// Cached GET for public endpoints (5 min TTL, in-flight dedupe). Config: {params, noCache, ...axios}.
export function publicGetOnce(url, config = {}) {
  const safeUrl = typeof url === "string" ? url.trim() : "";
  const { noCache, params, ...rest } = config || {};
  if (!safeUrl) return Promise.reject(new Error("url is required"));
  if (noCache) return api.get(safeUrl, { params, ...rest });
  const key = `GET:${safeUrl}:${stableStringify(params)}`;
  return genericGetCache.getOrCreate(key, () => api.get(safeUrl, { params, ...rest }));
}

// GET /food/pages/:key (privacy | terms). data is null when never saved (terms is null in production).
export function getPage(key) {
  return api.get(`/food/pages/${key}`, { skipAuthRefresh: true });
}
export const getPrivacy = () => getPage("privacy");
export const getTerms = () => getPage("terms");

// GET /food/admin/business-settings/public -> data {companyName, logo{url}, restaurantLogo{url}, ...}
// (useCompanyName / useAppLogo('restaurant_app')).
export function getBusinessSettings() {
  return api.get("/food/admin/business-settings/public", { skipAuthRefresh: true });
}

// GET /app-config/restaurant_app -> data {primaryColor, secondaryColor, logoUrl, fontFamily}.
// Currently 404 in production; callers keep the default theme on error.
export function getAppConfig(appName = "restaurant_app") {
  return publicGetOnce(`/app-config/${appName}`, { noCache: true, skipAuthRefresh: true });
}
