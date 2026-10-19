// Port of Frontend/src/modules/Food/hooks/useRestaurantBackNavigation.js (+ the per-screen
// exceptions in audit §3.4). Web "back" goes to a FIXED parent route, not history; the header back
// arrow and the Android back button both follow it. Native paths are the web paths without the
// /food/restaurant (or /restaurant) prefix; the Orders home is "/". Web's location.state.backTo /
// state.from become `backTo` / `from` route params (web or native paths are both accepted).
import { router, useFocusEffect, useGlobalSearchParams, usePathname } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { toNativePath } from "./links";

// Bottom-nav roots (BottomNavOrders): Orders, Inventory, Feedback, Explore.
export const TAB_ROOTS = new Set(["/", "/inventory", "/feedback", "/explore"]);

// web toRestaurantPath: only restaurant paths are valid back targets.
function cleanBackTo(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v.startsWith("/")) return null;
  if (/^\/(food\/)?restaurant(\/|$|\?)/.test(v)) return toNativePath(v);
  // Already-native path (no prefix) passed by RN screens.
  if (/^\/(food|user|delivery|admin)(\/|$)/.test(v)) return null;
  return v;
}

/**
 * Parent route for a native pathname, or null when the default stack pop should be used.
 * Mirrors resolveRestaurantBackPath (minus branches for routes that no longer exist:
 * /food/..., /advertisements, /coupon), plus the screen-level exceptions:
 * Notifications -> "/", WithdrawalHistory -> "/hub-finance", OutletTimings -> "/explore".
 * Promocodes and EditCuisines use navigate(-1) on web: they return null (stack pop).
 */
export function resolveBackPath(pathname, params = {}) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const explicit = cleanBackTo(params.backTo) || cleanBackTo(params.from);

  if (p === "/orders/all") return explicit || "/explore";
  if (/^\/orders\/[^/]+$/.test(p)) return explicit || "/orders/all";

  if (p === "/notifications") return "/";
  if (p === "/withdrawal-history") return "/hub-finance";
  if (p === "/outlet-timings") return "/explore";
  if (p === "/promocodes" || p === "/edit-cuisines") return null;

  if (
    [
      "/edit",
      "/edit-owner",
      "/edit-address",
      "/phone",
      "/manage-outlets",
      "/update-bank-details",
      "/fssai",
      "/fssai/update",
      "/outlet-info",
      "/zone-setup",
    ].includes(p) ||
    /^\/outlet-timings\/[^/]+$/.test(p)
  ) {
    return explicit || "/explore";
  }

  if (
    ["/settings", "/delivery-settings", "/rush-hour", "/status", "/business-plan", "/config", "/categories", "/menu-categories", "/privacy", "/terms"].includes(p)
  ) {
    return explicit || "/";
  }

  // Web sends these to /reviews, which does not exist; its nearest real screen is Feedback.
  if (p === "/reviews" || /^\/reviews\/[^/]+\/reply$/.test(p) || p === "/ratings-reviews" || p === "/dish-ratings") {
    return explicit || "/feedback";
  }

  if (p === "/help-centre/support" || p === "/share-feedback") return explicit || "/feedback";
  if (p === "/finance-details" || p === "/download-report") return explicit || "/hub-finance";
  if (/^\/hub-menu\/item\/[^/]+$/.test(p)) return explicit || "/explore";

  if (explicit && explicit !== p) return explicit;
  return "/";
}

export function goTo(path) {
  // Pop to the route if it is already in the stack, otherwise replace the current screen.
  router.dismissTo(path);
}

// Header back arrow for screens whose web version calls useRestaurantBackNavigation().
export function useAppBack() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  return useCallback(() => {
    const target = resolveBackPath(pathname, params);
    if (target === null) {
      if (router.canGoBack()) router.back();
      else goTo("/");
      return;
    }
    goTo(target);
  }, [pathname, params]);
}

// Screens with their own back behaviour (open sheets/pickers, multi-step onboarding, Inventory's
// popups that the web closed via history.pushState/popstate) register an override; return true
// when handled. Overrides apply only while the screen is focused.
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

// Auth/public screens: no fixed parent, use the stack.
const STACK_ONLY = /^\/(welcome|login|otp|signup|pending-verification|onboarding|profile\/(privacy|terms))$/;

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
      if (path === "/") return false; // exit the app from the Orders home
      if (TAB_ROOTS.has(path)) {
        goTo("/");
        return true;
      }
      if (STACK_ONLY.test(path)) return false;
      const target = resolveBackPath(path, prm);
      if (!target) return false; // default stack pop = web navigate(-1)
      goTo(target);
      return true;
    });
    return () => sub.remove();
  }, []);
  return null;
}
