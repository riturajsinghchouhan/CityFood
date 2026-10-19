// Home.jsx "What's on your mind today?" (web L2282-2344): heading with View All, and the
// round category slider ("All" first). Once stuck under the search row the web hides the
// heading and gives the bar a frosted white background; Home renders that compact copy
// in its sticky overlay (`stuck`).
import { router } from "expo-router";
import { ArrowDownUp } from "lucide-react-native";
import { memo, useCallback, useEffect, useRef } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { AppImage, Text } from "../ui";
import { Shine } from "./anim";

const ALL_IMAGE = "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop";
const ITEM_WIDTH = 76;
const CIRCLE = 68;

const categoryPath = (category) =>
  category.slug === "all"
    ? "/under-250"
    : `/category/${category.slug || category.name.toLowerCase().replace(/\s+/g, "-")}`;

const CategoryItem = memo(function CategoryItem({ category, index, active, onSelectCategory }) {
  const { colors, isDark } = useTheme();
  return (
    <Pressable
      onPress={() => {
        onSelectCategory?.(category.name);
        router.push(categoryPath(category));
      }}
      style={({ pressed }) => [styles.item, { transform: [{ scale: active ? 1.05 : pressed ? 0.95 : 1 }] }]}
    >
      <View
        style={[
          styles.circle,
          {
            backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
            borderColor: active ? colors.primary : isDark ? tw.gray800 : tw.gray100,
          },
          active && { outlineColor: `${colors.primary}4D`, outlineWidth: 2, outlineStyle: "solid" },
        ]}
      >
        <AppImage src={category.image} width={CIRCLE} style={StyleSheet.absoluteFill} />
        <View style={styles.glint} pointerEvents="none">
          <Shine width={CIRCLE} duration={2000} repeatDelay={3000 + index * 500} alpha={0.4} skew={-20} />
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.label, { color: active ? colors.primary : isDark ? tw.gray100 : tw.gray900 }]}
      >
        {category.name}
      </Text>
    </Pressable>
  );
});

/**
 * categories: displayCategories (without "All"). selectedCategory: name. onSelectCategory(name).
 * offsetRef: a shared ref holding the horizontal offset, so the in-page and sticky copies
 * open at the same scroll position (syncKey re-applies it when a hidden copy is shown again).
 */
export function CategorySlider({ categories, selectedCategory, onSelectCategory, offsetRef, syncKey }) {
  const listRef = useRef(null);
  const data = [{ id: "all", name: "All", slug: "all", image: ALL_IMAGE }, ...(categories || [])];
  const renderItem = useCallback(
    ({ item, index }) => (
      <CategoryItem
        category={item}
        index={index}
        active={selectedCategory === item.name}
        onSelectCategory={onSelectCategory}
      />
    ),
    [selectedCategory, onSelectCategory],
  );
  useEffect(() => {
    const x = offsetRef?.current || 0;
    listRef.current?.scrollToOffset({ offset: x, animated: false });
  }, [offsetRef, syncKey]);
  return (
    <FlatList
      ref={listRef}
      horizontal
      data={data}
      keyExtractor={(item, index) => String(item.id || index)}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.sliderContent}
      scrollEventThrottle={64}
      onScroll={(e) => {
        if (offsetRef) offsetRef.current = e.nativeEvent.contentOffset.x;
      }}
      initialNumToRender={12}
      style={styles.slider}
    />
  );
}

function CategoriesSection({ stuck = false, ...sliderProps }) {
  const { isDark } = useTheme();
  if (stuck) {
    return (
      <View
        style={[
          styles.stuck,
          {
            backgroundColor: isDark ? "rgba(10,10,10,0.95)" : "rgba(255,255,255,0.95)",
            borderBottomColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)",
          },
        ]}
      >
        <CategorySlider {...sliderProps} />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: isDark ? "#ffffff" : tw.gray900 }]}>What&apos;s on your mind today?</Text>
        <View style={[styles.line, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]} />
        <Pressable onPress={() => router.push("/under-250")} style={styles.viewAll} hitSlop={6}>
          <Text style={[styles.viewAllText, { color: isDark ? tw.gray200 : tw.gray800 }]}>View All</Text>
          <ArrowDownUp size={12} color={isDark ? tw.gray200 : tw.gray800} style={styles.rot90} />
        </Pressable>
      </View>
      <CategorySlider {...sliderProps} />
    </View>
  );
}

export default memo(CategoriesSection);

const styles = StyleSheet.create({
  section: { paddingVertical: 10, gap: 12 },
  stuck: {
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    boxShadow: "0px 4px 30px rgba(0,0,0,0.05)",
  },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  heading: { fontSize: 18, fontWeight: "700", lineHeight: 23, flexShrink: 1 },
  line: { height: 1, flex: 1 },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  viewAllText: { fontSize: 14, fontWeight: "700" },
  rot90: { transform: [{ rotate: "90deg" }] },
  slider: { flexGrow: 0 },
  sliderContent: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4, gap: 6 },
  item: { width: ITEM_WIDTH, alignItems: "center", gap: 6 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    overflow: "hidden",
    borderWidth: 2,
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
  },
  glint: { ...StyleSheet.absoluteFillObject, overflow: "hidden", zIndex: 10 },
  label: { fontSize: 11, fontWeight: "800", textAlign: "center", lineHeight: 14, width: "100%", paddingHorizontal: 2 },
});
