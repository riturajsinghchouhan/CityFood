// Port of components/user/home/HomeRestaurantCard.jsx: Home's restaurant card (offer
// headline, name, rating/meta, open/offline pill, closing countdown, "Items at ₹x",
// bookmark) with a horizontal row of preview dishes, or the image carousel when the
// restaurant has none. Banned, closed or out-of-service restaurants render grey.
import { router, usePathname } from "expo-router";
import { Bookmark, Minus, Plus, Star, Timer } from "lucide-react-native";
import { memo, useEffect, useMemo, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { getOutletTimingsByRestaurantId } from "../../api/restaurants";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { buildCartLineId, normalizeFoodVariants } from "../../screens/restaurant/lib";
import { useTheme } from "../../theme/ThemeContext";
import AppImage from "../ui/AppImage";
import { Dialog } from "../ui/Sheet";
import Text from "../ui/Text";
import { toast } from "../ui/Toast";
import RestaurantImageCarousel, {
  FOOD_IMAGES,
  RestaurantCarouselStateProvider,
  resolveItemOffer,
} from "./RestaurantImageCarousel";
import { getRestaurantAvailabilityStatus } from "./restaurantAvailability";

export function resolveRestaurantSlug(restaurant, index = 0) {
  const nameStr = typeof restaurant?.name === "string" ? restaurant.name.trim() : "";
  const fallback =
    nameStr ||
    (typeof restaurant?.restaurantName === "string" ? restaurant.restaurantName.trim() : "") ||
    String(restaurant?.slug || restaurant?.id || restaurant?._id || `restaurant-${index}`);
  return typeof restaurant?.slug === "string" && restaurant.slug.trim()
    ? restaurant.slug.trim()
    : fallback.toLowerCase().replace(/\s+/g, "-");
}

function resolveHeadlineOffer(restaurant) {
  if (typeof restaurant?.offer === "string" && restaurant.offer.trim()) return restaurant.offer.trim();
  const offers = Array.isArray(restaurant?.offers) ? restaurant.offers : [];
  const best = offers.reduce((acc, o) => (!acc || Number(o.discountValue) > Number(acc.discountValue) ? o : acc), null);
  if (best) {
    const value = Number(best.discountValue) || 0;
    const isFlat = String(best.discountType || "").toUpperCase() === "FLAT";
    if (best.title) return best.title;
    if (value > 0) return isFlat ? `Flat ₹${value} off` : `${value}% off`;
  }
  if (Number(restaurant?.discount) > 0) return `${restaurant.discount}% off`;
  return null;
}

function buildPreviewItems(restaurant) {
  const source =
    Array.isArray(restaurant?.previewItems) && restaurant.previewItems.length > 0
      ? restaurant.previewItems
      : Array.isArray(restaurant?.recommendedItems)
        ? restaurant.recommendedItems
        : [];
  return source
    .filter((item) => item?.name)
    .map((item, idx) => {
      const price = Number(item.price) || 0;
      const offer = resolveItemOffer(restaurant, { ...item, id: item.id || item._id, price });
      const finalPrice = offer ? offer.discountedPrice : price;
      const otherPrice = Number(item.priceOnOtherPlatforms) || 0;
      const itemId = item.id || item._id;
      const variants = normalizeFoodVariants(item.variants).map((variant) => {
        const variantOffer = resolveItemOffer(restaurant, { ...item, id: itemId, price: variant.price });
        return {
          id: variant.id,
          name: variant.name,
          price: variant.price,
          finalPrice: variantOffer ? variantOffer.discountedPrice : variant.price,
        };
      });
      const lowerPercent =
        otherPrice > finalPrice && finalPrice > 0 ? Math.round(((otherPrice - finalPrice) / otherPrice) * 100) : 0;
      const raw = item.image || item.imageUrl;
      return {
        id: item.id || item._id,
        name: item.name,
        image: typeof raw === "string" && raw.trim() ? raw.trim() : FOOD_IMAGES[idx % FOOD_IMAGES.length],
        foodType: item.foodType,
        isRecommended: item.isRecommended === true,
        hasVariants: item.hasVariants === true || variants.length > 0,
        variants,
        priceOnOtherPlatforms: otherPrice || null,
        price,
        finalPrice,
        hasDiscount: Boolean(offer),
        lowerPercent,
      };
    });
}

// hooks/user/useDeferredOutletTimings.js: the web fetched timings when the card neared the
// viewport; FlatList only mounts cards near the viewport, so fetching on mount is equivalent.
const outletTimingsCache = new Map();
function useDeferredOutletTimings(restaurantId, initialTimings) {
  const id = restaurantId ? String(restaurantId) : "";
  const [fetched, setFetched] = useState(() => (id && outletTimingsCache.has(id) ? outletTimingsCache.get(id) : null));
  useEffect(() => {
    if (initialTimings != null) {
      if (id) outletTimingsCache.set(id, initialTimings);
      return undefined;
    }
    if (!id || outletTimingsCache.has(id)) return undefined;
    let cancelled = false;
    getOutletTimingsByRestaurantId(id)
      .then((res) => {
        const timings = res?.data?.outletTimings || null;
        outletTimingsCache.set(id, timings);
        if (!cancelled && timings) setFetched(timings);
      })
      .catch(() => outletTimingsCache.set(id, null));
    return () => {
      cancelled = true;
    };
  }, [id, initialTimings]);
  return initialTimings ?? fetched;
}

function PreviewItemCard({ item, quantity = 0, onSelect, onAdd, onChangeQuantity, isDark, primary }) {
  const isVeg = item.foodType === "Veg";
  return (
    <Pressable onPress={() => onSelect(item)} style={styles.preview}>
      <View style={[styles.previewImageWrap, { backgroundColor: isDark ? "#27272a" : "#f3f4f6" }]}>
        <AppImage src={item.image} width={150} style={StyleSheet.absoluteFill} fallbackSrc={FOOD_IMAGES[0]} />
        {item.isRecommended ? (
          <View style={styles.popular}>
            <Text style={styles.popularText}>Popular</Text>
          </View>
        ) : null}
        {quantity > 0 && !item.hasVariants ? (
          <View style={[styles.stepper, { borderColor: primary }]}>
            <Pressable
              onPress={() => onChangeQuantity(item, quantity - 1)}
              accessibilityLabel={`Remove one ${item.name}`}
              hitSlop={4}
              style={styles.stepBtn}
            >
              <Minus size={16} color={primary} strokeWidth={2.5} />
            </Pressable>
            <Text style={[styles.stepQty, { color: primary }]}>{quantity}</Text>
            <Pressable
              onPress={() => onChangeQuantity(item, quantity + 1)}
              accessibilityLabel={`Add one more ${item.name}`}
              hitSlop={4}
              style={styles.stepBtn}
            >
              <Plus size={16} color={primary} strokeWidth={2.5} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => onAdd(item)}
            accessibilityLabel={`Add ${item.name} to cart`}
            hitSlop={6}
            style={[styles.plus, { borderColor: `${primary}99` }]}
          >
            <Plus size={20} color={primary} strokeWidth={2.5} />
            {quantity > 0 ? (
              <View style={[styles.qtyBadge, { backgroundColor: primary }]}>
                <Text style={styles.qtyBadgeText}>{quantity}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      </View>
      <View style={styles.previewNameRow}>
        {item.foodType ? (
          <View style={[styles.vegBox, { borderColor: isVeg ? "#00a63e" : "#dc2626" }]}>
            <View style={[styles.vegDot, { backgroundColor: isVeg ? "#00a63e" : "#dc2626" }]} />
          </View>
        ) : null}
        <Text numberOfLines={2} style={[styles.previewName, { color: isDark ? "#f3f4f6" : "#101828" }]}>
          {item.name}
        </Text>
      </View>
      <View style={styles.priceRow}>
        {item.hasDiscount ? (
          <>
            <Text style={styles.strike}>₹{Math.round(item.price)}</Text>
            <View style={[styles.finalPill, { backgroundColor: `${primary}1A` }]}>
              <Text style={[styles.finalPrice, { color: primary }]}>₹{Math.round(item.finalPrice)}</Text>
            </View>
          </>
        ) : (
          <Text style={[styles.plainPrice, { color: isDark ? "#d1d5dc" : "#364153" }]}>₹{Math.round(item.price)}</Text>
        )}
      </View>
      {item.lowerPercent > 0 ? (
        <Text style={[styles.lower, { color: primary }]}>Our app: {item.lowerPercent}% lower</Text>
      ) : null}
    </Pressable>
  );
}

function VariantPicker({ item, restaurantName, quantityOf, onAdd, onChangeQuantity, onClose, isDark, primary }) {
  const title = isDark ? "#ffffff" : "#101828";
  const border = isDark ? "#1e2939" : "#f3f4f6";
  return (
    <Dialog
      visible={Boolean(item)}
      onClose={onClose}
      style={{ padding: 0, borderRadius: 16, borderWidth: 0, maxWidth: 416, width: "100%", backgroundColor: isDark ? "#1a1a1a" : "#ffffff", overflow: "hidden" }}
    >
      {item ? (
        <View>
          <View style={[styles.pickerHeader, { borderBottomColor: border }]}>
            <AppImage src={item.image} width={56} style={styles.pickerImage} fallbackSrc={FOOD_IMAGES[0]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: "700", color: title }}>
                {item.name}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 13, color: "#6a7282" }}>
                {restaurantName} · Choose an option
              </Text>
            </View>
          </View>
          <ScrollView style={{ maxHeight: 360 }}>
            {item.variants.map((variant, i) => {
              const quantity = quantityOf(item, variant);
              return (
                <View key={variant.id} style={[styles.variantRow, i > 0 && { borderTopWidth: 1, borderTopColor: border }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: title }}>{variant.name}</Text>
                    {variant.finalPrice < variant.price ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.strike}>₹{Math.round(variant.price)}</Text>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: primary }}>₹{Math.round(variant.finalPrice)}</Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: "500", color: isDark ? "#d1d5dc" : "#364153" }}>
                        ₹{Math.round(variant.price)}
                      </Text>
                    )}
                  </View>
                  {quantity > 0 ? (
                    <View style={[styles.pickerStepper, { borderColor: primary }]}>
                      <Pressable
                        onPress={() => onChangeQuantity(item, variant, quantity - 1)}
                        accessibilityLabel={`Remove one ${variant.name}`}
                        hitSlop={4}
                        style={styles.stepBtn}
                      >
                        <Minus size={16} color={primary} strokeWidth={2.5} />
                      </Pressable>
                      <Text style={[styles.stepQty, { color: primary }]}>{quantity}</Text>
                      <Pressable
                        onPress={() => onChangeQuantity(item, variant, quantity + 1)}
                        accessibilityLabel={`Add one more ${variant.name}`}
                        hitSlop={4}
                        style={styles.stepBtn}
                      >
                        <Plus size={16} color={primary} strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => onAdd(item, variant)} style={[styles.variantAdd, { borderColor: primary }]}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: primary }}>Add</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
          <View style={[styles.pickerFooter, { borderTopColor: border }]}>
            <Pressable onPress={onClose} style={[styles.doneBtn, { backgroundColor: primary }]}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Dialog>
  );
}

/**
 * restaurant: list API restaurant. index: position (slug fallback, entrance delay, image priority).
 * isOutOfService: grey out (zone out of service). isFavorite(slug) → bool.
 * onToggleFavorite(restaurant, slug, favorite): bookmark tap (web passed the click event first).
 * animateEntrance: fade-in-up on mount.
 */
function HomeRestaurantCard({ restaurant, index = 0, isOutOfService = false, isFavorite, onToggleFavorite, animateEntrance = false }) {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const { addToCart, updateQuantity, getCartItem } = useCart();
  const [variantItem, setVariantItem] = useState(null);
  const isBanned = Boolean(
    restaurant?.isBanned === true ||
      restaurant?.status === "banned" ||
      (restaurant?.status === "rejected" && /disabled by admin|banned/i.test(restaurant?.rejectionReason || "")),
  );
  const outletTimings = useDeferredOutletTimings(restaurant?.mongoId, restaurant?.outletTimings ?? null);
  const raw = getRestaurantAvailabilityStatus({ ...restaurant, outletTimings: outletTimings ?? restaurant?.outletTimings }, new Date());
  const availability = isBanned ? { ...raw, isOpen: false, closingCountdownLabel: null } : raw;

  const slug = resolveRestaurantSlug(restaurant, index);
  const favorite = !isBanned && typeof isFavorite === "function" ? isFavorite(slug) : false;
  const previewItems = useMemo(() => buildPreviewItems(restaurant), [restaurant]);
  const headlineOffer = useMemo(() => resolveHeadlineOffer(restaurant), [restaurant]);
  const priced = previewItems.map((i) => i.finalPrice).filter((p) => p > 0);
  const minItemPrice = priced.length > 0 ? Math.round(Math.min(...priced)) : null;
  const cuisineText =
    (Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
      ? restaurant.cuisines.slice(0, 2).join(", ")
      : restaurant?.cuisine) || "";
  const metaParts = [restaurant?.deliveryTime, restaurant?.distance, cuisineText].filter(Boolean);

  const [entrance] = useState(() => new Animated.Value(animateEntrance ? 0 : 1));
  useEffect(() => {
    if (!animateEntrance) return;
    Animated.timing(entrance, { toValue: 1, duration: 500, delay: Math.min(index, 9) * 50, useNativeDriver: true }).start();
  }, [animateEntrance, entrance, index]);

  const openRestaurant = (itemId) => {
    if (isBanned) return;
    router.push({ pathname: "/restaurants/[slug]", params: itemId ? { slug, highlightItemId: String(itemId) } : { slug } });
  };

  const grey = isBanned || isOutOfService || !availability.isOpen;

  // Same cart line ids as the restaurant page (item id + variant id, or "base"), so quantities stay in sync there.
  const lineIdOf = (item, variant = null) => buildCartLineId(item.id, variant?.id || "");
  const lineQuantity = (item, variant = null) => getCartItem(lineIdOf(item, variant))?.quantity || 0;
  // On the card a variant item shows how many of all its options are in the cart.
  const quantityOf = (item) =>
    item.variants?.length > 0
      ? item.variants.reduce((total, variant) => total + lineQuantity(item, variant), 0)
      : lineQuantity(item);

  const canOrder = () => {
    if (!isAuthenticated) {
      toast.error("Please login to add items to cart");
      router.push({ pathname: "/login", params: { from: pathname } });
      return false;
    }
    if (isBanned || isOutOfService || !availability.isOpen) {
      toast.error(isOutOfService ? "This restaurant does not deliver to your location." : "Restaurant is currently offline. Please try again later.");
      return false;
    }
    return true;
  };

  const addLine = (item, variant = null) => {
    if (!canOrder()) return;
    const lineItemId = lineIdOf(item, variant);
    const finalPrice = variant ? variant.finalPrice : item.finalPrice;
    const result = addToCart({
      id: lineItemId,
      lineItemId,
      itemId: item.id,
      name: item.name,
      price: finalPrice,
      originalPrice: variant ? variant.price : item.price,
      variantId: variant?.id || "",
      variantName: variant?.name || "",
      variantPrice: finalPrice,
      image: item.image,
      restaurant: restaurant.name,
      restaurantId: restaurant.mongoId || restaurant.restaurantId || restaurant._id || restaurant.id,
      isVeg: item.foodType === "Veg",
      foodType: item.foodType,
      priceOnOtherPlatforms: item.priceOnOtherPlatforms,
    });
    if (result?.ok === false) {
      toast.error(result.error || "Could not add this item.");
      return;
    }
    toast.success(`Added ${item.name}${variant ? ` (${variant.name})` : ""} to cart`);
  };

  const changeLine = (item, variant, quantity) => {
    if (quantity > lineQuantity(item, variant) && !canOrder()) return;
    updateQuantity(lineIdOf(item, variant), quantity);
  };

  const handleAddItem = (item) => {
    if (item.variants?.length > 0) {
      // Ask which size / option to add.
      if (canOrder()) setVariantItem(item);
      return;
    }
    // Older API response without variant details: choose on the restaurant page.
    if (item.hasVariants) {
      openRestaurant(item.id);
      return;
    }
    addLine(item);
  };

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }}
    >
      <RestaurantCarouselStateProvider>
        <Pressable
          onPress={() => openRestaurant()}
          disabled={isBanned}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
              borderColor: isDark ? "#1e2939" : "rgba(229,231,235,0.8)",
            },
            grey && styles.grey,
          ]}
        >
          <View style={styles.info}>
            <View style={styles.infoText}>
              {headlineOffer ? (
                <Text numberOfLines={1} style={[styles.headline, { color: colors.primary }]}>
                  {headlineOffer.toUpperCase()}
                </Text>
              ) : null}
              <Text numberOfLines={1} style={[styles.name, { color: isDark ? "#ffffff" : "#030712" }]}>
                {restaurant.name}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.star}>
                  <Star size={10} color="#ffffff" fill="#ffffff" strokeWidth={0} />
                </View>
                <Text style={[styles.rating, { color: isDark ? "#f3f4f6" : "#1e2939" }]}>
                  {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "New"}
                </Text>
                {metaParts.length > 0 ? (
                  <Text numberOfLines={1} style={[styles.meta, { color: isDark ? "#d1d5dc" : "#4a5565" }]}>
                    • {metaParts.join(" • ")}
                  </Text>
                ) : null}
              </View>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusPill,
                    availability.isOpen
                      ? { backgroundColor: "#f0fdf4", borderColor: "#b9f8cf" }
                      : { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb" },
                  ]}
                >
                  <Text style={[styles.statusText, { color: availability.isOpen ? "#008236" : "#6a7282" }]}>
                    {availability.isOpen ? "OPEN NOW" : "OFFLINE"}
                  </Text>
                </View>
                {availability.isOpen && availability.closingCountdownLabel && availability.openingTime && availability.closingTime ? (
                  <View style={styles.countdown}>
                    <Timer size={12} color={colors.primary} strokeWidth={3} />
                    <Text style={[styles.countdownText, { color: colors.primary }]}>{availability.closingCountdownLabel}</Text>
                  </View>
                ) : null}
                {minItemPrice > 0 ? (
                  <Text style={[styles.itemsAt, { color: isDark ? "#d1d5dc" : "#4a5565" }]}>• Items at ₹{minItemPrice}</Text>
                ) : null}
              </View>
            </View>

            {!isBanned ? (
              <Pressable
                onPress={() => onToggleFavorite?.(restaurant, slug, favorite)}
                accessibilityLabel={favorite ? "Remove from favorites" : "Add to favorites"}
                style={[
                  styles.bookmark,
                  favorite
                    ? { backgroundColor: "#fb2c36", borderColor: "#fb2c36" }
                    : { backgroundColor: isDark ? "#18181b" : "#ffffff", borderColor: isDark ? "#3f3f46" : "#e5e7eb" },
                ]}
              >
                <Bookmark
                  size={18}
                  color={favorite ? "#ffffff" : isDark ? "#f3f4f6" : "#1e2939"}
                  fill={favorite ? "#ffffff" : "none"}
                />
              </Pressable>
            ) : null}
          </View>

          {previewItems.length > 0 ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previewRow}
            >
              {previewItems.map((item) => (
                <PreviewItemCard
                  key={item.id || item.name}
                  item={item}
                  isDark={isDark}
                  primary={colors.primary}
                  quantity={quantityOf(item)}
                  onSelect={(selected) => openRestaurant(selected.id)}
                  onAdd={handleAddItem}
                  onChangeQuantity={(selected, quantity) => changeLine(selected, null, quantity)}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.carouselWrap}>
              <RestaurantImageCarousel
                restaurant={restaurant}
                priority={index < 3}
                autoPlay={!isBanned && availability.isOpen}
                height={176}
                radiusStyle={styles.carouselRadius}
                onSlideClick={(slide) => {
                  if (slide?.id && slide?.isRecommended) openRestaurant(slide.id);
                  else openRestaurant();
                }}
              />
            </View>
          )}
        </Pressable>
      </RestaurantCarouselStateProvider>
      <VariantPicker
        item={variantItem}
        restaurantName={restaurant?.name}
        quantityOf={lineQuantity}
        onAdd={addLine}
        onChangeQuantity={changeLine}
        onClose={() => setVariantItem(null)}
        isDark={isDark}
        primary={colors.primary}
      />
    </Animated.View>
  );
}

export default memo(HomeRestaurantCard);

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, overflow: "hidden", boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  grey: { filter: [{ grayscale: 1 }], opacity: 0.75 },
  info: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  infoText: { flex: 1, minWidth: 0 },
  headline: { marginBottom: 2, fontSize: 13, fontWeight: "800", letterSpacing: 0.325 },
  name: { fontSize: 20, fontWeight: "700", lineHeight: 25, letterSpacing: -0.5 },
  metaRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  star: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#008236", alignItems: "center", justifyContent: "center" },
  rating: { fontSize: 14, fontWeight: "600" },
  meta: { fontSize: 14, flexShrink: 1 },
  statusRow: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  statusPill: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  countdown: { flexDirection: "row", alignItems: "center", gap: 4 },
  countdownText: { fontSize: 11, fontWeight: "700" },
  itemsAt: { fontSize: 13, fontWeight: "500" },
  bookmark: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  previewRow: { gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  preview: { width: 150 },
  previewImageWrap: { height: 120, width: "100%", borderRadius: 16, overflow: "hidden" },
  popular: {
    position: "absolute",
    left: 8,
    top: 8,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  popularText: { fontSize: 11, fontWeight: "700", color: "#008236" },
  plus: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
  },
  qtyBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBadgeText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
  stepper: {
    position: "absolute",
    right: 8,
    bottom: 8,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 4,
    backgroundColor: "#ffffff",
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
  },
  pickerStepper: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 4,
  },
  stepBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepQty: { minWidth: 14, textAlign: "center", fontSize: 14, fontWeight: "700" },
  pickerHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1 },
  pickerImage: { width: 56, height: 56, borderRadius: 12, overflow: "hidden" },
  variantRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  variantAdd: { height: 36, paddingHorizontal: 20, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pickerFooter: { padding: 16, borderTopWidth: 1 },
  doneBtn: { height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  previewNameRow: { marginTop: 8, flexDirection: "row", alignItems: "flex-start", gap: 6 },
  vegBox: { marginTop: 3, width: 14, height: 14, borderRadius: 3, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  previewName: { flex: 1, fontSize: 14, fontWeight: "500", lineHeight: 19 },
  priceRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  strike: { fontSize: 13, color: "#99a1af", textDecorationLine: "line-through" },
  finalPill: { borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  finalPrice: { fontSize: 14, fontWeight: "700" },
  plainPrice: { fontSize: 14, fontWeight: "500" },
  lower: { marginTop: 4, fontSize: 12, fontWeight: "600" },
  carouselWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  carouselRadius: { borderRadius: 16 },
});
