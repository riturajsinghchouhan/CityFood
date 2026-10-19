// Port of Frontend/src/modules/Food/pages/user/Under250.jsx (bottom-nav tab).
// The web imports PageNavbar but does not render it ("Header removed"), so neither does this screen.
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Share, View } from "react-native";
import {
  getMenuByRestaurantId,
  getPublicCategories,
  getPublicLandingSettings,
  getRestaurants,
  getUnder250Banners,
} from "../../api";
import {
  Under250Banner,
  Under250CategoryChips,
  Under250FilterRow,
  Under250RestaurantSection,
  Under250Skeleton,
} from "../../components/browse/Under250Parts";
import { ItemDetailSheet, ShareOptionsSheet, SortSheet, UNDER250_SORT_OPTIONS } from "../../components/browse/Under250Sheets";
import { getRestaurantAvailabilityStatus } from "../../components/restaurant-cards";
import { MenuScanAnimation } from "../../components/restaurant/Skeletons";
import AddToCartAnimation from "../../components/shell/AddToCartAnimation";
import { measureSourcePosition, useFloatingBottom } from "../../components/shell/floating";
import { Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useAppLocation } from "../../context/LocationContext";
import { KEYS, store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { WEB_ORIGIN } from "../restaurant/lib";
import {
  RUPEE,
  calculateDistanceKm,
  flattenMenuItems,
  formatDistanceKm,
  getMenuFromResponse,
  getUnder250DiscountPercent,
} from "./lib";

const normalizeFilters = (parsed) => ({
  selectedSort: typeof parsed?.selectedSort === "string" ? parsed.selectedSort : null,
  activeCategory: typeof parsed?.activeCategory === "string" ? parsed.activeCategory : null,
  under30MinsFilter: parsed?.under30MinsFilter === true,
});

const parseDeliveryTime = (deliveryTime) => {
  if (typeof deliveryTime === "number" && Number.isFinite(deliveryTime)) return deliveryTime;
  if (!deliveryTime) return 999;
  const value = String(deliveryTime);
  const range = value.match(/(\d+)\s*-\s*(\d+)/);
  if (range) return (parseInt(range[1], 10) + parseInt(range[2], 10)) / 2;
  const match = value.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
};

const parseDistance = (distance) => {
  if (typeof distance === "number" && Number.isFinite(distance)) return distance;
  if (!distance) return 999;
  const value = String(distance);
  const match = value.match(/(\d+\.?\d*)/);
  if (match) {
    const n = parseFloat(match[1]);
    return value.toLowerCase().includes("m") && !value.toLowerCase().includes("km") ? n / 1000 : n;
  }
  return 999;
};

// Survives tab switches and remounts like the web's module-level pageCache.
const pageCache = {
  zoneId: null,
  categories: null,
  bannerImages: null,
  under250Restaurants: null,
  allRawRestaurants: null,
  visibleRestaurantCount: 0,
  hasMore: true,
  fetchedIds: null,
};

const HEADER_ROWS = 3; // banner, sticky chips, filters

export default function Under250Screen() {
  const { colors, isDark } = useTheme();
  const { location, zoneId, isOutOfService, serviceUnavailableMessage } = useAppLocation();
  const { isAuthenticated } = useAuth();
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart();

  const [initialCacheValid] = useState(() => pageCache.zoneId === zoneId);
  const [showScanAnimation, setShowScanAnimation] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [isSwitchingCategory, setIsSwitchingCategory] = useState(false);
  const [showSortPopup, setShowSortPopup] = useState(false);
  const [selectedSort, setSelectedSort] = useState(null);
  const [draftSelectedSort, setDraftSelectedSort] = useState(null);
  const [under30MinsFilter, setUnder30MinsFilter] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetailQuantity, setItemDetailQuantity] = useState(1);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [bookmarkedItems, setBookmarkedItems] = useState(() => new Set());
  const [categories, setCategories] = useState(() => (initialCacheValid ? pageCache.categories || [] : []));
  const [loadingCategories, setLoadingCategories] = useState(() => !(initialCacheValid && pageCache.categories));
  const [bannerImages, setBannerImages] = useState(() => (initialCacheValid ? pageCache.bannerImages || [] : []));
  const [loadingBanner, setLoadingBanner] = useState(() => !(initialCacheValid && pageCache.bannerImages));
  const [under250Restaurants, setUnder250Restaurants] = useState(() => (initialCacheValid ? pageCache.under250Restaurants || [] : []));
  const [loadingRestaurants, setLoadingRestaurants] = useState(() => !(initialCacheValid && pageCache.allRawRestaurants));
  const [under250PriceLimit, setUnder250PriceLimit] = useState(250);
  const [allRawRestaurants, setAllRawRestaurants] = useState(() => (initialCacheValid ? pageCache.allRawRestaurants || [] : []));
  const [visibleRestaurantCount, setVisibleRestaurantCount] = useState(() =>
    initialCacheValid ? pageCache.visibleRestaurantCount || 0 : 0,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => (initialCacheValid ? pageCache.hasMore !== undefined ? pageCache.hasMore : true : true));
  const fetchedIdsRef = useRef(initialCacheValid && pageCache.fetchedIds ? new Set(pageCache.fetchedIds) : new Set());
  const filtersRestoredRef = useRef(false);
  const addButtonRef = useRef(null);
  const locationRef = useRef(location);
  const metricsRef = useRef({ y: 0, contentH: 0, layoutH: 0 });
  const lastScrollYRef = useRef(0);
  const [cartBottomWeb, setCartBottomWeb] = useState(92);
  const cartBottom = useFloatingBottom(cartBottomWeb, true);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // The web page remounts (and replays the scan intro) on every visit; tabs stay mounted.
  useFocusEffect(
    useCallback(() => {
      setShowScanAnimation(true);
    }, []),
  );
  const onScanComplete = useCallback(() => setShowScanAnimation(false), []);

  // Restore persisted filters (web: scoped storage key food-under-250-filters).
  useEffect(() => {
    let cancelled = false;
    store.get(KEYS.under250Filters).then((stored) => {
      if (cancelled) return;
      if (stored) {
        const f = normalizeFilters(stored);
        setSelectedSort(f.selectedSort);
        setDraftSelectedSort(f.selectedSort);
        setActiveCategory(f.activeCategory);
        setUnder30MinsFilter(f.under30MinsFilter);
      }
      filtersRestoredRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!filtersRestoredRef.current) return;
    if (!selectedSort && !activeCategory && !under30MinsFilter) {
      store.remove(KEYS.under250Filters);
      return;
    }
    store.set(KEYS.under250Filters, { selectedSort, activeCategory, under30MinsFilter });
  }, [selectedSort, activeCategory, under30MinsFilter]);

  const handleClearAll = () => {
    setSelectedSort(null);
    setDraftSelectedSort(null);
    setUnder30MinsFilter(false);
    setActiveCategory(null);
    store.remove(KEYS.under250Filters);
  };

  const handleApply = () => {
    setSelectedSort(draftSelectedSort);
    setShowSortPopup(false);
  };

  const switchTimerRef = useRef(null);
  const handleCategorySwitch = useCallback((categoryId) => {
    setIsSwitchingCategory(true);
    setActiveCategory(categoryId);
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    switchTimerRef.current = setTimeout(() => setIsSwitchingCategory(false), 400);
  }, []);
  useEffect(() => () => switchTimerRef.current && clearTimeout(switchTimerRef.current), []);

  const sortedAndFilteredRestaurants = useMemo(() => {
    let filtered = under250Restaurants.map((r) => ({ ...r, menuItems: [...(r.menuItems || [])] }));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered
        .map((restaurant) => {
          const matchRestaurant = restaurant.name.toLowerCase().includes(query);
          const matchingDishes = restaurant.menuItems.filter(
            (item) =>
              item.name.toLowerCase().includes(query) ||
              (item.description && item.description.toLowerCase().includes(query)) ||
              (item.category && item.category.toLowerCase().includes(query)),
          );
          if (matchRestaurant) return restaurant;
          if (matchingDishes.length > 0) return { ...restaurant, menuItems: matchingDishes };
          return null;
        })
        .filter(Boolean);
    }

    if (activeCategory) {
      const selectedCat = categories.find((cat) => cat.id === activeCategory);
      if (selectedCat) {
        const catNameLower = selectedCat.name.toLowerCase();
        filtered = filtered
          .map((restaurant) => {
            const matches = restaurant.menuItems.filter(
              (item) =>
                (item.category || "").toLowerCase() === catNameLower ||
                (item.sectionName || "").toLowerCase() === catNameLower ||
                (item.subsectionName || "").toLowerCase() === catNameLower,
            );
            return matches.length > 0 ? { ...restaurant, menuItems: matches } : null;
          })
          .filter(Boolean);
      }
    }

    if (under30MinsFilter) {
      filtered = filtered.filter((restaurant) => parseDeliveryTime(restaurant.deliveryTime) <= 30);
    }

    if (selectedSort === "rating-high") {
      filtered.sort((a, b) => {
        const ra = a.rating || 0;
        const rb = b.rating || 0;
        if (rb !== ra) return rb - ra;
        return (b.menuItems?.length || 0) - (a.menuItems?.length || 0);
      });
    } else if (selectedSort === "delivery-time-low") {
      filtered.sort((a, b) => {
        const ta = parseDeliveryTime(a.deliveryTime);
        const tb = parseDeliveryTime(b.deliveryTime);
        if (ta !== tb) return ta - tb;
        if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
        return (a.originalIndex || 0) - (b.originalIndex || 0);
      });
    } else if (selectedSort === "distance-low") {
      filtered.sort((a, b) => {
        const da = Number.isFinite(a.distanceInKm) ? a.distanceInKm : parseDistance(a.distance);
        const db = Number.isFinite(b.distanceInKm) ? b.distanceInKm : parseDistance(b.distance);
        if (da !== db) return da - db;
        if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
        return (a.originalIndex || 0) - (b.originalIndex || 0);
      });
    }
    return filtered;
  }, [under250Restaurants, selectedSort, under30MinsFilter, activeCategory, categories, searchQuery]);

  // Banners.
  useEffect(() => {
    if (pageCache.zoneId === zoneId && pageCache.bannerImages?.length > 0) {
      setBannerImages(pageCache.bannerImages);
      setLoadingBanner(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingBanner(true);
    getUnder250Banners(zoneId)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data;
        const list = Array.isArray(data?.banners) ? data.banners : Array.isArray(data) ? data : [];
        const images = list.map((b) => (typeof b?.imageUrl === "string" ? b.imageUrl.trim() : "")).filter(Boolean);
        setBannerImages(images);
        pageCache.bannerImages = images;
        pageCache.zoneId = zoneId;
      })
      .catch(() => {
        if (!cancelled) setBannerImages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBanner(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  // Dynamic price limit from landing settings.
  useEffect(() => {
    let cancelled = false;
    getPublicLandingSettings(zoneId)
      .then((settings) => {
        if (cancelled || !settings) return;
        if (typeof settings.under250PriceLimit === "number") setUnder250PriceLimit(settings.under250PriceLimit);
      })
      .catch(() => setUnder250PriceLimit(250));
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  // 1. Raw restaurant list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRestaurants(true);
        const params = zoneId ? { zoneId } : {};
        const loc = locationRef.current;
        if (loc?.latitude && loc?.longitude) {
          params.lat = loc.latitude;
          params.lng = loc.longitude;
        }
        const response = await getRestaurants(params);
        const restaurantsRaw = Array.isArray(response?.data?.restaurants) ? response.data.restaurants : [];
        if (!cancelled) {
          setAllRawRestaurants(restaurantsRaw);
          setVisibleRestaurantCount(5);
          setUnder250Restaurants([]);
          fetchedIdsRef.current.clear();
          setHasMore(restaurantsRaw.length > 0);
          pageCache.allRawRestaurants = restaurantsRaw;
          pageCache.visibleRestaurantCount = 5;
          pageCache.under250Restaurants = [];
          pageCache.fetchedIds = new Set();
          pageCache.hasMore = restaurantsRaw.length > 0;
          pageCache.zoneId = zoneId;
        }
      } catch {
        if (!cancelled) setAllRawRestaurants([]);
      } finally {
        if (!cancelled) setLoadingRestaurants(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId, isOutOfService]);

  // 2. Menus for the visible chunk.
  const userLat = location?.latitude;
  const userLng = location?.longitude;
  useEffect(() => {
    if (allRawRestaurants.length === 0 || visibleRestaurantCount === 0) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const targetSlice = allRawRestaurants.slice(0, visibleRestaurantCount);
        const toFetch = targetSlice.filter((r) => {
          const rId = String(r?.restaurantId || r?._id);
          return rId && !fetchedIdsRef.current.has(rId);
        });
        if (toFetch.length === 0) {
          if (!cancelled) {
            setHasMore(visibleRestaurantCount < allRawRestaurants.length);
            setLoadingMore(false);
          }
          return;
        }
        if (!cancelled) setLoadingMore(true);
        const uLat = Number(userLat);
        const uLng = Number(userLng);

        const results = await Promise.all(
          toFetch.map(async (restaurant) => {
            const restaurantId = restaurant?.restaurantId || restaurant?._id;
            if (!restaurantId) return null;
            try {
              const menuResponse = await getMenuByRestaurantId(restaurantId);
              const menu = getMenuFromResponse(menuResponse);
              const menuItems = flattenMenuItems(menu)
                .filter((item) => Number(item?.price || 0) <= under250PriceLimit && item?.isAvailable !== false)
                .map((item) => {
                  const foodType = String(item?.foodType || "").toLowerCase();
                  return {
                    ...item,
                    id: String(item?.id || item?._id || `${restaurantId}-${item?.name || "dish"}`),
                    price: Number(item?.price || 0),
                    isVeg: foodType.includes("veg") && !foodType.includes("non"),
                    image:
                      item?.image ||
                      restaurant?.coverImages?.[0]?.url ||
                      restaurant?.coverImages?.[0] ||
                      restaurant?.menuImages?.[0]?.url ||
                      restaurant?.menuImages?.[0] ||
                      restaurant?.profileImage?.url ||
                      "",
                  };
                });
              if (menuItems.length === 0) return null;

              const deliveryMinutes =
                Number(restaurant?.estimatedDeliveryTimeMinutes) || Number(restaurant?.estimatedDeliveryTime) || null;
              const rl = restaurant?.location;
              const rLat = Number(rl?.latitude ?? (Array.isArray(rl?.coordinates) ? rl.coordinates[1] : null));
              const rLng = Number(rl?.longitude ?? (Array.isArray(rl?.coordinates) ? rl.coordinates[0] : null));
              const canCompute = [uLat, uLng, rLat, rLng].every(Number.isFinite) && uLat && uLng && rLat && rLng;
              const distanceInKm =
                restaurant?.distanceInKm !== undefined ? restaurant.distanceInKm : canCompute ? calculateDistanceKm(uLat, uLng, rLat, rLng) : null;
              const fallbackDistance =
                typeof restaurant?.distance === "number"
                  ? formatDistanceKm(restaurant.distance)
                  : restaurant?.distanceText || restaurant?.distance || "";

              return {
                id: String(restaurantId),
                restaurantId: String(restaurantId),
                slug:
                  restaurant?.slug ||
                  String(restaurant?.restaurantName || restaurant?.name || "")
                    .toLowerCase()
                    .replace(/\s+/g, "-"),
                name: restaurant?.restaurantName || restaurant?.name || "Restaurant",
                rating: Number(restaurant?.rating || 0),
                totalRatings: Number(restaurant?.totalRatings || restaurant?.ratingCount || 0),
                deliveryTime: restaurant?.estimatedDeliveryTime || (deliveryMinutes ? `${deliveryMinutes} mins` : "30 mins"),
                distance:
                  restaurant?.distanceText ||
                  (distanceInKm !== null && distanceInKm !== undefined ? formatDistanceKm(distanceInKm) : fallbackDistance),
                distanceInKm,
                distanceText: restaurant?.distanceText || null,
                distanceInfo: restaurant?.distanceInfo || null,
                discount: restaurant?.discount || 0,
                itemDiscounts: Array.isArray(restaurant?.itemDiscounts) ? restaurant.itemDiscounts : [],
                discountRules: Array.isArray(restaurant?.discountRules) ? restaurant.discountRules : [],
                isActive: restaurant?.isActive !== false,
                isAcceptingOrders: restaurant?.isAcceptingOrders !== false,
                openDays: Array.isArray(restaurant?.openDays) ? restaurant.openDays : [],
                outletTimings: restaurant?.outletTimings || null,
                deliveryTimings: restaurant?.deliveryTimings || null,
                openingTime: restaurant?.openingTime || restaurant?.deliveryTimings?.openingTime || null,
                closingTime: restaurant?.closingTime || restaurant?.deliveryTimings?.closingTime || null,
                originalIndex: allRawRestaurants.findIndex((r) => String(r?.restaurantId || r?._id) === String(restaurantId)),
                menuItems,
              };
            } catch {
              return null;
            }
          }),
        );

        if (!cancelled) {
          const valid = results.filter(Boolean);
          toFetch.forEach((r) => fetchedIdsRef.current.add(String(r?.restaurantId || r?._id)));
          setUnder250Restaurants((prev) => {
            const updated = [...prev, ...valid];
            pageCache.under250Restaurants = updated;
            return updated;
          });
          const more = visibleRestaurantCount < allRawRestaurants.length;
          setHasMore(more);
          pageCache.visibleRestaurantCount = visibleRestaurantCount;
          pageCache.hasMore = more;
          pageCache.fetchedIds = new Set(fetchedIdsRef.current);
          pageCache.zoneId = zoneId;
        }
      } finally {
        if (!cancelled) setLoadingMore(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allRawRestaurants, visibleRestaurantCount, userLat, userLng, under250PriceLimit, zoneId]);

  // 3. Infinite scroll (web IntersectionObserver on a sentinel 200px before the end).
  const canLoadMore = hasMore && !loadingMore && !loadingRestaurants && !isSwitchingCategory;
  const loadMore = useCallback(() => {
    if (canLoadMore) setVisibleRestaurantCount((prev) => prev + 5);
  }, [canLoadMore]);
  const isNearEnd = () => {
    const { y, contentH, layoutH } = metricsRef.current;
    return layoutH > 0 && contentH - (y + layoutH) < 200;
  };
  // The sentinel stays visible when a chunk adds nothing, so the web keeps loading; re-check here.
  useEffect(() => {
    if (canLoadMore && isNearEnd()) loadMore();
  }, [canLoadMore, loadMore]);

  // Categories.
  useEffect(() => {
    if (pageCache.zoneId === zoneId && pageCache.categories?.length > 0) {
      setCategories(pageCache.categories);
      setLoadingCategories(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingCategories(true);
        const payload = (await getPublicCategories(zoneId || null)) || {};
        const raw = Array.isArray(payload?.categories) ? payload.categories : Array.isArray(payload) ? payload : [];
        const mapped = raw
          .map((cat, index) => {
            const name = String(cat?.name || "").trim();
            if (!name) return null;
            return {
              id: String(cat?.id || cat?._id || cat?.slug || `cat-${index}`),
              name,
              slug: String(cat?.slug || name.toLowerCase().replace(/\s+/g, "-")),
              image: cat?.imageUrl || cat?.image || cat?.icon || "",
            };
          })
          .filter(Boolean);
        if (!cancelled) {
          setCategories(mapped);
          pageCache.categories = mapped;
          pageCache.zoneId = zoneId;
        }
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const quantities = useMemo(() => {
    const q = {};
    cart.forEach((item) => {
      q[item.id] = item.quantity || 0;
    });
    return q;
  }, [cart]);

  // Keep the sheet's stepper in sync with the cart while it is open.
  const selectedQty = selectedItem ? quantities[selectedItem.id] || 0 : 0;
  useEffect(() => {
    if (showItemDetail && selectedQty > 0) setItemDetailQuantity(selectedQty);
  }, [selectedQty, showItemDetail]);

  const updateItemQuantity = (item, newQuantity, sourcePosition = null, restaurantName = null) => {
    if (!isAuthenticated) {
      toast.error("Please login to add items to cart");
      router.push({ pathname: "/login", params: { from: "/under-250" } });
      return;
    }
    if (isOutOfService) {
      toast.error(serviceUnavailableMessage || "Service is currently unavailable.");
      return;
    }
    const restaurant = restaurantName || item.restaurant || "Under 250";
    const restaurantObj = under250Restaurants.find((r) => r.menuItems?.some((m) => m.id === item.id));
    const discountPercentage = getUnder250DiscountPercent(restaurantObj, item);
    const finalPrice = discountPercentage > 0 ? Math.round(item.price * (1 - discountPercentage / 100)) : item.price;
    const cartItem = {
      id: item.id,
      name: item.name,
      price: finalPrice,
      image: item.image,
      restaurant,
      description: item.description || "",
      originalPrice: item.originalPrice || item.price,
      priceOnOtherPlatforms: item.priceOnOtherPlatforms || null,
      otherPlatformGst: item.otherPlatformGst ?? null,
      isVeg: item.isVeg,
      foodType: item.foodType,
    };
    const source = sourcePosition ? { ...sourcePosition, itemId: item.id } : null;
    const productInfo = { id: item.id, name: item.name, imageUrl: item.image };

    if (newQuantity <= 0) {
      removeFromCart(item.id, source, productInfo);
      return;
    }
    const existing = getCartItem(item.id);
    if (existing) {
      if (newQuantity > existing.quantity && source) {
        const result = addToCart(cartItem, source);
        if (result?.ok === false) {
          toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
          return;
        }
        if (newQuantity > existing.quantity + 1) updateQuantity(item.id, newQuantity);
      } else if (newQuantity < existing.quantity && source) {
        updateQuantity(item.id, newQuantity, source, productInfo);
      } else {
        updateQuantity(item.id, newQuantity);
      }
    } else {
      const result = addToCart(cartItem, source);
      if (result?.ok === false) {
        toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
        return;
      }
      if (newQuantity > 1) updateQuantity(item.id, newQuantity);
    }
  };

  const closeItemDetail = useCallback(() => {
    setShowItemDetail(false);
    setShowShareOptions(false);
  }, []);

  const handleItemClick = useCallback(
    (item, restaurant) => {
      const withRestaurant = {
        ...item,
        restaurant: restaurant.name,
        restaurantSlug: restaurant.slug || restaurant.restaurantId || "",
        description: item.description || `${item.name} from ${restaurant.name}`,
        customisable: item.customisable || false,
        notEligibleForCoupons: item.notEligibleForCoupons || false,
      };
      const existing = quantities[item.id] || 0;
      setItemDetailQuantity(existing > 0 ? existing : 1);
      setSelectedItem(withRestaurant);
      setShowShareOptions(false);
      setShowItemDetail(true);
    },
    [quantities],
  );

  const handleBookmarkClick = (itemId) =>
    setBookmarkedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  const buildShare = (item) => {
    const itemId = item.id || item._id;
    const slug = item.restaurantSlug || item.slug || "";
    const url = slug
      ? `${WEB_ORIGIN}/user/restaurants/${slug}${itemId ? `?dish=${encodeURIComponent(itemId)}` : ""}`
      : `${WEB_ORIGIN}/food/user/under-250`;
    const text = `Check out ${item.name || "this dish"} from ${item.restaurant || "Under 250"}`;
    return { url, text };
  };

  // Web: navigator.share, falling back to the "Share dish" options sheet.
  const handleShareItem = async (item) => {
    if (!item) return;
    const { url, text } = buildShare(item);
    try {
      await Share.share({ title: item.name || "Dish", message: `${text} ${url}`, url });
      return;
    } catch {
      setShowShareOptions(true);
    }
  };

  const handleShareOption = async (type) => {
    if (!selectedItem) return;
    const { url, text } = buildShare(selectedItem);
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(`${text} ${url}`);
    try {
      if (type === "copy") {
        await Clipboard.setStringAsync(url);
        toast.success("Link copied to clipboard!");
      } else if (type === "whatsapp") {
        await Linking.openURL(`https://wa.me/?text=${encodedText}`);
      } else if (type === "telegram") {
        await Linking.openURL(`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(text)}`);
      } else if (type === "sms") {
        await Linking.openURL(`sms:?&body=${encodedText}`);
      } else if (type === "email") {
        await Linking.openURL(`mailto:?subject=${encodeURIComponent(selectedItem.name || "Dish")}&body=${encodedText}`);
      }
      setShowShareOptions(false);
    } catch {
      toast.error("Failed to share link");
    }
  };

  const handleAddItem = async () => {
    if (isOutOfService || !selectedItem) return;
    const pos = await measureSourcePosition(addButtonRef);
    updateItemQuantity(selectedItem, itemDetailQuantity, pos);
    closeItemDetail();
  };

  const selectedPriceInfo = useMemo(() => {
    if (!selectedItem) return { price: 0, strike: null };
    const restaurant = under250Restaurants.find((r) => r.menuItems?.some((m) => m.id === selectedItem.id));
    if (restaurant?.discount > 0) {
      return {
        strike: Math.round(selectedItem.price),
        price: Math.round(selectedItem.price * (1 - restaurant.discount / 100)),
      };
    }
    if (selectedItem.originalPrice && selectedItem.originalPrice > selectedItem.price) {
      return { strike: Math.round(selectedItem.originalPrice), price: Math.round(selectedItem.price) };
    }
    return { strike: null, price: Math.round(selectedItem.price) };
  }, [selectedItem, under250Restaurants]);

  const onViewItems = useCallback((restaurant) => {
    const slug = restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, "-");
    router.push({ pathname: "/restaurants/[slug]", params: { slug, under250: "true" } });
  }, []);
  const onViewCart = useCallback(() => router.push("/cart"), []);

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate("/");
  };

  const showSkeleton = loadingRestaurants || isSwitchingCategory;
  const rows = useMemo(() => {
    const head = [{ key: "banner" }, { key: "chips" }, { key: "filters" }];
    if (showSkeleton) return [...head, { key: "skeleton" }];
    if (sortedAndFilteredRestaurants.length === 0) return [...head, { key: "empty" }];
    return [...head, ...sortedAndFilteredRestaurants.map((r) => ({ key: `r-${r.id}`, restaurant: r }))];
  }, [showSkeleton, sortedAndFilteredRestaurants]);

  const sortLabel = selectedSort ? UNDER250_SORT_OPTIONS.find((o) => o.id === selectedSort)?.label : "Sort";

  const renderRow = ({ item, index }) => {
    const padTop = index === HEADER_ROWS ? 16 : 0;
    switch (item.key) {
      case "banner":
        return (
          <Under250Banner
            images={bannerImages}
            loading={loadingBanner}
            onBack={onBack}
            showSearch={showSearch}
            onOpenSearch={() => setShowSearch(true)}
            onCloseSearch={() => {
              setShowSearch(false);
              setSearchQuery("");
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        );
      case "chips":
        return (
          <Under250CategoryChips
            categories={categories}
            loading={loadingCategories}
            activeCategory={activeCategory}
            onSelect={handleCategorySwitch}
          />
        );
      case "filters":
        return (
          <Under250FilterRow
            sortLabel={sortLabel}
            onOpenSort={() => {
              setDraftSelectedSort(selectedSort);
              setShowSortPopup(true);
            }}
            under30={under30MinsFilter}
            onToggleUnder30={() => setUnder30MinsFilter((v) => !v)}
          />
        );
      case "skeleton":
        return (
          <View style={{ paddingHorizontal: 12, paddingTop: padTop }}>
            <Under250Skeleton />
          </View>
        );
      case "empty":
        return (
          <View style={{ paddingHorizontal: 12, paddingTop: padTop, paddingVertical: 48, alignItems: "center" }}>
            <Text style={{ color: isDark ? tw.gray400 : tw.gray500 }}>
              {under250Restaurants.length === 0
                ? `No restaurants with dishes under ${RUPEE}${under250PriceLimit} found.`
                : "No restaurants match the selected filters."}
            </Text>
          </View>
        );
      default: {
        const availability = getRestaurantAvailabilityStatus(item.restaurant);
        return (
          <View style={{ paddingHorizontal: 12, paddingTop: padTop }}>
            <Under250RestaurantSection
              restaurant={item.restaurant}
              isClosed={!availability.isOpen}
              quantities={quantities}
              onItemPress={handleItemClick}
              onViewCart={onViewCart}
              onViewItems={onViewItems}
            />
          </View>
        );
      }
    }
  };

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
      <View style={{ flex: 1, opacity: isOutOfService ? 0.75 : 1 }}>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          stickyHeaderIndices={[1]}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          scrollEventThrottle={50}
          onLayout={(e) => {
            metricsRef.current.layoutH = e.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_, h) => {
            metricsRef.current.contentH = h;
          }}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            metricsRef.current.y = y;
            const diff = Math.abs(y - lastScrollYRef.current);
            if (diff >= 5) {
              if (y > lastScrollYRef.current) setCartBottomWeb(72);
              else if (y < lastScrollYRef.current) setCartBottomWeb(92);
              lastScrollYRef.current = y;
            }
          }}
          onEndReachedThreshold={0.3}
          onEndReached={loadMore}
          ListFooterComponent={
            <>
              {loadingMore ? (
                <View style={{ paddingVertical: 32, alignItems: "center" }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : null}
              <View style={{ height: 16 }} />
            </>
          }
          initialNumToRender={6}
          windowSize={7}
        />
      </View>

      <SortSheet
        visible={showSortPopup}
        onClose={() => setShowSortPopup(false)}
        draft={draftSelectedSort}
        setDraft={setDraftSelectedSort}
        onClearAll={handleClearAll}
        onApply={handleApply}
      />
      <ItemDetailSheet
        visible={showItemDetail && !!selectedItem}
        item={selectedItem}
        onClose={closeItemDetail}
        bookmarked={selectedItem ? bookmarkedItems.has(selectedItem.id) : false}
        onToggleBookmark={() => selectedItem && handleBookmarkClick(selectedItem.id)}
        onShare={() => handleShareItem(selectedItem)}
        quantity={itemDetailQuantity}
        setQuantity={setItemDetailQuantity}
        disabled={isOutOfService}
        priceInfo={selectedPriceInfo}
        onAdd={handleAddItem}
        addButtonRef={addButtonRef}
      />
      <ShareOptionsSheet visible={showShareOptions && !!selectedItem} onClose={() => setShowShareOptions(false)} onSelect={handleShareOption} />

      {showScanAnimation ? <MenuScanAnimation duration={2200} onComplete={onScanComplete} /> : null}
      {!showScanAnimation ? <AddToCartAnimation bottom={cartBottom} /> : null}
    </Screen>
  );
}
