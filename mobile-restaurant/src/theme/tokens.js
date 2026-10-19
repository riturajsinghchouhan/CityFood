// Design tokens from Frontend/src/shared/styles/global.css (:root and .user-app.dark)
// and the Tailwind palette the user screens use. One file for all tokens.

// Tailwind v4 default palette entries used by the user screens.
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
  orange50: "#fff7ed",
  orange100: "#ffedd4",
  orange500: "#ff6900",
  amber500: "#fe9a00",
  yellow400: "#fdc700",
  blue50: "#eff6ff",
  blue600: "#155dfc",
};

export const brand = {
  primary: "#7e3866",
  secondary: "#55254b",
  accent: "#b18da5",
  plumText: "#3c0f3d",
  plumTint: "#FDFAFC",
  navActive: "#FFEEF2",
  vegGreen: "#0A4D27",
  offerRed: "#E52E2E",
  zomatoRed: "#CB202D",
};

export const light = {
  dark: false,
  background: "#F9F9FB",
  card: "#ffffff",
  foreground: brand.plumText,
  text: tw.gray900,
  textSecondary: tw.gray600,
  textMuted: tw.gray500,
  textFaint: tw.gray400,
  primary: brand.primary,
  primaryForeground: "#ffffff",
  secondary: brand.secondary,
  accent: brand.accent,
  muted: tw.slate100,
  border: tw.gray200,
  borderLight: tw.gray100,
  input: tw.slate200,
  destructive: tw.red500,
  success: tw.green600,
  star: tw.yellow400,
  surface: tw.gray50,
  surfaceAlt: tw.gray100,
  overlay: "rgba(0,0,0,0.5)",
  navActiveBg: brand.navActive,
};

export const dark = {
  dark: true,
  background: "#0A0A0A",
  card: "#1A1A1A",
  foreground: "#F3F4F6",
  text: "#ffffff",
  textSecondary: tw.gray300,
  textMuted: tw.gray400,
  textFaint: tw.gray500,
  primary: "#F76208",
  primaryForeground: "#ffffff",
  secondary: "#000000",
  accent: tw.gray800,
  muted: tw.gray800,
  border: tw.gray800,
  borderLight: tw.gray800,
  input: "#27272A",
  destructive: tw.red500,
  success: tw.green500,
  star: tw.yellow400,
  surface: "#141414",
  surfaceAlt: tw.gray800,
  overlay: "rgba(0,0,0,0.6)",
  navActiveBg: "#2A2A2A",
};

// Tailwind spacing scale (4px grid); screen gutter is px-4 = 16.
export const space = (n) => n * 4;
export const gutter = 16;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
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
