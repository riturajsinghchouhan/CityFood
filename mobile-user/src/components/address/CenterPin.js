// Fixed green pin over the map center (AddressSelectorPage.jsx), with the bounce-short and pulse loops.
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { shadow, tw } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeContext";

export default function CenterPin() {
  const { isDark } = useTheme();
  const [bounce] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const pl = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    b.start();
    pl.start();
    return () => {
      b.stop();
      pl.stop();
    };
  }, [bounce, pulse]);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.pin}>
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: isDark ? "rgba(20,83,45,0.3)" : tw.green100,
              transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            },
          ]}
        >
          <View style={styles.head}>
            <Animated.View style={[styles.dot, { opacity: pulse }]} />
          </View>
        </Animated.View>
        <View style={styles.stick} />
        <View style={styles.shadow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  pin: { marginBottom: 32, alignItems: "center" },
  halo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -6,
    zIndex: 1,
    ...shadow.sm,
  },
  head: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tw.green600,
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffffff" },
  stick: {
    width: 6,
    height: 24,
    backgroundColor: tw.green600,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#ffffff",
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    ...shadow.xl,
  },
  shadow: {
    position: "absolute",
    bottom: -4,
    width: 18,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
});
