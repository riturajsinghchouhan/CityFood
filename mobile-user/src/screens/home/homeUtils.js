// Pure helpers from Home.jsx: image normalization, the restaurant list transform and
// sort, and the "Recommended For You" / Gourmet / explore-icon mappings.
import { getRestaurantAvailabilityStatus } from "../../components/restaurant-cards";
import { resolveMediaUrl } from "../../components/ui/AppImage";

// Shared stock images (constants/images.js foodImages).
export const FOOD_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400&h=300&fit=crop",
];

export const roundCoord = (value) =>
  Number.isFinite(Number(value)) ? Math.round(Number(value) * 100000) / 100000 : null;

export const slugifyCategory = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function normalizeImageUrl(imageUrl) {
  if (typeof imageUrl !== "string") return "";
  const trimmed = imageUrl
    .trim()
    .replace(/\\/g, "/")
    .replace(/^(https?):\/(?!\/)/i, "$1://")
    .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");
  if (!trimmed) return "";
  const withProtocol = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  return resolveMediaUrl(withProtocol) || "";
}

function extractImageFromValue(value) {
  if (!value) return "";
  if (typeof value === "string") return normalizeImageUrl(value);
  if (typeof value === "object") {
    const candidate =
      value.url ||
      value.secure_url ||
      value.imageUrl ||
      value.imageURL ||
      value.image ||
      value.src ||
      value.path ||
      value.location ||
      value.link ||
      value.href ||
      "";
    return typeof candidate === "string" ? normalizeImageUrl(candidate) : "";
  }
  return "";
}

// De-duplicated, order-preserving list of image URLs. (The web also listed Cloudinary
// f_jpg/f_auto variants of each URL for WebView decoding; AppImage picks the variant here.)
export function extractImages(source) {
  if (!source) return [];
  const list = (Array.isArray(source) ? source : [source]).map(extractImageFromValue).filter(Boolean);
  return list.filter((value, index) => list.indexOf(value) === index);
}

export function getRestaurantDisplayName(restaurant) {
  const candidates = [
    restaurant?.name,
    restaurant?.restaurantName,
    restaurant?.restaurantName?.english,
    restaurant?.restaurantName?.value,
    restaurant?.onboarding?.step1?.restaurantName,
  ];
  const resolved = candidates.find((c) => typeof c === "string" && c.trim().length > 0);
  return resolved ? resolved.trim() : "Restaurant";
}

// Haversine with the web's 1.35 routing multiplier.
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1.35;
}

export const formatDistance = (km) => (km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`);

function restaurantCoords(location) {
  const lat =
    location?.latitude ||
    (location?.coordinates && Array.isArray(location.coordinates) ? location.coordinates[1] : null);
  const lng =
    location?.longitude ||
    (location?.coordinates && Array.isArray(location.coordinates) ? location.coordinates[0] : null);
  return { lat, lng };
}

// Home.jsx fetchRestaurants: API restaurant → card shape.
export function transformRestaurant(restaurant, userLat, userLng) {
  const fallbackDeliveryTime = restaurant.estimatedDeliveryTime || "25-30 mins";
  let distance = restaurant.distance || "1.2 km";
  const { lat: restaurantLat, lng: restaurantLng } = restaurantCoords(restaurant.location);

  let distanceInKm = null;
  if (restaurant.distanceText) {
    distance = restaurant.distanceText;
    distanceInKm = restaurant.distanceInfo?.distanceValue ? restaurant.distanceInfo.distanceValue / 1000 : null;
  } else if (
    userLat &&
    userLng &&
    restaurantLat &&
    restaurantLng &&
    !isNaN(userLat) &&
    !isNaN(userLng) &&
    !isNaN(restaurantLat) &&
    !isNaN(restaurantLng)
  ) {
    distanceInKm = calculateDistance(userLat, userLng, restaurantLat, restaurantLng);
    distance = formatDistance(distanceInKm);
  }

  const cuisine = restaurant.cuisines && restaurant.cuisines.length > 0 ? restaurant.cuisines[0] : "Multi-cuisine";
  // Cards use menu gallery images only; uploads are oldest-first, so show the newest first.
  const menuImages = extractImages(
    (Array.isArray(restaurant.menuImages) ? restaurant.menuImages : [restaurant.menuImages]).filter(Boolean),
  );
  const carouselImages = Array.from(new Set(menuImages)).reverse();

  return {
    id: restaurant.restaurantId || restaurant._id,
    mongoId: restaurant._id || null,
    name: getRestaurantDisplayName(restaurant),
    cuisine,
    cuisines: Array.isArray(restaurant.cuisines) ? restaurant.cuisines : [],
    rating: Number(restaurant.rating) || 0,
    deliveryTime:
      restaurant.deliveryTime ||
      restaurant.estimatedDeliveryTime ||
      (restaurant.estimatedDeliveryTimeMinutes ? `${restaurant.estimatedDeliveryTimeMinutes} mins` : fallbackDeliveryTime),
    distance,
    distanceInKm,
    image: carouselImages[0] || "",
    images: carouselImages,
    priceRange: restaurant.priceRange || "$$",
    featuredDish:
      restaurant.featuredDish ||
      (restaurant.cuisines && restaurant.cuisines.length > 0 ? `${restaurant.cuisines[0]} Special` : "Special Dish"),
    featuredPrice: restaurant.featuredPrice || 249,
    menuItems: restaurant.menu?.sections
      ? restaurant.menu.sections.reduce((acc, section) => acc.concat(section.items || []), [])
      : Array.isArray(restaurant.menuItems)
        ? restaurant.menuItems
        : Array.isArray(restaurant.topItems)
          ? restaurant.topItems
          : [],
    popularItems: Array.isArray(restaurant.popularItems) ? restaurant.popularItems : [],
    itemDiscounts: Array.isArray(restaurant.itemDiscounts) ? restaurant.itemDiscounts : [],
    recommendedItems: Array.isArray(restaurant.recommendedItems) ? restaurant.recommendedItems : [],
    previewItems: Array.isArray(restaurant.previewItems) ? restaurant.previewItems : [],
    offers: Array.isArray(restaurant.offers) ? restaurant.offers : [],
    discountRules: Array.isArray(restaurant.discountRules) ? restaurant.discountRules : [],
    offer: restaurant.offer || null,
    slug: restaurant.slug,
    restaurantId: restaurant.restaurantId,
    pureVegRestaurant: restaurant.pureVegRestaurant === true,
    location: restaurant.location,
    isActive: restaurant.isActive !== false,
    isBanned: Boolean(
      restaurant.isBanned ||
        restaurant.status === "banned" ||
        (restaurant.status === "rejected" && /disabled by admin|banned/i.test(restaurant.rejectionReason || "")),
    ),
    isAcceptingOrders: restaurant.isAcceptingOrders !== false,
    openDays: Array.isArray(restaurant.openDays) ? restaurant.openDays : [],
    deliveryTimings: restaurant.deliveryTimings || null,
    outletTimings: restaurant.outletTimings || null,
    openingTime: restaurant.openingTime || restaurant?.deliveryTimings?.openingTime || null,
    closingTime: restaurant.closingTime || restaurant?.deliveryTimings?.closingTime || null,
    zoneRank: restaurant.zoneRank || null,
    discount: restaurant.discount || 0,
    distanceText: restaurant.distanceText || null,
    distanceInfo: restaurant.distanceInfo || null,
  };
}

const isOpenIgnoringOps = (r) =>
  getRestaurantAvailabilityStatus(r, new Date(), { ignoreOperationalStatus: true }).isOpen;

const distOrInf = (r) => (r.distanceInKm !== null && r.distanceInKm !== undefined ? r.distanceInKm : Infinity);

function compareBySort(a, b, sortBy) {
  if (sortBy === "price-low") return (a.featuredPrice || 0) - (b.featuredPrice || 0);
  if (sortBy === "price-high") return (b.featuredPrice || 0) - (a.featuredPrice || 0);
  if (sortBy === "rating-high") return (b.rating || 0) - (a.rating || 0);
  if (sortBy === "rating-low") return (a.rating || 0) - (b.rating || 0);
  if (sortBy === "nearby") return distOrInf(a) - distOrInf(b);
  // Default: zoneRank, then distance.
  const aRank = a.zoneRank !== null && a.zoneRank !== undefined ? a.zoneRank : Infinity;
  const bRank = b.zoneRank !== null && b.zoneRank !== undefined ? b.zoneRank : Infinity;
  if (aRank !== bRank) return aRank - bRank;
  return distOrInf(a) - distOrInf(b);
}

// Banned last; with user coordinates: open first, then the chosen sort.
export function sortRestaurantsForDisplay(restaurants, sortBy, hasUserCoords) {
  return [...restaurants].sort((a, b) => {
    const aBanned = Boolean(a.isBanned);
    const bBanned = Boolean(b.isBanned);
    if (aBanned !== bBanned) return aBanned ? 1 : -1;
    if (!hasUserCoords) return 0;
    const aOpen = isOpenIgnoringOps(a);
    const bOpen = isOpenIgnoringOps(b);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return compareBySort(a, b, sortBy);
  });
}

// Home.jsx's "recalculate distances when user location updates" pass. Returns prev when nothing changed.
export function recalcDistances(prevData, userLat, userLng, sortBy) {
  if (!prevData || prevData.length === 0) return prevData;
  let hasChanges = false;
  const updated = prevData.map((restaurant) => {
    if (!restaurant.location) return restaurant;
    const { lat, lng } = restaurantCoords(restaurant.location);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return restaurant;
    let calculatedDistance;
    let distanceInKm;
    if (restaurant.distanceText) {
      calculatedDistance = restaurant.distanceText;
      distanceInKm = restaurant.distanceInfo?.distanceValue ? restaurant.distanceInfo.distanceValue / 1000 : null;
    } else {
      distanceInKm = calculateDistance(userLat, userLng, lat, lng);
      calculatedDistance = formatDistance(distanceInKm);
    }
    if (restaurant.distance !== calculatedDistance || restaurant.distanceInKm !== distanceInKm) {
      hasChanges = true;
      return { ...restaurant, distance: calculatedDistance, distanceInKm };
    }
    return restaurant;
  });
  if (!hasChanges) return prevData;
  return [...updated].sort((a, b) => {
    const aOpen = isOpenIgnoringOps(a);
    const bOpen = isOpenIgnoringOps(b);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return compareBySort(a, b, sortBy);
  });
}

// Query params for GET /food/restaurant/restaurants from the applied filter state.
export function buildRestaurantParams(filters, { lat, lng, zoneId }) {
  const params = {};
  const f = filters.activeFilters;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    params.lat = lat;
    params.lng = lng;
  }
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.selectedCuisine) params.cuisine = filters.selectedCuisine;
  if (f?.has("rating-45-plus")) params.minRating = 4.5;
  else if (f?.has("rating-4-plus")) params.minRating = 4.0;
  else if (f?.has("rating-35-plus")) params.minRating = 3.5;
  if (f?.has("delivery-under-30")) params.maxDeliveryTime = 30;
  else if (f?.has("delivery-under-45")) params.maxDeliveryTime = 45;
  if (f?.has("distance-under-1km")) params.radiusKm = 1.0;
  else if (f?.has("distance-under-2km")) params.radiusKm = 2.0;
  if (f?.has("price-under-200")) params.maxPrice = 200;
  else if (f?.has("price-under-500")) params.maxPrice = 500;
  if (f?.has("has-offers")) params.hasOffers = "true";
  if (f?.has("top-rated")) params.topRated = "true";
  else if (f?.has("trusted")) params.trusted = "true";
  if (zoneId) params.zoneId = zoneId;
  return params;
}

export const isDefaultFilterState = (filters) =>
  !filters ||
  Object.keys(filters).length === 0 ||
  (!filters.sortBy && !filters.selectedCuisine && (!filters.activeFilters || filters.activeFilters.size === 0));

// The three Explore More tiles. Server icons replace the local ones by label; the local
// fallback images are unrecoverable, so image is null there (rendered as an empty tile).
const EXPLORE_FALLBACK = [
  { id: "offers", label: "Offers", href: "/food/user/offers" },
  { id: "gourmet", label: "Gourmet", href: "/food/user/gourmet" },
  { id: "collection", label: "Collections", href: "/food/user/profile/favorites" },
];

export function buildExploreItems(landingExploreMore) {
  const fallback = EXPLORE_FALLBACK.map((item) => ({ ...item, image: null, fallbackImage: null }));
  if (!landingExploreMore || landingExploreMore.length === 0) return fallback;
  return fallback.map((item) => {
    const apiItem = landingExploreMore.find((ai) => ai.label?.toLowerCase() === item.label?.toLowerCase());
    if (!apiItem) return item;
    const href = apiItem.link ? (apiItem.link.startsWith("/") ? apiItem.link : `/${apiItem.link}`) : item.href;
    const rawImg = apiItem.imageUrl || apiItem.image || "";
    const isBrokenCloudinary = typeof rawImg === "string" && /xv4gkshv/i.test(rawImg);
    return { ...item, image: isBrokenCloudinary ? null : normalizeImageUrl(rawImg) || null, href };
  });
}

// "Recommended For You": admin-picked restaurants from landing settings, merged with the list data.
export function buildRecommended({ zoneId, recommendedIds, fromSettings, restaurantsData, matchesVegMode }) {
  if (!zoneId) return [];
  const idsInOrder = (recommendedIds || []).map((id) => String(id));
  const hasIds = idsInOrder.length > 0;
  const settingsList = Array.isArray(fromSettings) ? fromSettings : [];
  const data = restaurantsData || [];

  const mapped = settingsList
    .filter((restaurant) => {
      const rZoneId = restaurant?.zoneId?._id || restaurant?.zoneId;
      return rZoneId ? String(rZoneId) === String(zoneId) : true;
    })
    .map((restaurant, index) => {
      const restaurantId = restaurant?._id ? String(restaurant._id) : "";
      const matched = data.find((r) => {
        const rId = String(r.mongoId || r.id || r._id || "");
        return rId && rId === restaurantId;
      });
      const cuisine =
        Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
          ? restaurant.cuisines[0]
          : matched?.cuisine || "Multi-cuisine";
      const menuImages = extractImages(
        (Array.isArray(restaurant?.menuImages) ? restaurant.menuImages : [restaurant?.menuImages]).filter(Boolean),
      );
      const coverImages = extractImages(
        (Array.isArray(restaurant?.coverImages) ? restaurant.coverImages : [restaurant?.coverImages]).filter(Boolean),
      );
      const profileImg =
        restaurant?.profileImage?.url || (typeof restaurant?.profileImage === "string" ? restaurant.profileImage : "");
      const candidates = [
        ...(matched?.images || []),
        ...coverImages,
        ...menuImages,
        ...(profileImg ? [profileImg] : []),
        ...(matched?.image ? [matched.image] : []),
      ].filter((img) => img && !img.includes("xv4gkshv"));
      const carouselImages = Array.from(new Set(candidates));
      const finalImage = carouselImages[0] || matched?.image || FOOD_FALLBACK_IMAGES[index % FOOD_FALLBACK_IMAGES.length];

      return {
        ...(matched || {}),
        ...restaurant,
        id: restaurant?.restaurantId || restaurantId,
        mongoId: restaurantId,
        name: getRestaurantDisplayName(restaurant),
        cuisine,
        rating: Number(restaurant?.rating ?? matched?.rating) || 0,
        distance: matched?.distance || "",
        deliveryTime: matched?.deliveryTime || "",
        image: normalizeImageUrl(finalImage) || finalImage,
        images: carouselImages.length > 0 ? carouselImages : [finalImage],
        coverImages: coverImages.length > 0 ? coverImages : matched?.coverImages || [],
        recommendedItems:
          matched?.recommendedItems && matched.recommendedItems.length > 0
            ? matched.recommendedItems
            : restaurant?.recommendedItems || [],
        slug: restaurant?.slug || matched?.slug || restaurantId,
        offer: restaurant?.offer || matched?.offer || null,
        pureVegRestaurant: restaurant?.pureVegRestaurant === true || matched?.pureVegRestaurant === true,
        isActive: true,
        isAcceptingOrders: true,
        zoneId: restaurant?.zoneId || matched?.zoneId,
      };
    });

  const ordered = hasIds
    ? idsInOrder.map((id) => mapped.find((r) => String(r.mongoId) === id)).filter(Boolean)
    : mapped;
  const existingIds = new Set(ordered.map((r) => String(r.mongoId || r.id)));
  const missing = data.filter((r) => {
    const mongoId = String(r.mongoId || "");
    const rZoneId = r?.zoneId?._id || r?.zoneId;
    const matchesZone = !rZoneId || String(rZoneId) === String(zoneId);
    return hasIds && idsInOrder.includes(mongoId) && !existingIds.has(mongoId) && matchesZone;
  });
  return [...ordered, ...missing].filter(matchesVegMode).slice(0, 12);
}

export function buildGourmet({ show, gourmetRestaurants, restaurantsData, matchesVegMode }) {
  if (!show || !Array.isArray(gourmetRestaurants) || gourmetRestaurants.length === 0) return [];
  return gourmetRestaurants
    .slice()
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    .map((gItem) => {
      const gId = String(gItem._id || gItem.mongoId || gItem.id || gItem.restaurantId || "");
      const matched = (restaurantsData || []).find((r) => {
        const rId = String(r.mongoId || r.id || r._id || "");
        return rId && rId === gId;
      });
      if (matched) return { ...matched, priority: gItem.priority ?? 0 };
      const name = gItem.name || gItem.restaurantName || "Restaurant";
      const slug = gItem.slug || name.toLowerCase().replace(/\s+/g, "-");
      const coverImages = Array.isArray(gItem.coverImages) ? gItem.coverImages : [];
      const profileImg = gItem.profileImage?.url || gItem.profileImage;
      const images = coverImages.length > 0 ? coverImages : profileImg ? [profileImg] : [];
      return {
        ...gItem,
        id: gId,
        mongoId: gId,
        name,
        slug,
        rating: Number(gItem.rating) || 0,
        cuisines: Array.isArray(gItem.cuisines) ? gItem.cuisines : [],
        images,
        coverImages,
        image: images[0] || null,
        priority: gItem.priority ?? 0,
      };
    })
    .filter((r) => !r.isBanned && matchesVegMode(r));
}

// Category rail entries from the menu sections union (used when admin categories are empty).
export function categoriesFromMenus(menus) {
  const categoryMap = new Map();
  menus.forEach((menu) => {
    const sections = Array.isArray(menu?.sections) ? menu.sections : [];
    sections.forEach((section) => {
      const categoryName = String(section?.name || "").trim();
      if (!categoryName) return;
      const slug = slugifyCategory(categoryName);
      if (!slug) return;
      let image = "";
      if (Array.isArray(section?.items) && section.items.length > 0) image = normalizeImageUrl(section.items[0]?.image);
      if (!image && Array.isArray(section?.subsections)) {
        for (const subsection of section.subsections) {
          if (Array.isArray(subsection?.items) && subsection.items.length > 0) {
            image = normalizeImageUrl(subsection.items[0]?.image);
            if (image) break;
          }
        }
      }
      if (!categoryMap.has(slug)) {
        categoryMap.set(slug, { id: slug, name: categoryName, slug, label: categoryName, image: image || "" });
      } else if (image && !categoryMap.get(slug).image) {
        categoryMap.get(slug).image = image;
      }
    });
  });
  return Array.from(categoryMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category, index) => ({
      ...category,
      image: category.image || FOOD_FALLBACK_IMAGES[index % FOOD_FALLBACK_IMAGES.length],
    }));
}
