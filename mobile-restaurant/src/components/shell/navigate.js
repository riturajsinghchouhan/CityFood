// Shell navigation (drawer links, bottom nav from stack screens, dining popup).
import { router } from "expo-router";
import { TAB_ROUTES } from "./layoutConfig";

// Tab roots live in the (tabs) navigator under the stack: pop back to it and switch tab
// (router.dismissTo replaces the current screen when (tabs) is not in the stack, e.g. after a
// cold-start deep link). Other screens are pushed, like the web's navigate(route).
export function openShellRoute(path, currentPath) {
  if (!path || path === currentPath) return;
  if (TAB_ROUTES.has(path)) router.dismissTo(path);
  else router.push(path);
}
