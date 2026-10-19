// Form building blocks of Onboarding.jsx: section card, label, shadcn Input, outline "Upload"
// button, document preview with the red remove button, pill toggles, the MUI TimePicker field
// (native time dialog) and the FSSAI expiry Popover calendar (native date dialog).
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { Calendar, Clock, Upload, X } from "lucide-react-native";
import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../../ui";
import { useTheme } from "../../../theme/ThemeContext";
import { fontFamilyByWeight, radius, shadow, tw } from "../../../theme/tokens";
import { normalizeTimeValue, parseLocalYMDDate, previewUri, timeToString } from "./helpers";

// placeholder:text-muted-foreground and border-input after the restaurant theme's plum remap.
const PLACEHOLDER = "#b48aa2";
const INPUT_BORDER = "#e8dde3";

// gap = the web's space-y-N on the section (the title then has no mb-4 of its own).
export function Section({ title, gap, children, style }) {
  return (
    <View style={[styles.section, gap != null && { gap }, style]}>
      {title ? <Text style={[styles.sectionTitle, gap != null && { marginBottom: 0 }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Label({ children, style }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Hint({ children, style }) {
  return <Text style={[styles.hint, style]}>{children}</Text>;
}

export const Field = forwardRef(function Field({ style, editable = true, ...props }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={PLACEHOLDER}
      selectionColor={colors.primary}
      editable={editable}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        styles.input,
        focused && { borderColor: colors.focusBorder, boxShadow: `0px 0px 0px 3px ${colors.primaryTint15}` },
        style,
      ]}
    />
  );
});

export function UploadButton({ onPress, style }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.upload,
        { backgroundColor: pressed ? colors.primaryTint8 : colors.primaryTint3 },
        style,
      ]}
    >
      <Upload size={16} color="#3d1a2e" />
      <Text style={styles.uploadText}>Upload</Text>
    </Pressable>
  );
}

export function RemoveBadge({ onPress, style }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.remove, style]} accessibilityLabel="Remove">
      <X size={12} color="#ffffff" />
    </Pressable>
  );
}

// aspect-4/3 rounded-md bg-gray-100 preview with the remove button at the top right.
export function DocPreview({ value, onRemove }) {
  const uri = previewUri(value);
  return (
    <View style={styles.preview}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={styles.previewEmpty}>
          <Text style={styles.previewEmptyText}>Preview unavailable</Text>
        </View>
      )}
      <RemoveBadge onPress={onRemove} style={styles.previewRemove} />
    </View>
  );
}

/**
 * Pill toggle. activeColor: background when selected (bg-black buttons render in primary).
 * outlined: the border + white style of the pure-veg pills; otherwise gray-100 when unselected.
 */
export function Pill({ label, active, onPress, activeColor, outlined = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        outlined && styles.pillOutlined,
        active ? { backgroundColor: activeColor, borderColor: activeColor } : !outlined && styles.pillMuted,
      ]}
    >
      <Text style={[styles.pillText, { color: active ? "#ffffff" : outlined ? tw.gray700 : tw.gray800 }]}>{label}</Text>
    </Pressable>
  );
}

function displayTime(value) {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return "";
  const [h, m] = normalized.split(":").map(Number);
  return dayjs().hour(h).minute(m).format("hh:mm A");
}

// TimeSelector: bordered gray-50 box with a clock label and the "hh:mm aa" field.
export function TimeSelector({ label, value, onChange }) {
  const shown = displayTime(value);
  const open = () => {
    const normalized = normalizeTimeValue(value);
    const base = new Date();
    if (normalized) {
      const [h, m] = normalized.split(":").map(Number);
      base.setHours(h, m, 0, 0);
    }
    DateTimePickerAndroid.open({
      value: base,
      mode: "time",
      is24Hour: false,
      onValueChange: (_event, date) => {
        if (date) onChange(timeToString(date));
      },
    });
  };
  return (
    <View style={styles.timeBox}>
      <View style={styles.timeHead}>
        <Clock size={16} color={tw.gray800} />
        <Text style={styles.timeLabel}>{label}</Text>
      </View>
      <Pressable onPress={open} style={styles.timeField}>
        <Text style={[styles.timeText, !shown && { color: tw.gray400 }]}>{shown || "hh:mm aa"}</Text>
        <Clock size={20} color={tw.gray500} />
      </Pressable>
    </View>
  );
}

// FSSAI expiry: "Select expiry date" button; past dates can't be picked.
export function DateField({ value, onChange, minimumDate }) {
  const date = parseLocalYMDDate(value);
  const open = () => {
    DateTimePickerAndroid.open({
      value: date || new Date(),
      mode: "date",
      minimumDate,
      onValueChange: (_event, picked) => {
        if (picked) onChange(picked);
      },
    });
  };
  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.dateBtn, pressed && { backgroundColor: tw.gray50 }]}>
      <Text style={[styles.dateText, { color: date ? tw.gray900 : tw.gray500 }]}>
        {date ? dayjs(date).format("MMM D, YYYY") : "Select expiry date"}
      </Text>
      <Calendar size={16} color={tw.gray500} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: "#ffffff", padding: 16, borderRadius: radius.md },
  sectionTitle: { fontSize: 18, lineHeight: 28, fontWeight: "600", color: "#000000", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "500", color: tw.gray700 },
  hint: { fontSize: 11, color: tw.gray500, marginTop: 4 },
  input: {
    height: 36,
    marginTop: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 14,
    color: "#000000",
    fontFamily: fontFamilyByWeight["400"],
    ...shadow.sm,
  },
  upload: {
    height: 36,
    width: "100%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...shadow.sm,
  },
  uploadText: { fontSize: 12, fontWeight: "500", color: "#3d1a2e" },
  remove: { backgroundColor: tw.red500, borderRadius: 9999, padding: 4, ...shadow.md },
  preview: {
    marginTop: 12,
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: tw.gray100,
  },
  previewEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  previewEmptyText: { fontSize: 12, color: tw.gray500 },
  previewRemove: { position: "absolute", top: 8, right: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1, borderColor: "transparent" },
  pillOutlined: { backgroundColor: "#ffffff", borderColor: tw.gray200 },
  pillMuted: { backgroundColor: tw.gray100 },
  pillText: { fontSize: 12 },
  timeBox: {
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(249,250,251,0.6)",
  },
  timeHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  timeLabel: { fontSize: 12, fontWeight: "500", color: tw.gray900 },
  timeField: {
    height: 40,
    maxWidth: 246,
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: { fontSize: 14, color: tw.gray900 },
  dateBtn: {
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: radius.md,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: { fontSize: 14 },
});
