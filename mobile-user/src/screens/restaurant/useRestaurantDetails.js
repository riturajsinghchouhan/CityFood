// Data loading of RestaurantDetails.jsx: restaurant by slug/id (with the name-search
// fallback), outlet timings, menu (normalized sections) and the previous-order check
// that adds the "Recommended for you" section.
import { useEffect, useRef, useState } from "react";
import { getMenuByRestaurantId, getOrders, getOutletTimingsByRestaurantId, getRestaurantById, getRestaurants } from "../../api";
import { useAuth } from "../../context/AuthContext";
import useLatest from "../../hooks/useLatest";
import {
  extractImages,
  formatRestaurantAddress,
  getFoodDisplayPrice,
  getFoodVariants,
  isRecommendedItem,
  normalizeImageUrl,
} from "./lib";

const categoryFromArray = (list) => {
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") return first.name || first.label || first.title || null;
  return null;
};

function transformRestaurant(apiRestaurant, slug) {
  const actual = apiRestaurant?.restaurant || apiRestaurant;
  const a = actual || {};
  const b = apiRestaurant || {};
  const locationObj = a.location || b.location;
  const topCategory =
    a.topCategory ||
    b.topCategory ||
    categoryFromArray(a.topCategories) ||
    categoryFromArray(b.topCategories) ||
    categoryFromArray(a.cuisines) ||
    categoryFromArray(b.cuisines) ||
    categoryFromArray(a.categories) ||
    categoryFromArray(b.categories) ||
    a.cuisine ||
    b.cuisine ||
    a.category ||
    b.category ||
    "Multi-cuisine";
  const step2 = a.onboarding?.step2 || b.onboarding?.step2 || {};
  const step4 = a.onboarding?.step4 || b.onboarding?.step4 || {};
  const profileImage = a.profileImage || b.profileImage || step2?.profileImageUrl || null;
  const coverImages =
    Array.isArray(a.coverImages) && a.coverImages.length > 0
      ? a.coverImages
      : Array.isArray(b.coverImages) && b.coverImages.length > 0
        ? b.coverImages
        : [];
  const menuImages =
    Array.isArray(a.menuImages) && a.menuImages.length > 0
      ? a.menuImages
      : Array.isArray(b.menuImages) && b.menuImages.length > 0
        ? b.menuImages
        : Array.isArray(step2?.menuImageUrls)
          ? step2.menuImageUrls
          : [];
  const restaurantOffers = a.restaurantOffers || b.restaurantOffers || {};
  const name = a.name || a.restaurantName || b.name || b.restaurantName || "Unknown Restaurant";

  return {
    id: a.restaurantId || a._id || a.id || b.restaurantId || b._id || null,
    mongoId: a._id || b._id || null,
    name,
    cuisine: topCategory,
    topCategory,
    rating: a.rating || b.rating || a.averageRating || b.averageRating || null,
    reviews: a.totalRatings || b.totalRatings || a.reviewCount || b.reviewCount || a.reviews?.length || b.reviews?.length || 0,
    deliveryTime:
      a.estimatedDeliveryTime || b.estimatedDeliveryTime || a.deliveryTime || b.deliveryTime || a.avgDeliveryTime || b.avgDeliveryTime || "25-30 mins",
    fallbackDistance: a.distance || b.distance || a.distanceFromUser || b.distanceFromUser || "1.2 km",
    location: formatRestaurantAddress(locationObj),
    locationObject: locationObj,
    image:
      coverImages?.[0]?.url ||
      coverImages?.[0] ||
      profileImage?.url ||
      profileImage ||
      (menuImages.length > 0 ? menuImages[0]?.url || menuImages[0] : null) ||
      a.image ||
      b.image ||
      null,
    priceRange: a.priceRange || b.priceRange || step4?.priceRange || "$$",
    offers: Array.isArray(a.offers) ? a.offers : Array.isArray(b.offers) ? b.offers : [],
    offerText: a.offer || b.offer || step4?.offer || "",
    restaurantOffers: {
      coupons: Array.isArray(restaurantOffers?.coupons) ? restaurantOffers.coupons : [],
    },
    slug: a.slug || b.slug || a.name?.toLowerCase().replace(/\s+/g, "-") || b.name?.toLowerCase().replace(/\s+/g, "-") || slug || "unknown",
    restaurantId: a.restaurantId || a._id || a.id || b.restaurantId || b._id || b.id || null,
    openDays: Array.isArray(a.openDays)
      ? a.openDays
      : Array.isArray(b.openDays)
        ? b.openDays
        : Array.isArray(step2?.openDays)
          ? step2.openDays
          : [],
    deliveryTimings: a.deliveryTimings ||
      b.deliveryTimings || {
        openingTime: a.openingTime || b.openingTime || step2?.deliveryTimings?.openingTime || "09:00",
        closingTime: a.closingTime || b.closingTime || step2?.deliveryTimings?.closingTime || "22:00",
      },
    outletTimings: a.outletTimings || b.outletTimings || null,
    profileImage,
    coverImages,
    menuImages,
    menuSections: [],
    onboarding: a.onboarding || b.onboarding || null,
    isActive: a.isActive !== false,
    isAcceptingOrders: a.isAcceptingOrders !== false,
    discount: a.discount || b.discount || 0,
    itemDiscounts: Array.isArray(a.itemDiscounts) ? a.itemDiscounts : Array.isArray(b.itemDiscounts) ? b.itemDiscounts : [],
    discountRules: Array.isArray(a.discountRules) ? a.discountRules : Array.isArray(b.discountRules) ? b.discountRules : [],
    distanceText: b.distanceText || a.distanceText || null,
    distanceInfo: b.distanceInfo || a.distanceInfo || null,
  };
}

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.values(value).filter((entry) => entry && typeof entry === "object");
};

const resolveItemImage = (item = {}) =>
  extractImages([
    item.image,
    item.imageUrl,
    item.photo,
    item.photoUrl,
    item.menuImage,
    item.menuImageUrl,
    item.images,
    item.photos,
    item.gallery,
    item.image?.url,
    item.image?.secure_url,
  ])[0] || "";

let fallbackSeq = 0;

const normalizeItem = (item = {}) => {
  const isRecommended = item.isRecommended === true || item.isRecommended === 1 || String(item.isRecommended) === "true";
  const isSpicy = item.isSpicy === true || item.isSpicy === 1 || String(item.isSpicy) === "true";
  let foodType = item.foodType || "Non-Veg";
  if (typeof foodType === "string") {
    if (foodType.toLowerCase() === "veg") foodType = "Veg";
    else if (foodType.toLowerCase() === "non-veg" || foodType.toLowerCase() === "nonveg") foodType = "Non-Veg";
  }
  fallbackSeq += 1;
  return {
    ...item,
    id: String(item.id || item._id || `${Date.now()}-${fallbackSeq}`),
    name: item.name || "Unnamed Item",
    foodType,
    isVeg: foodType === "Veg",
    price: getFoodDisplayPrice(item),
    image: resolveItemImage(item) || normalizeImageUrl(typeof item.image === "string" ? item.image : ""),
    variants: getFoodVariants(item),
    variations: getFoodVariants(item),
    isAvailable: item.isAvailable !== false,
    isRecommended,
    isSpicy,
    description: typeof item.description === "string" ? item.description : "",
  };
};

function buildMenuSections(rawSections) {
  return toArray(rawSections).map((section, sIndex) => ({
    ...section,
    id: String(section.id || section._id || `section-${sIndex}`),
    name: section.name || section.title || "Unnamed Section",
    items: toArray(section.items).map(normalizeItem),
    subsections: toArray(section.subsections).map((sub, subIndex) => ({
      ...sub,
      id: String(sub.id || sub._id || `subsection-${sIndex}-${subIndex}`),
      name: sub.name || "Unnamed Subsection",
      items: toArray(sub.items).map(normalizeItem),
    })),
  }));
}

const allMenuItems = (sections) => {
  const out = [];
  sections.forEach((s) => {
    if (s.items) out.push(...s.items);
    (s.subsections || []).forEach((ss) => ss.items && out.push(...ss.items));
  });
  return out;
};

export default function useRestaurantDetails({ slug, zoneId, userLocation, targetDishId }) {
  const { isAuthenticated } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);
  const [restaurantError, setRestaurantError] = useState(null);
  const [loadingMenuItems, setLoadingMenuItems] = useState(true);
  const [menuUnavailable, setMenuUnavailable] = useState(false);
  const [menuVersion, setMenuVersion] = useState(0);
  const fetchedRef = useRef({ done: false, slug: null, zoneId: null });
  const latest = useLatest({ userLocation, isAuthenticated, targetDishId, restaurant });

  useEffect(() => {
    let cancelled = false;
    const state = fetchedRef.current;
    if (state.done && (state.slug !== slug || state.zoneId !== zoneId)) {
      fetchedRef.current = { done: false, slug: null, zoneId: null };
    }

    const run = async () => {
      if (!slug) return;
      const { userLocation: loc, isAuthenticated: authed, targetDishId: dishId, restaurant: current } = latest.current;
      // Don't refetch for the same slug and zone; keep the rendered page on background retries.
      if (fetchedRef.current.done && fetchedRef.current.slug === slug && fetchedRef.current.zoneId === zoneId && current) return;

      try {
        setLoadingRestaurant(!fetchedRef.current.done && !current);
        setRestaurantError(null);

        const config = {};
        if (Number.isFinite(loc?.latitude) && Number.isFinite(loc?.longitude)) {
          config.params = { lat: loc.latitude, lng: loc.longitude };
        }

        let apiRestaurant = null;
        try {
          const res = await getRestaurantById(slug, config);
          if (res?.success && res?.data) apiRestaurant = res.data;
        } catch {
          // Direct lookup failed: search by name, with and without the zone.
          const variants = zoneId
            ? [{ limit: 100, zoneId, _ts: Date.now() }, { limit: 100, _ts: Date.now() }]
            : [{ limit: 100, _ts: Date.now() }];
          for (const params of variants) {
            try {
              const searchRes = await getRestaurants(params, { noCache: true });
              const list = searchRes?.data?.restaurants || (Array.isArray(searchRes?.data) ? searchRes.data : []);
              const nameFromSlug = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
              const match = list.find(
                (r) =>
                  r.slug === slug ||
                  r.name?.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase() ||
                  r.name?.toLowerCase() === nameFromSlug.toLowerCase(),
              );
              if (match) {
                const full = await getRestaurantById(match._id || match.restaurantId, config);
                if (full?.success && full?.data) {
                  apiRestaurant = full.data;
                  break;
                }
              }
            } catch {
              // try the next variant
            }
          }
        }
        if (cancelled) return;

        if (!apiRestaurant) {
          if (!fetchedRef.current.done) {
            setRestaurantError("Restaurant not found");
            setRestaurant(null);
          }
          return;
        }

        const actual = apiRestaurant?.restaurant || apiRestaurant;
        const transformed = transformRestaurant(apiRestaurant, slug);
        setRestaurant(transformed);
        fetchedRef.current = { done: true, slug, zoneId };

        const outletId = transformed.mongoId || actual?._id || apiRestaurant?._id;
        if (outletId) {
          getOutletTimingsByRestaurantId(outletId)
            .then((res) => {
              const timings = res?.data?.outletTimings;
              if (timings && !cancelled) setRestaurant((prev) => (prev ? { ...prev, outletTimings: timings } : prev));
            })
            .catch(() => {});
        }

        let menuLookupId = transformed.id;
        if (!menuLookupId) {
          try {
            const variants = zoneId
              ? [{ limit: 100, zoneId, _ts: Date.now() }, { limit: 100, _ts: Date.now() }]
              : [{ limit: 100, _ts: Date.now() }];
            for (const params of variants) {
              const searchRes = await getRestaurants(params, { noCache: true });
              const list = searchRes?.data?.restaurants || (Array.isArray(searchRes?.data) ? searchRes.data : []);
              const match = list.find((r) => r.name?.toLowerCase().trim() === transformed.name?.toLowerCase().trim());
              if (match) {
                menuLookupId = match._id || match.restaurantId || match.id;
                setRestaurant((prev) => ({ ...prev, id: menuLookupId, restaurantId: menuLookupId }));
                break;
              }
            }
          } catch {
            // menu lookup falls back to the slug below
          }
        }

        const lookupIds = [
          menuLookupId,
          slug,
          transformed.id,
          transformed.restaurantId,
          transformed.mongoId,
          apiRestaurant?.restaurantId,
          apiRestaurant?._id,
          actual?.restaurantId,
          actual?._id,
          actual?.slug,
        ]
          .filter(Boolean)
          .map((v) => String(v).trim())
          .filter((v, i, arr) => arr.indexOf(v) === i);

        setLoadingMenuItems(true);
        setMenuUnavailable(false);
        if (lookupIds.length === 0) {
          setLoadingMenuItems(false);
          return;
        }

        // As on web, the previous-order check runs alongside the menu request and only
        // counts if it has resolved by the time the menu arrives.
        let hasPreviousOrder = false;
        if (authed) {
          const normalize = (v) => (v ? String(v).trim().toLowerCase() : "");
          const targetName = normalize(transformed.name);
          const targetIds = new Set(
            [...lookupIds, transformed.id, transformed.restaurantId, apiRestaurant?.restaurantId, apiRestaurant?._id, actual?.restaurantId, actual?._id]
              .map(normalize)
              .filter(Boolean),
          );
          getOrders({ limit: 15, page: 1 })
            .then((res) => {
              const orders = res?.data?.orders || (Array.isArray(res?.data) ? res.data : []);
              hasPreviousOrder = orders.some((order) => {
                const field = order?.restaurantId;
                const ids = [order?.restaurantId, field?._id, field?.id, field?.restaurantId, order?.restaurant, order?.restaurant_id]
                  .map(normalize)
                  .filter(Boolean);
                if (ids.some((id) => targetIds.has(id))) return true;
                const names = [order?.restaurantName, field?.name, order?.restaurant?.name].map(normalize).filter(Boolean);
                return !!targetName && names.includes(targetName);
              });
            })
            .catch(() => {});
        }

        try {
          let menuRes = null;
          for (const id of lookupIds) {
            try {
              const res = await getMenuByRestaurantId(id);
              if (res?.success) {
                menuRes = res;
                break;
              }
            } catch (err) {
              if (err?.status !== 404) throw err;
            }
          }
          if (cancelled) return;
          if (!menuRes) {
            setMenuUnavailable(true);
          } else if (menuRes?.data?.menu) {
            const sections = buildMenuSections(menuRes.data.menu.sections || []);
            const menuHasItems = sections.some(
              (s) => (Array.isArray(s.items) && s.items.length > 0) || (s.subsections || []).some((ss) => ss.items?.length > 0),
            );
            const recommended = allMenuItems(sections).filter((item) => isRecommendedItem(item) && item.isAvailable !== false);
            let finalSections = [...sections];
            if (hasPreviousOrder) {
              finalSections = [{ id: "recommended", name: "Recommended for you", items: recommended, subsections: [] }, ...finalSections];
            }
            if (dishId) {
              const matched = allMenuItems(sections).find((item) => String(item.id || item._id || "").trim() === dishId);
              if (matched) {
                finalSections = [
                  { id: "search-result", name: "Result for your search", items: [matched], subsections: [], isSearchResult: true },
                  ...finalSections,
                ];
              }
            }
            setRestaurant((prev) => ({ ...prev, menuSections: finalSections }));
            setMenuUnavailable(!menuHasItems);
            setMenuVersion((v) => v + 1);
          }
        } catch {
          // Non-404 menu errors are only logged on web.
        } finally {
          if (!cancelled) setLoadingMenuItems(false);
        }
      } catch (error) {
        if (cancelled) return;
        if (!fetchedRef.current.done) {
          if (error?.isNetworkError) {
            setRestaurantError("Backend server is not connected. Please make sure the backend is running.");
          } else if (error?.status === 404) {
            setRestaurantError("Restaurant not found");
          } else {
            setRestaurantError(error?.message || "Failed to load restaurant");
          }
          setRestaurant(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingRestaurant(false);
          setLoadingMenuItems(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [slug, zoneId, latest]);

  return { restaurant, loadingRestaurant, restaurantError, loadingMenuItems, menuUnavailable, menuVersion };
}
