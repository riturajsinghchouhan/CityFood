// SignIn's floating food graphics (pizza slice, location pin, cloche) and their dotted paths, with the
// web's framer-motion bobbing loops. Purely decorative; positioned inside the page container.
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// animate y: [0, dy, 0] (and optional rotate) over `duration` s, repeating, easeInOut, after `delay` s.
function useBob(duration, delay = 0) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const half = (duration * 1000) / 2;
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: half, easing: ease, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: half, easing: ease, useNativeDriver: true }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), delay * 1000);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [t, duration, delay]);
  return t;
}

export function IndiaFlag({ width = 20 }) {
  const height = (width * 2) / 3;
  return (
    <View style={[styles.flag, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 30 20">
        <Rect x="0" y="0" width="30" height="6.67" fill="#FF9933" />
        <Rect x="0" y="6.67" width="30" height="6.66" fill="#FFFFFF" />
        <Rect x="0" y="13.33" width="30" height="6.67" fill="#138808" />
        <Circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.6" />
        <Circle cx="15" cy="10" r="0.5" fill="#000080" />
      </Svg>
    </View>
  );
}

export default function LoginDecorations() {
  const pizza = useBob(5);
  const pin = useBob(4.5, 0.5);
  const cloche = useBob(5.5, 1);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          { top: 40, left: 24, zIndex: 10 },
          {
            transform: [
              { translateY: pizza.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
              { rotate: pizza.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "4deg"] }) },
            ],
          },
        ]}
      >
        <Svg width={44} height={44} viewBox="0 0 48 48" fill="none">
          <Path d="M10 12 C18 10, 30 10, 38 14 L24 40 Z" fill="#FDBA74" stroke="#FB923C" strokeWidth={2} />
          <Path d="M12 13 C18 11.5, 28 11.5, 36 15 L24 38 Z" fill="#FDE68A" />
          <Circle cx="21" cy="20" r="2.5" fill="#EF4444" />
          <Circle cx="27" cy="24" r="2" fill="#EF4444" />
          <Circle cx="23" cy="29" r="2" fill="#EF4444" />
          <Circle cx="17" cy="16" r="1.5" fill="#22C55E" />
          <Circle cx="31" cy="18" r="1.5" fill="#22C55E" />
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={[styles.abs, { top: 64, left: 48, opacity: 0.4 }]}>
        <Svg width={128} height={80} viewBox="0 0 120 80" fill="none">
          <Path d="M5 10 Q 50 60 110 50" stroke="#D6C5B3" strokeWidth={1.5} strokeDasharray="4 4" />
        </Svg>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          { top: 96, right: 36, zIndex: 10 },
          { transform: [{ translateY: pin.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] },
        ]}
      >
        <Svg width={28} height={36} viewBox="0 0 28 36" fill="none">
          <Path
            d="M14 0 C6.268 0 0 6.268 0 14 C0 24.5 14 36 14 36 C14 36 28 24.5 28 14 C28 6.268 21.732 0 14 0 Z"
            fill="#F97316"
          />
          <Circle cx="14" cy="14" r="5" fill="#FFFFFF" />
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={[styles.abs, { top: 112, right: 64, opacity: 0.4 }]}>
        <Svg width={128} height={96} viewBox="0 0 120 90" fill="none">
          <Path d="M110 10 Q 60 70 5 60" stroke="#D6C5B3" strokeWidth={1.5} strokeDasharray="4 4" />
        </Svg>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          { top: 144, right: 64, opacity: 0.7, zIndex: 10 },
          { transform: [{ translateY: cloche.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] },
        ]}
      >
        <Svg width={42} height={28} viewBox="0 0 44 32" fill="none">
          <Circle cx="22" cy="5" r="3" fill="#FDBA74" />
          <Path d="M6 24 C6 13, 14 8, 22 8 C30 8, 38 13, 38 24 Z" fill="#FED7AA" stroke="#FDBA74" strokeWidth={1.5} />
          <Rect x="2" y="24" width="40" height="3" rx="1.5" fill="#FDBA74" />
        </Svg>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  flag: { borderRadius: 2, overflow: "hidden" },
});
