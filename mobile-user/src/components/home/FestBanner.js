// Port of components/user/home/FestBanner.jsx, shown on Home when landing settings have
// no festBannerImages: "CityFood Missions" pill, FEAST BONANZA / VEGGIE DELIGHT title,
// the pulsing offer pill and three floating food photos that rotate every 4 s.
// Home always passes images=[] and hideFoodImages=false, so the background slider is not ported.
import { ArrowRightCircle, Flame, Leaf, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { AppImage, Text } from "../ui";
import { useLoop } from "./anim";

const POOLS = {
  nonVeg: [
    "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=500&h=500&fit=crop",
  ],
  veg: [
    "https://images.unsplash.com/photo-1585238341267-1cfec2046a55?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&h=500&fit=crop",
  ],
};

const YELLOW = "#fff200";

function useEnter(key) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    v.setValue(0);
    const anim = Animated.spring(v, { toValue: 1, damping: 15, stiffness: 100, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [v, key]);
  return v;
}

function SideImage({ uri, side, enterKey }) {
  const enter = useEnter(enterKey);
  const bob = useLoop(side === "left" ? 3500 : 4000, { pingPong: true, delay: side === "left" ? 0 : 400 });
  const dir = side === "left" ? -1 : 1;
  return (
    <Animated.View
      style={[
        styles.side,
        {
          opacity: enter,
          transform: [
            { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [100 * dir, 0] }) },
            { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
            { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: [`${45 * dir}deg`, `${15 * dir}deg`] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
          ],
        },
      ]}
    >
      <AppImage
        src={uri}
        width={64}
        style={[styles.sideImg, { transform: [{ rotate: `${-12 * dir}deg` }] }, side === "right" && styles.whiteBg]}
      />
    </Animated.View>
  );
}

function CenterImage({ uri, isVegMode, enterKey }) {
  const enter = useEnter(enterKey);
  const wobble = useLoop(6000, { linear: true });
  const glow = useLoop(2000, { pingPong: true });
  return (
    <Animated.View
      style={[
        styles.center,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            { rotate: wobble.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: ["0deg", "5deg", "-5deg", "0deg"] }) },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.centerGlow,
          {
            backgroundColor: isVegMode ? "rgba(255,255,255,0.4)" : "rgba(250,204,21,0.4)",
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }),
          },
        ]}
      />
      <AppImage src={uri} width={96} style={styles.centerImg} />
    </Animated.View>
  );
}

export default function FestBanner({ isVegMode = false }) {
  const pool = isVegMode ? POOLS.veg : POOLS.nonVeg;
  const [imgIndex, setImgIndex] = useState(0);
  const [poolKey, setPoolKey] = useState(isVegMode);
  if (poolKey !== isVegMode) {
    setPoolKey(isVegMode);
    setImgIndex(0);
  }

  useEffect(() => {
    const timer = setInterval(() => setImgIndex((prev) => (prev + 1) % pool.length), 4000);
    return () => clearInterval(timer);
  }, [pool.length]);

  const sparkle = useLoop(2000, { pingPong: true });
  const pulse = useLoop(2000, { pingPong: true });
  const bounce = useLoop(1000, { pingPong: true });
  const [title] = useState(() => new Animated.Value(0));
  useEffect(() => {
    title.setValue(0);
    const anim = Animated.spring(title, { toValue: 1, damping: 10, stiffness: 100, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [title, isVegMode]);
  const [mission] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(mission, { toValue: 1, duration: 400, delay: 200, easing: Easing.out(Easing.ease), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [mission]);

  const display = [pool[imgIndex % pool.length], pool[(imgIndex + 1) % pool.length], pool[(imgIndex + 2) % pool.length]];
  const enterKey = `${isVegMode}-${imgIndex}`;
  const sparkleOpacity = sparkle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.missionPill,
            { opacity: mission, transform: [{ translateY: mission.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
          ]}
        >
          <Animated.View style={{ opacity: sparkleOpacity }}>
            <Sparkles size={10} color={YELLOW} />
          </Animated.View>
          <Text style={styles.missionText}>CITYFOOD MISSIONS</Text>
          <Animated.View style={{ opacity: sparkleOpacity }}>
            <Sparkles size={10} color={YELLOW} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={{ opacity: title, transform: [{ scale: title.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}
        >
          <Text style={styles.title}>{isVegMode ? "VEGGIE DELIGHT" : "FEAST BONANZA"}</Text>
        </Animated.View>

        <Animated.View
          style={[styles.offerPill, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }]}
        >
          {isVegMode ? (
            <Leaf size={14} color="#00d492" fill="#00d492" />
          ) : (
            <Animated.View style={{ transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }}>
              <Flame size={14} color={YELLOW} fill={YELLOW} />
            </Animated.View>
          )}
          <Text style={styles.offerText}>{isVegMode ? "PURE VEG MAGIC" : "UPTO 60% OFF NOW"}</Text>
          <ArrowRightCircle size={20} color={YELLOW} />
        </Animated.View>

        <View style={styles.images}>
          <View
            style={[styles.groundGlow, { backgroundColor: isVegMode ? "rgba(16,185,129,0.4)" : "rgba(250,204,21,0.4)" }]}
          />
          <SideImage key={`l-${enterKey}`} uri={display[0]} side="left" enterKey={enterKey} />
          <CenterImage key={`c-${enterKey}`} uri={display[1]} isVegMode={isVegMode} enterKey={enterKey} />
          <SideImage key={`r-${enterKey}`} uri={display[2]} side="right" enterKey={enterKey} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 16,
    minHeight: 140,
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  content: { alignItems: "center", gap: 16 },
  missionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  missionText: { fontSize: 9, fontWeight: "900", color: "#ffffff", letterSpacing: 1.8 },
  title: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    fontStyle: "italic",
    color: YELLOW,
    letterSpacing: -1.2,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  offerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  offerText: { fontSize: 14, fontWeight: "900", color: "#ffffff", letterSpacing: 1.4 },
  images: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 20,
    paddingTop: 40,
    width: "100%",
    marginBottom: 8,
  },
  groundGlow: { position: "absolute", bottom: 16, alignSelf: "center", width: 224, height: 48, borderRadius: 999, opacity: 0.6 },
  side: { width: 64, height: 64, zIndex: 10 },
  sideImg: { width: 64, height: 64, borderRadius: 16, borderWidth: 3, borderColor: "#ffffff" },
  whiteBg: { backgroundColor: "#ffffff" },
  center: { width: 96, height: 96, zIndex: 30, marginBottom: -8 },
  centerGlow: { position: "absolute", top: -10, left: -10, right: -10, bottom: -10, borderRadius: 999 },
  centerImg: {
    width: 96,
    height: 96,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#ffffff",
    boxShadow: "0px 22px 55px rgba(0,0,0,0.4)",
  },
});
