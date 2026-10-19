// Port of Frontend/src/modules/Food/pages/user/CollectionDetail.jsx: a placeholder that lists
// the favorite restaurants (useProfile().getFavorites()), as on web.
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Clock, Heart, MapPin, Star, Trash2 } from "lucide-react-native";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppImage, Button, Screen, Text } from "../../components/ui";
import { useProfile } from "../../context/ProfileContext";
import { goTo, useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const FALLBACK = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80";

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const { getFavorites, removeFavorite } = useProfile();
  const items = getFavorites();
  const name = `Collection ${id}`;
  const muted = colors.textMuted;
  const card = { backgroundColor: colors.card, borderColor: colors.border };

  const handleRemove = (slug) => {
    Alert.alert("", "Remove this restaurant from collection?", [
      { text: "Cancel", style: "cancel" },
      { text: "OK", onPress: () => removeFavorite(slug) },
    ]);
  };

  const backButton = (
    <Pressable onPress={goBack} hitSlop={6} style={styles.back}>
      <ArrowLeft size={16} color={colors.text} />
    </Pressable>
  );

  const background = (
    <LinearGradient
      colors={isDark ? ["#0a0a0a", "#0a0a0a"] : ["rgba(254,252,232,0.3)", "#ffffff", "rgba(255,247,237,0.2)"]}
      style={StyleSheet.absoluteFill}
    />
  );

  if (items.length === 0) {
    return (
      <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
        {background}
        <View style={{ padding: 16, gap: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {backButton}
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{name}</Text>
          </View>
          <View style={[styles.card, card, { paddingVertical: 48, alignItems: "center" }]}>
            <Heart size={64} color={muted} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, marginBottom: 16, color: muted }}>This collection is empty</Text>
            <Button title="Explore Restaurants" onPress={() => goTo("/")} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
      {background}
      <FlatList
        data={items}
        keyExtractor={(r) => r.slug}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 + insets.bottom, gap: 24 }}
        ListHeaderComponent={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {backButton}
            <View>
              <Text style={{ fontSize: 18, fontWeight: "700" }}>{name}</Text>
              <Text style={{ marginTop: 4, color: muted }}>
                {items.length} {items.length === 1 ? "restaurant" : "restaurants"}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item: restaurant }) => (
          <Pressable onPress={() => router.push(`/restaurants/${restaurant.slug}`)} style={[styles.card, card, { overflow: "hidden" }]}>
            <View style={{ height: 192, width: "100%" }}>
              <AppImage src={restaurant.image || FALLBACK} fallbackSrc={FALLBACK} width={400} style={StyleSheet.absoluteFill} placeholderType="shop" />
              <LinearGradient colors={["transparent", "transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
              <Pressable onPress={() => handleRemove(restaurant.slug)} style={styles.trash}>
                <Trash2 size={20} color={tw.red500} />
              </Pressable>
            </View>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "700", flex: 1 }}>
                  {restaurant.name}
                </Text>
                <View style={styles.rating}>
                  <Star size={12} color="#ffffff" fill="#ffffff" />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>{restaurant.rating || "4.5"}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Clock size={16} color={muted} />
                <Text style={{ color: muted }}>{restaurant.deliveryTime || "25-30 mins"}</Text>
                <Text style={{ color: muted }}>{"•"}</Text>
                <MapPin size={16} color={muted} />
                <Text style={{ color: muted }}>{restaurant.distance || "2.5 km"}</Text>
              </View>
              {restaurant.cuisine ? (
                <Text numberOfLines={1} style={{ color: muted }}>
                  {restaurant.cuisine}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { height: 32, width: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 12, borderWidth: 1, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  trash: {
    position: "absolute",
    top: 16,
    right: 16,
    height: 36,
    width: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: tw.green600, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
});
