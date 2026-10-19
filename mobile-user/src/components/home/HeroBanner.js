// Port of components/user/home/HeroBanner.jsx: admin hero banners cross-fading every
// 3.5 s (1 s fade), swipeable, with dots and a glint. Tapping opens the banner's first
// linked restaurant.
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AppImage, Skeleton } from "../ui";
import { Shine } from "./anim";

const AUTO_SLIDE_MS = 3500;
const FADE_MS = 1000;
const HEIGHT = 180;

function HeroBannerSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.skel}>
        <LinearGradient
          colors={["#fff8ef", "#fff0de", "#ffe3c5"]}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.skelInner}>
          <View style={styles.skelTop}>
            <Skeleton style={[styles.skelBlock, { width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.6)" }]} />
            <Skeleton style={[styles.skelBlock, { width: 96, height: 40, backgroundColor: "rgba(255,255,255,0.65)" }]} />
          </View>
          <View style={styles.skelText}>
            <Skeleton style={[styles.skelBlock, { width: 96, height: 16, backgroundColor: "rgba(255,255,255,0.55)" }]} />
            <Skeleton style={{ width: "75%", height: 36, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.7)" }} />
            <Skeleton style={[styles.skelBlock, { width: "66%", height: 16, backgroundColor: "rgba(255,255,255,0.55)" }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

function Slide({ uri, active }) {
  const [opacity] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: active ? 1 : 0, duration: FADE_MS, useNativeDriver: true }).start();
  }, [active, opacity]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, zIndex: active ? 2 : 1 }]} pointerEvents="none">
      <AppImage src={uri} style={styles.slideImg} contentFit="contain" placeholderType="none" priority={active} />
    </Animated.View>
  );
}

/** images: banner image URLs. bannersData: the banner docs (linkedRestaurants). loading: skeleton. */
export default function HeroBanner({ images = [], bannersData = [], loading = false }) {
  const { isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const timerRef = useRef(null);
  const swipingRef = useRef(false);
  const count = images.length;
  const shownIndex = count === 0 ? 0 : Math.min(currentIndex, count - 1);

  const startAutoSlide = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      if (swipingRef.current || AppState.currentState !== "active") return;
      setCurrentIndex((prev) => (prev + 1) % count);
    }, AUTO_SLIDE_MS);
  }, [count]);

  useEffect(() => {
    startAutoSlide();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startAutoSlide]);

  const go = useCallback(
    (delta) => {
      if (count === 0) return;
      setCurrentIndex((prev) => (Math.min(prev, count - 1) + delta + count) % count);
      startAutoSlide();
    },
    [count, startAutoSlide],
  );

  // Raw touch tracking (web onTouchStart/Move/End): a horizontal swipe over 50px changes
  // the slide, and a moved touch does not count as a tap.
  const touchRef = useRef({ x: 0, y: 0, dx: 0, dy: 0, moved: false });
  const onTouchStart = (e) => {
    const { pageX, pageY } = e.nativeEvent;
    touchRef.current = { x: pageX, y: pageY, dx: 0, dy: 0, moved: false };
    swipingRef.current = true;
  };
  const onTouchMove = (e) => {
    const t = touchRef.current;
    t.dx = e.nativeEvent.pageX - t.x;
    t.dy = e.nativeEvent.pageY - t.y;
    if (Math.abs(t.dx) > 10 || Math.abs(t.dy) > 10) t.moved = true;
  };
  const onTouchEnd = () => {
    const { dx, dy } = touchRef.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx > 0 ? -1 : 1);
    setTimeout(() => {
      swipingRef.current = false;
    }, 300);
  };

  if (loading) return <HeroBannerSkeleton />;
  if (count === 0) return null;

  const onPress = () => {
    if (touchRef.current.moved) return;
    const linked = bannersData[shownIndex]?.linkedRestaurants || [];
    if (linked.length > 0) {
      const first = linked[0];
      router.push(`/restaurants/${first.slug || first.restaurantId || first._id}`);
    }
  };

  return (
    <View style={styles.wrap}>
      <View
        style={styles.shell}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={startAutoSlide}
      >
        <View style={[styles.stage, { backgroundColor: isDark ? "#111111" : "#f9fafb" }]}>
          <View style={styles.shineLayer} pointerEvents="none">
            <Shine width={width} duration={2500} mode="keyframe" alpha={0.3} skew={-20} />
          </View>
          {images.map((image, index) => (
            <Slide key={`${index}-${image}`} uri={image} active={shownIndex === index} />
          ))}
        </View>
        {count > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {images.map((_, index) => (
              <View
                key={`dot-${index}`}
                style={[
                  styles.dot,
                  index === shownIndex
                    ? { width: 16, backgroundColor: "rgba(255,255,255,0.9)" }
                    : { width: 6, backgroundColor: "rgba(255,255,255,0.4)" },
                ]}
              />
            ))}
          </View>
        ) : null}
        <Pressable
          style={styles.hit}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open hero banner ${shownIndex + 1}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 8 },
  shell: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  stage: { height: HEIGHT, alignItems: "center", justifyContent: "center" },
  shineLayer: { ...StyleSheet.absoluteFill, zIndex: 10, overflow: "hidden" },
  slideImg: { width: "100%", height: "100%", backgroundColor: "transparent" },
  dots: { position: "absolute", bottom: 12, left: 0, right: 0, zIndex: 30, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  hit: { ...StyleSheet.absoluteFill, zIndex: 20 },
  skel: { height: 224, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", boxShadow: "0px 18px 60px rgba(235,89,14,0.14)" },
  skelInner: { flex: 1, padding: 20, justifyContent: "space-between" },
  skelTop: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  skelText: { maxWidth: "70%", width: "70%", gap: 12 },
  skelBlock: { borderRadius: 999 },
});
