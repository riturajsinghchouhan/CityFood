// Port of components/restaurant/RestaurantPageShell.jsx (phone width): the page wrapper inside the
// layout's scroll area. Screens own their ScrollView/FlatList; put this inside it (or use its
// padding as contentContainerStyle via PAGE_PADDING).
import { StyleSheet, View } from "react-native";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";

// px-4 py-4
export const PAGE_PADDING = { paddingHorizontal: 16, paddingVertical: 16 };

export default function RestaurantPageShell({ children, style, noPadding = false }) {
  return <View style={[styles.page, !noPadding && PAGE_PADDING, style]}>{children}</View>;
}

// Phone width stacks the cards in one column (restaurant-card-grid collapses below md).
export function RestaurantCardGrid({ children, style }) {
  return <View style={[styles.grid, style]}>{children}</View>;
}

export function RestaurantSubheader({ title, description, actions, style }) {
  return (
    <View style={[styles.subheader, style]}>
      <View style={styles.subheaderText}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", flexGrow: 1 },
  grid: { gap: 16 },
  subheader: { marginBottom: 24, gap: 12 },
  subheaderText: { minWidth: 0 },
  title: { fontSize: 20, fontWeight: "900", color: tw.gray900 },
  description: { marginTop: 4, fontSize: 14, color: tw.gray500 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
