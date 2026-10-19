// Map web paths (push payload links, notification-inbox links, back targets, admin-configured links)
// to native routes. /food/restaurant/x and /restaurant/x are the same screen on web (audit §0 #4),
// so both prefixes are stripped; the restaurant home (orders) is "/".
import { router } from "expo-router";
import { Linking } from "react-native";

export function toNativePath(webPath) {
  if (!webPath || typeof webPath !== "string") return "/";
  let p = webPath.trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      if (!/cityfood\.co\.in$/i.test(u.hostname)) return null; // external link
      p = `${u.pathname}${u.search}`;
    } catch {
      return null;
    }
  }
  p = p.replace(/^\/food\/restaurant(?=\/|$|\?)/, "").replace(/^\/restaurant(?=\/|$|\?)/, "");
  // The backend sends restaurant order-status pushes with the USER link /food/user/orders/<id>.
  p = p.replace(/^\/(?:food\/)?user\/orders\/([^/?]+).*$/, "/orders/$1");
  if (!p || p.startsWith("?")) p = `/${p}`;
  p = p.replace(/^\/auth\/(login|sign-in)$/, "/login").replace(/^\/(sign-in)$/, "/login");
  // Case-insensitive web match: Explore links to /Share-Feedback.
  p = p.replace(/^\/share-feedback$/i, "/share-feedback");
  // Web redirect: reservations -> explore.
  if (p === "/reservations") p = "/explore";
  return p;
}

// Open a web link the way the web app would: internal paths navigate, external URLs open outside.
export function openLink(link) {
  const path = toNativePath(link);
  if (path === null) {
    Linking.openURL(link).catch(() => {});
    return;
  }
  router.push(path);
}
