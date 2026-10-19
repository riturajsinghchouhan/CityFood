// auth/Welcome.jsx: black full-screen carousel (top ~70%) that changes slide on a VERTICAL swipe
// (horizontal swipes are ignored, as on web) and auto-advances every 5 s, then a Login button.
// The slide images (loginbanner1-4.png) are corrupted on web; an empty black View keeps their space.
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBranding } from "../../components/auth/useBranding";
import { Screen, ScalePressable, Text } from "../../components/ui";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadow } from "../../theme/tokens";

const carouselData = [
  { id: 1, tagline: "Get powerful insights and analytics to grow your restaurant business" },
  { id: 2, tagline: "Manage all your orders with ease and streamline your operations" },
  { id: 3, tagline: "Reach more customers, expand your reach, and boost your sales" },
  { id: 4, tagline: "Track your performance in real-time and make data-driven decisions" },
];

const MIN_SWIPE_DISTANCE = 50;

function Slide({ item, companyName }) {
  const [fade] = useState(() => new Animated.Value(0));
  const [brand] = useState(() => new Animated.Value(0));
  const [tagline] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anims = [
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(brand, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(tagline, { toValue: 1, duration: 500, delay: 300, useNativeDriver: true }),
    ];
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, [fade, brand, tagline]);

  const rise = (v) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      {/* loginbanner image (unrecoverable): same full-bleed space, left empty. */}
      <View style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.8)"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.textOverlay}>
        <Animated.View style={[styles.brandWrap, rise(brand)]}>
          <Text style={styles.brand}>{companyName.toLowerCase()}</Text>
          <View style={styles.brandRule} />
        </Animated.View>
        <Animated.View style={rise(tagline)}>
          <Text style={styles.tagline}>{item.tagline}</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { companyName } = useBranding();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance every 5 seconds (always forward, wrapping).
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselData.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderRelease: (_e, g) => {
          const deltaX = Math.abs(g.dx);
          const deltaY = Math.abs(g.dy);
          // Strict vertical swipe: vertical movement at least 1.5x the horizontal one.
          const isVerticalSwipe = deltaY > deltaX * 1.5 && deltaY > MIN_SWIPE_DISTANCE;
          if (!isVerticalSwipe) return;
          const isUpSwipe = g.dy < 0;
          setCurrentIndex((i) => {
            if (isUpSwipe && i < carouselData.length - 1) return i + 1;
            if (!isUpSwipe && i > 0) return i - 1;
            return i;
          });
        },
      }),
    [],
  );

  const bottomHeight = Math.max(240, height * 0.3);

  return (
    <Screen edges={[]} background="#000000" statusBarStyle="light">
      <View style={styles.carousel} {...panResponder.panHandlers}>
        <Slide
          key={`${carouselData[currentIndex].id}-${currentIndex}`}
          item={carouselData[currentIndex]}
          companyName={companyName}
        />
        <View style={styles.dots}>
          {carouselData.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => setCurrentIndex(index)}
              hitSlop={6}
              accessibilityLabel={`Go to slide ${index + 1}`}
              style={index === currentIndex ? styles.dotActive : styles.dot}
            />
          ))}
        </View>
      </View>

      <View style={[styles.bottom, { height: bottomHeight + insets.bottom, paddingBottom: 24 + insets.bottom }]}>
        <ScalePressable
          scaleTo={0.98}
          onPress={() => router.push("/login")}
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.loginText}>Login</Text>
        </ScalePressable>
        <View style={styles.terms}>
          <Text style={styles.termsText}>By continuing, you agree to our</Text>
          <Text style={[styles.termsText, styles.termsLinks]}>Terms of Service | Privacy Policy | Code of Conduct</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  carousel: { flex: 1, overflow: "hidden", backgroundColor: "#000000" },
  textOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 24, paddingBottom: 64 },
  brandWrap: { marginBottom: 12 },
  brand: {
    fontSize: 30,
    lineHeight: 36,
    fontStyle: "italic",
    fontWeight: "800",
    letterSpacing: 0.75,
    color: "#ffffff",
  },
  brandRule: { width: 48, height: StyleSheet.hairlineWidth, backgroundColor: "#ffffff", marginBottom: 12 },
  tagline: { fontSize: 24, lineHeight: 30, fontWeight: "700", color: "#ffffff" },
  dots: { position: "absolute", bottom: 16, left: 24, flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffffff" },
  bottom: { backgroundColor: "#000000", paddingHorizontal: 24, paddingTop: 24, justifyContent: "center", gap: 16 },
  loginBtn: { width: "100%", height: 48, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", ...shadow.lg },
  loginText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  terms: { marginTop: 8, alignItems: "center" },
  termsText: { fontSize: 12, color: "rgba(255,255,255,0.7)", textAlign: "center" },
  termsLinks: { textDecorationLine: "underline", marginTop: 4 },
});
