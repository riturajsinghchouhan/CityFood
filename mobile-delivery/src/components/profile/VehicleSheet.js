// ProfileDetailsV2 "Vehicle Info" popup: vehicle type (<select> bike/scooter/bicycle/car, shown here
// as an inline option list), name/brand and number (uppercased, A-Z0-9 only), and "Save Changes".
// deliveryTheme.css forces inputs/selects to a white background with a #e8dee7 border (the 2px
// bottom border shows) and a 55 % primary border + ring on focus.
import { Bike, Car, Check, ChevronDown, Plus, QrCode, Truck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { alpha } from "../feed/palette";
import Text from "../ui/Text";
import { brand, headingFontByWeight, mixWithWhite, shadow, tw } from "../../theme/tokens";
import ProfilePopup from "./ProfilePopup";
import { FOCUS_RING, dvCard } from "./common";

const TYPES = [
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "bicycle", label: "Bicycle" },
  { value: "car", label: "Car" },
];

const BLUE600_50 = alpha("#155dfc", 0.5); // text-blue-600/50 (not remapped)
const FOCUS_BORDER = mixWithWhite(brand.primary, 0.55);

function TypeIcon({ type }) {
  const t = String(type || "").toLowerCase();
  if (t.includes("car")) return <Car size={20} color={brand.primary} />;
  if (t.includes("bicycle")) return <Bike size={20} color={brand.primary} />;
  return <Truck size={20} color={brand.primary} />;
}

function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

function LineInput({ value, onChangeText, placeholder, autoCapitalize }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={tw.gray200}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      selectionColor={brand.primary}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.lineInput, focused && { borderBottomColor: FOCUS_BORDER, boxShadow: FOCUS_RING }]}
    />
  );
}

export default function VehicleSheet({ isOpen, onClose, input, setInput, onSave }) {
  const [typeOpen, setTypeOpen] = useState(false);
  // An unmatched value (e.g. "") shows the first option, like a browser <select>.
  const selected = TYPES.find((t) => t.value === input.type) || TYPES[0];

  return (
    <ProfilePopup isOpen={isOpen} onClose={onClose} title="Vehicle Info" showHandle={false}>
      <View style={styles.wrap}>
        <View style={styles.box}>
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <TypeIcon type={input.type} />
            </View>
            <View style={styles.flex1}>
              <Label>Vehicle Type</Label>
              <Pressable
                onPress={() => setTypeOpen((v) => !v)}
                style={[styles.select, typeOpen && { borderBottomColor: FOCUS_BORDER, boxShadow: FOCUS_RING }]}
              >
                <Text style={styles.selectText}>{selected.label}</Text>
                <ChevronDown size={18} color={brand.text} />
              </Pressable>
              {typeOpen ? (
                <View style={styles.options}>
                  {TYPES.map((t) => {
                    const active = t.value === input.type;
                    return (
                      <Pressable
                        key={t.value}
                        onPress={() => {
                          setInput({ ...input, type: t.value });
                          setTypeOpen(false);
                        }}
                        style={({ pressed }) => [styles.option, (active || pressed) && { backgroundColor: brand.primarySoft }]}
                      >
                        <Text style={[styles.optionText, active && { color: brand.primary, fontWeight: "700" }]}>
                          {t.label}
                        </Text>
                        {active ? <Check size={16} color={brand.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Plus size={16} color={BLUE600_50} />
            </View>
            <View style={styles.flex1}>
              <Label>Vehicle Name/Brand</Label>
              <LineInput
                value={input.brand}
                onChangeText={(v) => setInput({ ...input, brand: v })}
                placeholder="E.g. Honda Splendor"
              />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconBox}>
              <QrCode size={16} color={BLUE600_50} />
            </View>
            <View style={styles.flex1}>
              <Label>Vehicle Number</Label>
              <LineInput
                value={input.number}
                onChangeText={(v) => setInput({ ...input, number: v.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                placeholder="E.g. UP 80 AB 1234"
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <Pressable onPress={onSave} style={({ pressed }) => [styles.save, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Text style={styles.saveText}>Save Changes</Text>
        </Pressable>
      </View>
    </ProfilePopup>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  wrap: { gap: 16, paddingBottom: 40 },
  box: {
    backgroundColor: tw.gray50,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    ...dvCard,
    gap: 16,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 16, width: "100%" },
  iconBox: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginTop: 14 },
  label: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  lineInput: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderBottomWidth: 2,
    borderBottomColor: brand.inputBorder,
    fontSize: 18,
    fontFamily: headingFontByWeight.default,
    color: brand.text,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 2,
    borderBottomColor: brand.inputBorder,
    paddingVertical: 2,
  },
  selectText: { fontSize: 18, lineHeight: 28, fontWeight: "900", color: brand.text },
  options: {
    marginTop: 6,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tw.gray200,
    overflow: "hidden",
    ...shadow.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: { fontSize: 16, lineHeight: 24, color: brand.text },
  divider: { height: 1, backgroundColor: tw.gray200, width: "100%" },
  save: {
    width: "100%",
    backgroundColor: "#000000",
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: "center",
    ...shadow.xl,
  },
  saveText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 16 * 0.2,
  },
});
