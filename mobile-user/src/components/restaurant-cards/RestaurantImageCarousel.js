// Port of components/user/home/RestaurantImageCarousel.jsx: a restaurant's swipeable image
// strip (recommended dishes first, else cover images, else a stock food photo), with
// auto-advance, dots, a veg mark and a "recommended dish" tag. Also exports the shared
// carousel state provider, RestaurantOfferBanner (offer line for the visible dish) and
// resolveItemOffer.
import { Image } from "expo-image";
import { Sparkles } from "lucide-react-native";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { resolveMediaUrl } from "../ui/AppImage";
import Text from "../ui/Text";

// constants/images.js foodImages (stock fallbacks used by the web).
export const FOOD_IMAGES = [
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

const RestaurantCarouselStateContext = createContext(null);

/** Wrap a card in this when it shows both the carousel and RestaurantOfferBanner. */
export function RestaurantCarouselStateProvider({ children }) {
  const [activeSlide, setActiveSlide] = useState(null);
  const value = useMemo(() => ({ activeSlide, setActiveSlide }), [activeSlide]);
  return <RestaurantCarouselStateContext.Provider value={value}>{children}</RestaurantCarouselStateContext.Provider>;
}

function resolveSlideOffer(restaurant, slide) {
  if (!slide?.isRecommended) return null;
  const originalPrice = Number(slide.price) || 0;
  if (originalPrice <= 0) return null;

  const buildResult = (discountValue, isFlat, offerText) => {
    const value = Number(discountValue) || 0;
    if (value <= 0) return null;
    const discountedPrice = isFlat ? Math.max(0, originalPrice - value) : Math.max(0, originalPrice * (1 - value / 100));
    if (discountedPrice >= originalPrice) return null;
    return { offerText, originalPrice, discountedPrice };
  };

  const specificDiscount = Array.isArray(restaurant?.itemDiscounts)
    ? restaurant.itemDiscounts.find((discount) => String(discount.itemId) === String(slide.id))
    : null;
  if (specificDiscount && Number(specificDiscount.discountValue) > 0) {
    const value = Number(specificDiscount.discountValue);
    const isFlat = String(specificDiscount.discountType || "").toUpperCase() === "FLAT";
    return buildResult(value, isFlat, isFlat ? `FLAT ₹${value} OFF` : `${value}% OFF`);
  }
  if (Number(slide.discountPercent) > 0) {
    const value = Number(slide.discountPercent);
    return buildResult(value, false, `${value}% OFF`);
  }
  const matchingRule = (restaurant?.discountRules || []).find((rule) => {
    const conditionValue = Number(rule.conditionValue);
    return (
      (rule.conditionType === "PRICE_ABOVE" && originalPrice > conditionValue) ||
      (rule.conditionType === "PRICE_BELOW" && originalPrice < conditionValue)
    );
  });
  if (matchingRule && Number(matchingRule.discountValue) > 0) {
    const value = Number(matchingRule.discountValue);
    return buildResult(value, false, `${value}% OFF`);
  }
  if (Number(restaurant?.discount) > 0) {
    const value = Number(restaurant.discount);
    return buildResult(value, false, `${value}% OFF`);
  }
  return null;
}

/** Offer for a menu item: {offerText, originalPrice, discountedPrice} or null. */
export function resolveItemOffer(restaurant, item) {
  return resolveSlideOffer(restaurant, { ...item, isRecommended: true });
}

/** The 30px offer line ("20% OFF · Dish ₹x ₹y") for the dish the carousel is showing. */
export function RestaurantOfferBanner({ restaurant }) {
  const carouselState = useContext(RestaurantCarouselStateContext);
  const activeSlide = carouselState?.activeSlide || null;
  const offer = useMemo(() => resolveSlideOffer(restaurant, activeSlide), [restaurant, activeSlide]);
  const key = activeSlide ? `${activeSlide.id || activeSlide.name}-${offer?.offerText}` : "";
  const [anim] = useState(() => new Animated.Value(1));
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [key, anim]);

  if (!activeSlide || !offer) return null;
  const item = { ...activeSlide, price: offer.originalPrice, discountedPrice: offer.discountedPrice, offerText: offer.offerText };

  return (
    <View style={styles.offerWrap}>
      <Animated.View
        style={[
          styles.offerRow,
          { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}
      >
        <Text style={styles.offerText}>{item.offerText}</Text>
        <View style={styles.offerDot} />
        <Text numberOfLines={1} style={styles.offerName}>
          {item.name}
        </Text>
        <View style={styles.offerPrices}>
          {Number.isFinite(item.discountedPrice) && item.discountedPrice < item.price ? (
            <>
              <Text style={styles.offerStrike}>₹{Math.round(item.price)}</Text>
              <Text style={styles.offerPrice}>₹{Math.round(item.discountedPrice)}</Text>
            </>
          ) : (
            <Text style={styles.offerPrice}>₹{Math.round(item.price)}</Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

function buildSlides(restaurant) {
  const result = [];
  const recItems = Array.isArray(restaurant?.recommendedItems) ? restaurant.recommendedItems : [];
  recItems.forEach((item) => {
    const rawImg = item?.image || item?.imageUrl || item?.photoUrl;
    if (typeof rawImg === "string" && rawImg.trim()) {
      result.push({
        url: resolveMediaUrl(rawImg.trim()),
        id: item.id || item._id,
        name: item.name || "Recommended Dish",
        price: item.price || 0,
        foodType: item.foodType,
        discountPercent: item.discountPercent,
        isRecommended: true,
      });
    }
  });
  // Recommended dish photos win; otherwise the restaurant's own images.
  if (result.length > 0) return result;

  let sourceImages = [];
  if (Array.isArray(restaurant?.images) && restaurant.images.length > 0) sourceImages = restaurant.images;
  else if (Array.isArray(restaurant?.coverImages) && restaurant.coverImages.length > 0) sourceImages = restaurant.coverImages;
  else if (restaurant?.image) sourceImages = [restaurant.image];
  else if (restaurant?.profileImage) {
    const pUrl = typeof restaurant.profileImage === "string" ? restaurant.profileImage : restaurant.profileImage?.url || "";
    if (pUrl) sourceImages = [pUrl];
  }
  sourceImages
    .map((img) => (typeof img === "string" ? img : img?.url || img?.secure_url || ""))
    .filter((img) => typeof img === "string" && img.trim() && !img.includes("xv4gkshv"))
    .forEach((img) => {
      const url = resolveMediaUrl(img.trim());
      if (url && !result.some((s) => s.url === url)) result.push({ url, isRecommended: false });
    });

  if (result.length === 0) {
    const seed = String(restaurant?.id || restaurant?.mongoId || restaurant?._id || restaurant?.name || "food");
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    result.push({ url: FOOD_IMAGES[Math.abs(hash) % FOOD_IMAGES.length], isRecommended: false });
  }
  return result;
}

function Shimmer() {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shimmer, { opacity }]} />;
}

/**
 * restaurant: restaurant object from the list API. height: dp (web className h-*, default 208).
 * radiusStyle: corner radii (web roundedClass, e.g. {borderTopLeftRadius: 20, borderTopRightRadius: 20}).
 * autoPlay: advance every 7 s. priority: load the first image at high priority.
 * onSlideClick(slide): tap on the strip; slide = {url, id?, name?, price?, foodType?, isRecommended}.
 */
function RestaurantImageCarousel({ restaurant, priority = false, autoPlay = false, height = 208, radiusStyle, onSlideClick, style }) {
  const carouselState = useContext(RestaurantCarouselStateContext);
  const setSyncedActiveSlide = carouselState?.setActiveSlide;
  const slides = useMemo(
    () => buildSlides(restaurant),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restaurant?.recommendedItems, restaurant?.images, restaurant?.coverImages, restaurant?.image, restaurant?.profileImage, restaurant?.id, restaurant?.mongoId, restaurant?.name],
  );
  const scrollRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failed, setFailed] = useState({});
  const [loaded, setLoaded] = useState({});
  const [shimmerTimedOut, setShimmerTimedOut] = useState(false);

  const count = slides.length;
  const safeIndex = count > 0 ? ((currentIndex % count) + count) % count : 0;
  const currentSlide = slides[safeIndex] || null;
  const isImageUnavailable = count === 0 || Object.keys(failed).length >= count;

  useEffect(() => {
    setSyncedActiveSlide?.(currentSlide);
  }, [setSyncedActiveSlide, currentSlide]);

  // Reset when the restaurant or its images change.
  const [slidesKey, setSlidesKey] = useState(slides);
  if (slidesKey !== slides) {
    setSlidesKey(slides);
    setCurrentIndex(0);
    setFailed({});
    setLoaded({});
  }

  const goTo = useCallback(
    (index, animated = true) => {
      if (!width || count === 0) return;
      const next = ((index % count) + count) % count;
      setCurrentIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated });
    },
    [width, count],
  );

  useEffect(() => {
    if (!autoPlay || count <= 1) return undefined;
    const interval = setInterval(() => goTo(currentIndex + 1), 7000);
    return () => clearInterval(interval);
  }, [autoPlay, count, currentIndex, goTo]);

  // The web shows the shimmer for at most 2.5 s per image.
  useEffect(() => {
    setShimmerTimedOut(false);
    const t = setTimeout(() => setShimmerTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, [safeIndex, slides]);

  const onImageError = (index) => {
    setFailed((prev) => {
      const next = { ...prev, [index]: true };
      if (Object.keys(next).length < count && count > 1 && index === safeIndex) {
        setTimeout(() => goTo(index + 1), 0);
      }
      return next;
    });
  };

  const showShimmer = !loaded[safeIndex] && !shimmerTimedOut && !isImageUnavailable;

  return (
    <View
      style={[styles.root, { height }, radiusStyle, style]}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      {width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          onMomentumScrollEnd={(e) => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEnabled={count > 1}
        >
          {slides.map((slide, index) => (
            <Pressable
              key={`${index}-${slide.url}`}
              onPress={() => onSlideClick?.(slide)}
              disabled={!onSlideClick}
              style={{ width, height }}
            >
              <Image
                source={{ uri: slide.url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                priority={priority && index === 0 ? "high" : "normal"}
                cachePolicy="memory-disk"
                accessibilityLabel={`${restaurant?.name || "Restaurant"} - Image ${index + 1}`}
                onLoad={() => setLoaded((prev) => (prev[index] ? prev : { ...prev, [index]: true }))}
                onError={() => onImageError(index)}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {showShimmer ? <Shimmer /> : null}

      {currentSlide?.isRecommended && currentSlide?.foodType ? (
        <View
          pointerEvents="none"
          style={[styles.vegMark, { borderColor: currentSlide.foodType === "Veg" ? "#00a63e" : "#dc2626" }]}
        >
          <View style={[styles.vegDot, { backgroundColor: currentSlide.foodType === "Veg" ? "#00a63e" : "#dc2626" }]} />
        </View>
      ) : null}

      {currentSlide?.isRecommended && currentSlide?.name ? (
        <View pointerEvents="none" style={[styles.tag, { left: currentSlide.foodType ? 48 : 12 }]}>
          <Sparkles size={12} color="#ffb900" fill="#ffb900" />
          <Text numberOfLines={1} style={styles.tagName}>
            {currentSlide.name}
          </Text>
          {currentSlide.price > 0 ? <Text style={styles.tagPrice}>₹{Math.round(currentSlide.price)}</Text> : null}
        </View>
      ) : null}

      {isImageUnavailable ? (
        <View style={[StyleSheet.absoluteFill, styles.unavailable]} pointerEvents="none">
          <Text style={styles.unavailableText}>Image unavailable</Text>
        </View>
      ) : null}

      {count > 1 ? (
        <View style={styles.dots}>
          {slides.map((slide, index) => (
            <Pressable
              key={`dot-${index}`}
              onPress={() => goTo(index)}
              style={styles.dotHit}
              accessibilityLabel={`Go to image ${index + 1}`}
            >
              <View
                style={[
                  styles.dot,
                  index === safeIndex ? { width: 24, backgroundColor: "#ffffff" } : { width: 6, backgroundColor: "rgba(255,255,255,0.5)" },
                ]}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default memo(RestaurantImageCarousel);

const styles = StyleSheet.create({
  root: { width: "100%", overflow: "hidden", backgroundColor: "#f3f4f6" },
  shimmer: { backgroundColor: "#e5e7eb", zIndex: 1 },
  vegMark: {
    position: "absolute",
    left: 12,
    top: 12,
    zIndex: 20,
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  vegDot: { width: 12, height: 12, borderRadius: 6 },
  tag: {
    position: "absolute",
    top: 12,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
  },
  tagName: { color: "#ffffff", fontSize: 11, fontWeight: "700", maxWidth: 140 },
  tagPrice: { color: "#ffd230", fontSize: 11, fontWeight: "800", marginLeft: 2 },
  unavailable: { zIndex: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6" },
  unavailableText: { fontSize: 12, color: "#6a7282" },
  dots: { position: "absolute", bottom: 0, alignSelf: "center", flexDirection: "row", alignItems: "center", zIndex: 10 },
  dotHit: { width: 40, height: 40, marginHorizontal: -4, alignItems: "center", justifyContent: "center" },
  dot: { height: 6, borderRadius: 3 },
  offerWrap: { marginBottom: 8, width: "100%", height: 30, overflow: "hidden" },
  offerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 30 },
  offerText: { fontSize: 12, fontWeight: "900", color: "#000000" },
  offerDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.6)" },
  offerName: { flex: 1, fontSize: 11, fontWeight: "700", color: "#000000" },
  offerPrices: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4 },
  offerStrike: { fontSize: 10, color: "rgba(0,0,0,0.5)", textDecorationLine: "line-through" },
  offerPrice: { fontSize: 11, fontWeight: "600", color: "#000000" },
});
