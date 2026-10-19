// Port of Frontend/src/modules/Food/pages/user/Home.jsx (the Home tab).
// The page is one virtualized list: RestaurantGrid (a FlatList) with every section above
// the restaurant cards as its ListHeaderComponent. The web's `position: sticky` search row
// and category bar are reproduced with an overlay that appears at the same scroll offsets.
import { useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CategoriesSection from "../../components/home/CategoriesSection";
import { BookmarkToast, ManageCollectionsSheet } from "../../components/home/CollectionsSheet";
import ExploreMoreSection from "../../components/home/ExploreMoreSection";
import FestBanner from "../../components/home/FestBanner";
import FilterChipsBar from "../../components/home/FilterChipsBar";
import FilterSheet from "../../components/home/FilterSheet";
import GourmetSection from "../../components/home/GourmetSection";
import HeroBanner from "../../components/home/HeroBanner";
import MealsUnderSection from "../../components/home/MealsUnderSection";
import RecommendedSection from "../../components/home/RecommendedSection";
import { OutOfRadiusState, RestaurantsHeading } from "../../components/home/RestaurantsSectionHeader";
import {
  ApplyingVegOverlay,
  SwitchOffVegPopup,
  SwitchingOffOverlay,
  VegModePopup,
} from "../../components/home/VegModeDialogs";
import { RestaurantGrid } from "../../components/restaurant-cards";
import { useFloatingBottom } from "../../components/shell/floating";
import { HOME_SEARCH_PLACEHOLDERS, HomeHeaderLocationRow, HomeHeaderSearchRow } from "../../components/shell/HomeHeader";
import HomeHeroBackground from "../../components/shell/HomeHeroBackground";
import { OutOfZoneScreen } from "../../components/shell/LocationGuard";
import OrderTrackingCard from "../../components/shell/OrderTrackingCard";
import StickyCartCard from "../../components/shell/StickyCartCard";
import { useAppLocation } from "../../context/LocationContext";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../theme/ThemeContext";
import { buildExploreItems, buildGourmet, buildRecommended } from "./homeUtils";
import {
  useHeroBanners,
  useHomeCategories,
  useHomeRestaurants,
  useLandingConfig,
  useMenuCategories,
} from "./useHomeData";

// Sticky phases: 0 none, 1 search row pinned (web top-2), 2 search row + category bar pinned.
const SEARCH_STICKY_TOP = 8;
const CATEGORY_STUCK_MARGIN = 72; // web IntersectionObserver rootMargin "-72px"

// Home.jsx's placeholder cycle (every 2 s), shared by the in-page and sticky search rows
// so they always show the same text, and kept out of HomeScreen's render.
const placeholderTicker = { index: 0, listeners: new Set(), timer: null };
function subscribePlaceholder(listener) {
  placeholderTicker.listeners.add(listener);
  if (!placeholderTicker.timer) {
    placeholderTicker.timer = setInterval(() => {
      placeholderTicker.index = (placeholderTicker.index + 1) % HOME_SEARCH_PLACEHOLDERS.length;
      placeholderTicker.listeners.forEach((l) => l());
    }, 2000);
  }
  return () => {
    placeholderTicker.listeners.delete(listener);
    if (placeholderTicker.listeners.size === 0) {
      clearInterval(placeholderTicker.timer);
      placeholderTicker.timer = null;
    }
  };
}
const getPlaceholderIndex = () => placeholderTicker.index;

function SearchRow(props) {
  const placeholderIndex = useSyncExternalStore(subscribePlaceholder, getPlaceholderIndex);
  return <HomeHeaderSearchRow {...props} placeholderIndex={placeholderIndex} placeholders={HOME_SEARCH_PLACEHOLDERS} />;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { isDark } = useTheme();
  const {
    vegMode,
    setVegMode,
    vegModeOption,
    setVegModeOption,
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavorites,
  } = useProfile();
  const {
    location,
    loading: zoneLoading,
    zoneId,
    isOutOfService,
    isOutOfZone,
    isOutOfRadius,
    serviceUnavailableMessage,
  } = useAppLocation();

  const { realCategories } = useHomeCategories({ zoneId, zoneLoading });
  const landing = useLandingConfig({ zoneId, zoneLoading });
  const { heroBannerImages, heroBannersData, loadingBanners } = useHeroBanners({ zoneId, zoneLoading });
  const { restaurantsData, loadingRestaurants, isLoadingFilterResults, applyFiltersAndRefetch } = useHomeRestaurants({
    location,
    zoneId,
    zoneLoading,
  });
  const { menuCategories } = useMenuCategories({ restaurantsData, realCategoriesCount: realCategories.length });
  const displayCategories = realCategories.length > 0 ? realCategories : menuCategories;

  // ---- Veg mode (the web keeps prevVegMode and only commits after the popups) ----
  const [prevVegMode, setPrevVegMode] = useState(vegMode);
  const [seenVegMode, setSeenVegMode] = useState(vegMode);
  const [handlingSwitchOff, setHandlingSwitchOff] = useState(false);
  const [showVegModePopup, setShowVegModePopup] = useState(false);
  const [showSwitchOffPopup, setShowSwitchOffPopup] = useState(false);
  const [isApplyingVegMode, setIsApplyingVegMode] = useState(false);
  const [isSwitchingOffVegMode, setIsSwitchingOffVegMode] = useState(false);
  if (seenVegMode !== vegMode) {
    setSeenVegMode(vegMode);
    if (!handlingSwitchOff) setPrevVegMode(vegMode);
  }

  const timersRef = useRef([]);
  const later = useCallback((fn, ms) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  }, []);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const handleVegModeChange = useCallback(
    (newValue) => {
      if (handlingSwitchOff) return;
      if (newValue && !prevVegMode) {
        setShowVegModePopup(true);
      } else if (!newValue && prevVegMode) {
        setHandlingSwitchOff(true);
        setShowSwitchOffPopup(true);
      } else {
        setVegMode(newValue);
        setPrevVegMode(newValue);
      }
    },
    [handlingSwitchOff, prevVegMode, setVegMode],
  );

  const dismissVegPopup = () => {
    setShowVegModePopup(false);
    setVegMode(false);
    setPrevVegMode(false);
  };
  const applyVegMode = () => {
    setShowVegModePopup(false);
    setIsApplyingVegMode(true);
    setVegMode(true);
    setPrevVegMode(true);
    later(() => setIsApplyingVegMode(false), 2000);
  };
  const keepVegMode = () => {
    setShowSwitchOffPopup(false);
    setHandlingSwitchOff(false);
    setVegMode(true);
  };
  const switchOffVegMode = () => {
    setShowSwitchOffPopup(false);
    setIsSwitchingOffVegMode(true);
    later(() => {
      setIsSwitchingOffVegMode(false);
      setHandlingSwitchOff(false);
      setVegMode(false);
      setPrevVegMode(false);
    }, 2000);
  };

  // ---- Filters ----
  const [activeFilters, setActiveFilters] = useState(() => new Set());
  const [sortBy, setSortBy] = useState(null);
  const [selectedCuisine, setSelectedCuisine] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const toggleFilter = useCallback((filterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterId)) next.delete(filterId);
      else next.add(filterId);
      return next;
    });
  }, []);

  const onToggleQuickFilter = useCallback(
    (filterId) => {
      const next = new Set(activeFilters);
      if (next.has(filterId)) next.delete(filterId);
      else next.add(filterId);
      setActiveFilters(next);
      applyFiltersAndRefetch(next, sortBy, selectedCuisine);
    },
    [activeFilters, sortBy, selectedCuisine, applyFiltersAndRefetch],
  );

  const openFilters = useCallback(() => setIsFilterOpen(true), []);

  // ---- Derived lists ----
  const matchesVegMode = useCallback(
    (restaurant) => {
      if (!vegMode) return true;
      if (vegModeOption === "pure-veg") return restaurant?.pureVegRestaurant === true;
      return true;
    },
    [vegMode, vegModeOption],
  );

  const matchesCategory = useCallback(
    (restaurant) => {
      if (selectedCategory === "All") return true;
      const wanted = selectedCategory.toLowerCase();
      if ((restaurant.cuisines || []).some((c) => c.toLowerCase() === wanted)) return true;
      const allItems = [
        ...(restaurant.menuItems || []),
        ...(restaurant.popularItems || []),
        ...(restaurant.itemDiscounts || []),
      ];
      return allItems.some((item) => item.category && item.category.toLowerCase() === wanted);
    },
    [selectedCategory],
  );

  const filteredRestaurants = useMemo(
    () => (restaurantsData || []).filter(matchesVegMode).filter(matchesCategory),
    [restaurantsData, matchesVegMode, matchesCategory],
  );

  const showRestaurantSkeleton = isLoadingFilterResults || loadingRestaurants;
  const shouldShowOutOfRadiusHome =
    !zoneLoading && isOutOfRadius && !showRestaurantSkeleton && filteredRestaurants.length === 0;

  const recommended = useMemo(
    () =>
      buildRecommended({
        zoneId,
        recommendedIds: landing.recommendedRestaurantIds,
        fromSettings: landing.recommendedRestaurantsFromSettings,
        restaurantsData,
        matchesVegMode,
      }),
    [zoneId, landing.recommendedRestaurantIds, landing.recommendedRestaurantsFromSettings, restaurantsData, matchesVegMode],
  );

  const gourmet = useMemo(
    () =>
      buildGourmet({
        show: landing.showGourmetSection,
        gourmetRestaurants: landing.gourmetRestaurants,
        restaurantsData,
        matchesVegMode,
      }),
    [landing.showGourmetSection, landing.gourmetRestaurants, restaurantsData, matchesVegMode],
  );

  const exploreItems = useMemo(() => buildExploreItems(landing.landingExploreMore), [landing.landingExploreMore]);

  // ---- Bookmarks ----
  const [showToast, setShowToast] = useState(false);
  const [showManageCollections, setShowManageCollections] = useState(false);
  const [selectedRestaurantSlug, setSelectedRestaurantSlug] = useState(null);

  const handleFavoriteToggle = useCallback(
    (restaurant, restaurantSlug, favorite) => {
      if (favorite) {
        setSelectedRestaurantSlug(restaurantSlug);
        setShowManageCollections(true);
      } else {
        addFavorite({
          slug: restaurantSlug,
          name: restaurant.name,
          cuisine: restaurant.cuisine,
          rating: restaurant.rating,
          deliveryTime: restaurant.deliveryTime,
          distance: restaurant.distance,
          priceRange: restaurant.priceRange,
          image: restaurant.image,
        });
        setShowToast(true);
        later(() => setShowToast(false), 3000);
      }
    },
    [addFavorite, later],
  );

  // ---- Sticky search row / category bar ----
  const festVideoActive = Array.isArray(landing.festBannerImages) && landing.festBannerImages.length > 0;
  const [headerBgHeight, setHeaderBgHeight] = useState(0);
  const layoutRef = useRef({ searchRowY: null, anchorY: null });
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);
  const categoryOffsetRef = useRef(0);

  const searchMargin = festVideoActive ? 252 : 8;
  const computePhase = useCallback(
    (scrollY) => {
      const { searchRowY, anchorY } = layoutRef.current;
      if (searchRowY === null || anchorY === null) return 0;
      if (anchorY - scrollY < insets.top + CATEGORY_STUCK_MARGIN) return 2;
      if (searchRowY + searchMargin - scrollY <= insets.top + SEARCH_STICKY_TOP) return 1;
      return 0;
    },
    [insets.top, searchMargin],
  );

  const scrollYRef = useRef(0);
  const updatePhase = useCallback(
    (scrollY) => {
      const next = computePhase(scrollY);
      if (next !== phaseRef.current) {
        phaseRef.current = next;
        setPhase(next);
      }
    },
    [computePhase],
  );

  const onScroll = useCallback(
    (e) => {
      scrollYRef.current = e.nativeEvent.contentOffset.y;
      updatePhase(scrollYRef.current);
    },
    [updatePhase],
  );

  const onSearchRowLayout = useCallback(
    (e) => {
      layoutRef.current.searchRowY = e.nativeEvent.layout.y;
      updatePhase(scrollYRef.current);
    },
    [updatePhase],
  );
  const onAnchorLayout = useCallback(
    (e) => {
      layoutRef.current.anchorY = e.nativeEvent.layout.y;
      updatePhase(scrollYRef.current);
    },
    [updatePhase],
  );

  const toastBottom = useFloatingBottom(80, true);

  if (!zoneLoading && isOutOfZone) {
    return (
      <View style={styles.root}>
        <OutOfZoneScreen />
      </View>
    );
  }

  const stuckBg = isDark ? "rgba(10,10,10,0.95)" : "rgba(255,255,255,0.95)";
  const pageBg = isDark ? "#0a0a0a" : "#ffffff";
  const hasItems = !shouldShowOutOfRadiusHome && filteredRestaurants.length > 0;

  const searchRowProps = { vegMode, handleVegModeChange };
  const categoryProps = {
    categories: displayCategories,
    selectedCategory,
    onSelectCategory: setSelectedCategory,
    offsetRef: categoryOffsetRef,
  };

  const header = (
    <View style={styles.header}>
      <HomeHeroBackground
        images={landing.festBannerImages}
        style={{ height: festVideoActive ? 360 + insets.top : headerBgHeight || 300 + insets.top }}
      />
      <View
        style={{ paddingTop: insets.top }}
        onLayout={(e) => setHeaderBgHeight(e.nativeEvent.layout.height)}
      >
        <HomeHeaderLocationRow location={location} vegMode={vegMode} />
        <View onLayout={onSearchRowLayout} style={phase >= 1 && styles.hidden}>
          <SearchRow {...searchRowProps} pushSearchDown={festVideoActive} />
        </View>
        {festVideoActive ? (
          <View style={styles.festSpacer} />
        ) : (
          <View style={styles.festWrap}>
            <FestBanner isVegMode={vegMode} />
          </View>
        )}
      </View>
      <View style={styles.spacer12} />

      <View onLayout={onAnchorLayout} />
      <View style={phase === 2 && styles.hidden}>
        <CategoriesSection {...categoryProps} syncKey={phase === 2 ? "hidden" : "shown"} />
      </View>

      <HeroBanner images={heroBannerImages} bannersData={heroBannersData} loading={loadingBanners} />

      <FilterChipsBar activeFilters={activeFilters} onOpenFilters={openFilters} onToggleQuickFilter={onToggleQuickFilter} />

      <RecommendedSection restaurants={recommended} />

      <ExploreMoreSection
        heading={landing.exploreMoreHeading}
        items={exploreItems}
        showSkeleton={landing.loadingLandingConfig}
      />

      <MealsUnderSection config={landing.mealsUnderConfig} zoneId={zoneId} />

      <View style={styles.restaurantsTop}>
        <GourmetSection restaurants={gourmet} />
        <RestaurantsHeading count={filteredRestaurants.length} />
      </View>
      {shouldShowOutOfRadiusHome ? <OutOfRadiusState message={serviceUnavailableMessage} /> : null}
      {hasItems ? <View style={styles.gridTop} /> : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      {isFocused ? <StatusBar style={phase === 2 ? (isDark ? "light" : "dark") : "light"} /> : null}

      <RestaurantGrid
        restaurants={shouldShowOutOfRadiusHome ? [] : filteredRestaurants}
        isOutOfService={isOutOfService}
        isLoading={showRestaurantSkeleton}
        isFavorite={isFavorite}
        onToggleFavorite={handleFavoriteToggle}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        removeClippedSubviews={false}
        style={{ backgroundColor: pageBg }}
      />

      {phase >= 1 ? (
        <View
          style={[styles.sticky, { paddingTop: insets.top, backgroundColor: phase === 2 ? stuckBg : "transparent" }]}
          pointerEvents="box-none"
        >
          <SearchRow {...searchRowProps} isCategoryStuck={phase === 2} style={{ marginTop: phase === 2 ? 0 : 8 }} />
          {phase === 2 ? <CategoriesSection {...categoryProps} stuck /> : null}
        </View>
      ) : null}

      <FilterSheet
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        activeFilters={activeFilters}
        sortBy={sortBy}
        hasSelection={activeFilters.size > 0 || Boolean(sortBy) || Boolean(selectedCuisine)}
        isLoading={isLoadingFilterResults}
        onToggleFilter={toggleFilter}
        onSetSortBy={setSortBy}
        onClearAll={() => {
          setActiveFilters(new Set());
          setSortBy(null);
          setSelectedCuisine(null);
        }}
        onApply={() => {
          setIsFilterOpen(false);
          applyFiltersAndRefetch(activeFilters, sortBy, selectedCuisine);
        }}
      />

      <VegModePopup
        visible={showVegModePopup}
        option={vegModeOption}
        onSelectOption={setVegModeOption}
        onApply={applyVegMode}
        onDismiss={dismissVegPopup}
      />
      <SwitchOffVegPopup visible={showSwitchOffPopup} onSwitchOff={switchOffVegMode} onKeep={keepVegMode} />
      <ApplyingVegOverlay visible={isApplyingVegMode} />
      <SwitchingOffOverlay visible={isSwitchingOffVegMode} />

      <ManageCollectionsSheet
        visible={showManageCollections}
        slug={selectedRestaurantSlug}
        isFavorite={isFavorite}
        favoritesCount={getFavorites().length}
        onUncheck={(slug) => {
          removeFavorite(slug);
          setSelectedRestaurantSlug(null);
          setShowManageCollections(false);
        }}
        onClose={() => setShowManageCollections(false)}
        onDone={() => {
          setSelectedRestaurantSlug(null);
          setShowManageCollections(false);
        }}
      />

      <BookmarkToast visible={showToast} bottom={toastBottom} />
      <StickyCartCard hasBottomNav />
      <OrderTrackingCard hasBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { position: "relative" },
  hidden: { opacity: 0 },
  festSpacer: { height: 12 },
  festWrap: { paddingBottom: 16 },
  spacer12: { height: 12 },
  restaurantsTop: { paddingTop: 12 },
  gridTop: { height: 4 },
  listContent: { paddingTop: 0 },
  sticky: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 },
});
