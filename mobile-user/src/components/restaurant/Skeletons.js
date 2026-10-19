// Ports of loading-skeletons.jsx (RestaurantDetailSkeleton, RestaurantGridSkeleton)
// and MenuScanAnimation.jsx.
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "../ui";
import { useTheme } from "../../theme/ThemeContext";

const S = (style) => <Skeleton style={style} />;

function SkeletonLines({ lines = 3 }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} style={{ height: 16, borderRadius: 999, width: i === lines - 1 ? "66%" : "100%" }} />
      ))}
    </View>
  );
}

function CategoryChipRowSkeleton({ count = 8 }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, overflow: "hidden" }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} style={{ height: 36, borderRadius: 999, width: i % 3 === 0 ? 112 : i % 2 === 0 ? 96 : 80 }} />
      ))}
    </View>
  );
}

function HeroBannerSkeleton() {
  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={["#fff8ef", "#fff0de", "#ffe3c5"]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, padding: 20, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {S({ height: 40, width: 40, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.6)" })}
          {S({ height: 40, width: 96, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.65)" })}
        </View>
        <View style={{ maxWidth: "70%", gap: 12 }}>
          {S({ height: 16, width: 96, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.55)" })}
          {S({ height: 36, width: "75%", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.7)" })}
          {S({ height: 16, width: "66%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.55)" })}
        </View>
      </View>
    </View>
  );
}

export function RestaurantDetailSkeleton() {
  const { isDark } = useTheme();
  const card = {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0",
    backgroundColor: isDark ? "#141414" : "#ffffff",
    padding: 16,
  };
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#0a0a0a" : "#ffffff", paddingHorizontal: 16, paddingTop: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {S({ height: 44, width: 44, borderRadius: 999 })}
        <View style={{ flexDirection: "row", gap: 12 }}>
          {S({ height: 44, width: 96, borderRadius: 999 })}
          {S({ height: 44, width: 44, borderRadius: 999 })}
        </View>
      </View>
      <View style={{ marginTop: 20, gap: 20 }}>
        <HeroBannerSkeleton />
        <View style={[card, { borderRadius: 30, padding: 20, gap: 12 }]}>
          {S({ height: 32, width: "75%", borderRadius: 999 })}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {S({ height: 20, width: 80, borderRadius: 999 })}
            {S({ height: 20, width: 96, borderRadius: 999 })}
            {S({ height: 20, width: 64, borderRadius: 999 })}
          </View>
          <SkeletonLines lines={2} />
        </View>
        <CategoryChipRowSkeleton count={5} />
        <View style={{ gap: 16 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} style={card}>
              <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 12 }}>
                  {S({ height: 24, width: "60%", borderRadius: 999 })}
                  {S({ height: 16, width: 80, borderRadius: 999 })}
                  <SkeletonLines lines={2} />
                </View>
                {S({ height: 96, width: 96, borderRadius: 16 })}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Full-screen skeleton shown over the page on open, fading out before `duration` ends.
export function MenuScanAnimation({ duration = 2200, onComplete }) {
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const hide = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }, duration - 400);
    const done = setTimeout(() => onComplete?.(), duration);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [duration, onComplete, opacity]);
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 30, backgroundColor: "#ffffff", paddingTop: insets.top, opacity }]}
    >
      <RestaurantDetailSkeleton />
    </Animated.View>
  );
}

export function RestaurantCardSkeleton({ compact = false }) {
  const { isDark } = useTheme();
  const overlay = isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)";
  return (
    <View
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.1)" : "#efe2d4",
        backgroundColor: isDark ? "#141414" : "#ffffff",
        overflow: "hidden",
        boxShadow: "0px 18px 40px rgba(15,23,42,0.05)",
      }}
    >
      <View style={{ height: compact ? 160 : 176 }}>
        <LinearGradient
          colors={isDark ? ["#262626", "#181818"] : ["#fff7ee", "#ffe7cf"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {S({ position: "absolute", left: 16, top: 16, height: 32, width: 80, borderRadius: 999, backgroundColor: overlay })}
        {S({ position: "absolute", right: 16, top: 16, height: 36, width: 36, borderRadius: 999, backgroundColor: overlay })}
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 16, gap: 12 }}>
          {S({ height: 20, width: "66%", borderRadius: 999, backgroundColor: overlay })}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {S({ height: 16, width: 64, borderRadius: 999, backgroundColor: overlay })}
            {S({ height: 16, width: 80, borderRadius: 999, backgroundColor: overlay })}
          </View>
        </View>
      </View>
      <View style={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            {S({ height: 20, width: "80%", borderRadius: 999 })}
            {S({ height: 16, width: "66%", borderRadius: 999 })}
          </View>
          {S({ height: 32, width: 48, borderRadius: 12 })}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {S({ height: 16, width: 64, borderRadius: 999 })}
          {S({ height: 16, width: 96, borderRadius: 999 })}
          {S({ height: 16, width: 80, borderRadius: 999 })}
        </View>
        <SkeletonLines lines={2} />
      </View>
    </View>
  );
}

export function RestaurantGridSkeleton({ count = 4, compact = false }) {
  return (
    <View style={{ gap: 16 }}>
      {Array.from({ length: count }, (_, i) => (
        <RestaurantCardSkeleton key={i} compact={compact} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 224,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    boxShadow: "0px 18px 60px rgba(235,89,14,0.14)",
  },
});
