// Port of components/ui/date-range-calendar.tsx: a Monday-first month grid; the first tap sets the
// start, the second the end (swapped if earlier), which applies the range and closes after 300 ms.
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";
import { pal } from "./ordersUtils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// toLocaleDateString("en-US", {day:"numeric", month:"short"})
const short = (d) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;

export default function DateRangeCalendar({ startDate, endDate, onDateRangeChange, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (startDate) setCurrentMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
  }, [startDate]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const days = useMemo(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1));
    const out = [];
    const cur = new Date(start);
    for (let i = 0; i < 42; i += 1) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [currentMonth]);

  const handleDatePress = (date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(date);
      setTempEnd(null);
      return;
    }
    let finalStart = tempStart;
    let finalEnd = date;
    if (date.getTime() < tempStart.getTime()) {
      finalStart = date;
      finalEnd = tempStart;
    }
    setTempStart(finalStart);
    setTempEnd(finalEnd);
    onDateRangeChange(finalStart, finalEnd);
    if (onClose) closeTimer.current = setTimeout(onClose, 300);
  };

  const rangeText =
    tempStart && tempEnd
      ? `${short(tempStart)} - ${short(tempEnd)}`
      : tempStart
        ? `${short(tempStart)} - Select end date`
        : "Select start date";

  const today = new Date().toDateString();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          style={({ pressed }) => [styles.navBtn, pressed && { backgroundColor: tw.gray100 }]}
        >
          <ChevronLeft size={16} color={tw.gray900} />
        </Pressable>
        <Text style={styles.monthText}>
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <Pressable
          onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          style={({ pressed }) => [styles.navBtn, pressed && { backgroundColor: tw.gray100 }]}
        >
          <ChevronRight size={16} color={tw.gray900} />
        </Pressable>
      </View>

      <View style={[styles.grid, { marginBottom: 8 }]}>
        {WEEK_DAYS.map((d) => (
          <View key={d} style={styles.cell}>
            <Text style={styles.weekDay}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((date, i) => {
          const inMonth = date.getMonth() === currentMonth.getMonth();
          const isToday = date.toDateString() === today;
          const t = date.getTime();
          const inRange = tempStart && tempEnd ? t >= tempStart.getTime() && t <= tempEnd.getTime() : false;
          const isStart = tempStart && date.toDateString() === tempStart.toDateString();
          const isEnd = tempEnd && date.toDateString() === tempEnd.toDateString();
          let bg = "transparent";
          let fg = inMonth ? tw.gray900 : tw.gray400;
          let weight = "400";
          if (isStart || isEnd) {
            bg = pal.green500;
            fg = "#fff";
            weight = "600";
          } else if (inRange) {
            bg = tw.green100;
            fg = pal.green700;
          } else if (isToday) {
            bg = tw.blue50;
            fg = tw.blue600;
            weight = "500";
          }
          return (
            <View key={i} style={styles.cell}>
              <Pressable onPress={() => handleDatePress(date)} style={[styles.day, { backgroundColor: bg }]}>
                <Text style={[styles.dayText, { color: fg, fontWeight: weight }]}>{date.getDate()}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.rangeText}>{rangeText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tw.gray200,
    padding: 16,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  navBtn: { width: 32, height: 32, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  monthText: { fontSize: 14, fontWeight: "600", color: tw.gray900 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 2 },
  weekDay: { fontSize: 12, fontWeight: "500", color: tw.gray500, paddingVertical: 4 },
  day: { width: 36, height: 36, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 12 },
  footer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: tw.gray200 },
  rangeText: { fontSize: 12, fontWeight: "500", color: tw.gray600, textAlign: "center" },
});
