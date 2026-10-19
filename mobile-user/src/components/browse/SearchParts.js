// Pieces of search/ProfessionalSearch.jsx and search/PremiumLoader.jsx: the "Preparing results"
// loader, result cards, the dish sheet and the full-screen "Listening..." voice overlay.
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, BadgePercent, Clock, Flame, MapPin, Mic, Star, Utensils, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppImage, BottomSheet, ScalePressable, Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";

const metaText = (isDark) => ({ fontSize: 12, fontWeight: "700", letterSpacing: -0.3, color: isDark ? zinc[400] : tw.gray500 });

const zinc = { 400: "#a1a1aa", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#09090b" };

function useLoop(make, deps) {
  useEffect(() => {
    const anim = make();
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const timing = (value, toValue, duration, extra = {}) =>
  Animated.timing(value, { toValue, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true, ...extra });

// ---------------- PremiumLoader ----------------

function FloatingFlame({ delay, size, color, style }) {
  const [v] = useState(() => new Animated.Value(0));
  useLoop(() => Animated.loop(Animated.sequence([Animated.delay(delay), timing(v, 1, 1000), timing(v, 2, 1000), timing(v, 0, 0)])), [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          position: "absolute",
          opacity: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1, 2], outputRange: [-5, -15, -5] }) },
            { scale: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.5, 1, 0.5] }) },
          ],
        },
      ]}
    >
      <Flame size={size} color={color} />
    </Animated.View>
  );
}

function BounceDot({ delay, color }) {
  const [v] = useState(() => new Animated.Value(0));
  useLoop(() => Animated.loop(Animated.sequence([Animated.delay(delay), timing(v, 1, 300), timing(v, 0, 300)])), [v, delay]);
  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        backgroundColor: color,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
      }}
    />
  );
}

export function PremiumLoader() {
  const { colors, isDark } = useTheme();
  const [glow] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [enter] = useState(() => new Animated.Value(0));
  useLoop(() => Animated.loop(Animated.sequence([timing(glow, 1, 750), timing(glow, 0, 750)])), [glow]);
  useLoop(() => Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })), [spin]);
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 300, delay: 200, useNativeDriver: true }).start();
  }, [enter]);

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80, width: "100%", minHeight: 300 }}>
      <View style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 999,
              backgroundColor: colors.primary + "33",
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.8] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.loaderCircle,
            shadow["2xl"],
            {
              backgroundColor: isDark ? zinc[800] : "#ffffff",
              borderColor: isDark ? zinc[900] : tw.gray50,
              transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
            },
          ]}
        >
          <View style={[styles.loaderDot, shadow.lg, { backgroundColor: colors.primary }]} />
          <Utensils size={24} color={colors.primary} />
        </Animated.View>
        <FloatingFlame delay={500} size={16} color="#a05485" style={{ top: 8, right: 8 }} />
        <FloatingFlame delay={1000} size={12} color={colors.primary} style={{ top: 16, left: 8 }} />
      </View>
      <Animated.View
        style={{
          marginTop: 24,
          alignItems: "center",
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "900", letterSpacing: 0.7, color: isDark ? tw.gray200 : tw.gray800 }}>PREPARING RESULTS</Text>
        <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
          {[0, 1, 2].map((i) => (
            <BounceDot key={i} delay={i * 150} color={colors.primary} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------- Result cards ----------------

export function FadeInItem({ index, offset = 15, children }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay: index * 80, stiffness: 300, damping: 24, useNativeDriver: true }).start();
  }, [v, index]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

function ShimmerBox({ color }) {
  const [o] = useState(() => new Animated.Value(1));
  useLoop(() => Animated.loop(Animated.sequence([timing(o, 0.5, 1000), timing(o, 1, 1000)])), [o]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: o }]} />;
}

function PureVegMark({ color = tw.green600, style }) {
  return (
    <View style={[styles.pureVeg, { borderColor: color }, style]}>
      <View style={{ flex: 1, alignSelf: "stretch", borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

export function DishResultCard({ r, query, imageUrl, onPress }) {
  const { colors, isDark } = useTheme();
  const price = r.matchedDishPrice || r.price;
  return (
    <ScalePressable
      scaleTo={0.98}
      onPress={onPress}
      style={[styles.dishCard, shadow.sm, { backgroundColor: isDark ? zinc[900] : "#ffffff", borderColor: isDark ? zinc[800] : tw.gray100 }]}
    >
      <View style={[styles.dishImage, { backgroundColor: isDark ? zinc[800] : tw.gray100 }]}>
        <ShimmerBox color={isDark ? zinc[700] : tw.gray200} />
        <AppImage src={imageUrl} width={96} placeholderType="none" style={StyleSheet.absoluteFill} />
        {r.pureVegRestaurant ? <PureVegMark style={{ position: "absolute", top: 6, left: 6 }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 4, justifyContent: "space-between" }}>
        <View>
          <View style={[styles.restPill, { backgroundColor: colors.primary + "0D" }]}>
            <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: "900", letterSpacing: 0.9, color: "#a05485" }}>
              {String(r.restaurantName || "").toUpperCase()}
            </Text>
          </View>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "900", color: isDark ? "#ffffff" : tw.gray900 }}>
            {r.matchedDish || query}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Star size={12} color={colors.primary} fill={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: "900", color: isDark ? "#ffffff" : tw.gray900 }}>{r.rating || "New"}</Text>
            </View>
            <Text style={{ fontSize: 11, color: tw.gray200 }}>•</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Clock size={12} color={isDark ? zinc[400] : tw.gray500} />
              <Text style={{ fontSize: 11, fontWeight: "500", color: isDark ? zinc[400] : tw.gray500 }}>{r.estimatedDeliveryTime || "30-40 mins"}</Text>
            </View>
          </View>
          {price ? (
            <View style={{ backgroundColor: isDark ? zinc[800] : tw.gray50, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "900", color: isDark ? "#ffffff" : tw.gray900 }}>₹{Number(price).toFixed(2)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScalePressable>
  );
}

export function RestaurantResultCard({ r, imageUrl, distanceLabel, onPress }) {
  const { colors, isDark } = useTheme();
  const cuisines = Array.isArray(r.cuisines) ? r.cuisines.join(", ") : "";
  return (
    <ScalePressable scaleTo={0.98} onPress={onPress}>
      <View style={[styles.restImage, { backgroundColor: isDark ? zinc[800] : tw.gray200, boxShadow: "0px 20px 25px -5px rgba(229,231,235,0.2)" }]}>
        <ShimmerBox color={isDark ? zinc[700] : tw.gray300} />
        <AppImage src={imageUrl} width={400} placeholderType="shop" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.8)"]}
          locations={[0, 0.5, 1]}
          style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}
        />
        <View style={styles.restBottom}>
          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: "900", color: "#ffffff", marginBottom: 6 }}>
              {r.restaurantName}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: "rgba(255,255,255,0.8)" }}>
              {cuisines.toUpperCase()}
            </Text>
          </View>
          <View style={styles.ratingGlass}>
            <Star size={16} color="#ffffff" fill="#ffffff" />
            <Text style={{ fontSize: 14, fontWeight: "900", color: "#ffffff" }}>{r.rating || "4.0"}</Text>
          </View>
        </View>
        {r.offer ? (
          <View style={[styles.offerRibbon, shadow.xl, { backgroundColor: colors.primary }]}>
            <BadgePercent size={14} color="#ffffff" />
            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "900", letterSpacing: -0.3, color: "#ffffff" }}>
              {String(r.offer).toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Clock size={14} color={colors.primary} />
            <Text style={metaText(isDark)}>{String(r.estimatedDeliveryTime || "30 mins").toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 12, color: tw.gray200 }}>•</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
            <MapPin size={14} color={colors.primary} />
            <Text numberOfLines={1} style={metaText(isDark)}>
              {String(distanceLabel).toUpperCase()}
            </Text>
          </View>
        </View>
        <LinearGradient colors={[colors.primary, "#a05485"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.viewMenu, shadow.lg]}>
          <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: "#ffffff" }}>VIEW MENU</Text>
        </LinearGradient>
      </View>
    </ScalePressable>
  );
}

// ---------------- Dish sheet ----------------

export function DishResultSheet({ dish, imageUrl, onClose, onViewAndAdd }) {
  const { colors, isDark } = useTheme();
  const priceLabel = dish?.matchedDishPrice
    ? `₹${Number(dish.matchedDishPrice).toFixed(2)}`
    : dish?.price
      ? `₹${Number(dish.price).toFixed(2)}`
      : "₹-";
  const description = dish?.matchedDishDescription || dish?.description;
  const chip = { backgroundColor: isDark ? zinc[800] : tw.gray100 };
  const chipText = { fontSize: 12, fontWeight: "700", letterSpacing: -0.3, color: isDark ? tw.gray300 : tw.gray700 };
  return (
    <BottomSheet
      visible={!!dish}
      onClose={onClose}
      style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: isDark ? zinc[900] : "#ffffff" }}
    >
      {dish ? (
        <>
          <Pressable onPress={onClose} style={styles.sheetClose}>
            <X size={20} color="#ffffff" />
          </Pressable>
          <View style={{ height: 224, width: "100%", backgroundColor: tw.gray100 }}>
            <AppImage src={imageUrl} width={400} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
            <View style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {dish.pureVegRestaurant ? <PureVegMark color={tw.green500} style={{ backgroundColor: "#ffffff" }} /> : null}
                <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 0.9, color: "#ffffff" }}>
                    {String(dish.restaurantName || "").toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={2} style={{ fontSize: 24, lineHeight: 30, fontWeight: "900", color: "#ffffff" }}>
                {dish.matchedDish || dish.name}
              </Text>
            </View>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <View style={[styles.infoChip, chip]}>
                <Star size={14} color="#eab308" fill="#eab308" />
                <Text style={chipText}>{String(dish.rating || "New").toUpperCase()}</Text>
              </View>
              <View style={[styles.infoChip, chip]}>
                <Clock size={14} color={isDark ? tw.gray300 : tw.gray700} />
                <Text style={chipText}>{String(dish.estimatedDeliveryTime || "30 mins").toUpperCase()}</Text>
              </View>
            </View>
            {description ? (
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 22,
                  marginBottom: 24,
                  padding: 16,
                  borderRadius: 16,
                  overflow: "hidden",
                  color: isDark ? tw.gray400 : tw.gray600,
                  backgroundColor: isDark ? "rgba(39,39,42,0.5)" : tw.gray50,
                }}
              >
                {description}
              </Text>
            ) : null}
          </ScrollView>
          <View style={[styles.sheetFooter, { backgroundColor: isDark ? zinc[900] : "#ffffff", borderTopColor: isDark ? zinc[800] : tw.gray100 }]}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: isDark ? tw.gray400 : tw.gray500 }}>PRICE</Text>
              <Text style={{ fontSize: 24, fontWeight: "900", color: isDark ? "#ffffff" : tw.gray900 }}>{priceLabel}</Text>
            </View>
            <ScalePressable
              scaleTo={0.95}
              onPress={onViewAndAdd}
              style={[styles.viewAdd, { backgroundColor: colors.primary, boxShadow: `0px 20px 25px -5px ${colors.primary}4D` }]}
            >
              <Text style={{ fontSize: 14, fontWeight: "900", letterSpacing: 0.7, color: "#ffffff" }}>VIEW & ADD</Text>
            </ScalePressable>
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

// ---------------- Voice overlay ----------------

const WAVE = [6, 12, 20, 32, 48, 36, 24, 14, 8];

function WaveBar({ height, delay }) {
  const [v] = useState(() => new Animated.Value(0));
  useLoop(() => Animated.loop(Animated.sequence([Animated.delay(delay), timing(v, 1, 600), timing(v, 0, 600)])), [v, delay]);
  return (
    <Animated.View
      style={[
        styles.waveBar,
        { height, transform: [{ scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] },
      ]}
    />
  );
}

function PulseDot({ index }) {
  const [v] = useState(() => new Animated.Value(0));
  useLoop(() => Animated.loop(Animated.sequence([Animated.delay(index * 200), timing(v, 1, 750), timing(v, 0, 750)])), [v, index]);
  const big = index === 1;
  return (
    <Animated.View
      style={{
        width: big ? 10 : 8,
        height: big ? 10 : 8,
        marginTop: big ? 0 : 1,
        borderRadius: 999,
        backgroundColor: big ? tw.red500 : "#441111",
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
      }}
    />
  );
}

export function VoiceListeningOverlay({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const [rotate] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [mic] = useState(() => new Animated.Value(0));
  const [text] = useState(() => new Animated.Value(0));
  useLoop(
    () =>
      visible
        ? Animated.parallel([
            Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })),
            Animated.loop(Animated.sequence([timing(pulse, 1, 1000), timing(pulse, 0, 1000)])),
            Animated.loop(Animated.sequence([timing(mic, 1, 750), timing(mic, 0, 750)])),
            Animated.loop(Animated.sequence([timing(text, 1, 1000), timing(text, 0, 1000)])),
          ])
        : Animated.delay(0),
    [visible, rotate, pulse, mic, text],
  );
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.voiceRoot}>
        <Pressable onPress={onClose} style={[styles.voiceBack, { top: insets.top + 24 }]}>
          <ArrowLeft size={24} color="rgba(255,255,255,0.5)" />
        </Pressable>

        <View style={styles.voiceStage}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.dashedRing,
              { transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] },
            ]}
          />
          <Animated.View
            style={[styles.innerRing, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }]}
          />
          <View style={[styles.wing, { left: -40, justifyContent: "flex-end" }]}>
            {WAVE.map((h, i) => (
              <WaveBar key={`l-${i}`} height={h} delay={i * 100} />
            ))}
          </View>
          <View style={[styles.wing, { right: -40, justifyContent: "flex-start" }]}>
            {WAVE.map((h, i) => (
              <WaveBar key={`r-${i}`} height={h} delay={(8 - i) * 100} />
            ))}
          </View>
          <LinearGradient colors={["#2a2a2a", "#0a0a0a"]} style={styles.micButton}>
            <Animated.View style={{ transform: [{ scale: mic.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }}>
              <Mic size={56} color={tw.red500} fill={tw.red500} strokeWidth={1} />
            </Animated.View>
          </LinearGradient>
        </View>

        <View style={{ alignItems: "center", gap: 16, paddingHorizontal: 24, marginTop: 16 }}>
          <Animated.View style={{ opacity: text.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }}>
            <Text style={{ fontSize: 22, fontWeight: "700", letterSpacing: 0.5, color: tw.red500 }}>Listening...</Text>
          </Animated.View>
          <Text style={{ fontSize: 15, lineHeight: 24, fontWeight: "500", color: tw.gray400, textAlign: "center", maxWidth: 200 }}>
            {"How can we help\nyou with your order?"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 40 }}>
          {[0, 1, 2].map((i) => (
            <PulseDot key={i} index={i} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loaderCircle: { width: 64, height: 64, borderRadius: 999, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  loaderDot: { position: "absolute", top: -8, width: 16, height: 16, borderRadius: 999 },
  dishCard: { flexDirection: "row", gap: 16, padding: 12, borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  dishImage: { width: 96, height: 96, borderRadius: 16, overflow: "hidden" },
  pureVeg: { width: 16, height: 16, borderWidth: 1, padding: 1.5, backgroundColor: "#ffffff", borderRadius: 2, alignItems: "center", justifyContent: "center" },
  restPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 4, maxWidth: "100%" },
  restImage: { borderRadius: 32, overflow: "hidden", aspectRatio: 16 / 10, marginBottom: 16 },
  restBottom: { position: "absolute", bottom: 16, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  ratingGlass: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  offerRibbon: {
    position: "absolute",
    top: 20,
    left: 0,
    maxWidth: "85%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  viewMenu: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  sheetClose: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sheetFooter: { padding: 16, borderTopWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  viewAdd: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  voiceRoot: { flex: 1, backgroundColor: "#050505", alignItems: "center", justifyContent: "center" },
  voiceBack: { position: "absolute", left: 24, padding: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)" },
  voiceStage: { width: 280, height: 280, alignItems: "center", justifyContent: "center", marginBottom: 48, marginTop: 40 },
  dashedRing: { borderRadius: 999, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(220,38,38,0.3)" },
  innerRing: { position: "absolute", top: 32, left: 32, right: 32, bottom: 32, borderRadius: 999, borderWidth: 1, borderColor: "rgba(220,38,38,0.8)" },
  wing: { position: "absolute", height: 96, width: 80, flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.9 },
  waveBar: { width: 6, borderRadius: 999, backgroundColor: tw.red600, boxShadow: "0px 0px 8px rgba(220,38,38,0.6)" },
  micButton: {
    width: 144,
    height: 144,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 0px 0px 2px rgba(220,38,38,0.8), 0px 0px 60px rgba(220,38,38,0.3)",
  },
});
