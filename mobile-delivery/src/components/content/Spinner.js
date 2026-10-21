// lucide Loader2 with Tailwind animate-spin (1 s linear, infinite).
import { Loader2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

export default function Spinner({ size = 32, color = "#E23744" }) {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}
