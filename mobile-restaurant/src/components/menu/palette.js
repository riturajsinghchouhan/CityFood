// Tailwind v4 palette values used by the menu screens (Inventory, ItemDetailsPage,
// MenuCategoriesPage) that are not in theme/tokens.js `tw`.
import { tw } from "../../theme/tokens";

export const pal = {
  ...tw,
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cad5e2",
  slate400: "#90a1b9",
  slate500: "#62748e",
  slate600: "#45556c",
  slate700: "#314158",
  slate800: "#1d293d",
  slate900: "#0f172b",
  slate950: "#020618",
  emerald50: "#ecfdf5",
  emerald200: "#a4f4cf",
  emerald700: "#007a55",
  amber50: "#fffbeb",
  amber100: "#fef3c6",
  amber200: "#fee685",
  amber700: "#bb4d00",
  rose50: "#fff1f2",
  rose100: "#ffe4e6",
  rose200: "#ffccd3",
  rose500: "#ff2056",
  rose600: "#ec003f",
  rose700: "#c70036",
  green200: "#b9f8cf",
  green300: "#7bf1a8",
  red200: "#ffc9c9",
  red800: "#9f0712",
  blue100: "#dbeafe",
  blue300: "#8ec5ff",
  blue700: "#1447e6",
  blue900: "#1c398e",
  sky50: "#f0f9ff",
  sky200: "#b8e6fe",
  sky700: "#0069a8",
  yellow100: "#fef9c2",
  yellow800: "#894b00",
  orange200: "#ffd6a7",
  orange600: "#f54900",
  orange700: "#ca3500",
  pageBg: "#f3f5f8", // Inventory bg-[#f3f5f8]
  plumBorder: "#ead6e3", // border-[#ead6e3] (not remapped by restaurantTheme.css)
  plumChip: "#f6ecf3", // bg-[#f6ecf3]
  plumCount: "#8a7a89", // text-[#8a7a89]
};

// CSS color-mix(in srgb, a p%, b).
export function mixHex(a, b, p) {
  const parse = (hex) => {
    const h = String(hex).replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const ca = parse(a);
  const cb = parse(b);
  return `#${ca.map((v, i) => Math.round(v * p + cb[i] * (1 - p)).toString(16).padStart(2, "0")).join("")}`;
}
