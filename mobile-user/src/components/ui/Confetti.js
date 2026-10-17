// canvas-confetti replacement for the order-placed and booking-success bursts.
import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

const COLORS = ["#26ccff", "#a25afd", "#ff5e7e", "#88ff5a", "#fcff42", "#ffa62d", "#ff36ff"];

export default function Confetti({ count = 80, duration = 2600, onDone }) {
  const { width, height } = Dimensions.get("window");
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        color: COLORS[i % COLORS.length],
        dx: (Math.random() - 0.5) * width * 1.2,
        peak: -(height * (0.25 + Math.random() * 0.25)),
        spin: (Math.random() - 0.5) * 1440,
        size: 6 + Math.random() * 6,
      })),
    [count, width, height],
  );

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => finished && onDone?.());
    return () => anim.stop();
  }, [progress, duration, onDone]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: "absolute",
            left: width / 2,
            top: height * 0.6,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            opacity: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 0.35, 1],
                  outputRange: [0, p.peak, height * 0.3],
                }),
              },
              {
                rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
