// Port of Frontend/src/modules/DeliveryV2/hooks/useDeliveryBackNavigation.js. Web "back" goes to a FIXED
// parent route (honouring location.state.backTo / from when present), not history; the header back
// arrow and the Android back button both follow it. Native paths are the web paths without the
// /food/delivery (or /delivery) prefix; the feed is "/". Web state.backTo / state.from become
// `backTo` / `from` route params (web or native paths are both accepted).
import { router, useFocusEffect, useGlobalSearchParams, usePathname } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { toNativePath } from "./links";

// HomeShell tabs (bottom nav Feed/Pocket/Orders/Profile, plus History which has no nav item).
export const TAB_ROOTS = new Set(["/", "/pocket", "/orders", "/profile", "/history"]);

// web toDeliveryPath: only delivery paths are valid back targets (native paths are accepted too).
function cleanBackTo(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v.startsWith("/")) return null;
  if (/^\/(food\/)?delivery(\/|$|\?)/.test(v)) return toNativePath(v);
  if (/^\/(food|user|restaurant|admin)(\/|$)/.test(v)) return null;
  return v;
}

const PROFILE_CHILDREN = new Set([
  "/profile/details",
  "/profile/bank",
  "/profile/documents",
  "/profile/terms",
  "/profile/privacy",
  "/help/id-card",
  "/help/tickets",
]);

const POCKET_CHILDREN = new Set([
  "/pocket/payout",
  "/pocket/statement",
  "/pocket/deductions",
  "/pocket/limit-settlement",
  "/pocket/balance",
  "/pocket/cash-limit",
  "/pocket/details",
]);

/**
 * resolveDeliveryBackPath, native form. Returns the parent route for a pathname, or null when the
 * default stack pop should be used (PublicSupportV2 and NotificationsV2-free cases use navigate(-1)).
 *   signup/details -> /login (web: /signup, which redirects to login); signup/documents -> signup/details
 *   otp -> backTo || /login; terms -> backTo || /login (web /signup -> login)
 *   profile/{details,bank,documents,terms,privacy}, help/id-card, help/tickets -> backTo || /profile
 *   help/tickets/create, help/tickets/:id -> backTo || /help/tickets
 *   pocket/* -> backTo || /pocket
 *   notifications -> /profile (NotificationsV2 back button)
 *   support -> null (PublicSupportV2 navigate(-1))
 *   anything else -> backTo (if different) || "/"
 */
export function resolveBackPath(pathname, params = {}) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const explicit = cleanBackTo(params.backTo) || cleanBackTo(params.from);

  if (p === "/signup/details") return "/login";
  if (p === "/signup/documents") return "/signup/details";
  if (p === "/otp") return explicit || "/login";
  if (p === "/terms") return explicit || "/login";
  if (p === "/notifications") return "/profile";
  if (p === "/support") return null;
  if (PROFILE_CHILDREN.has(p)) return explicit || "/profile";
  if (p === "/help/tickets/create" || /^\/help\/tickets\/[^/]+$/.test(p)) return explicit || "/help/tickets";
  if (POCKET_CHILDREN.has(p)) return explicit || "/pocket";
  if (explicit && explicit !== p) return explicit;
  return "/";
}

export function goTo(path) {
  // Pop to the route if it is already in the stack, otherwise replace the current screen.
  router.dismissTo(path);
}

// Header back arrow for screens whose web version calls useDeliveryBackNavigation().
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

// Screens with their own back behaviour (open sheets/modals: PocketV2 / ProfileDetailsV2 used
// history.pushState + popstate so hardware back closes the popup) register an override; return true
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

// Auth/public screens that use the stack (never go "back" into the shell from login).
const STACK_ONLY = /^\/(login|support|profile\/(privacy|terms))$/;

// Mounted once in the root layout. On the feed, back exits/minimises the app; on other tabs it goes
// to the feed; it never navigates back into the auth screens from the shell.
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
      if (path === "/") return false; // exit from the feed
      if (TAB_ROOTS.has(path)) {
        goTo("/");
        return true;
      }
      if (STACK_ONLY.test(path)) return false;
      const target = resolveBackPath(path, prm);
      if (!target) return false;
      goTo(target);
      return true;
    });
    return () => sub.remove();
  }, []);
  return null;
}
