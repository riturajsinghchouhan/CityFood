import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { radius } from "../../theme/tokens";
import Text from "./Text";

// components/ui/button.tsx variants: default, destructive, outline, secondary, ghost, link.
// Sizes: default h-9, sm h-8, lg h-10, icon 36.
const HEIGHT = { default: 36, sm: 32, lg: 40, icon: 36, "icon-sm": 32, "icon-lg": 40 };

export default function Button({
  variant = "default",
  size = "default",
  title,
  children,
  loading = false,
  disabled = false,
  onPress,
  style,
  textStyle,
  left,
  right,
  ...props
}) {
  const { colors } = useTheme();
  const isIcon = size.startsWith("icon");
  const palette = {
    default: { bg: colors.primary, fg: colors.primaryForeground, border: "transparent" },
    destructive: { bg: colors.destructive, fg: "#ffffff", border: "transparent" },
    outline: { bg: colors.dark ? "rgba(39,39,42,0.3)" : colors.card, fg: colors.text, border: colors.input },
    secondary: { bg: colors.secondary, fg: "#ffffff", border: "transparent" },
    ghost: { bg: "transparent", fg: colors.text, border: "transparent" },
    link: { bg: "transparent", fg: colors.primary, border: "transparent" },
  }[variant];

  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size] || HEIGHT.default,
          width: isIcon ? HEIGHT[size] : undefined,
          paddingHorizontal: isIcon ? 0 : size === "lg" ? 24 : size === "sm" ? 12 : 16,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === "outline" ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {left}
          {title != null ? (
            <Text
              style={[
                { color: palette.fg, fontWeight: "500" },
                variant === "link" && { textDecorationLine: "underline" },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : (
            children
          )}
          {right}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
