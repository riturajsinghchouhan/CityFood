// Port of Frontend/src/modules/Food/hooks/useAppBackNavigation.js.
// Web "back" goes to a fixed parent route, not history; the header back arrow and
// the Android back button both follow it. Native paths are the web paths without
// the /food/user prefix. Web's location.state.backTo becomes a `backTo` param.
import { router, useFocusEffect, useGlobalSearchParams, usePathname } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { BackHandler } from "react-native";

const TAB_ROOTS = new Set(["/", "/under-250", "/orders", "/profile", "/dining"]);

function cleanBackTo(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  return value;
}

export function resolveBackPath(pathname, params = {}) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const explicit = cleanBackTo(params.backTo) || cleanBackTo(params.from) || cleanBackTo(params.returnTo);

  if (/^\/profile\/(edit|favorites|support|coupons|about|report-safety-emergency|refer-earn|dining-bookings)$/.test(p)) {
    return explicit || "/profile";
  }
  if (/^\/profile\/(terms|privacy|refund|shipping|cancellation)$/.test(p)) return explicit || "/profile";
  if (p === "/wallet") return "/profile";
  if (p === "/notifications") return explicit || "/";
  if (/^\/restaurants\/[^/]+$/.test(p)) {
    if (params.under250 === "true") return "/under-250";
    return explicit || "/";
  }
  if (/^\/dining\/book(\/|$)/.test(p)) return explicit || "/dining";
  if (/^\/dining\/[^/]+\/[^/]+$/.test(p)) return explicit || "/dining";
  if (/^\/dining\/[^/]+$/.test(p)) return "/dining";
  if (/^\/orders\/[^/]+(\/invoice|\/details)?$/.test(p)) return "/orders";
  if (p === "/address-selector") return "/";
  if (/^\/collections\/[^/]+$/.test(p)) return "/collections";
  if (p === "/categories") return "/";
  if (/^\/category\/[^/]+$/.test(p)) return "/categories";
  if (p === "/offers" || p === "/gourmet") return "/";
  if (/^\/complaints(\/|$)/.test(p)) return explicit || "/orders";
  if (explicit && explicit !== p) return explicit;
  return null;
}

export function goTo(path) {
  // Pop to the route if it is already in the stack, otherwise replace the current screen.
  router.dismissTo(path);
}

// Header back arrow for screens whose web version calls useAppBackNavigation()
// (falls back to Home like the web hook). Screens that use navigate(-1) on web
// should call router.back() instead.
export function useAppBack() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  return useCallback(() => goTo(resolveBackPath(pathname, params) || "/"), [pathname, params]);
}

// Screens with their own back behavior (multi-step flows, open panels) register an
// override; return true when handled. Overrides apply only while the screen is focused.
const overrides = [];

export function useBackOverride(handler) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useFocusEffect(
    useCallback(() => {
      const fn = () => ref.current?.();
      overrides.push(fn);
      return () => {
        const i = overrides.lastIndexOf(fn);
        if (i >= 0) overrides.splice(i, 1);
      };
    }, []),
  );
}

// Mounted once in the root layout.
export function HardwareBackBinding() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const state = useRef({ pathname, params });
  useEffect(() => {
    state.current = { pathname, params };
  }, [pathname, params]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      for (let i = overrides.length - 1; i >= 0; i -= 1) {
        if (overrides[i]()) return true;
      }
      const { pathname: path, params: prm } = state.current;
      if (path === "/") return false; // exit the app from Home
      if (TAB_ROOTS.has(path)) {
        goTo("/");
        return true;
      }
      const target = resolveBackPath(path, prm);
      if (!target) return false; // default stack pop = web history back
      goTo(target);
      return true;
    });
    return () => sub.remove();
  }, []);
  return null;
}
