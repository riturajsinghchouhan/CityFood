// framer-motion initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} on mount.
import { useEffect, useState } from "react";
import { Animated } from "react-native";

export default function FadeInUp({ from = 10, duration = 300, delay = 0, style, children }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(progress, { toValue: 1, duration, delay, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [progress, duration, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
