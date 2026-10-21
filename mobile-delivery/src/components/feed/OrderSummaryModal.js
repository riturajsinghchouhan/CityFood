// Port of DeliveryV2/components/modals/OrderSummaryModal.jsx: full-screen "Well Done!" after a
// completed trip (bg-green-500 renders as the primary). "Go Back Home" = resetTrip.
import { ArrowRight, CheckCircle, Star, Wallet } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";
import { p } from "./palette";

// animate-bounce: translateY -25% <-> 0, 1 s.
function useBounce() {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 500, easing: Easing.bezier(0.8, 0, 1, 1), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 500, easing: Easing.bezier(0, 0, 0.2, 1), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

export default function OrderSummaryModal({ order, onDone }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bounce = useBounce();
  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [enter]);
  const earnings =
    order?.earnings || order?.riderEarning || order?.pricing?.deliveryFee || order?.orderAmount * 0.1 || 0;

  return (
    <View style={[styles.layer, { backgroundColor: colors.primary }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      >
        <Animated.View
          style={[
            styles.inner,
            { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
          ]}
        >
          <Animated.View
            style={[styles.iconCircle, { transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) }] }]}
          >
            <CheckCircle size={56} color={colors.primary} />
          </Animated.View>

          <Text heading style={styles.title}>Well Done!</Text>
          <Text style={styles.subtitle}>Trip completed successfully.</Text>

          <View style={styles.card}>
            <View style={styles.earnRow}>
              <Star size={16} color={p.orange400} fill={p.orange400} />
              <Text style={styles.earnLabel}>Earnings Added</Text>
              <Star size={16} color={p.orange400} fill={p.orange400} />
            </View>
            <Text style={styles.earn}>₹{Number(earnings).toFixed(2)}</Text>
            <View style={[styles.wallet, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}>
              <Wallet size={20} color={p.green700} />
              <Text style={styles.walletText}>Transferred to Wallet</Text>
            </View>
          </View>

          <Pressable onPress={onDone} style={({ pressed }) => [styles.doneBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
            <Text style={[styles.doneText, { color: colors.primary }]}>Go Back Home</Text>
            <ArrowRight size={24} color={colors.primary} />
          </Pressable>

          <Text style={styles.ref}>Order Reference: {order?.orderId || order?.displayOrderId || "FOD-1234"}</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 160 },
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  inner: { width: "100%", maxWidth: 384, alignItems: "center" },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  title: { color: "#ffffff", fontSize: 36, fontWeight: "700", marginBottom: 8, letterSpacing: -0.9, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: 16, marginBottom: 32, textAlign: "center" },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  earnRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 },
  earnLabel: { color: tw.gray400, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2 },
  earn: { color: tw.gray950, fontSize: 48, fontWeight: "700", marginBottom: 20, letterSpacing: -2.4, textAlign: "center" },
  wallet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  walletText: { color: p.green700, fontSize: 14, fontWeight: "700" },
  doneBtn: {
    width: "100%",
    height: 56,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    boxShadow: "0px 20px 25px -5px rgba(0,0,0,0.1)",
  },
  doneText: { fontWeight: "700", fontSize: 18 },
  ref: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 32,
    opacity: 0.8,
    textAlign: "center",
  },
});
