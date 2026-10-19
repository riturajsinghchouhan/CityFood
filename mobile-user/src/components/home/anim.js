// Small animation pieces shared by the Home sections: the skewed white "glint" that
// sweeps across category circles, explore tiles and hero banners, and the fade-in-up entrance.
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

/**
 * Glint over a box of `width`. The gradient strip is 150% wide and travels from
 * translateX(-200%) to 200% of its own width, like the web classes.
 * mode "loop": framer `x: ["-200%","200%"]`, `duration`, then `repeatDelay` pause, forever.
 * mode "keyframe": the `explore-shine` keyframes (hold 15%, sweep to 50%, hold), `duration` per cycle.
 */
export function Shine({ width, duration = 2000, delay = 0, repeatDelay = 0, mode = "loop", alpha = 0.4, skew = -20 }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const ease = Easing.inOut(Easing.ease);
    const cycle =
      mode === "keyframe"
        ? Animated.sequence([
            Animated.delay(duration * 0.15),
            Animated.timing(t, { toValue: 1, duration: duration * 0.35, easing: ease, useNativeDriver: true }),
            Animated.delay(duration * 0.5),
          ])
        : Animated.sequence([
            Animated.timing(t, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
            Animated.delay(repeatDelay),
          ]);
    const anim = Animated.sequence([Animated.delay(delay), Animated.loop(cycle)]);
    anim.start();
    return () => anim.stop();
  }, [t, duration, delay, repeatDelay, mode]);

  if (!width) return null;
  const strip = width * 1.5;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [-2 * strip, 2 * strip] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.shine, { width: strip, transform: [{ translateX }, { skewX: `${skew}deg` }] }]}
    >
      <LinearGradient
        colors={["rgba(255,255,255,0)", `rgba(255,255,255,${alpha})`, "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** CSS `fade-in-up` (opacity 0 → 1, translateY 20 → 0) with a start delay. */
export function FadeInUp({ delay = 0, duration = 350, style, children }) {
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(p, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [p, delay, duration]);
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  return <Animated.View style={[style, { opacity: p, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** Repeating keyframe loop: returns an Animated.Value cycling 0 → 1 over `duration` (optionally ping-pong). */
export function useLoop(duration, { delay = 0, linear = false, pingPong = false, native = true } = {}) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const easing = linear ? Easing.linear : Easing.inOut(Easing.ease);
    const cfg = { easing, useNativeDriver: native };
    const step = pingPong
      ? Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: duration / 2, ...cfg }),
          Animated.timing(v, { toValue: 0, duration: duration / 2, ...cfg }),
        ])
      : Animated.timing(v, { toValue: 1, duration, ...cfg });
    const anim = Animated.sequence([Animated.delay(delay), Animated.loop(step)]);
    anim.start();
    return () => anim.stop();
  }, [v, duration, delay, linear, pingPong, native]);
  return v;
}

const styles = StyleSheet.create({
  shine: { position: "absolute", top: 0, bottom: 0, left: 0 },
});
