// Restaurant / dish card of Favorites.jsx (Card with a 128px image, overlay actions and a CTA).
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Bookmark, Clock, Heart, MapPin, Star } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { AppImage, Card, Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { c, webVars } from "./palette";

export const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80";

function CtaButton({ label, color }) {
  return (
    <View style={[styles.cta, { backgroundColor: color }]}>
      <Text style={styles.ctaText}>{label}</Text>
      <ArrowRight size={12} color="#ffffff" />
    </View>
  );
}

function ImageHeader({ image, width, onRemove, removeIcon, rating }) {
  const RemoveIcon = removeIcon;
  return (
    <View style={styles.imageWrap}>
      <AppImage src={image || FALLBACK_IMAGE} fallbackSrc={FALLBACK_IMAGE} width={width} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]}
        style={StyleSheet.absoluteFill}
      />
      <Pressable onPress={onRemove} hitSlop={6} style={styles.removeBtn} accessibilityLabel="Remove from favorites">
        <RemoveIcon size={16} color={c.red500} fill={c.red500} />
      </Pressable>
      {rating != null ? (
        <View style={styles.ratingPill}>
          <Star size={12} color={c.yellow400} fill={c.yellow400} />
          <Text style={styles.ratingText}>{rating}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function RestaurantFavoriteCard({ restaurant, width, onPress, onRemove }) {
  const { colors, isDark } = useTheme();
  const v = webVars(isDark);
  return (
    <Pressable onPress={onPress} style={{ width }}>
      <Card style={[styles.card, { borderColor: v.border }]}>
        <ImageHeader
          image={restaurant.image}
          width={width}
          onRemove={onRemove}
          removeIcon={Heart}
          rating={restaurant.rating ?? ""}
        />
        <View style={styles.content}>
          <View>
            <Text style={[styles.name, { color: v.foreground }]} numberOfLines={1}>
              {restaurant.name}
            </Text>
            <Text style={[styles.sub, { color: v.mutedForeground }]} numberOfLines={1}>
              {restaurant.cuisine}
            </Text>
          </View>
          <View style={[styles.metaRow, { borderTopColor: v.border }]}>
            <View style={styles.meta}>
              <Clock size={12} color={v.mutedForeground} />
              <Text style={[styles.metaText, { color: v.mutedForeground }]}>{restaurant.deliveryTime}</Text>
            </View>
            <View style={styles.meta}>
              <MapPin size={12} color={v.mutedForeground} />
              <Text style={[styles.metaText, { color: v.mutedForeground }]}>{restaurant.distance}</Text>
            </View>
          </View>
          <CtaButton label="View Restaurant" color={colors.primary} />
        </View>
      </Card>
    </Pressable>
  );
}

export function DishFavoriteCard({ dish, width, onPress, onRemove }) {
  const { colors, isDark } = useTheme();
  const v = webVars(isDark);
  const isVeg = dish.foodType === "Veg";
  const mark = isVeg ? c.green600 : c.red600;
  return (
    <Pressable onPress={onPress} style={{ width }}>
      <Card style={[styles.card, { borderColor: v.border }]}>
        <ImageHeader image={dish.image} width={width} onRemove={onRemove} removeIcon={Bookmark} />
        <View style={styles.content}>
          <View>
            <Text style={[styles.name, { color: v.foreground }]} numberOfLines={1}>
              {dish.name}
            </Text>
            <Text style={[styles.subPlain, { color: v.mutedForeground }]} numberOfLines={1}>
              {dish.restaurantName || "Restaurant"}
            </Text>
          </View>
          <View style={[styles.metaRow, { borderTopColor: v.border }]}>
            <View style={styles.meta}>
              <View style={[styles.vegBox, { borderColor: mark }]}>
                <View style={[styles.vegDot, { backgroundColor: mark }]} />
              </View>
              <Text style={[styles.metaText, { color: v.mutedForeground }]}>{dish.foodType || "N/A"}</Text>
            </View>
            <Text style={[styles.price, { color: colors.primary }]}>
              {"₹"}
              {Math.round(dish.price || 0)}
            </Text>
          </View>
          <CtaButton label="View Dish" color={colors.primary} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", gap: 24, flex: 1 },
  imageWrap: { height: 128, width: "100%", overflow: "hidden" },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  ratingText: { fontWeight: "700", fontSize: 12, color: "#3c0f3d" },
  content: { padding: 12, gap: 8 },
  name: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  sub: { fontSize: 12, fontWeight: "500" },
  subPlain: { fontSize: 12 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  metaText: { fontSize: 12, fontWeight: "500" },
  vegBox: { width: 12, height: 12, borderWidth: 2, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 6, height: 6, borderRadius: 9999 },
  price: { fontSize: 14, fontWeight: "700" },
  cta: {
    height: 32,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  ctaText: { color: "#ffffff", fontSize: 12, fontWeight: "500" },
});
