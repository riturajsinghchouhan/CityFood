// Port of Frontend/src/modules/Food/pages/user/dining/TableBooking.jsx (/dining/book/:slug).
// The web also asks GET /food/dining/bookings/restaurant/:id for live occupancy; that endpoint is
// restaurant-only and always fails for customers, leaving no bookings, so it is not called here and
// occupied seats stay 0 exactly as on web. The page has no dark-mode styles on web.
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getOutletTimingsByRestaurantId, getRestaurantBySlug } from "../../api";
import DiningLoader from "../../components/dining/DiningLoader";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import {
  NAV_KEYS,
  formatDayMonth,
  formatTimeValue,
  getNavState,
  getWeekdayName,
  navigateWithState,
  pal,
  saveBookingDraft,
} from "./diningLib";

const buildDates = (count = 7) =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date;
  });

const parseTimeToMinutes = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  const meridiemMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!meridiemMatch) return null;
  let hour = Number(meridiemMatch[1]);
  const minute = Number(meridiemMatch[2] || 0);
  const meridiem = meridiemMatch[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
};

const buildSlots = (timing) => {
  if (!timing || timing.isOpen === false) return [];
  const opening = parseTimeToMinutes(timing.openingTime);
  let closing = parseTimeToMinutes(timing.closingTime);
  if (opening === null || closing === null) return [];
  // Closing earlier than opening means it closes after midnight.
  if (closing <= opening) closing += 24 * 60;
  const slots = [];
  let cursor = opening;
  while (cursor <= closing) {
    const hours = Math.floor((cursor % (24 * 60)) / 60);
    const minutes = cursor % 60;
    slots.push(formatTimeValue(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`));
    cursor += 30;
  }
  return slots;
};

const buildFallbackTiming = (restaurant) => ({
  isOpen: true,
  openingTime: String(restaurant?.openingTime || restaurant?.diningSettings?.openingTime || "12:00").trim(),
  closingTime: String(restaurant?.closingTime || restaurant?.diningSettings?.closingTime || "23:00").trim(),
});

const getMealPeriod = (slot) => {
  if (!slot) return "all";
  const match = String(slot).toUpperCase().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
  if (!match) return "all";
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (match[3] === "PM" && hour !== 12) hour += 12;
  if (match[3] === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute < 17 * 60 ? "lunch" : "dinner";
};

const getOfferLabel = (slot) => (getMealPeriod(slot) === "lunch" ? "Lunch" : "Carnival");

const CARD_SHADOW = { boxShadow: "0px 8px 24px rgba(15,23,42,0.06)" };
const SELECTED = { borderColor: "#ef8f98", backgroundColor: "#fffaf9" };
const IDLE = { borderColor: "#ececf2", backgroundColor: "#ffffff" };

export default function TableBookingScreen() {
  const { slug } = useLocalSearchParams();
  const goBack = useAppBack();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [routeState] = useState(() => getNavState(NAV_KEYS.book(slug)));

  const [restaurant, setRestaurant] = useState(routeState?.restaurant || null);
  const [loading, setLoading] = useState(!routeState?.restaurant);
  const [outletTimings, setOutletTimings] = useState({});
  const [selectedGuests, setSelectedGuests] = useState(routeState?.guestCount || 2);
  const [selectedDate, setSelectedDate] = useState(() => {
    const initial = routeState?.selectedDate ? new Date(routeState.selectedDate) : new Date();
    return Number.isNaN(initial.getTime()) ? new Date() : initial;
  });
  const [chosenSlot, setChosenSlot] = useState(routeState?.selectedTime || null);
  const [chosenMealPeriod, setChosenMealPeriod] = useState("lunch");
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Re-filter today's slots every minute.
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stateRestaurant = routeState?.restaurant;
    if (stateRestaurant) {
      const restaurantId = stateRestaurant?._id || stateRestaurant?.id || slug;
      getOutletTimingsByRestaurantId(restaurantId)
        .then((res) => !cancelled && setOutletTimings(res?.data?.outletTimings || {}))
        .catch(() => !cancelled && setOutletTimings({}));
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        setLoading(true);
        const response = await getRestaurantBySlug(slug);
        if (cancelled) return;
        if (response?.success) {
          const apiRestaurant = response?.data?.restaurant || response?.data;
          setRestaurant(apiRestaurant || null);
          const restaurantId = apiRestaurant?._id || apiRestaurant?.id || slug;
          const timingsResponse = await getOutletTimingsByRestaurantId(restaurantId);
          if (!cancelled) setOutletTimings(timingsResponse?.data?.outletTimings || {});
        }
      } catch {
        if (!cancelled) setRestaurant(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeState, slug]);

  // Customer occupancy is never available (see header), so nothing is booked.
  const occupiedSeats = 0;
  const maxCapacity = restaurant?.diningSettings?.maxGuests || 10;
  const remainingSeats = Math.max(0, maxCapacity - occupiedSeats);

  const dates = useMemo(() => buildDates(7), []);
  const selectedDayTiming = useMemo(() => {
    const fromOutlet = outletTimings?.[getWeekdayName(selectedDate)] || null;
    if (fromOutlet && fromOutlet.isOpen !== false) return fromOutlet;
    return buildFallbackTiming(restaurant);
  }, [outletTimings, selectedDate, restaurant]);
  const allSlots = useMemo(() => buildSlots(selectedDayTiming), [selectedDayTiming]);

  const availableSlots = useMemo(() => {
    const isToday = selectedDate.toDateString() === currentTime.toDateString();
    if (!isToday) return allSlots;
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return allSlots.filter((slot) => parseTimeToMinutes(slot) > currentMinutes + 15);
  }, [allSlots, selectedDate, currentTime]);

  // Web effects that switch Lunch/Dinner when one period has no slots and keep the slot valid,
  // derived during render instead.
  const hasLunch = availableSlots.some((slot) => getMealPeriod(slot) === "lunch");
  const hasDinner = availableSlots.some((slot) => getMealPeriod(slot) === "dinner");
  let selectedMealPeriod = chosenMealPeriod;
  if (availableSlots.length > 0) {
    if (chosenMealPeriod === "lunch" && !hasLunch && hasDinner) selectedMealPeriod = "dinner";
    if (chosenMealPeriod === "dinner" && !hasDinner && hasLunch) selectedMealPeriod = "lunch";
  }
  const filteredSlots = availableSlots.filter((slot) => getMealPeriod(slot) === selectedMealPeriod);
  const selectedSlot =
    filteredSlots.length === 0 ? null : filteredSlots.includes(chosenSlot) ? chosenSlot : filteredSlots[0];

  const guestCell = Math.floor((Math.min(width, 448) - 32 - 32 - 32) / 5);
  const thirdCell = Math.floor((Math.min(width, 448) - 32 - 32 - 24) / 3);

  if (loading) return <DiningLoader />;
  if (!restaurant) {
    return (
      <Screen background="#ffffff">
        <View style={{ padding: 24 }}>
          <Text style={{ textAlign: "center", fontSize: 16, color: "#000000" }}>Restaurant not found</Text>
        </View>
      </Screen>
    );
  }

  const isDiningEnabled = restaurant?.diningSettings?.isEnabled !== false;
  const canProceed = Boolean(isDiningEnabled && restaurant && selectedSlot && selectedDate && selectedGuests);

  const handleProceed = () => {
    if (!isDiningEnabled) {
      toast.error("Dining bookings are currently paused for this restaurant.");
      return;
    }
    if (!canProceed) {
      toast.error("Please select date, time, and guests to continue.");
      return;
    }
    const bookingDraft = {
      restaurant: {
        _id: restaurant?._id || restaurant?.id || restaurant?.restaurant?._id || restaurant?.restaurant?.id || null,
        id: restaurant?.id || restaurant?._id || restaurant?.restaurant?.id || restaurant?.restaurant?._id || null,
        name: restaurant?.name || restaurant?.restaurantName || "Restaurant",
        restaurantName: restaurant?.restaurantName || restaurant?.name || "Restaurant",
        profileImage: restaurant?.profileImage || restaurant?.restaurant?.profileImage || null,
        image: restaurant?.image || restaurant?.restaurant?.image || restaurant?.profileImage?.url || "",
        location: restaurant?.location || restaurant?.restaurant?.location || null,
        slug: restaurant?.slug || slug || "",
        diningSettings: restaurant?.diningSettings || restaurant?.restaurant?.diningSettings || null,
      },
      guests: selectedGuests,
      date: selectedDate.toISOString(),
      timeSlot: selectedSlot,
      discount: selectedSlot,
    };
    saveBookingDraft(bookingDraft);
    navigateWithState("/dining/book-confirmation", NAV_KEYS.confirmation, bookingDraft);
  };

  let ctaLabel = "Select a time slot to proceed";
  if (!isDiningEnabled) ctaLabel = "Dining paused";
  else if (canProceed) ctaLabel = "Proceed to confirmation";

  return (
    <Screen background="#f5f6fb" statusBarStyle="dark" edges={[]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#ffe7c6", "#fff1d7", "#f5f6fb"]} style={[styles.header, { paddingTop: 20 + insets.top }]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.65)", "rgba(255,255,255,0)"]}
            style={styles.headerGlow}
            pointerEvents="none"
          />
          <Pressable onPress={goBack} style={styles.backBtn}>
            <ArrowLeft size={20} color="#383838" />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Book a table</Text>
            <Text style={styles.subtitle}>{restaurant.name || restaurant.restaurantName}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {!isDiningEnabled ? (
            <View style={styles.pausedCard}>
              <Text style={styles.pausedTitle}>Dining bookings are paused by this restaurant.</Text>
              <Text style={styles.pausedBody}>
                You can still view details, but new table bookings are disabled right now.
              </Text>
            </View>
          ) : null}

          <View style={[styles.card, CARD_SHADOW]}>
            <View style={styles.guestHeader}>
              <Text style={styles.cardTitle}>Select number of guests</Text>
              <View style={styles.leftPill}>
                <Text style={[styles.leftPillText, { color: colors.primary }]}>{remainingSeats} left</Text>
              </View>
            </View>
            <View style={[styles.grid, { gap: 8 }]}>
              {Array.from({ length: maxCapacity }, (_, index) => {
                const count = index + 1;
                const isBooked = count <= occupiedSeats;
                const isTooLarge = count > remainingSeats && !isBooked;
                const selected = selectedGuests === count;
                let look = { ...IDLE, color: "#444b5f" };
                if (selected) look = { ...SELECTED, color: "#d64f63", boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" };
                else if (isBooked) look = { borderColor: pal.red50, backgroundColor: pal.red50, color: pal.red200 };
                else if (isTooLarge) look = { borderColor: "#f9fafb", backgroundColor: "#f9fafb", color: "#e5e7eb" };
                const { color, ...box } = look;
                return (
                  <Pressable
                    key={count}
                    disabled={isBooked || isTooLarge}
                    onPress={() => setSelectedGuests(count)}
                    style={[styles.guestCell, { width: guestCell }, box]}
                  >
                    <Text style={[styles.guestText, { color }]}>{isBooked ? "X" : count}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, CARD_SHADOW]}>
            <Text style={styles.cardTitle}>Select date</Text>
            <View style={[styles.grid, { gap: 12, marginTop: 16 }]}>
              {dates.slice(0, 3).map((date, index) => {
                const active = selectedDate.toDateString() === date.toDateString();
                return (
                  <Pressable
                    key={date.toISOString()}
                    onPress={() => setSelectedDate(date)}
                    style={[styles.dateCell, { width: thirdCell }, active ? SELECTED : IDLE]}
                  >
                    <Text style={styles.dateLabel}>
                      {index === 0 ? "Today" : index === 1 ? "Tomorrow" : getWeekdayName(date)}
                    </Text>
                    <Text style={styles.dateValue}>{formatDayMonth(date)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, CARD_SHADOW]}>
            <Text style={styles.cardTitle}>Select time of day</Text>
            <View style={styles.periodRow}>
              {[
                { id: "lunch", label: "Lunch" },
                { id: "dinner", label: "Dinner" },
              ].map((period) => {
                const active = selectedMealPeriod === period.id;
                return (
                  <Pressable
                    key={period.id}
                    onPress={() => setChosenMealPeriod(period.id)}
                    style={[
                      styles.periodPill,
                      active
                        ? { borderColor: "#ef8f98", backgroundColor: "#ffffff" }
                        : { borderColor: "#ececf2", backgroundColor: "#fafafc" },
                    ]}
                  >
                    <Text style={[styles.periodText, { color: active ? "#d64f63" : "#666f82" }]}>{period.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.grid, { gap: 12, marginTop: 16 }]}>
              {filteredSlots.length === 0 ? (
                <View style={styles.noSlots}>
                  <Text style={styles.noSlotsText}>No {selectedMealPeriod} slots available for the selected date.</Text>
                </View>
              ) : (
                filteredSlots.map((slot) => {
                  const active = selectedSlot === slot;
                  return (
                    <Pressable
                      key={slot}
                      onPress={() => setChosenSlot(slot)}
                      style={[styles.slotCell, { width: thirdCell }, active ? SELECTED : IDLE]}
                    >
                      <Text style={styles.slotText}>{slot}</Text>
                      <Text style={styles.slotOffer}>{getOfferLabel(slot)}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>

          <View style={[styles.infoCard, { boxShadow: "0px 8px 24px rgba(15,23,42,0.05)" }]}>
            <Text style={styles.infoText}>Select your preferred time slot to view available booking options</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <Pressable
          disabled={!canProceed}
          onPress={handleProceed}
          style={[styles.cta, { backgroundColor: canProceed ? "#eb4d60" : "#a4abba" }]}
        >
          <Text style={[styles.ctaText, { color: canProceed ? "#ffffff" : "rgba(255,255,255,0.95)" }]}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 20, overflow: "hidden" },
  headerGlow: { position: "absolute", left: 0, right: 0, top: 0, height: 96 },
  backBtn: {
    height: 40,
    width: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  titleWrap: { marginTop: 24, alignItems: "center" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "900", letterSpacing: -0.75, color: "#25314a" },
  subtitle: { marginTop: 4, fontSize: 14, fontWeight: "500", color: "#636363" },
  body: { marginTop: -16, paddingHorizontal: 16, gap: 16, width: "100%", maxWidth: 448, alignSelf: "center" },
  pausedCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: pal.amber200,
    backgroundColor: pal.amber50,
    paddingHorizontal: 16,
    paddingVertical: 16,
    boxShadow: "0px 8px 24px rgba(15,23,42,0.04)",
  },
  pausedTitle: { fontSize: 14, fontWeight: "600", color: pal.amber900 },
  pausedBody: { marginTop: 4, fontSize: 12, color: pal.amber800 },
  card: { borderRadius: 22, backgroundColor: "#ffffff", padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: "500", color: "#2f3545" },
  guestHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  leftPill: { backgroundColor: "#fdfafc", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  leftPillText: { fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  guestCell: { height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  guestText: { fontSize: 14, fontWeight: "700" },
  dateCell: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 16, alignItems: "center" },
  dateLabel: { fontSize: 14, fontWeight: "500", color: "#444b5f", textAlign: "center" },
  dateValue: { marginTop: 4, fontSize: 14, color: "#7b8191" },
  periodRow: { marginTop: 16, flexDirection: "row", gap: 8 },
  periodPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  periodText: { fontSize: 14, fontWeight: "500" },
  noSlots: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#e5e7ef",
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  noSlotsText: { textAlign: "center", fontSize: 14, color: "#7c8394" },
  slotCell: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 16, alignItems: "center" },
  slotText: { fontSize: 14, fontWeight: "500", color: "#314158" },
  slotOffer: { marginTop: 4, fontSize: 12, fontWeight: "500", color: "#2d5ea8" },
  infoCard: { borderRadius: 18, backgroundColor: "#ffffff", paddingHorizontal: 16, paddingVertical: 20 },
  infoText: { textAlign: "center", fontSize: 14, color: "#6f7687" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderColor: "#e6e7ef",
    backgroundColor: "rgba(245,246,251,0.95)",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cta: { height: 56, width: "100%", maxWidth: 448, alignSelf: "center", borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 18, fontWeight: "700" },
});
