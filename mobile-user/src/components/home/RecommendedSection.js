// Home.jsx "Recommended For You" (web L2424-2479): 2-column grid of compact restaurant
// tiles (image carousel, rating chip, name, "Near & Fast").
import { router } from "expo-router";
import { Flame } from "lucide-react-native";
import { memo } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { RestaurantImageCarousel } from "../restaurant-cards";
import { Text } from "../ui";
import { FadeInUp } from "./anim";

const GAP = 12;

function Tile({ restaurant, width }) {
  const { colors, isDark } = useTheme();
  const slug = restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, "-");
  const rating = Number(restaurant.rating);
  return (
    <Pressable
      onPress={() => router.push(`/restaurants/${slug}`)}
      style={[
        styles.card,
        { width, backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray100 },
      ]}
    >
      <View style={[styles.media, { backgroundColor: tw.gray50 }]}>
        <RestaurantImageCarousel restaurant={restaurant} height={96} radiusStyle={styles.topRadius} />
        <View
          style={[styles.rating, rating > 0 ? styles.ratingOn : styles.ratingNew]}
          pointerEvents="none"
        >
          <Text style={[styles.ratingText, { color: rating > 0 ? "#ffffff" : tw.gray600 }]}>
            {rating > 0 ? rating.toFixed(1) : "NEW"}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.name, { color: isDark ? "#ffffff" : tw.gray900 }]}>
          {restaurant.name}
        </Text>
        <View style={styles.tagRow}>
          <Flame size={14} color={colors.primary} fill={colors.primary} />
          <Text style={[styles.tag, { color: colors.primary }]}>NEAR &amp; FAST</Text>
        </View>
      </View>
    </Pressable>
  );
}

function RecommendedSection({ restaurants }) {
  const { width: screenWidth } = useWindowDimensions();
  const { isDark } = useTheme();
  if (!restaurants || restaurants.length === 0) return null;
  const tileWidth = (screenWidth - 32 - GAP) / 2;
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: isDark ? tw.gray500 : tw.gray400 }]}>RECOMMENDED FOR YOU</Text>
      <View style={styles.grid}>
        {restaurants.map((restaurant, index) => {
          const key = `recommended-${restaurant.mongoId || restaurant.id || restaurant.slug || index}`;
          const tile = <Tile restaurant={restaurant} width={tileWidth} />;
          return index < 6 ? (
            <FadeInUp key={key} delay={index * 50}>
              {tile}
            </FadeInUp>
          ) : (
            <View key={key}>{tile}</View>
          );
        })}
      </View>
    </View>
  );
}

export default memo(RecommendedSection);

const styles = StyleSheet.create({
  section: { paddingTop: 4 },
  heading: { fontSize: 12, fontWeight: "600", letterSpacing: 1.2, marginBottom: 8, paddingHorizontal: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: 16 },
  card: { borderRadius: 20, overflow: "hidden", borderWidth: 1, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  media: { height: 96 },
  topRadius: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  rating: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)",
  },
  ratingOn: { backgroundColor: "rgba(0,0,0,0.8)" },
  ratingNew: { backgroundColor: "rgba(229,231,235,0.9)" },
  ratingText: { fontSize: 10, fontWeight: "500" },
  body: { padding: 10 },
  name: { fontSize: 14, fontWeight: "600", letterSpacing: -0.35 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  tag: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
});
