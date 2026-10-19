// Restaurant theme: LIGHT ONLY (the web's ThemeContext defaults restaurantAppTheme to light and has
// no toggle). Admin colours come from GET /app-config/restaurant_app (primaryColor -> --rt-primary,
// secondaryColor -> --rt-primary-strong, logoUrl -> restaurant_app_logo), as applyDynamicTheme does.
// That endpoint is 404 today, so the defaults (#B80B3D / #66001D) stay.
// API kept from the shared app: {mode, isDark, colors, logoUrl, setMode, toggleMode, applyAppConfig}.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAppConfig } from "../api/content";
import { KEYS, store } from "../storage";
import { brand, derivePrimaryTokens, light } from "./tokens";

const ThemeContext = createContext(null);

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const noop = () => {};

export function ThemeProvider({ children }) {
  const [overrides, setOverrides] = useState({});

  const applyAppConfig = useCallback((cfg) => {
    const next = {};
    if (HEX.test(cfg?.primaryColor || "")) next.primaryColor = cfg.primaryColor;
    if (HEX.test(cfg?.secondaryColor || "")) next.secondaryColor = cfg.secondaryColor;
    if (cfg?.logoUrl) next.logoUrl = cfg.logoUrl;
    if (cfg?.fontFamily) next.fontFamily = cfg.fontFamily;
    setOverrides(next);
    store.set(KEYS.appConfig, next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    store.get(KEYS.appConfig).then((cfg) => {
      if (!cancelled && cfg) setOverrides(cfg);
    });
    // Public, once per launch. A 404 (not configured) keeps the cached/default colours.
    getAppConfig("restaurant_app")
      .then((res) => {
        const cfg = res?.data || null;
        if (!cancelled && cfg && typeof cfg === "object") applyAppConfig(cfg);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applyAppConfig]);

  const value = useMemo(() => {
    const primary = overrides.primaryColor || light.primary;
    const primaryStrong = overrides.secondaryColor || light.primaryStrong;
    const colors = {
      ...light,
      primary,
      primaryStrong,
      secondary: primaryStrong,
      ...derivePrimaryTokens(primary),
    };
    return {
      mode: "light",
      isDark: false,
      colors,
      // RestaurantNavbar gradient is hard-coded on web (does not follow --rt-primary).
      headerGradient: brand.headerGradient,
      logoUrl: overrides.logoUrl || null,
      fontFamily: overrides.fontFamily || null,
      setMode: noop,
      toggleMode: noop,
      applyAppConfig,
    };
  }, [overrides, applyAppConfig]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

// Build a StyleSheet from the current colors, memoized per palette.
export function useThemedStyles(factory) {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
