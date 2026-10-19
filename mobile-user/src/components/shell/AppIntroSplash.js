// Port of components/user/AppIntroSplash.jsx: admin intro ads (image or video slides) shown
// over the user screens once per app process (web: once per tab via sessionStorage "appIntroSeen").
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Image } from "expo-image";
import { ChevronRight, Loader2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { getAppIntroAds } from "../../api/content";
import { resolveMediaUrl } from "../ui/AppImage";
import Text from "../ui/Text";

let introSeen = false;

export const hasSeenAppIntro = () => introSeen;
const markIntroSeen = () => {
  introSeen = true;
};

function IntroVideo({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

function Spinner() {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={32} color="#155dfc" />
    </Animated.View>
  );
}

export default function AppIntroSplash({ onComplete }) {
  const insets = useSafeAreaInsets();
  const [screens, setScreens] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(!introSeen);
  const [fade] = useState(() => new Animated.Value(0));

  const finish = useCallback(() => {
    markIntroSeen();
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (introSeen) {
      onComplete?.();
      return undefined;
    }
    let cancelled = false;
    getAppIntroAds()
      .then((res) => {
        if (cancelled) return;
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setScreens(res.data);
        } else {
          finish();
        }
      })
      .catch((err) => {
        console.error("Failed to fetch intro screens", err);
        if (!cancelled) finish();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once per mount, like the web effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screens.length === 0 || currentIndex >= screens.length) return undefined;
    const duration = (screens[currentIndex].duration || 3) * 1000;
    const timer = setTimeout(() => {
      if (currentIndex < screens.length - 1) setCurrentIndex((prev) => prev + 1);
      else finish();
    }, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, screens, finish]);

  useEffect(() => {
    if (screens.length === 0) return;
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [screens.length, fade]);

  if (introSeen && !loading && screens.length === 0) return null;
  if (loading) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.loading]}>
        <Spinner />
      </View>
    );
  }
  if (screens.length === 0) return null;

  const currentScreen = screens[currentIndex];
  const linkedRestaurant = currentScreen?.restaurantId;
  const targetSlug =
    typeof linkedRestaurant === "object" ? linkedRestaurant?.slug || linkedRestaurant?._id : linkedRestaurant;
  const restaurantName =
    typeof linkedRestaurant === "object"
      ? linkedRestaurant?.restaurantName || linkedRestaurant?.onboarding?.step1?.restaurantName || "Restaurant"
      : "Restaurant";
  const mediaUri = resolveMediaUrl(currentScreen.mediaUrl);

  const handleAdClick = () => {
    if (!targetSlug) return;
    finish();
    router.push(`/restaurants/${targetSlug}`);
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      <Pressable onPress={handleAdClick} disabled={!targetSlug} style={StyleSheet.absoluteFill}>
        {currentScreen.mediaType === "video" ? (
          mediaUri ? <IntroVideo key={currentScreen._id} uri={mediaUri} /> : null
        ) : (
          <Image
            key={currentScreen._id}
            source={mediaUri ? { uri: mediaUri } : null}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            accessibilityLabel={currentScreen.title || "Intro"}
          />
        )}
      </Pressable>

      {targetSlug ? (
        <Pressable onPress={handleAdClick} style={[styles.visitWrap, { bottom: 64 + insets.bottom }]}>
          {({ pressed }) => (
            <LinearGradient
              colors={["#ff6900", "#fe9a00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.visit, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <Text style={styles.visitText}>Visit {restaurantName}</Text>
              <ChevronRight size={16} color="#ffffff" />
            </LinearGradient>
          )}
        </Pressable>
      ) : null}

      <Pressable
        onPress={finish}
        style={({ pressed }) => [
          styles.skip,
          { top: 24 + insets.top, backgroundColor: pressed ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)" },
        ]}
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={[styles.dots, { bottom: 24 + insets.bottom }]} pointerEvents="none">
        {screens.map((s, idx) => (
          <View
            key={s._id || idx}
            style={[
              styles.dot,
              idx === currentIndex ? { width: 24, backgroundColor: "#ffffff" } : { width: 6, backgroundColor: "rgba(255,255,255,0.5)" },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// Mounted in the root layout over the user screens (web: UserLayout's introFinished state).
export function AppIntroSplashHost({ enabled = true }) {
  const [finished, setFinished] = useState(introSeen);
  const handleComplete = useCallback(() => setFinished(true), []);
  if (finished || !enabled) return null;
  return <AppIntroSplash onComplete={handleComplete} />;
}

const styles = StyleSheet.create({
  loading: { backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", zIndex: 100 },
  root: { backgroundColor: "#000000", alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 100 },
  visitWrap: { position: "absolute", alignSelf: "center", zIndex: 50 },
  visit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  visitText: { color: "#ffffff", fontWeight: "600" },
  skip: { position: "absolute", right: 24, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, zIndex: 50 },
  skipText: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
  dots: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 8, zIndex: 50 },
  dot: { height: 6, borderRadius: 9999 },
});
