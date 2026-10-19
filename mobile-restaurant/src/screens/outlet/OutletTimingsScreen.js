// Port of pages/restaurant/OutletTimings.jsx (/outlet-timings): Mon–Sun accordion with an
// open/closed switch and opening/closing times (MUI MobileTimePicker -> the native time dialog).
// Every user change auto-saves 500 ms later with PUT /outlet-timings; errors are swallowed as on web.
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { ChevronDown, ChevronUp, Clock } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { WEEK_DAYS, getOutletTimings, saveOutletTimings } from "../../api";
import { PageHeader, ShadSwitch } from "../../components/outlet/common";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { useBusinessSettings } from "../../components/shell/stores";
import { Text } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { tw } from "../../theme/tokens";

const BLUE = tw.blue600;

const getDefaultDays = () =>
  Object.fromEntries(WEEK_DAYS.map((d) => [d, { isOpen: true, openingTime: "09:00", closingTime: "22:00" }]));

// stringToTime: "HH:mm" -> Date (hour 0 falls back to 9 on web: `hours || 9`).
function stringToTime(timeString) {
  const d = new Date();
  d.setSeconds(0, 0);
  if (!timeString || !timeString.includes(":")) {
    d.setHours(9, 0);
    return d;
  }
  const [h, m] = timeString.split(":").map(Number);
  d.setHours(h || 9, m || 0);
  return d;
}

const pad = (n) => String(n).padStart(2, "0");
const timeToString = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// MUI field text, format "hh:mm a".
function fieldText(date) {
  const h = date.getHours();
  return `${pad(h % 12 || 12)}:${pad(date.getMinutes())} ${h >= 12 ? "pm" : "am"}`;
}

function formatTime12Hour(time24) {
  if (!time24) return "09:00 AM";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function TimeRow({ label, value, onChange }) {
  const date = stringToTime(value);
  const open = () => {
    DateTimePickerAndroid.open({
      value: date,
      mode: "time",
      is24Hour: false,
      onValueChange: (_event, picked) => {
        if (picked) onChange(picked);
      },
    });
  };
  return (
    <View style={styles.timeBlock}>
      <View style={styles.timeLabelRow}>
        <Clock size={16} color={tw.gray700} />
        <Text style={styles.timeLabel}>{label}</Text>
      </View>
      <View style={styles.timeBox}>
        <Pressable onPress={open} style={styles.timeField} accessibilityRole="button">
          <Text style={styles.timeFieldText}>{fieldText(date)}</Text>
        </Pressable>
      </View>
      <Text style={styles.current}>Current: {formatTime12Hour(value)}</Text>
    </View>
  );
}

function DayRow({ day, index, dayData, expanded, onToggle, onToggleOpen, onTimeChange }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 200, delay: index * 30, useNativeDriver: true }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={[
        styles.dayCard,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
    >
      <View style={[styles.dayHead, expanded && { backgroundColor: tw.gray100 }]}>
        <Pressable onPress={onToggle} style={styles.dayToggle}>
          {expanded ? <ChevronUp size={20} color={tw.gray700} /> : <ChevronDown size={20} color={tw.gray700} />}
          <Text style={styles.dayName}>{day}</Text>
        </Pressable>
        <View style={styles.dayRight}>
          <Text style={styles.openText}>{dayData.isOpen ? "Open" : "Close"}</Text>
          <ShadSwitch checked={dayData.isOpen} onCheckedChange={onToggleOpen} />
        </View>
      </View>
      {expanded ? (
        <View style={styles.dayBody}>
          {dayData.isOpen ? (
            <>
              <TimeRow label="Opening time" value={dayData.openingTime} onChange={(d) => onTimeChange("openingTime", d)} />
              <TimeRow label="Closing time" value={dayData.closingTime} onChange={(d) => onTimeChange("closingTime", d)} />
            </>
          ) : (
            <Text style={styles.closed}>This day is closed</Text>
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

export default function OutletTimingsScreen() {
  const goBack = useAppBack();
  const shellInset = useShellBottomInset();
  const { companyName } = useBusinessSettings();
  const [expandedDay, setExpandedDay] = useState("Monday");
  const [days, setDays] = useState(getDefaultDays);
  const [loading, setLoading] = useState(true);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await getOutletTimings();
        const outletTimings = res?.data?.outletTimings;
        if (mounted && outletTimings && typeof outletTimings === "object") {
          setDays({ ...getDefaultDays(), ...outletTimings });
        }
      } catch {
        // web logs and keeps the defaults
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Debounced save, only after a user change.
  useEffect(() => {
    if (loading || !isInternalUpdate.current) return undefined;
    const t = setTimeout(() => {
      saveOutletTimings(days).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [days, loading]);

  const toggleDayOpen = (day) => {
    isInternalUpdate.current = true;
    setDays((prev) => {
      const newOpen = !prev[day].isOpen;
      return {
        ...prev,
        [day]: {
          ...prev[day],
          isOpen: newOpen,
          openingTime: newOpen ? prev[day].openingTime || "09:00" : "",
          closingTime: newOpen ? prev[day].closingTime || "22:00" : "",
        },
      };
    });
  };

  const handleTimeChange = (day, timeType, date) => {
    if (!date) return;
    isInternalUpdate.current = true;
    const timeString = timeToString(date);
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], [timeType]: timeString } }));
  };

  if (loading) {
    return (
      <View style={[styles.page, styles.center]}>
        <Text style={styles.loadingText}>Loading outlet timings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <PageHeader title="Outlet timings" onBack={goBack} />
      <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingBottom: 24 + shellInset }]}>
        <View style={styles.brandBlock}>
          <Text style={styles.brandTitle}>{companyName || "CityFood"} delivery</Text>
          <View style={styles.brandLine} />
        </View>
        <View style={styles.days}>
          {WEEK_DAYS.map((day, index) => {
            const dayData = days[day] || { isOpen: true, openingTime: "09:00", closingTime: "22:00" };
            return (
              <DayRow
                key={day}
                day={day}
                index={index}
                dayData={dayData}
                expanded={expandedDay === day}
                onToggle={() => setExpandedDay((cur) => (cur === day ? null : day))}
                onToggleOpen={() => toggleDayOpen(day)}
                onTimeChange={(type, date) => handleTimeChange(day, type, date)}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  center: { alignItems: "center", justifyContent: "center" },
  fill: { flex: 1 },
  loadingText: { fontSize: 14, color: tw.gray600 },
  content: { paddingHorizontal: 16, paddingTop: 24 },
  brandBlock: { marginBottom: 24 },
  brandTitle: { fontSize: 16, fontWeight: "600", color: BLUE, textAlign: "center", marginBottom: 8 },
  brandLine: { height: 2, backgroundColor: BLUE },
  days: { gap: 8 },
  dayCard: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: tw.gray200, borderRadius: 2, overflow: "hidden" },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  dayToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  dayName: { fontSize: 16, fontWeight: "500", color: tw.gray900 },
  dayRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  openText: { fontSize: 14, color: tw.gray700 },
  dayBody: { padding: 16, gap: 16, borderTopWidth: 1, borderTopColor: tw.gray100 },
  closed: { fontSize: 14, color: tw.gray500, paddingLeft: 24 },
  timeBlock: { gap: 8 },
  timeLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeLabel: { fontSize: 14, fontWeight: "500", color: tw.gray700 },
  timeBox: {
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(249,250,251,0.6)",
  },
  timeField: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 4,
  },
  timeFieldText: { fontSize: 12, color: "rgba(0,0,0,0.87)" },
  current: { fontSize: 12, color: tw.gray500 },
});
