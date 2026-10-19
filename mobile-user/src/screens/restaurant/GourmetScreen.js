// Port of Frontend/src/modules/Food/pages/user/Gourmet.jsx.
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, BadgePercent, Bookmark, Clock, Star, Utensils } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getGourmetRestaurants } from "../../api";
import { RestaurantGridSkeleton } from "../../components/restaurant/Skeletons";
import { AppImage, Button, Screen, Text, toast, useDelayedLoading } from "../../components/ui";
import { useAppLocation } from "../../context/LocationContext";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const BANNER = require("../../../assets/images/gourmet_new_banner.png");

function LivePulse() {
  const [o] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ height: 6, width: 6, borderRadius: 999, backgroundColor: tw.green500, opacity: o }} />;
}

function GourmetCard({ item, favorite, onToggleFavorite }) {
  const { colors, isDark } = useTheme();
  const restaurant = item.restaurant || item;
  const slug =
    restaurant.slug ||
    restaurant.restaurantName?.toLowerCase().replace(/\s+/g, "-") ||
    restaurant.name?.toLowerCase().replace(/\s+/g, "-") ||
    "";
  // The web reads window.location for the user's coordinates, so the computed distance never
  // applies: it shows restaurant.distance or "1.2 km". Kept as on web.
  const distanceStr = restaurant.distance || "1.2 km";
  const cover = Array.isArray(restaurant.coverImages) ? restaurant.coverImages.map((i) => i?.url || i).filter(Boolean) : [];
  const menu = Array.isArray(restaurant.menuImages) ? restaurant.menuImages.map((i) => i?.url || i).filter(Boolean) : [];
  const image = cover[0] || menu[0] || restaurant.profileImage?.url || restaurant.profileImage || restaurant.image || "";
  return (
    <Pressable
      onPress={() => router.push(`/restaurants/${slug}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", transform: [{ scale: pressed ? 0.98 : 1 }] },
        !isDark && { boxShadow: "0px 20px 25px -5px rgba(229,231,235,0.2), 0px 8px 10px -6px rgba(229,231,235,0.2)" },
      ]}
    >
      <View style={styles.cardImage}>
        {image ? (
          <AppImage src={image} width={400} style={StyleSheet.absoluteFill} placeholderType="shop" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: isDark ? "#27272a" : tw.gray100 }]}>
            <Utensils size={32} color={tw.gray200} />
          </View>
        )}
        <LinearGradient colors={["transparent", "transparent", "rgba(0,0,0,0.6)"]} style={[StyleSheet.absoluteFill, { opacity: 0.6 }]} />
        <Pressable onPress={onToggleFavorite} style={styles.bookmark}>
          <Bookmark size={20} strokeWidth={2} color={favorite ? "#ffffff" : "rgba(255,255,255,0.8)"} fill={favorite ? "#ffffff" : "transparent"} />
        </Pressable>
        <View style={styles.ratingBadge}>
          <Text style={{ fontSize: 14, fontWeight: "900", color: tw.gray900 }}>{restaurant.rating?.toFixed?.(1) || "4.0"}</Text>
          <Star size={14} color={colors.primary} fill={colors.primary} />
        </View>
      </View>
      <View style={{ padding: 20 }}>
        <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: "900", marginBottom: 12, color: isDark ? tw.gray100 : tw.gray900 }}>
          {restaurant.restaurantName || restaurant.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Clock size={16} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.meta}>{(restaurant.estimatedDeliveryTime || "25-30 mins").toUpperCase()}</Text>
          </View>
          {/* The web source has a mis-encoded bullet; the intended one is shown. */}
          <Text style={{ color: tw.gray200, fontSize: 12 }}>{"\u2022"}</Text>
          <Text style={[styles.meta, { color: "#a05485", fontWeight: "900" }]}>{`${distanceStr} away`.toUpperCase()}</Text>
        </View>
        {restaurant.offer ? (
          <View style={[styles.offer, { backgroundColor: colors.primary + (isDark ? "1A" : "0D") }]}>
            <BadgePercent size={16} color={colors.primary} strokeWidth={3} />
            <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.primary }}>{String(restaurant.offer).toUpperCase()}</Text>
          </View>
        ) : (
          <View style={[styles.offer, { backgroundColor: isDark ? "#18181b" : tw.gray50 }]}>
            <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: tw.gray400 }}>ELITE SELECTION</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function GourmetScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const { height } = useWindowDimensions();
  const { zoneId } = useAppLocation();
  const [favorites, setFavorites] = useState(() => new Set());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const showSkeleton = useDelayedLoading(loading);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getGourmetRestaurants(zoneId);
      const data = res?.data;
      setList(data?.restaurants ?? (Array.isArray(data) ? data : []));
    } catch (err) {
      const message = err?.message || "Failed to load Gourmet restaurants";
      setError(message);
      toast.error(message);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [zoneId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const toggleFavorite = (id) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"} edges={[]} statusBarStyle="light">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={[styles.banner, { height: height * 0.3 }]}>
          <AppImage src={BANNER} placeholderType="none" style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.05 }] }]} />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.8)"]} style={StyleSheet.absoluteFill} />
          <Pressable onPress={goBack} style={({ pressed }) => [styles.back, { top: insets.top + 16, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
          <View style={styles.bannerText}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 32, height: 2, backgroundColor: colors.primary }} />
              <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 3, color: "rgba(255,255,255,0.8)" }}>EXPERIENCE EXCELLENCE</Text>
            </View>
            <Text style={{ fontSize: 30, fontWeight: "900", color: "#ffffff", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 12 }}>
              Gourmet Dining
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.7)", maxWidth: 448 }}>
              {"Indulge in carefully curated premium dining from the city's finest restaurants."}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingVertical: 24, gap: 16 }}>
          <View style={[styles.countBar, { borderBottomColor: isDark ? "#27272a" : tw.gray100 }]}>
            <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 2, color: isDark ? tw.gray500 : tw.gray400 }}>
              {showSkeleton ? "..." : list.length} PREMIER ESTABLISHMENTS
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LivePulse />
              <Text style={{ fontSize: 10, fontWeight: "700", color: tw.gray500 }}>LIVE DEALS AVAILABLE</Text>
            </View>
          </View>

          {showSkeleton ? <RestaurantGridSkeleton count={4} /> : null}

          {error && !loading ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
              <Text style={{ textAlign: "center", color: isDark ? "#ff6467" : tw.red500 }}>{error}</Text>
              <Button title="Retry" onPress={fetchList} style={{ marginTop: 16 }} />
            </View>
          ) : null}

          {!showSkeleton && !error ? (
            list.length === 0 ? (
              <View style={{ paddingVertical: 48, alignItems: "center" }}>
                <Text style={{ fontSize: 16, textAlign: "center", color: isDark ? tw.gray400 : tw.gray500 }}>
                  No Gourmet restaurants available at the moment
                </Text>
              </View>
            ) : (
              list.map((item, i) => {
                const r = item.restaurant || item;
                const id = r._id || r.restaurantId || r.id || String(i);
                return <GourmetCard key={id} item={item} favorite={favorites.has(id)} onToggleFavorite={() => toggleFavorite(id)} />;
              })
            )
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  banner: { width: "100%", overflow: "hidden", boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)" },
  back: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: { position: "absolute", bottom: 32, left: 24, right: 24, gap: 8 },
  countBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1 },
  card: { borderRadius: 32, overflow: "hidden", marginBottom: 16 },
  cardImage: { height: 192, width: "100%", overflow: "hidden", borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  bookmark: {
    position: "absolute",
    top: 16,
    right: 16,
    height: 40,
    width: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  meta: { fontSize: 12, fontWeight: "700", color: tw.gray500, letterSpacing: -0.3 },
  offer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, alignSelf: "flex-start" },
});
