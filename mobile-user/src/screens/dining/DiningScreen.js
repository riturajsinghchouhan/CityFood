// Port of Frontend/src/modules/Food/pages/user/Dining.jsx (bottom-nav root with no tab of its own).
// The sticky white header (PageNavbar + search) stays above the scrolling list.
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { getDiningCategories, getDiningHeroBanners, getDiningRestaurants } from "../../api";
import DiningFilterSheet from "../../components/dining/DiningFilterSheet";
import {
  DiningCategoryGrid,
  DiningEmptyState,
  DiningFilterChips,
  DiningHeroBanner,
  DiningRestaurantCard,
  DiningRestaurantSkeleton,
  DiningSearchBar,
  DiningSectionHeader,
} from "../../components/dining/DiningParts";
import PageNavbar from "../../components/shell/PageNavbar";
import { Screen } from "../../components/ui";
import { useAppLocation } from "../../context/LocationContext";
import { useProfile } from "../../context/ProfileContext";
import { useSearchOverlay } from "../../context/SearchOverlayContext";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";
import { NAV_KEYS, navigateWithState, slugifyValue } from "./diningLib";

const getCoordinates = (restaurant) => {
  const latitude = restaurant?.location?.latitude;
  const longitude = restaurant?.location?.longitude;
  if (typeof latitude === "number" && typeof longitude === "number") return { latitude, longitude };
  const coords = restaurant?.location?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) return { latitude: coords[1], longitude: coords[0] };
  return null;
};

const getDistanceKm = (userLocation, restaurant) => {
  const userLat = Number(userLocation?.latitude);
  const userLng = Number(userLocation?.longitude);
  const restaurantCoords = getCoordinates(restaurant);
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng) || !restaurantCoords) {
    return Number.POSITIVE_INFINITY;
  }
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(restaurantCoords.latitude - userLat);
  const dLng = toRadians(restaurantCoords.longitude - userLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(userLat)) * Math.cos(toRadians(restaurantCoords.latitude)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getDiningType = (restaurant) => {
  const rawType = restaurant?.diningSettings?.diningType;
  let types = [];
  if (Array.isArray(rawType)) types = rawType;
  else if (typeof rawType === "string" && rawType.trim()) types = rawType.split(",");
  else if (Array.isArray(restaurant?.categories)) {
    types = restaurant.categories.map((c) => (typeof c === "string" ? c : c.slug || c.name));
  }
  const unique = Array.from(new Set(types.map((t) => slugifyValue(t)).filter(Boolean)));
  return unique[0] || "family-dining";
};

const firstNumber = (value) => {
  const match = String(value || "").match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

const LOADING_ROWS = Array.from({ length: 6 }, (_, i) => ({ skeleton: true, key: `restaurant-skeleton-${i}` }));

export default function DiningScreen() {
  const { isDark } = useTheme();
  const { location, zoneId } = useAppLocation();
  const { openSearch, closeSearch, setSearchValue } = useSearchOverlay();
  const { addFavorite, removeFavorite, isFavorite } = useProfile();
  const searchRef = useRef(null);

  const [heroSearch, setHeroSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState(() => new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState("sort");
  const [sortBy, setSortBy] = useState(null);
  const [selectedCuisine, setSelectedCuisine] = useState(null);

  const [categories, setCategories] = useState([]);
  const [restaurantList, setRestaurantList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroBanners, setHeroBanners] = useState([]);

  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  const cityRaw = String(location?.city || "").trim();
  const city = cityRaw && cityRaw.toLowerCase() !== "current location" ? cityRaw : "";

  useEffect(() => {
    let cancelled = false;
    const restaurantParams = {};
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      restaurantParams.lat = lat;
      restaurantParams.lng = lng;
    } else if (city) {
      restaurantParams.city = city;
    }
    (async () => {
      try {
        setLoading(true);
        const [bannerResponse, cats, rests] = await Promise.all([
          getDiningHeroBanners().catch(() => ({ success: false, data: { banners: [] } })),
          getDiningCategories(),
          getDiningRestaurants(restaurantParams),
        ]);
        if (cancelled) return;
        const rawBanners = bannerResponse?.data?.banners;
        const banners = Array.isArray(rawBanners)
          ? rawBanners
              .map((banner, index) => {
                const imageUrl = String(banner?.imageUrl || "").trim();
                if (!imageUrl) return null;
                return {
                  id: String(banner?._id || banner?.id || `dining-banner-${index}`),
                  imageUrl,
                  tagline: String(banner?.title || banner?.tagline || "").trim(),
                  promoCode: String(banner?.ctaText || banner?.promoCode || "").trim(),
                };
              })
              .filter(Boolean)
          : [];
        setHeroBanners(banners);
        setCategories(cats?.success ? cats.data || [] : []);
        setRestaurantList(rests?.success ? rests.data || [] : []);
      } catch {
        if (cancelled) return;
        setHeroBanners([]);
        setCategories([]);
        setRestaurantList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lng, city, zoneId]);

  const safeCategories = useMemo(
    () =>
      (Array.isArray(categories) ? categories : [])
        .filter((category) => String(category?.name || "").trim().length > 0)
        .map((category) => ({
          ...category,
          name: String(category?.name || "").trim(),
          slug: slugifyValue(category?.slug || category?.name || ""),
          imageUrl: String(category?.imageUrl || "").trim(),
        })),
    [categories],
  );

  const normalizedRestaurantList = useMemo(
    () =>
      (Array.isArray(restaurantList) ? restaurantList : [])
        .filter((r) => String(r?.restaurantName || r?.name || "").trim().length > 0)
        .sort((a, b) => {
          const aEnabled = a?.diningSettings?.isEnabled === true;
          const bEnabled = b?.diningSettings?.isEnabled === true;
          if (aEnabled && !bEnabled) return -1;
          if (!aEnabled && bEnabled) return 1;
          return 0;
        })
        .map((restaurant, index) => {
          const restaurantName = String(restaurant?.restaurantName || restaurant?.name || "").trim();
          return {
            ...restaurant,
            id: restaurant?._id || restaurant?.id || `restaurant-${index}`,
            name: restaurantName,
            slug: String(restaurant?.restaurantNameNormalized || "").trim() || slugifyValue(restaurantName),
            cuisine:
              Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
                ? restaurant.cuisines.join(", ")
                : "Multi-cuisine",
            image: String(
              restaurant?.coverImages?.[0]?.url ||
                restaurant?.coverImages?.[0] ||
                restaurant?.coverImage ||
                restaurant?.menuImages?.[0]?.url ||
                restaurant?.menuImages?.[0] ||
                restaurant?.profileImage?.url ||
                restaurant?.profileImage ||
                "",
            ).trim(),
            offer: String(restaurant?.offer || "Pre-book table").trim(),
            featuredDish: String(restaurant?.featuredDish || "Chef's special").trim(),
            featuredPrice: Number(restaurant?.featuredPrice || 0),
            rating: Number(restaurant?.rating || restaurant?.avgRating || 0),
            deliveryTime: String(
              restaurant?.estimatedDeliveryTime ||
                restaurant?.deliveryTime ||
                (restaurant?.estimatedDeliveryTimeMinutes
                  ? `${restaurant.estimatedDeliveryTimeMinutes} mins`
                  : "30-40 mins"),
            ).trim(),
            distanceValue: getDistanceKm(location, restaurant),
            diningType: getDiningType(restaurant),
            isEnabled: restaurant?.diningSettings?.isEnabled === true,
          };
        }),
    [restaurantList, location],
  );

  const nearbyPopularRestaurants = useMemo(() => {
    const within10Km = normalizedRestaurantList
      .filter((r) => Number.isFinite(r.distanceValue) && r.distanceValue <= 10)
      .sort((a, b) => a.distanceValue - b.distanceValue);
    return within10Km.length > 0 ? within10Km : normalizedRestaurantList;
  }, [normalizedRestaurantList]);

  const toggleFilter = useCallback((filterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterId)) next.delete(filterId);
      else next.add(filterId);
      return next;
    });
  }, []);

  const filteredRestaurants = useMemo(() => {
    let filtered = [...nearbyPopularRestaurants];
    if (activeFilters.has("delivery-under-30")) {
      filtered = filtered.filter((r) => {
        const n = firstNumber(r.deliveryTime);
        return n !== null && n <= 30;
      });
    }
    if (activeFilters.has("delivery-under-45")) {
      filtered = filtered.filter((r) => {
        const n = firstNumber(r.deliveryTime);
        return n !== null && n <= 45;
      });
    }
    if (activeFilters.has("distance-under-1km")) filtered = filtered.filter((r) => (r.distanceValue || 0) <= 1.0);
    if (activeFilters.has("distance-under-2km")) filtered = filtered.filter((r) => (r.distanceValue || 0) <= 2.0);
    if (activeFilters.has("rating-35-plus")) filtered = filtered.filter((r) => r.rating >= 3.5);
    if (activeFilters.has("rating-4-plus")) filtered = filtered.filter((r) => r.rating >= 4.0);
    if (activeFilters.has("rating-45-plus")) filtered = filtered.filter((r) => r.rating >= 4.5);
    if (selectedCuisine) {
      filtered = filtered.filter((r) => r.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase()));
    }
    if (sortBy === "rating-high") filtered.sort((a, b) => b.rating - a.rating);
    else if (sortBy === "rating-low") filtered.sort((a, b) => a.rating - b.rating);
    return filtered;
  }, [nearbyPopularRestaurants, activeFilters, selectedCuisine, sortBy]);

  const handleSearchFocus = useCallback(() => {
    searchRef.current?.blur();
    if (heroSearch) setSearchValue(heroSearch);
    openSearch();
  }, [heroSearch, openSearch, setSearchValue]);

  const handleSearchSubmit = useCallback(() => {
    const q = heroSearch.trim();
    if (!q) return;
    router.push({ pathname: "/search", params: { q } });
    closeSearch();
    setHeroSearch("");
  }, [heroSearch, closeSearch]);

  const openRestaurant = useCallback((restaurant) => {
    const slug = restaurant.slug || encodeURIComponent(restaurant.name);
    navigateWithState(
      { pathname: "/dining/[diningType]/[slug]", params: { diningType: restaurant.diningType, slug } },
      NAV_KEYS.details(slug),
      { restaurant },
    );
  }, []);

  const toggleFavorite = useCallback(
    (restaurant) => {
      const slug = restaurant.slug || encodeURIComponent(restaurant.name);
      if (isFavorite(slug)) {
        removeFavorite(slug);
      } else {
        addFavorite({
          slug,
          name: restaurant.name,
          cuisine: restaurant.cuisine,
          rating: restaurant.rating,
          deliveryTime: restaurant.deliveryTime,
          distance: restaurant.distance,
          image: restaurant.image,
        });
      }
    },
    [isFavorite, addFavorite, removeFavorite],
  );

  const listHeader = (
    <View>
      <DiningHeroBanner banners={heroBanners} loading={loading} />
      <View style={styles.content}>
        <DiningCategoryGrid
          loading={loading}
          categories={safeCategories}
          onPressCategory={(category) => router.push({ pathname: "/dining/[category]", params: { category: category.slug } })}
        />
        <DiningSectionHeader count={filteredRestaurants.length} />
        <DiningFilterChips
          loading={loading}
          activeFilters={activeFilters}
          onToggle={toggleFilter}
          onOpenFilters={() => setIsFilterOpen(true)}
        />
      </View>
    </View>
  );

  const data = loading ? LOADING_ROWS : filteredRestaurants;

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
      <View
        style={[
          styles.stickyHeader,
          { backgroundColor: isDark ? "#0a0a0a" : "rgba(255,255,255,0.9)", borderColor: isDark ? tw.gray800 : tw.gray100 },
        ]}
      >
        <View style={styles.navbarWrap}>
          <PageNavbar textColor="dark" />
        </View>
        <DiningSearchBar
          ref={searchRef}
          value={heroSearch}
          onChangeText={setHeroSearch}
          onFocus={handleSearchFocus}
          onSubmit={handleSearchSubmit}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => (item.skeleton ? item.key : String(item._id || item.id))}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.rowPad}>
            <DiningEmptyState />
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.rowPad}>
            {item.skeleton ? (
              <DiningRestaurantSkeleton index={index} />
            ) : (
              <DiningRestaurantCard
                restaurant={item}
                index={index}
                featured={index < 2}
                favorite={isFavorite(item.slug || encodeURIComponent(item.name))}
                onPress={() => openRestaurant(item)}
                onToggleFavorite={() => toggleFavorite(item)}
              />
            )}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      <DiningFilterSheet
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        activeTab={activeFilterTab}
        onChangeTab={setActiveFilterTab}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        sortBy={sortBy}
        onChangeSort={setSortBy}
        selectedCuisine={selectedCuisine}
        onChangeCuisine={setSelectedCuisine}
        onClearAll={() => {
          setActiveFilters(new Set());
          setSortBy(null);
          setSelectedCuisine(null);
        }}
        resultCount={filteredRestaurants.length}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stickyHeader: { width: "100%", borderBottomWidth: 1, zIndex: 10, ...shadow.sm },
  navbarWrap: { paddingVertical: 8, paddingHorizontal: 8 },
  content: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 0 },
  rowPad: { paddingHorizontal: 12 },
  // web pb-40 on the page plus the content block's pb-4.
  listContent: { paddingBottom: 16 + 160 - 78 },
});
