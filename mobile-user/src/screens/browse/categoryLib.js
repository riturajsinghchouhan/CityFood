// Pure ports of CategoryPage.jsx's matching, menu and filter helpers.
import { normalizeImageUrl, slugify } from "./lib";

const STOP_WORDS = ["of", "the", "and", "in", "with", "a", "an", "to", "for"];

export const normalizeCategoryToken = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const matchesCategoryText = (value, keywords) => {
  const normalizedValue = normalizeCategoryToken(value);
  if (!normalizedValue) return false;
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeCategoryToken(keyword);
    if (!normalizedKeyword) return false;
    if (normalizedValue === normalizedKeyword || slugify(normalizedValue) === slugify(normalizedKeyword)) return true;
    if (normalizedKeyword.length <= 2 || STOP_WORDS.includes(normalizedKeyword)) return false;
    try {
      return new RegExp(`\\b${normalizedKeyword}\\b`, "i").test(normalizedValue);
    } catch {
      return (
        normalizedValue.includes(` ${normalizedKeyword} `) ||
        normalizedValue.startsWith(`${normalizedKeyword} `) ||
        normalizedValue.endsWith(` ${normalizedKeyword}`)
      );
    }
  });
};

export const uniqueByRestaurant = (list) => {
  const seen = new Set();
  return list.filter((row) => {
    const key = row.dishId ? `dish-${row.dishId}` : row.restaurantId || row.id || `raw-${slugify(row.name)}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.values(value).filter((entry) => entry && typeof entry === "object");
};

export const normalizeMenu = (menu) => {
  const rawSections = toArray(menu?.sections);
  return {
    ...menu,
    sections: rawSections.map((section, sectionIndex) => ({
      ...section,
      id: String(section?.id || section?._id || `section-${sectionIndex}`),
      name: section?.name || section?.title || "Unnamed Section",
      items: toArray(section?.items).map((item, itemIndex) => ({
        ...item,
        id: String(item?.id || item?._id || `${sectionIndex}-${itemIndex}`),
      })),
      subsections: toArray(section?.subsections).map((subsection, subsectionIndex) => ({
        ...subsection,
        id: String(subsection?.id || subsection?._id || `subsection-${sectionIndex}-${subsectionIndex}`),
        name: subsection?.name || "Unnamed Subsection",
        items: toArray(subsection?.items).map((item, itemIndex) => ({
          ...item,
          id: String(item?.id || item?._id || `${sectionIndex}-${subsectionIndex}-${itemIndex}`),
        })),
      })),
    })),
  };
};

export const buildFallbackMenuFromFoods = (foods, restaurant) => {
  const restaurantIds = new Set(
    [restaurant?.restaurantId, restaurant?.id, restaurant?.mongoId].filter(Boolean).map((v) => String(v).trim()),
  );
  const restaurantName = String(restaurant?.name || "").trim().toLowerCase();
  const matchingFoods = foods.filter((food) => {
    const foodRestaurantId = String(food?.restaurantId || "").trim();
    const foodRestaurantName = String(food?.restaurantName || "").trim().toLowerCase();
    return (foodRestaurantId && restaurantIds.has(foodRestaurantId)) || (restaurantName && foodRestaurantName === restaurantName);
  });
  if (matchingFoods.length === 0) return null;

  const sectionsMap = new Map();
  matchingFoods.forEach((food, index) => {
    const sectionName = String(food?.categoryName || food?.category || "Varieties").trim() || "Varieties";
    const sectionKey = slugify(sectionName);
    if (!sectionsMap.has(sectionKey)) {
      sectionsMap.set(sectionKey, { id: sectionKey || `section-${index}`, name: sectionName, items: [], subsections: [] });
    }
    sectionsMap.get(sectionKey).items.push({
      id: String(food?.id || food?._id || `${sectionKey}-${index}`),
      _id: food?._id,
      name: food?.name || "Unnamed Item",
      description: food?.description || "",
      price: Number(food?.price || 0),
      originalPrice: Number(food?.originalPrice || food?.price || 0),
      image: normalizeImageUrl(food?.image),
      foodType: food?.foodType || "Non-Veg",
      isAvailable: food?.isAvailable !== false,
      categoryName: food?.categoryName || sectionName,
      category: food?.categoryName || sectionName,
      preparationTime: food?.preparationTime || "",
      approvalStatus: food?.approvalStatus || "approved",
    });
  });
  return { sections: Array.from(sectionsMap.values()) };
};

export const getCategoryKeywords = (categoryId, categoryKeywords) => {
  if (categoryId === "all") return ["all"];
  const raw = String(categoryId || "").trim().toLowerCase();
  const fromAdmin = categoryKeywords[raw];
  let keywords = [];
  if (Array.isArray(fromAdmin) && fromAdmin.length > 0) {
    keywords = [...fromAdmin];
  } else {
    // Derive keywords from the URL slug when admin categories don't include it.
    const parts = raw.split(/[\s-]+/).filter(Boolean);
    keywords = parts.length > 0 ? Array.from(new Set([raw, ...parts])) : [];
  }
  if (keywords.includes("samosha") || keywords.includes("samosa")) {
    if (!keywords.includes("samosa")) keywords.push("samosa");
    if (!keywords.includes("samosha")) keywords.push("samosha");
  }
  return keywords;
};

export const checkCategoryInMenu = (menu, categoryId, categoryKeywords) => {
  if (!menu || !Array.isArray(menu.sections)) return false;
  if (categoryId === "all") return true;
  const keywords = getCategoryKeywords(categoryId, categoryKeywords);
  if (keywords.length === 0) return false;

  const itemMatches = (item) =>
    matchesCategoryText((item?.name || "").toLowerCase(), keywords) ||
    matchesCategoryText((item?.categoryName || item?.category || "").toLowerCase(), keywords);

  for (const section of menu.sections) {
    if (matchesCategoryText((section.name || "").toLowerCase(), keywords)) return true;
    if (Array.isArray(section.items) && section.items.some(itemMatches)) return true;
    if (Array.isArray(section.subsections)) {
      for (const subsection of section.subsections) {
        if (matchesCategoryText((subsection?.name || "").toLowerCase(), keywords)) return true;
        const subItems = Array.isArray(subsection?.items) ? subsection.items : [];
        if (subItems.some(itemMatches)) return true;
      }
    }
  }
  return false;
};

const toDish = (item, imageCandidates) => {
  const originalPrice = item?.originalPrice || item?.price || 0;
  const discountPercent = item?.discountPercent || 0;
  const finalPrice = discountPercent > 0 ? Math.round(originalPrice * (1 - discountPercent / 100)) : originalPrice;
  const firstImage = imageCandidates.find(Boolean);
  return {
    name: item?.name,
    price: finalPrice,
    image: normalizeImageUrl(firstImage),
    originalPrice,
    itemId: item?._id || item?.id || `${item?.name}-${finalPrice}`,
    foodType: item?.foodType,
  };
};

export const getAllCategoryDishesFromMenu = (menu, categoryId, categoryKeywords) => {
  if (!menu || !Array.isArray(menu.sections)) return [];
  const isAll = categoryId === "all";
  const keywords = isAll ? [] : getCategoryKeywords(categoryId, categoryKeywords);
  if (!isAll && keywords.length === 0) return [];

  const itemMatches = (item) =>
    isAll ||
    matchesCategoryText((item?.name || "").toLowerCase(), keywords) ||
    matchesCategoryText((item?.categoryName || item?.category || "").toLowerCase(), keywords);

  const dishes = [];
  for (const section of menu.sections) {
    const sectionMatches = isAll || matchesCategoryText((section?.name || "").toLowerCase(), keywords);
    if (Array.isArray(section.items)) {
      for (const item of section.items) {
        if (sectionMatches || itemMatches(item)) {
          dishes.push(toDish(item, [item.image?.url, item.image, section.image?.url, section.image]));
        }
      }
    }
    if (Array.isArray(section.subsections)) {
      for (const subsection of section.subsections) {
        const subsectionMatches = isAll || matchesCategoryText((subsection?.name || "").toLowerCase(), keywords);
        const subItems = Array.isArray(subsection?.items) ? subsection.items : [];
        for (const item of subItems) {
          if (sectionMatches || subsectionMatches || itemMatches(item)) {
            dishes.push(
              toDish(item, [
                item?.image?.url,
                item?.image,
                subsection?.image?.url,
                subsection?.image,
                section?.image?.url,
                section?.image,
              ]),
            );
          }
        }
      }
    }
  }
  return dishes;
};

export const getCategoryFallbackDishesFromApprovedFoods = (categoryId, restaurants, approvedFoods, categoryKeywords) => {
  const keywords = getCategoryKeywords(categoryId, categoryKeywords);
  if (keywords.length === 0 || !Array.isArray(approvedFoods) || approvedFoods.length === 0) return [];

  const byId = new Map();
  const byName = new Map();
  (Array.isArray(restaurants) ? restaurants : []).forEach((restaurant) => {
    [restaurant?.restaurantId, restaurant?.id, restaurant?.mongoId]
      .filter(Boolean)
      .map((v) => String(v).trim())
      .forEach((v) => {
        if (!byId.has(v)) byId.set(v, restaurant);
      });
    const name = String(restaurant?.name || "").trim().toLowerCase();
    if (name && !byName.has(name)) byName.set(name, restaurant);
  });

  return approvedFoods
    .filter((food) => {
      if (food?.isAvailable === false) return false;
      if (String(food?.approvalStatus || "").toLowerCase() !== "approved") return false;
      const categoryName = String(food?.categoryName || food?.category || "").toLowerCase();
      const foodName = String(food?.name || "").toLowerCase();
      return matchesCategoryText(categoryName, keywords) || matchesCategoryText(foodName, keywords);
    })
    .map((food, index) => {
      const restaurantId = String(food?.restaurantId || "").trim();
      const restaurantName = String(food?.restaurantName || "").trim();
      const matched = byId.get(restaurantId) || byName.get(restaurantName.toLowerCase()) || null;
      const fallbackName = restaurantName || "Restaurant";
      const fallbackSlug = slugify(fallbackName);
      const fallbackImage = normalizeImageUrl(food?.image);
      return {
        ...(matched || {}),
        id: `${restaurantId || fallbackSlug || "restaurant"}-${String(food?.id || food?._id || index)}`,
        restaurantId: restaurantId || matched?.restaurantId || matched?.id || null,
        mongoId: matched?.mongoId || matched?.id || null,
        slug: matched?.slug || fallbackSlug,
        name: matched?.name || fallbackName,
        image: matched?.image || fallbackImage,
        images: Array.isArray(matched?.images) && matched.images.length > 0 ? matched.images : fallbackImage ? [fallbackImage] : [],
        cuisine: matched?.cuisine || null,
        rating: matched?.rating || null,
        deliveryTime: matched?.deliveryTime || null,
        distance: matched?.distance || null,
        offer: matched?.offer || null,
        featuredDish: matched?.featuredDish || food?.name || null,
        featuredPrice: matched?.featuredPrice || Number(food?.price || 0),
        menu: matched?.menu || null,
        dishId: String(food?.id || food?._id || `${restaurantId}-${index}`),
        categoryDish: food,
        categoryDishName: food?.name || "Unnamed Item",
        categoryDishPrice: Number(food?.price || 0),
        categoryDishImage: fallbackImage,
        categoryDishFoodType: food?.foodType || "Non-Veg",
      };
    });
};

// ---- filters & sorting ----

const parseFirstNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};
const deliveryOf = (row) => parseFirstNumber(row?.deliveryTime);
const distanceOf = (row) => {
  const raw = String(row?.distance || "").trim().toLowerCase();
  if (!raw) return null;
  const parsed = parseFirstNumber(raw);
  if (parsed == null) return null;
  return raw.includes("m") && !raw.includes("km") ? parsed / 1000 : parsed;
};
const priceOf = (row) => {
  const raw = row?.categoryDishPrice ?? row?.featuredPrice ?? null;
  const parsed = typeof raw === "number" ? raw : parseFirstNumber(raw);
  return Number.isFinite(parsed) ? parsed : null;
};
const ratingOf = (row) => {
  const parsed = typeof row?.rating === "number" ? row.rating : parseFirstNumber(row?.rating);
  return Number.isFinite(parsed) ? parsed : null;
};
const offerMatches = (value, pattern) => pattern.test(String(value || ""));

export const applyFiltersAndSorting = (rows, { activeFilters, searchQuery, vegMode, vegModeOption, sortBy }) => {
  let next = Array.isArray(rows) ? [...rows] : [];
  const has = (id) => activeFilters.has(id);
  const keep = (fn) => {
    next = next.filter(fn);
  };
  if (has("under-30-mins")) keep((r) => deliveryOf(r) != null && deliveryOf(r) <= 30);
  if (has("delivery-under-45")) keep((r) => deliveryOf(r) != null && deliveryOf(r) <= 45);
  if (has("rating-35-plus")) keep((r) => ratingOf(r) != null && ratingOf(r) >= 3.5);
  if (has("rating-4-plus")) keep((r) => ratingOf(r) != null && ratingOf(r) >= 4.0);
  if (has("rating-45-plus")) keep((r) => ratingOf(r) != null && ratingOf(r) >= 4.5);
  if (has("distance-under-1km")) keep((r) => distanceOf(r) != null && distanceOf(r) <= 1);
  if (has("distance-under-2km")) keep((r) => distanceOf(r) != null && distanceOf(r) <= 2);
  if (has("price-under-200")) keep((r) => priceOf(r) != null && priceOf(r) <= 200);
  if (has("under-250")) keep((r) => priceOf(r) != null && priceOf(r) <= 250);
  if (has("price-under-500")) keep((r) => priceOf(r) != null && priceOf(r) <= 500);
  if (has("flat-50-off")) keep((r) => offerMatches(r?.offer, /50\s*%/i));
  if (has("price-match")) {
    keep(
      (r) =>
        offerMatches(r?.offer, /price\s*match/i) ||
        offerMatches(r?.priceRange, /price\s*match/i) ||
        offerMatches(r?.categoryDish?.description, /price\s*match/i),
    );
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    keep(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.cuisine?.toLowerCase().includes(q) ||
        r.featuredDish?.toLowerCase().includes(q) ||
        r.categoryDishName?.toLowerCase().includes(q),
    );
  }
  if (vegMode && vegModeOption === "pure-veg") keep((r) => r.pureVegRestaurant === true);

  if (sortBy) {
    next.sort((left, right) => {
      if (sortBy === "price-low" || sortBy === "price-high") {
        const a = priceOf(left);
        const b = priceOf(right);
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return sortBy === "price-low" ? a - b : b - a;
      }
      if (sortBy === "rating-high" || sortBy === "rating-low") {
        const a = ratingOf(left);
        const b = ratingOf(right);
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return sortBy === "rating-high" ? b - a : a - b;
      }
      return 0;
    });
  }
  return uniqueByRestaurant(next);
};
