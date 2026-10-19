// OptimizedImage.jsx port: resolves backend media paths, requests a width-matched
// variant (Cloudinary transform or the wsrv.nl proxy, as on web) and shows the
// web's food/shop placeholder while loading or on error.
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { ASSET_ORIGIN } from "../../config";
import { useTheme } from "../../theme/ThemeContext";

const BUCKETS = [200, 400, 600, 800, 1200];

export function resolveMediaUrl(src) {
  if (!src || typeof src !== "string") return null;
  const s = src.trim();
  if (!s) return null;
  if (/^(https?:|data:|file:)/i.test(s)) return s.replace(/^http:\/\/(?!localhost)/i, "https://");
  return `${ASSET_ORIGIN}${s.startsWith("/") ? "" : "/"}${s}`;
}

function optimizedUrl(url, width) {
  if (!url || !/^https?:\/\//.test(url) || !width) return url;
  const target = PixelRatio.getPixelSizeForLayoutSize(width);
  const w = BUCKETS.find((b) => b >= target) || BUCKETS[BUCKETS.length - 1];
  if (/res\.cloudinary\.com/i.test(url) && /\/image\/upload\//i.test(url)) {
    if (/\/image\/upload\/(?:f_|q_|w_|h_|c_|dpr_|g_)/i.test(url)) return url;
    return url.replace("/image/upload/", `/image/upload/f_auto,q_80,w_${w}/`);
  }
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&q=80&we=1&w=${w}`;
}

function FoodPlaceholder({ color }) {
  return (
    <Svg viewBox="0 0 100 100" width="40%" height="40%" style={styles.ph}>
      <Circle cx="50" cy="50" r="45" fill={color} opacity={0.08} />
      <Path d="M25,65 Q25,30 50,30 Q75,30 75,65 Z" fill={color} opacity={0.5} />
      <Circle cx="50" cy="25" r="5" fill={color} opacity={0.7} />
      <Path d="M35,55 Q35,42 45,38" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <Rect x="20" y="66" width="60" height="7" rx="3.5" fill={color} opacity={0.7} />
      <Rect x="28" y="74" width="44" height="4" rx="2" fill={color} opacity={0.5} />
    </Svg>
  );
}

function ShopPlaceholder({ color }) {
  return (
    <Svg viewBox="0 0 100 100" width="40%" height="40%" style={styles.ph}>
      <Circle cx="50" cy="30" r="16" fill={color} opacity={0.1} />
      <Circle cx="50" cy="30" r="16" fill="none" stroke={color} strokeWidth={2.5} />
      <Path d="M46,22 L46,29 M43,22 L43,26 M49,22 L49,26 M43,26 Q46,30 49,26 M46,30 L46,38" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M54,23 C51,23 51,28 54,29 C57,28 57,23 54,23 Z M54,29 L54,38" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M22,55 L78,55 L78,85 L22,85 Z" fill="none" stroke={color} strokeWidth={2.5} />
      <Path d="M18,45 L82,45 L80,55 L20,55 Z" fill={color} opacity={0.1} />
      <Path d="M18,45 L82,45 L80,55 L20,55 Z" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M20,55 Q23.75,60 27.5,55 Q31.25,60 35,55 Q38.75,60 42.5,55 Q46.25,60 50,55 Q53.75,60 57.5,55 Q61.25,60 65,55 Q68.75,60 72.5,55 Q76.25,60 80,55" fill="none" stroke={color} strokeWidth={2} />
      <Rect x="30" y="65" width="16" height="20" fill="none" stroke={color} strokeWidth={2} />
      <Rect x="52" y="65" width="20" height="12" fill="none" stroke={color} strokeWidth={2} />
      <Line x1="8" y1="85" x2="92" y2="85" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M12,85 Q12,75 18,75 Q24,72 26,85 Z" fill={color} opacity={0.4} />
      <Path d="M88,85 Q88,75 82,75 Q76,70 70,85 Z" fill={color} opacity={0.4} />
    </Svg>
  );
}

/**
 * src: remote URL / backend path, or a require()'d local asset.
 * width: rendered width in dp; used to pick the variant size (pass it for list images).
 * placeholderType: "food" | "shop" | "none".
 */
export default function AppImage({
  src,
  width,
  style,
  contentFit = "cover",
  placeholderType = "food",
  fallbackSrc,
  priority,
  ...props
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isLocal = typeof src === "number";
  const uri = useMemo(() => {
    if (isLocal) return null;
    return optimizedUrl(resolveMediaUrl(src), width);
  }, [src, width, isLocal]);
  const fallback = typeof fallbackSrc === "number" ? fallbackSrc : resolveMediaUrl(fallbackSrc);

  const source = isLocal ? src : failed && fallback ? fallback : uri;
  const showPlaceholder = placeholderType !== "none" && (!source || !loaded || (failed && !fallback));
  const phColor = colors.dark ? "#52525c" : "#cfcac2";

  return (
    <View style={[styles.wrap, { backgroundColor: colors.dark ? "#18181b" : "#f5f3f0" }, style]}>
      {source ? (
        <Image
          source={typeof source === "string" ? { uri: source } : source}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={200}
          cachePolicy="memory-disk"
          priority={priority ? "high" : "normal"}
          recyclingKey={typeof source === "string" ? source : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!failed) setFailed(true);
          }}
          {...props}
        />
      ) : null}
      {showPlaceholder ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {placeholderType === "shop" ? <ShopPlaceholder color={phColor} /> : <FoodPlaceholder color={phColor} />}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  ph: { maxWidth: 80, maxHeight: 80 },
});
