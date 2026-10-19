// Inventory.jsx "Mark item out of stock" popup with its SimpleCalendar and TimePickerWheel.
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { CenterSheet } from "./common";
import { pal } from "./palette";
import { formatPickerDate, formatPickerTime } from "./stockRules";

const ITEM_H = 40;
const WHEEL_H = 192; // h-48
const WHEEL_PAD = (WHEEL_H - ITEM_H) / 2;
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS = ["am", "pm"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Wheel({ values, value, onChange, format }) {
  const initialIndex = Math.max(0, values.indexOf(value));
  const settle = (y) => {
    const index = Math.max(0, Math.min(values.length - 1, Math.round(y / ITEM_H)));
    onChange(values[index]);
  };
  return (
    <ScrollView
      style={styles.wheel}
      contentContainerStyle={{ paddingVertical: WHEEL_PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      nestedScrollEnabled
      contentOffset={{ x: 0, y: initialIndex * ITEM_H }}
      onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
    >
      {values.map((v) => {
        const active = v === value;
        return (
          <View key={String(v)} style={styles.wheelItem}>
            <Text style={active ? styles.wheelActive : styles.wheelIdle}>{format ? format(v) : String(v)}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function TimePickerWheel({ isOpen, onClose, initialHour, initialMinute, initialPeriod, onConfirm }) {
  const parsedHour = Math.max(1, Math.min(12, parseInt(initialHour, 10) || 1));
  const parsedMinute = Math.max(0, Math.min(59, parseInt(initialMinute, 10) || 0));
  const parsedPeriod = initialPeriod === "am" || initialPeriod === "pm" ? initialPeriod : "am";
  const [hour, setHour] = useState(parsedHour);
  const [minute, setMinute] = useState(parsedMinute);
  const [period, setPeriod] = useState(parsedPeriod);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setHour(parsedHour);
      setMinute(parsedMinute);
      setPeriod(parsedPeriod);
    }
  }

  return (
    <CenterSheet open={isOpen} onClose={onClose} scroll={false} width={320} panelStyle={styles.smallPanel}>
      <View style={styles.wheelRow}>
        <View style={styles.wheelCol}>
          {isOpen ? <Wheel values={HOURS} value={hour} onChange={setHour} /> : null}
        </View>
        <Text style={styles.colon}>:</Text>
        <View style={styles.wheelCol}>
          {isOpen ? (
            <Wheel values={MINUTES} value={minute} onChange={setMinute} format={(m) => String(m).padStart(2, "0")} />
          ) : null}
        </View>
        <View style={styles.wheelCol}>
          {isOpen ? <Wheel values={PERIODS} value={period} onChange={setPeriod} /> : null}
        </View>
        <View pointerEvents="none" style={styles.wheelLines}>
          <View style={styles.wheelLine} />
          <View style={[styles.wheelLine, { marginTop: ITEM_H }]} />
        </View>
      </View>
      <View style={styles.okRow}>
        <Pressable
          onPress={() => {
            onConfirm(String(hour), String(minute).padStart(2, "0"), period);
            onClose();
          }}
          hitSlop={8}
        >
          <Text style={styles.okText}>Okay</Text>
        </Pressable>
      </View>
    </CenterSheet>
  );
}

function SimpleCalendar({ selectedDate, onDateSelect, isOpen, onClose }) {
  const { colors } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(() => (selectedDate ? new Date(selectedDate) : new Date()));
  const [syncedFor, setSyncedFor] = useState(selectedDate);
  if (selectedDate !== syncedFor) {
    setSyncedFor(selectedDate);
    if (selectedDate) setCurrentMonth(new Date(selectedDate));
  }

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const start = new Date(year, month, 1);
    start.setDate(start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1));
    const list = [];
    const cursor = new Date(start);
    for (let i = 0; i < 42; i += 1) {
      list.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return list;
  }, [currentMonth]);

  const todayStr = new Date().toDateString();
  const selectedStr = selectedDate ? new Date(selectedDate).toDateString() : null;
  const shiftMonth = (delta) => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + delta);
    setCurrentMonth(next);
  };

  return (
    <CenterSheet open={isOpen} onClose={onClose} scroll={false} width={384} panelStyle={styles.smallPanel}>
      <View style={styles.calBody}>
        <View style={styles.calHeader}>
          <Pressable onPress={() => shiftMonth(-1)} style={styles.calNav} hitSlop={6}>
            <ChevronLeft size={20} color={pal.gray900} />
          </Pressable>
          <Text style={styles.calTitle}>
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <Pressable onPress={() => shiftMonth(1)} style={styles.calNav} hitSlop={6}>
            <ChevronRight size={20} color={pal.gray900} />
          </Pressable>
        </View>
        <View style={styles.calGrid}>
          {DAY_NAMES.map((d) => (
            <View key={d} style={styles.calCell}>
              <Text style={styles.calDayName}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={styles.calGrid}>
          {days.map((date) => {
            const isCurrent = date.getMonth() === currentMonth.getMonth();
            const isSelected = selectedStr === date.toDateString();
            const isToday = todayStr === date.toDateString();
            let bg = "transparent";
            let fg = pal.gray700;
            let weight = "400";
            if (!isCurrent) fg = pal.gray300;
            else if (isSelected) {
              bg = colors.primary;
              fg = "#ffffff";
            } else if (isToday) {
              bg = colors.primaryTint6;
              fg = colors.primary;
              weight = "600";
            }
            return (
              <View key={date.toISOString()} style={styles.calCell}>
                <Pressable
                  onPress={() => {
                    onDateSelect(new Date(date));
                    onClose();
                  }}
                  style={[styles.calDay, { backgroundColor: bg }]}
                >
                  <Text style={{ fontSize: 14, color: fg, fontWeight: weight }}>{date.getDate()}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    </CenterSheet>
  );
}

function Radio({ checked, color }) {
  return (
    <View style={[styles.radio, { borderColor: checked ? color : pal.gray400 }]}>
      {checked ? <View style={[styles.radioDot, { backgroundColor: color }]} /> : null}
    </View>
  );
}

/**
 * Props: open, target ({type, categoryId, itemId}), category (for category toggles),
 * state {selectedOption, hours, selectedDate, selectedTime} + setters, onBack, onConfirm.
 */
export default function StockOffSheet({
  open,
  target,
  category,
  selectedOption,
  setSelectedOption,
  hours,
  setHours,
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  onClose,
  onConfirm,
}) {
  const { colors } = useTheme();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const confirming = useRef(false);
  const accent = colors.primaryStrong; // [style*="accent-color"] -> --rt-primary-strong

  const option = (value, label, extra) => (
    <Pressable onPress={() => setSelectedOption(value)} style={[styles.optionRow, extra?.last ? null : styles.optionBorder]}>
      <View style={styles.optionInner}>
        <Text style={styles.optionLabel}>{label}</Text>
        {extra?.inline}
        <View style={styles.radioWrap}>
          <Radio checked={selectedOption === value} color={accent} />
        </View>
      </View>
      {extra?.below}
    </Pressable>
  );

  return (
    <>
      <CenterSheet open={open && Boolean(target)} onClose={onClose} contentStyle={styles.sheetBody}>
        <Text style={styles.title}>
          {target?.type === "category" ? "Mark sub category out of stock" : "Mark item out of stock"}
        </Text>

        {target?.type === "category" && category ? (
          <View>
            <Text style={styles.catName}>{category.name}</Text>
            <Text style={styles.catLine}>• {category.name}</Text>
            <Text style={styles.catLine}>
              • Includes {category.itemCount} item{category.itemCount !== 1 ? "s" : ""}
            </Text>
            <View style={styles.catDivider} />
          </View>
        ) : null}

        <View style={styles.options}>
          {option("specific-time", "For specific time", {
            inline:
              selectedOption === "specific-time" ? (
                <View style={styles.stepper}>
                  <Pressable onPress={() => setHours(Math.max(1, hours - 1))} style={styles.stepBtn}>
                    <Minus size={16} color={pal.gray700} />
                  </Pressable>
                  <Text style={styles.stepValue}>
                    {hours} hour{hours !== 1 ? "s" : ""}
                  </Text>
                  <Pressable onPress={() => setHours(hours + 1)} style={styles.stepBtn}>
                    <Plus size={16} color={pal.gray700} />
                  </Pressable>
                </View>
              ) : null,
          })}
          {option("next-business-day", "Next business day - Opening time")}
          {option("custom-date-time", "Custom date & time")}
          {selectedOption === "custom-date-time" ? (
            <View style={styles.customRow}>
              <Pressable onPress={() => setShowCalendar(true)} style={styles.pickerBtn}>
                <Text style={styles.pickerText}>{selectedDate ? formatPickerDate(selectedDate) : "15 Dec 2025"}</Text>
                <ChevronDown size={16} color={pal.gray500} />
              </Pressable>
              <Pressable onPress={() => setShowTimePicker(true)} style={styles.pickerBtn}>
                <Text style={styles.pickerText}>{formatPickerTime(selectedTime)}</Text>
                <ChevronDown size={16} color={pal.gray500} />
              </Pressable>
            </View>
          ) : null}
          {option("manual", "I will turn it on manually", {
            last: true,
            below: (
              <Text style={styles.manualHint}>
                Item won&apos;t be visible to customers on app till you mark it back in stock
              </Text>
            ),
          })}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={onClose} style={[styles.actionBtn, styles.backBtn]}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              if (confirming.current) return;
              confirming.current = true;
              try {
                await onConfirm();
              } finally {
                confirming.current = false;
              }
            }}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.confirmText}>Confirm</Text>
          </Pressable>
        </View>
      </CenterSheet>

      <SimpleCalendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        isOpen={open && showCalendar}
        onClose={() => setShowCalendar(false)}
      />
      <TimePickerWheel
        isOpen={open && showTimePicker}
        onClose={() => setShowTimePicker(false)}
        initialHour={selectedTime.hour}
        initialMinute={selectedTime.minute}
        initialPeriod={selectedTime.period}
        onConfirm={(hour, minute, period) => {
          setSelectedTime({ hour, minute, period });
          setShowTimePicker(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheetBody: { padding: 24 },
  title: { fontSize: 18, fontWeight: "700", color: pal.gray900, textAlign: "center", marginBottom: 24 },
  catName: { fontSize: 16, fontWeight: "700", color: pal.gray900, marginBottom: 12 },
  catLine: { fontSize: 14, color: pal.gray600, marginBottom: 4 },
  catDivider: { borderTopWidth: 1, borderTopColor: pal.gray200, marginTop: 12 },
  options: { marginBottom: 24 },
  optionRow: { paddingVertical: 16 },
  optionBorder: { borderBottomWidth: 1, borderBottomColor: pal.gray200 },
  optionInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  optionLabel: { fontSize: 16, color: pal.gray900, flexShrink: 1 },
  radioWrap: { marginLeft: "auto" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  stepper: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: pal.gray200, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 16, fontWeight: "500", color: pal.gray900, minWidth: 60, textAlign: "center" },
  customRow: { flexDirection: "row", gap: 16, paddingVertical: 12 },
  pickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: pal.gray300,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  pickerText: { fontSize: 14, color: pal.gray900 },
  manualHint: { marginTop: 4, fontSize: 14, color: pal.gray500 },
  actions: { flexDirection: "row", gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  backBtn: { borderWidth: 1, borderColor: pal.gray300 },
  backText: { fontSize: 14, fontWeight: "500", color: pal.gray900 },
  confirmText: { fontSize: 14, fontWeight: "500", color: "#ffffff" },
  smallPanel: { borderRadius: 8 },
  wheelRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 32, paddingHorizontal: 16 },
  wheelCol: { flex: 1, height: WHEEL_H },
  wheel: { height: WHEEL_H },
  wheelItem: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  wheelActive: { fontSize: 20, fontWeight: "700", color: pal.gray900 },
  wheelIdle: { fontSize: 16, color: pal.gray400 },
  colon: { paddingHorizontal: 8, fontSize: 24, fontWeight: "700", color: pal.gray900 },
  wheelLines: { position: "absolute", left: 16, right: 16, top: 32 + WHEEL_PAD },
  wheelLine: { borderTopWidth: 1, borderTopColor: pal.gray300 },
  okRow: { borderTopWidth: 1, borderTopColor: pal.gray200, paddingVertical: 16, alignItems: "center" },
  okText: { fontSize: 16, fontWeight: "500", color: pal.blue600 },
  calBody: { padding: 16 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  calNav: { padding: 4, borderRadius: 4 },
  calTitle: { fontSize: 18, fontWeight: "600", color: pal.gray900 },
  calGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  calCell: { width: `${100 / 7}%`, padding: 2 },
  calDayName: { textAlign: "center", fontSize: 12, fontWeight: "500", color: pal.gray500, paddingVertical: 8 },
  calDay: { height: 40, borderRadius: 4, alignItems: "center", justifyContent: "center" },
});
