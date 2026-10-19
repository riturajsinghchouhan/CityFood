// Port of Frontend/src/modules/Food/pages/user/CategoryPage.jsx (/category/:category).
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { getMenuByRestaurantId, getPublicCategories, getPublicFoods, getRestaurants } from "../../api";
import {
  CategoryFilterChips,
  CategoryFilterSheet,
  CategoryRail,
  CategoryRestaurantCard,
  CategorySearchRow,
  MatchedDishCard,
} from "../../components/browse/CategoryParts";
import { FOOD_IMAGES, getRestaurantAvailabilityStatus } from "../../components/restaurant-cards";
import { RestaurantGridSkeleton } from "../../components/restaurant/Skeletons";
import { Button, Screen, Text, useDelayedLoading } from "../../components/ui";
import { useAppLocation } from "../../context/LocationContext";
import { useProfile } from "../../context/ProfileContext";
import { goTo } from "../../navigation/back";
import { store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";
import {
  applyFiltersAndSorting,
  buildFallbackMenuFromFoods,
  checkCategoryInMenu,
  getAllCategoryDishesFromMenu,
  getCategoryFallbackDishesFromApprovedFoods,
  normalizeMenu,
} from "./categoryLib";
import { extractImages, getMenuFromResponse, slugify } from "./lib";

const CATEGORY_PAGE_FILTERS_STORAGE_KEY = "food-category-page-filters-v1";

const DEFAULT_OFFERS = ["Flat ₹50 OFF above ₹199", "Flat 50% OFF", "Flat ₹40 OFF above ₹149"];
const DEFAULT_DELIVERY_TIMES = ["25-30 mins", "20-25 mins", "30-35 mins"];
const DEFAULT_DISTANCES = ["1.2 km", "1 km", "0.8 km"];

const buildRestaurantPath = (restaurant) => {
  const slug = restaurant?.slug || restaurant?.restaurantId || restaurant?.mongoId || slugify(restaurant?.name || "");
  const dishId = restaurant?.dishId || restaurant?.categoryDish?.id || restaurant?.categoryDish?._id || null;
  if (!dishId) return { pathname: "/restaurants/[slug]", params: { slug: String(slug) } };
  return { pathname: "/restaurants/[slug]", params: { slug: String(slug), dish: String(dishId) } };
};

export default function CategoryScreen() {
  const { colors, isDark } = useTheme();
  const { category } = useLocalSearchParams();
  const routeCategory = typeof category === "string" ? category : "";
  const { vegMode, vegModeOption } = useProfile();
  const { zoneId, isOutOfService } = useAppLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(routeCategory.toLowerCase() || "all");
  const [activeFilters, setActiveFilters] = useState(() => new Set());
  const [favorites, setFavorites] = useState(() => new Set());
  const [sortBy, setSortBy] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [restaurantsData, setRestaurantsData] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [isEnrichingMenus, setIsEnrichingMenus] = useState(false);
  const [approvedFoodsData, setApprovedFoodsData] = useState([]);
  const [categoryKeywords, setCategoryKeywords] = useState({});
  const [visibleCount, setVisibleCount] = useState(20);
  const showCategorySkeleton = useDelayedLoading(loadingCategories);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const menuEnrichmentRequestRef = useRef(0);
  const approvedFoodsCacheRef = useRef(null);
  const approvedFoodsInFlightRef = useRef(null);
  const restoredKeyRef = useRef(null);
  const zoneIdRef = useRef(zoneId);
  const filterTimerRef = useRef(null);

  useEffect(() => {
    zoneIdRef.current = zoneId;
  }, [zoneId]);
  useEffect(() => () => filterTimerRef.current && clearTimeout(filterTimerRef.current), []);

  // Web: setIsLoadingFilterResults(true) then false after 500 ms.
  const flashFilterLoading = useCallback(() => {
    setIsLoadingFilterResults(true);
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => setIsLoadingFilterResults(false), 500);
  }, []);

  const fetchApprovedFoods = useCallback(async () => {
    if (Array.isArray(approvedFoodsCacheRef.current)) return approvedFoodsCacheRef.current;
    if (approvedFoodsInFlightRef.current) return approvedFoodsInFlightRef.current;
    approvedFoodsInFlightRef.current = (async () => {
      try {
        const params = { limit: 50 };
        if (zoneIdRef.current) params.zoneId = zoneIdRef.current;
        const data = await getPublicFoods(params);
        const list = data?.foods || [];
        const approved = Array.isArray(list)
          ? list.filter((f) => String(f?.approvalStatus || "").toLowerCase() === "approved" && f?.isAvailable !== false)
          : [];
        approvedFoodsCacheRef.current = approved;
        return approved;
      } catch {
        approvedFoodsCacheRef.current = [];
        return [];
      } finally {
        approvedFoodsInFlightRef.current = null;
      }
    })();
    return approvedFoodsInFlightRef.current;
  }, []);

  useEffect(() => {
    approvedFoodsCacheRef.current = null;
    approvedFoodsInFlightRef.current = null;
    let cancelled = false;
    fetchApprovedFoods().then((foods) => {
      if (!cancelled) setApprovedFoodsData(Array.isArray(foods) ? foods : []);
    });
    return () => {
      cancelled = true;
    };
  }, [zoneId, fetchApprovedFoods]);

  // Categories (cached public list).
  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        setLoadingCategories(true);
        const data = await getPublicCategories(zoneId || null);
        if (isCancelled) return;
        const list = data?.categories || [];
        if (Array.isArray(list) && list.length > 0) {
          setCategories([
            { id: "all", name: "All", image: null, slug: "all" },
            ...list.map((cat) => ({
              id: cat.slug || cat.id,
              name: cat.name,
              image: cat.image || FOOD_IMAGES[0],
              slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, "-"),
              type: cat.type,
            })),
          ]);
          const stopWords = ["of", "the", "and", "in", "with", "a", "an", "to", "for"];
          const map = {};
          list.forEach((cat) => {
            const name = cat.name.toLowerCase();
            const words = name.split(/[\s-]+/).filter((w) => w.length > 2 && !stopWords.includes(w));
            map[cat.slug || cat.id] = [name, ...words];
          });
          setCategoryKeywords(map);
        } else {
          setCategories([{ id: "all", name: "All", image: null, slug: "all" }]);
        }
      } catch {
        if (!isCancelled) setCategories([{ id: "all", name: "All", image: null, slug: "all" }]);
      } finally {
        if (!isCancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [zoneId]);

  // Restaurants, then menus in batches of 4.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRestaurants(true);
        const params = {};
        if (zoneId) params.zoneId = zoneId;
        const response = await getRestaurants(params);
        if (cancelled) return;
        if (!(response?.success && response?.data?.restaurants)) {
          setRestaurantsData([]);
          return;
        }
        const withIds = response.data.restaurants
          .filter((r) => String(r.restaurantName || r.name || "").trim().length > 0)
          .map((r) => {
            let deliveryTime = r.estimatedDeliveryTime || null;
            let distance = r.distance || null;
            let offer = r.offer || null;
            if (deliveryTime && DEFAULT_DELIVERY_TIMES.includes(deliveryTime)) deliveryTime = null;
            if (distance && DEFAULT_DISTANCES.includes(distance)) distance = null;
            if (offer && DEFAULT_OFFERS.includes(offer)) offer = null;
            const cuisine = r.cuisines && r.cuisines.length > 0 ? r.cuisines.join(", ") : null;
            // Same image rule as the home cards: newest menu gallery image, no cover/profile.
            const menuImages = extractImages((Array.isArray(r.menuImages) ? r.menuImages : [r.menuImages]).filter(Boolean));
            const allImages = Array.from(new Set(menuImages)).reverse();
            const restaurantId = r.restaurantId || r._id;
            let featuredPrice = r.featuredPrice || null;
            if (featuredPrice === 249) featuredPrice = null;
            return {
              id: restaurantId,
              name: r.restaurantName || r.name,
              cuisine,
              rating: r.rating || null,
              deliveryTime,
              distance,
              image: allImages[0] || FOOD_IMAGES[0],
              images: allImages.length > 0 ? allImages : [FOOD_IMAGES[0]],
              recommendedItems: Array.isArray(r.recommendedItems) ? r.recommendedItems : [],
              itemDiscounts: Array.isArray(r.itemDiscounts) ? r.itemDiscounts : [],
              discountRules: Array.isArray(r.discountRules) ? r.discountRules : [],
              discount: Number(r.discount) || 0,
              priceRange: r.priceRange || null,
              featuredDish: r.featuredDish || null,
              featuredPrice,
              offer,
              slug: r.slug || (r.restaurantName || r.name)?.toLowerCase().replace(/\s+/g, "-"),
              restaurantId,
              pureVegRestaurant: r.pureVegRestaurant || false,
              hasPaneer: false,
              category: "all",
            };
          });
        setRestaurantsData(withIds);

        setIsEnrichingMenus(true);
        const requestId = ++menuEnrichmentRequestRef.current;
        (async () => {
          try {
            const transformed = [];
            for (let index = 0; index < withIds.length; index += 4) {
              const batch = withIds.slice(index, index + 4);
              const results = await Promise.all(
                batch.map(async (restaurant) => {
                  try {
                    const lookupIds = [restaurant.restaurantId, restaurant.id, restaurant.mongoId, restaurant.slug]
                      .filter(Boolean)
                      .map((v) => String(v).trim())
                      .filter((v, i, arr) => arr.indexOf(v) === i);
                    let menu = null;
                    for (const lookupId of lookupIds) {
                      try {
                        const menuResponse = await getMenuByRestaurantId(lookupId);
                        const normalized = normalizeMenu(getMenuFromResponse(menuResponse));
                        if (menuResponse?.success && normalized?.sections?.length > 0) {
                          menu = normalized;
                          break;
                        }
                      } catch (lookupError) {
                        if (lookupError?.status !== 404) throw lookupError;
                      }
                    }
                    if (!menu || menu.sections.length === 0) {
                      menu = buildFallbackMenuFromFoods(await fetchApprovedFoods(), restaurant);
                    }
                    if (menu?.sections?.length > 0) {
                      const hasPaneer = checkCategoryInMenu(menu, "paneer-tikka", {});
                      let featuredDish = restaurant.featuredDish;
                      let featuredPrice = restaurant.featuredPrice;
                      if (!featuredDish || !featuredPrice) {
                        for (const section of menu.sections || []) {
                          if (section.items && section.items.length > 0) {
                            const first = section.items[0];
                            if (!featuredDish) featuredDish = first.name;
                            if (!featuredPrice) {
                              const op = first.originalPrice || first.price || 0;
                              const dp = first.discountPercent || 0;
                              featuredPrice = dp > 0 ? Math.round(op * (1 - dp / 100)) : op;
                            }
                            break;
                          }
                        }
                      }
                      return {
                        ...restaurant,
                        menu,
                        hasPaneer,
                        featuredDish: featuredDish || null,
                        featuredPrice: featuredPrice || null,
                        categoryMatches: {},
                      };
                    }
                  } catch {
                    // Menu failed: keep the restaurant without one, as on web.
                  }
                  return { ...restaurant, menu: null, hasPaneer: false, categoryMatches: {} };
                }),
              );
              if (requestId !== menuEnrichmentRequestRef.current) return;
              transformed.push(...results);
            }
            if (requestId === menuEnrichmentRequestRef.current) setRestaurantsData(transformed);
          } finally {
            if (requestId === menuEnrichmentRequestRef.current) setIsEnrichingMenus(false);
          }
        })();
      } catch {
        if (!cancelled) setRestaurantsData([]);
      } finally {
        if (!cancelled) setLoadingRestaurants(false);
      }
    })();
    return () => {
      cancelled = true;
      menuEnrichmentRequestRef.current += 1;
    };
  }, [zoneId, isOutOfService, fetchApprovedFoods]);

  // Selected category follows the URL.
  useEffect(() => {
    if (routeCategory && categories.length > 0) {
      const slug = routeCategory.toLowerCase();
      const matched = categories.find(
        (cat) => cat.slug === slug || cat.id === slug || cat.name.toLowerCase().replace(/\s+/g, "-") === slug,
      );
      setSelectedCategory(matched ? matched.slug || matched.id : slug);
    } else if (routeCategory) {
      setSelectedCategory(routeCategory.toLowerCase());
    }
  }, [routeCategory, categories]);

  // Filters persist per category under food-category-page-filters-v1.
  const currentFilterStorageKey = slugify(selectedCategory || routeCategory || "all") || "all";
  useEffect(() => {
    let cancelled = false;
    restoredKeyRef.current = null;
    store.get(CATEGORY_PAGE_FILTERS_STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      const state = stored?.[currentFilterStorageKey];
      if (state && typeof state === "object") {
        setSortBy(state.sortBy || null);
        setActiveFilters(new Set(Array.isArray(state.activeFilters) ? state.activeFilters : []));
      }
      restoredKeyRef.current = currentFilterStorageKey;
    });
    return () => {
      cancelled = true;
    };
  }, [currentFilterStorageKey]);

  useEffect(() => {
    if (restoredKeyRef.current !== currentFilterStorageKey) return;
    store.get(CATEGORY_PAGE_FILTERS_STORAGE_KEY).then((stored) => {
      const next = stored && typeof stored === "object" ? { ...stored } : {};
      next[currentFilterStorageKey] = { sortBy, activeFilters: Array.from(activeFilters) };
      store.set(CATEGORY_PAGE_FILTERS_STORAGE_KEY, next);
    });
  }, [currentFilterStorageKey, sortBy, activeFilters]);

  const toggleFilter = useCallback(
    (id) => {
      setActiveFilters((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      flashFilterLoading();
    },
    [flashFilterLoading],
  );

  const toggleFavorite = (id) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filterOpts = useMemo(
    () => ({ activeFilters, searchQuery: deferredSearchQuery, vegMode, vegModeOption, sortBy }),
    [activeFilters, deferredSearchQuery, vegMode, vegModeOption, sortBy],
  );

  // One card per matching dish.
  const filteredRecommended = useMemo(() => {
    const expanded = [];
    restaurantsData.forEach((r) => {
      if (!r.menu || !checkCategoryInMenu(r.menu, selectedCategory, categoryKeywords)) return;
      const dishes = getAllCategoryDishesFromMenu(r.menu, selectedCategory, categoryKeywords);
      const valid = vegMode ? dishes.filter((d) => d.foodType === "Veg") : dishes;
      valid.forEach((dish) => {
        expanded.push({
          ...r,
          id: `${r.id || r.restaurantId}-${dish.itemId}`,
          dishId: dish.itemId || `${r.id}-dish`,
          categoryDish: dish,
          categoryDishName: dish.name,
          categoryDishPrice: dish.price,
          categoryDishImage: dish.image,
          categoryDishFoodType: dish.foodType,
        });
      });
    });
    let filtered = expanded;
    if (filtered.length === 0 && selectedCategory !== "all") {
      const fallback = getCategoryFallbackDishesFromApprovedFoods(selectedCategory, restaurantsData, approvedFoodsData, categoryKeywords);
      filtered = vegMode ? fallback.filter((d) => d.categoryDishFoodType === "Veg") : fallback;
    }
    return applyFiltersAndSorting(filtered, filterOpts);
  }, [restaurantsData, selectedCategory, categoryKeywords, vegMode, approvedFoodsData, filterOpts]);

  const filteredAllRestaurants = useMemo(() => {
    let filtered = [...restaurantsData];
    if (selectedCategory && selectedCategory !== "all") {
      const lower = selectedCategory.toLowerCase();
      filtered = filtered.filter((r) => {
        const matchesCuisine = (r.cuisines || []).some((c) => c.toLowerCase().includes(lower));
        const hasInMenu = r.menu ? checkCategoryInMenu(r.menu, selectedCategory, categoryKeywords) : false;
        return matchesCuisine || hasInMenu;
      });
    }
    return applyFiltersAndSorting(filtered, filterOpts);
  }, [restaurantsData, selectedCategory, categoryKeywords, filterOpts]);

  const showRestaurantSkeleton = useDelayedLoading(
    isLoadingFilterResults || loadingRestaurants || (isEnrichingMenus && selectedCategory !== "all" && filteredRecommended.length === 0),
    140,
  );

  const handleCategorySelect = (cat) => {
    const slug = cat.slug || cat.id;
    setSelectedCategory(slug);
    // Web navigates within the same page component; keep this screen and swap the param.
    router.setParams({ category: slug === "all" ? "all" : slug });
  };

  const clearAllFilters = () => {
    setActiveFilters(new Set());
    setSearchQuery("");
    setSortBy(null);
    menuEnrichmentRequestRef.current += 1;
    setIsEnrichingMenus(false);
    flashFilterLoading();
  };

  const greyedAll = isOutOfService;
  const showMatched = filteredRecommended.length > 0 && selectedCategory !== "all";

  const rows = useMemo(() => {
    const list = [];
    if (showMatched) {
      list.push({ key: "matched-title", type: "title", title: "MATCHED DISHES" });
      filteredRecommended.slice(0, visibleCount).forEach((r) => list.push({ key: `d-${r.id}`, type: "dish", row: r }));
    }
    list.push({ key: "all-title", type: "title", title: "ALL RESTAURANTS", spaced: true });
    if (showRestaurantSkeleton) {
      list.push({ key: "skeleton", type: "skeleton" });
    } else {
      filteredAllRestaurants.slice(0, visibleCount).forEach((r, i) => list.push({ key: `r-${r.id}`, type: "restaurant", row: r, index: i }));
    }
    if (filteredAllRestaurants.length > visibleCount) list.push({ key: "more", type: "more" });
    if (filteredAllRestaurants.length === 0) list.push({ key: "empty", type: "empty" });
    return list;
  }, [showMatched, filteredRecommended, filteredAllRestaurants, visibleCount, showRestaurantSkeleton]);

  const renderRow = ({ item }) => {
    switch (item.type) {
      case "title":
        return (
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              letterSpacing: 1.8,
              color: isDark ? tw.gray500 : tw.gray400,
              marginBottom: 16,
              marginTop: item.spaced && showMatched ? 32 : 0,
            }}
          >
            {item.title}
          </Text>
        );
      case "dish": {
        const isClosed = !getRestaurantAvailabilityStatus(item.row).isOpen;
        return (
          <View style={{ marginBottom: 12 }}>
            <MatchedDishCard
              row={item.row}
              isClosed={isClosed}
              greyed={greyedAll || isClosed}
              onPress={() => router.push(buildRestaurantPath(item.row))}
            />
          </View>
        );
      }
      case "restaurant": {
        const r = item.row;
        const isClosed = !getRestaurantAvailabilityStatus(r).isOpen;
        return (
          <View style={{ marginBottom: 16 }}>
            <CategoryRestaurantCard
              restaurant={r}
              index={item.index}
              isClosed={isClosed}
              greyed={greyedAll || isClosed}
              isFavorite={favorites.has(r.id)}
              onToggleFavorite={() => toggleFavorite(r.id)}
              onPress={() => router.push(buildRestaurantPath(r))}
            />
          </View>
        );
      }
      case "skeleton":
        return (
          <View style={{ borderRadius: 10, backgroundColor: isDark ? "rgba(26,26,26,0.92)" : "rgba(255,255,255,0.92)", padding: 4 }}>
            <RestaurantGridSkeleton count={4} compact />
          </View>
        );
      case "more":
        return (
          <View style={{ height: 80, alignItems: "center", justifyContent: "center", marginTop: 16 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        );
      case "empty":
        return (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 14, textAlign: "center", color: isDark ? tw.gray400 : tw.gray500 }}>
              {searchQuery ? `No restaurants found for "${searchQuery}"` : "No restaurants found with selected filters"}
            </Text>
            <Button variant="outline" title="Clear all filters" style={{ marginTop: 16 }} onPress={clearAllFilters} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
      <View style={{ flex: 1, opacity: greyedAll ? 0.75 : 1 }}>
        <View style={[{ backgroundColor: isDark ? "rgba(26,26,26,0.95)" : "rgba(255,255,255,0.95)", zIndex: 20 }, shadow.sm]}>
          <CategorySearchRow onBack={() => goTo("/")} value={searchQuery} onChangeText={setSearchQuery} />
          <CategoryRail
            categories={categories}
            loading={showCategorySkeleton}
            selectedCategory={selectedCategory}
            onSelect={handleCategorySelect}
          />
          <CategoryFilterChips activeFilters={activeFilters} onToggle={toggleFilter} onOpenFilters={() => setIsFilterOpen(true)} />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => setVisibleCount((prev) => prev + 20)}
          initialNumToRender={6}
          windowSize={7}
        />
      </View>

      <CategoryFilterSheet
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        sortBy={sortBy}
        setSortBy={setSortBy}
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClearAll={() => {
          setActiveFilters(new Set());
          setSortBy(null);
          flashFilterLoading();
        }}
        onShowResults={() => {
          setIsFilterOpen(false);
          flashFilterLoading();
        }}
      />
    </Screen>
  );
}
