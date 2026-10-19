// Design tokens for the restaurant partner panel: restaurantTheme.css + Tailwind v4 palette
// (audit §5). One file for all tokens. Light only.

// Tailwind v4 default palette entries used by the restaurant screens.
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

// components/restaurant/restaurantTheme.css (audit §5.1). --rt-primary and --rt-primary-strong are
// overwritten at runtime from GET /app-config/restaurant_app (primaryColor / secondaryColor);
// ThemeContext applies those overrides. The navbar gradient is hard-coded on web and ignores them.
export const brand = {
  primary: "#B80B3D", // --rt-primary
  primaryStrong: "#66001D", // --rt-primary-strong (hover/pressed, dark buttons)
  primarySoft: "#fdf2f5", // --rt-primary-soft (active drawer item, bg-primary/5-10)
  surface: "#ffffff", // --rt-surface (cards)
  rtBorder: "#f0ccd5", // --rt-border (drawer and card borders)
  text: "#1f1f24", // --rt-text
  muted: "#6d6470", // --rt-muted (captions)
  headerGradient: ["#B80B3D", "#66001D"], // RestaurantNavbar bg-gradient-to-r, fixed
  onlineDot: "#00e676",
  loginRed: "#D3122A",
  outletPink: "#E91E63",
  blue: "#2563EB",
  pickupOtpBg: "#ecfdf5", // emerald-50
  pickupOtpBorder: "#a4f4cf", // emerald-200
  pickupOtpText: "#004f3b", // emerald-800
  pickupOtpLabel: "#009966", // emerald-600
};

// Hex colour mixed with white, like the CSS color-mix() tints the theme uses
// (e.g. border-primary = primary 30 %; the remapped plum classes = 3/6/8/15/25 % tints).
export function mixWithWhite(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").replace(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i, "#$1$1$2$2$3$3"));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift) => Math.round(((n >> shift) & 255) * amount + 255 * (1 - amount));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

// Light only: the restaurant panel has no dark mode (audit §5.5).
export const light = {
  dark: false,
  background: tw.gray50,
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
  // Button variant="secondary" = the web's hover:bg-secondary remap -> --rt-primary-strong.
  secondary: brand.primaryStrong,
  accent: brand.primarySoft,
  muted: tw.gray100,
  border: tw.gray200,
  borderLight: tw.gray100,
  rtBorder: brand.rtBorder,
  input: tw.gray300,
  destructive: tw.red600,
  success: tw.green600,
  warning: "#f54900", // orange-600
  info: tw.blue600,
  star: tw.yellow400,
  surface: tw.gray50,
  surfaceAlt: tw.gray100,
  overlay: "rgba(0,0,0,0.5)",
  navActiveBg: brand.primarySoft,
  onlineDot: brand.onlineDot,
};

// Derived per-primary colours (recomputed when the admin primary changes).
export function derivePrimaryTokens(primary) {
  return {
    primaryBorder: mixWithWhite(primary, 0.3), // border-primary
    primaryTint3: mixWithWhite(primary, 0.03), // #fcf7fb
    primaryTint6: mixWithWhite(primary, 0.06), // #f9f0f7
    primaryTint8: mixWithWhite(primary, 0.08), // #f6e9dc
    primaryTint15: mixWithWhite(primary, 0.15), // #e7d5e0, focus ring
    primaryTint25: mixWithWhite(primary, 0.25), // #d5bdd0
    focusBorder: mixWithWhite(primary, 0.55), // input focus border
  };
}

const DARK_BUTTON_COLORS = new Set(["#000", "#000000", "black", tw.gray900, "#111827", "#1a1a1a", tw.black]);

// restaurantTheme.css: every <button> with bg-black / bg-gray-900 renders in primary with white
// text, and bg-primary / bg-[#EB590E] / text-primary map to --rt-primary. Use when porting a
// web button colour: rtButtonColor("#101828", colors) -> colors.primary.
export function rtButtonColor(color, colors) {
  const c = String(color || "").toLowerCase();
  if (DARK_BUTTON_COLORS.has(c) || c === "#eb590e" || c === "primary") return colors.primary;
  return color;
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

// Poppins by weight. Android ignores fontWeight with custom fonts, so the
// Text component maps weight -> family through this table.
export const fontFamilyByWeight = {
  "300": "Poppins_300Light",
  "400": "Poppins_400Regular",
  normal: "Poppins_400Regular",
  "500": "Poppins_500Medium",
  "600": "Poppins_600SemiBold",
  "700": "Poppins_700Bold",
  bold: "Poppins_700Bold",
  "800": "Poppins_800ExtraBold",
  "900": "Poppins_900Black",
};
