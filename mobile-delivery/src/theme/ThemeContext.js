// Delivery theme: LIGHT ONLY (audit routes §5.4 — /delivery paths default to light, no toggle).
// Admin colours come from GET /app-config/delivery_app (primaryColor -> --dv-primary, secondaryColor ->
// --dv-primary-strong, logoUrl -> delivery_app_logo), as applyDynamicTheme does. That endpoint is 404
// today, so the defaults (#15498b / #000000) stay.
// API: {mode, isDark, colors, logoUrl, fontFamily, setMode, toggleMode, applyAppConfig, dvColor, dvGradient}.
// colors includes every `light` token plus primaryBorder / primaryTint10 / focusRing for the primary.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAppConfig } from "../api/content";
import { KEYS, store } from "../storage";
import { brand, derivePrimaryTokens, dvColor as mapDvColor, dvGradient as mapDvGradient, light } from "./tokens";

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
    if (next.logoUrl) store.set(KEYS.appLogo, next.logoUrl);
  }, []);

  useEffect(() => {
    let cancelled = false;
    store.get(KEYS.appConfig).then((cfg) => {
      if (!cancelled && cfg) setOverrides(cfg);
    });
    // Public, once per launch. A 404 (not configured) keeps the cached/default colours.
    getAppConfig("delivery_app")
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
      // remapped success/info accents follow the (possibly admin) primary
      success: primary,
      info: primary,
      ...derivePrimaryTokens(primary),
    };
    return {
      mode: "light",
      isDark: false,
      colors,
      brand,
      logoUrl: overrides.logoUrl || null,
      fontFamily: overrides.fontFamily || null,
      // dvColor("bg-green-500") -> what the web renders under .delivery-v2-theme (or fallback).
      dvColor: (className, fallback) => mapDvColor(className, colors, fallback),
      dvGradient: () => mapDvGradient(colors),
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
