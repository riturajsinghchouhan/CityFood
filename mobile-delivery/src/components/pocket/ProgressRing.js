// PocketV2 "Earnings Guarantee" circle: svg viewBox 100, r 45, stroke 8, grey track and a round-capped
// arc that animates pathLength 0 -> progress over 1.5 s easeOut, starting at 12 o'clock (-rotate-90).
import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 45;
const CIRC = 2 * Math.PI * R;

export default function ProgressRing({ progress = 0, color = "#000", size = 112, children }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.timing(anim, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 1500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [anim, progress]);
  const dashOffset = anim.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx="50" cy="50" r={R} fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <AnimatedCircle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={dashOffset}
          // framer pathLength 0 draws nothing; a round cap would still show a dot.
          strokeOpacity={progress > 0 ? 1 : 0}
        />
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </View>
  );
}
