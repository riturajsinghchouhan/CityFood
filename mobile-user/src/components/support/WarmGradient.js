// bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:#0a0a0a (Favorites, Help).
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";

export default function WarmGradient({ isDark }) {
  if (isDark) return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["#fbfaf5", "#ffffff", "#faf9f8"]}
      style={StyleSheet.absoluteFill}
    />
  );
}
