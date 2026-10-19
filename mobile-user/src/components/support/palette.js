// Tailwind palette entries and global.css variables used by the support / info / legal
// screens that are not in theme/tokens.js.
export const c = {
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  red50: "#fef2f2",
  red100: "#fee2e2",
  red200: "#fecaca",
  red300: "#fca5a5",
  red400: "#f87171",
  red500: "#ef4444",
  red600: "#dc2626",
  red700: "#b91c1c",
  red800: "#991b1b",
  red900: "#7f1d1d",
  blue50: "#eff6ff",
  blue100: "#dbeafe",
  blue200: "#bfdbfe",
  blue300: "#93c5fd",
  blue400: "#60a5fa",
  blue600: "#2563eb",
  blue700: "#1d4ed8",
  blue800: "#1e40af",
  green100: "#dcfce7",
  green600: "#16a34a",
  green700: "#15803d",
  yellow50: "#fefce8",
  yellow100: "#fef9c3",
  yellow200: "#fef08a",
  yellow400: "#facc15",
  yellow500: "#eab308",
  yellow600: "#ca8a04",
  yellow700: "#a16207",
  amber50: "#fffbeb",
  amber100: "#fef3c7",
  amber700: "#b45309",
  amber800: "#92400e",
  amber900: "#78350f",
  amber950: "#451a03",
  orange50: "#fff7ed",
  orange100: "#ffedd5",
  orange700: "#c2410c",
  emerald50: "#ecfdf5",
  emerald100: "#d1fae5",
  emerald200: "#a7f3d0",
  emerald300: "#6ee7b7",
  emerald700: "#047857",
  emerald900: "#064e3b",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
};

// global.css: --foreground, --muted-foreground, --border, --background (light / .dark).
export function webVars(isDark) {
  return {
    foreground: isDark ? "#F3F4F6" : "#3c0f3d",
    mutedForeground: isDark ? "#9ca3af" : "#b18da5",
    border: isDark ? "#27272A" : "#e2e8f0",
    background: isDark ? "#0A0A0A" : "#F9F9FB",
    muted: isDark ? "#1f2937" : "#f1f5f9",
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
