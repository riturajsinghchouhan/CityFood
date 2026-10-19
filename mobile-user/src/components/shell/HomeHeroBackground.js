// Home.jsx's header background (web L2192-2234): a dark plum gradient panel with rounded
// bottom corners behind HomeHeader. When landing settings carry festBannerImages, they
// cross-fade every 5 s (images, or muted looping videos for .mp4/.webm/.ogg) under a 20% black wash.
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { resolveMediaUrl } from "../ui/AppImage";

const isVideoUrl = (url) => typeof url === "string" && /\.(mp4|webm|ogg)(\?|$)/i.test(url);

function BgVideo({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // Two cover-fit videos overlap and cross-fade by opacity; a SurfaceView (the Android
  // default) ignores parent opacity and mis-clips overlapping videos, so use a TextureView.
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      surfaceType="textureView"
    />
  );
}

function Slide({ uri, active, index }) {
  const [opacity] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: active ? 1 : 0, duration: 1000, useNativeDriver: true }).start();
  }, [active, opacity]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, zIndex: active ? 2 : 1 }]}>
      {isVideoUrl(uri) ? (
        <BgVideo uri={uri} />
      ) : (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" priority={index === 0 ? "high" : "normal"} />
      )}
    </Animated.View>
  );
}

/**
 * images: landing settings festBannerImages (relative or absolute URLs). height: the web
 * rule is 360 when images exist, otherwise the measured height of HomeHeader + FestBanner
 * (300 before measuring). Render it absolutely at the top of Home, behind the header.
 */
export default function HomeHeroBackground({ images = [], height = 300, style }) {
  const list = Array.isArray(images) ? images.map(resolveMediaUrl).filter(Boolean) : [];
  const active = list.length > 0;
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return undefined;
    const timer = setInterval(() => setBgIndex((prev) => (prev + 1) % list.length), 5000);
    return () => clearInterval(timer);
  }, [list.length]);

  return (
    <View style={[styles.root, { height: active ? 360 : height }, style]} pointerEvents="none">
      <LinearGradient colors={["#3a142c", "#1a0a14"]} style={StyleSheet.absoluteFill} />
      {active ? (
        <View style={[StyleSheet.absoluteFill, styles.media]}>
          {list.map((uri, index) => (
            <Slide key={`hero-bg-${index}-${uri}`} uri={uri} index={index} active={bgIndex % list.length === index} />
          ))}
          <View style={[StyleSheet.absoluteFill, styles.wash]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
    zIndex: 0,
  },
  media: { backgroundColor: "#0f172b" },
  wash: { backgroundColor: "rgba(0,0,0,0.2)", zIndex: 3 },
});
