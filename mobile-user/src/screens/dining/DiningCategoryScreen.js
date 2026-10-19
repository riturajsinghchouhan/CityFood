// Port of Frontend/src/modules/Food/pages/user/DiningCategory.jsx (/dining/:category).
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BadgePercent, Bookmark, Clock, MapPin, Star, UtensilsCrossed } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { getDiningRestaurants } from "../../api";
import DashedLine from "../../components/orders/DashedLine";
import { getRestaurantAvailabilityStatus } from "../../components/restaurant-cards";
import { AppImage, Screen, Text } from "../../components/ui";
import { FaLocationDot } from "../../components/ui/BrandIcons";
import { useAppLocation } from "../../context/LocationContext";
import { useProfile } from "../../context/ProfileContext";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { NAV_KEYS, formatTimeValue, navigateWithState, slugifyValue } from "./diningLib";

const formatAddress = (restaurant) =>
  restaurant?.location?.addressLine1 ||
  restaurant?.location?.formattedAddress ||
  restaurant?.location?.address ||
  [restaurant?.location?.area || restaurant?.area, restaurant?.location?.city || restaurant?.city]
    .filter(Boolean)
    .join(", ") ||
  "Address unavailable";

const formatTimingLabel = (status) => {
  if (!status?.openingTime || !status?.closingTime) return "Timings not updated";
  return `${formatTimeValue(status.openingTime)} - ${formatTimeValue(status.closingTime)}`;
};

const formatCategoryHeading = (category) =>
  String(category || "dining")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

function CategoryRestaurantCard({ restaurant, category, favorite, onToggleFavorite }) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [imageFailed, setImageFailed] = useState(false);
  const open = restaurant.availability?.isOpen;
  return (
    <Pressable
      onPress={() =>
        navigateWithState(
          { pathname: "/dining/[diningType]/[slug]", params: { diningType: category, slug: restaurant.slug } },
          NAV_KEYS.details(restaurant.slug),
          { restaurant },
        )
      }
      style={[
        styles.card,
        {
          borderColor: isDark ? tw.gray800 : "#f0dfca",
          backgroundColor: isDark ? "#141414" : "#ffffff",
          boxShadow: isDark ? "0px 18px 60px rgba(0,0,0,0.35)" : "0px 18px 60px rgba(17,24,39,0.08)",
        },
      ]}
    >
      <View style={styles.cardImage}>
        {restaurant.image && !imageFailed ? (
          <AppImage
            src={restaurant.image}
            width={width - 32}
            placeholderType="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
            onError={() => setImageFailed(true)}
          />
        ) : null}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.8)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardTopRow}>
          <View style={styles.dishPill}>
            <Text style={styles.dishPillText}>
              {restaurant.featuredDish}
              {restaurant.featuredPrice ? ` • ₹${restaurant.featuredPrice}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={onToggleFavorite}
            style={[styles.bookmarkBtn, { backgroundColor: isDark ? "rgba(31,31,31,0.9)" : "rgba(255,255,255,0.9)" }]}
          >
            <Bookmark
              size={20}
              color={isDark ? "#ffffff" : "#2f2215"}
              fill={favorite ? (isDark ? "#ffffff" : "#2f2215") : "none"}
            />
          </Pressable>
        </View>
        <View style={styles.cardImageBottom}>
          <Text style={styles.reserveEyebrow}>RESERVE YOUR TABLE</Text>
          <Text style={styles.offerText}>{restaurant.offer}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.name, { color: isDark ? "#ffffff" : "#23180f" }]}>
              {restaurant.name}
            </Text>
            <Text numberOfLines={2} style={[styles.address, { color: isDark ? tw.gray300 : "#6b5641" }]}>
              {restaurant.address}
            </Text>
          </View>
          <View style={styles.ratingPill}>
            <Text style={styles.ratingText}>{restaurant.rating}</Text>
            <Star size={14} color="#ffffff" fill="#ffffff" />
          </View>
        </View>

        <View style={styles.cuisineRow}>
          <UtensilsCrossed size={16} color={colors.primary} />
          <Text numberOfLines={1} style={[styles.cuisine, { color: isDark ? tw.gray300 : "#5f4c39" }]}>
            {restaurant.cuisine}
          </Text>
        </View>

        <View style={styles.pillsRow}>
          <View
            style={[
              styles.statusPill,
              open
                ? { backgroundColor: isDark ? "rgba(2,44,34,0.4)" : "#ecfdf5" }
                : { backgroundColor: isDark ? "rgba(76,5,25,0.4)" : "#fff1f2" },
            ]}
          >
            <Clock size={14} color={open ? (isDark ? "#6ee7b7" : "#047857") : isDark ? "#fda4af" : "#be123c"} />
            <Text
              style={[
                styles.pillText,
                { color: open ? (isDark ? "#6ee7b7" : "#047857") : isDark ? "#fda4af" : "#be123c" },
              ]}
            >
              {open ? "Open now" : "Closed now"}
            </Text>
          </View>
          <View style={[styles.timingPill, { backgroundColor: isDark ? "#2a1d12" : "#fff4e7" }]}>
            <Text style={[styles.pillText, { color: isDark ? "#fdba74" : "#a25b1f" }]}>
              {formatTimingLabel(restaurant.availability)}
            </Text>
          </View>
        </View>

        <DashedLine color={isDark ? tw.gray700 : "#ead7c0"} />
        <View style={styles.cardFooter}>
          <Text style={[styles.price, { color: isDark ? tw.gray200 : "#4c3b2c" }]}>{restaurant.price}</Text>
          <View style={styles.menuLink}>
            <BadgePercent size={16} color={colors.primary} />
            <Text style={[styles.menuLinkText, { color: colors.primary }]}>Menu & booking</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function DiningCategoryScreen() {
  const { category } = useLocalSearchParams();
  const goBack = useAppBack();
  const { colors, isDark } = useTheme();
  const { location } = useAppLocation();
  const { addFavorite, removeFavorite, isFavorite } = useProfile();

  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const city = location?.city;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const params = category ? (city ? { category, city } : { category }) : city ? { city } : {};
        const response = await getDiningRestaurants(params);
        if (cancelled) return;
        if (response?.success) {
          const mapped = (Array.isArray(response.data) ? response.data : []).map((restaurant) => ({
            id: restaurant._id || restaurant.id,
            slug: restaurant.restaurantNameNormalized || slugifyValue(restaurant.restaurantName || restaurant.name),
            name: restaurant.restaurantName || restaurant.name || "Restaurant",
            image:
              restaurant.coverImage ||
              restaurant.menuImages?.[0] ||
              restaurant.profileImage?.url ||
              restaurant.profileImage ||
              "",
            address: formatAddress(restaurant),
            cuisine:
              Array.isArray(restaurant.cuisines) && restaurant.cuisines.length > 0
                ? restaurant.cuisines.join(" • ")
                : "Multi-cuisine",
            price: restaurant.costForTwo ? `Rs ${restaurant.costForTwo} for two` : "Price on request",
            rating: Number(restaurant.rating || restaurant.avgRating || 0).toFixed(1),
            offer: restaurant.offer || "Pre-book tables and dining offers",
            featuredDish: restaurant.featuredDish || "Chef's special",
            featuredPrice: restaurant.featuredPrice || null,
            availability: getRestaurantAvailabilityStatus(restaurant),
          }));
          setRestaurants(mapped);
          setError(null);
        } else {
          setRestaurants([]);
        }
      } catch {
        if (cancelled) return;
        setError("Failed to load dining restaurants");
        setRestaurants([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, city]);

  const heading = useMemo(() => formatCategoryHeading(category), [category]);
  const cityName = city || "Select location";
  const pageBg = isDark ? "#0a0a0a" : "#fffaf4";

  const hero = (
    <View
      style={[
        styles.hero,
        {
          borderColor: isDark ? tw.gray800 : "#f0dfca",
          boxShadow: isDark ? "0px 18px 60px rgba(0,0,0,0.35)" : "0px 18px 60px rgba(90,55,20,0.08)",
        },
      ]}
    >
      <LinearGradient
        colors={isDark ? ["#161616", "#101010", "#1a1a1a"] : ["#fff4e7", "#ffffff", "#fff9f3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={[styles.heroEyebrow, { color: isDark ? "#fdba74" : "#c07a3a" }]}>DINING CATEGORY</Text>
      <Text style={[styles.heroTitle, { color: isDark ? "#ffffff" : "#23180f" }]}>{heading}</Text>
      <Text style={[styles.heroBody, { color: isDark ? tw.gray300 : "#6b5641" }]}>
        Explore all restaurants linked to this dining category, check their timings, preview the menu, and jump
        straight into table booking.
      </Text>
      <View
        style={[
          styles.countPill,
          isDark ? { backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: tw.gray700 } : { backgroundColor: "#ffffff" },
        ]}
      >
        <MapPin size={16} color={colors.primary} />
        <Text style={[styles.countText, { color: isDark ? tw.gray300 : "#6b5641" }]}>
          {restaurants.length} places found
        </Text>
      </View>
    </View>
  );

  let empty = null;
  if (isLoading) {
    empty = <Text style={[styles.stateText, { color: isDark ? tw.gray400 : "#7f6850" }]}>Loading dining restaurants...</Text>;
  } else if (error) {
    empty = <Text style={[styles.stateText, { color: tw.red600 }]}>{error}</Text>;
  } else {
    empty = (
      <View
        style={[
          styles.emptyBox,
          { borderColor: isDark ? tw.gray800 : "#e8d9c5", backgroundColor: isDark ? "#141414" : "#ffffff" },
        ]}
      >
        <Text style={[styles.emptyText, { color: isDark ? tw.gray400 : "#7f6850" }]}>
          No restaurants are linked to this dining category yet.
        </Text>
      </View>
    );
  }

  return (
    <Screen background={pageBg}>
      <View
        style={[
          styles.header,
          {
            borderColor: isDark ? tw.gray800 : "#efe2d2",
            backgroundColor: isDark ? "rgba(10,10,10,0.95)" : "rgba(255,250,244,0.95)",
          },
        ]}
      >
        <Pressable
          onPress={goBack}
          style={[
            styles.backBtn,
            { borderColor: isDark ? tw.gray700 : "#e7d8c5", backgroundColor: isDark ? "#1a1a1a" : "#ffffff" },
          ]}
        >
          <ArrowLeft size={20} color={isDark ? "#ffffff" : "#2f2215"} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/address-selector")}
          style={[
            styles.locationPill,
            { borderColor: isDark ? tw.gray700 : "#e7d8c5", backgroundColor: isDark ? "#1a1a1a" : "#ffffff" },
          ]}
        >
          <FaLocationDot size={16} color={colors.primary} />
          <View>
            <Text style={[styles.diningIn, { color: isDark ? tw.gray400 : "#aa8b68" }]}>DINING IN</Text>
            <Text style={[styles.cityName, { color: isDark ? "#ffffff" : "#2f2215" }]}>{cityName}</Text>
          </View>
        </Pressable>
      </View>

      <FlatList
        data={isLoading || error ? [] : restaurants}
        keyExtractor={(item, index) => String(item.id || `${item.slug}-${index}`)}
        ListHeaderComponent={hero}
        ListEmptyComponent={empty}
        renderItem={({ item }) => (
          <CategoryRestaurantCard
            restaurant={item}
            category={category}
            favorite={isFavorite(item.slug)}
            onToggleFavorite={() => {
              if (isFavorite(item.slug)) {
                removeFavorite(item.slug);
                return;
              }
              addFavorite({
                slug: item.slug,
                name: item.name,
                cuisine: item.cuisine,
                rating: item.rating,
                image: item.image,
              });
            }}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  backBtn: { height: 40, width: 40, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  diningIn: { fontSize: 12, fontWeight: "600", letterSpacing: 2.9 },
  cityName: { fontSize: 14, fontWeight: "700" },
  listContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 + 96 },
  hero: { marginBottom: 24, borderRadius: 28, borderWidth: 1, padding: 24, overflow: "hidden" },
  heroEyebrow: { marginBottom: 8, fontSize: 12, fontWeight: "600", letterSpacing: 4.1 },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: "900", letterSpacing: -0.75 },
  heroBody: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  countPill: {
    marginTop: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  countText: { fontSize: 14, fontWeight: "600" },
  stateText: { paddingVertical: 80, textAlign: "center" },
  emptyBox: { borderRadius: 24, borderWidth: 1, borderStyle: "dashed", paddingHorizontal: 24, paddingVertical: 64 },
  emptyText: { textAlign: "center" },
  card: { borderRadius: 30, borderWidth: 1, overflow: "hidden" },
  cardImage: { height: 256, overflow: "hidden" },
  cardTopRow: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  dishPill: { borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 6, flexShrink: 1 },
  dishPillText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  bookmarkBtn: { height: 40, width: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  cardImageBottom: { position: "absolute", left: 16, right: 16, bottom: 16 },
  reserveEyebrow: { marginBottom: 8, fontSize: 11, fontWeight: "600", letterSpacing: 3.5, color: "rgba(255,255,255,0.8)" },
  offerText: { maxWidth: "85%", fontSize: 24, lineHeight: 28, fontWeight: "900", color: "#ffffff" },
  cardBody: { padding: 20, gap: 16 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  name: { fontSize: 22, lineHeight: 27, fontWeight: "900" },
  address: { marginTop: 8, fontSize: 14, lineHeight: 24 },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ratingText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  cuisineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cuisine: { flex: 1, fontSize: 14 },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  timingPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: "600" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { fontSize: 14, fontWeight: "600" },
  menuLink: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuLinkText: { fontSize: 14, fontWeight: "700" },
});
