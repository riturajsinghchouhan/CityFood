// Rounded status / priority pill (px-2.5 py-1 rounded-full text-[11px] font-semibold).
import { StyleSheet, View } from "react-native";
import { Text } from "../ui";

export default function Pill({ label, bg, fg, bold, style }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: fg }, bold && styles.bold]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, alignSelf: "flex-start" },
  text: { fontSize: 11, fontWeight: "600" },
  bold: { fontWeight: "700" },
});
