// Small shadcn-style primitives from Frontend/src/modules/Food/components/ui.
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { fontFamilyByWeight, radius, shadow } from "../../theme/tokens";
import Text from "./Text";

// card.tsx: rounded-xl border py-6 shadow-sm.
export function Card({ style, children, ...props }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

// badge.tsx: rounded-md px-2 py-0.5 text-xs font-medium.
export function Badge({ variant = "default", style, textStyle, children }) {
  const { colors } = useTheme();
  const v = {
    default: { bg: colors.primary, fg: colors.primaryForeground, border: "transparent" },
    secondary: { bg: colors.secondary, fg: "#ffffff", border: "transparent" },
    destructive: { bg: colors.destructive, fg: "#ffffff", border: "transparent" },
    outline: { bg: "transparent", fg: colors.text, border: colors.border },
  }[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border }, style]}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={[{ color: v.fg, fontSize: 12, fontWeight: "500" }, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

// input.tsx: h-9 rounded-md border px-3 text-base.
export function Input({ style, ...props }) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      style={[
        styles.input,
        {
          borderColor: colors.input,
          color: colors.text,
          backgroundColor: colors.dark ? "rgba(39,39,42,0.3)" : "transparent",
        },
        style,
      ]}
      {...props}
    />
  );
}

export function Divider({ style }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

// skeleton.tsx: bg-accent animate-pulse rounded-md.
export function Skeleton({ style }) {
  const { colors } = useTheme();
  const opacity = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        { backgroundColor: colors.dark ? "#1e2939" : "#e5e7eb", borderRadius: radius.md, opacity },
        style,
      ]}
    />
  );
}

// framer-motion whileTap={{ scale }} -> pressable scale.
export function ScalePressable({ scaleTo = 0.97, style, children, onPressIn, onPressOut, ...props }) {
  const scale = useState(() => new Animated.Value(1))[0];
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  return (
    <Pressable
      onPressIn={(e) => {
        to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// switch.tsx look (h-5 w-9 rounded-full, primary when checked).
export function Switch({ value, onValueChange, disabled }) {
  const { colors } = useTheme();
  const x = useState(() => new Animated.Value(value ? 1 : 0))[0];
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [value, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(value), disabled }}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      style={[
        styles.switchTrack,
        { backgroundColor: value ? colors.primary : colors.input, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Animated.View
        style={[
          styles.switchThumb,
          { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) }] },
        ]}
      />
    </Pressable>
  );
}

// Veg / non-veg marker used on menu items (green or red square with dot).
export function VegMark({ isVeg, size = 14 }) {
  const color = isVeg ? "#00a63e" : "#dc2626";
  return (
    <View style={[styles.vegBox, { width: size, height: size, borderColor: color }]}>
      <View style={{ width: size / 2, height: size / 2, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

// useDelayedLoading: only show a loader if loading lasts longer than `delay` ms.
export function useDelayedLoading(loading, delay = 300) {
  const [elapsed, setElapsed] = useState(false);
  const [prevLoading, setPrevLoading] = useState(loading);
  if (loading !== prevLoading) {
    setPrevLoading(loading);
    setElapsed(false);
  }
  useEffect(() => {
    if (!loading) return undefined;
    const t = setTimeout(() => setElapsed(true), delay);
    return () => clearTimeout(t);
  }, [loading, delay]);
  return loading && elapsed;
}

export const inputFont = { fontFamily: fontFamilyByWeight["400"] };

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: 24,
    ...shadow.sm,
  },
  badge: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  input: {
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    ...inputFont,
  },
  switchTrack: { width: 36, height: 20, borderRadius: 999, padding: 2, justifyContent: "center" },
  switchThumb: { width: 16, height: 16, borderRadius: 999, backgroundColor: "#ffffff", ...shadow.sm },
  vegBox: { borderWidth: 1.5, borderRadius: 3, alignItems: "center", justifyContent: "center" },
});
