// Port of Frontend/src/modules/Food/pages/user/restaurants/Restaurants.jsx ("All Restaurants").
// The web Footer is desktop-only (hidden md:block) and is not rendered.
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, Clock, Heart, MapPin, Star } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RestaurantGridSkeleton } from "../../components/restaurant/Skeletons";
import { AppImage, Screen, Text, useDelayedLoading } from "../../components/ui";
import { getRestaurants } from "../../api";
import { useAppLogo } from "../../context/AppSettingsContext";
import { useAppLocation } from "../../context/LocationContext";
import { useProfile } from "../../context/ProfileContext";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { normalizeImageUrl } from "./lib";

const pickRestaurantImage = (r) => {
  const candidates = [
    r?.coverImage?.url,
    r?.coverImage,
    ...(Array.isArray(r?.coverImages) ? r.coverImages.map((img) => img?.url || img) : []),
    ...(Array.isArray(r?.menuImages) ? r.menuImages.map((img) => img?.url || img) : []),
    r?.profileImage?.url,
    r?.profileImage,
  ];
  return normalizeImageUrl(candidates.find((v) => typeof v === "string" && v.trim()) || "");
};

function RestaurantRow({ restaurant }) {
  const { colors, isDark } = useTheme();
  const { addFavorite, removeFavorite, isFavorite } = useProfile();
  const favorite = !restaurant.isBanned && isFavorite(restaurant.slug);
  const toggle = () => {
    if (restaurant.isBanned) return;
    if (favorite) removeFavorite(restaurant.slug);
    else
      addFavorite({
        slug: restaurant.slug,
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        rating: restaurant.rating,
        deliveryTime: restaurant.deliveryTime,
        distance: restaurant.distance,
        priceRange: restaurant.priceRange,
        image: restaurant.image,
      });
  };
  const muted = isDark ? tw.gray400 : tw.gray600;
  return (
    <Pressable
      disabled={restaurant.isBanned}
      onPress={() => router.push(`/restaurants/${restaurant.slug}`)}
      style={[
        styles.card,
        { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray200 },
        restaurant.isBanned && { opacity: 0.75, filter: [{ grayscale: 1 }] },
      ]}
    >
      <View style={{ flexDirection: "row", minHeight: 120, flex: 1 }}>
        <View style={{ flex: 1, padding: 12, minWidth: 0, justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: "600", marginBottom: 4, color: isDark ? "#ffffff" : tw.gray900 }}>
                {restaurant.name}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "500", marginBottom: 8, color: muted }}>
                {restaurant.cuisine}
              </Text>
              <View style={[styles.ratingChip, { backgroundColor: isDark ? "rgba(113,63,18,0.3)" : "#fefce8" }]}>
                <Star size={12} color={tw.yellow400} fill={tw.yellow400} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? tw.yellow400 : "#a65f00" }}>{restaurant.rating.toFixed(1)}</Text>
              </View>
            </View>
            {!restaurant.isBanned ? (
              <Pressable onPress={toggle} hitSlop={6} style={styles.heart}>
                <Heart
                  size={16}
                  color={favorite ? (isDark ? "#ff6467" : tw.red500) : isDark ? tw.gray500 : tw.gray400}
                  fill={favorite ? (isDark ? "#ff6467" : tw.red500) : "transparent"}
                />
              </Pressable>
            ) : null}
          </View>
          <View style={[styles.bottomRow, { borderTopColor: isDark ? tw.gray800 : tw.gray200 }]}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 4, flex: 1 }}>
              <View style={styles.meta}>
                <Clock size={12} color={muted} />
                <Text style={{ fontSize: 12, fontWeight: "500", color: muted }}>{restaurant.deliveryTime}</Text>
              </View>
              <View style={styles.meta}>
                <MapPin size={12} color={muted} />
                <Text style={{ fontSize: 12, fontWeight: "500", color: muted }}>{restaurant.distance}</Text>
              </View>
            </View>
            {restaurant.isBanned ? (
              <View style={styles.offline}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#ffffff" }}>Offline</Text>
              </View>
            ) : (
              <View style={[styles.orderNow, { backgroundColor: colors.primary }]}>
                <Text style={{ fontSize: 12, fontWeight: "500", color: "#ffffff" }}>Order Now</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ width: 144 }}>
          <AppImage src={restaurant.image || null} width={144} placeholderType="shop" style={StyleSheet.absoluteFill} />
        </View>
      </View>
    </Pressable>
  );
}

function EndOfList() {
  const { isDark } = useTheme();
  const logo = useAppLogo();
  const line = isDark ? ["transparent", "#27272a", "#3f3f46"] : ["transparent", tw.gray200, tw.gray300];
  return (
    <View style={{ paddingTop: 40, paddingBottom: 24, alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, width: "100%", maxWidth: 320 }}>
        <LinearGradient colors={line} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1, flex: 1 }} />
        <View style={[styles.logoRing, { borderColor: isDark ? "rgba(39,39,42,0.6)" : tw.gray100 }]}>
          <View style={[styles.logoCircle, { backgroundColor: isDark ? "#18181b" : "#ffffff", borderColor: isDark ? "#27272a" : "rgba(229,231,235,0.9)" }]}>
            <AppImage
              src={logo || require("../../../assets/images/logo.png")}
              fallbackSrc={require("../../../assets/images/logo.png")}
              placeholderType="none"
              contentFit="contain"
              style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
            />
          </View>
        </View>
        <LinearGradient colors={line} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={{ height: 1, flex: 1 }} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1.1, marginTop: 12, color: isDark ? "#71717b" : tw.gray400 }}>
        {"THAT'S ALL FOR NOW"}
      </Text>
    </View>
  );
}

export default function RestaurantsScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { zoneId } = useAppLocation();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = { limit: 300, _ts: Date.now() };
        if (zoneId) params.zoneId = zoneId;
        const res = await getRestaurants(params);
        const list = res?.data?.restaurants || [];
        if (cancelled) return;
        const transformed = list.map((r) => {
          const slug = r?.slug || String(r?.name || "").toLowerCase().trim().replace(/\s+/g, "-");
          const isBanned = Boolean(
            r?.isBanned === true || r?.status === "banned" || (r?.status === "rejected" && /disabled by admin|banned/i.test(r?.rejectionReason || "")),
          );
          return {
            id: r?._id || r?.restaurantId || slug,
            isBanned,
            slug,
            name: r?.name || "Unknown Restaurant",
            cuisine: Array.isArray(r?.cuisines) && r.cuisines.length > 0 ? r.cuisines[0] : "Multi-cuisine",
            rating: Number(r?.rating || 0) || 4.5,
            deliveryTime: r?.estimatedDeliveryTime || (r?.estimatedDeliveryTimeMinutes ? `${r.estimatedDeliveryTimeMinutes} mins` : "25-30 mins"),
            distance: r?.distance ? (typeof r.distance === "number" ? `${r.distance.toFixed(1)} km` : r.distance) : "1.2 km",
            priceRange: r?.priceRange || "$$",
            image: pickRestaurantImage(r),
          };
        });
        transformed.sort((a, b) => (a.isBanned === b.isBanned ? 0 : a.isBanned ? 1 : -1));
        setRestaurants(transformed);
      } catch {
        if (!cancelled) setRestaurants([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
      {/* Web: <Link to="/">. */}
      <Pressable onPress={() => goTo("/")} hitSlop={6} style={styles.back}>
        <ArrowLeft size={16} color={isDark ? tw.gray100 : tw.gray900} />
      </Pressable>
      <Text style={{ fontSize: 18, fontWeight: "700", color: isDark ? "#ffffff" : tw.gray900 }}>All Restaurants</Text>
    </View>
  );

  const hasRestaurants = restaurants.length > 0;

  return (
    <Screen background={isDark ? "#0a0a0a" : "#fefdf8"}>
      <LinearGradient
        colors={isDark ? ["#0a0a0a", "#0a0a0a", "#0a0a0a"] : ["rgba(254,252,232,0.3)", "#ffffff", "rgba(255,247,237,0.2)"]}
        style={StyleSheet.absoluteFill}
      />
      <FlatList
        data={showSkeleton || !hasRestaurants ? [] : restaurants}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => <RestaurantRow restaurant={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <View>
            {header}
            {showSkeleton ? <RestaurantGridSkeleton count={4} /> : null}
            {!showSkeleton && !loading && !hasRestaurants ? (
              <View style={{ paddingVertical: 64, alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: tw.gray500 }}>No restaurants available right now.</Text>
              </View>
            ) : null}
            {!showSkeleton && hasRestaurants ? <View style={{ height: 8 }} /> : null}
          </View>
        }
        ListFooterComponent={!showSkeleton && hasRestaurants ? <EndOfList /> : null}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 16 + insets.bottom }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { height: 32, width: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: 24,
    paddingBottom: 4,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  ratingChip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  heart: { height: 28, width: 28, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8, borderTopWidth: 1 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  offline: { backgroundColor: tw.gray400, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  orderNow: { height: 28, paddingHorizontal: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  logoRing: { borderWidth: 4, borderRadius: 999 },
  logoCircle: { height: 56, width: 56, borderRadius: 999, borderWidth: 1, padding: 10, overflow: "hidden", boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
});
