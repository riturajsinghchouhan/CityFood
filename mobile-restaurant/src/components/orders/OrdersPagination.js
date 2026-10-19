// Port of components/restaurant/RestaurantOrdersPagination.jsx (phone layout: stacked).
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";

export default function OrdersPagination({ page, totalPages, total, limit, onPageChange }) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safePage = Math.min(Math.max(1, page || 1), safeTotalPages);
  const start = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = total === 0 ? 0 : Math.min(safePage * limit, total);

  if (safeTotalPages <= 1 && total <= limit) return null;

  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= safeTotalPages;

  return (
    <View style={styles.wrap}>
      <Text style={styles.summary}>
        Showing <Text style={styles.strong}>{`${start}-${end}`}</Text> of <Text style={styles.strong}>{total}</Text> orders
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => onPageChange(safePage - 1)}
          disabled={prevDisabled}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed, prevDisabled && styles.disabled]}
        >
          <ChevronLeft size={16} color={tw.gray700} />
          <Text style={styles.btnText}>Previous</Text>
        </Pressable>
        <Text style={styles.pageText}>
          Page {safePage} / {safeTotalPages}
        </Text>
        <Pressable
          onPress={() => onPageChange(safePage + 1)}
          disabled={nextDisabled}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed, nextDisabled && styles.disabled]}
        >
          <Text style={styles.btnText}>Next</Text>
          <ChevronRight size={16} color={tw.gray700} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tw.gray200,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summary: { fontSize: 12, color: tw.gray500 },
  strong: { fontSize: 12, fontWeight: "600", color: tw.gray700 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tw.gray200,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pressed: { backgroundColor: tw.gray50 },
  disabled: { opacity: 0.4 },
  btnText: { fontSize: 12, fontWeight: "600", color: tw.gray700 },
  pageText: { minWidth: 88, textAlign: "center", fontSize: 12, fontWeight: "600", color: tw.gray600 },
});
