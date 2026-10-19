// Pieces of Under250.jsx: banner carousel with floating back/search, category chips,
// Sort / Under 30 mins row, restaurant sections with the horizontal dish scroller, skeletons.
import { LinearGradient } from "expo-linear-gradient";
import { ArrowDownUp, ArrowLeft, ArrowRight, ChevronDown, Search, Star, Timer, UtensilsCrossed, X } from "lucide-react-native";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { AppImage, ScalePressable, Text, inputFont } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";
import { RUPEE, getUnder250DiscountPercent } from "../../screens/browse/lib";

// ---------------- Banner ----------------

function Glint({ width, height }) {
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(4000),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const w = width * 1.5;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden", zIndex: 10 }]}>
      <Animated.View
        style={{
          position: "absolute",
          top: -height * 0.25,
          bottom: -height * 0.25,
          width: w,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-2 * w, 2 * w] }) }, { skewX: "-20deg" }],
        }}
      >
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.2)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function FloatingRoundButton({ onPress, children, style }) {
  return (
    <ScalePressable scaleTo={0.95} onPress={onPress} style={[styles.floatBtn, style]}>
      {children}
    </ScalePressable>
  );
}

export function Under250Banner({ images, loading, onBack, showSearch, onOpenSearch, onCloseSearch, searchQuery, setSearchQuery }) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const height = Math.min(width / 2, 240);
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);
  const swipingRef = useRef(false);
  const timerRef = useRef(null);
  const count = images.length;

  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);

  const startAuto = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      if (!swipingRef.current) setIndex((prev) => (prev + 1) % count);
    }, 3500);
  }, [count]);

  useEffect(() => {
    startAuto();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startAuto]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: safeIndex * width, animated: true });
  }, [safeIndex, width]);

  const [searchAnim] = useState(() => new Animated.Value(0));
  const [searchMounted, setSearchMounted] = useState(showSearch);
  if (showSearch && !searchMounted) setSearchMounted(true);
  useEffect(() => {
    if (showSearch) {
      Animated.spring(searchAnim, { toValue: 1, damping: 25, stiffness: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(searchAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setSearchMounted(false);
      });
    }
  }, [showSearch, searchAnim]);

  return (
    <View style={{ width: "100%", height }}>
      <FloatingRoundButton onPress={onBack} style={{ left: 16 }}>
        <ArrowLeft size={20} color="#ffffff" />
      </FloatingRoundButton>
      <FloatingRoundButton onPress={onOpenSearch} style={{ right: 16 }}>
        <Search size={20} color="#ffffff" />
      </FloatingRoundButton>

      {searchMounted ? (
        <Animated.View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? "#000000" : "#ffffff",
              borderBottomColor: isDark ? tw.gray800 : tw.gray100,
              opacity: searchAnim,
              transform: [{ translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] }) }],
            },
          ]}
        >
          <Pressable onPress={onCloseSearch} hitSlop={8} style={{ padding: 8, marginLeft: -8 }}>
            <ArrowLeft size={24} color={isDark ? tw.gray400 : tw.gray500} />
          </Pressable>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Search size={16} color={tw.gray400} style={{ position: "absolute", left: 12, zIndex: 1 }} />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search dishes or restaurants..."
              placeholderTextColor={tw.gray400}
              style={[
                styles.searchInput,
                inputFont,
                { backgroundColor: isDark ? tw.gray900 : tw.gray100, color: isDark ? "#ffffff" : tw.gray900 },
              ]}
            />
            {searchQuery ? (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                style={[styles.clearBtn, { backgroundColor: isDark ? tw.gray800 : "#ffffff" }]}
              >
                <X size={14} color={tw.gray400} />
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {count > 0 ? (
        <View style={[styles.bannerClip, { height }]}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={count > 1}
            onScrollBeginDrag={() => {
              swipingRef.current = true;
            }}
            onMomentumScrollEnd={(e) => {
              swipingRef.current = false;
              const next = Math.round(e.nativeEvent.contentOffset.x / width);
              if (next !== safeIndex) {
                setIndex(next);
                startAuto();
              }
            }}
          >
            {images.map((src, i) => (
              <View key={`${src}-${i}`} style={{ width, height }}>
                <AppImage src={src} width={width} priority={i === 0} style={StyleSheet.absoluteFill} />
                <LinearGradient
                  pointerEvents="none"
                  colors={["transparent", "rgba(0,0,0,0.2)"]}
                  style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height / 2 }}
                />
              </View>
            ))}
          </ScrollView>
          <Glint width={width} height={height} />
        </View>
      ) : null}
      {count === 0 && !loading ? (
        <LinearGradient
          colors={isDark ? ["#3c0f3d", colors.secondary] : ["#fcf4f9", "#f5e8f1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bannerClip, { height }]}
        />
      ) : null}
    </View>
  );
}

// ---------------- Category chips ----------------

function ChipItem({ label, active, onPress, children }) {
  const { colors, isDark } = useTheme();
  return (
    <ScalePressable scaleTo={0.95} onPress={onPress} style={styles.chip}>
      {children}
      <Text
        numberOfLines={1}
        style={[
          styles.chipLabel,
          { color: active ? colors.primary : isDark ? tw.gray300 : tw.gray700, fontWeight: active ? "700" : "600" },
        ]}
      >
        {label}
      </Text>
    </ScalePressable>
  );
}

export function Under250CategoryChips({ categories, loading, activeCategory, onSelect }) {
  const { colors, isDark } = useTheme();
  const ring = { boxShadow: `0px 0px 0px 2px ${colors.primary}40, ${shadow.md.boxShadow}` };
  return (
    <View
      style={[
        styles.stickyWrap,
        { backgroundColor: isDark ? "rgba(10,10,10,0.95)" : "rgba(255,255,255,0.95)", borderBottomColor: isDark ? tw.gray800 : tw.gray100 },
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <ChipItem label="All" active={!activeCategory} onPress={() => onSelect(null)}>
          <View
            style={[
              styles.chipCircle,
              styles.center,
              !activeCategory
                ? [{ backgroundColor: colors.primary, borderColor: colors.primary }, ring]
                : { backgroundColor: isDark ? "#1a1a1a" : tw.gray50, borderColor: isDark ? tw.gray800 : tw.gray100 },
            ]}
          >
            <UtensilsCrossed size={24} color={!activeCategory ? "#ffffff" : isDark ? tw.gray400 : tw.gray500} />
          </View>
        </ChipItem>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <View key={`skel-cat-${i}`} style={styles.chip}>
                <View style={[styles.chipCircle, { borderWidth: 0, backgroundColor: isDark ? tw.gray800 : tw.gray200 }]} />
                <View style={{ height: 12, width: 48, borderRadius: 4, backgroundColor: isDark ? tw.gray800 : tw.gray200 }} />
              </View>
            ))
          : categories.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <ChipItem key={category.id} label={category.name} active={isActive} onPress={() => onSelect(isActive ? null : category.id)}>
                  <View
                    style={[
                      styles.chipCircle,
                      { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isActive ? colors.primary : isDark ? tw.gray800 : tw.gray100 },
                      isActive ? ring : shadow.sm,
                    ]}
                  >
                    <AppImage src={category.image} width={62} style={styles.chipImage} />
                  </View>
                </ChipItem>
              );
            })}
      </ScrollView>
    </View>
  );
}

// ---------------- Sort / Under 30 mins ----------------

export function Under250FilterRow({ sortLabel, onOpenSort, under30, onToggleUnder30 }) {
  const { colors, isDark } = useTheme();
  const idle = {
    backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
    borderColor: isDark ? tw.gray800 : tw.gray200,
  };
  const idleText = isDark ? tw.gray300 : tw.gray700;
  return (
    <View style={styles.filterRow}>
      <Pressable onPress={onOpenSort} style={({ pressed }) => [styles.filterBtn, idle, { gap: 8, opacity: pressed ? 0.85 : 1 }]}>
        <ArrowDownUp size={16} color={idleText} style={{ transform: [{ rotate: "90deg" }] }} />
        <Text style={{ fontSize: 14, fontWeight: "500", color: idleText }}>{sortLabel}</Text>
        <ChevronDown size={12} color={idleText} />
      </Pressable>
      <Pressable
        onPress={onToggleUnder30}
        style={({ pressed }) => [
          styles.filterBtn,
          under30 ? { backgroundColor: colors.primary, borderColor: colors.primary } : idle,
          { gap: 6, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Timer size={12} color={under30 ? "#ffffff" : isDark ? tw.gray300 : tw.gray600} />
        <Text style={{ fontSize: 12, fontWeight: "500", color: under30 ? "#ffffff" : isDark ? tw.gray300 : tw.gray600 }}>Under 30 mins</Text>
      </Pressable>
    </View>
  );
}

// ---------------- Dish card + horizontal scroller ----------------

function DishPrice({ restaurant, item }) {
  const { isDark } = useTheme();
  const discount = getUnder250DiscountPercent(restaurant, item);
  const priceColor = isDark ? "#ffffff" : tw.gray900;
  return (
    <View>
      {discount > 0 ? (
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: priceColor }}>
              {RUPEE}
              {Math.round(item.price * (1 - discount / 100))}
            </Text>
            <Text style={{ fontSize: 12, color: tw.gray500, textDecorationLine: "line-through" }}>
              {RUPEE}
              {Math.round(item.price)}
            </Text>
          </View>
          <View style={styles.offBadge}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: tw.green600 }}>{`${discount}% OFF`}</Text>
          </View>
        </View>
      ) : (
        <Text style={{ fontSize: 16, fontWeight: "700", color: priceColor }}>
          {RUPEE}
          {Math.round(item.price)}
        </Text>
      )}
      {item.bestPrice ? <Text style={{ fontSize: 12, color: isDark ? tw.gray400 : tw.gray500 }}>Best price</Text> : null}
    </View>
  );
}

const DishCard = memo(function DishCard({ item, restaurant, quantity, isClosed, onItemPress, onViewCart, priority }) {
  const { colors, isDark } = useTheme();
  const isVeg = item.isVeg;
  const vegColor = isVeg ? tw.green600 : tw.red600;
  return (
    <Pressable onPress={() => !isClosed && onItemPress(item, restaurant)} style={styles.dishCard}>
      <View style={styles.dishImageWrap}>
        <AppImage src={item.image} width={140} priority={priority} style={StyleSheet.absoluteFill} />
        {isClosed ? (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "rgba(0,0,0,0.4)", zIndex: 20 }]}>
            <View style={styles.offlineTag}>
              <Text style={styles.offlineText}>OFFLINE</Text>
            </View>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <View style={[styles.vegBox, { borderColor: vegColor }]}>
          <View style={{ height: 8, width: 8, borderRadius: 999, backgroundColor: vegColor }} />
        </View>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "600", color: isDark ? "#ffffff" : tw.gray900 }}>
          {item.name}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <DishPrice restaurant={restaurant} item={item} />
        {isClosed ? (
          <View style={[styles.addBtn, { backgroundColor: isDark ? tw.gray700 : tw.gray400, borderColor: "transparent", paddingHorizontal: 16 }]}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff", letterSpacing: 0.3 }}>OFFLINE</Text>
          </View>
        ) : quantity > 0 ? (
          <ScalePressable
            scaleTo={0.95}
            onPress={onViewCart}
            style={[styles.addBtn, { borderColor: colors.primary, backgroundColor: isDark ? "rgba(39,39,42,0.3)" : "#ffffff", paddingHorizontal: 16 }]}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary, letterSpacing: 0.3 }}>VIEW CART</Text>
          </ScalePressable>
        ) : (
          <ScalePressable
            scaleTo={0.95}
            onPress={() => onItemPress(item, restaurant)}
            style={[styles.addBtn, shadow.sm, { borderColor: colors.primary, backgroundColor: isDark ? "#000000" : "#ffffff", paddingHorizontal: 24 }]}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>ADD</Text>
          </ScalePressable>
        )}
      </View>
    </Pressable>
  );
});

function HorizontalMenuScroller({ restaurant, quantities, isClosed, onItemPress, onViewCart }) {
  const { colors } = useTheme();
  const total = restaurant.menuItems.length;
  const [visibleCount, setVisibleCount] = useState(8);
  const visibleItems = restaurant.menuItems.slice(0, visibleCount);
  return (
    <FlatList
      horizontal
      data={visibleItems}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (visibleCount < total) setVisibleCount((prev) => Math.min(prev + 8, total));
      }}
      renderItem={({ item, index }) => (
        <DishCard
          item={item}
          restaurant={restaurant}
          quantity={quantities[item.id] || 0}
          isClosed={isClosed}
          onItemPress={onItemPress}
          onViewCart={onViewCart}
          priority={index < 4}
        />
      )}
      ListFooterComponent={
        visibleCount < total ? (
          <View style={[styles.center, { width: 64, height: 128 }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null
      }
    />
  );
}

export const Under250RestaurantSection = memo(function Under250RestaurantSection({
  restaurant,
  isClosed,
  quantities,
  onItemPress,
  onViewCart,
  onViewItems,
}) {
  const { colors, isDark } = useTheme();
  const meta = { fontSize: 14, fontWeight: "600", color: isDark ? tw.gray300 : tw.gray700 };
  const dot = <Text style={{ fontSize: 14, color: isDark ? tw.gray400 : tw.gray500 }}>•</Text>;
  const ratings = restaurant.totalRatings > 0
    ? `(${restaurant.totalRatings >= 1000 ? `${(restaurant.totalRatings / 1000).toFixed(1)}K+` : restaurant.totalRatings}+)`
    : "";
  return (
    <View style={[styles.section, { backgroundColor: isDark ? "#1a1a1a" : "#f8fafc", opacity: isClosed ? 0.7 : 1 }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: isDark ? "#ffffff" : tw.gray900, marginBottom: 6 }}>{restaurant.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={[styles.center, { width: 20, height: 20, borderRadius: 999, backgroundColor: tw.green600 }]}>
                <Star size={12} color="#ffffff" fill="#ffffff" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? tw.gray300 : tw.gray700 }}>
                {`${restaurant.rating} ${ratings}`.trim()}
              </Text>
            </View>
            {dot}
            {restaurant.distance ? (
              <>
                <Text style={meta}>{restaurant.distance}</Text>
                {dot}
              </>
            ) : null}
            <Text style={meta}>{restaurant.deliveryTime}</Text>
          </View>
        </View>
        <Pressable
          disabled={isClosed}
          onPress={() => onViewItems(restaurant)}
          style={{ flexDirection: "row", alignItems: "center", marginTop: 4, opacity: isClosed ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: isClosed ? tw.gray500 : colors.primary }}>
            {isClosed ? "Offline" : "View Items"}
          </Text>
          <ArrowRight size={16} color={isClosed ? tw.gray500 : colors.primary} style={{ marginLeft: 2 }} />
        </Pressable>
      </View>
      {restaurant.menuItems?.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <HorizontalMenuScroller
            restaurant={restaurant}
            quantities={quantities}
            isClosed={isClosed}
            onItemPress={onItemPress}
            onViewCart={onViewCart}
          />
        </View>
      ) : null}
    </View>
  );
});

// ---------------- Skeleton ----------------

export function Under250Skeleton() {
  const { isDark } = useTheme();
  const tint = isDark ? "rgba(124,45,18,0.3)" : tw.orange100;
  const light = isDark ? "rgba(124,45,18,0.2)" : tw.orange50;
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ gap: 32, opacity: pulse }}>
      {Array.from({ length: 3 }).map((_, r) => (
        <View key={`skel-rest-${r}`} style={{ paddingTop: 16 }}>
          <View style={{ gap: 12, marginBottom: 12 }}>
            <View style={{ height: 24, width: 192, borderRadius: 6, backgroundColor: tint }} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ height: 16, width: 80, borderRadius: 4, backgroundColor: tint }} />
              <View style={{ height: 16, width: 96, borderRadius: 4, backgroundColor: tint }} />
              <View style={{ height: 16, width: 64, borderRadius: 4, backgroundColor: tint }} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12, overflow: "hidden" }}>
            {Array.from({ length: 4 }).map((__, i) => (
              <View
                key={`skel-item-${r}-${i}`}
                style={[styles.skelCard, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? "rgba(124,45,18,0.2)" : tw.orange100 }]}
              >
                <View style={{ height: 128, backgroundColor: light }} />
                <View style={{ padding: 12, gap: 12 }}>
                  <View style={{ height: 20, width: "75%", borderRadius: 4, backgroundColor: tint }} />
                  <View style={{ height: 20, width: "25%", borderRadius: 4, backgroundColor: tint }} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <View style={{ height: 24, width: "33%", borderRadius: 4, backgroundColor: tint }} />
                    <View style={{ height: 32, width: 80, borderRadius: 999, backgroundColor: isDark ? "rgba(154,52,18,0.4)" : "#ffd6a7" }} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  floatBtn: {
    position: "absolute",
    top: 16,
    zIndex: 40,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow.lg,
  },
  searchBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    ...shadow.md,
  },
  searchInput: { height: 40, borderRadius: 12, paddingLeft: 36, paddingRight: 40, fontSize: 14 },
  clearBtn: { position: "absolute", right: 12, padding: 4, borderRadius: 999, ...shadow.sm },
  bannerClip: { width: "100%", overflow: "hidden", borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  stickyWrap: { paddingTop: 8, paddingHorizontal: 12, borderBottomWidth: 1, ...shadow.sm },
  chipRow: { gap: 12, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 4 },
  chip: { width: 68, alignItems: "center", gap: 6 },
  chipCircle: { width: 62, height: 62, borderRadius: 999, borderWidth: 2, overflow: "hidden" },
  chipImage: { width: "100%", height: "100%" },
  chipLabel: { fontSize: 11, textAlign: "center", width: "100%", paddingHorizontal: 2 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 4 + 8, paddingBottom: 8 },
  filterBtn: { height: 32, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  section: { padding: 16, marginBottom: 24, borderRadius: 16 },
  dishCard: { width: 140 },
  dishImageWrap: { width: 140, height: 140, borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  offlineTag: {
    backgroundColor: "rgba(156,163,175,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  offlineText: { color: "#ffffff", fontWeight: "900", fontSize: 12, letterSpacing: 1.5 },
  vegBox: { height: 14, width: 14, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  offBadge: {
    alignSelf: "flex-start",
    backgroundColor: tw.green50,
    borderWidth: 1,
    borderColor: "#b9f8cf",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addBtn: { height: 32, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  skelCard: { width: 200, borderRadius: 8, borderWidth: 1, overflow: "hidden" },
});
