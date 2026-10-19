// Port of components/user/AddToCartAnimation.jsx: the floating orange "Cart · N items" pill
// plus the fly-to-cart (add) and fly-back (remove) thumbnail animations driven by
// useCart().lastAddEvent / lastRemoveEvent. GSAP timelines become Animated sequences.
// Render it as the LAST child of the screen root (it fills the screen with box-none touches).
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { ChevronRight, ShoppingCart } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../context/CartContext";
import { resolveMediaUrl } from "../ui/AppImage";
import { ScalePressable } from "../ui/primitives";
import Text from "../ui/Text";

const THUMB = 32;
const ease = Easing.out(Easing.quad);
const easeInOut = Easing.inOut(Easing.quad);
const easeIn = Easing.in(Easing.quad);

const measure = (ref) =>
  new Promise((resolve) => {
    if (!ref.current?.measureInWindow) return resolve(null);
    ref.current.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });

function Thumbnail({ product }) {
  const uri = resolveMediaUrl(product?.imageUrl);
  return (
    <View style={styles.thumb}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
      ) : (
        <View style={[styles.thumbImg, styles.thumbFallback]}>
          <Text style={styles.thumbLetter}>{product?.name?.charAt(0)?.toUpperCase() || "?"}</Text>
        </View>
      )}
    </View>
  );
}

// One flying thumbnail: starts centered on `from`, travels to `to` (both local coords).
function Flyer({ product, from, to, direction, onDone }) {
  const [v] = useState(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    scale: new Animated.Value(1),
    rotate: new Animated.Value(0),
    opacity: new Animated.Value(1),
  }));
  const doneRef = useRef(onDone);
  useEffect(() => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const t = (value, toValue, duration, easing) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });
    const anim = Animated.sequence([
      t(v.scale, 1.3, 150, ease),
      Animated.parallel([
        t(v.x, dx * 0.98, 400, easeInOut),
        t(v.y, dy, 400, easeInOut),
        t(v.rotate, direction, 400, easeInOut),
        t(v.scale, 1.1, 400, easeInOut),
      ]),
      Animated.parallel([t(v.x, dx, 150, ease), t(v.scale, 0.9, 150, ease)]),
      t(v.scale, 0.85, 100, easeIn),
      Animated.parallel([t(v.scale, 0.7, 150, easeIn), t(v.opacity, 0, 150, easeIn)]),
    ]);
    anim.start(() => doneRef.current?.());
    return () => anim.stop();
  }, [v, from, to, direction]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flyer,
        {
          left: from.x - THUMB / 2,
          top: from.y - THUMB / 2,
          opacity: v.opacity,
          transform: [
            { translateX: v.x },
            { translateY: v.y },
            { scale: v.scale },
            { rotate: v.rotate.interpolate({ inputRange: [-1, 1], outputRange: ["-360deg", "360deg"] }) },
          ],
        },
      ]}
    >
      <Thumbnail product={product} />
    </Animated.View>
  );
}

/**
 * bottomOffset: web px from the bottom of the viewport (default 96; RestaurantDetails 80).
 * bottom: explicit native offset from the bottom of this screen (replaces web dynamicBottom).
 * hideOnPages: hide the pill on cart, Home and profile routes (web default true).
 * linkTo: native path opened by the pill (default "/cart").
 */
export default function AddToCartAnimation({ bottomOffset = 96, bottom, hideOnPages = true, linkTo = "/cart" }) {
  const { itemCount, total, lastAddEvent, lastRemoveEvent } = useCart();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const rootRef = useRef(null);
  const pillRef = useRef(null);
  const [flyers, setFlyers] = useState([]);
  const [enter] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(1));

  const isCartPage = pathname.includes("/cart");
  const isHomePage = pathname === "/";
  const isProfilePage = pathname.includes("/profile") || pathname.includes("/account");
  const shouldHidePill = hideOnPages && (isCartPage || isHomePage || isProfilePage);
  const showPill = itemCount > 0 && !shouldHidePill;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: showPill ? 1 : 0,
      stiffness: 400,
      damping: 30,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [showPill, enter]);

  const launch = async (event, kind) => {
    const src = event?.sourcePosition;
    if (!src) return;
    const sx = src.viewportX ?? src.x;
    const sy = src.viewportY ?? src.y;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
    await new Promise((r) => setTimeout(r, kind === "add" ? 150 : 10));
    const [root, pill] = await Promise.all([measure(rootRef), measure(pillRef)]);
    if (!root || !pill || !pill.width) return;
    const source = { x: sx - root.x, y: sy - root.y };
    const pillPoint =
      kind === "add"
        ? { x: pill.x - root.x + pill.width / 2, y: pill.y - root.y + pill.height / 2 }
        : { x: pill.x - root.x + 16, y: pill.y - root.y + pill.height / 2 };
    const id = `${kind}-${Date.now()}-${Math.random()}`;
    const flyer =
      kind === "add"
        ? { id, product: event.product, from: source, to: pillPoint, direction: 1 }
        : { id, product: event.product, from: pillPoint, to: source, direction: -1 };
    setFlyers((prev) => [...prev, flyer]);
  };

  useEffect(() => {
    if (lastAddEvent) launch(lastAddEvent, "add");
  }, [lastAddEvent]);

  useEffect(() => {
    if (lastRemoveEvent) launch(lastRemoveEvent, "remove");
  }, [lastRemoveEvent]);

  // Pulse when the cart changes (not during a fly animation or a removal).
  useEffect(() => {
    if (itemCount <= 0 || flyers.length > 0 || lastRemoveEvent) return;
    pulse.stopAnimation();
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 150, easing: ease, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 200, easing: easeInOut, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.04, duration: 100, easing: ease, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 150, easing: easeIn, useNativeDriver: true }),
    ]).start();
    // flyers.length and lastRemoveEvent are guards, as in the web effect deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount, total]);

  const pillBottom = bottom ?? (bottomOffset || 16) + insets.bottom;

  return (
    <View ref={rootRef} collapsable={false} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {flyers.map((f) => (
        <Flyer
          key={f.id}
          product={f.product}
          from={f.from}
          to={f.to}
          direction={f.direction}
          onDone={() => setFlyers((prev) => prev.filter((x) => x.id !== f.id))}
        />
      ))}
      {itemCount > 0 && !shouldHidePill ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.pillWrap,
            {
              bottom: pillBottom,
              opacity: enter,
              transform: [
                { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
              ],
            },
          ]}
        >
          <Animated.View ref={pillRef} collapsable={false} style={{ transform: [{ scale: pulse }] }}>
            <ScalePressable scaleTo={0.95} onPress={() => router.push(linkTo)} style={styles.pill}>
              <View style={styles.cartIcon}>
                <ShoppingCart size={14} color="#ffffff" />
              </View>
              <View style={styles.pillText}>
                <Text style={styles.pillTitle}>Cart</Text>
                <Text style={styles.pillSub}>
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </Text>
              </View>
              <ChevronRight size={16} color="#ffffff" style={styles.chevron} />
            </ScalePressable>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flyer: { position: "absolute", width: THUMB, height: THUMB, zIndex: 1000 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: "#ffffff",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  thumbImg: { width: "100%", height: "100%", borderRadius: THUMB / 2 },
  thumbFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#e5e5e5" },
  thumbLetter: { fontSize: 12, fontWeight: "600", color: "#a1a1a1" },
  pillWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 16, zIndex: 9999 },
  pill: {
    backgroundColor: "#ff6900",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 9999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 6,
    minWidth: 130,
    boxShadow: "0px 4px 20px rgba(255,102,0,0.45)",
  },
  cartIcon: { backgroundColor: "rgba(255,255,255,0.2)", padding: 6, borderRadius: 9999, marginRight: 10 },
  pillText: { flex: 1, alignItems: "center" },
  pillTitle: { color: "#ffffff", fontWeight: "700", fontSize: 13, lineHeight: 16 },
  pillSub: { color: "#ffffff", fontSize: 9, fontWeight: "500", opacity: 0.9, lineHeight: 12 },
  chevron: { marginLeft: 6 },
});
