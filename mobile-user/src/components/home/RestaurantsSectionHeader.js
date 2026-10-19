// Home.jsx restaurants section top (web L2491-2561, L2564-2672): "N Restaurants Delivering
// to You / All Restaurants", and the animated chef-mascot "Service Unavailable" state
// shown instead of the list when the location is out of the delivery radius.
import { Flame, Pizza, UtensilsCrossed } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { Text } from "../ui";
import { useLoop } from "./anim";

const chefMascot = require("../../../assets/images/chef-mascot.png");

export function RestaurantsHeading({ count }) {
  const { isDark } = useTheme();
  return (
    <View style={styles.heading}>
      <Text style={[styles.count, { color: tw.gray400 }]}>{`${count} RESTAURANTS DELIVERING TO YOU`}</Text>
      <Text style={[styles.all, { color: isDark ? "#ffffff" : tw.gray900 }]}>All Restaurants</Text>
    </View>
  );
}

function Floating({ style, duration, delay = 0, y = 0, x = 0, rotate = 0, scale = 1, children }) {
  const v = useLoop(duration, { pingPong: true, delay });
  const transform = [
    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
    { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${rotate}deg`] }) },
    { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) },
  ];
  return <Animated.View style={[style, { transform }]}>{children}</Animated.View>;
}

function Glow({ color, duration, delay = 0, from, to, opacityFrom, opacityTo, size }) {
  const v = useLoop(duration, { pingPong: true, delay });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [opacityFrom, opacityTo] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }],
        },
      ]}
    />
  );
}

function Particle({ i, color }) {
  const v = useLoop(3000 + i * 200, { delay: i * 600, linear: true });
  const size = 8 + (i % 2) * 4;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 0] }),
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, (i - 2) * 40] }) },
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
            { scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) },
          ],
        },
      ]}
    />
  );
}

function Bar({ reverse, delay = 0, color }) {
  const v = useLoop(2500, { pingPong: true, delay, native: false });
  const [a, b] = reverse ? [40, 8] : [8, 40];
  return (
    <Animated.View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        width: v.interpolate({ inputRange: [0, 1], outputRange: [a, b] }),
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: reverse ? [0.5, 1] : [0.2, 0.5] }),
      }}
    />
  );
}

/** message: useAppLocation().serviceUnavailableMessage. */
export function OutOfRadiusState({ message }) {
  const { colors, isDark } = useTheme();
  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(enter, { toValue: 1, duration: 800, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [enter]);

  return (
    <View style={styles.oor}>
      <Animated.View
        style={[
          styles.oorInner,
          {
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
          },
        ]}
      >
        <View style={styles.stage}>
          <Glow color={colors.primary} duration={4000} from={1} to={1.4} opacityFrom={0.15} opacityTo={0.35} size={176} />
          <Glow color="#fb7185" duration={5000} delay={1000} from={1.3} to={1} opacityFrom={0.1} opacityTo={0.25} size={176} />
          <Floating style={styles.pizza} duration={4000} y={-15} rotate={15} scale={1.1}>
            <Pizza size={48} color="rgba(251,146,60,0.4)" strokeWidth={1} />
          </Floating>
          <Floating style={styles.utensils} duration={5000} delay={1000} y={15} rotate={-20} scale={1.05}>
            <UtensilsCrossed size={40} color="rgba(251,113,133,0.4)" strokeWidth={1} />
          </Floating>
          <Floating style={styles.flame} duration={6000} delay={1500} x={12} y={-10}>
            <Flame size={32} color="rgba(251,191,36,0.3)" strokeWidth={1} />
          </Floating>
          <Floating style={styles.mascotWrap} duration={3500} y={-25}>
            <View
              style={[
                styles.mascot,
                {
                  backgroundColor: isDark ? "rgba(26,26,26,0.8)" : "rgba(255,255,255,0.8)",
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)",
                },
              ]}
            >
              <Image source={chefMascot} style={styles.mascotImg} resizeMode="contain" accessibilityLabel="Chef Mascot" />
            </View>
          </Floating>
          {[0, 1, 2, 3, 4].map((i) => (
            <Particle key={i} i={i} color={i % 2 === 0 ? `${colors.primary}66` : "rgba(251,113,133,0.4)"} />
          ))}
        </View>

        <Text style={[styles.title, { color: colors.primary }]}>Service Unavailable</Text>
        <Text style={[styles.message, { color: isDark ? tw.gray400 : tw.gray500 }]}>
          {message || "Service is currently unavailable."} Please try another delivery location.
        </Text>

        <View style={styles.bars}>
          <Bar color={colors.primary} />
          <Bar color={colors.primary} reverse />
          <Bar color={colors.primary} delay={500} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { paddingHorizontal: 16, marginBottom: 12, gap: 2 },
  count: { fontSize: 12, fontWeight: "600", letterSpacing: 1.2 },
  all: { fontSize: 16, fontWeight: "700", letterSpacing: -0.4 },
  oor: { paddingVertical: 64, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", minHeight: 480 },
  oorInner: { alignItems: "center", maxWidth: 384 },
  stage: { marginBottom: 56, width: 176, height: 176, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute" },
  pizza: { position: "absolute", top: -40, left: -40 },
  utensils: { position: "absolute", bottom: -24, right: -48 },
  flame: { position: "absolute", top: 16, right: -56 },
  mascotWrap: { zIndex: 10 },
  mascot: {
    width: 176,
    height: 176,
    borderRadius: 48,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    boxShadow: "0px 20px 50px rgba(126,56,102,0.3)",
  },
  mascotImg: { width: "100%", height: "100%", transform: [{ scale: 1.15 }] },
  particle: { position: "absolute", top: "50%", left: "50%" },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 16, letterSpacing: -0.75, lineHeight: 36, textAlign: "center" },
  message: { fontSize: 16, fontWeight: "500", lineHeight: 26, paddingHorizontal: 16, maxWidth: 320, textAlign: "center" },
  bars: { marginTop: 48, flexDirection: "row", alignItems: "center", gap: 12 },
});
