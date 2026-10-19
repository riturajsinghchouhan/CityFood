// Order recipient name and phone with the inline "Change" editor (Cart.jsx "Contact").
import { Phone } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { inputFont, Text } from "../ui";
import { radius } from "../../theme/tokens";
import { DashedDivider, useCartPalette } from "./palette";

export default function RecipientSection({
  recipientName,
  recipientPhone,
  isEditing,
  onToggleEditing,
  details,
  onChangeName,
  onChangePhone,
}) {
  const p = useCartPalette();
  const inputStyle = [
    styles.input,
    inputFont,
    { borderColor: p.border, backgroundColor: p.isDark ? "#111111" : "#ffffff", color: p.t900 },
  ];
  return (
    <View style={[p.cardStyle, { paddingVertical: 16 }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Phone size={16} color={p.t500} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: p.t800 }]}>
              {recipientName}, <Text style={[styles.name, { fontWeight: "600", color: p.t800 }]}>
                {recipientPhone || "+91-XXXXXXXXXX"}
              </Text>
            </Text>
            <Text style={[styles.sub, { color: p.t500 }]}>Order recipient details</Text>
          </View>
        </View>
        <Pressable onPress={onToggleEditing} hitSlop={6}>
          <Text style={[styles.change, { color: p.primary }]}>{isEditing ? "Done" : "Change"}</Text>
        </Pressable>
      </View>

      {isEditing ? (
        <View style={styles.editor}>
          <DashedDivider color={p.divider} style={{ marginBottom: 16 }} />
          <View>
            <Text style={[styles.label, { color: p.t500 }]}>Name</Text>
            <TextInput
              value={details.name}
              onChangeText={onChangeName}
              placeholder="Enter recipient name"
              placeholderTextColor={p.t400}
              selectionColor={p.primary}
              style={inputStyle}
            />
          </View>
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.label, { color: p.t500 }]}>Phone Number</Text>
            <TextInput
              value={details.phone}
              onChangeText={onChangePhone}
              placeholder="Enter recipient phone"
              placeholderTextColor={p.t400}
              selectionColor={p.primary}
              keyboardType="phone-pad"
              style={inputStyle}
            />
          </View>
          <Text style={[styles.hint, { color: p.t500 }]}>
            Agar aap kisi aur ke liye order kar rahe ho, to yahan uska naam aur phone save kar do.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  left: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "500" },
  sub: { fontSize: 12, marginTop: 4 },
  change: { fontSize: 12, fontWeight: "600" },
  editor: { marginTop: 16 },
  label: { fontSize: 12, fontWeight: "500", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  hint: { fontSize: 11, marginTop: 12 },
});
