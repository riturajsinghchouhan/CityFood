// Port of components/user/home/MealsUnderSection.jsx: "Meals under ₹X" dishes from
// /foods/public with a round add button that turns into a −/qty/+ stepper.
import { router } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import { memo, useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { getPublicFoods } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { buildCartLineId, useCart } from "../../context/CartContext";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { AppImage, Text, toast } from "../ui";

const CARD = 144;

function VegDot({ isVeg }) {
  const color = isVeg ? tw.green600 : tw.red600;
  return (
    <View style={[styles.vegBox, { borderColor: color }]}>
      <View style={[styles.vegDot, { backgroundColor: color }]} />
    </View>
  );
}

const FoodCard = memo(function FoodCard({ food, quantity, onAdd, onChange }) {
  const { colors, isDark } = useTheme();
  const inCart = quantity > 0;
  const isVeg = food.foodType === "Veg" || food.isVeg;
  const cardBg = isDark ? "#1a1a1a" : "#ffffff";
  return (
    <Pressable
      onPress={() => router.push(`/restaurants/${food.restaurantId}`)}
      style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? tw.gray800 : tw.gray100 }]}
    >
      <View style={[styles.media, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]}>
        {food.image ? (
          <AppImage src={food.image} width={CARD} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.noImage}>
            <Text style={styles.noImageText}>No image</Text>
          </View>
        )}
        {food.isRecommended || food.isPopular ? (
          <View style={[styles.popular, { backgroundColor: isDark ? "rgba(26,26,26,0.95)" : "rgba(255,255,255,0.95)" }]}>
            <Text style={[styles.popularText, { color: isDark ? "#00d492" : "#009966" }]}>Popular</Text>
          </View>
        ) : null}
        <View style={styles.action}>
          {inCart ? (
            <View style={[styles.stepper, { backgroundColor: cardBg, borderColor: colors.primary }]}>
              <Pressable onPress={() => onChange(food, quantity - 1)} hitSlop={6} style={styles.stepBtn} accessibilityLabel="Decrease quantity">
                <Minus size={14} color={colors.primary} strokeWidth={2.5} />
              </Pressable>
              <Text style={[styles.qty, { color: colors.primary }]}>{quantity || 1}</Text>
              <Pressable onPress={() => onChange(food, quantity + 1)} hitSlop={6} style={styles.stepBtn} accessibilityLabel="Increase quantity">
                <Plus size={14} color={colors.primary} strokeWidth={2.5} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => onAdd(food)}
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: cardBg, borderColor: colors.primary, transform: [{ scale: pressed ? 0.9 : 1 }] },
              ]}
              accessibilityLabel={`Add ${food.name} to cart`}
            >
              <Plus size={16} color={colors.primary} strokeWidth={2.8} />
            </Pressable>
          )}
        </View>
      </View>
      <View style={styles.body}>
        <View>
          <View style={styles.nameRow}>
            <VegDot isVeg={isVeg} />
            <Text numberOfLines={1} style={[styles.name, { color: isDark ? "#ffffff" : tw.gray900 }]}>
              {food.name}
            </Text>
          </View>
          <Text numberOfLines={1} style={[styles.restaurant, { color: isDark ? tw.gray400 : tw.gray500 }]}>
            {food.restaurantName}
          </Text>
        </View>
        <Text style={[styles.price, { color: isDark ? "#ffffff" : tw.gray900 }]}>₹{food.price}</Text>
      </View>
    </Pressable>
  );
});

function MealsUnderSection({ config, zoneId }) {
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { addToCart, updateQuantity, getCartItem } = useCart();
  const [foods, setFoods] = useState([]);
  const enabled = config?.enabled !== false;
  const priceLimit = Number(config?.priceLimit) || 200;
  const maxItems = Number(config?.maxItems) || 20;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    getPublicFoods({ maxPrice: priceLimit, limit: maxItems, ...(zoneId ? { zoneId } : {}) })
      .then((data) => {
        if (!cancelled) setFoods(Array.isArray(data?.foods) ? data.foods : []);
      })
      .catch(() => {
        if (!cancelled) setFoods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, priceLimit, maxItems, zoneId]);

  const handleAdd = useCallback(
    (food) => {
      if (!isAuthenticated) {
        toast.error("Please login to add items to cart");
        router.push({ pathname: "/login", params: { from: "/" } });
        return;
      }
      const res = addToCart({
        id: buildCartLineId(food.id),
        itemId: food.id,
        name: food.name,
        price: food.price,
        image: food.image,
        restaurantId: food.restaurantId,
        restaurant: food.restaurantName,
        restaurantName: food.restaurantName,
        foodType: food.foodType,
        isVeg: food.foodType === "Veg" || food.isVeg,
      });
      if (res?.ok === false) {
        toast.error(res.error || "Cannot add item from different restaurant. Please clear cart first.");
        return;
      }
      toast.success(`Added ${food.name} to cart`);
    },
    [isAuthenticated, addToCart],
  );

  const handleChange = useCallback((food, quantity) => updateQuantity(food.id, quantity), [updateQuantity]);

  const renderItem = useCallback(
    ({ item }) => {
      const cartItem = getCartItem(item.id);
      return <FoodCard food={item} quantity={cartItem?.quantity || 0} onAdd={handleAdd} onChange={handleChange} />;
    },
    [getCartItem, handleAdd, handleChange],
  );

  if (!enabled || foods.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: isDark ? "#ffffff" : tw.gray900 }]}>
          {config?.title || "Meals under"} ₹{priceLimit}
        </Text>
        <View style={[styles.line, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]} />
      </View>
      <FlatList
        horizontal
        data={foods}
        keyExtractor={(food, index) => String(food.id || index)}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        initialNumToRender={4}
      />
    </View>
  );
}

export default memo(MealsUnderSection);

const styles = StyleSheet.create({
  section: { paddingTop: 8 },
  headingRow: { paddingHorizontal: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { fontSize: 18, fontWeight: "700", lineHeight: 23 },
  line: { height: 1, flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 16 },
  card: { width: CARD, borderRadius: 16, overflow: "hidden", borderWidth: 1, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  media: { width: CARD, height: CARD, overflow: "hidden" },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  noImageText: { fontSize: 12, color: tw.gray400 },
  popular: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  popularText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.25 },
  action: { position: "absolute", right: 8, bottom: 8, zIndex: 10 },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    paddingHorizontal: 6,
    gap: 4,
    borderRadius: 999,
    borderWidth: 2,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  stepBtn: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  qty: { fontSize: 12, fontWeight: "700", minWidth: 14, textAlign: "center" },
  body: { padding: 10, flex: 1, justifyContent: "space-between" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  vegBox: { width: 12, height: 12, borderRadius: 3, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  name: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  restaurant: { fontSize: 12 },
  price: { fontSize: 14, fontWeight: "700", marginTop: 6 },
});
