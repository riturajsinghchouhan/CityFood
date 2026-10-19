// Home.jsx's data effects: category rail, landing config (explore icons, settings,
// gourmet), hero banners and the filtered restaurant list. A module-level cache keeps
// the last result per zone, as the web's homePageCache did, so returning to the tab is instant.
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useLatest from "../../hooks/useLatest";
import {
  getHeroBanners,
  getMenuByRestaurantId,
  getPublicCategories,
  getPublicExploreIcons,
  getPublicGourmetRestaurants,
  getPublicLandingSettings,
  getRestaurants,
} from "../../api";
import {
  FOOD_FALLBACK_IMAGES,
  buildRestaurantParams,
  categoriesFromMenus,
  isDefaultFilterState,
  normalizeImageUrl,
  recalcDistances,
  roundCoord,
  sortRestaurantsForDisplay,
  transformRestaurant,
} from "./homeUtils";

const homePageCache = {
  effectiveZoneId: null,
  lat: null,
  lng: null,
  landingExploreMore: null,
  landingExploreFetched: false,
  exploreMoreHeading: null,
  recommendedRestaurantIds: null,
  under250PriceLimit: null,
  mealsUnder: null,
  recommendedRestaurantsFromSettings: null,
  festBannerImages: null,
  heroBannerImages: null,
  heroBannersData: null,
  heroBannersFetched: false,
  gourmetRestaurants: null,
  showGourmet: true,
  restaurantsData: null,
};

export const EMPTY_FILTERS = { activeFilters: new Set(), sortBy: null, selectedCuisine: null };

export function useHomeCategories({ zoneId, zoneLoading }) {
  const [realCategories, setRealCategories] = useState([]);
  const [loadingRealCategories, setLoadingRealCategories] = useState(true);

  useEffect(() => {
    if (zoneLoading) return undefined;
    let cancelled = false;
    setLoadingRealCategories(true);
    getPublicCategories(zoneId || null)
      .then((data) => {
        if (cancelled) return;
        const list = data?.categories || (Array.isArray(data) ? data : []);
        const categories = Array.isArray(list)
          ? list.map((cat, idx) => ({
              id: String(cat?.id || cat?._id || cat?.slug || idx),
              name: cat?.name || "",
              slug:
                cat?.slug ||
                String(cat?.name || "")
                  .toLowerCase()
                  .replace(/\s+/g, "-"),
              image:
                normalizeImageUrl(cat?.image || cat?.imageUrl) ||
                FOOD_FALLBACK_IMAGES[idx % FOOD_FALLBACK_IMAGES.length],
              type: cat?.type || "",
            }))
          : [];
        setRealCategories(categories);
      })
      .catch(() => {
        if (!cancelled) setRealCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRealCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zoneId, zoneLoading]);

  return { realCategories, loadingRealCategories };
}

export function useLandingConfig({ zoneId, zoneLoading }) {
  const [state, setState] = useState(() => ({
    landingExploreMore: homePageCache.landingExploreMore || [],
    exploreMoreHeading: homePageCache.exploreMoreHeading || "Explore More",
    recommendedRestaurantIds: homePageCache.recommendedRestaurantIds || [],
    under250PriceLimit: homePageCache.under250PriceLimit || 250,
    mealsUnderConfig: homePageCache.mealsUnder || null,
    recommendedRestaurantsFromSettings: homePageCache.recommendedRestaurantsFromSettings || [],
    festBannerImages: homePageCache.festBannerImages ?? [],
    gourmetRestaurants: homePageCache.gourmetRestaurants || [],
    showGourmetSection: homePageCache.showGourmet ?? true,
  }));
  const [loadingLandingConfig, setLoadingLandingConfig] = useState(() => !homePageCache.landingExploreFetched);

  useEffect(() => {
    if (zoneLoading) return undefined;
    if (homePageCache.landingExploreFetched && homePageCache.effectiveZoneId === zoneId) {
      setLoadingLandingConfig(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingLandingConfig(true);
    Promise.all([
      getPublicExploreIcons(zoneId).catch(() => ({})),
      getPublicLandingSettings(zoneId).catch(() => ({})),
      getPublicGourmetRestaurants(zoneId).catch(() => []),
    ])
      .then(([exploreData, settings, gourmetData]) => {
        if (cancelled) return;
        const items = Array.isArray(exploreData?.items) ? exploreData.items : Array.isArray(exploreData) ? exploreData : [];
        const exploreMoreData = items.map((it) => ({ ...it, imageUrl: it.imageUrl || it.iconUrl, label: it.label || it.name }));
        const settingsData = settings || {};
        const next = {
          landingExploreMore: exploreMoreData,
          exploreMoreHeading: settingsData.exploreMoreHeading || "Explore More",
          recommendedRestaurantIds: settingsData.recommendedRestaurantIds || [],
          under250PriceLimit: Number(settingsData.under250PriceLimit) || 250,
          mealsUnderConfig: settingsData.mealsUnder || null,
          recommendedRestaurantsFromSettings: settingsData.recommendedRestaurants || [],
          festBannerImages: Array.isArray(settingsData.festBannerImages) ? settingsData.festBannerImages : [],
          gourmetRestaurants: Array.isArray(gourmetData) ? gourmetData : [],
          showGourmetSection: settingsData.showGourmet ?? true,
        };
        setState(next);
        Object.assign(homePageCache, {
          landingExploreMore: next.landingExploreMore,
          exploreMoreHeading: next.exploreMoreHeading,
          recommendedRestaurantIds: next.recommendedRestaurantIds,
          under250PriceLimit: next.under250PriceLimit,
          mealsUnder: next.mealsUnderConfig,
          recommendedRestaurantsFromSettings: next.recommendedRestaurantsFromSettings,
          festBannerImages: next.festBannerImages,
          gourmetRestaurants: next.gourmetRestaurants,
          showGourmet: next.showGourmetSection,
          landingExploreFetched: true,
          effectiveZoneId: zoneId,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            landingExploreMore: [],
            exploreMoreHeading: "Explore More",
            recommendedRestaurantsFromSettings: [],
            festBannerImages: [],
            gourmetRestaurants: [],
            showGourmetSection: true,
          }));
        }
        homePageCache.landingExploreFetched = true;
        homePageCache.effectiveZoneId = zoneId;
      })
      .finally(() => {
        if (!cancelled) setLoadingLandingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zoneId, zoneLoading]);

  return { ...state, loadingLandingConfig };
}

export function useHeroBanners({ zoneId, zoneLoading }) {
  const [heroBannerImages, setHeroBannerImages] = useState(() => homePageCache.heroBannerImages ?? []);
  const [heroBannersData, setHeroBannersData] = useState(() => homePageCache.heroBannersData ?? []);
  const [loadingBanners, setLoadingBanners] = useState(() => !homePageCache.heroBannersFetched);

  useEffect(() => {
    if (zoneLoading) return undefined;
    if (homePageCache.heroBannersFetched && homePageCache.effectiveZoneId === zoneId) {
      setLoadingBanners(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingBanners(true);
    getHeroBanners(zoneId)
      .then((response) => {
        if (cancelled) return;
        const data = response?.data;
        const list = Array.isArray(data?.banners) ? data.banners : Array.isArray(data) ? data : [];
        const images = list.map((b) => (b && typeof b.imageUrl === "string" ? b.imageUrl : "")).filter(Boolean);
        setHeroBannerImages(images);
        setHeroBannersData(list);
        Object.assign(homePageCache, {
          heroBannerImages: images,
          heroBannersData: list,
          heroBannersFetched: true,
          effectiveZoneId: zoneId,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setHeroBannerImages([]);
        setHeroBannersData([]);
        Object.assign(homePageCache, {
          heroBannerImages: [],
          heroBannersData: [],
          heroBannersFetched: true,
          effectiveZoneId: zoneId,
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingBanners(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zoneId, zoneLoading]);

  return { heroBannerImages, heroBannersData, loadingBanners };
}

export function useHomeRestaurants({ location, zoneId, zoneLoading }) {
  const [restaurantsData, setRestaurantsData] = useState(() => homePageCache.restaurantsData || []);
  const [loadingRestaurants, setLoadingRestaurants] = useState(() => !homePageCache.restaurantsData);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false);
  const requestSeqRef = useRef(0);

  const lat = location?.latitude !== undefined ? location.latitude : location?.lat;
  const lng = location?.longitude !== undefined ? location.longitude : location?.lng;
  const city = location?.city;

  const fetchRestaurants = useCallback(
    async (filters = {}) => {
      const isDefaultFetch = isDefaultFilterState(filters);
      if (isDefaultFetch && zoneLoading) return;
      if (!zoneId && !city) {
        setLoadingRestaurants(false);
        setRestaurantsData([]);
        return;
      }
      const isLocationSame = homePageCache.lat === roundCoord(lat) && homePageCache.lng === roundCoord(lng);
      if (
        isDefaultFetch &&
        homePageCache.restaurantsData &&
        homePageCache.restaurantsData.length > 0 &&
        homePageCache.effectiveZoneId === zoneId &&
        isLocationSame
      ) {
        setLoadingRestaurants(false);
        return;
      }

      const requestSeq = ++requestSeqRef.current;
      try {
        setLoadingRestaurants(true);
        const params = buildRestaurantParams(filters, { lat, lng, zoneId });
        const response = await getRestaurants(params, { noCache: true });
        if (requestSeq !== requestSeqRef.current) return;
        const restaurantsArray = response?.success ? response?.data?.restaurants : null;
        if (!restaurantsArray) {
          setRestaurantsData([]);
          return;
        }
        if (restaurantsArray.length === 0) {
          setRestaurantsData([]);
          return;
        }
        const transformed = restaurantsArray.map((r) => transformRestaurant(r, lat, lng));
        startTransition(() => {
          const finalSorted = sortRestaurantsForDisplay(transformed, filters.sortBy, Boolean(lat && lng));
          setRestaurantsData(finalSorted);
          if (isDefaultFetch) {
            Object.assign(homePageCache, {
              restaurantsData: finalSorted,
              effectiveZoneId: zoneId,
              lat: roundCoord(lat),
              lng: roundCoord(lng),
            });
          }
        });
      } catch {
        setRestaurantsData([]);
      } finally {
        if (requestSeq === requestSeqRef.current) setLoadingRestaurants(false);
      }
    },
    [lat, lng, city, zoneId, zoneLoading],
  );

  const applyFiltersAndRefetch = useCallback(
    async (nextActiveFilters, nextSortBy, nextSelectedCuisine) => {
      const next = {
        activeFilters: new Set(nextActiveFilters),
        sortBy: nextSortBy,
        selectedCuisine: nextSelectedCuisine,
      };
      setAppliedFilters(next);
      setIsLoadingFilterResults(true);
      try {
        await fetchRestaurants(next);
      } finally {
        setIsLoadingFilterResults(false);
      }
    },
    [fetchRestaurants],
  );

  useEffect(() => {
    fetchRestaurants(appliedFilters);
  }, [appliedFilters, fetchRestaurants]);

  const sortByRef = useLatest(appliedFilters.sortBy);
  useEffect(() => {
    if (!location?.latitude || !location?.longitude) return;
    setRestaurantsData((prev) => recalcDistances(prev, location.latitude, location.longitude, sortByRef.current));
  }, [location?.latitude, location?.longitude, sortByRef]);

  return { restaurantsData, loadingRestaurants, isLoadingFilterResults, applyFiltersAndRefetch };
}

// Category rail fallback: the union of menu sections, fetched only when admin categories are empty.
export function useMenuCategories({ restaurantsData, realCategoriesCount }) {
  const [menuCategories, setMenuCategories] = useState([]);
  const [loadingMenuCategories, setLoadingMenuCategories] = useState(false);
  const seqRef = useRef(0);
  const cacheRef = useRef(new Map());

  const idsKey = useMemo(() => {
    if (!Array.isArray(restaurantsData) || restaurantsData.length === 0) return "";
    return restaurantsData
      .map((r) => String(r?.restaurantId || r?.id || "").trim())
      .filter(Boolean)
      .sort()
      .join(",");
  }, [restaurantsData]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",").filter(Boolean) : [];
    const requestSeq = ++seqRef.current;
    if (!idsKey || realCategoriesCount !== 0) {
      setMenuCategories([]);
      setLoadingMenuCategories(false);
      return;
    }
    setLoadingMenuCategories(true);
    (async () => {
      try {
        const cache = cacheRef.current;
        const menus = [];
        for (let index = 0; index < ids.length; index += 4) {
          const batch = await Promise.all(
            ids.slice(index, index + 4).map(async (id) => {
              if (cache.has(id)) return cache.get(id);
              try {
                const res = await getMenuByRestaurantId(id);
                const menu = res?.data?.menu || null;
                cache.set(id, menu);
                return menu;
              } catch {
                cache.set(id, null);
                return null;
              }
            }),
          );
          if (requestSeq !== seqRef.current) return;
          menus.push(...batch);
        }
        if (requestSeq !== seqRef.current) return;
        setMenuCategories(categoriesFromMenus(menus));
      } finally {
        if (requestSeq === seqRef.current) setLoadingMenuCategories(false);
      }
    })();
  }, [idsKey, realCategoriesCount]);

  return { menuCategories, loadingMenuCategories };
}
