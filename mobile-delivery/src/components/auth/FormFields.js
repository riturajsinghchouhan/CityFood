// SignupStep1/SignupStep2 form pieces: the white sub-page header, labelled text inputs and the native
// stand-in for <select>. deliveryTheme.css forces every input/textarea/select to border #e8dee7 on
// white (so the web's red error borders never show) and, on focus, a 55 % primary border with a
// 4px rgba(21,73,139,.15) ring.
import { ArrowLeft, Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { brand, fontFamilyByWeight, mixWithWhite, tw } from "../../theme/tokens";
import { BottomSheet, SheetHandle, Text } from "../ui";

const FOCUS_RING = "0px 0px 0px 4px rgba(21,73,139,0.15)";

// bg-white px-4 py-3 border-b border-gray-200; back arrow in a p-2 rounded-full button; text-lg font-medium.
export function SubHeader({ title, onBack }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.headerBack} hitSlop={6}>
        <ArrowLeft size={20} color={tw.gray900} />
      </Pressable>
      <Text heading style={styles.headerTitle}>
        {title}
      </Text>
    </View>
  );
}

// <label class="block text-sm font-medium text-gray-700 mb-1">Label <span class="text-red-500">*</span></label>
export function FieldLabel({ label, required, suffix, style }) {
  return (
    <Text style={[styles.label, style]}>
      {label}
      {suffix ? ` ${suffix}` : ""}
      {required ? (
        <Text style={[styles.label, styles.star]}>
          {" "}*
        </Text>
      ) : null}
    </Text>
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

function useFocusStyle() {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const style = focused ? { borderColor: mixWithWhite(colors.primary, 0.55), boxShadow: FOCUS_RING } : null;
  return { focused, setFocused, style, colors };
}

// w-full px-4 py-3 border rounded-lg (text-base). multiline = textarea rows={rows}.
export function TextField({ multiline, rows = 3, style, onFocus, onBlur, ...props }) {
  const { setFocused, style: focusStyle, colors } = useFocusStyle();
  return (
    <TextInput
      placeholderTextColor={tw.gray500}
      selectionColor={colors.primary}
      multiline={multiline}
      numberOfLines={multiline ? rows : undefined}
      textAlignVertical={multiline ? "top" : "center"}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[styles.input, multiline && { height: rows * 24 + 26 }, focusStyle, style]}
      {...props}
    />
  );
}

/**
 * <select> replacement: a field that opens a bottom sheet of options.
 * options: [{value, label}]. placeholder: the empty <option>'s text (shown when value is "").
 */
export function SelectField({ value, options, onChange, placeholder, disabled, title }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.input, styles.select, open && { borderColor: mixWithWhite(colors.primary, 0.55), boxShadow: FOCUS_RING }, disabled && styles.disabled]}
      >
        <Text style={styles.selectText} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={18} color={tw.gray900} strokeWidth={2.5} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} maxHeight="70%">
        <SheetHandle />
        {title ? (
          <Text heading style={styles.sheetTitle}>
            {title}
          </Text>
        ) : null}
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.sheetList}
          renderItem={({ item }) => {
            const active = item.value === value;
            return (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, (active || pressed) && { backgroundColor: brand.primarySoft }]}
              >
                <Text style={[styles.optionText, active && { color: colors.primary, fontWeight: "700" }]}>
                  {item.label}
                </Text>
                {active ? <Check size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
  },
  headerBack: { padding: 8, borderRadius: 9999 },
  headerTitle: { fontSize: 18, lineHeight: 28, fontWeight: "500", color: brand.text },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: tw.gray700, marginBottom: 4 },
  star: { color: tw.red500, marginBottom: 0 },
  error: { fontSize: 14, lineHeight: 20, color: tw.red500, marginTop: 4 },
  input: {
    width: "100%",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: brand.inputBorder,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    color: brand.text,
    fontSize: 16,
    fontFamily: fontFamilyByWeight["400"],
  },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectText: { flex: 1, fontSize: 16, lineHeight: 24, color: brand.text },
  disabled: { opacity: 0.6 },
  sheetTitle: { fontSize: 18, lineHeight: 28, fontWeight: "700", color: tw.gray900, paddingHorizontal: 20, paddingBottom: 8 },
  sheetList: { paddingHorizontal: 12, paddingBottom: 16 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
  },
  optionText: { fontSize: 16, lineHeight: 24, color: brand.text },
});
