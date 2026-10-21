// Map web paths (push links, notification-inbox links, back targets) to native routes.
// The rider module lives at /food/delivery/* on web, and /delivery/* resolves to the same screens
// (FoodAppWrapper catch-all, audit routes §1.1), so both prefixes are stripped; the feed is "/".
// Native routes = the web paths without the prefix (DeliveryV2Router.jsx), plus the web redirects:
//   /feed -> "/" (same HomeShell tab), /signup -> /login (Navigate), /welcome -> "/" (mock page, dropped),
//   /orders/<id> (backend push link, no web route) -> "/", /earnings (broken PocketV2 link) -> "/".
import { router } from "expo-router";
import { Linking } from "react-native";

// Every route the web router declares (native form). Anything else falls back to "/" like the web `*`.
const KNOWN = [
  /^\/$/,
  /^\/(pocket|orders|history|profile|notifications|support|login|otp|terms)$/,
  /^\/signup\/(details|documents)$/,
  /^\/profile\/(details|bank|documents|privacy|terms)$/,
  /^\/help\/(tickets|tickets\/create|id-card)$/,
  /^\/help\/tickets\/[^/]+$/,
  /^\/pocket\/(payout|statement|deductions|limit-settlement|balance|cash-limit|details)$/,
];

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
  if (!/^\/(food\/)?delivery(?=\/|$|\?)/.test(p) && /^\/(food|user|restaurant|admin)(\/|$)/.test(p)) {
    return "/"; // another module's link: open the rider home
  }
  p = p.replace(/^\/food\/delivery(?=\/|$|\?)/, "").replace(/^\/delivery(?=\/|$|\?)/, "");
  if (!p || p.startsWith("?")) p = `/${p}`;
  const [pathOnly, query = ""] = p.split("?");
  let path = pathOnly.length > 1 ? pathOnly.replace(/\/+$/, "") : pathOnly;
  if (path === "/feed" || path === "/welcome" || path === "/earnings" || /^\/orders\/[^/]+$/.test(path)) path = "/";
  if (path === "/signup") path = "/login";
  if (!KNOWN.some((re) => re.test(path))) path = "/";
  return query ? `${path}?${query}` : path;
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
