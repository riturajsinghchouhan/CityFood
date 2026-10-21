// CMS pages, business settings and app config (all public). Web: PrivacyPolicyV2/TermsAndConditionsV2
// (audit #51), useCompanyName/useAppLogo (#52) and utils/themeSettings.js (app-config).
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

// GET /food/pages/:key. data is null when never saved (all four keys are null in production today).
export function getPage(key) {
  return api.get(`/food/pages/${encodeURIComponent(key)}`, { skipAuthRefresh: true });
}

// Web: try "<kind>_delivery", fall back to "<kind>" when the first has no content.
async function getPageWithFallback(kind) {
  try {
    const res = await getPage(`${kind}_delivery`);
    if (res?.data) return res;
  } catch {
    // fall through to the generic page
  }
  return getPage(kind);
}
export const getPrivacy = () => getPageWithFallback("privacy");
export const getTerms = () => getPageWithFallback("terms");

// GET /food/admin/business-settings/public -> {companyName, logo{url}, deliveryLogo{url}, ...}
export function getBusinessSettings() {
  return publicGetOnce("/food/admin/business-settings/public", { skipAuthRefresh: true });
}

// GET /app-config/delivery_app -> {primaryColor, secondaryColor, logoUrl, fontFamily}. 404 in production
// today ("Config not found"); callers keep the default theme on error.
export function getAppConfig(appName = "delivery_app") {
  return publicGetOnce(`/app-config/${appName}`, { noCache: true, skipAuthRefresh: true });
}
