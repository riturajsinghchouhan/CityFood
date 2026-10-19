// Entrance animation for AnimatedPage (fade + translateY 20, 220 ms) and the
// framer-motion `initial={{opacity: 0, y}} animate={{opacity: 1, y: 0}}` blocks.
import { useEffect, useState } from "react";
import { Animated } from "react-native";

export default function FadeIn({ delay = 0, duration = 220, offset = 20, scaleFrom, style, children }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(progress, { toValue: 1, duration, delay, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, duration]);
  const transform = [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }];
  if (scaleFrom != null) {
    transform.push({ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, 1] }) });
  }
  return <Animated.View style={[style, { opacity: progress, transform }]}>{children}</Animated.View>;
}
