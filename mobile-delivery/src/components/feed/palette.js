// Tailwind v4 colours used by the feed/trip UI that theme/tokens.js `tw` does not list, and the
// tracking values. Remapped classes (green/blue/emerald/orange 500/600, -50 tints, listed borders)
// come from useTheme().dvColor / colors.primary instead; these are the ones deliveryTheme.css leaves alone.
export const p = {
  amber50: "#fffbeb",
  amber100: "#fef3c6",
  amber200: "#fee685",
  amber300: "#ffd230",
  amber400: "#ffb900",
  amber500: "#fe9a00",
  amber600: "#e17100",
  amber700: "#bb4d00",
  amber800: "#973c08",
  amber900: "#7b3306",
  amber950: "#461901",
  orange400: "#ff8904",
  orange700: "#ca3500",
  green50: "#f0fdf4",
  green100: "#dcfce7",
  green400: "#05df72",
  green500: "#00c950",
  green600: "#00a63e",
  green700: "#008236",
  emerald50: "#ecfdf5",
  emerald100: "#d0fae5",
  emerald200: "#a4f4cf",
  emerald300: "#5ee9b5",
  emerald400: "#00d492",
  emerald800: "#006045",
  emerald900: "#004f3b",
  blue50: "#eff6ff",
  blue300: "#8ec5ff",
  blue400: "#51a2ff",
  blue500: "#2b7fff",
  blue600: "#155dfc",
  red50: "#fef2f2",
  red200: "#ffc9c9",
  red500: "#fb2c36",
  red600: "#e7000b",
  purple600: "#9810fa",
};

// rgba() from a #rrggbb colour (Tailwind "/NN" opacity modifiers).
export function alpha(hex, a) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Tailwind tracking-* in px for a font size (em based).
export const tracking = {
  tighter: (size) => size * -0.05,
  tight: (size) => size * -0.025,
  wide: (size) => size * 0.025,
  wider: (size) => size * 0.05,
  widest: (size) => size * 0.1,
  em: (size, em) => size * em,
};

// linear-gradient(33deg, ...) as expo-linear-gradient start/end points.
export const GRADIENT_33DEG = { start: { x: 0.23, y: 0.92 }, end: { x: 0.77, y: 0.08 } };
// Tailwind bg-linear-to-r
export const GRADIENT_TO_RIGHT = { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
