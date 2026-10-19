// Light/Dark toggle (Profile > Appearance on web, ThemeContext.jsx) plus the
// admin-configurable primary/secondary colors from GET /app-config/user_app.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { KEYS, store } from "../storage";
import { dark, light } from "./tokens";

const ThemeContext = createContext(null);

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function ThemeProvider({ children }) {
  // Web default for the customer app is light (ThemeContext wins over index.jsx).
  const [mode, setModeState] = useState("light");
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    store.get(KEYS.theme).then((saved) => {
      if (saved === "dark" || saved === "light") setModeState(saved);
    });
    store.get(KEYS.appConfig).then((cfg) => cfg && setOverrides(cfg));
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    store.set(KEYS.theme, next);
  }, []);

  const applyAppConfig = useCallback((cfg) => {
    const next = {};
    if (HEX.test(cfg?.primaryColor || "")) next.primaryColor = cfg.primaryColor;
    if (HEX.test(cfg?.secondaryColor || "")) next.secondaryColor = cfg.secondaryColor;
    if (cfg?.logoUrl) next.logoUrl = cfg.logoUrl;
    setOverrides(next);
    store.set(KEYS.appConfig, next);
  }, []);

  const value = useMemo(() => {
    const base = mode === "dark" ? dark : light;
    // The web sets these as inline styles on <html>, which beat the .dark rules,
    // so admin colors apply in both modes.
    const colors = {
      ...base,
      primary: overrides.primaryColor || base.primary,
      secondary: overrides.secondaryColor || base.secondary,
    };
    return {
      mode,
      isDark: mode === "dark",
      colors,
      logoUrl: overrides.logoUrl || null,
      setMode,
      toggleMode: () => setMode(mode === "dark" ? "light" : "dark"),
      applyAppConfig,
    };
  }, [mode, overrides, setMode, applyAppConfig]);

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
