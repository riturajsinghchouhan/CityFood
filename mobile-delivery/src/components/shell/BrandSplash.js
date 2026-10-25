// Branded launch splash: the app logo on white, fading in with a gentle pulse and shown for at
// least MIN_MS, then fading out. Mounted once at the root, over the screens, after the native
// splash (same logo, same size) hides, so the hand-off is seamless.
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

const MIN_MS = 2000;
const logo = require("../../../assets/splash-native.png");

export default function BrandSplash() {
  const [visible, setVisible] = useState(true);
  const [fade] = useState(() => new Animated.Value(1));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => setVisible(false));
    }, MIN_MS);
    return () => {
      loop.stop();
      clearTimeout(timer);
    };
  }, [fade, pulse]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles.fill, { opacity: fade }]} pointerEvents="auto">
      <Animated.Image
        source={logo}
        resizeMode="contain"
        style={[styles.logo, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999 },
  logo: { width: 288, height: 288 },
});
