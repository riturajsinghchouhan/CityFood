// "Delivery in X" with the inline "Schedule it" date (today/tomorrow) and hourly slot picker.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { Check, ChevronDown, Zap } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Dialog, Text } from "../ui";
import { tw } from "../../theme/tokens";
import { localDateString } from "../../screens/cart/cartUtils";
import { useCartPalette } from "./palette";

const parseLocalDate = (value) => {
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export default function DeliveryTimeSection({
  eta,
  isScheduled,
  onToggleSchedule,
  scheduledDate,
  onChangeDate,
  scheduledTime,
  onChangeTime,
  slots,
}) {
  const p = useCartPalette();
  const [showIosDate, setShowIosDate] = useState(false);
  const [showSlots, setShowSlots] = useState(false);

  // Web input min/max: today and tomorrow, fixed when the section mounts.
  const [{ minDate, maxDate }] = useState(() => ({
    minDate: parseLocalDate(localDateString(new Date())),
    maxDate: parseLocalDate(localDateString(new Date(Date.now() + 86400000))),
  }));

  const openDatePicker = () => {
    const value = scheduledDate ? parseLocalDate(scheduledDate) : minDate;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        minimumDate: minDate,
        maximumDate: maxDate,
        onChange: (event, date) => {
          if (event.type === "set" && date) onChangeDate(localDateString(date));
        },
      });
    } else {
      setShowIosDate(true);
    }
  };

  const fieldStyle = [
    styles.field,
    { borderColor: p.isDark ? tw.gray700 : tw.gray300, backgroundColor: p.inputBg },
  ];
  const selectedSlot = slots.find((s) => s.value === scheduledTime);

  return (
    <View style={[p.cardStyle, { paddingVertical: 20 }]}>
      <View style={styles.row}>
        <View style={{ marginTop: 2 }}>
          <Zap size={20} color={tw.green600} fill={tw.green600 + "33"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: p.t800 }]}>
            Delivery in <Text style={styles.eta}>{eta}</Text>
          </Text>
          <View style={styles.laterRow}>
            <Text style={[styles.later, { color: p.t600 }]}>Want this later? </Text>
            <Pressable onPress={onToggleSchedule} hitSlop={6}>
              <Text style={[styles.scheduleLink, { color: p.t600, borderColor: tw.gray500 }]}>
                {isScheduled ? "Cancel schedule" : "Schedule it"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {isScheduled ? (
        <View style={[styles.scheduleBox, { borderColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
          <View>
            <Text style={[styles.label, { color: p.t500 }]}>Date (Up to Tomorrow)</Text>
            <Pressable onPress={openDatePicker} style={fieldStyle}>
              <Text style={[styles.fieldText, { color: p.t800 }]}>
                {scheduledDate ? dayjs(parseLocalDate(scheduledDate)).format("DD/MM/YYYY") : "dd/mm/yyyy"}
              </Text>
            </Pressable>
          </View>
          <View>
            <Text style={[styles.label, { color: p.t500 }]}>Time</Text>
            {slots.length > 0 ? (
              <Pressable onPress={() => setShowSlots(true)} style={[fieldStyle, styles.selectField]}>
                <Text style={[styles.fieldText, { color: p.t800 }]}>{selectedSlot?.label || ""}</Text>
                <ChevronDown size={16} color={tw.gray500} />
              </Pressable>
            ) : (
              <View
                style={[
                  styles.field,
                  {
                    backgroundColor: p.isDark ? tw.gray800 : tw.gray100,
                    borderColor: p.isDark ? tw.gray700 : tw.gray200,
                    alignItems: "center",
                  },
                ]}
              >
                <Text style={[styles.fieldText, { color: p.t500 }]}>
                  {scheduledDate ? "No slots available" : "Select date first"}
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : null}

      <Dialog visible={showSlots} onClose={() => setShowSlots(false)} style={styles.slotDialog}>
        <ScrollView style={{ maxHeight: 360 }}>
          {slots.map((slot) => {
            const active = slot.value === scheduledTime;
            return (
              <Pressable
                key={slot.value}
                onPress={() => {
                  onChangeTime(slot.value);
                  setShowSlots(false);
                }}
                style={styles.slotRow}
              >
                <Text style={[styles.slotText, { color: p.t900, fontWeight: active ? "600" : "400" }]}>
                  {slot.label}
                </Text>
                {active ? <Check size={18} color={p.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Dialog>

      {Platform.OS !== "android" ? (
        <Dialog visible={showIosDate} onClose={() => setShowIosDate(false)}>
          <DateTimePicker
            value={scheduledDate ? parseLocalDate(scheduledDate) : minDate}
            mode="date"
            display="inline"
            minimumDate={minDate}
            maximumDate={maxDate}
            onChange={(event, date) => {
              if (date) onChangeDate(localDateString(date));
              setShowIosDate(false);
            }}
          />
        </Dialog>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { fontSize: 16 },
  eta: { color: tw.green600, fontWeight: "700", fontSize: 16 },
  laterRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  later: { fontSize: 14 },
  scheduleLink: { fontSize: 14, fontWeight: "500", borderBottomWidth: 1 },
  scheduleBox: { marginTop: 20, paddingTop: 12, borderTopWidth: 1, gap: 12 },
  label: { fontSize: 12, marginBottom: 4 },
  field: { borderWidth: 1, borderRadius: 6, padding: 8, minHeight: 38, justifyContent: "center" },
  selectField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldText: { fontSize: 14 },
  slotDialog: { padding: 8 },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  slotText: { fontSize: 15 },
});
