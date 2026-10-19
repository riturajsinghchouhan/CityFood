// Decorative pieces of auth/Login.jsx: the green basil leaf SVG, the sliced-tomato badge and the
// curved wave that separates the banner from the page.
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

export function BotanicalLeaf({ size = 32, rotate = 0, opacity = 0.9 }) {
  return (
    <View style={{ width: size, height: size, opacity, transform: [{ rotate: `${rotate}deg` }] }}>
      <Svg viewBox="0 0 64 64" width={size} height={size}>
        <Defs>
          <LinearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4ADE80" />
            <Stop offset="45%" stopColor="#22C55E" />
            <Stop offset="100%" stopColor="#15803D" />
          </LinearGradient>
        </Defs>
        <Path d="M12 52 C 16 32, 34 16, 56 10 C 52 30, 36 48, 12 52 Z" fill="url(#leafGrad)" />
        <Path d="M14 50 Q 32 30 52 14" stroke="#166534" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} fill="none" />
        <Path d="M26 38 Q 32 34 36 36" stroke="#166534" strokeWidth={1} strokeLinecap="round" opacity={0.4} fill="none" />
        <Path d="M36 28 Q 42 24 46 26" stroke="#166534" strokeWidth={1} strokeLinecap="round" opacity={0.4} fill="none" />
      </Svg>
    </View>
  );
}

// w-16 h-16 rounded-full bg-radial from-[#FF3B30] to-[#B00A25], border-2 #FF6B6B/40, with seeds.
export function TomatoBadge() {
  return (
    <View style={styles.tomato}>
      <Svg width={64} height={64} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="tomatoGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF3B30" />
            <Stop offset="100%" stopColor="#B00A25" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={64} height={64} fill="url(#tomatoGrad)" />
      </Svg>
      <View style={styles.tomatoInner}>
        <View style={[styles.seed, styles.seedCenter]} />
        <View style={[styles.seed, { top: 4, left: 12 }]} />
        <View style={[styles.seed, { bottom: 8, right: 8 }]} />
        <View style={[styles.seed, { top: 8, right: 8 }]} />
      </View>
    </View>
  );
}

// viewBox 0 0 500 120, preserveAspectRatio none, h-16, fill #FFFDF9.
export function BannerWave({ color = "#FFFDF9" }) {
  return (
    <Svg viewBox="0 0 500 120" preserveAspectRatio="none" width="100%" height={64}>
      <Path d="M0,0 C150,110 350,110 500,0 L500,120 L0,120 Z" fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  tomato: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,107,107,0.4)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  tomatoInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,240,133,0.4)",
  },
  seed: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,240,133,0.8)" },
  seedCenter: { width: 8, height: 8, borderRadius: 4, top: 19, left: 19, backgroundColor: "rgba(254,252,232,0.6)" },
});
