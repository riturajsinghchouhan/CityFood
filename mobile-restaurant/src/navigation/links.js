// Map web paths (push payload links, admin-configured banner/CTA links, server
// redirects) to native routes: /food/user/x, /user/x, /food/x and /x are the same
// screen on web, so strip those prefixes.
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
  p = p.replace(/^\/food\/user(?=\/|$|\?)/, "").replace(/^\/food(?=\/|$|\?)/, "").replace(/^\/user(?=\/|$|\?)/, "");
  if (!p || p.startsWith("?")) p = `/${p}`;
  p = p.replace(/^\/auth\/(login|sign-in)$/, "/login").replace(/^\/(login|sign-in)$/, "/login");
  p = p.replace(/^\/orders\/([^/?]+)\/tracking/, "/orders/$1");
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
