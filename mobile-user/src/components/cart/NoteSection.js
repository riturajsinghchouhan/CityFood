// "Add note for restaurant" / cutlery toggles and the restaurant-instructions box (Cart.jsx).
import { Utensils } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { inputFont, Text } from "../ui";
import { radius } from "../../theme/tokens";
import { useCartPalette } from "./palette";

export default function NoteSection({
  restaurantNote,
  onChangeNote,
  showNoteInput,
  onToggleNoteInput,
  sendCutlery,
  onToggleCutlery,
}) {
  const p = useCartPalette();
  return (
    <>
      <View style={[p.cardStyle, styles.row]}>
        <Pressable onPress={onToggleNoteInput} style={[styles.pill, { flex: 1, borderColor: p.border }]}>
          <Utensils size={16} color={p.t600} />
          <Text numberOfLines={1} style={[styles.pillText, { color: p.isDark ? "#d1d5dc" : "#4a5565", flex: 1 }]}>
            {restaurantNote || "Add note for restaurant"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onToggleCutlery}
          style={[
            styles.pill,
            sendCutlery
              ? { borderColor: p.border }
              : { borderColor: p.isDark ? p.primary + "80" : p.primary, backgroundColor: p.plumTint },
          ]}
        >
          <Utensils size={16} color={sendCutlery ? p.t600 : p.primary} />
          <Text style={[styles.pillText, { color: sendCutlery ? (p.isDark ? "#d1d5dc" : "#4a5565") : p.primary }]}>
            {sendCutlery ? "Send cutlery" : "Don't send"}
          </Text>
        </Pressable>
      </View>

      {showNoteInput ? (
        <View
          style={[
            styles.noteBox,
            { backgroundColor: p.card, borderColor: p.cardBorder },
          ]}
        >
          <Text style={[styles.noteLabel, { color: p.t500 }]}>Restaurant instructions</Text>
          <TextInput
            value={restaurantNote}
            onChangeText={onChangeNote}
            placeholder="Eg. Don't add onions, make it extra spicy, etc."
            placeholderTextColor={p.t400}
            selectionColor={p.primary}
            multiline
            maxLength={240}
            textAlignVertical="top"
            style={[
              styles.textarea,
              inputFont,
              { borderColor: p.border, backgroundColor: p.inputBg, color: p.t900 },
            ]}
          />
          <View style={styles.noteFooter}>
            <Text style={[styles.small, { color: p.t500 }]}>Note for restaurant.</Text>
            <Text style={[styles.small, { color: p.t400 }]}>{restaurantNote.length}/240</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 16, flexDirection: "row", gap: 12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  pillText: { fontSize: 14 },
  noteBox: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1 },
  noteLabel: { fontSize: 12, fontWeight: "500", marginBottom: 8 },
  textarea: { borderWidth: 1, borderRadius: radius.md, padding: 12, fontSize: 14, height: 80 },
  noteFooter: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  small: { fontSize: 11 },
});
