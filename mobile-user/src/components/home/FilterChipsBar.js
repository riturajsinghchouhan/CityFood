// Home.jsx filter chip row (web L2357-2420): FILTERS opens the sheet; the quick chips
// toggle a filter and refetch straight away.
import { MapPin, SlidersHorizontal } from "lucide-react-native";
import { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { ScalePressable, Text } from "../ui";

export const QUICK_FILTERS = [
  { id: "delivery-under-30", label: "Under 30 mins" },
  { id: "delivery-under-45", label: "Under 45 mins" },
  { id: "distance-under-1km", label: "Under 1km", icon: MapPin },
  { id: "distance-under-2km", label: "Under 2km", icon: MapPin },
];

function FilterChipsBar({ activeFilters, onOpenFilters, onToggleQuickFilter }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: isDark ? "rgba(10,10,10,0.95)" : "rgba(255,255,255,0.95)",
          borderBottomColor: isDark ? "rgba(255,255,255,0.05)" : tw.gray100,
        },
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <ScalePressable
          scaleTo={0.95}
          onPress={onOpenFilters}
          style={[styles.chip, styles.filtersChip, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}
        >
          <SlidersHorizontal size={16} color="#000000" />
          <Text style={[styles.filtersText, { color: isDark ? "#ffffff" : "#000000" }]}>FILTERS</Text>
        </ScalePressable>
        {QUICK_FILTERS.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilters.has(filter.id);
          const fg = isActive ? "#ffffff" : isDark ? tw.gray300 : tw.gray700;
          return (
            <ScalePressable
              key={filter.id}
              scaleTo={0.95}
              onPress={() => onToggleQuickFilter(filter.id)}
              style={[
                styles.chip,
                styles.quickChip,
                isActive
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray100 },
              ]}
            >
              {Icon ? <Icon size={14} color={fg} fill={isActive ? "#ffffff" : "none"} /> : null}
              <Text style={[styles.chipText, { color: fg }]}>{filter.label}</Text>
            </ScalePressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default memo(FilterChipsBar);

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 1, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  // Web: px-4 inside a -mx-4 strip, so the chips start at the screen edge.
  row: { paddingVertical: 10, gap: 8, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  filtersChip: { gap: 6, borderColor: tw.gray200 },
  quickChip: { gap: 8 },
  filtersText: { fontSize: 12, fontWeight: "700", letterSpacing: -0.3 },
  chipText: { fontSize: 12, fontWeight: "700", letterSpacing: -0.3 },
});
