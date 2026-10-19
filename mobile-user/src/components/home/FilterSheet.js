// Home.jsx "Filters and sorting" bottom sheet (web L2701-3090): tab rail on the left,
// scrolling sections on the right (the rail follows the scroll), Close / Show results.
import { ArrowDownUp, BadgePercent, IndianRupee, MapPin, ShieldCheck, Star, Timer } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { BottomSheet, Text } from "../ui";

const TABS = [
  { id: "sort", label: "Sort By", icon: ArrowDownUp },
  { id: "time", label: "Time", icon: Timer },
  { id: "rating", label: "Rating", icon: Star },
  { id: "distance", label: "Distance", icon: MapPin },
  { id: "price", label: "Dish Price", icon: IndianRupee },
  { id: "offers", label: "Offers", icon: BadgePercent },
  { id: "trust", label: "Trust", icon: ShieldCheck },
];

const SORT_OPTIONS = [
  { id: null, label: "Relevance" },
  { id: "nearby", label: "Nearby" },
  { id: "price-low", label: "Price: Low to High" },
  { id: "price-high", label: "Price: High to Low" },
  { id: "rating-high", label: "Rating: High to Low" },
  { id: "rating-low", label: "Rating: Low to High" },
];

// Section order in the right column (the web lists Trust before Offers).
const SECTION_ORDER = ["sort", "time", "rating", "distance", "price", "trust", "offers"];

function useOptionColors(selected) {
  const { colors, isDark } = useTheme();
  return {
    box: selected
      ? { borderColor: colors.primary, backgroundColor: isDark ? "rgba(20,83,45,0.2)" : "#F9F9FB" }
      : { borderColor: isDark ? tw.gray800 : tw.gray200 },
    text: { color: selected ? colors.primary : isDark ? tw.gray300 : tw.gray700 },
  };
}

function RowOption({ label, selected, onPress }) {
  const c = useOptionColors(selected);
  return (
    <Pressable onPress={onPress} style={[styles.rowOption, c.box]}>
      <Text style={[styles.optionText, styles.left, c.text]}>{label}</Text>
    </Pressable>
  );
}

function TileOption({ label, selected, onPress, icon: Icon, starred }) {
  const { colors, isDark } = useTheme();
  const c = useOptionColors(selected);
  const iconColor = selected ? colors.primary : starred ? (isDark ? tw.gray500 : tw.gray400) : isDark ? tw.gray400 : tw.gray600;
  return (
    <Pressable onPress={onPress} style={[styles.tileOption, c.box]}>
      <Icon
        size={24}
        color={iconColor}
        strokeWidth={starred ? 2 : 1.5}
        fill={starred && selected ? colors.primary : "none"}
      />
      <Text style={[styles.optionText, c.text]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Draft state (activeFilters, sortBy) lives in Home, as on web: the sheet edits it and
 * "Show results" applies it.
 */
export default function FilterSheet({
  visible,
  onClose,
  activeFilters,
  sortBy,
  hasSelection,
  isLoading,
  onToggleFilter,
  onSetSortBy,
  onClearAll,
  onApply,
}) {
  const { colors, isDark } = useTheme();
  const { height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState("sort");
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const viewportH = useRef(0);
  const programmatic = useRef(false);

  const onScroll = (e) => {
    if (programmatic.current) return;
    const y = e.nativeEvent.contentOffset.y;
    // Web IntersectionObserver rootMargin "-20% 0px -70% 0px": the section crossing the band
    // 20–30% from the top of the scroll area is active.
    const line = y + viewportH.current * 0.2;
    let current = SECTION_ORDER[0];
    SECTION_ORDER.forEach((id) => {
      if (sectionY.current[id] !== undefined && sectionY.current[id] <= line) current = id;
    });
    if (current !== activeTab) setActiveTab(current);
  };

  const onTabPress = (id) => {
    setActiveTab(id);
    const y = sectionY.current[id];
    if (y === undefined) return;
    programmatic.current = true;
    scrollRef.current?.scrollTo({ y, animated: true });
    setTimeout(() => {
      programmatic.current = false;
    }, 500);
  };

  const section = (id, title, children) => (
    <View
      key={id}
      style={styles.section}
      onLayout={(e) => {
        sectionY.current[id] = e.nativeEvent.layout.y;
      }}
    >
      <Text style={[styles.sectionTitle, { color: isDark ? "#ffffff" : tw.gray900 }]}>{title}</Text>
      {children}
    </View>
  );

  const has = (id) => activeFilters.has(id);
  const border = isDark ? tw.gray800 : tw.gray200;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="85%" style={{ height: height * 0.85 }}>
      <View style={[styles.header, { borderBottomColor: border }]}>
        <Text style={[styles.headerTitle, { color: isDark ? "#ffffff" : tw.gray900 }]}>Filters and sorting</Text>
        <Pressable onPress={onClearAll} hitSlop={8}>
          <Text style={[styles.clearAll, { color: colors.primary }]}>Clear all</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={[styles.rail, { backgroundColor: isDark ? "#0a0a0a" : tw.gray50, borderRightColor: border }]}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => onTabPress(tab.id)}
                style={[styles.tab, isActive && { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}
              >
                {isActive ? <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} /> : null}
                <Icon size={20} strokeWidth={1.5} color={isActive ? colors.primary : isDark ? tw.gray400 : tw.gray500} />
                <Text style={[styles.tabLabel, { color: isActive ? colors.primary : isDark ? tw.gray400 : tw.gray500 }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          onLayout={(e) => {
            viewportH.current = e.nativeEvent.layout.height;
          }}
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          {section(
            "sort",
            "Sort by",
            <View style={styles.column}>
              {SORT_OPTIONS.map((option) => (
                <RowOption
                  key={option.id || "relevance"}
                  label={option.label}
                  selected={sortBy === option.id}
                  onPress={() => onSetSortBy(option.id)}
                />
              ))}
            </View>,
          )}
          {section(
            "time",
            "Estimated Time",
            <View style={styles.grid}>
              <TileOption icon={Timer} label="Under 30 mins" selected={has("delivery-under-30")} onPress={() => onToggleFilter("delivery-under-30")} />
              <TileOption icon={Timer} label="Under 45 mins" selected={has("delivery-under-45")} onPress={() => onToggleFilter("delivery-under-45")} />
            </View>,
          )}
          {section(
            "rating",
            "Restaurant Rating",
            <View style={styles.grid}>
              <TileOption icon={Star} starred label="Rated 3.5+" selected={has("rating-35-plus")} onPress={() => onToggleFilter("rating-35-plus")} />
              <TileOption icon={Star} starred label="Rated 4.0+" selected={has("rating-4-plus")} onPress={() => onToggleFilter("rating-4-plus")} />
              <TileOption icon={Star} starred label="Rated 4.5+" selected={has("rating-45-plus")} onPress={() => onToggleFilter("rating-45-plus")} />
            </View>,
          )}
          {section(
            "distance",
            "Distance",
            <View style={styles.grid}>
              <TileOption icon={MapPin} label="Under 1 km" selected={has("distance-under-1km")} onPress={() => onToggleFilter("distance-under-1km")} />
              <TileOption icon={MapPin} label="Under 2 km" selected={has("distance-under-2km")} onPress={() => onToggleFilter("distance-under-2km")} />
            </View>,
          )}
          {section(
            "price",
            "Dish Price",
            <View style={styles.column}>
              <RowOption label="Under ₹200" selected={has("price-under-200")} onPress={() => onToggleFilter("price-under-200")} />
              <RowOption label="Under ₹500" selected={has("price-under-500")} onPress={() => onToggleFilter("price-under-500")} />
            </View>,
          )}
          {section(
            "trust",
            "Trust Markers",
            <View style={styles.column}>
              <RowOption label="Top Rated" selected={has("top-rated")} onPress={() => onToggleFilter("top-rated")} />
              <RowOption label="Trusted by 1000+ users" selected={has("trusted")} onPress={() => onToggleFilter("trusted")} />
            </View>,
          )}
          {section(
            "offers",
            "Offers",
            <View style={styles.column}>
              <RowOption label="Restaurants with offers" selected={has("has-offers")} onPress={() => onToggleFilter("has-offers")} />
            </View>,
          )}
        </ScrollView>
      </View>

      <View style={[styles.footer, { borderTopColor: border, backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: isDark ? tw.gray300 : tw.gray700 }]}>Close</Text>
        </Pressable>
        <Pressable
          onPress={onApply}
          disabled={isLoading}
          style={[styles.applyBtn, { backgroundColor: hasSelection ? colors.primary : tw.gray200 }]}
        >
          <Text style={[styles.applyText, { color: hasSelection ? "#ffffff" : tw.gray500 }]}>
            {isLoading ? "Loading..." : "Show results"}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  clearAll: { fontSize: 14, fontWeight: "500" },
  body: { flex: 1, flexDirection: "row", overflow: "hidden" },
  rail: { width: 96, borderRightWidth: 1 },
  tab: { alignItems: "center", gap: 4, paddingVertical: 16, paddingHorizontal: 8 },
  tabIndicator: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  tabLabel: { fontSize: 12, fontWeight: "500", textAlign: "center", lineHeight: 15 },
  content: { flex: 1 },
  contentInner: { padding: 16 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  column: { gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rowOption: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  tileOption: {
    width: "47%",
    flexGrow: 1,
    maxWidth: "48.5%",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: { fontSize: 14, fontWeight: "500", textAlign: "center" },
  left: { textAlign: "left" },
  footer: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1 },
  closeBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  closeText: { fontWeight: "600", fontSize: 16 },
  applyBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  applyText: { fontWeight: "600", fontSize: 16 },
});
