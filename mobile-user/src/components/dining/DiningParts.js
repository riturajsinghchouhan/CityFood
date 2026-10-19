// Pieces of pages/user/Dining.jsx: search bar, hero banner carousel, category grid,
// filter chips, restaurant cards and their loading skeletons.
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark, Clock, MapPin, Mic, Search, SlidersHorizontal, Star } from "lucide-react-native";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";
import FadeInUp from "../account/FadeInUp";
import { AppImage, Text } from "../ui";
import Shimmer from "./Shimmer";

const RUPEE = "₹";
const GRID_GAP = 10;
const PAGE_PADDING = 12;

// ---------------- Sticky header search ----------------

export const DiningSearchBar = forwardRef(function DiningSearchBar(
  { value, onChangeText, onFocus, onSubmit },
  ref,
) {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.searchSection}>
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: isDark ? "#1a1a1a" : tw.gray50,
            borderColor: isDark ? tw.gray800 : tw.gray200,
          },
        ]}
      >
        <Search size={16} color={colors.primary} strokeWidth={2.5} style={{ marginLeft: 8 }} />
        <View style={styles.searchInputWrap}>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
            placeholder="Search restaurant, dish or cuisine..."
            placeholderTextColor={tw.gray400}
            selectionColor={colors.primary}
            style={[styles.searchInput, { color: isDark ? "#ffffff" : tw.gray700 }]}
          />
        </View>
        <View style={styles.searchRight}>
          <View style={[styles.searchDivider, { backgroundColor: isDark ? tw.gray700 : tw.gray200 }]} />
          {/* The web mic button has no handler. */}
          <Pressable style={styles.micBtn} accessibilityRole="button" accessibilityLabel="Voice search">
            <Mic size={16} color={colors.primary} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

// ---------------- Hero banner ----------------

export function DiningHeroBanner({ banners, loading }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const width = windowWidth - PAGE_PADDING * 2;
  const height = Math.round(windowHeight * 0.24);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef(null);
  const intervalRef = useRef(null);
  const draggingRef = useRef(false);
  const count = banners.length;

  const activeIndex = count === 0 ? 0 : Math.min(index, count - 1);

  const goTo = useCallback(
    (next) => {
      setIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    },
    [width],
  );

  const startAutoSlide = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (count <= 1) return;
    intervalRef.current = setInterval(() => {
      if (draggingRef.current) return;
      setIndex((prev) => {
        const next = (prev + 1) % count;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 3500);
  }, [count, width]);

  useEffect(() => {
    startAutoSlide();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoSlide]);

  return (
    <View style={styles.bannerSection}>
      <BannerEntrance style={[styles.bannerFrame, { height }]}>
        {count > 0 ? (
          <View style={StyleSheet.absoluteFill}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={count > 1}
              onScrollBeginDrag={() => {
                draggingRef.current = true;
              }}
              onMomentumScrollEnd={(e) => {
                draggingRef.current = false;
                const next = Math.round(e.nativeEvent.contentOffset.x / width);
                if (next !== activeIndex) {
                  setIndex(next);
                  startAutoSlide();
                }
              }}
            >
              {banners.map((banner, i) => (
                <View key={banner.id} style={{ width, height }}>
                  <AppImage src={banner.imageUrl} width={width} priority={i === 0} style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0)"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.bannerTextWrap}>
                    <View style={styles.bannerTextBox}>
                      {banner.promoCode ? (
                        <Text style={styles.bannerPromo}>{banner.promoCode.toUpperCase()}</Text>
                      ) : null}
                      {banner.tagline ? <Text style={styles.bannerTagline}>{banner.tagline}</Text> : null}
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            {count > 1 ? (
              <View style={styles.dotsWrap} pointerEvents="box-none">
                <View style={styles.dots}>
                  {banners.map((banner, i) => (
                    <Pressable
                      key={`${banner.id}-dot`}
                      accessibilityLabel={`Go to dining banner ${i + 1}`}
                      hitSlop={6}
                      onPress={() => {
                        goTo(i);
                        startAutoSlide();
                      }}
                      style={[
                        styles.dot,
                        activeIndex === i ? { width: 20, backgroundColor: "#ffffff" } : { width: 8, backgroundColor: "rgba(255,255,255,0.55)" },
                      ]}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={["#fff5e8", "#fffdf9", "#ffe3cf"]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(235,89,14,0.22)", "rgba(235,89,14,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.45, y: 0.45 }}
              style={StyleSheet.absoluteFill}
            />
            <Shimmer />
            <View style={styles.bannerFallbackText}>
              <Text style={styles.fallbackEyebrow}>DINING</Text>
              <Text style={styles.fallbackTitle}>
                {loading ? "Curating dining picks near you" : "Fresh dining picks near you"}
              </Text>
              <Text style={styles.fallbackBody}>
                {loading
                  ? "Hold tight while we load categories, offers, and the best tables around you."
                  : "Banner will appear here as soon as a dining hero banner is available from the new API."}
              </Text>
            </View>
            {loading ? (
              <View style={styles.loadingPill}>
                <Text style={styles.loadingPillText}>Loading</Text>
              </View>
            ) : null}
          </View>
        )}
      </BannerEntrance>
    </View>
  );
}

// framer initial={{opacity: 0, y: 24, scale: 0.98}} animate={{opacity: 1, y: 0, scale: 1}} (0.6 s).
function BannerEntrance({ style, children }) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(value, { toValue: 1, duration: 600, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [value]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [
            { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ---------------- Categories ----------------

function useGridTileWidth() {
  const { width } = useWindowDimensions();
  return Math.floor((width - PAGE_PADDING * 2 - GRID_GAP * 2) / 3);
}

function CategorySkeleton({ index, tileWidth }) {
  return (
    <FadeInUp from={14} duration={350} delay={index * 40} style={{ width: tileWidth }}>
      <View style={[styles.categoryTile, styles.categorySkeleton]}>
        <LinearGradient colors={["#fdfafc", "#f9f3f7"]} style={StyleSheet.absoluteFill} />
        <View style={styles.categorySkeletonLines}>
          <View style={[styles.pill, { height: 12, width: 64, backgroundColor: "#f0dcca" }]} />
          <View style={[styles.pill, { height: 16, width: 96, marginTop: 12, backgroundColor: "#ead2bc" }]} />
          <View style={[styles.pill, { height: 16, width: 80, marginTop: 8, backgroundColor: "#f3e3d4" }]} />
        </View>
        <View style={styles.categorySkeletonBottom}>
          <LinearGradient colors={["#fcf4f9", "#f5e8f1"]} style={StyleSheet.absoluteFill} />
          <View style={styles.categorySkeletonBlob} />
        </View>
        <Shimmer />
      </View>
    </FadeInUp>
  );
}

export function DiningCategoryGrid({ loading, categories, onPressCategory }) {
  const tileWidth = useGridTileWidth();
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.lookingForRow}>
        <View style={styles.lookingForLine} />
        <Text style={styles.lookingForText}>WHAT ARE YOU LOOKING FOR?</Text>
        <View style={styles.lookingForLine} />
      </View>
      <View style={styles.grid}>
        {loading
          ? Array.from({ length: 6 }, (_, i) => <CategorySkeleton key={`category-skeleton-${i}`} index={i} tileWidth={tileWidth} />)
          : categories.map((category, i) => (
              <FadeInUp
                key={category._id || category.id || category.slug}
                from={20}
                duration={400}
                delay={i * 50}
                style={{ width: tileWidth }}
              >
                <Pressable onPress={() => onPressCategory(category)} style={[styles.categoryTile, styles.categoryCard]}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <View style={styles.categoryImageWrap}>
                    {category.imageUrl ? (
                      <AppImage
                        src={category.imageUrl}
                        width={tileWidth}
                        contentFit="contain"
                        priority={i < 6}
                        style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
                      />
                    ) : (
                      <View style={StyleSheet.absoluteFill}>
                        <LinearGradient colors={["#fff7ee", "#fff1e1"]} style={StyleSheet.absoluteFill} />
                        <View style={styles.categoryImageHill} />
                        <Shimmer />
                      </View>
                    )}
                  </View>
                </Pressable>
              </FadeInUp>
            ))}
      </View>
    </View>
  );
}

// ---------------- Section header and filter chips ----------------

export function DiningSectionHeader({ count }) {
  const { isDark } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: isDark ? "#ffffff" : tw.gray900 }]}>Popular Restaurants Within 10km</Text>
      <Text style={[styles.sectionCount, { color: isDark ? tw.gray400 : tw.gray500 }]}>{count} nearby places</Text>
    </View>
  );
}

export const DINING_QUICK_FILTERS = [
  { id: "delivery-under-30", label: "Under 30 mins" },
  { id: "delivery-under-45", label: "Under 45 mins" },
  { id: "distance-under-1km", label: "Under 1km", icon: MapPin },
  { id: "distance-under-2km", label: "Under 2km", icon: MapPin },
  { id: "rating-35-plus", label: "3.5+ Rating" },
  { id: "rating-4-plus", label: "4.0+ Rating" },
  { id: "rating-45-plus", label: "4.5+ Rating" },
];

const CHIP_SKELETON_WIDTHS = [90, 108, 122, 108, 122, 108];

export function DiningFilterChips({ loading, activeFilters, onToggle, onOpenFilters }) {
  const { colors, isDark } = useTheme();
  if (loading) {
    return (
      <View style={[styles.chipsSection, styles.chipsRow, { overflow: "hidden" }]}>
        {CHIP_SKELETON_WIDTHS.map((w, i) => (
          <View key={`filter-skeleton-${i}`} style={[styles.chipSkeleton, { width: w }]}>
            <Shimmer />
          </View>
        ))}
      </View>
    );
  }
  const idleBg = isDark ? "#1a1a1a" : "#ffffff";
  const idleBorder = isDark ? tw.gray800 : tw.gray200;
  const idleText = isDark ? "#ffffff" : "#000000";
  return (
    <View style={styles.chipsSection}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Pressable onPress={onOpenFilters} style={[styles.chip, { backgroundColor: idleBg, borderColor: idleBorder }]}>
          <SlidersHorizontal size={12} color={isDark ? tw.gray300 : tw.gray700} />
          <Text style={[styles.chipText, { color: idleText }]}>Filters</Text>
        </Pressable>
        {DINING_QUICK_FILTERS.map((filter) => {
          const Icon = filter.icon;
          const active = activeFilters.has(filter.id);
          return (
            <Pressable
              key={filter.id}
              onPress={() => onToggle(filter.id)}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: idleBg, borderColor: idleBorder },
              ]}
            >
              {Icon ? (
                <Icon
                  size={12}
                  color={active ? "#ffffff" : isDark ? tw.gray300 : tw.gray600}
                  fill={active ? "#ffffff" : "none"}
                />
              ) : null}
              <Text style={[styles.chipText, { color: active ? "#ffffff" : idleText }]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------------- Restaurant cards ----------------

export function DiningRestaurantSkeleton({ index }) {
  const { colors } = useTheme();
  return (
    <FadeInUp from={18} duration={400} delay={index * 60} style={{ marginBottom: 16 }}>
      <View style={styles.skelCard}>
        <View style={styles.skelImage}>
          <LinearGradient colors={["#fcf6fa", "#f9edf5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={[styles.abs, { left: 16, top: 16, height: 32, width: 112, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.1)" }]} />
          <View style={[styles.abs, { right: 16, top: 16, height: 36, width: 36, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.6)" }]} />
          <LinearGradient
            colors={[colors.primary, "rgba(0,0,0,0.2)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.skelImageBottom}
          >
            <View style={[styles.pill, { height: 10, width: 96, backgroundColor: "rgba(255,255,255,0.35)" }]} />
            <View style={{ marginTop: 8, height: 1, width: 96, backgroundColor: "rgba(255,255,255,0.25)" }} />
            <View style={[styles.pill, { marginTop: 12, height: 16, width: 160, backgroundColor: "rgba(255,255,255,0.55)" }]} />
          </LinearGradient>
          <Shimmer />
        </View>
        <View style={{ padding: 16, gap: 16 }}>
          <View style={styles.between}>
            <View style={{ flex: 1 }}>
              <View style={[styles.pill, { height: 20, width: 160, backgroundColor: "#ead8c8" }]} />
              <View style={[styles.pill, { marginTop: 8, height: 16, width: 96, backgroundColor: "#f2e7dd" }]} />
            </View>
            <View style={{ height: 32, width: 48, borderRadius: 8, backgroundColor: "#d7efe0" }} />
          </View>
          <View style={[styles.rowCenter, { gap: 8 }]}>
            <View style={[styles.pill, { height: 16, width: 16, backgroundColor: "#efe2d7" }]} />
            <View style={[styles.pill, { height: 16, width: 96, backgroundColor: "#efe2d7" }]} />
            <View style={[styles.pill, { height: 16, width: 16, backgroundColor: "#f5ece4" }]} />
            <View style={[styles.pill, { height: 16, width: 80, backgroundColor: "#f5ece4" }]} />
          </View>
          <View style={[styles.pill, { height: 16, width: 192, backgroundColor: "#f0e1d3" }]} />
        </View>
      </View>
    </FadeInUp>
  );
}

// The web renders the first two restaurants and the rest with slightly different markup;
// `featured` selects the first-two variant.
export function DiningRestaurantCard({ restaurant, index, featured, favorite, onPress, onToggleFavorite }) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const muted = isDark ? tw.gray400 : tw.gray500;
  return (
    <FadeInUp from={30} duration={500} delay={Math.min(index, 6) * 100} style={{ marginBottom: 16 }}>
      <Pressable
        onPress={onPress}
        style={[styles.card, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}
      >
        <View style={styles.cardImage}>
          {restaurant.image ? (
            <AppImage src={restaurant.image} width={width - PAGE_PADDING * 2} priority={featured && index < 3} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={StyleSheet.absoluteFill}>
              <LinearGradient colors={["#fff5e8", "#fffaf4", "#ffe5d0"]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={["rgba(235,89,14,0.24)", "rgba(235,89,14,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 0.4 }} style={StyleSheet.absoluteFill} />
              <Shimmer />
            </View>
          )}

          <View style={[styles.featuredBadge, featured ? [styles.featuredBadgeTop, shadow.lg] : null]}>
            <Text style={styles.featuredBadgeText}>
              {restaurant.featuredDish} {"•"} {RUPEE}
              {restaurant.featuredPrice}
            </Text>
          </View>

          <Pressable
            onPress={onToggleFavorite}
            hitSlop={4}
            style={[styles.bookmarkBtn, { backgroundColor: isDark ? "rgba(26,26,26,0.9)" : "rgba(255,255,255,0.9)" }]}
          >
            <Bookmark
              size={20}
              strokeWidth={2}
              color={favorite ? (isDark ? tw.gray200 : tw.gray800) : isDark ? tw.gray400 : tw.gray600}
              fill={favorite ? (isDark ? tw.gray200 : tw.gray800) : "none"}
            />
          </Pressable>

          <LinearGradient
            colors={[colors.primary, colors.primary + "00"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cardImageBottom}
          >
            <Text style={styles.prebookEyebrow}>PRE-BOOK TABLE</Text>
            <View style={styles.prebookLine} />
            <Text style={styles.prebookOffer}>{restaurant.offer}</Text>
          </LinearGradient>
        </View>

        <View style={styles.cardContent}>
          <View style={[styles.between, { gap: featured ? 8 : 12, marginBottom: 8 }]}>
            <Text numberOfLines={1} style={[styles.cardName, { color: isDark ? "#ffffff" : tw.gray900 }]}>
              {restaurant.name}
            </Text>
            <View style={[styles.ratingBadge, { backgroundColor: featured ? tw.green600 : "#267e3e" }, featured ? null : shadow.sm]}>
              <Text style={styles.ratingText}>{featured ? restaurant.rating : restaurant.rating || "0"}</Text>
              <Star size={12} color="#ffffff" fill="#ffffff" />
            </View>
          </View>

          {featured ? (
            <View style={[styles.rowCenter, { gap: 4, marginBottom: 8 }]}>
              <Clock size={16} color={muted} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: muted }]}>{restaurant.deliveryTime}</Text>
              <Text style={[styles.metaPlain, { color: muted, marginHorizontal: 4 }]}>|</Text>
              <Text style={[styles.metaText, { color: muted }]}>{restaurant.distance}</Text>
            </View>
          ) : (
            <View style={[styles.rowCenter, { gap: 6, marginBottom: 10 }]}>
              <View style={[styles.rowCenter, { gap: 4 }]}>
                <Clock size={16} color={tw.gray400} strokeWidth={2} />
                <Text style={[styles.metaText, { color: muted }]}>{restaurant.deliveryTime}</Text>
              </View>
              <Text style={[styles.metaText, { color: tw.gray300, marginHorizontal: 2 }]}>|</Text>
              <View style={[styles.rowCenter, { gap: 4, flexShrink: 1 }]}>
                <MapPin size={14} color={tw.gray400} strokeWidth={2} />
                <Text numberOfLines={1} style={[styles.metaText, { color: muted }]}>
                  {restaurant.distance || "Distance unavailable"}
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.rowCenter, { gap: 8, marginTop: featured ? 4 : 0 }]}>
            <View
              style={[
                styles.statusBadge,
                restaurant.isEnabled
                  ? { backgroundColor: tw.green50, borderColor: "#bbf7d0" }
                  : { backgroundColor: "transparent", borderColor: colors.border },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: restaurant.isEnabled ? tw.green700 : colors.text }]}>
                {restaurant.isEnabled ? "ON" : "OFF"}
              </Text>
            </View>
            {featured ? (
              <Text style={[styles.prebookLabel, { fontSize: 13, color: tw.gray700 }]}>Pre-book table</Text>
            ) : (
              <Text style={[styles.prebookLabel, { fontSize: 14, color: isDark ? tw.gray400 : tw.gray600 }]}>
                Pre-book table
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </FadeInUp>
  );
}

export function DiningEmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>No popular dining restaurants were found within 10 km for the current location.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  pill: { borderRadius: 999 },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  between: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },

  searchSection: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBox: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 8 },
  searchInputWrap: { flex: 1, paddingHorizontal: 12 },
  searchInput: { height: 24, padding: 0, fontSize: 13, fontFamily: "Poppins_700Bold" },
  searchRight: { flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 8 },
  searchDivider: { height: 16, width: 1 },
  micBtn: { padding: 4, borderRadius: 999 },

  bannerSection: { paddingHorizontal: PAGE_PADDING, paddingBottom: 12 },
  bannerFrame: { width: "100%", borderRadius: 22, overflow: "hidden", ...shadow.lg },
  bannerTextWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16 },
  bannerTextBox: { maxWidth: "75%", borderRadius: 16, backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: 12, paddingVertical: 12 },
  bannerPromo: { fontSize: 11, fontWeight: "600", letterSpacing: 3.3, color: "rgba(255,255,255,0.85)" },
  bannerTagline: { marginTop: 8, fontSize: 18, fontWeight: "700", lineHeight: 22, color: "#ffffff" },
  dotsWrap: { position: "absolute", bottom: 16, left: 0, right: 0, alignItems: "center" },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { height: 8, borderRadius: 999 },
  bannerFallbackText: { position: "absolute", left: 24, bottom: 24, maxWidth: "70%" },
  fallbackEyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 3.7, color: "#b46f37" },
  fallbackTitle: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: "900", color: "#2e1d11" },
  fallbackBody: { marginTop: 8, fontSize: 14, lineHeight: 20, fontWeight: "500", color: "#6d5744" },
  loadingPill: {
    position: "absolute",
    right: 20,
    top: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  loadingPillText: { fontSize: 11, fontWeight: "600", letterSpacing: 2, color: "#8d5324" },

  lookingForRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  lookingForLine: { flex: 1, height: 1, backgroundColor: "rgba(236,229,220,0.6)" },
  lookingForText: { fontSize: 9, fontWeight: "500", letterSpacing: 2.25, color: "#8f8478", textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  categoryTile: { height: 114, borderRadius: 22, overflow: "hidden", borderWidth: 1 },
  categorySkeleton: { borderColor: "#efe2d3", boxShadow: "0px 1px 2px rgba(60,15,61,0.05)" },
  categorySkeletonLines: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: 12, paddingTop: 12, zIndex: 1 },
  categorySkeletonBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "64%",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: "hidden",
  },
  categorySkeletonBlob: {
    position: "absolute",
    bottom: 12,
    left: 12,
    height: 56,
    width: 56,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  categoryCard: { borderColor: "#ece5dc", backgroundColor: "#fdfaf8", padding: 10 },
  categoryName: { fontSize: 12, fontWeight: "700", lineHeight: 15, letterSpacing: -0.3, color: "#2d2722", marginBottom: 4 },
  categoryImageWrap: { flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.4)" },
  categoryImageHill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
    marginBottom: 40,
    paddingHorizontal: 4,
  },
  sectionTitle: { flex: 1, fontSize: 18, fontWeight: "700", letterSpacing: -0.45 },
  sectionCount: { fontSize: 12, fontWeight: "500", maxWidth: 90 },

  chipsSection: { paddingVertical: 4, marginBottom: 16 },
  chipsRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  chip: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  chipSkeleton: {
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#efe3d7",
    backgroundColor: "#fff7f1",
    overflow: "hidden",
  },

  skelCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#efe2d3",
    ...shadow.md,
  },
  skelImage: { height: 192, overflow: "hidden" },
  skelImageBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: "40%", justifyContent: "flex-end", paddingLeft: 16, paddingBottom: 16 },

  card: { borderRadius: 22, overflow: "hidden", ...shadow.md },
  cardImage: { height: 176, width: "100%", overflow: "hidden" },
  featuredBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(31,41,55,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  featuredBadgeTop: { backgroundColor: "rgba(31,41,55,0.9)" },
  featuredBadgeText: { color: "#ffffff", fontSize: 12, fontWeight: "500" },
  bookmarkBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    height: 36,
    width: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardImageBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: "40%", justifyContent: "flex-end", paddingLeft: 16, paddingBottom: 16 },
  prebookEyebrow: { color: "#ffffff", fontSize: 12, fontWeight: "500", letterSpacing: 0.3, marginBottom: 4 },
  prebookLine: { height: 1, width: 96, backgroundColor: "rgba(255,255,255,0.3)", marginBottom: 8 },
  prebookOffer: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  cardContent: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10 },
  cardName: { flex: 1, fontSize: 18, fontWeight: "700" },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ratingText: { color: "#ffffff", fontSize: 14, fontWeight: "700", lineHeight: 16 },
  metaText: { fontSize: 14, fontWeight: "500" },
  metaPlain: { fontSize: 14 },
  statusBadge: { height: 20, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, justifyContent: "center" },
  statusBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  prebookLabel: { fontWeight: "700" },

  empty: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#eadfce",
    backgroundColor: "#fffaf4",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  emptyText: { textAlign: "center", fontSize: 14, fontWeight: "500", color: tw.gray500 },
});
