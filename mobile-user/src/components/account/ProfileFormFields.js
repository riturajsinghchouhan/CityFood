// EditProfile.jsx fields: MUI DatePicker (mobile dialog) and the shadcn gender Select.
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { Calendar, Check, ChevronDown } from "lucide-react-native";
import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { brand, shadow, tw } from "../../theme/tokens";

export function useFieldColors() {
  const { isDark } = useTheme();
  return {
    border: isDark ? tw.gray700 : tw.gray300,
    background: isDark ? "#1a1a1a" : "#ffffff",
    text: isDark ? "#ffffff" : tw.gray900,
    placeholder: isDark ? tw.gray400 : brand.accent,
  };
}

// value: dayjs | null. Displays MM/DD/YYYY like the MUI field.
export function DateField({ value, onChange, maximumDate }) {
  const { isDark } = useTheme();
  const open = () => {
    DateTimePickerAndroid.open({
      value: value && value.isValid() ? value.toDate() : new Date(),
      mode: "date",
      maximumDate,
      onValueChange: (_event, date) => {
        if (date) onChange(dayjs(date));
      },
    });
  };
  const textColor = isDark ? "#ffffff" : tw.gray900;
  const hasValue = Boolean(value && value.isValid());
  return (
    <Pressable onPress={open} style={[styles.dateField, { borderColor: isDark ? tw.gray600 : tw.gray300 }]}>
      <Text style={[styles.dateText, { color: textColor, opacity: hasValue ? 1 : 0.5 }]}>
        {hasValue ? value.format("MM/DD/YYYY") : "MM/DD/YYYY"}
      </Text>
      <Calendar size={22} color={isDark ? "#ffffff" : "rgba(0,0,0,0.54)"} />
    </Pressable>
  );
}

// Radix Select (w-fit trigger, popper list below it).
export function SelectField({ value, onChange, options, placeholder }) {
  const { colors, isDark } = useTheme();
  const field = useFieldColors();
  const triggerRef = useRef(null);
  const [anchor, setAnchor] = useState(null);
  const { height: windowHeight } = useWindowDimensions();
  const selected = options.find((o) => o.value === value);

  const openList = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  };
  const listHeight = options.length * 37 + 8;
  const below = anchor && anchor.y + anchor.height + 4 + listHeight < windowHeight;

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openList}
        style={[styles.trigger, { borderColor: field.border, backgroundColor: field.background }]}
      >
        <Text style={[styles.triggerText, { color: selected ? field.text : field.placeholder }]}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={16} color={field.placeholder} style={styles.chevron} />
      </Pressable>
      <Modal transparent visible={Boolean(anchor)} onRequestClose={() => setAnchor(null)} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} />
        {anchor ? (
          <View
            style={[
              styles.list,
              {
                left: anchor.x,
                minWidth: anchor.width,
                top: below ? anchor.y + anchor.height + 4 : undefined,
                bottom: below ? undefined : windowHeight - anchor.y + 4,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            {options.map((option, index) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setAnchor(null);
                }}
                style={({ pressed }) => [
                  styles.item,
                  index < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  pressed && { backgroundColor: isDark ? tw.gray800 : brand.accent },
                ]}
              >
                <Text style={[styles.itemText, { color: colors.text }]}>{option.label}</Text>
                {option.value === value ? (
                  <View style={styles.check}>
                    <Check size={16} color={field.placeholder} />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dateField: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: { fontSize: 16 },
  trigger: {
    alignSelf: "flex-start",
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  triggerText: { fontSize: 16 },
  chevron: { opacity: 0.5 },
  list: { position: "absolute", borderRadius: 8, borderWidth: 1, padding: 4, ...shadow.lg },
  item: { paddingVertical: 6, paddingLeft: 8, paddingRight: 32, borderRadius: 4, minHeight: 33, justifyContent: "center" },
  itemText: { fontSize: 14 },
  check: { position: "absolute", right: 8, top: 0, bottom: 0, justifyContent: "center" },
});
