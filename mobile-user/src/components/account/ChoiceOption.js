// Option button used in the Veg Mode and Appearance dialogs: rounded-xl border-2 card with a round
// check marker, optional leading icon, title/description and optional trailing icon.
import { Check } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui";

export default function ChoiceOption({
  selected,
  onPress,
  borderColor,
  background,
  markerBorder,
  markerFill,
  leading,
  trailing,
  title,
  description,
  titleColor,
  descriptionColor,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, { borderColor, backgroundColor: background }, trailing ? styles.between : null]}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.marker,
            { borderColor: markerBorder, backgroundColor: selected ? markerFill : "transparent" },
          ]}
        >
          {selected ? <Check size={12} color="#ffffff" /> : null}
        </View>
        {leading}
        <View>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          <Text style={[styles.description, { color: descriptionColor }]}>{description}</Text>
        </View>
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  between: { justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "500" },
  description: { fontSize: 12 },
});
