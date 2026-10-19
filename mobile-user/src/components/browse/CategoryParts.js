// Pieces of CategoryPage.jsx: sticky header (back, search, category rail, filter chips),
// "Matched Dishes" cards, "All Restaurants" cards and the filters-and-sorting sheet.
import {
  ArrowDownUp,
  ArrowLeft,
  BadgePercent,
  Bookmark,
  Clock,
  IndianRupee,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Timer,
  UtensilsCrossed,
} from "lucide-react-native";
import { memo, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import {
  RestaurantCarouselStateProvider,
  RestaurantImageCarousel,
  RestaurantOfferBanner,
} from "../restaurant-cards";
import { AppImage, BottomSheet, ScalePressable, Skeleton, Text, inputFont } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";

// ---------------- Header ----------------

export function CategorySearchRow({ onBack, value, onChangeText }) {
  const { isDark } = useTheme();
  return (
    <View style={[styles.searchRow, { borderBottomColor: isDark ? tw.gray800 : tw.gray100 }]}>
      <Pressable onPress={onBack} hitSlop={6} style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]}>
        <ArrowLeft size={16} color={isDark ? tw.gray300 : tw.gray700} />
      </Pressable>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Search size={14} color={tw.gray500} style={{ position: "absolute", left: 10, zIndex: 1 }} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Search..."
          placeholderTextColor={isDark ? tw.gray400 : tw.gray600}
          style={[
            styles.searchInput,
            inputFont,
            {
              borderColor: isDark ? tw.gray700 : tw.gray300,
              backgroundColor: isDark ? "#1a1a1a" : tw.gray50,
              color: isDark ? "#ffffff" : tw.gray900,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function CategoryRail({ categories, loading, selectedCategory, onSelect }) {
  const { colors, isDark } = useTheme();
  const scrollRef = useRef(null);
  const layoutsRef = useRef({});
  const [railWidth, setRailWidth] = useState(0);
  const visible = categories.filter((cat) => cat.id !== "all" && cat.slug !== "all");
  const selectedKey = visible.find((cat) => selectedCategory === (cat.slug || cat.id) || selectedCategory === cat.id)?.id;

  const centerSelected = (key, width) => {
    const layout = key ? layoutsRef.current[key] : null;
    if (!layout || !width) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, layout.x + layout.width / 2 - width / 2), animated: true });
  };
  useEffect(() => {
    centerSelected(selectedKey, railWidth);
  }, [selectedKey, railWidth]);

  return (
    <View style={[styles.rail, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderBottomColor: isDark ? tw.gray800 : tw.gray100 }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setRailWidth(e.nativeEvent.layout.width)}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingVertical: 12 }}
      >
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <View key={`cat-skel-${i}`} style={{ alignItems: "center", gap: 8, paddingBottom: 8 }}>
              <Skeleton style={{ width: 64, height: 64, borderRadius: 999 }} />
              <Skeleton style={{ width: 48, height: 12, borderRadius: 4 }} />
            </View>
          ))
        ) : visible.length > 0 ? (
          visible.map((cat) => {
            const isSelected = cat.id === selectedKey;
            return (
              <Pressable
                key={cat.id}
                onPress={() => onSelect(cat)}
                onLayout={(e) => {
                  layoutsRef.current[cat.id] = e.nativeEvent.layout;
                  if (isSelected) centerSelected(cat.id, railWidth);
                }}
                style={[styles.railItem, isSelected && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
              >
                {cat.image ? (
                  <View style={[styles.railCircle, { borderColor: isSelected ? colors.primary : "transparent" }, isSelected && shadow.lg]}>
                    <AppImage src={cat.image} width={64} placeholderType="none" style={StyleSheet.absoluteFill} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.railCircle,
                      styles.center,
                      {
                        backgroundColor: isSelected ? colors.primary + (isDark ? "33" : "1A") : isDark ? tw.gray800 : tw.gray100,
                        borderColor: isSelected ? colors.primary : "transparent",
                      },
                      isSelected && shadow.lg,
                    ]}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? tw.gray300 : tw.gray600 }}>
                      {String(cat.name || "?").trim().slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "500", color: isSelected ? colors.primary : isDark ? tw.gray400 : tw.gray600 }}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <View style={[styles.center, { paddingVertical: 16 }]}>
            <Text style={{ fontSize: 14, color: isDark ? tw.gray400 : tw.gray600 }}>No categories available</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Chip({ label, Icon, active, onPress }) {
  const { colors, isDark } = useTheme();
  const fg = active ? "#ffffff" : isDark ? "#ffffff" : "#000000";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: pressed ? colors.secondary : colors.primary, borderColor: colors.primary }
          : { backgroundColor: pressed ? (isDark ? tw.gray800 : tw.gray50) : isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray200 },
      ]}
    >
      {Icon ? <Icon size={14} color={active ? "#ffffff" : isDark ? "#ffffff" : tw.gray900} /> : null}
      <Text style={{ fontSize: 12, fontWeight: "700", color: fg }}>{label}</Text>
    </Pressable>
  );
}

const ROW1 = [
  { id: "under-30-mins", label: "Under 30 mins" },
  { id: "delivery-under-45", label: "Under 45 mins" },
  { id: "rating-4-plus", label: "Rating 4.0+" },
  { id: "rating-45-plus", label: "Rating 4.5+" },
];
const ROW2 = [
  { id: "distance-under-1km", label: "Under 1km", icon: MapPin },
  { id: "distance-under-2km", label: "Under 2km", icon: MapPin },
  { id: "flat-50-off", label: "Flat 50% OFF" },
  { id: "under-250", label: "Under ₹250" },
];

export function CategoryFilterChips({ activeFilters, onToggle, onOpenFilters }) {
  const { isDark } = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Pressable
          onPress={onOpenFilters}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: pressed ? (isDark ? tw.gray800 : tw.gray50) : isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray200 },
          ]}
        >
          <SlidersHorizontal size={14} color={isDark ? "#ffffff" : tw.gray900} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#ffffff" : "#000000" }}>Filters</Text>
        </Pressable>
        {ROW1.map((f) => (
          <Chip key={f.id} label={f.label} active={activeFilters.has(f.id)} onPress={() => onToggle(f.id)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {ROW2.map((f) => (
          <Chip key={f.id} label={f.label} Icon={f.icon} active={activeFilters.has(f.id)} onPress={() => onToggle(f.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------- Cards ----------------

export const MatchedDishCard = memo(function MatchedDishCard({ row, isClosed, greyed, onPress }) {
  const { isDark } = useTheme();
  const [imgFailed, setImgFailed] = useState(false);
  const price = Number(row.categoryDishPrice || row.featuredPrice || 0);
  return (
    <ScalePressable
      scaleTo={0.98}
      disabled={isClosed}
      onPress={onPress}
      style={[
        styles.dishCard,
        { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray100, opacity: greyed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.dishImage, { backgroundColor: isDark ? tw.gray800 : tw.gray50, borderColor: isDark ? tw.gray700 : tw.gray100 }]}>
        {row.categoryDishImage && !imgFailed ? (
          <AppImage
            src={row.categoryDishImage}
            width={96}
            placeholderType="none"
            style={StyleSheet.absoluteFill}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]}>
            <UtensilsCrossed size={32} color={tw.gray300} />
          </View>
        )}
        <View style={styles.vegDotBox}>
          <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: row.categoryDishFoodType === "Veg" ? tw.green500 : tw.red500 }} />
        </View>
        {isClosed ? (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "rgba(0,0,0,0.4)", zIndex: 20 }]}>
            <View style={[styles.offlineTag, { paddingHorizontal: 8, paddingVertical: 4 }]}>
              <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 10, letterSpacing: 1.5 }}>OFFLINE</Text>
            </View>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, paddingVertical: 4, minWidth: 0 }}>
        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          <View style={[styles.pill, { backgroundColor: isDark ? "rgba(80,7,36,0.3)" : "#fdf2f8" }]}>
            <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: "700", letterSpacing: 0.9, color: isDark ? "#f472b6" : "#be185d" }}>
              {String(row.name || "").toUpperCase()}
            </Text>
          </View>
        </View>
        <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: "700", lineHeight: 18, marginBottom: 8, color: isDark ? "#ffffff" : tw.gray900 }}>
          {row.categoryDishName || row.featuredDish || row.name}
        </Text>
        <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Star size={12} color={tw.red500} fill={tw.red500} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: isDark ? tw.gray300 : tw.gray700 }}>{row.rating || "New"}</Text>
            </View>
            {row.deliveryTime ? (
              <>
                <View style={{ width: 4, height: 4, borderRadius: 999, backgroundColor: isDark ? tw.gray600 : tw.gray300 }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Clock size={12} color={isDark ? tw.gray400 : tw.gray500} />
                  <Text style={{ fontSize: 12, color: isDark ? tw.gray400 : tw.gray500 }}>{row.deliveryTime}</Text>
                </View>
              </>
            ) : null}
          </View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? "#ffffff" : tw.gray900 }}>₹{price.toFixed(2)}</Text>
        </View>
      </View>
    </ScalePressable>
  );
});

export const CategoryRestaurantCard = memo(function CategoryRestaurantCard({ restaurant, index, isClosed, greyed, isFavorite, onToggleFavorite, onPress }) {
  const { isDark } = useTheme();
  const hasRecommendedImage =
    Array.isArray(restaurant.recommendedItems) &&
    restaurant.recommendedItems.some((item) => {
      const url = item?.image || item?.imageUrl || item?.photoUrl;
      return typeof url === "string" && url.trim().length > 0;
    });
  const dishName = restaurant.categoryDishName || restaurant.featuredDish;
  return (
    <ScalePressable scaleTo={0.98} disabled={isClosed} onPress={onPress}>
      <RestaurantCarouselStateProvider>
        <View
          style={[
            styles.restCard,
            shadow.md,
            { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray100, opacity: greyed ? 0.75 : 1 },
          ]}
        >
          <View style={styles.restImage}>
            <RestaurantImageCarousel
              restaurant={restaurant}
              priority={index < 3}
              autoPlay
              height={192}
              radiusStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
            />
            {isClosed ? (
              <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "rgba(0,0,0,0.4)", zIndex: 20 }]}>
                <View style={styles.offlineTag}>
                  <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 12, letterSpacing: 1.5 }}>OFFLINE</Text>
                </View>
              </View>
            ) : null}
            {!hasRecommendedImage && dishName ? (
              <View style={styles.dishBadge}>
                <Text numberOfLines={1} style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                  {`${dishName} • ₹${restaurant.categoryDishPrice || restaurant.featuredPrice || 0}`}
                </Text>
              </View>
            ) : null}
            {restaurant.isAd ? (
              <View style={styles.adBadge}>
                <Text style={{ color: "#ffffff", fontSize: 10 }}>Ad</Text>
              </View>
            ) : null}
            <Pressable
              onPress={onToggleFavorite}
              hitSlop={4}
              style={[styles.bookmarkBtn, shadow.sm, { backgroundColor: isDark ? "rgba(26,26,26,0.95)" : "rgba(255,255,255,0.95)" }]}
            >
              <Bookmark
                size={20}
                strokeWidth={2}
                color={isFavorite ? tw.red500 : isDark ? tw.gray400 : tw.gray600}
                fill={isFavorite ? tw.red500 : "transparent"}
              />
            </Pressable>
          </View>
          <View style={{ padding: 16, backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: "700", color: isDark ? "#ffffff" : tw.gray900 }}>
                {restaurant.name}
              </Text>
              <View style={[styles.ratingBadge, shadow.sm]}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>{restaurant.rating || "New"}</Text>
                <Star size={14} color="#ffffff" fill="#ffffff" />
              </View>
            </View>
            {restaurant.deliveryTime || restaurant.distance ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                {restaurant.deliveryTime ? (
                  <>
                    <Clock size={16} strokeWidth={1.5} color={isDark ? tw.gray400 : tw.gray500} />
                    <Text style={{ fontSize: 14, fontWeight: "500", color: isDark ? tw.gray400 : tw.gray500 }}>{restaurant.deliveryTime}</Text>
                  </>
                ) : null}
                {restaurant.deliveryTime && restaurant.distance ? (
                  <Text style={{ marginHorizontal: 4, color: isDark ? tw.gray700 : tw.gray300 }}>|</Text>
                ) : null}
                {restaurant.distance ? (
                  <Text style={{ fontSize: 14, fontWeight: "500", color: isDark ? tw.gray400 : tw.gray500 }}>{restaurant.distance}</Text>
                ) : null}
              </View>
            ) : null}
            <RestaurantOfferBanner restaurant={restaurant} />
          </View>
        </View>
      </RestaurantCarouselStateProvider>
    </ScalePressable>
  );
});

// ---------------- Filter sheet ----------------

const TABS = [
  { id: "sort", label: "Sort By", icon: ArrowDownUp },
  { id: "time", label: "Time", icon: Timer },
  { id: "rating", label: "Rating", icon: Star },
  { id: "distance", label: "Distance", icon: MapPin },
  { id: "price", label: "Dish Price", icon: IndianRupee },
  { id: "offers", label: "Offers", icon: BadgePercent },
  { id: "trust", label: "Trust", icon: ShieldCheck },
];
const SORT_OPTIONS = [
  { id: null, label: "Relevance" },
  { id: "price-low", label: "Price: Low to High" },
  { id: "price-high", label: "Price: High to Low" },
  { id: "rating-high", label: "Rating: High to Low" },
  { id: "rating-low", label: "Rating: Low to High" },
];

export function CategoryFilterSheet({ visible, onClose, sortBy, setSortBy, activeFilters, onToggle, onClearAll, onShowResults }) {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("sort");
  const [activeScrollSection, setActiveScrollSection] = useState("sort");
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const heightRef = useRef(0);

  const border = isDark ? tw.gray700 : tw.gray200;
  const idleText = isDark ? tw.gray300 : tw.gray700;
  const titleColor = isDark ? "#ffffff" : tw.gray900;
  const greenActive = { borderColor: tw.green600, backgroundColor: isDark ? "rgba(20,83,45,0.2)" : tw.green50 };
  const primaryActive = { borderColor: colors.primary, backgroundColor: isDark ? colors.primary + "33" : "#F9F9FB" };
  const hasAny = activeFilters.size > 0 || !!sortBy;

  const registerSection = (id) => (e) => {
    sectionY.current[id] = e.nativeEvent.layout.y;
  };

  // Web IntersectionObserver with rootMargin -20% top / -70% bottom: the section crossing 20% of the pane.
  const onScroll = (e) => {
    const line = e.nativeEvent.contentOffset.y + heightRef.current * 0.2;
    let current = null;
    TABS.forEach((t) => {
      const y = sectionY.current[t.id];
      if (y !== undefined && y <= line) current = t.id;
    });
    if (current && current !== activeScrollSection) {
      setActiveScrollSection(current);
      setActiveTab(current);
    }
  };

  const section = (id, title, children) => (
    <View key={id} onLayout={registerSection(id)} style={{ marginBottom: 32 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", color: titleColor, marginBottom: 16 }}>{title}</Text>
      {children}
    </View>
  );

  const tile = (id, label, Icon, { green = true, starFill = false } = {}) => {
    const active = activeFilters.has(id);
    return (
      <Pressable key={id} onPress={() => onToggle(id)} style={[styles.tile, { borderColor: border }, active && (green ? greenActive : primaryActive)]}>
        <Icon
          size={24}
          strokeWidth={starFill ? 2 : 1.5}
          color={active ? colors.primary : starFill ? (isDark ? tw.gray500 : tw.gray400) : isDark ? tw.gray400 : tw.gray600}
          fill={starFill && active ? colors.primary : "transparent"}
        />
        <Text style={{ fontSize: 14, fontWeight: "500", color: active ? colors.primary : idleText }}>{label}</Text>
      </Pressable>
    );
  };

  const row = (id, label) => {
    const active = activeFilters.has(id);
    return (
      <Pressable key={id} onPress={() => onToggle(id)} style={[styles.optionRow, { borderColor: border }, active && greenActive]}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: active ? colors.primary : idleText }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="85%" style={{ height: "85%", backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }}>
      <View style={[styles.sheetHeader, { borderBottomColor: isDark ? tw.gray800 : tw.gray200 }]}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: titleColor }}>Filters and sorting</Text>
        <Pressable onPress={onClearAll} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.primary }}>Clear all</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={[styles.sidebar, { backgroundColor: isDark ? "#0a0a0a" : tw.gray50, borderRightColor: isDark ? tw.gray800 : tw.gray200 }]}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeScrollSection === tab.id || activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  setActiveTab(tab.id);
                  const y = tab.id === "trust" ? undefined : sectionY.current[tab.id];
                  if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: true });
                }}
                style={[styles.tab, active && { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}
              >
                {active ? <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} /> : null}
                <Icon size={20} strokeWidth={1.5} color={active ? colors.primary : isDark ? tw.gray400 : tw.gray500} />
                <Text style={{ fontSize: 12, fontWeight: "500", textAlign: "center", color: active ? colors.primary : isDark ? tw.gray400 : tw.gray500 }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          scrollEventThrottle={32}
          onScroll={onScroll}
          onLayout={(e) => {
            heightRef.current = e.nativeEvent.layout.height;
          }}
        >
          {section("sort", "Sort by", (
            <View style={{ gap: 12 }}>
              {SORT_OPTIONS.map((option) => {
                const active = sortBy === option.id;
                return (
                  <Pressable
                    key={option.id || "relevance"}
                    onPress={() => setSortBy(option.id)}
                    style={[styles.optionRow, { borderColor: border }, active && primaryActive]}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "500", color: active ? (isDark ? "#4ade80" : tw.green600) : idleText }}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          {section("time", "Estimated Time", (
            <View style={styles.tileGrid}>
              {tile("under-30-mins", "Under 30 mins", Timer, { green: false })}
              {tile("delivery-under-45", "Under 45 mins", Timer, { green: false })}
            </View>
          ))}
          {section("rating", "Restaurant Rating", (
            <View style={styles.tileGrid}>
              {tile("rating-35-plus", "Rated 3.5+", Star, { green: false, starFill: true })}
              {tile("rating-4-plus", "Rated 4.0+", Star, { starFill: true })}
              {tile("rating-45-plus", "Rated 4.5+", Star, { starFill: true })}
            </View>
          ))}
          {section("distance", "Distance", (
            <View style={styles.tileGrid}>
              {tile("distance-under-1km", "Under 1 km", MapPin)}
              {tile("distance-under-2km", "Under 2 km", MapPin)}
            </View>
          ))}
          {section("price", "Dish Price", (
            <View style={{ gap: 12 }}>
              {row("price-under-200", "Under ₹200")}
              {row("under-250", "Under ₹250")}
              {row("price-under-500", "Under ₹500")}
            </View>
          ))}
          {section("offers", "Offers", (
            <View style={styles.tileGrid}>
              {tile("flat-50-off", "Flat 50% OFF", BadgePercent)}
              {tile("price-match", "Price Match", BadgePercent)}
            </View>
          ))}
          {activeTab === "trust" ? (
            <View style={{ gap: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "600", color: titleColor }}>Trust Markers</Text>
              <View style={{ gap: 12 }}>
                <View style={[styles.optionRow, { borderColor: border }]}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: idleText }}>Top Rated</Text>
                </View>
                <View style={[styles.optionRow, { borderColor: border }]}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: idleText }}>Trusted by 1000+ users</Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <View style={[styles.footer, { borderTopColor: isDark ? tw.gray800 : tw.gray200, backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
        <Pressable onPress={onClose} style={styles.footerBtn}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: idleText }}>Close</Text>
        </Pressable>
        <Pressable
          onPress={onShowResults}
          style={[styles.footerBtn, { borderRadius: 12, backgroundColor: hasAny ? colors.primary : isDark ? tw.gray700 : tw.gray200 }]}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: hasAny ? "#ffffff" : isDark ? tw.gray400 : tw.gray500 }}>Show results</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  backBtn: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  searchInput: { height: 36, borderRadius: 8, borderWidth: 1, paddingLeft: 32, paddingRight: 12, fontSize: 12 },
  rail: { borderBottomWidth: 1 },
  railItem: { alignItems: "center", gap: 6, paddingBottom: 8 },
  railCircle: { width: 64, height: 64, borderRadius: 999, borderWidth: 2, overflow: "hidden" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 4 },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  dishCard: { flexDirection: "row", gap: 12, borderWidth: 1, padding: 8, borderRadius: 16, ...shadow.sm },
  dishImage: { width: 96, height: 96, borderRadius: 12, overflow: "hidden", borderWidth: 1 },
  vegDotBox: {
    position: "absolute",
    top: 6,
    left: 6,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 2,
    padding: 2,
    borderWidth: 1,
    borderColor: tw.gray200,
  },
  offlineTag: {
    backgroundColor: "rgba(156,163,175,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, maxWidth: "100%" },
  restCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  restImage: { height: 192, width: "100%", overflow: "hidden", borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  dishBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 64,
    zIndex: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(17,24,39,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  adBadge: { position: "absolute", top: 12, right: 56, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  bookmarkBtn: { position: "absolute", top: 12, right: 12, height: 36, width: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", zIndex: 10 },
  ratingBadge: { backgroundColor: "#059669", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  sidebar: { width: 96, borderRightWidth: 1 },
  tab: { alignItems: "center", gap: 4, paddingVertical: 16, paddingHorizontal: 8 },
  tabIndicator: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "47%", flexGrow: 1, maxWidth: "48.5%", alignItems: "center", gap: 8, padding: 16, borderRadius: 12, borderWidth: 1 },
  optionRow: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  footer: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1 },
  footerBtn: { flex: 1, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
});
