// Onboarding step 1 "Search location" input with its suggestion list (Google Places, or Nominatim
// when no Maps key is configured). The list renders below the input instead of floating over the
// next fields: an absolutely positioned dropdown inside a ScrollView can't be tapped reliably on Android.
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../ui";
import { radius, shadow, tw } from "../../../theme/tokens";
import { Field, Hint, Label } from "./fields";

export default function LocationSearch({ value, onChangeText, suggestions, searching, onSelect, editable }) {
  return (
    <View>
      <Label>Search location</Label>
      <View>
        <Field
          value={value}
          onChangeText={onChangeText}
          placeholder="Start typing your restaurant address..."
          placeholderTextColor="#000000"
          editable={editable}
          style={[styles.input, searching && styles.inputWithSpinner]}
        />
        {searching ? (
          <View style={styles.spinner} pointerEvents="none">
            <ActivityIndicator size={16} color="#ff6900" />
          </View>
        ) : null}
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.list}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.listScroll}>
            {suggestions.map((s, i) => (
              <Pressable
                key={String(s.id)}
                onPress={() => onSelect(s)}
                style={({ pressed }) => [
                  styles.item,
                  i < suggestions.length - 1 && styles.itemBorder,
                  pressed && { backgroundColor: "#fff7ed" },
                ]}
              >
                <Text style={styles.itemText} numberOfLines={1}>
                  {s.display}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Hint>Select a suggestion to auto-fill area/city/state/pincode and coordinates.</Hint>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { color: "#000000" },
  inputWithSpinner: { paddingRight: 36 },
  spinner: { position: "absolute", right: 12, top: 4, bottom: 0, justifyContent: "center" },
  list: {
    marginTop: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadow.xl,
  },
  listScroll: { maxHeight: 240 },
  item: { paddingHorizontal: 16, paddingVertical: 8 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: tw.gray100 },
  itemText: { fontSize: 13, fontWeight: "500", color: tw.gray700 },
});
