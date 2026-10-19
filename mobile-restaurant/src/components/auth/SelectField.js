// shadcn Select / native <select> used by Signup and Onboarding: a trigger that looks like the
// web input and a centered option list (Android's native select is a dialog list too).
import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Dialog, Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadow, tw } from "../../theme/tokens";

/**
 * options: [{value, label, left?}]. value "" shows the placeholder.
 * style overrides the trigger; textStyle its label.
 */
export default function SelectField({
  value,
  options,
  onChange,
  placeholder = "Select",
  disabled = false,
  title,
  style,
  textStyle,
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        style={[styles.trigger, { opacity: disabled ? 0.5 : 1 }, style]}
      >
        <View style={styles.triggerLabel}>
          {selected?.left}
          <Text style={[styles.triggerText, !selected && { color: tw.gray500 }, textStyle]} numberOfLines={1}>
            {selected ? selected.label : placeholder}
          </Text>
        </View>
        <ChevronDown size={16} color={tw.gray500} />
      </Pressable>

      <Dialog visible={open} onClose={() => setOpen(false)} style={styles.dialog}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <ScrollView style={{ maxHeight: height * 0.6 }}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  setOpen(false);
                  onChange(o.value);
                }}
                style={({ pressed }) => [styles.option, (pressed || active) && { backgroundColor: colors.primaryTint6 }]}
              >
                <View style={styles.triggerLabel}>
                  {o.left}
                  <Text style={styles.optionText}>{o.label}</Text>
                </View>
                {active ? <Check size={16} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tw.gray300,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    ...shadow.sm,
  },
  triggerLabel: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  triggerText: { fontSize: 14, color: tw.gray900 },
  dialog: { padding: 8, borderRadius: 16, backgroundColor: "#ffffff" },
  title: { fontSize: 16, fontWeight: "600", color: tw.gray900, paddingHorizontal: 12, paddingVertical: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  optionText: { fontSize: 14, color: tw.gray900 },
});
