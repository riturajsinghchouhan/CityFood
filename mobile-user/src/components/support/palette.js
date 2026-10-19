// Tailwind palette entries and global.css variables used by the support / info / legal
// screens that are not in theme/tokens.js.
export const c = {
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cad5e2",
  slate400: "#90a1b9",
  slate500: "#62748e",
  slate600: "#45556c",
  slate700: "#314158",
  slate800: "#1d293d",
  slate900: "#0f172b",
  red50: "#fef2f2",
  red100: "#ffe2e2",
  red200: "#ffc9c9",
  red300: "#ffa2a2",
  red400: "#ff6467",
  red500: "#fb2c36",
  red600: "#e7000b",
  red700: "#c10007",
  red800: "#9f0712",
  red900: "#82181a",
  blue50: "#eff6ff",
  blue100: "#dbeafe",
  blue200: "#bedbff",
  blue300: "#8ec5ff",
  blue400: "#51a2ff",
  blue600: "#155dfc",
  blue700: "#1447e6",
  blue800: "#193cb8",
  green100: "#dcfce7",
  green600: "#00a63e",
  green700: "#008236",
  yellow50: "#fefce8",
  yellow100: "#fef9c2",
  yellow200: "#fff085",
  yellow400: "#fdc700",
  yellow500: "#f0b100",
  yellow600: "#d08700",
  yellow700: "#a65f00",
  amber50: "#fffbeb",
  amber100: "#fef3c6",
  amber700: "#bb4d00",
  amber800: "#973c00",
  amber900: "#7b3306",
  amber950: "#461901",
  orange50: "#fff7ed",
  orange100: "#ffedd4",
  orange700: "#ca3500",
  emerald50: "#ecfdf5",
  emerald100: "#d0fae5",
  emerald200: "#a4f4cf",
  emerald300: "#5ee9b5",
  emerald700: "#007a55",
  emerald900: "#004f3b",
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
};

// global.css: --foreground, --muted-foreground, --border, --background (light / .dark).
export function webVars(isDark) {
  return {
    foreground: isDark ? "#F3F4F6" : "#3c0f3d",
    mutedForeground: isDark ? "#99a1af" : "#b18da5",
    border: isDark ? "#27272A" : "#e2e8f0",
    background: isDark ? "#0A0A0A" : "#F9F9FB",
    muted: isDark ? "#1e2939" : "#f1f5f9",
    inputBg: isDark ? "rgba(39,39,42,0.3)" : "#F9F9FB",
  };
}

// toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'})
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatEnInDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Invalid Date";
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hour12}:${mm} ${h < 12 ? "am" : "pm"}`;
}

// toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})
export function formatEnUsLongDate(value) {
  const d = new Date(value);
  return `${LONG_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
