// renderDishCard() of RestaurantDetails.jsx.
import { Bookmark, Clock, Minus, Plus, Share2, Tag, Utensils } from "lucide-react-native";
import { memo, useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { AppImage, ScalePressable, Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { calculateBestDiscount, getFoodPriceLabel, isRecommendedItem, RUPEE } from "../../screens/restaurant/lib";

const ORANGE = "#f97316";

// DishImage: "No image" box, pulse placeholder while loading.
export function DishImage({ src, width, style, emptyLabel = "No image" }) {
  const { isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }, style]}>
        <Text style={{ fontSize: 12, color: tw.gray400 }}>{emptyLabel}</Text>
      </View>
    );
  }
  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <AppImage
        src={src}
        width={width}
        placeholderType="none"
        style={StyleSheet.absoluteFill}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
      />
      {!loaded ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: isDark ? tw.gray700 : tw.gray200 }]}>
          <Utensils size={24} color={isDark ? tw.gray500 : tw.gray400} style={{ opacity: 0.5 }} />
        </View>
      ) : null}
    </View>
  );
}

export function VegIcon({ isVeg, size = 16 }) {
  const color = isVeg ? tw.green600 : tw.red600;
  return (
    <View style={{ width: size, height: size, borderWidth: 2, borderColor: color, borderRadius: 2, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size / 2, height: size / 2, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

function PriceBlock({ item, restaurant, isDark }) {
  const strong = isDark ? "#ffffff" : tw.gray900;
  const priceStr = getFoodPriceLabel(item);
  const isStartingFrom = priceStr.includes("Starting from");
  const priceNum = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(priceNum)) return <Text style={{ fontWeight: "600", color: strong }}>{priceStr}</Text>;
  const { discountValue, isFlatDiscount, discountAmount } = calculateBestDiscount(restaurant, item, priceNum);
  if (discountAmount > 0) {
    const discounted = Math.max(0, Math.round(priceNum - discountAmount));
    const pct = Math.round(((priceNum - discounted) / priceNum) * 100);
    const label = isFlatDiscount ? `${RUPEE}${discountValue} OFF` : `${pct}% OFF`;
    return (
      <View style={{ gap: 2, marginTop: 2 }}>
        {isStartingFrom ? <Text style={{ fontSize: 11, fontWeight: "500", color: tw.gray500 }}>Starting from</Text> : null}
        <View style={styles.row8}>
          <Text style={{ fontSize: 11, color: tw.gray500, textDecorationLine: "line-through" }}>
            {RUPEE}
            {priceNum}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: strong }}>
            {RUPEE}
            {discounted}
          </Text>
        </View>
        <View style={styles.offBadge}>
          <Tag size={8} color={tw.green600} style={{ marginRight: 2 }} />
          <Text style={styles.offBadgeText}>{label.toUpperCase()}</Text>
        </View>
      </View>
    );
  }
  if (isStartingFrom) {
    return (
      <View>
        <Text style={{ fontSize: 11, fontWeight: "500", color: tw.gray500, lineHeight: 14 }}>Starting from</Text>
        <Text style={{ fontWeight: "600", color: strong }}>
          {RUPEE}
          {priceNum}
        </Text>
      </View>
    );
  }
  return <Text style={{ fontWeight: "600", color: strong }}>{priceStr}</Text>;
}

function DishCard({
  item,
  restaurant,
  quantity,
  disabled,
  isRestaurantOffline,
  isFavorite,
  highlighted,
  onPress,
  onAdd,
  onIncrement,
  onDecrement,
  onBookmark,
  onShare,
}) {
  const { colors, isDark } = useTheme();
  const isVeg = item.foodType === "Veg";
  const prep = item.preparationTime && String(item.preparationTime).trim();

  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!highlighted) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [highlighted, pulse]);

  const iconBtn = [styles.iconBtn, { borderColor: isDark ? tw.gray700 : tw.gray300 }];

  return (
    <Animated.View
      style={[
        styles.card,
        { borderBottomColor: isDark ? tw.gray800 : tw.gray100 },
        highlighted && {
          borderWidth: 2,
          borderColor: "#ea580c",
          backgroundColor: isDark ? "rgba(67,20,7,0.2)" : "rgba(255,247,237,0.4)",
          marginHorizontal: 4,
          marginVertical: 6,
          boxShadow: "0px 0px 0px 4px rgba(234,88,12,0.2), 0px 8px 24px rgba(234,88,12,0.15)",
          opacity: pulse,
        },
      ]}
    >
      <Pressable style={styles.cardInner} onPress={onPress}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[styles.row8, { marginBottom: 4 }]}>
            <VegIcon isVeg={isVeg} />
            {item.isSpicy ? <Text style={{ fontSize: 12, fontWeight: "600", color: tw.red500 }}>Spicy</Text> : null}
          </View>
          <Text style={{ fontSize: 18, fontWeight: "700", lineHeight: 22, color: isDark ? "#ffffff" : tw.gray800 }}>{item.name}</Text>

          {isRecommendedItem(item) ? (
            <View style={[styles.row8, { marginTop: 4 }]}>
              <View style={[styles.bar, { backgroundColor: isDark ? tw.gray700 : tw.gray200 }]}>
                <View style={{ height: "100%", width: "75%", backgroundColor: colors.primary }} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: "500", color: isDark ? tw.gray400 : tw.gray500 }}>Highly reordered</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            <PriceBlock item={item} restaurant={restaurant} isDark={isDark} />
            {prep ? (
              <View style={[styles.prep, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]}>
                <Clock size={12} color={tw.gray500} />
                <Text style={{ fontSize: 12, fontWeight: "500", color: isDark ? tw.gray400 : tw.gray600, flexShrink: 1 }}>{prep}</Text>
              </View>
            ) : null}
          </View>

          {item.description ? (
            <Text numberOfLines={2} style={{ fontSize: 14, marginTop: 4, color: isDark ? tw.gray400 : tw.gray500 }}>
              {item.description}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
            <Pressable
              onPress={onBookmark}
              hitSlop={4}
              style={[
                iconBtn,
                isFavorite && { borderColor: tw.red500, backgroundColor: isDark ? "rgba(127,29,29,0.2)" : tw.red50 },
              ]}
            >
              <Bookmark
                size={18}
                color={isFavorite ? tw.red500 : isDark ? tw.gray400 : tw.gray600}
                fill={isFavorite ? tw.red500 : "transparent"}
              />
            </Pressable>
            <Pressable onPress={onShare} hitSlop={4} style={iconBtn}>
              <Share2 size={18} color={isDark ? tw.gray400 : tw.gray600} />
            </Pressable>
          </View>
        </View>

        <View style={styles.imageWrap}>
          <View style={[styles.image, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]}>
            <DishImage src={item.image} width={128} style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={styles.addWrap} pointerEvents="box-none">
          {quantity > 0 ? (
            <View
              style={[
                styles.addBtn,
                styles.stepper,
                disabled
                  ? { backgroundColor: isDark ? tw.gray800 : tw.gray300, borderColor: isDark ? tw.gray700 : tw.gray300, opacity: 0.5 }
                  : { backgroundColor: isDark ? "#000000" : "#ffffff", borderColor: ORANGE, boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)" },
              ]}
            >
              <Pressable disabled={disabled} hitSlop={8} onPress={onDecrement}>
                <Minus size={16} strokeWidth={3} color={disabled ? tw.gray500 : ORANGE} />
              </Pressable>
              <Text style={{ fontSize: 13, fontWeight: "900", color: isDark ? "#fb923c" : "#ea580c" }}>{quantity}</Text>
              <Pressable disabled={disabled} hitSlop={8} onPress={onIncrement}>
                <Plus size={16} strokeWidth={3} color={disabled ? tw.gray500 : ORANGE} />
              </Pressable>
            </View>
          ) : (
            <ScalePressable
              scaleTo={disabled ? 1 : 0.95}
              disabled={disabled}
              onPress={onAdd}
              style={[
                styles.addBtn,
                disabled
                  ? { backgroundColor: isDark ? tw.gray700 : tw.gray400, borderColor: "rgba(156,163,175,0.2)" }
                  : { backgroundColor: isDark ? "#000000" : "#ffffff", borderColor: ORANGE, boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)" },
              ]}
            >
              {isRestaurantOffline ? (
                <Text style={[styles.addText, { color: "#ffffff" }]}>OFFLINE</Text>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={[styles.addText, { color: disabled ? "#ffffff" : ORANGE }]}>ADD</Text>
                  <Text style={{ fontSize: 16, fontWeight: "500", marginTop: -2, color: disabled ? "#ffffff" : ORANGE }}>+</Text>
                </View>
              )}
            </ScalePressable>
          )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default memo(DishCard);

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  row8: { flexDirection: "row", alignItems: "center", gap: 8 },
  card: { borderBottomWidth: 1, borderRadius: 16 },
  cardInner: { flexDirection: "row", gap: 16, padding: 16 },
  bar: { height: 6, width: 64, borderRadius: 999, overflow: "hidden" },
  prep: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, flexShrink: 1 },
  offBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: tw.green50,
  },
  offBadgeText: { fontSize: 9, fontWeight: "700", color: tw.green600 },
  iconBtn: { padding: 6, borderWidth: 1, borderRadius: 8 },
  imageWrap: { width: 128, height: 128, flexShrink: 0 },
  image: { width: "100%", height: "100%", borderRadius: 16, overflow: "hidden", boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  addWrap: { position: "absolute", left: 0, right: 0, bottom: -12, alignItems: "center", zIndex: 10 },
  addBtn: {
    height: 32,
    minWidth: 90,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stepper: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 12 },
  addText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
});
