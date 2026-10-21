// DeliveryV2/components/WeekSelector: "This week" / "Last week" / "Select day" outline pills and the
// centred "DD MMM - DD MMM" range between hairlines. The Radix Popover + shadcn Calendar becomes the
// native date dialog (same single-day pick; its week is used, years 2020-2030).
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { ChevronDown } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Text from "../ui/Text";
import { BottomSheet } from "../ui/Sheet";
import { dvColor, light } from "../../theme/tokens";
import { twx } from "./common";

// date-fns startOfWeek / endOfWeek.
export function computeWeekRange(date, weekStartsOn = 0) {
  const d = new Date(date);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  return { start, end };
}

const isSameRange = (a, b) =>
  a.start.toDateString() === b.start.toDateString() && a.end.toDateString() === b.end.toDateString();

// Intl en-GB {day:'2-digit', month:'short'} -> "19 Oct"
const fmt = (d) => dayjs(d).format("DD MMM");

const MIN_DATE = new Date(2020, 0, 1);
const MAX_DATE = new Date(2030, 11, 31);

// shadcn Button variant="outline" (border-input bg-background text-foreground shadow-xs, rounded-md).
const OUTLINE = { border: "#e2e8f0", bg: "#F9F9FB", fg: "#3c0f3d" };

function Pill({ label, onPress, selected, children }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && {
          backgroundColor: dvColor("bg-emerald-50", light),
          borderColor: dvColor("border-emerald-200", light),
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.pillText, selected && { color: twx.emerald900 }]}>{label}</Text>
      {children}
    </Pressable>
  );
}

export default function WeekSelector({ weekStartsOn = 0, onChange, style }) {
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [range, setRange] = useState(() => computeWeekRange(new Date(), weekStartsOn));
  const [iosOpen, setIosOpen] = useState(false);

  const apply = useCallback(
    (date) => {
      const r = computeWeekRange(date, weekStartsOn);
      setRange(r);
      setAnchorDate(date);
      onChange?.(r);
    },
    [onChange, weekStartsOn],
  );

  const setThisWeek = () => apply(new Date());
  const setLastWeek = () => apply(dayjs().subtract(7, "day").toDate());

  const openPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: anchorDate,
        mode: "date",
        minimumDate: MIN_DATE,
        maximumDate: MAX_DATE,
        onChange: (event, date) => {
          if (event?.type === "set" && date) apply(date);
        },
      });
    } else {
      setIosOpen(true);
    }
  };

  const isThisWeek = isSameRange(range, computeWeekRange(new Date(), weekStartsOn));

  return (
    <View style={[{ width: "100%" }, style]}>
      <View style={styles.pills}>
        <Pill label="This week" onPress={setThisWeek} selected={isThisWeek} />
        <Pill label="Last week" onPress={setLastWeek} />
        <Pill label="Select day" onPress={openPicker}>
          <ChevronDown size={16} color={OUTLINE.fg} style={{ marginLeft: 8 }} />
        </Pill>
      </View>

      <View style={styles.rangeRow}>
        <View style={styles.hairline} />
        <Text style={styles.rangeText}>
          {fmt(range.start)} - {fmt(range.end)}
        </Text>
        <View style={styles.hairline} />
      </View>

      {Platform.OS === "ios" ? (
        <BottomSheet visible={iosOpen} onClose={() => setIosOpen(false)}>
          <DateTimePicker
            value={anchorDate}
            mode="date"
            display="inline"
            minimumDate={MIN_DATE}
            maximumDate={MAX_DATE}
            onChange={(event, date) => {
              if (date) apply(date);
              setIosOpen(false);
            }}
          />
        </BottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: "row", flexWrap: "nowrap", alignItems: "center", justifyContent: "center", gap: 6 },
  pill: {
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OUTLINE.border,
    backgroundColor: OUTLINE.bg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  pillText: { fontSize: 12, fontWeight: "500", color: OUTLINE.fg },
  rangeRow: { marginTop: 24, flexDirection: "row", alignItems: "center", gap: 16 },
  hairline: { height: 1, flex: 1, backgroundColor: "#f1f5f9" },
  rangeText: { fontSize: 18, fontWeight: "600", color: "#b18da5" },
});
