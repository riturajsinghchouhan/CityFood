// Port of Frontend/src/modules/Food/pages/user/search/ProfessionalSearch.jsx (/search).
// Reads ?q=, ?cat= and ?voice=true (starts voice search once, then drops the param).
// The web loads trending categories through the undefined adminAPI.getPublicCategories, so the
// slider is always empty there; the working public endpoint getSearchCategories is used here.
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, History, Mic, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { getSearchCategories, unifiedSearch } from "../../api";
import {
  DishResultCard,
  DishResultSheet,
  FadeInItem,
  PremiumLoader,
  RestaurantResultCard,
  VoiceListeningOverlay,
} from "../../components/browse/SearchParts";
import { useVoiceSearch } from "../../components/shell/useVoiceSearch";
import { AppImage, Button, Screen, Text, inputFont } from "../../components/ui";
import { useAppLocation } from "../../context/LocationContext";
import { store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";
import { calculateDistanceKm } from "./lib";

// Session caches for instant re-visits, as on web.
const sessionSearchCache = new Map();
const sessionCategoriesCache = new Map();

// Web scoped storage "search" / "professional-history" (localStorage).
const SEARCH_HISTORY_KEY = "search:professional-history";
const normalizeHistory = (list) => (Array.isArray(list) ? list.filter((i) => typeof i === "string").slice(0, 5) : []);

const zinc = { 400: "#9f9fa9", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#09090b" };

const pickImage = (r) => r.matchedDishImage || r.profileImage || r.image || (Array.isArray(r.images) && r.images[0]) || null;

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function MicButton({ isListening, onPress }) {
  const { colors } = useTheme();
  const [o] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!isListening) {
      o.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, o]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
      <Animated.View style={[styles.micBtn, isListening && { backgroundColor: tw.red50 }, { opacity: o }]}>
        <Mic size={20} color={isListening ? tw.red500 : colors.primary} />
      </Animated.View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const { location: userCoords, zoneId } = useAppLocation();

  const [query, setQuery] = useState(typeof params.q === "string" ? params.q : "");
  const debouncedQuery = useDebounce(query, 500);
  const [results, setResults] = useState({ restaurants: [], dishes: [] });
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(typeof params.cat === "string" ? params.cat : null);
  const [history, setHistory] = useState([]);
  const [selectedDish, setSelectedDish] = useState(null);
  const historyRef = useRef(history);
  const catScrollRef = useRef(null);
  const catLayouts = useRef({});
  const [catRailWidth, setCatRailWidth] = useState(0);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const addToHistory = useCallback((term) => {
    const next = [term, ...historyRef.current.filter((h) => h !== term)].slice(0, 5);
    setHistory(next);
    store.set(SEARCH_HISTORY_KEY, normalizeHistory(next));
  }, []);

  const { isListening, startListening, stopListening } = useVoiceSearch((transcript) => {
    setQuery(transcript);
    addToHistory(transcript);
  });

  // ?voice=true: start listening on the next tick, then drop the param.
  const voiceStartedRef = useRef(false);
  useEffect(() => {
    if (params.voice !== "true" || voiceStartedRef.current) return undefined;
    voiceStartedRef.current = true;
    const t = setTimeout(() => startListening(), 100);
    router.setParams({ voice: undefined });
    return () => clearTimeout(t);
  }, [params.voice, startListening]);

  // History and categories (per zone).
  useEffect(() => {
    let cancelled = false;
    store.get(SEARCH_HISTORY_KEY).then((stored) => {
      if (!cancelled) setHistory(normalizeHistory(stored));
    });
    const cacheKey = String(zoneId || "global");
    if (sessionCategoriesCache.has(cacheKey)) {
      setCategories(sessionCategoriesCache.get(cacheKey));
    } else {
      getSearchCategories(zoneId ? { zoneId } : {})
        .then((res) => {
          const payload = res?.data || res || {};
          if (Array.isArray(payload.categories) || Array.isArray(payload)) {
            const list = Array.isArray(payload.categories) ? payload.categories : payload;
            sessionCategoriesCache.set(cacheKey, list);
            if (!cancelled) setCategories(list);
          }
        })
        .catch((err) => console.error("Failed to fetch categories", err));
    }
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const userLat = userCoords?.latitude;
  const userLng = userCoords?.longitude;
  const performSearch = useCallback(
    async (searchTerm, catId) => {
      if (!searchTerm && !catId) {
        setResults({ restaurants: [], dishes: [] });
        return;
      }
      const cacheKey = `${searchTerm}-${catId}-${zoneId}`;
      if (sessionSearchCache.has(cacheKey)) {
        setResults(sessionSearchCache.get(cacheKey));
        return;
      }
      setLoading(true);
      try {
        const res = await unifiedSearch({ q: searchTerm, categoryId: catId || undefined, lat: userLat, lng: userLng, zoneId });
        if (res?.success) {
          const all = res.data?.restaurants || [];
          const parsed = {
            restaurants: all.filter((r) => r.matchType === "restaurant" || !r.matchType),
            dishes: all.filter((r) => r.matchType === "food"),
          };
          sessionSearchCache.set(cacheKey, parsed);
          setResults(parsed);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    },
    [userLat, userLng, zoneId],
  );

  useEffect(() => {
    performSearch(debouncedQuery, selectedCategoryId);
  }, [debouncedQuery, selectedCategoryId, performSearch]);

  const trending = categories.filter((cat) => cat.image).slice(0, 15);

  // Keep the selected category centered in the slider.
  useEffect(() => {
    if (!selectedCategoryId || !catRailWidth) return undefined;
    const t = setTimeout(() => {
      const layout = catLayouts.current[selectedCategoryId];
      if (layout) catScrollRef.current?.scrollTo({ x: Math.max(0, layout.x + layout.width / 2 - catRailWidth / 2), animated: true });
    }, 150);
    return () => clearTimeout(t);
  }, [selectedCategoryId, catRailWidth, categories]);

  const handleVoiceSearch = () => (isListening ? stopListening() : startListening());

  const handleClear = () => {
    setQuery("");
    setSelectedCategoryId(null);
    setResults({ restaurants: [], dishes: [] });
  };

  const handleCategoryClick = (id) => setSelectedCategoryId((prev) => (prev === id ? null : id));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate("/");
  };

  const openRestaurant = (r, dishId) => {
    const slug = String(r.slug || r.originalRestaurantId || r._id);
    router.push({ pathname: "/restaurants/[slug]", params: dishId ? { slug, dish: String(dishId) } : { slug } });
  };

  const distanceLabel = (r) =>
    userCoords?.latitude && r.location?.coordinates
      ? `${calculateDistanceKm(userCoords.latitude, userCoords.longitude, r.location.coordinates[1], r.location.coordinates[0]).toFixed(1)} km`
      : r.location?.area || "Nearby";

  const showResults = !loading && (query || selectedCategoryId);
  const rows = [];
  if (!query && !loading && history.length > 0) rows.push({ key: "history" });
  if (!query && !loading) rows.push({ key: "categories" });
  if (loading) rows.push({ key: "loader" });
  if (showResults) {
    if (results.dishes.length > 0) {
      rows.push({ key: "dish-title" });
      results.dishes.forEach((r, i) => rows.push({ key: `d-${r._id}`, dish: r, index: i }));
    }
    if (results.restaurants.length > 0) {
      rows.push({ key: "rest-title" });
      results.restaurants.forEach((r, i) => rows.push({ key: `r-${r._id}`, restaurant: r, index: i }));
    }
    if (results.restaurants.length === 0 && results.dishes.length === 0) rows.push({ key: "empty" });
  }

  const sectionTitle = (title, count) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 14, fontWeight: "900", letterSpacing: 1.4, color: tw.gray400 }}>{title}</Text>
      <View style={{ backgroundColor: isDark ? zinc[900] : tw.gray100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: tw.gray400 }}>{count}</Text>
      </View>
    </View>
  );

  const renderRow = ({ item }) => {
    if (item.dish) {
      return (
        <View style={{ marginBottom: 16 }}>
          <FadeInItem index={item.index}>
            <DishResultCard r={item.dish} query={query} imageUrl={pickImage(item.dish)} onPress={() => setSelectedDish(item.dish)} />
          </FadeInItem>
        </View>
      );
    }
    if (item.restaurant) {
      const r = item.restaurant;
      return (
        <View style={{ marginBottom: 24 }}>
          <FadeInItem index={item.index} offset={20}>
            <RestaurantResultCard
              r={r}
              imageUrl={r.profileImage || r.image || (Array.isArray(r.images) && r.images[0]) || null}
              distanceLabel={distanceLabel(r)}
              onPress={() => openRestaurant(r)}
            />
          </FadeInItem>
        </View>
      );
    }
    switch (item.key) {
      case "history":
        return (
          <View style={{ marginBottom: 24 }}>
            <Text style={[styles.blockTitle, { marginBottom: 12, paddingHorizontal: 4 }]}>RECENT SEARCHES</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 4 }}>
              {history.map((term, i) => (
                <Pressable
                  key={`${term}-${i}`}
                  onPress={() => {
                    setQuery(term);
                    setSelectedCategoryId(null);
                  }}
                  style={[styles.historyChip, shadow.sm, { backgroundColor: isDark ? zinc[900] : "#ffffff", borderColor: isDark ? zinc[800] : tw.gray200 }]}
                >
                  <History size={14} color={tw.gray400} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? zinc[400] : tw.gray600 }}>{term}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      case "categories":
        return (
          <View style={{ marginBottom: 32 }}>
            <Text style={[styles.blockTitle, { marginBottom: 16, paddingHorizontal: 4 }]}>TRENDING CATEGORIES</Text>
            <ScrollView
              ref={catScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onLayout={(e) => setCatRailWidth(e.nativeEvent.layout.width)}
              contentContainerStyle={{ gap: 16, paddingVertical: 8, paddingBottom: 16, paddingHorizontal: 16 }}
              style={{ marginHorizontal: -16 }}
            >
              {trending.map((cat) => {
                const active = selectedCategoryId === cat._id;
                return (
                  <Pressable
                    key={cat._id}
                    onPress={() => handleCategoryClick(cat._id)}
                    onLayout={(e) => {
                      catLayouts.current[cat._id] = e.nativeEvent.layout;
                    }}
                    style={({ pressed }) => [{ width: 64, alignItems: "center", transform: [{ scale: pressed ? 0.95 : 1 }] }]}
                  >
                    <View
                      style={[
                        styles.catRing,
                        active
                          ? [{ borderWidth: 3, borderColor: colors.primary, backgroundColor: "#ffffff" }, shadow.md]
                          : [{ borderWidth: 1, borderColor: "rgba(229,231,235,0.8)", backgroundColor: isDark ? zinc[900] : tw.gray50 }, shadow.sm],
                      ]}
                    >
                      <View style={{ flex: 1, borderRadius: 999, overflow: "hidden", backgroundColor: isDark ? zinc[950] : "#ffffff" }}>
                        <AppImage src={cat.image} width={64} style={StyleSheet.absoluteFill} />
                      </View>
                    </View>
                    <Text
                      numberOfLines={2}
                      style={{ fontSize: 10, lineHeight: 13, fontWeight: "700", textAlign: "center", color: active ? colors.primary : isDark ? zinc[400] : tw.gray600 }}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        );
      case "loader":
        return <PremiumLoader />;
      case "dish-title":
        return sectionTitle("MATCHED DISHES", `${results.dishes.length} results`);
      case "rest-title":
        return <View style={{ marginTop: results.dishes.length > 0 ? 16 : 0 }}>{sectionTitle("RESTAURANTS", `${results.restaurants.length} stores`)}</View>;
      case "empty":
        return (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? zinc[900] : tw.slate100 }]}>
              <Search size={32} color="#cad5e2" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 8, color: isDark ? "#ffffff" : tw.slate900, textAlign: "center" }}>
              {"We couldn't find any results"}
            </Text>
            <Text style={{ fontSize: 14, color: tw.slate500, textAlign: "center", maxWidth: 320 }}>
              Maybe try searching for something else or check your spelling
            </Text>
            <Button
              variant="outline"
              title="Clear all filters"
              onPress={handleClear}
              style={{ marginTop: 24, borderRadius: 12, borderColor: "#ff2056" }}
              textStyle={{ color: "#ff2056" }}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Screen background={isDark ? zinc[950] : "#f8fafc"}>
      <View style={[styles.header, { backgroundColor: isDark ? "rgba(24,24,27,0.8)" : "rgba(255,255,255,0.8)", borderBottomColor: isDark ? zinc[800] : tw.gray100 }]}>
        <Pressable onPress={goBack} style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: isDark ? zinc[800] : tw.gray100, transform: [{ scale: 0.9 }] }]}>
          <ArrowLeft size={20} color={isDark ? tw.gray300 : tw.gray700} />
        </Pressable>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Search size={16} strokeWidth={2.5} color={colors.primary} style={{ position: "absolute", left: 14, zIndex: 1 }} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (text && selectedCategoryId) setSelectedCategoryId(null);
            }}
            placeholder="Search dishes or restaurants"
            placeholderTextColor={isDark ? zinc[400] : tw.gray500}
            returnKeyType="search"
            style={[
              styles.input,
              inputFont,
              {
                backgroundColor: isDark ? "rgba(39,39,42,0.5)" : tw.gray50,
                borderColor: isDark ? zinc[700] : tw.gray100,
                color: isDark ? "#ffffff" : tw.gray900,
              },
            ]}
          />
          <View style={styles.inputRight}>
            {query ? (
              <Pressable onPress={handleClear} hitSlop={6} style={{ padding: 6 }}>
                <X size={16} color={tw.gray400} />
              </Pressable>
            ) : null}
            <View style={{ width: 1, height: 16, marginHorizontal: 2, backgroundColor: isDark ? zinc[700] : tw.gray200 }} />
            <MicButton isListening={isListening} onPress={handleVoiceSearch} />
          </View>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        initialNumToRender={8}
      />

      <DishResultSheet
        dish={selectedDish}
        imageUrl={selectedDish ? pickImage(selectedDish) : null}
        onClose={() => setSelectedDish(null)}
        onViewAndAdd={() => {
          const dish = selectedDish;
          setSelectedDish(null);
          openRestaurant(dish, dish?.matchedDishId);
        }}
      />
      <VoiceListeningOverlay visible={isListening} onClose={stopListening} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, zIndex: 50 },
  backBtn: { padding: 6, borderRadius: 999 },
  input: { height: 40, borderRadius: 16, borderWidth: 1, paddingLeft: 40, paddingRight: 80, fontSize: 14 },
  inputRight: { position: "absolute", right: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  micBtn: { padding: 6, borderRadius: 12 },
  blockTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.6, color: tw.gray400 },
  historyChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  catRing: { width: 64, height: 64, borderRadius: 999, marginBottom: 8, padding: 2 },
  emptyIcon: { width: 80, height: 80, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 16 },
});
