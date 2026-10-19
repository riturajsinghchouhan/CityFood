// lucide Loader2 with animate-spin.
import { Loader2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

export default function Spinner({ size = 16, color, style }) {
  const [rotation] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={[{ width: size, height: size, transform: [{ rotate }] }, style]}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}
