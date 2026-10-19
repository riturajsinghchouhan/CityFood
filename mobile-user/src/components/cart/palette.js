// Light/dark pairs the Cart screen uses over and over (bg-white dark:bg-[#1a1a1a], ...).
import { useMemo } from "react";
import { View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadow, tw } from "../../theme/tokens";

export function useCartPalette() {
  const { colors, isDark } = useTheme();
  return useMemo(
    () => ({
      colors,
      isDark,
      primary: colors.primary,
      page: isDark ? "#0a0a0a" : "#f8fafc",
      card: isDark ? "#1a1a1a" : "#ffffff",
      cardBorder: isDark ? tw.gray800 : tw.slate100,
      border: isDark ? tw.gray700 : tw.gray200,
      divider: isDark ? tw.gray800 : tw.gray200,
      inputBg: isDark ? "#0a0a0a" : "#ffffff",
      t900: isDark ? tw.gray100 : tw.gray900,
      t800: isDark ? tw.gray200 : tw.gray800,
      t700: isDark ? tw.gray300 : tw.gray700,
      t600: isDark ? tw.gray400 : tw.gray600,
      t500: isDark ? tw.gray400 : tw.gray500,
      t400: isDark ? tw.gray500 : tw.gray400,
      white900: isDark ? "#ffffff" : tw.gray900,
      // bg-[#7e386605] / dark:bg-[#7e386610] tints are hard-coded hex on web.
      plumTint: isDark ? "#7e386610" : "#7e386605",
      cardStyle: {
        backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
        borderColor: isDark ? tw.gray800 : tw.slate100,
        borderWidth: 1,
        borderRadius: radius["2xl"],
        paddingHorizontal: 16,
        ...shadow.sm,
      },
    }),
    [colors, isDark],
  );
}

// border-dashed single-side divider (RN only dashes a uniform border, so clip a dashed box).
export function DashedDivider({ color, style }) {
  return (
    <View style={[{ height: 1, overflow: "hidden" }, style]}>
      <View style={{ height: 2, borderWidth: 1, borderColor: color, borderStyle: "dashed" }} />
    </View>
  );
}
