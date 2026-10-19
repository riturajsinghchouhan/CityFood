// Business settings (6 h cache, refreshed on launch like the web's index.jsx) and the
// admin app config for user_app (colors/logo -> ThemeContext). Mirrors utils/businessSettings.js,
// utils/themeSettings.js, hooks/useCompanyName.js and hooks/useAppLogo.js.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { resolveAssetUrl } from "../api/assets";
import { getAppConfig, getBusinessSettings } from "../api/content";
import { readCached, writeCached } from "../storage/cached";
import { KEYS } from "../storage";
import { useTheme } from "../theme/ThemeContext";

const SETTINGS_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_COMPANY_NAME = "CityFood";
const URL_FIELDS = ["logo", "userLogo", "restaurantLogo", "deliveryLogo", "favicon", "termsAndConditionsPdf"];

let cachedSettings = null;
let hydratePromise = null;
let inFlight = null;
const listeners = new Set();

function normalizeSettingsUrls(settings) {
  if (!settings) return settings;
  const next = { ...settings };
  URL_FIELDS.forEach((field) => {
    if (next[field]?.url) next[field] = { ...next[field], url: resolveAssetUrl(next[field].url) };
  });
  return next;
}

function publish(settings) {
  cachedSettings = settings;
  listeners.forEach((fn) => fn(settings));
}

function hydrateSettings() {
  if (!hydratePromise) {
    hydratePromise = readCached(KEYS.businessSettings).then((saved) => {
      if (saved && !cachedSettings) publish(saved);
      return cachedSettings;
    });
  }
  return hydratePromise;
}

export const getCachedSettings = () => cachedSettings;

// Always fetches (deduped while in flight); falls back to the cached copy on error.
export async function loadBusinessSettings() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      await hydrateSettings();
      const res = await getBusinessSettings();
      const raw = res?.data;
      if (!raw) return cachedSettings;
      const settings = normalizeSettingsUrls(raw);
      await writeCached(KEYS.businessSettings, settings, SETTINGS_TTL_MS);
      publish(settings);
      return settings;
    } catch {
      return cachedSettings;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function getCompanyName() {
  return cachedSettings?.companyName || DEFAULT_COMPANY_NAME;
}

export async function getCompanyNameAsync() {
  const settings = await loadBusinessSettings();
  return settings?.companyName || DEFAULT_COMPANY_NAME;
}

const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const { applyAppConfig, logoUrl: themeLogoUrl } = useTheme();
  const [settings, setSettings] = useState(cachedSettings);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    listeners.add(setSettings);
    let active = true;
    hydrateSettings().then((saved) => {
      if (active && saved) setSettings(saved);
    });
    loadBusinessSettings().finally(() => {
      if (active) setLoading(false);
    });
    getAppConfig("user_app")
      .then((res) => {
        const cfg = res?.data;
        if (active && cfg) applyAppConfig(cfg);
      })
      .catch(() => {});
    return () => {
      active = false;
      listeners.delete(setSettings);
    };
  }, [applyAppConfig]);

  const refresh = useCallback(() => loadBusinessSettings(), []);

  const value = useMemo(() => {
    const logo =
      settings?.userLogo?.url || settings?.logo?.url || (themeLogoUrl ? resolveAssetUrl(themeLogoUrl) : null);
    return {
      settings,
      loading,
      companyName: settings?.companyName || DEFAULT_COMPANY_NAME,
      logo,
      refresh,
    };
  }, [settings, loading, themeLogoUrl, refresh]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used inside AppSettingsProvider");
  return ctx;
}

// Web hook names, for 1:1 mapping.
export const useCompanyName = () => useAppSettings().companyName;
export const useAppLogo = () => useAppSettings().logo;
