// Port of components/user/SearchOverlay.jsx: full-screen dish search opened through
// useSearchOverlay().openSearch(). Recent searches, a 3-column dish grid filtered as you
// type, and voice input. Submitting goes to the search screen (/search?q=).
import { router } from "expo-router";
import { Clock, Loader2, Mic, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPublicFoods } from "../../api/restaurants";
import { useSearchOverlay } from "../../context/SearchOverlayContext";
import { store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { inputFont } from "../ui/primitives";
import AppImage from "../ui/AppImage";
import Text from "../ui/Text";
import { useVoiceSearch } from "./useVoiceSearch";

const SEARCH_HISTORY_KEY = "user_recent_searches_v1";
const GAP = 12;

const getImageUrl = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.url || value.secure_url || value.imageUrl || value.image || value.src || "";
  }
  return "";
};

// CSS keyframe entrances (slideDown / scaleIn / slideUp) as a one-shot Animated wrapper.
function Entrance({ delay = 0, from = { y: 20 }, style, children }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      delay,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay]);
  const transform = [];
  if (from.y) transform.push({ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, 0] }) });
  if (from.scale) transform.push({ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [from.scale, 1] }) });
  return <Animated.View style={[style, { opacity: progress, transform }]}>{children}</Animated.View>;
}

function Spinner({ size, color }) {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}

function PulsingMic({ color }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View style={{ opacity }}>
      <Mic size={20} color={color} />
    </Animated.View>
  );
}

export default function SearchOverlay({ isOpen, onClose, searchValue, onSearchChange }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const inputRef = useRef(null);
  const [allFoods, setAllFoods] = useState([]);
  const [recentSuggestions, setRecentSuggestions] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);

  const { isListening, startListening, stopListening } = useVoiceSearch((transcript) => {
    onSearchChange(transcript);
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;

    store.get(SEARCH_HISTORY_KEY, []).then((parsed) => {
      if (cancelled) return;
      setRecentSuggestions(
        Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim()).slice(0, 8) : [],
      );
    });

    setLoadingFoods(true);
    // Web called restaurantAPI.getPublicDishes, which does not exist (the overlay showed
    // "No dishes found"); the public foods endpoint is the working equivalent.
    getPublicFoods({ limit: 800 })
      .then((data) => {
        if (cancelled) return;
        const dishes = data?.foods || data?.dishes || [];
        const normalized = (Array.isArray(dishes) ? dishes : [])
          .filter((dish) => dish?.name)
          .map((dish, index) => ({
            id: String(dish?.id || dish?._id || `dish-${index}`),
            name: String(dish.name).trim(),
            image: getImageUrl(dish?.image),
          }));
        setAllFoods(normalized);
      })
      .catch(() => {
        if (!cancelled) setAllFoods([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFoods(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filteredFoods = useMemo(() => {
    if (searchValue.trim() === "") return allFoods;
    const q = searchValue.toLowerCase();
    return allFoods.filter((food) => food.name.toLowerCase().includes(q));
  }, [searchValue, allFoods]);

  const saveRecentSearch = useCallback((term) => {
    const value = String(term || "").trim();
    if (!value) return;
    setRecentSuggestions((prev) => {
      const next = [value, ...prev.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 8);
      store.set(SEARCH_HISTORY_KEY, next);
      return next;
    });
  }, []);

  const handleSuggestionClick = (suggestion) => {
    onSearchChange(suggestion);
    inputRef.current?.focus();
  };

  const goToSearch = (term) => {
    router.push({ pathname: "/search", params: { q: term } });
    onClose();
    onSearchChange("");
  };

  const handleSearchSubmit = () => {
    if (searchValue.trim()) {
      saveRecentSearch(searchValue);
      goToSearch(searchValue.trim());
    }
  };

  const handleFoodClick = (food) => {
    saveRecentSearch(food.name);
    goToSearch(food.name);
  };

  const handleClose = () => {
    stopListening();
    onClose();
  };

  const primaryIcon = isDark ? "#a05485" : colors.primary;
  const itemWidth = Math.floor((width - 32 - GAP * 2) / 3);
  const pageBg = isDark ? "#0a0a0a" : "#ffffff";

  const header = (
    <View>
      <Entrance delay={100} from={{ y: -20 }} style={styles.recentBlock}>
        <View style={styles.recentTitleRow}>
          <Clock size={16} color={colors.primary} />
          <Text style={[styles.recentTitle, { color: isDark ? "#d1d5db" : "#374151" }]}>Recent Searches</Text>
        </View>
        <View style={styles.chips}>
          {recentSuggestions.slice(0, 8).map((suggestion, index) => (
            <Entrance key={suggestion} delay={100 + index * 20} from={{ scale: 0.9 }}>
              <Pressable
                onPress={() => handleSuggestionClick(suggestion)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isDark ? "rgba(124,45,18,0.2)" : pressed ? "#ffedd5" : "#fff7ed",
                    borderColor: isDark ? "#9a3412" : "#fed7aa",
                  },
                ]}
              >
                <Clock size={12} color={colors.primary} />
                <Text style={[styles.chipText, { color: isDark ? "#d1d5db" : "#374151" }]}>{suggestion}</Text>
              </Pressable>
            </Entrance>
          ))}
        </View>
      </Entrance>
      <Entrance delay={200} from={{}}>
        <Text style={[styles.gridTitle, { color: isDark ? "#ffffff" : "#111827" }]}>
          {searchValue.trim() === "" ? "All Dishes" : `Search Results (${filteredFoods.length})`}
        </Text>
      </Entrance>
    </View>
  );

  const empty = (
    <View style={styles.empty}>
      {loadingFoods ? (
        <>
          <Spinner size={48} color={isDark ? "#4b5563" : "#d1d5db"} />
          <Text style={[styles.emptyTitle, { color: isDark ? "#9ca3af" : "#4b5563" }]}>
            Loading dishes from database...
          </Text>
        </>
      ) : (
        <>
          <Search size={48} color={isDark ? "#4b5563" : "#d1d5db"} />
          <Text style={[styles.emptyTitle, { color: isDark ? "#9ca3af" : "#4b5563" }]}>
            {searchValue.trim() ? `No results found for "${searchValue}"` : "No dishes found in database"}
          </Text>
          <Text style={styles.emptySub}>
            {searchValue.trim() ? "Try a different search term" : "Add menu items in restaurant menus to show here"}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: pageBg }]} behavior="padding">
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 16,
              backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
              borderBottomColor: isDark ? "#1f2937" : "#f3f4f6",
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.inputWrap}>
              <View style={styles.searchIcon} pointerEvents="none">
                <Search size={20} color={primaryIcon} strokeWidth={2.5} />
              </View>
              <TextInput
                ref={inputRef}
                autoFocus
                value={searchValue}
                onChangeText={onSearchChange}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                placeholder="Search dishes or restaurants"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                selectionColor={colors.primary}
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
                    borderColor: isDark ? "#1f2937" : "#e5e7eb",
                    color: isDark ? "#ffffff" : "#111827",
                  },
                ]}
              />
              <View style={styles.micArea}>
                <View style={[styles.micDivider, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]} />
                {isListening ? (
                  <Pressable
                    onPress={stopListening}
                    style={[styles.micBtn, { backgroundColor: isDark ? "rgba(127,29,29,0.2)" : "#fef2f2" }]}
                  >
                    <PulsingMic color="#ef4444" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={startListening}
                    style={({ pressed }) => [
                      styles.micBtn,
                      pressed && { backgroundColor: isDark ? "#1f2937" : "#f3f4f6", transform: [{ scale: 0.9 }] },
                    ]}
                  >
                    <Mic size={20} color={primaryIcon} />
                  </Pressable>
                )}
              </View>
            </View>
            <Pressable
              onPress={handleClose}
              accessibilityLabel="Close search"
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { backgroundColor: isDark ? "#1f2937" : "#f3f4f6" },
              ]}
            >
              <X size={20} color={isDark ? "#d1d5db" : "#374151"} />
            </Pressable>
          </View>
        </View>

        <FlatList
          data={filteredFoods}
          keyExtractor={(food) => food.id}
          numColumns={3}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.column}
          contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          initialNumToRender={18}
          renderItem={({ item: food, index }) => (
            <Entrance delay={250 + 50 * (index % 12)} style={{ width: itemWidth }}>
              <Pressable onPress={() => handleFoodClick(food)} style={styles.food}>
                <View
                  style={[
                    styles.foodCircle,
                    { width: itemWidth, height: itemWidth, backgroundColor: isDark ? "#1a1a1a" : "#ffffff" },
                  ]}
                >
                  {food.image ? (
                    <AppImage src={food.image} width={itemWidth} style={styles.foodImage} />
                  ) : (
                    <View style={[styles.foodImage, styles.center, { backgroundColor: isDark ? "#1f2937" : "#f3f4f6" }]}>
                      <Search size={20} color="#9ca3af" />
                    </View>
                  )}
                </View>
                <Text numberOfLines={2} style={[styles.foodName, { color: isDark ? "#e5e7eb" : "#1f2937" }]}>
                  {food.name}
                </Text>
              </Pressable>
            </Entrance>
          )}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Mounted once in the root layout (web: SearchOverlayProvider in UserLayout.jsx).
export function SearchOverlayHost() {
  const { isSearchOpen, searchValue, setSearchValue, closeSearch } = useSearchOverlay();
  if (!isSearchOpen) return null;
  return (
    <SearchOverlay isOpen={isSearchOpen} onClose={closeSearch} searchValue={searchValue} onSearchChange={setSearchValue} />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  inputWrap: { flex: 1, justifyContent: "center" },
  searchIcon: { position: "absolute", left: 20, zIndex: 1 },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingLeft: 56,
    paddingRight: 64,
    fontSize: 16,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
    ...inputFont,
  },
  micArea: { position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  micDivider: { width: 1, height: 24 },
  micBtn: { padding: 10, borderRadius: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 16, paddingTop: 24 },
  recentBlock: { marginBottom: 24 },
  recentTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  recentTitle: { fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  chipText: { fontSize: 12, fontWeight: "500" },
  gridTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  column: { gap: GAP, marginBottom: GAP },
  food: { alignItems: "center", gap: 8 },
  foodCircle: {
    borderRadius: 9999,
    padding: 4,
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
  },
  foodImage: { flex: 1, borderRadius: 9999 },
  foodName: { fontSize: 12, fontWeight: "600", textAlign: "center", paddingHorizontal: 4 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 16, textAlign: "center" },
  emptySub: { fontSize: 14, color: "#6b7280", marginTop: 8, textAlign: "center" },
});
