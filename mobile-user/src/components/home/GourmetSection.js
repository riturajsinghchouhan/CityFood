// Home.jsx "Gourmet Restaurants" horizontal scroller (web L2497-2550).
import { router } from "expo-router";
import { Star } from "lucide-react-native";
import { memo, useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { RestaurantImageCarousel } from "../restaurant-cards";
import { ScalePressable, Text } from "../ui";

const CARD = 240;
const GAP = 16;

const GourmetCard = memo(function GourmetCard({ restaurant }) {
  const { colors, isDark } = useTheme();
  const slug = restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, "-");
  return (
    <ScalePressable
      scaleTo={0.95}
      onPress={() => router.push(`/restaurants/${slug}`)}
      style={[styles.card, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray100 }]}
    >
      <View style={[styles.media, { backgroundColor: isDark ? tw.gray900 : tw.gray50 }]}>
        <RestaurantImageCarousel restaurant={restaurant} height={128} radiusStyle={styles.topRadius} />
        <View style={styles.rating} pointerEvents="none">
          <Star size={12} color={colors.primary} fill={colors.primary} />
          <Text style={styles.ratingText}>{Number(restaurant.rating || 0).toFixed(1)}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.name, { color: isDark ? "#ffffff" : tw.gray900 }]}>
          {restaurant.name}
        </Text>
        <Text numberOfLines={1} style={[styles.cuisines, { color: isDark ? tw.gray400 : tw.gray500 }]}>
          {Array.isArray(restaurant.cuisines) ? restaurant.cuisines.join(", ") : "Various Cuisines"}
        </Text>
      </View>
    </ScalePressable>
  );
});

function GourmetSection({ restaurants }) {
  const { colors, isDark } = useTheme();
  const renderItem = useCallback(({ item }) => <GourmetCard restaurant={item} />, []);
  if (!restaurants || restaurants.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: isDark ? "#ffffff" : tw.gray900 }]}>Gourmet Restaurants</Text>
          <Text style={[styles.subtitle, { color: isDark ? tw.gray400 : tw.gray500 }]}>Premium spots just for you</Text>
        </View>
        <ScalePressable onPress={() => router.push("/gourmet")} hitSlop={8}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
        </ScalePressable>
      </View>
      <FlatList
        horizontal
        data={restaurants}
        keyExtractor={(r, index) => String(r.mongoId || r.id || r._id || index)}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={CARD + GAP}
        decelerationRate="fast"
        initialNumToRender={3}
      />
    </View>
  );
}

export default memo(GourmetSection);

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  header: { paddingHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "900", letterSpacing: -0.45 },
  subtitle: { fontSize: 12, fontWeight: "500" },
  seeAll: { fontSize: 12, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: GAP },
  card: { width: CARD, borderRadius: 16, overflow: "hidden", borderWidth: 1, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  media: { height: 128 },
  topRadius: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  rating: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  ratingText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
  body: { padding: 12 },
  name: { fontSize: 14, fontWeight: "700" },
  cuisines: { fontSize: 12, marginTop: 2 },
});
