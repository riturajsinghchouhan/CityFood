// Dining.jsx "Filters and sorting" bottom sheet: tab sidebar on the left, options on the right.
// The Dish Price options toggle filter ids that the list never applies (as on web).
import { ArrowDownUp, IndianRupee, MapPin, Star, Timer, UtensilsCrossed } from "lucide-react-native";
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
  { id: "cuisine", label: "Cuisine", icon: UtensilsCrossed },
];

const SORT_OPTIONS = [
  { id: null, label: "Relevance" },
  { id: "rating-high", label: "Rating: High to Low" },
  { id: "rating-low", label: "Rating: Low to High" },
];

const CUISINES = ["Continental", "Italian", "Asian", "Indian", "Chinese", "American", "Seafood", "Cafe"];

function useOptionStyle() {
  const { colors, isDark } = useTheme();
  return (active, activeBg = "#F9F9FB") => ({
    borderColor: active ? colors.primary : isDark ? tw.gray700 : tw.gray200,
    backgroundColor: active ? (isDark ? colors.primary + "33" : activeBg) : "transparent",
  });
}

function OptionLabel({ active, children, style }) {
  const { colors, isDark } = useTheme();
  return (
    <Text style={[styles.optionText, { color: active ? colors.primary : isDark ? tw.gray300 : tw.gray700 }, style]}>
      {children}
    </Text>
  );
}

// grid-cols-2 gap-3 inside the right pane (screen minus the w-24 sidebar and p-4).
function useHalfWidth() {
  const { width } = useWindowDimensions();
  return Math.floor((width - 96 - 32 - 12) / 2);
}

function TileGrid({ items, isActive, onPress, renderIcon }) {
  const optionStyle = useOptionStyle();
  const half = useHalfWidth();
  return (
    <View style={styles.grid2}>
      {items.map((item) => {
        const active = isActive(item.id);
        return (
          <Pressable key={item.id} onPress={() => onPress(item.id)} style={[styles.tile, { width: half }, optionStyle(active)]}>
            {renderIcon(active)}
            <OptionLabel active={active}>{item.label}</OptionLabel>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DiningFilterSheet({
  visible,
  onClose,
  activeTab,
  onChangeTab,
  activeFilters,
  onToggleFilter,
  sortBy,
  onChangeSort,
  selectedCuisine,
  onChangeCuisine,
  onClearAll,
  resultCount,
}) {
  const { colors, isDark } = useTheme();
  const { height } = useWindowDimensions();
  const optionStyle = useOptionStyle();
  const half = useHalfWidth();
  const hasSelection = activeFilters.size > 0 || Boolean(sortBy) || Boolean(selectedCuisine);
  const headingColor = isDark ? "#ffffff" : tw.gray900;
  const iconIdle = isDark ? tw.gray400 : tw.gray600;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="85%" style={{ backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }}>
      <View style={[styles.header, { borderColor: isDark ? tw.gray800 : tw.gray200 }]}>
        <Text style={[styles.headerTitle, { color: headingColor }]}>Filters and sorting</Text>
        <Pressable onPress={onClearAll} hitSlop={8}>
          <Text style={[styles.clearAll, { color: colors.primary }]}>Clear all</Text>
        </Pressable>
      </View>

      <View style={[styles.body, { height: Math.min(Math.round(height * 0.85) - 150, 440) }]}>
        <View style={[styles.sidebar, { backgroundColor: isDark ? "#0a0a0a" : tw.gray50, borderColor: isDark ? tw.gray800 : tw.gray200 }]}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const color = active ? colors.primary : isDark ? tw.gray400 : tw.gray500;
            return (
              <Pressable
                key={tab.id}
                onPress={() => onChangeTab(tab.id)}
                style={[styles.tab, active ? { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" } : null]}
              >
                {active ? <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} /> : null}
                <Icon size={20} color={color} strokeWidth={1.5} />
                <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          {activeTab === "sort" ? (
            <View>
              <Text style={[styles.sectionTitle, { color: headingColor }]}>Sort by</Text>
              <View style={{ gap: 12 }}>
                {SORT_OPTIONS.map((option) => {
                  const active = sortBy === option.id;
                  return (
                    <Pressable
                      key={option.id || "relevance"}
                      onPress={() => onChangeSort(option.id)}
                      style={[styles.rowOption, optionStyle(active)]}
                    >
                      <OptionLabel active={active}>{option.label}</OptionLabel>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {activeTab === "time" ? (
            <View>
              <Text style={[styles.sectionTitle, { color: headingColor }]}>Estimated Time</Text>
              <TileGrid
                items={[
                  { id: "delivery-under-30", label: "Under 30 mins" },
                  { id: "delivery-under-45", label: "Under 45 mins" },
                ]}
                isActive={(id) => activeFilters.has(id)}
                onPress={onToggleFilter}
                renderIcon={(active) => <Timer size={24} strokeWidth={1.5} color={active ? colors.primary : iconIdle} />}
              />
            </View>
          ) : null}

          {activeTab === "rating" ? (
            <View>
              <Text style={[styles.sectionTitle, { color: headingColor }]}>Restaurant Rating</Text>
              <TileGrid
                items={[
                  { id: "rating-35-plus", label: "Rated 3.5+" },
                  { id: "rating-4-plus", label: "Rated 4.0+" },
                  { id: "rating-45-plus", label: "Rated 4.5+" },
                ]}
                isActive={(id) => activeFilters.has(id)}
                onPress={onToggleFilter}
                renderIcon={(active) => (
                  <Star
                    size={24}
                    color={active ? colors.primary : isDark ? tw.gray500 : tw.gray400}
                    fill={active ? colors.primary : "none"}
                  />
                )}
              />
            </View>
          ) : null}

          {activeTab === "distance" ? (
            <View>
              <Text style={[styles.sectionTitle, { color: headingColor }]}>Distance</Text>
              <TileGrid
                items={[
                  { id: "distance-under-1km", label: "Under 1 km" },
                  { id: "distance-under-2km", label: "Under 2 km" },
                ]}
                isActive={(id) => activeFilters.has(id)}
                onPress={onToggleFilter}
                renderIcon={(active) => <MapPin size={24} strokeWidth={1.5} color={active ? colors.primary : iconIdle} />}
              />
            </View>
          ) : null}

          {activeTab === "price" ? (
            <View>
              <Text style={[styles.sectionTitle, { color: headingColor }]}>Dish Price</Text>
              <View style={{ gap: 12 }}>
                {[
                  { id: "price-under-200", label: "Under ₹200" },
                  { id: "price-under-500", label: "Under ₹500" },
                ].map((option) => {
                  const active = activeFilters.has(option.id);
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => onToggleFilter(option.id)}
                      style={[styles.priceOption, optionStyle(active, colors.primary + "1A")]}
                    >
                      <OptionLabel active={active}>{option.label}</OptionLabel>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {activeTab === "cuisine" ? (
            <View>
              <Text style={[styles.sectionTitle, { color: headingColor }]}>Cuisine</Text>
              <View style={styles.grid2}>
                {CUISINES.map((cuisine) => {
                  const active = selectedCuisine === cuisine;
                  return (
                    <Pressable
                      key={cuisine}
                      onPress={() => onChangeCuisine(active ? null : cuisine)}
                      style={[styles.cuisineOption, { width: half }, optionStyle(active)]}
                    >
                      <OptionLabel active={active} style={{ textAlign: "center" }}>
                        {cuisine}
                      </OptionLabel>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <View style={[styles.footer, { borderColor: isDark ? tw.gray800 : tw.gray200, backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
        <Pressable onPress={onClose} style={styles.footerClose}>
          <Text style={[styles.footerCloseText, { color: isDark ? tw.gray300 : tw.gray700 }]}>Close</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={[
            styles.footerShow,
            { backgroundColor: hasSelection ? colors.primary : isDark ? tw.gray700 : tw.gray200 },
          ]}
        >
          <Text
            style={[
              styles.footerShowText,
              { color: hasSelection ? "#ffffff" : isDark ? tw.gray400 : tw.gray500 },
            ]}
          >
            {hasSelection ? `Show ${resultCount} results` : "Show results"}
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
  body: { flexDirection: "row" },
  sidebar: { width: 96, borderRightWidth: 1 },
  tab: { alignItems: "center", gap: 4, paddingVertical: 16, paddingHorizontal: 8 },
  tabIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  tabLabel: { fontSize: 12, fontWeight: "500", lineHeight: 15, textAlign: "center" },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  rowOption: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  optionText: { fontSize: 14, fontWeight: "500" },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  priceOption: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  cuisineOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1 },
  footerClose: { flex: 1, paddingVertical: 12, alignItems: "center" },
  footerCloseText: { fontSize: 14, fontWeight: "600" },
  footerShow: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  footerShowText: { fontSize: 14, fontWeight: "600" },
});
