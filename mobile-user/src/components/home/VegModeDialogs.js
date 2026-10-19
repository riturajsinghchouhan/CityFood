// Home.jsx veg-mode UI (web L3092-3297, L3390-3540): the "See veg dishes from" popup when
// turning Veg Mode on, the "Switch off Veg Mode?" confirm, and the two 2-second
// full-screen transitions ("100% VEG" ripple, "Switching off" spinner).
import { AlertCircle } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { Text } from "../ui";
import { useLoop } from "./anim";

function usePop(visible) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visible) {
      v.setValue(0);
      return undefined;
    }
    const anim = Animated.spring(v, { toValue: 1, damping: 25, stiffness: 300, mass: 0.8, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [visible, v]);
  return v;
}

function Radio({ selected }) {
  const { isDark } = useTheme();
  return (
    <View
      style={[
        styles.radio,
        selected
          ? { borderColor: isDark ? tw.green500 : tw.green600, backgroundColor: isDark ? tw.green500 : tw.green600 }
          : { borderColor: isDark ? "#4b5563" : tw.gray300, backgroundColor: isDark ? "#2a2a2a" : "#ffffff" },
      ]}
    >
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

/** option: "all" | "pure-veg". onDismiss: backdrop / back (reverts Veg Mode). onApply. */
export function VegModePopup({ visible, option, onSelectOption, onApply, onDismiss }) {
  const { colors, isDark } = useTheme();
  const pop = usePop(visible);
  const textColor = isDark ? "#ffffff" : tw.gray900;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.3)" }]} onPress={onDismiss} />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.popup,
            {
              backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
              opacity: pop,
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              ],
            },
          ]}
        >
          <Text style={[styles.popupTitle, { color: textColor }]}>See veg dishes from</Text>
          <View style={styles.options}>
            <Pressable style={styles.option} onPress={() => onSelectOption("all")}>
              <Radio selected={option === "all"} />
              <Text style={[styles.optionText, { color: textColor }]}>All restaurants</Text>
            </Pressable>
            <Pressable style={styles.option} onPress={() => onSelectOption("pure-veg")}>
              <Radio selected={option === "pure-veg"} />
              <Text style={[styles.optionText, { color: textColor }]}>Pure Veg restaurants only</Text>
            </Pressable>
          </View>
          <Pressable onPress={onApply} style={[styles.apply, { backgroundColor: colors.primary }]}>
            <Text style={styles.applyText}>Apply</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** onSwitchOff / onKeep; backdrop and back act as "Keep using this mode", as on web. */
export function SwitchOffVegPopup({ visible, onSwitchOff, onKeep }) {
  const pop = usePop(visible);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onKeep}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} onPress={onKeep} />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.confirm,
            { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] },
          ]}
        >
          <View style={styles.iconRow}>
            <View style={styles.iconRing}>
              <View style={styles.iconCircle}>
                <AlertCircle size={64} color="#ffffff" strokeWidth={2.5} />
              </View>
            </View>
          </View>
          <Text style={styles.confirmTitle}>Switch off Veg Mode?</Text>
          <Text style={styles.confirmText}>You&apos;ll see all restaurants, including those serving non-veg dishes</Text>
          <View style={styles.confirmButtons}>
            <Pressable onPress={onSwitchOff} style={({ pressed }) => [styles.confirmBtn, pressed && { backgroundColor: tw.red50 }]}>
              <Text style={styles.switchOffText}>Switch off</Text>
            </Pressable>
            <Pressable onPress={onKeep} style={({ pressed }) => [styles.confirmBtn, pressed && { backgroundColor: tw.gray200 }]}>
              <Text style={styles.keepText}>Keep using this mode</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Ripple({ i, color }) {
  const v = useLoop(2500, { delay: i * 150, linear: false });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          borderColor: color,
          opacity: v.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0, 0.4, 0.2, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 600 / 112] }) }],
        },
      ]}
    />
  );
}

export function ApplyingVegOverlay({ visible }) {
  const { isDark } = useTheme();
  const [badge] = useState(() => new Animated.Value(0));
  const [text] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visible) return undefined;
    badge.setValue(0);
    text.setValue(0);
    const anim = Animated.parallel([
      Animated.spring(badge, { toValue: 1, stiffness: 200, damping: 15, delay: 100, useNativeDriver: true }),
      Animated.timing(text, { toValue: 1, duration: 300, delay: 400, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [visible, badge, text]);
  const green = isDark ? "#4ade80" : tw.green600;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={[styles.full, { backgroundColor: isDark ? "#0a0a0a" : "#ffffff" }]}>
        {visible
          ? Array.from({ length: 8 }, (_, i) => <Ripple key={i} i={i} color={isDark ? tw.green600 : "#86efac"} />)
          : null}
        <Animated.View
          style={[
            styles.vegBadge,
            {
              borderColor: isDark ? tw.green500 : tw.green600,
              backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
              opacity: badge,
              transform: [{ scale: badge }],
            },
          ]}
        >
          <Text style={[styles.vegBadgeText, { color: green }]}>100%</Text>
          <Text style={[styles.vegBadgeText, styles.vegBadgeText2, { color: green }]}>VEG</Text>
        </Animated.View>
        <Animated.Text
          style={[
            styles.applyingText,
            {
              color: isDark ? tw.gray200 : tw.gray800,
              opacity: text,
              transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          Explore veg dishes from all restaurants
        </Animated.Text>
      </View>
    </Modal>
  );
}

function Spinner() {
  const outer = useLoop(1500, { linear: true });
  const inner = useLoop(1000, { linear: true });
  const { isDark } = useTheme();
  const pink = isDark ? "#f472b6" : "#ec4899";
  return (
    <View style={styles.spinner}>
      <Animated.View
        style={[
          styles.arcOuter,
          {
            borderTopColor: pink,
            borderRightColor: pink,
            transform: [{ rotate: outer.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.arcInner,
          {
            borderRightColor: pink,
            transform: [{ rotate: inner.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] }) }],
          },
        ]}
      />
    </View>
  );
}

export function SwitchingOffOverlay({ visible }) {
  const { isDark } = useTheme();
  const color = isDark ? tw.gray200 : tw.gray800;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={[styles.full, { backgroundColor: isDark ? "#0a0a0a" : "#ffffff" }]}>
        <View style={styles.switchingCol}>
          {visible ? <Spinner /> : null}
          <View style={styles.switchingText}>
            <Text style={[styles.switchingLine, { color }]}>Switching off</Text>
            <Text style={[styles.switchingLine, { color }]}>Veg Mode for you</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  popup: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    padding: 24,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  popupTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  options: { gap: 8, marginBottom: 16 },
  option: { flexDirection: "row", alignItems: "center", gap: 10, padding: 6, borderRadius: 8 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffffff" },
  optionText: { fontSize: 14, fontWeight: "500" },
  apply: { paddingVertical: 10, borderRadius: 12, alignItems: "center", marginBottom: 8 },
  applyText: { color: "#ffffff", fontWeight: "600", fontSize: 14 },
  confirm: {
    width: "85%",
    maxWidth: 384,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  iconRow: { alignItems: "center", marginBottom: 16 },
  iconRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#fce7f3", alignItems: "center", justifyContent: "center" },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239,68,68,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: { fontSize: 24, fontWeight: "700", color: tw.gray900, textAlign: "center", marginBottom: 8 },
  confirmText: { fontSize: 14, color: tw.gray600, textAlign: "center", marginBottom: 24 },
  confirmButtons: { gap: 12 },
  confirmBtn: { paddingVertical: 4, borderRadius: 12, alignItems: "center" },
  switchOffText: { color: tw.red600, fontSize: 16 },
  keepText: { color: tw.gray900, fontSize: 16 },
  full: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ripple: { position: "absolute", width: 112, height: 112, borderRadius: 56, borderWidth: 1 },
  vegBadge: {
    position: "absolute",
    zIndex: 10,
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  vegBadgeText: { fontSize: 30, fontWeight: "800", lineHeight: 32, fontFamily: "Poppins_800ExtraBold" },
  vegBadgeText2: { marginTop: 2 },
  applyingText: {
    marginTop: 224,
    fontSize: 20,
    lineHeight: 28,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 16,
    fontFamily: "Poppins_400Regular",
  },
  switchingCol: { alignItems: "center", gap: 24 },
  spinner: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  arcOuter: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: "transparent",
  },
  arcInner: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: "transparent",
  },
  switchingText: { alignItems: "center" },
  switchingLine: { fontSize: 20, lineHeight: 28 },
});
