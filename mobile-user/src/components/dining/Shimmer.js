// Dining.jsx `shimmerClassName`: a white/30 band sweeping left to right every 2.2 s.
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

export default function Shimmer() {
  const [progress] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!width) return undefined;
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, width]);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-width, width * 2] }) },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.3)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
});
