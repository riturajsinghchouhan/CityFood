// Port of Frontend/src/modules/Food/pages/user/restaurants/RestaurantDetails.jsx.
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Clock,
  MapPin,
  MoreVertical,
  Percent,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  Utensils,
  X,
} from "lucide-react-native";
import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Linking, Pressable, ScrollView, SectionList, Share, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryThumb, FilterSheet, ItemDetailSheet, MenuCategoriesSheet, MenuOptionsSheet, OffersSheet, ShareModal } from "../../components/restaurant/RestaurantSheets";
import DishCard from "../../components/restaurant/DishCard";
import { MenuFab } from "../../components/restaurant/MenuFab";
import { MenuScanAnimation, RestaurantDetailSkeleton } from "../../components/restaurant/Skeletons";
import AddToCartAnimation from "../../components/shell/AddToCartAnimation";
import { Button, Screen, Text, inputFont, toast } from "../../components/ui";
import { API_BASE_URL } from "../../config";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useAppLocation } from "../../context/LocationContext";
import { useProfile } from "../../context/ProfileContext";
import useLatest from "../../hooks/useLatest";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import {
  buildCartLineId,
  calculateBestDiscount,
  calculateDistanceKm,
  formatDistanceKm,
  getDefaultFoodVariant,
  getFinalPrice,
  getFoodVariants,
  getRestaurantAvailabilityStatus,
  getSectionCategoryImage,
  getSectionDisplayName,
  isRecommendedItem,
  isRecommendedSection,
  normalizeMenuCategoryId,
  toRenderableArray,
  WEB_ORIGIN,
} from "./lib";
import useRestaurantDetails from "./useRestaurantDetails";

const EMERALD = "#009966";
const PAGE_SIZE = 20;
const DEFAULT_FILTERS = { sortBy: null, vegNonVeg: null, highlyReordered: false, spicy: false };

const lineIdFor = (item, variant = null) => buildCartLineId(item?.id || item?._id || "", variant?.id || variant?._id || "");
const variantFor = (item, preferredId = "") => {
  const variants = getFoodVariants(item);
  if (variants.length === 0) return null;
  return variants.find((v) => String(v.id) === String(preferredId || "")) || variants[0];
};
const sourceFromEvent = (e) => {
  const ne = e?.nativeEvent;
  if (!ne || !Number.isFinite(ne.pageX) || !Number.isFinite(ne.pageY)) return null;
  return { viewportX: ne.pageX, viewportY: ne.pageY };
};

// Rotating offer headline (AnimatePresence slide-up on web).
function OfferHeadline({ text, color }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}
    >
      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color, lineHeight: 20 }}>
        {text}
      </Text>
    </Animated.View>
  );
}

function RestaurantDetailsContent() {
  const params = useLocalSearchParams();
  const slug = String(params.slug || "");
  const showOnlyUnder250 = params.under250 === "true";
  const targetDishId = String(
    params.highlightItemId || params.dish || params.dishId || params.foodId || params.itemId || "",
  ).trim();

  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const { isAuthenticated } = useAuth();
  const { companyName } = useAppSettings();
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart, itemCount } = useCart();
  const { vegMode, vegModeOption, addDishFavorite, removeDishFavorite, isDishFavorite, addFavorite, removeFavorite, isFavorite } =
    useProfile();
  const { location: userLocation, zoneId, isOutOfService, serviceUnavailableMessage } = useAppLocation();

  const { restaurant: loadedRestaurant, loadingRestaurant, restaurantError, loadingMenuItems, menuUnavailable, menuVersion } =
    useRestaurantDetails({ slug, zoneId, userLocation, targetDishId });

  const [showScanAnimation, setShowScanAnimation] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("all");
  const [expandedSections, setExpandedSections] = useState(() => new Set([0]));
  const [visibleItemCount, setVisibleItemCount] = useState(PAGE_SIZE);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [showOffersSheet, setShowOffersSheet] = useState(false);
  const [showMenuOptionsSheet, setShowMenuOptionsSheet] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePayload, setSharePayload] = useState(null);
  const [highlightedDishId, setHighlightedDishId] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [availabilityTick, setAvailabilityTick] = useState(() => Date.now());
  const listRef = useRef(null);
  const timers = useRef(new Set());

  const later = useCallback((fn, ms) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // Availability is re-checked every 60 s.
  useEffect(() => {
    const id = setInterval(() => setAvailabilityTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const [prevSlug, setPrevSlug] = useState(slug);
  if (prevSlug !== slug) {
    setPrevSlug(slug);
    setSelectedMenuCategory("all");
  }

  // Distance: backend road distance first, else haversine from the user's location.
  const restaurant = useMemo(() => {
    if (!loadedRestaurant) return null;
    const loc = loadedRestaurant.locationObject;
    const rLat = loc?.latitude || (Array.isArray(loc?.coordinates) ? loc.coordinates[1] : null);
    const rLng = loc?.longitude || (Array.isArray(loc?.coordinates) ? loc.coordinates[0] : null);
    const uLat = userLocation?.latitude;
    const uLng = userLocation?.longitude;
    let distance = loadedRestaurant.distanceText || null;
    if (!distance && uLat && uLng && rLat && rLng && !Number.isNaN(uLat) && !Number.isNaN(rLat)) {
      distance = formatDistanceKm(calculateDistanceKm(uLat, uLng, rLat, rLng));
    }
    return { ...loadedRestaurant, distance: distance || loadedRestaurant.fallbackDistance };
  }, [loadedRestaurant, userLocation?.latitude, userLocation?.longitude]);

  const restaurantKeyId = restaurant?.restaurantId || restaurant?._id || restaurant?.id;

  // Quantities come from the cart lines of this restaurant.
  const restaurantName = restaurant?.name;
  const quantities = useMemo(() => {
    const map = {};
    if (!restaurantName) return map;
    cart.forEach((line) => {
      if (line.restaurant === restaurantName) map[line.id] = line.quantity || 0;
    });
    return map;
  }, [cart, restaurantName]);
  const getDishQuantity = useCallback(
    (item, preferredVariantId = "") => quantities[lineIdFor(item, variantFor(item, preferredVariantId))] || 0,
    [quantities],
  );

  // All sections expanded once a menu arrives.
  useEffect(() => {
    if (!menuVersion || !loadedRestaurant?.menuSections) return;
    const next = new Set();
    loadedRestaurant.menuSections.forEach((section, i) => {
      next.add(i);
      (section.subsections || []).forEach((_, j) => next.add(`${i}-${j}`));
    });
    setExpandedSections(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuVersion]);

  const menuSections = restaurant?.menuSections;

  const menuCategories = useMemo(() => {
    if (!Array.isArray(menuSections)) return [];
    return menuSections
      .map((section, index) => {
        if (isRecommendedSection(section)) return null;
        const title = getSectionDisplayName(section);
        const count =
          (Array.isArray(section?.items) ? section.items.length : 0) +
          (Array.isArray(section?.subsections)
            ? section.subsections.reduce((sum, sub) => sum + (Array.isArray(sub?.items) ? sub.items.length : 0), 0)
            : 0);
        if (count <= 0) return null;
        return {
          id: normalizeMenuCategoryId(section?.categoryId || title || index) || `section-${index}`,
          name: title,
          image: getSectionCategoryImage(section),
          count,
          sectionIndex: index,
        };
      })
      .filter(Boolean);
  }, [menuSections]);

  if (selectedMenuCategory !== "all" && !menuCategories.some((c) => c.id === selectedMenuCategory)) {
    setSelectedMenuCategory("all");
  }

  const activeFilterCount = [filters.sortBy, filters.vegNonVeg, filters.highlyReordered, filters.spicy].filter(Boolean).length;
  const hasActiveMenuFilters = Boolean(
    showOnlyUnder250 || searchQuery.trim() || vegMode === true || filters.sortBy || filters.vegNonVeg || filters.highlyReordered || filters.spicy,
  );

  const filteredSections = useMemo(() => {
    if (!menuSections) return [];
    const finalPrice = (item) => getFinalPrice(restaurant, item);
    const filterItems = (items) =>
      items.filter((item) => {
        if (showOnlyUnder250 && finalPrice(item) > 250) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          if (!(item.name?.toLowerCase() || "").includes(q)) return false;
        }
        if (vegMode === true && item.foodType !== "Veg") return false;
        if (filters.vegNonVeg === "veg" && item.foodType !== "Veg") return false;
        if (filters.vegNonVeg === "non-veg" && item.foodType !== "Non-Veg") return false;
        if (filters.highlyReordered && !isRecommendedItem(item)) return false;
        if (filters.spicy && item.isSpicy !== true) return false;
        return true;
      });
    const sortItems = (items) => {
      if (filters.sortBy === "low-to-high") return [...items].sort((a, b) => finalPrice(a) - finalPrice(b));
      if (filters.sortBy === "high-to-low") return [...items].sort((a, b) => finalPrice(b) - finalPrice(a));
      return items;
    };
    const visible = menuSections
      .map((section, index) => ({
        section: {
          ...section,
          items: sortItems(filterItems(toRenderableArray(section?.items).filter((i) => i?.isAvailable !== false))),
          subsections: toRenderableArray(section?.subsections)
            .map((sub) => ({
              ...sub,
              items: sortItems(filterItems(toRenderableArray(sub?.items).filter((i) => i?.isAvailable !== false))),
            }))
            .filter((sub) => sub.items.length > 0),
        },
        originalIndex: index,
      }))
      .filter(({ section }) => {
        if (selectedMenuCategory !== "all") {
          if (isRecommendedSection(section)) return false;
          if (normalizeMenuCategoryId(section?.categoryId || getSectionDisplayName(section)) !== selectedMenuCategory) return false;
        }
        return section.items.length > 0 || section.subsections.length > 0;
      });
    if (!filters.sortBy) return visible;
    const sortValue = (section) => {
      const prices = [...section.items, ...section.subsections.flatMap((s) => s.items)].map(finalPrice).filter(Number.isFinite);
      if (prices.length === 0) return null;
      return filters.sortBy === "low-to-high" ? Math.min(...prices) : Math.max(...prices);
    };
    return [...visible].sort((l, r) => {
      const a = sortValue(l.section);
      const b = sortValue(r.section);
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return filters.sortBy === "low-to-high" ? a - b : b - a;
    });
  }, [menuSections, restaurant, showOnlyUnder250, searchQuery, vegMode, filters, selectedMenuCategory]);

  const totalFilteredItems = useMemo(
    () => filteredSections.reduce((n, { section }) => n + section.items.length + section.subsections.reduce((s, sub) => s + sub.items.length, 0), 0),
    [filteredSections],
  );

  // Pagination restarts at 20 whenever the filtered sections change.
  const [prevFiltered, setPrevFiltered] = useState(filteredSections);
  if (prevFiltered !== filteredSections) {
    setPrevFiltered(filteredSections);
    setVisibleItemCount(PAGE_SIZE);
  }

  const paginatedSections = useMemo(() => {
    if (visibleItemCount >= totalFilteredItems) return filteredSections;
    let count = 0;
    return filteredSections
      .map(({ section, originalIndex }) => {
        const next = { ...section, items: [], subsections: [] };
        if (count >= visibleItemCount) return { section: next, originalIndex };
        if (section.subsections.length > 0) {
          for (const sub of section.subsections) {
            if (count >= visibleItemCount) break;
            const take = sub.items.slice(0, visibleItemCount - count);
            count += take.length;
            next.subsections.push({ ...sub, items: take });
          }
        } else {
          const take = section.items.slice(0, visibleItemCount - count);
          count += take.length;
          next.items = take;
        }
        return { section: next, originalIndex };
      })
      .filter((s) => s.section.items.length > 0 || s.section.subsections.some((sub) => sub.items.length > 0));
  }, [filteredSections, visibleItemCount, totalFilteredItems]);

  // Filters expand every visible section.
  useEffect(() => {
    if (!hasActiveMenuFilters) return;
    setExpandedSections((prev) => {
      const next = new Set(prev);
      filteredSections.forEach(({ section, originalIndex }) => {
        next.add(originalIndex);
        section.subsections.forEach((_, j) => next.add(`${originalIndex}-${j}`));
      });
      return next;
    });
  }, [filteredSections, hasActiveMenuFilters]);

  const toggleSection = useCallback((key) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // SectionList data: one list section per menu section; rows are dishes and subsection headers.
  const listSections = useMemo(
    () =>
      paginatedSections.map(({ section, originalIndex }) => {
        const isRec = isRecommendedSection(section);
        const data = [];
        if (expandedSections.has(originalIndex)) {
          if (isRec && !loadingMenuItems && section.items.length === 0) data.push({ type: "empty-rec", key: `er-${originalIndex}` });
          if (loadingMenuItems) data.push({ type: "loading", key: `ld-${originalIndex}` });
          section.items.forEach((item) => data.push({ type: "item", item, isRec, key: `i-${originalIndex}-${item.id}` }));
          section.subsections.forEach((sub, j) => {
            const subKey = `${originalIndex}-${j}`;
            const open = expandedSections.has(subKey);
            data.push({ type: "sub", sub, subKey, open, first: j === 0, key: `s-${subKey}` });
            if (open) sub.items.forEach((item) => data.push({ type: "item", item, isRec, key: `i-${subKey}-${item.id}` }));
          });
        }
        return { key: `sec-${originalIndex}`, originalIndex, section, isRec, data };
      }),
    [paginatedSections, expandedSections, loadingMenuItems],
  );

  const scrollToSection = useCallback(
    (originalIndex) => {
      const sectionIndex = listSections.findIndex((s) => s.originalIndex === originalIndex);
      if (sectionIndex < 0 || !listRef.current) return;
      // itemIndex 0 is the section header; the web section has scroll-mt-20.
      listRef.current.scrollToLocation({ sectionIndex, itemIndex: 0, viewOffset: 80, animated: true });
    },
    [listSections],
  );
  const pendingScroll = useRef(null);
  useEffect(() => {
    if (pendingScroll.current == null) return;
    const target = pendingScroll.current;
    pendingScroll.current = null;
    later(() => scrollToSection(target), 400);
  }, [listSections, scrollToSection, later]);

  const listSectionsRef = useLatest(listSections);

  // Deep link to a dish (?dish / dishId / highlightItemId ...): expand, scroll, highlight for 3.5 s.
  const handledTarget = useRef(null);
  useEffect(() => {
    if (!menuSections || !targetDishId || handledTarget.current === `${menuVersion}:${targetDishId}`) return;
    const keys = new Set();
    let found = false;
    menuSections.forEach((section, i) => {
      if (!found && toRenderableArray(section?.items).some((it) => String(it?.id || it?._id || "").trim() === targetDishId)) {
        found = true;
        keys.add(i);
      }
      toRenderableArray(section?.subsections).forEach((sub, j) => {
        if (!found && toRenderableArray(sub?.items).some((it) => String(it?.id || it?._id || "").trim() === targetDishId)) {
          found = true;
          keys.add(i);
          keys.add(`${i}-${j}`);
        }
      });
    });
    if (!found) return;
    handledTarget.current = `${menuVersion}:${targetDishId}`;
    setExpandedSections((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
    setHighlightedDishId(targetDishId);
    later(() => {
      const sections = listSectionsRef.current;
      // The web scrolls to the last rendered card for that dish (its own menu section).
      for (let s = sections.length - 1; s >= 0; s -= 1) {
        const itemIndex = sections[s].data.findIndex((row) => row.type === "item" && String(row.item.id) === targetDishId);
        if (itemIndex >= 0) {
          listRef.current?.scrollToLocation({ sectionIndex: s, itemIndex: itemIndex + 1, viewPosition: 0.5, animated: true });
          break;
        }
      }
    }, 250);
    later(() => setHighlightedDishId((cur) => (cur === targetDishId ? null : cur)), 3500);
  }, [menuSections, targetDishId, menuVersion, later, listSectionsRef]);

  // Offer line rotation.
  const offersList = Array.isArray(restaurant?.offers) ? restaurant.offers : [];
  const offersCount = offersList.length;
  useEffect(() => {
    if (offersCount <= 1) return undefined;
    const id = setInterval(() => setHighlightIndex((p) => (p + 1) % offersCount), 3000);
    return () => clearInterval(id);
  }, [offersCount]);
  const activeOffer = offersCount > 0 ? offersList[highlightIndex % offersCount] : null;
  const offerIndicatorCount = Math.min(offersCount > 0 ? offersCount : 1, 5);
  const activeOfferIndicator = highlightIndex % offerIndicatorCount;
  const offerHeadline = activeOffer?.title || restaurant?.offerText || "No offers currently available";
  const offerSubline =
    activeOffer?.description || activeOffer?.subtitle || (activeOffer?.code ? `Use code ${activeOffer.code}` : "Tap to view all offers");

  const availability = restaurant ? getRestaurantAvailabilityStatus(restaurant, new Date(availabilityTick)) : { isOpen: false };
  const isRestaurantOffline = !availability.isOpen;
  const shouldShowGrayscale = isOutOfService || isRestaurantOffline;
  const ratingValue = Number(restaurant?.rating || 0);
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;
  const ratingLabel = hasRating ? ratingValue.toFixed(1) : "New";
  const reviewsCount = Number(restaurant?.reviews || 0);
  const reviewsLabel = hasRating && reviewsCount > 0 ? `${reviewsCount.toLocaleString()}+ ratings` : "New";

  // ---- cart ----
  const updateItemQuantity = (item, newQuantity, event = null, preferredVariant = null) => {
    if (!isAuthenticated) {
      toast.error("Please login to add items to cart");
      router.push({ pathname: "/login", params: { from: `/restaurants/${slug}` } });
      return;
    }
    if (isOutOfService) {
      toast.error(serviceUnavailableMessage || "Service is currently unavailable.");
      return;
    }
    if (!getRestaurantAvailabilityStatus(restaurant).isOpen) {
      toast.error("Restaurant is currently offline. Please try again later.");
      return;
    }
    const variant = preferredVariant || getDefaultFoodVariant(item);
    const lineItemId = lineIdFor(item, variant);
    if (!restaurant || !restaurant.name) {
      toast.error("Restaurant information is missing. Please refresh the page.");
      return;
    }
    if (!restaurantKeyId) {
      toast.error("Restaurant ID is missing. Please refresh the page.");
      return;
    }
    const basePrice = variant?.price ?? item.price;
    const priceNum = typeof basePrice === "number" ? basePrice : parseFloat(String(basePrice).replace(/[^0-9.]/g, "")) || 0;
    const { discountValue, isFlatDiscount } = calculateBestDiscount(restaurant, item, priceNum);
    const finalPrice =
      discountValue > 0
        ? Math.round(isFlatDiscount ? Math.max(0, priceNum - discountValue) : priceNum * (1 - discountValue / 100))
        : priceNum;
    const cartItem = {
      id: lineItemId,
      lineItemId,
      itemId: item.id,
      name: item.name,
      price: finalPrice,
      originalPrice: priceNum,
      variantId: variant?.id || "",
      variantName: variant?.name || "",
      variantPrice: finalPrice,
      image: item.image,
      restaurant: restaurant.name,
      restaurantId: restaurantKeyId,
      description: item.description,
      isVeg: item.isVeg === true,
      foodType: item.foodType,
      preparationTime: item.preparationTime,
      priceOnOtherPlatforms: item.priceOnOtherPlatforms || null,
      otherPlatformGst: item.otherPlatformGst ?? null,
    };
    const sourcePosition = sourceFromEvent(event);
    const productInfo = { id: lineItemId, name: item.name, imageUrl: item.image };

    if (newQuantity <= 0) {
      removeFromCart(lineItemId, sourcePosition, productInfo);
      return;
    }
    const existing = getCartItem(lineItemId);
    if (existing) {
      if (newQuantity > existing.quantity && sourcePosition) {
        const result = addToCart(cartItem, sourcePosition);
        if (result?.ok === false) {
          toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
          return;
        }
        if (newQuantity > existing.quantity + 1) updateQuantity(lineItemId, newQuantity);
      } else if (newQuantity < existing.quantity && sourcePosition) {
        updateQuantity(lineItemId, newQuantity, sourcePosition, productInfo);
      } else {
        updateQuantity(lineItemId, newQuantity);
      }
      return;
    }
    const result = addToCart(cartItem, sourcePosition);
    if (result?.ok === false) {
      toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
      return;
    }
    if (newQuantity > 1) updateQuantity(lineItemId, newQuantity);
  };

  // ---- favorites ----
  const handleBookmarkClick = (item) => {
    if (!restaurantKeyId) {
      toast.error("Restaurant information is missing");
      return;
    }
    const dishId = item.id || item._id;
    if (!dishId) {
      toast.error("Dish information is missing");
      return;
    }
    if (isDishFavorite(dishId, restaurantKeyId)) {
      removeDishFavorite(dishId, restaurantKeyId);
      toast.success("Dish removed from favorites");
    } else {
      addDishFavorite({
        id: dishId,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        image: item.image,
        restaurantId: restaurantKeyId,
        restaurantName: restaurant?.name || "",
        restaurantSlug: restaurant?.slug || slug || "",
        foodType: item.foodType,
        isSpicy: item.isSpicy,
        customisable: item.customisable,
      });
      toast.success("Dish added to favorites");
    }
  };

  const handleAddToCollection = () => {
    const restaurantSlug = restaurant?.slug || slug || "";
    if (!restaurantSlug) {
      toast.error("Restaurant information is missing");
      return;
    }
    if (isFavorite(restaurantSlug)) {
      removeFavorite(restaurantSlug);
      toast.success("Restaurant removed from collection");
    } else {
      addFavorite({
        slug: restaurantSlug,
        name: restaurant.name || "",
        cuisine: restaurant.cuisine || "",
        rating: restaurant.rating || 0,
        deliveryTime: restaurant.deliveryTime || "",
        distance: restaurant.distance || "",
        priceRange: restaurant.priceRange || "",
        image: restaurant.image || "",
      });
      toast.success("Restaurant added to collection");
    }
    setShowMenuOptionsSheet(false);
  };

  // ---- share (phones always get the share modal on web) ----
  const openShareModal = (payload, afterSheet = false) => {
    setSharePayload(payload);
    if (afterSheet) later(() => setShowShareModal(true), 250);
    else setShowShareModal(true);
  };
  const dishSharePayload = (item) => {
    const restaurantSlug = restaurant?.slug || slug || "";
    const url = `${WEB_ORIGIN}/user/restaurants/${restaurantSlug}?dish=${item.id || item._id}`;
    return {
      title: `${item.name} - ${restaurant?.name || ""}`,
      text: `Check out ${item.name} from ${restaurant?.name || "this restaurant"}! ${url}`,
      url,
    };
  };
  const handleShareRestaurant = () => {
    const restaurantSlug = restaurant?.slug || slug || "";
    const url = `${WEB_ORIGIN}/user/restaurants/${restaurantSlug}`;
    setShowMenuOptionsSheet(false);
    openShareModal(
      { title: restaurant?.name || "this restaurant", text: `Check out ${restaurant?.name || "this restaurant"} on ${companyName}! ${url}`, url },
      true,
    );
  };
  // The web calls an undefined handleSystemShare for dishes in the recommended/search
  // sections (crash). Intent: share the dish through the system share sheet.
  const handleSystemShare = async (item) => {
    const payload = dishSharePayload(item);
    try {
      await Share.share({ title: payload.title, message: payload.text });
      toast.success("Dish shared successfully");
    } catch {
      openShareModal(payload);
    }
  };
  const handleSystemShareFromModal = async () => {
    if (!sharePayload) return;
    try {
      await Share.share({ title: sharePayload.title, message: sharePayload.text });
      setShowShareModal(false);
      toast.success("Shared successfully");
    } catch {
      // stays open, as when navigator.share fails on web
    }
  };
  const openShareTarget = (target) => {
    if (!sharePayload?.url) return;
    const text = sharePayload.text || "";
    const url = sharePayload.url;
    let link = "";
    if (target === "whatsapp") link = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    else if (target === "telegram") link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    else if (target === "email")
      link = `mailto:?subject=${encodeURIComponent(sharePayload.title || "Check this out")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
    if (link) {
      Linking.openURL(link).catch(() => {});
      setShowShareModal(false);
    }
  };
  const copyShareLink = async () => {
    if (!sharePayload?.url) return;
    try {
      await Clipboard.setStringAsync(sharePayload.url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
    setShowShareModal(false);
  };

  const openItem = (item) => {
    setSelectedItem(item);
    setSelectedVariantId(getDefaultFoodVariant(item)?.id || "");
    setShowItemDetail(true);
  };

  const onMenuCategory = (category) => {
    setShowMenuSheet(false);
    setExpandedSections((prev) => new Set(prev).add(category.sectionIndex));
    if (visibleItemCount >= totalFilteredItems) later(() => scrollToSection(category.sectionIndex), 400);
    else {
      pendingScroll.current = category.sectionIndex;
      setVisibleItemCount(totalFilteredItems);
    }
  };

  // ---- palette ----
  const pageBg = isDark ? "#0a0a0a" : "#ffffff";
  const cardBg = isDark ? "#1a1a1a" : "#ffffff";
  const strong = isDark ? "#ffffff" : tw.gray900;
  const body = isDark ? tw.gray300 : tw.gray700;
  const roundBtn = [styles.roundBtn, { borderColor: isDark ? tw.gray800 : tw.gray200, backgroundColor: cardBg }];

  if (loadingRestaurant && !restaurant) {
    return (
      <Screen background={pageBg}>
        <RestaurantDetailSkeleton />
        {showScanAnimation ? <MenuScanAnimation duration={2200} onComplete={() => setShowScanAnimation(false)} /> : null}
      </Screen>
    );
  }

  if (!restaurant) {
    const backendDown = restaurantError?.includes("Backend server is not connected");
    return (
      <Screen background={tw.gray50}>
        <View style={styles.centerFill}>
          <AlertCircle size={48} color={backendDown ? colors.primary : tw.red500} />
          <View style={{ alignItems: "center" }}>
            {restaurantError ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 4, color: strong }}>
                  {backendDown ? "Connection Error" : restaurantError === "Restaurant not found" ? "Restaurant not found" : "Error"}
                </Text>
                <Text style={{ fontSize: 14, color: tw.gray600, marginBottom: 16, textAlign: "center", maxWidth: 448 }}>{restaurantError}</Text>
                {backendDown ? (
                  <Text style={{ fontSize: 12, color: tw.gray500, marginBottom: 16, textAlign: "center" }}>
                    Make sure the backend server is running at {API_BASE_URL.replace("/api", "")}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={{ fontSize: 14, color: tw.gray600, marginBottom: 16 }}>Restaurant not found</Text>
            )}
            <Button variant="outline" title="Go Back" onPress={goBack} />
          </View>
        </View>
      </Screen>
    );
  }

  const fssai = restaurant?.onboarding?.step3?.fssai?.registrationNumber;
  const hasMenu = Array.isArray(menuSections) && menuSections.length > 0;

  const chip = (active, extra) => [
    styles.chip,
    active
      ? { borderColor: colors.primary, backgroundColor: "#7e386615" }
      : { borderColor: isDark ? tw.gray700 : tw.gray300, backgroundColor: cardBg },
    extra,
  ];

  const header = (
    <View>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} style={roundBtn}>
          <ArrowLeft size={20} color={strong} />
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
          {!showSearch ? (
            <Pressable onPress={() => setShowSearch(true)} style={[roundBtn, styles.searchPill]}>
              <Search size={16} color={strong} />
              <Text style={{ fontSize: 14, fontWeight: "500", color: strong }}>Search</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1, minWidth: 200, maxWidth: 448, justifyContent: "center" }}>
              <Search size={16} color={tw.gray400} style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search for dishes..."
                placeholderTextColor={tw.gray400}
                autoFocus
                onBlur={() => {
                  if (!searchQuery) setShowSearch(false);
                }}
                selectionColor={colors.primary}
                style={[styles.searchInput, inputFont, { borderColor: colors.primary, backgroundColor: cardBg, color: isDark ? "#ffffff" : tw.gray900 }]}
              />
              {searchQuery ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setSearchQuery("");
                    setShowSearch(false);
                  }}
                  style={styles.searchClear}
                >
                  <X size={16} color={tw.gray400} />
                </Pressable>
              ) : null}
            </View>
          )}
          <Pressable onPress={() => setShowMenuOptionsSheet(true)} style={roundBtn}>
            <MoreVertical size={20} color={strong} />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
        <View style={[styles.summary, { borderColor: isDark ? tw.gray800 : tw.gray100, backgroundColor: cardBg }]}>
          <LinearGradient
            colors={[colors.primary, "#8a4b77", "#b36b8f"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.summaryBar}
          />
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text numberOfLines={1} style={{ fontSize: 24, fontWeight: "700", color: strong, flexShrink: 1 }}>
                  {restaurant.name || "Unknown Restaurant"}
                </Text>
                {isRestaurantOffline ? (
                  <View style={styles.offlineMenuBadge}>
                    <Text style={{ fontSize: 10, fontWeight: "900", color: "#ffffff", letterSpacing: 1 }}>OFFLINE MENU</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Utensils size={16} color={body} />
                <Text style={{ fontSize: 14, color: body }}>{restaurant.topCategory || restaurant.cuisine || "Multi-cuisine"}</Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <View style={[styles.ratingPill, { backgroundColor: EMERALD }]}>
                <Star size={12} color="#ffffff" fill="#ffffff" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#ffffff" }}>{ratingLabel}</Text>
              </View>
              <Text style={{ fontSize: 12, color: tw.gray500, marginTop: 4 }}>{reviewsLabel}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
              <MapPin size={16} color={body} />
              <Text numberOfLines={1} style={{ fontSize: 14, color: body, flexShrink: 1 }}>
                {restaurant.distance || "1.2 km"} | {restaurant.location || "Location"}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: isRestaurantOffline ? "#ec003f" : EMERALD }]}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#ffffff" }}>{isRestaurantOffline ? "Offline" : "Open now"}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Clock size={16} color={body} />
            <Text style={{ fontSize: 14, color: body }}>{restaurant.deliveryTime || "25-30 mins"}</Text>
          </View>
        </View>

        {isRestaurantOffline ? (
          <View style={styles.offlineBanner}>
            <Text style={{ fontSize: 14, color: "#c70036" }}>This restaurant is currently offline. Orders are unavailable right now.</Text>
          </View>
        ) : null}

        {restaurant.discount > 0 ? (
          <LinearGradient
            colors={isDark ? ["rgba(5,46,22,0.2)", "rgba(2,44,34,0.2)"] : [tw.green50, "#ecfdf5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.discountCard, { borderColor: isDark ? "rgba(20,83,45,0.3)" : "#b9f8cf" }]}
          >
            <View style={[styles.iconBox, { backgroundColor: isDark ? "rgba(20,83,45,0.4)" : tw.green100 }]}>
              <Tag size={20} color={isDark ? "#05df72" : tw.green600} />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "900", letterSpacing: 0.35, color: isDark ? "#05df72" : tw.green800 }}>
                FLAT {restaurant.discount}% OFF
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "500", marginTop: 2, color: isDark ? tw.green500 : tw.green600 }}>
                Applied automatically on all items
              </Text>
            </View>
          </LinearGradient>
        ) : null}

        <Pressable
          onPress={() => setShowOffersSheet(true)}
          style={[styles.couponCard, { borderColor: isDark ? tw.gray800 : "rgba(17,24,39,0.2)", backgroundColor: cardBg }]}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? "rgba(124,45,18,0.3)" : tw.orange100 }]}>
              <Percent size={20} color={isDark ? "#ff8904" : "#f54900"} />
            </View>
            <View style={{ flex: 1, minWidth: 0, justifyContent: "center", alignSelf: "center" }}>
              <View style={{ height: 20, overflow: "hidden" }}>
                <OfferHeadline key={highlightIndex} text={offerHeadline} color={strong} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: 12, marginTop: 2, color: isDark ? tw.gray400 : tw.gray500 }}>
                {offerSubline}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={[styles.ratingPill, { backgroundColor: isDark ? "rgba(2,44,34,0.3)" : "#ecfdf5" }]}>
                <Star size={12} color={isDark ? "#00d492" : "#007a55"} fill={isDark ? "#00d492" : "#007a55"} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: isDark ? "#00d492" : "#007a55" }}>{ratingLabel}</Text>
              </View>
              <Text style={{ fontSize: 10, color: isDark ? tw.gray500 : tw.gray400 }}>{reviewsLabel}</Text>
            </View>
          </View>
          <View style={{ marginTop: 10, flexDirection: "row", gap: 6, paddingLeft: 56 }}>
            {Array.from({ length: offerIndicatorCount }).map((_, i) => (
              <View
                key={`offer-dot-${i}`}
                style={{ height: 6, width: 6, borderRadius: 999, backgroundColor: i === activeOfferIndicator ? tw.orange500 : isDark ? tw.gray700 : tw.gray200 }}
              />
            ))}
          </View>
        </Pressable>

        <View style={[styles.filterArea, { borderColor: tw.gray200 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ borderBottomWidth: 1, borderBottomColor: isDark ? "#101828" : tw.gray100 }}
            contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 10, paddingHorizontal: 16 }}
          >
            <Pressable
              onPress={() => setShowFilterSheet(true)}
              style={[styles.filterBtn, { borderColor: isDark ? tw.gray700 : tw.gray300, backgroundColor: cardBg }]}
            >
              <SlidersHorizontal size={16} color={strong} />
              <Text style={{ fontSize: 14, fontWeight: "500", color: strong }}>Filters</Text>
              {activeFilterCount > 0 ? (
                <View style={styles.filterCount}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#ffffff" }}>{activeFilterCount}</Text>
                </View>
              ) : null}
              <ChevronDown size={12} color={strong} />
            </Pressable>
            {vegModeOption !== "pure-veg" ? (
              <Pressable
                onPress={() => setFilters((p) => ({ ...p, vegNonVeg: p.vegNonVeg === "veg" ? null : "veg" }))}
                style={[
                  styles.filterBtn,
                  styles.pill,
                  filters.vegNonVeg === "veg"
                    ? { borderColor: isDark ? tw.green500 : tw.green600, backgroundColor: isDark ? "rgba(20,83,45,0.2)" : tw.green50 }
                    : { borderColor: isDark ? tw.gray700 : tw.gray300, backgroundColor: cardBg },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: tw.green600 }]} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: filters.vegNonVeg === "veg" ? "700" : "500",
                    color: filters.vegNonVeg === "veg" ? (isDark ? "#05df72" : tw.green700) : strong,
                  }}
                >
                  Veg
                </Text>
                {filters.vegNonVeg === "veg" ? <X size={12} color={isDark ? tw.gray400 : tw.gray600} /> : null}
              </Pressable>
            ) : null}
            {vegModeOption !== "pure-veg" && !vegMode ? (
              <Pressable
                onPress={() => setFilters((p) => ({ ...p, vegNonVeg: p.vegNonVeg === "non-veg" ? null : "non-veg" }))}
                style={[
                  styles.filterBtn,
                  styles.pill,
                  filters.vegNonVeg === "non-veg"
                    ? { borderColor: isDark ? tw.red500 : tw.red600, backgroundColor: isDark ? "rgba(127,29,29,0.2)" : tw.red50 }
                    : { borderColor: isDark ? tw.gray700 : tw.gray300, backgroundColor: cardBg },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: tw.red600 }]} />
                <Text style={{ fontSize: 14, fontWeight: "500", color: filters.vegNonVeg === "non-veg" ? (isDark ? "#ff6467" : tw.red600) : strong }}>
                  Non-veg
                </Text>
                {filters.vegNonVeg === "non-veg" ? <X size={12} color={isDark ? tw.gray400 : tw.gray600} /> : null}
              </Pressable>
            ) : null}
          </ScrollView>
          {menuCategories.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 2, paddingHorizontal: 16 }}
              style={{ marginTop: 12 }}
            >
              <Pressable onPress={() => setSelectedMenuCategory("all")} style={chip(selectedMenuCategory === "all")}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: selectedMenuCategory === "all" ? colors.primary : body }}>All</Text>
              </Pressable>
              {menuCategories.map((category) => {
                const active = selectedMenuCategory === category.id;
                return (
                  <Pressable key={category.id} onPress={() => setSelectedMenuCategory(category.id)} style={chip(active)}>
                    <CategoryThumb category={category} size={24} radius={999} borderColor="rgba(255,255,255,0.7)" />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: active ? colors.primary : body }}>{category.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      </View>

      {loadingMenuItems && !hasMenu ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 24, gap: 16 }}>
          <View style={[styles.loadBlock, { height: 24, width: 160, borderRadius: 999, backgroundColor: isDark ? tw.gray800 : tw.gray100 }]} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.loadBlock, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]} />
          ))}
        </View>
      ) : null}

      {hasMenu ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 24 }}>
          {filteredSections.length === 0 && hasActiveMenuFilters ? (
            <View style={[styles.emptyBox, { borderColor: isDark ? tw.gray700 : tw.gray300, backgroundColor: cardBg, paddingVertical: 32 }]}>
              <Text style={{ fontSize: 14, fontWeight: "500", textAlign: "center", color: body }}>No dishes match the selected filters.</Text>
              <Text style={{ fontSize: 12, marginTop: 8, textAlign: "center", color: isDark ? tw.gray400 : tw.gray500 }}>
                Clear filters or try a different combination.
              </Text>
            </View>
          ) : null}
          {filteredSections.length === 0 ? (
            <View style={[styles.emptyBox, { borderRadius: 24, borderColor: isDark ? tw.gray700 : tw.gray300, backgroundColor: cardBg, paddingVertical: 40 }]}>
              <Text style={{ fontSize: 14, textAlign: "center", color: isDark ? tw.gray400 : tw.gray500 }}>No dishes match the current filters.</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const footer = (
    <View style={{ paddingBottom: insets.bottom + 16 }}>
      {!loadingMenuItems && menuUnavailable ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
          <View style={[styles.emptyBox, { borderColor: isDark ? tw.gray700 : tw.gray300, backgroundColor: cardBg, paddingVertical: 40 }]}>
            <Text style={{ fontSize: 14, fontWeight: "500", textAlign: "center", color: body }}>Menu is not available yet.</Text>
            <Text style={{ fontSize: 12, marginTop: 8, textAlign: "center", color: isDark ? tw.gray400 : tw.gray500 }}>
              The restaurant has not uploaded its menu.
            </Text>
          </View>
        </View>
      ) : null}
      {fssai ? (
        <View style={[styles.fssai, { borderColor: isDark ? tw.gray800 : tw.gray200, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(249,250,251,0.3)" }]}>
          {/* fssai.png is unrecoverable: the white logo box stays empty. */}
          <View style={styles.fssaiBox} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1, color: isDark ? tw.gray500 : tw.gray400, marginBottom: 4 }}>LICENSE NO.</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: 0.35, fontFamily: "monospace", color: isDark ? tw.gray300 : tw.gray600 }}>
              {fssai}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderSectionHeader = ({ section: s }) => {
    const expanded = expandedSections.has(s.originalIndex);
    const title = s.isRec ? "Recommended for you" : getSectionDisplayName(s.section);
    const isFirst = listSections[0]?.key === s.key;
    return (
      <View style={[styles.sectionHeader, { marginTop: isFirst ? 24 : 28 }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: strong }}>{title}</Text>
          {!s.isRec && s.section.subtitle ? (
            <Text style={{ fontSize: 14, color: isDark ? "#51a2ff" : tw.blue600, textDecorationLine: "underline" }}>{s.section.subtitle}</Text>
          ) : null}
        </View>
        <Pressable hitSlop={8} onPress={() => toggleSection(s.originalIndex)} style={{ padding: 4 }}>
          <ChevronDown size={20} color={isDark ? tw.gray400 : tw.gray600} style={{ transform: [{ rotate: expanded ? "0deg" : "-90deg" }] }} />
        </Pressable>
      </View>
    );
  };

  const renderItem = ({ item: row, section: s }) => {
    if (row.type === "empty-rec") {
      return (
        <View style={{ paddingVertical: 32, alignItems: "center" }}>
          <Text style={{ fontSize: 14, color: isDark ? tw.gray400 : tw.gray500 }}>No dish recommended</Text>
        </View>
      );
    }
    if (row.type === "loading") {
      return (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 12 }}>
          <View style={[styles.loadBlock, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]} />
          <View style={[styles.loadBlock, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]} />
        </View>
      );
    }
    if (row.type === "sub") {
      return (
        <View style={[styles.subHeader, { marginTop: row.first ? 4 : 16, marginBottom: row.open ? 12 : 0 }]}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: strong }}>{row.sub?.name || row.sub?.title || "Subsection"}</Text>
          <Pressable hitSlop={8} onPress={() => toggleSection(row.subKey)} style={{ padding: 4 }}>
            <ChevronDown size={16} color={isDark ? tw.gray400 : tw.gray500} style={{ transform: [{ rotate: row.open ? "0deg" : "-90deg" }] }} />
          </Pressable>
        </View>
      );
    }
    const item = row.item;
    const quantity = getDishQuantity(item);
    const disabled = shouldShowGrayscale || isRestaurantOffline;
    return (
      <View style={{ paddingHorizontal: 16 }}>
      <DishCard
        item={item}
        restaurant={restaurant}
        quantity={quantity}
        disabled={disabled}
        isRestaurantOffline={isRestaurantOffline}
        isFavorite={isDishFavorite(item.id || item._id, restaurantKeyId)}
        highlighted={highlightedDishId === (item.id || item._id)}
        onPress={() => openItem(item)}
        onAdd={(e) => !disabled && updateItemQuantity(item, 1, e)}
        onIncrement={(e) => !disabled && updateItemQuantity(item, quantity + 1, e)}
        onDecrement={(e) => !disabled && updateItemQuantity(item, Math.max(0, quantity - 1), e)}
        onBookmark={() => handleBookmarkClick(item)}
        onShare={() => (s.isRec ? handleSystemShare(item) : openShareModal(dishSharePayload(item)))}
      />
      </View>
    );
  };

  const selectedVariant = selectedItem ? variantFor(selectedItem, selectedVariantId) : null;
  const selectedQty = selectedItem ? getDishQuantity(selectedItem, selectedVariantId) : 0;

  return (
    <Screen background={pageBg}>
      <SectionList
        ref={listRef}
        sections={listSections}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        style={[{ flex: 1 }, shouldShowGrayscale && { filter: [{ grayscale: 1 }], opacity: 0.75 }]}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={1.5}
        onEndReached={() => setVisibleItemCount((c) => (c >= totalFilteredItems ? c : c + PAGE_SIZE))}
        onScrollToIndexFailed={(info) => {
          listRef.current?.getScrollResponder?.()?.scrollTo?.({ y: info.averageItemLength * info.index, animated: true });
        }}
        initialNumToRender={12}
        windowSize={11}
        extraData={quantities}
      />

      <ItemDetailSheet
        visible={showItemDetail}
        onClose={() => setShowItemDetail(false)}
        item={selectedItem}
        restaurant={restaurant}
        selectedVariantId={selectedVariantId}
        onSelectVariant={setSelectedVariantId}
        quantity={selectedQty}
        disabled={shouldShowGrayscale}
        isFavorite={selectedItem ? isDishFavorite(selectedItem.id || selectedItem._id, restaurantKeyId) : false}
        onBookmark={() => selectedItem && handleBookmarkClick(selectedItem)}
        onDecrement={(e) => !shouldShowGrayscale && updateItemQuantity(selectedItem, Math.max(0, selectedQty - 1), e, selectedVariant)}
        onIncrement={(e) => !shouldShowGrayscale && updateItemQuantity(selectedItem, selectedQty + 1, e, selectedVariant)}
        onAddItem={(e) => {
          if (shouldShowGrayscale) return;
          updateItemQuantity(selectedItem, selectedQty + 1, e, selectedVariant);
          setShowItemDetail(false);
        }}
      />
      <MenuCategoriesSheet visible={showMenuSheet} onClose={() => setShowMenuSheet(false)} categories={menuCategories} onSelect={onMenuCategory} />
      <FilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        filters={filters}
        setFilters={setFilters}
        vegMode={vegMode}
        vegModeOption={vegModeOption}
        activeFilterCount={activeFilterCount}
      />
      <OffersSheet visible={showOffersSheet} onClose={() => setShowOffersSheet(false)} restaurant={restaurant} />
      <MenuOptionsSheet
        visible={showMenuOptionsSheet}
        onClose={() => setShowMenuOptionsSheet(false)}
        restaurant={restaurant}
        isFavorite={isFavorite(restaurant?.slug || slug || "")}
        onToggleCollection={handleAddToCollection}
        onShare={handleShareRestaurant}
      />
      <ShareModal
        visible={showShareModal && !!sharePayload}
        onClose={() => setShowShareModal(false)}
        onSystemShare={handleSystemShareFromModal}
        onTarget={openShareTarget}
        onCopy={copyShareLink}
      />

      {!showScanAnimation ? <MenuFab itemCount={itemCount} onPress={() => setShowMenuSheet(true)} /> : null}
      {!showScanAnimation ? <AddToCartAnimation bottomOffset={80} linkTo="/cart" /> : null}
      {showScanAnimation ? <MenuScanAnimation duration={2200} onComplete={() => setShowScanAnimation(false)} /> : null}
    </Screen>
  );
}

// RestaurantDetailsErrorBoundary: "Reload Page" remounts the screen.
class RestaurantDetailsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, attempt: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Screen background={tw.gray50}>
          <View style={styles.centerFill}>
            <AlertCircle size={48} color={tw.red500} />
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 4, color: tw.gray900 }}>Something went wrong</Text>
              <Text style={{ fontSize: 14, color: tw.gray600, marginBottom: 16, textAlign: "center" }}>
                We could not load this restaurant page right now.
              </Text>
              <Button
                variant="outline"
                title="Reload Page"
                onPress={() => this.setState((s) => ({ hasError: false, attempt: s.attempt + 1 }))}
              />
            </View>
          </View>
        </Screen>
      );
    }
    return <View key={this.state.attempt} style={{ flex: 1 }}>{this.props.children}</View>;
  }
}

export default function RestaurantDetailsScreen() {
  return (
    <RestaurantDetailsErrorBoundary>
      <RestaurantDetailsContent />
    </RestaurantDetailsErrorBoundary>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 16 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12 },
  roundBtn: {
    height: 40,
    width: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  searchPill: { width: undefined, flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  searchIcon: { position: "absolute", left: 12, zIndex: 1 },
  searchInput: { height: 36, borderRadius: 999, borderWidth: 1, paddingLeft: 40, paddingRight: 40, fontSize: 12, paddingVertical: 0 },
  searchClear: { position: "absolute", right: 12 },
  summary: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 16, overflow: "hidden", boxShadow: "0px 16px 40px rgba(15,23,42,0.08)" },
  summaryBar: { position: "absolute", left: 0, right: 0, top: 0, height: 6 },
  offlineMenuBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: tw.gray400 },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  offlineBanner: { borderRadius: 8, borderWidth: 1, borderColor: "#ffccd3", backgroundColor: "#fff1f2", paddingHorizontal: 12, paddingVertical: 8 },
  discountCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    boxShadow: "0px 4px 12px rgba(16,185,129,0.05)",
  },
  iconBox: { height: 44, width: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  couponCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, boxShadow: "0px 8px 20px rgba(15,23,42,0.08)" },
  filterArea: { borderTopWidth: 1, borderBottomWidth: 1, marginHorizontal: -16, paddingVertical: 12 },
  filterBtn: { height: 32, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  pill: { borderRadius: 999 },
  filterCount: {
    position: "absolute",
    top: -6,
    right: -6,
    height: 20,
    width: 20,
    borderRadius: 999,
    backgroundColor: tw.red500,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  dot: { height: 12, width: 12, borderRadius: 999 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  loadBlock: { height: 96, borderRadius: 16 },
  emptyBox: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", paddingHorizontal: 20, alignItems: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 4 },
  subHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  fssai: {
    marginTop: 8,
    marginBottom: 96,
    marginHorizontal: 16,
    padding: 16,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  fssaiBox: { height: 48, width: 80, backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: tw.gray100, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
});
