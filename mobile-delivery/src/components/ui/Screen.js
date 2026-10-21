// Page container: safe areas, status bar and the page background (web min-h-screen bg-*).
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";

/**
 * edges: which safe-area insets to pad ("top", "bottom"). Screens with a full-bleed
 * hero image pass edges={[]} and handle the top inset themselves.
 * background: overrides the page color (web pages vary: bg-white, bg-[#f5f5f5], ...).
 */
export default function Screen({ children, edges = ["top"], background, style, statusBarStyle }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: background || colors.background,
          paddingTop: edges.includes("top") ? insets.top : 0,
          paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
        },
        style,
      ]}
    >
      <StatusBar style={statusBarStyle || (isDark ? "light" : "dark")} />
      {children}
    </View>
  );
}
