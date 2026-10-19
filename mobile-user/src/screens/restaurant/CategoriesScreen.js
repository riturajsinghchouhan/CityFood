// Port of Frontend/src/modules/Food/pages/user/Categories.jsx ("All Categories").
// The web calls the undefined adminAPI.getPublicCategories (always "No results found");
// the working public endpoint getSearchCategories is used instead, as in docs/API_MAP.md.
import { router } from "expo-router";
import { ArrowLeft, Grid2x2, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSearchCategories } from "../../api";
import { AppImage, Screen, Skeleton, Text, inputFont } from "../../components/ui";
import { useAppLocation } from "../../context/LocationContext";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { normalizeImageUrl } from "./lib";

// constants/images.js foodImages (fallbacks when a category has no image).
const FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400&h=300&fit=crop",
];

const COLS = 4;
const GAP_X = 16;

function CategoryTile({ category, index, size }) {
  const { isDark } = useTheme();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, delay: index * 30, useNativeDriver: true }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={{ width: size, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}
    >
      <Pressable
        onPress={() => router.push(`/category/${category.slug}`)}
        style={({ pressed }) => ({ alignItems: "center", gap: 10, transform: [{ scale: pressed ? 0.9 : 1 }] })}
      >
        <View
          style={[
            styles.circle,
            { width: size, height: size, borderColor: isDark ? tw.gray800 : "#f5f5f5", backgroundColor: isDark ? tw.gray900 : "#ffffff" },
          ]}
        >
          <AppImage src={category.image} width={size} style={StyleSheet.absoluteFill} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 13, color: isDark ? tw.gray300 : "#404040" }}>
          {category.name}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function CategoriesScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const { width } = useWindowDimensions();
  const { zoneId } = useAppLocation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const size = (width - 32 - GAP_X * (COLS - 1)) / COLS;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getSearchCategories(zoneId ? { zoneId } : {});
        const list = res?.data?.categories || [];
        if (!cancelled && Array.isArray(list)) {
          setCategories(
            list.map((cat, idx) => ({
              id: String(cat?.id || cat?._id || cat?.slug || idx),
              name: cat?.name || "",
              slug: cat?.slug || String(cat?.name || "").toLowerCase().replace(/\s+/g, "-"),
              image: normalizeImageUrl(cat?.image || cat?.imageUrl || "") || FOOD_IMAGES[idx % FOOD_IMAGES.length],
              type: cat?.type || "",
            })),
          );
        }
      } catch {
        // web logs and falls through to the empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const filtered = categories.filter((c) => (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()));
  const neutral900 = isDark ? "#ffffff" : "#171717";

  const searchBar = (
    <View style={{ paddingVertical: 24 }}>
      <View style={{ justifyContent: "center" }}>
        <Search size={20} color={focused ? colors.primary : isDark ? tw.gray500 : "#a3a3a3"} style={{ position: "absolute", left: 16, zIndex: 1 }} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search specialties, cuisines..."
          placeholderTextColor={isDark ? tw.gray600 : "#a3a3a3"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={colors.primary}
          style={[
            styles.search,
            { ...inputFont, fontFamily: "Poppins_500Medium" },
            {
              backgroundColor: isDark ? tw.gray900 : "#fafafa",
              borderColor: focused ? colors.primary : isDark ? tw.gray800 : "#f5f5f5",
              color: isDark ? "#ffffff" : tw.gray900,
            },
          ]}
        />
      </View>
    </View>
  );

  const empty =
    !loading && filtered.length === 0 ? (
      <View style={{ paddingVertical: 80, alignItems: "center", paddingHorizontal: 24 }}>
        <View style={[styles.emptyIcon, { backgroundColor: isDark ? tw.gray900 : "#fafafa" }]}>
          <Grid2x2 size={40} color={isDark ? tw.gray700 : "#d4d4d4"} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: "700", color: neutral900 }}>No results found</Text>
        <Text style={{ fontSize: 14, marginTop: 8, maxWidth: 240, textAlign: "center", color: isDark ? tw.gray400 : "#737373" }}>
          {"We couldn't find any categories matching your search. Try another keyword!"}
        </Text>
        <Pressable
          onPress={() => setSearchQuery("")}
          style={({ pressed }) => [styles.resetBtn, { backgroundColor: isDark ? "#ffffff" : "#171717", transform: [{ scale: pressed ? 0.95 : 1 }] }]}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? "#000000" : "#ffffff" }}>Show all categories</Text>
        </Pressable>
      </View>
    ) : null;

  const rows = [];
  for (let i = 0; i < filtered.length; i += COLS) rows.push(filtered.slice(i, i + COLS));

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
      <View style={[styles.header, { backgroundColor: isDark ? "rgba(10,10,10,0.95)" : "rgba(255,255,255,0.95)", borderBottomColor: isDark ? tw.gray800 : "#f5f5f5" }]}>
        <Pressable onPress={goBack} hitSlop={6} style={({ pressed }) => [styles.backBtn, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
          <ArrowLeft size={24} color={isDark ? "#ffffff" : "#262626"} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.5, color: neutral900 }}>All Categories</Text>
          <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1, lineHeight: 12, marginTop: 4, color: isDark ? tw.gray400 : "#737373" }}>
            {"WHAT'S ON YOUR MIND?"}
          </Text>
        </View>
      </View>
      {loading ? (
        <View style={{ paddingHorizontal: 16 }}>
          {searchBar}
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: GAP_X, rowGap: 40 }}>
            {Array.from({ length: 12 }, (_, i) => (
              <View key={i} style={{ width: size, alignItems: "center", gap: 12 }}>
                <Skeleton style={{ width: size, height: size, borderRadius: 999, backgroundColor: isDark ? tw.gray800 : "#f5f5f5" }} />
                <Skeleton style={{ height: 8, width: 48, borderRadius: 999, backgroundColor: isDark ? tw.gray800 : "#f5f5f5" }} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, i) => `${row[0]?.id}-${i}`}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={searchBar}
          ListEmptyComponent={empty}
          ItemSeparatorComponent={() => <View style={{ height: 40 }} />}
          renderItem={({ item: row, index }) => (
            <View style={{ flexDirection: "row", columnGap: GAP_X, alignItems: "flex-start" }}>
              {row.map((c, j) => (
                <CategoryTile key={c.id} category={c} index={index * COLS + j} size={size} />
              ))}
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + insets.bottom }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  backBtn: { padding: 8, borderRadius: 999 },
  search: { paddingLeft: 48, paddingRight: 16, paddingVertical: 16, borderRadius: 16, borderWidth: 1, fontSize: 14 },
  circle: { borderRadius: 999, overflow: "hidden", borderWidth: 1, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  emptyIcon: { height: 80, width: 80, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  resetBtn: { marginTop: 32, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 16, boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)" },
});
