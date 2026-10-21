// Design tokens for the delivery partner (rider) panel: deliveryTheme.css + Tailwind v4 palette
// (audit routes-and-design §5). One file for all tokens. Light only.

// Tailwind v4 default palette entries used by the delivery screens (audit §5.3).
export const tw = {
  white: "#ffffff",
  black: "#000000",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5dc",
  gray400: "#99a1af",
  gray500: "#6a7282",
  gray600: "#4a5565",
  gray700: "#364153",
  gray800: "#1e2939",
  gray900: "#101828",
  gray950: "#030712",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate400: "#90a1b9",
  slate500: "#62748e",
  slate900: "#0f172b",
  green50: "#f0fdf4",
  green100: "#dcfce7",
  green500: "#00c950",
  green600: "#00a63e",
  green700: "#008236",
  green800: "#016630",
  red50: "#fef2f2",
  red100: "#ffe2e2",
  red500: "#fb2c36",
  red600: "#e7000b",
  red700: "#c10007",
  orange50: "#fff7ed",
  orange100: "#ffedd4",
  orange500: "#ff6900",
  amber500: "#fe9a00",
  yellow400: "#fdc700",
  blue50: "#eff6ff",
  blue600: "#155dfc",
};

// DeliveryV2/deliveryTheme.css (audit routes §5.1). --dv-primary / --dv-primary-strong can be
// overwritten at runtime from GET /app-config/delivery_app (404 in production, so these stay).
export const brand = {
  primary: "#15498b", // --dv-primary (headers, CTAs and every remapped accent)
  primaryStrong: "#000000", // --dv-primary-strong (pressed state, gradient end)
  primarySoft: "#e7effa", // --dv-primary-soft (remapped bg-*-50 tints and /10 alphas)
  accent: "#000000", // --dv-accent (unused)
  surface: "#ffffff", // --dv-surface
  bg: "#eef3fb", // --dv-bg (remapped bg-yellow-*, bg-[#f6e9dc])
  text: "#0f1724", // --dv-text
  muted: "#4f5f77", // --dv-muted
  dvBorder: "#d1dceb", // --dv-border (card borders)
  inputBorder: "#e8dee7", // inputs
  onlineGreen: "#22c55e", // online toggle exception (not remapped)
  offlineRed: "#ef4444",
  offlinePlaceholder: "#f8f9fa",
  routeBlue: "#3b82f6", // remaining-route polyline (map)
  routeGrey: "#9ca3af", // travelled / baseline polyline
  zoneGreen: "#22c55e", // service-zone polygon (3 % fill)
  // Page background: radial #d5e3f7 / #e7edf8 over linear #f7faff -> #edf2fb (use the linear as a gradient).
  pageGradient: ["#f7faff", "#edf2fb"],
  verifyGradient: ["#15498b", "#000000"], // linear-gradient(33deg, #15498b, #000)
  cardShadow: { boxShadow: "0px 10px 28px -18px rgba(17,39,67,0.24)" }, // rounded-2xl/3xl cards
};

// Hex colour mixed with white, like CSS color-mix() (e.g. remapped borders = primary 28 % + white).
export function mixWithWhite(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").replace(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i, "#$1$1$2$2$3$3"));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift) => Math.round(((n >> shift) & 255) * amount + 255 * (1 - amount));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

// Light only: the delivery panel has no dark mode (audit §5.4).
export const light = {
  dark: false,
  background: brand.surface,
  pageBg: brand.bg,
  card: brand.surface,
  foreground: brand.text,
  text: brand.text,
  textSecondary: tw.gray600,
  textMuted: tw.gray500,
  textFaint: tw.gray400,
  captionMuted: brand.muted,
  primary: brand.primary,
  primaryForeground: "#ffffff",
  primaryStrong: brand.primaryStrong,
  primarySoft: brand.primarySoft,
  secondary: brand.primaryStrong,
  accent: brand.primarySoft,
  muted: tw.gray100,
  border: tw.gray200,
  borderLight: tw.gray100,
  dvBorder: brand.dvBorder,
  input: brand.inputBorder,
  destructive: tw.red600,
  danger: tw.red500,
  // The theme remaps green/emerald/blue accents to the primary: "success"/"info" render primary.
  success: brand.primary,
  warning: tw.amber500,
  info: brand.primary,
  star: tw.yellow400,
  surface: tw.gray50,
  surfaceAlt: tw.gray100,
  overlay: "rgba(0,0,0,0.4)",
  online: brand.onlineGreen,
  offline: brand.offlineRed,
};

// Derived per-primary colours (recomputed when an admin primary is applied).
export function derivePrimaryTokens(primary) {
  return {
    primaryBorder: mixWithWhite(primary, 0.28), // remapped border-{orange,green,...}-*
    primaryTint10: mixWithWhite(primary, 0.1), // bg-*/10
    focusRing: mixWithWhite(primary, 0.15), // 0 0 0 4px rgb(21 73 139 / .15)
  };
}

// ---- The deliveryTheme.css colour rule (".delivery-v2-theme" !important overrides, exact lists) ----
// The rendered app is monochrome blue: these Tailwind classes / literals are repainted with the primary.
// Anything not listed (red errors/emergency, greys, black, white, amber, other shades, arbitrary values
// like #0f766e / #1e293b) keeps its own colour.
const FAMILIES = ["orange", "green", "emerald", "blue", "cyan", "indigo", "teal"];
const set = (list) => new Set(list);
const TEXT_PRIMARY = set([
  ...FAMILIES.flatMap((f) => [`text-${f}-500`, `text-${f}-600`]),
  "text-primary",
  "text-[#eb590e]",
  "text-[#10b981]",
]);
const BG_PRIMARY = set([
  ...FAMILIES.flatMap((f) => [`bg-${f}-500`, `bg-${f}-600`]),
  "bg-primary",
  "bg-[#00b761]",
  "bg-[#10b981]",
  "bg-[#eb590e]",
  "bg-[#121212]",
]);
const BG_SOFT = set([
  ...FAMILIES.map((f) => `bg-${f}-50`),
  ...["orange", "green", "emerald", "blue", "cyan", "indigo"].map((f) => `bg-${f}-500/10`),
]);
const BG_PAGE = set(["bg-[#f6e9dc]", "bg-yellow-400", "bg-yellow-300"]);
const BORDER_MIX = set([
  "border-orange-100",
  "border-orange-200",
  "border-orange-500/20",
  "border-green-100",
  "border-green-500/20",
  "border-emerald-200",
  "border-blue-100",
  "border-blue-200",
  "border-blue-500/20",
  "border-cyan-100",
  "border-indigo-200",
  "border-[#10b981]",
  "border-primary",
]);
const GRADIENT = set([
  ...FAMILIES.map((f) => `from-${f}-500`),
  ...FAMILIES.map((f) => `to-${f}-600`),
  "from-amber-500",
  "to-amber-500",
]);
const HOVER_STRONG = set([
  "hover:bg-orange-600",
  "hover:bg-green-600",
  "hover:bg-blue-600",
  "hover:bg-cyan-600",
  "hover:bg-indigo-600",
  "hover:bg-[#00a055]",
  "hover:bg-[#6a2f56]",
]);
const SHADOW_TINT = set([
  "shadow-orange-500/20",
  "shadow-green-500/20",
  "shadow-green-500/30",
  "shadow-emerald-500/20",
  "shadow-blue-500/20",
  "shadow-cyan-500/20",
  "shadow-indigo-500/20",
]);

// Mix two hex colours (CSS color-mix(in srgb, a amount, b)).
export function mixColors(a, b, amount) {
  const hex = (h) => parseInt(String(h).replace("#", "").replace(/^([0-9a-f])([0-9a-f])([0-9a-f])$/i, "$1$1$2$2$3$3"), 16);
  const x = hex(a);
  const y = hex(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return a;
  const ch = (shift) => Math.round(((x >> shift) & 255) * amount + ((y >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("")}`;
}

function primaryAlpha(primary, alpha) {
  const n = parseInt(String(primary).replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * dvColor("bg-green-500", colors) -> the colour the delivery web app actually renders for that class,
 * or `fallback` (default undefined) when the theme does not repaint it. Accepts one Tailwind class
 * ("text-blue-600", "bg-emerald-50", "bg-blue-500/10", "border-orange-200", "from-teal-500",
 * "hover:bg-green-600", "shadow-green-500/20") or an arbitrary-value class ("bg-[#10B981]").
 */
export function dvColor(className, colors = light, fallback) {
  const c = String(className || "").trim().toLowerCase();
  const primary = colors.primary || brand.primary;
  const strong = colors.primaryStrong || brand.primaryStrong;
  if (TEXT_PRIMARY.has(c) || BG_PRIMARY.has(c)) return primary;
  if (BG_SOFT.has(c)) return colors.primarySoft || brand.primarySoft;
  if (BG_PAGE.has(c)) return brand.bg;
  if (BORDER_MIX.has(c)) return mixWithWhite(primary, 0.28);
  if (HOVER_STRONG.has(c)) return strong;
  if (SHADOW_TINT.has(c)) return primaryAlpha(primary, 0.35);
  if (GRADIENT.has(c)) return c.startsWith("from-") ? primary : mixColors(strong, primary, 0.82);
  return fallback;
}

/** True when the delivery theme repaints this class (see dvColor). */
export function isRemappedToPrimary(className) {
  return dvColor(className, light, null) !== null;
}

// Gradient for a remapped "from-X to-Y" pair: primary -> color-mix(strong 82 %, primary).
export function dvGradient(colors = light) {
  const primary = colors.primary || brand.primary;
  return [primary, mixColors(colors.primaryStrong || brand.primaryStrong, primary, 0.82)];
}

// Tailwind spacing scale (4px grid); screen gutter is px-4 = 16.
export const space = (n) => n * 4;
export const gutter = 16;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14, // --radius 0.625rem: sm 6 / md 8 / lg 10 / xl 14
  "2xl": 16,
  "3xl": 24,
  full: 9999,
};

export const fontSize = {
  "2xs": 10,
  xs: 12,
  "11": 11,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
};

// Tailwind shadow-* as RN boxShadow (supported on the New Architecture).
export const shadow = {
  sm: { boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  base: { boxShadow: "0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)" },
  md: { boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)" },
  lg: { boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)" },
  xl: { boxShadow: "0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)" },
  "2xl": { boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)" },
  bottomNav: { boxShadow: "0px -4px 20px rgba(0,0,0,0.08)" },
};

// Fonts (deliveryTheme.css): body Nunito Sans (only 500/600/700/800 are loaded on web, so a 400 body
// renders at 500); h1-h4, font-black and font-extrabold use Sora (only 600/700 loaded -> 800/900 = 700).
// Android ignores fontWeight with custom fonts, so Text maps weight -> family through these tables.
// The root layout must load exactly FONT_NAMES (see docs/API_MAP.md).
export const fontFamilyByWeight = {
  "100": "NunitoSans_500Medium",
  "200": "NunitoSans_500Medium",
  "300": "NunitoSans_500Medium",
  "400": "NunitoSans_500Medium",
  normal: "NunitoSans_500Medium",
  "500": "NunitoSans_500Medium",
  "600": "NunitoSans_600SemiBold",
  "700": "NunitoSans_700Bold",
  bold: "NunitoSans_700Bold",
  // font-extrabold / font-black are Sora on web.
  "800": "Sora_700Bold",
  "900": "Sora_700Bold",
};

// Headings (h1-h4) by weight: Sora 600/700.
export const headingFontByWeight = {
  "600": "Sora_600SemiBold",
  default: "Sora_700Bold",
};

// Body text that must stay Nunito at 800 (rare; web .font-extrabold is Sora).
export const nunitoExtraBold = "NunitoSans_800ExtraBold";

export const FONT_NAMES = [
  "NunitoSans_500Medium",
  "NunitoSans_600SemiBold",
  "NunitoSans_700Bold",
  "NunitoSans_800ExtraBold",
  "Sora_600SemiBold",
  "Sora_700Bold",
];
