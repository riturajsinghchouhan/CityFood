// Port of pages/user/profile/Favorites.jsx: saved restaurants and dishes (ProfileContext).
import { router } from "expo-router";
import { ArrowLeft, Bookmark, Heart } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DishFavoriteCard, RestaurantFavoriteCard } from "../../components/support/FavoriteCard";
import FadeIn from "../../components/support/FadeIn";
import { c, webVars } from "../../components/support/palette";
import WarmGradient from "../../components/support/WarmGradient";
import { Button, Card, Screen, Text, toast } from "../../components/ui";
import { useProfile } from "../../context/ProfileContext";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";

const GAP = 16;

function confirm(message, onConfirm) {
  Alert.alert("", message, [
    { text: "Cancel", style: "cancel" },
    { text: "OK", onPress: onConfirm },
  ]);
}

function Header({ subtitle, foreground, subColor }) {
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={() => goTo("/profile")} style={styles.backBtn} accessibilityLabel="Back">
        <ArrowLeft size={16} color={foreground} />
      </Pressable>
      <View>
        <Text style={[styles.title, { color: foreground }]}>My Favorites</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: subColor }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function EmptyBlock({ Icon, message, cta, color }) {
  return (
    <View style={styles.emptyBlock}>
      <Icon size={64} color={color} style={styles.emptyIcon} />
      <Text style={[styles.emptyText, { color }]}>{message}</Text>
      <Button title={cta} onPress={() => goTo("/")} />
    </View>
  );
}

export default function FavoritesScreen() {
  const { colors, isDark } = useTheme();
  const v = webVars(isDark);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getFavorites, removeFavorite, getDishFavorites, removeDishFavorite } = useProfile();
  const restaurantFavorites = getFavorites();
  const dishFavorites = getDishFavorites();
  const [activeTab, setActiveTab] = useState("restaurants");
  const cardWidth = (width - 32 - GAP) / 2;

  const handleRemoveFavorite = useCallback(
    (slug) =>
      confirm("Remove this restaurant from favorites?", () => {
        removeFavorite(slug);
        toast.success("Restaurant removed from favorites");
      }),
    [removeFavorite],
  );

  const handleRemoveDishFavorite = useCallback(
    (dishId, restaurantId) =>
      confirm("Remove this dish from favorites?", () => {
        removeDishFavorite(dishId, restaurantId);
        toast.success("Dish removed from favorites");
      }),
    [removeDishFavorite],
  );

  const pageBg = isDark ? "#0a0a0a" : v.background;
  const totalFavorites = restaurantFavorites.length + dishFavorites.length;

  if (totalFavorites === 0) {
    return (
      <Screen background={pageBg}>
        <WarmGradient isDark={isDark} />
        <FadeIn style={styles.page}>
          <Header foreground={v.foreground} />
          <Card style={[styles.emptyCard, { borderColor: v.border }]}>
            <EmptyBlock
              Icon={Heart}
              message="You haven't added any favorites yet"
              cta="Explore Restaurants"
              color={v.mutedForeground}
            />
          </Card>
        </FadeIn>
      </Screen>
    );
  }

  const isRestaurants = activeTab === "restaurants";
  const data = isRestaurants ? restaurantFavorites : dishFavorites;
  const subtitle =
    `${dishFavorites.length || 0} ${dishFavorites.length === 1 ? "dish" : "dishes"} • ` +
    `${restaurantFavorites.length || 0} ${restaurantFavorites.length === 1 ? "restaurant" : "restaurants"}`;

  const tab = (key, label) => {
    const active = activeTab === key;
    return (
      <Pressable
        key={key}
        onPress={() => setActiveTab(key)}
        style={[styles.tab, active && { borderBottomColor: colors.primary }]}
      >
        <Text style={[styles.tabText, { color: active ? colors.primary : isDark ? c.gray400 : c.gray500 }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const listHeader = (
    <View>
      <View style={styles.headerWrap}>
        <Header subtitle={subtitle} foreground={v.foreground} subColor={isDark ? c.gray300 : c.gray700} />
      </View>
      <View style={[styles.tabs, { borderBottomColor: isDark ? c.gray800 : c.gray200 }]}>
        {tab("restaurants", `Restaurants (${restaurantFavorites.length})`)}
        {tab("dishes", `Dishes (${dishFavorites.length})`)}
      </View>
    </View>
  );

  const renderItem = ({ item }) =>
    isRestaurants ? (
      <RestaurantFavoriteCard
        restaurant={item}
        width={cardWidth}
        onPress={() => router.push(`/restaurants/${item.slug}`)}
        onRemove={() => handleRemoveFavorite(item.slug)}
      />
    ) : (
      <DishFavoriteCard
        dish={item}
        width={cardWidth}
        onPress={() =>
          router.push({ pathname: "/restaurants/[slug]", params: { slug: item.restaurantSlug || "", dish: item.id } })
        }
        onRemove={() => handleRemoveDishFavorite(item.id, item.restaurantId)}
      />
    );

  return (
    <Screen background={pageBg}>
      <WarmGradient isDark={isDark} />
      <FadeIn style={styles.flex}>
        <FlatList
          key={activeTab}
          data={data}
          numColumns={2}
          keyExtractor={(item) => (isRestaurants ? String(item.slug) : `${item.id}-${item.restaurantId}`)}
          renderItem={renderItem}
          columnWrapperStyle={styles.column}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            isRestaurants ? (
              <EmptyBlock
                Icon={Heart}
                message="No restaurants saved yet"
                cta="Explore Restaurants"
                color={v.mutedForeground}
              />
            ) : (
              <EmptyBlock Icon={Bookmark} message="No dishes saved yet" cta="Explore Dishes" color={v.mutedForeground} />
            )
          }
          contentContainerStyle={[styles.list, { paddingBottom: 16 + insets.bottom }]}
        />
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: 16, gap: 24 },
  list: { padding: 16, gap: GAP },
  column: { gap: GAP },
  headerWrap: { marginBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 32, height: 32, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  tabs: { flexDirection: "row", gap: 8, borderBottomWidth: 1, marginTop: 8, marginBottom: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  tabText: { fontSize: 16, fontWeight: "500" },
  emptyCard: { paddingHorizontal: 24 },
  emptyBlock: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { marginBottom: 16 },
  emptyText: { fontSize: 18, marginBottom: 16, textAlign: "center" },
});
