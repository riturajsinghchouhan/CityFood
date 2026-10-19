// Port of components/user/home/RestaurantGrid.jsx: the "Restaurants delivering to you"
// list (one column at phone width, 20px gap) ending in the logo + "That's all for now".
// It is a FlatList so Home can use it as its scroll container (pass everything above the
// list as ListHeaderComponent); HomeRestaurantCard and RestaurantGridFooter are exported
// for screens that lay the list out themselves.
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useTheme } from "../../theme/ThemeContext";
import Text from "../ui/Text";
import HomeRestaurantCard from "./HomeRestaurantCard";

const localLogo = require("../../../assets/images/logo.png");

export function RestaurantGridFooter() {
  const { isDark } = useTheme();
  const { logo } = useAppSettings();
  const [failed, setFailed] = useState(false);
  const source = logo && !failed ? { uri: logo } : localLogo;
  const line = isDark ? ["rgba(39,39,42,0)", "#27272a", "#3f3f46"] : ["rgba(229,231,235,0)", "#e5e7eb", "#d1d5db"];
  return (
    <View style={styles.footer}>
      <View style={styles.footerRow}>
        <LinearGradient colors={line} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
        <View
          style={[
            styles.logoCircle,
            {
              backgroundColor: isDark ? "#18181b" : "#ffffff",
              borderColor: isDark ? "#27272a" : "rgba(229,231,235,0.9)",
              outlineColor: isDark ? "rgba(39,39,42,0.6)" : "#f3f4f6",
            },
          ]}
        >
          <Image source={source} style={styles.logo} contentFit="contain" onError={() => setFailed(true)} accessibilityLabel="CityFood" />
        </View>
        <LinearGradient colors={line} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={styles.line} />
      </View>
      <Text style={[styles.footerText, { color: isDark ? "#71717a" : "#9ca3af" }]}>THAT&apos;S ALL FOR NOW</Text>
    </View>
  );
}

/**
 * restaurants, isOutOfService, isFavorite(slug), onToggleFavorite(restaurant, slug, favorite),
 * isLoading (dims the list to 50%). Any other prop goes to the FlatList (ListHeaderComponent,
 * onScroll, refreshControl, contentContainerStyle, ...). With no restaurants it renders
 * nothing, as on web, unless a ListHeaderComponent is given (then just the header).
 */
function RestaurantGrid({
  restaurants = [],
  isOutOfService = false,
  isLoading = false,
  isFavorite,
  onToggleFavorite,
  ListHeaderComponent,
  contentContainerStyle,
  ...listProps
}) {
  const renderItem = useCallback(
    ({ item, index }) => (
      <View style={[styles.item, isLoading && styles.dim]}>
        <HomeRestaurantCard
          restaurant={item}
          index={index}
          isOutOfService={isOutOfService}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          animateEntrance={index < 10}
        />
      </View>
    ),
    [isLoading, isOutOfService, isFavorite, onToggleFavorite],
  );

  if (restaurants.length === 0 && !ListHeaderComponent) return null;
  const hasItems = restaurants.length > 0;

  return (
    <FlatList
      data={restaurants}
      keyExtractor={(r, index) => String(r?.id || r?._id || r?.mongoId || index)}
      renderItem={renderItem}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={hasItems ? <RestaurantGridFooter /> : null}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={[hasItems && styles.content, contentContainerStyle]}
      initialNumToRender={4}
      windowSize={7}
      showsVerticalScrollIndicator={false}
      {...listProps}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

export default memo(RestaurantGrid);

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 40 },
  item: { paddingHorizontal: 16 },
  dim: { opacity: 0.5 },
  separator: { height: 20 },
  footer: { paddingTop: 40 + 20, paddingBottom: 16, alignItems: "center" },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 16, width: "100%", maxWidth: 320 },
  line: { flex: 1, height: 1 },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    padding: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    outlineWidth: 4,
    outlineStyle: "solid",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  logo: { width: "100%", height: "100%" },
  footerText: { fontSize: 11, fontWeight: "600", letterSpacing: 1.1, marginTop: 12 },
});
