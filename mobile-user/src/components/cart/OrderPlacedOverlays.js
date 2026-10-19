// Full-screen "Congratulations! You saved" and "Order Placed!" views shown after placing an order
// (Cart.jsx showSavingsCongrats / showOrderSuccess), with the CSS falling-confetti loop ported to Animated.
import { LinearGradient } from "expo-linear-gradient";
import { MapPin, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "../ui";
import { radius, shadow, tw } from "../../theme/tokens";
import { RUPEE } from "../../screens/cart/cartUtils";
import { useCartPalette } from "./palette";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// confettiFall: translateY(-10vh) -> 110vh with 720deg spin, fading out, infinite.
function FallingConfetti({ count, colors, size, round, minDur, spread, maxDelay }) {
  const { width, height } = Dimensions.get("window");
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      key: i,
      left: Math.random() * width,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: (minDur + Math.random() * spread) * 1000,
      delay: Math.random() * maxDelay * 1000,
      startRotate: Math.random() * 360,
      value: new Animated.Value(0),
    })),
  );
  useEffect(() => {
    const anims = pieces.map((p) =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.loop(Animated.timing(p.value, { toValue: 1, duration: p.duration, easing: Easing.linear, useNativeDriver: true })),
      ]),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [pieces]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: "absolute",
            top: -height * 0.1,
            left: p.left,
            width: size,
            height: size,
            borderRadius: round ? size / 2 : 2,
            backgroundColor: p.color,
            opacity: p.value.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateY: p.value.interpolate({ inputRange: [0, 1], outputRange: [0, height * 1.2] }) },
              {
                rotate: p.value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [`${p.startRotate}deg`, `${p.startRotate + 720}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

// SVG props (the check stroke) cannot use the native driver.
function useEntrance(delay, duration = 500, useNativeDriver = true) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver });
    a.start();
    return () => a.stop();
  }, [v, delay, duration, useNativeDriver]);
  return v;
}

const slideUp = (v) => ({
  opacity: v,
  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
});

export function SavingsCongrats({ visible, amount, percentage, items }) {
  const p = useCartPalette();
  const [bounce] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visible) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, bounce]);
  if (!visible) return null;
  return (
    <Modal visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>
      <LinearGradient
        colors={p.isDark ? ["#0a1a0a", "#0a2a0a"] : [tw.green50, "#ecfdf5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.center}
      >
        <FallingConfetti count={40} colors={["#22c55e", "#10b981", "#34d399", "#6ee7b7"]} size={8} round minDur={2.5} spread={1.5} maxDelay={1} />
        <View style={styles.content}>
          <Animated.View
            style={{
              marginBottom: 32,
              transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -25] }) }],
            }}
          >
            <LinearGradient colors={[tw.yellow400, "#eab308"]} style={styles.trophy}>
              <Text style={{ fontSize: 48, lineHeight: 60 }}>{"\u{1F389}"}</Text>
            </LinearGradient>
          </Animated.View>
          <Text style={[styles.congrats, { color: p.white900 }]}>Congratulations!</Text>
          <View style={{ alignItems: "center" }}>
            <Text style={[styles.savedLabel, { color: p.isDark ? tw.gray300 : tw.gray600 }]}>You saved approx</Text>
            <Text style={[styles.savedAmount, { color: p.isDark ? "#4ade80" : tw.green600 }]}>
              {RUPEE}
              {amount.toFixed(0)}
            </Text>
            <Text style={[styles.cheaper, { color: p.t600 }]}>{percentage}% cheaper than other platforms</Text>
          </View>
          {items.length > 0 ? (
            <View
              style={[
                styles.itemsBox,
                { backgroundColor: p.card, borderColor: p.isDark ? "rgba(20,83,45,0.5)" : "#bbf7d0" },
              ]}
            >
              <Text style={[styles.itemsTitle, { color: p.t700 }]}>Savings on your items:</Text>
              <View style={{ gap: 8 }}>
                {items.slice(0, 3).map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={[styles.itemText, { color: p.t600, flex: 1 }]}>{item.name}</Text>
                    <Text style={[styles.itemText, { fontWeight: "600", color: p.isDark ? "#4ade80" : tw.green600 }]}>
                      -{RUPEE}
                      {item.savings.toFixed(0)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </Modal>
  );
}

function SuccessBody({ addressCity, addressText, savingsAmount, platformSavings, onTrack, p }) {
  const circle = useEntrance(200, 500);
  const check = useEntrance(500, 500, false);
  const sparkles = useEntrance(300, 600);
  const location = useEntrance(600);
  const message = useEntrance(800);
  const card = useEntrance(1000, 600);
  const button = useEntrance(1000);
  const [ring] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [ring]);

  return (
    <View style={styles.content}>
      <Animated.View
        style={{
          marginBottom: 32,
          opacity: circle,
          transform: [{ scale: circle.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }],
        }}
      >
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: p.isDark ? "#4ade80" : tw.green500,
              opacity: ring.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] }) }],
            },
          ]}
        />
        <LinearGradient
          colors={p.isDark ? [tw.green500, "#10b981"] : [tw.green500, tw.green600]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.checkCircle}
        >
          <Svg width={64} height={64} viewBox="0 0 24 24">
            <AnimatedPath
              d="M5 12l5 5L19 7"
              fill="none"
              stroke="#ffffff"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="100"
              strokeDashoffset={check.interpolate({ inputRange: [0, 1], outputRange: [100, 0] })}
            />
          </Svg>
        </LinearGradient>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.sparkle,
              {
                backgroundColor: p.isDark ? "#fde047" : tw.yellow400,
                opacity: sparkles.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [
                  { rotate: `${i * 60}deg` },
                  { translateY: sparkles.interpolate({ inputRange: [0, 1], outputRange: [0, -80] }) },
                  { scale: sparkles },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>

      <Animated.View style={[{ alignItems: "center" }, slideUp(location)]}>
        <View style={styles.cityRow}>
          <MapPin size={20} color={p.isDark ? "#f87171" : tw.red500} fill={p.isDark ? "#f87171" : tw.red500} />
          <Text style={[styles.city, { color: p.white900 }]}>{addressCity}</Text>
        </View>
        <Text style={[styles.addrText, { color: p.isDark ? tw.gray400 : tw.gray500 }]}>{addressText}</Text>
      </Animated.View>

      <Animated.View style={[{ marginTop: 48, alignItems: "center" }, slideUp(message)]}>
        <Text style={[styles.placed, { color: p.isDark ? "#a65d8a" : p.primary }]}>Order Placed!</Text>
        <Text style={{ color: p.isDark ? tw.gray300 : tw.gray600, fontSize: 16 }}>Your delicious food is on its way</Text>
        {savingsAmount > 0 ? (
          <Text style={{ marginTop: 8, fontSize: 14, color: p.isDark ? "#a65d8a" : p.primary }}>
            You save approx {RUPEE}
            {savingsAmount.toFixed(0)} on this order
          </Text>
        ) : null}
      </Animated.View>

      {platformSavings.hasPlatformPricing && platformSavings.totalSavings > 0 ? (
        <Animated.View
          style={[
            styles.saveCard,
            {
              backgroundColor: p.primary + (p.isDark ? "26" : "14"),
              borderColor: p.primary + "4D",
              opacity: card,
              transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}
        >
          <View style={styles.saveCardHeader}>
            <Sparkles size={20} color={p.primary} />
            <Text style={{ fontWeight: "700", color: p.primary }}>You Saved on this Order</Text>
          </View>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 36, fontWeight: "900", color: p.primary, lineHeight: 44 }}>
              {RUPEE}
              {platformSavings.totalSavings.toFixed(0)}
            </Text>
            <Text style={{ fontSize: 14, color: p.t600 }}>
              {platformSavings.savingsPercentage}% cheaper than other platforms
            </Text>
            <Text style={{ fontSize: 12, color: tw.gray500, marginTop: 8, textAlign: "center" }}>
              By ordering with us instead of Swiggy, Zomato, & others
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View style={slideUp(button)}>
        <Pressable
          onPress={onTrack}
          style={({ pressed }) => [
            styles.track,
            { backgroundColor: pressed ? p.colors.secondary : p.primary, boxShadow: `0px 10px 15px -3px ${p.primary}33` },
          ]}
        >
          <Text style={styles.trackText}>Track Your Order</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function OrderSuccess({ visible, onTrack, ...rest }) {
  const p = useCartPalette();
  if (!visible) return null;
  return (
    <Modal visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>
      <View style={[styles.center, { backgroundColor: p.isDark ? "#0a0a0a" : "#ffffff" }]}>
        <FallingConfetti
          count={50}
          colors={["#7e3866", "#3b82f6", "#f59e0b", "#ef4444", "#55254b", "#ec4899"]}
          size={12}
          minDur={2}
          spread={2}
          maxDelay={2}
        />
        <SuccessBody {...rest} onTrack={onTrack} p={p} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  content: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 48, width: "100%" },
  trophy: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    ...shadow["2xl"],
  },
  congrats: { fontSize: 36, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  savedLabel: { fontSize: 18, marginBottom: 8 },
  savedAmount: { fontSize: 48, fontWeight: "700", marginBottom: 16, lineHeight: 60 },
  cheaper: { fontSize: 16 },
  itemsBox: { marginTop: 32, maxWidth: 384, width: "100%", borderRadius: radius.lg, padding: 16, borderWidth: 1 },
  itemsTitle: { fontSize: 14, fontWeight: "600", marginBottom: 12, textAlign: "center" },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  itemText: { fontSize: 14 },
  ring: { position: "absolute", width: 128, height: 128, borderRadius: 64, borderWidth: 4 },
  checkCircle: { width: 128, height: 128, borderRadius: 64, alignItems: "center", justifyContent: "center", ...shadow["2xl"] },
  sparkle: { position: "absolute", top: 60, left: 60, width: 8, height: 8, borderRadius: 4 },
  cityRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 },
  city: { fontSize: 24, fontWeight: "700" },
  addrText: { fontSize: 16, textAlign: "center" },
  placed: { fontSize: 30, fontWeight: "700", marginBottom: 8 },
  saveCard: { marginTop: 32, width: "100%", maxWidth: 384, borderWidth: 1, borderRadius: radius["2xl"], padding: 16 },
  saveCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  track: { marginTop: 40, paddingVertical: 16, paddingHorizontal: 48, borderRadius: radius.xl },
  trackText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
});
