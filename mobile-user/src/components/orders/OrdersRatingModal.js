// "Rate Your Delivery" modal from Orders.jsx.
import { LinearGradient } from "expo-linear-gradient";
import { Star } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { Dialog, inputFont, ScalePressable, Text } from "../ui";
import Spinner from "./Spinner";

function StarRow({ value, onChange, keyPrefix }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((num) => {
        const active = (value || 0) >= num;
        return (
          <ScalePressable key={`${keyPrefix}-${num}`} scaleTo={0.95} onPress={() => onChange(num)} style={{ padding: 8 }}>
            <Star size={40} color={active ? "#facc15" : "#d1d5db"} fill={active ? "#facc15" : "transparent"} />
          </ScalePressable>
        );
      })}
    </View>
  );
}

export default function OrdersRatingModal({
  order,
  restaurantRating,
  deliveryRating,
  restaurantText,
  deliveryText,
  onRestaurantRating,
  onDeliveryRating,
  onRestaurantText,
  onDeliveryText,
  submitting,
  onSubmit,
  onClose,
}) {
  const { colors, isDark } = useTheme();
  const hasDeliveryPartner = !!(order?.deliveryPartnerId || order?.deliveryPartnerName);
  const disabled = submitting || restaurantRating === null || (hasDeliveryPartner && deliveryRating === null);
  const inputStyle = [
    styles.textarea,
    {
      borderColor: isDark ? "#1f2937" : "#e5e7eb",
      backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
      color: isDark ? "#e5e7eb" : "#1f2937",
    },
  ];
  const labelStyle = [styles.label, { color: isDark ? "#f3f4f6" : "#111827" }];

  return (
    <Dialog
      visible={Boolean(order)}
      onClose={onClose}
      style={[styles.dialog, { backgroundColor: isDark ? "#121212" : "#ffffff", borderColor: isDark ? "#1f2937" : "transparent" }]}
    >
      <LinearGradient colors={[colors.primary, colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Star size={20} color="#ffffff" fill="#ffffff" />
            <Text style={styles.title}>Rate Your Delivery</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
            <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }}>x</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.9)" }}>{order?.restaurant}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={{ marginBottom: 24 }}>
          <Text style={labelStyle}>Restaurant rating (out of 5)</Text>
          <StarRow value={restaurantRating} onChange={onRestaurantRating} keyPrefix="restaurant" />
          <TextInput
            multiline
            numberOfLines={2}
            value={restaurantText}
            onChangeText={onRestaurantText}
            placeholder="Restaurant feedback (optional)"
            placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
            selectionColor={colors.primary}
            style={inputStyle}
          />
        </View>

        {hasDeliveryPartner ? (
          <View style={{ marginBottom: 24 }}>
            <Text style={labelStyle}>Delivery partner rating (out of 5)</Text>
            <StarRow value={deliveryRating} onChange={onDeliveryRating} keyPrefix="delivery" />
            <TextInput
              multiline
              numberOfLines={2}
              value={deliveryText}
              onChangeText={onDeliveryText}
              placeholder="Delivery partner feedback (optional)"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              selectionColor={colors.primary}
              style={inputStyle}
            />
          </View>
        ) : null}

        <Pressable disabled={disabled} onPress={onSubmit} style={{ opacity: disabled ? 0.5 : 1 }}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.submit, { boxShadow: `0px 10px 15px -3px ${colors.primary}4D` }]}
          >
            {submitting ? <Spinner size={20} /> : <Star size={20} color="#ffffff" fill="#ffffff" />}
            <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit Ratings"}</Text>
          </LinearGradient>
        </Pressable>

        {disabled ? (
          <Text style={styles.hint}>Please select all required ratings to continue</Text>
        ) : null}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { padding: 0, borderRadius: 24, maxWidth: 448, overflow: "hidden" },
  header: { paddingHorizontal: 24, paddingVertical: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "700", color: "#ffffff" },
  close: { padding: 4, borderRadius: 999 },
  body: { paddingHorizontal: 24, paddingVertical: 24 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 12 },
  stars: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 },
  textarea: {
    width: "100%",
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: "top",
    ...inputFont,
  },
  submit: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  hint: { fontSize: 12, textAlign: "center", color: "#ef4444", marginTop: 8 },
});
