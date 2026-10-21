// DeliveryV2/pages/HistoryV2 (/history, a shell tab without a nav item, opened from Profile ->
// "Trips history"): daily/weekly/monthly tabs, a 30-day date dropdown, a trip-type dropdown, the COD /
// earnings summary, the trip list and the "Incentive Records" bonus sheet.
// The web remounts HistoryV2 every time the tab opens, so filters reset on blur and trips reload on focus.
import { useFocusEffect } from "expo-router";
import dayjs from "dayjs";
import { ArrowLeft, ChevronDown, Clock, Gift } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTripHistory, getWalletTransactions } from "../../api";
import Spinner from "../../components/content/Spinner";
import BonusSheet from "../../components/orders/BonusSheet";
import { dvCard } from "../../components/pocket/common";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { dvColor, light, tw } from "../../theme/tokens";

const ACCENT = dvColor("text-[#10B981]", light);
const HEADER_BG = dvColor("bg-[#121212]", light);
const TABS = ["daily", "weekly", "monthly"];
const TRIP_TYPES = ["ALL TRIPS", "Completed", "Cancelled", "Pending"];

function formatDateDisplay(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = dayjs(date).format("MMM D"); // en-US {day:'numeric', month:'short'}
  if (date.toDateString() === today.toDateString()) return `Today: ${day}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday: ${day}`;
  return day;
}

function extractItems(trip) {
  const rawItems = trip.items || trip.orderItems;
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (items.length === 0) return "Standard Delivery";
  const first = items[0];
  const qty = first.quantity || first.qty || 1;
  const name = first.name || first.itemName || "Item";
  return `${qty}x ${name}${items.length > 1 ? ` +${items.length - 1} more` : ""}`;
}

const tripPayout = (trip) =>
  Number(trip.riderEarning || trip.deliveryEarning || trip?.pricing?.deliveryFee || trip.amount || trip.earningAmount || 0);

function TripCard({ trip }) {
  const status = String(trip.status || "").toLowerCase();
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const payout = tripPayout(trip);
  const method = String(trip.paymentMethod || "").toLowerCase();
  const isQR = method === "razorpay_qr";
  const isCOD = method === "cash" || method === "cod";
  const collection = isCOD || isQR ? Number(trip.codCollectedAmount || trip.orderTotal || 0) : 0;
  const statusColor = isCompleted ? "#0066FF" : isCancelled ? tw.red500 : dvColor("text-orange-500", light);

  return (
    <Pressable style={({ pressed }) => [styles.trip, dvCard, pressed && { transform: [{ scale: 0.99 }] }]}>
      <View style={styles.tripTop}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.tripId}>{trip.orderId || "ORDER-ID"}</Text>
          <Text style={styles.tripRestaurant}>{trip.restaurant || trip.restaurantName || "Sayaji"}</Text>
          <Text style={styles.tripItems} numberOfLines={1}>
            {extractItems(trip)}
          </Text>
        </View>
        <Text style={[styles.tripStatus, { color: statusColor }]}>{trip.status || "Status"}</Text>
      </View>

      <View style={styles.badgeRow}>
        <View
          style={[
            styles.payBadge,
            { backgroundColor: isCOD || isQR ? dvColor("bg-orange-50", light) : dvColor("bg-blue-50", light) },
          ]}
        >
          <Text style={[styles.payBadgeText, { color: isCOD || isQR ? dvColor("text-orange-600", light) : "#0066FF" }]}>
            {isQR ? "COD (QR)" : isCOD ? "COD" : "Online"}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cellLabel}>Time</Text>
          <Text style={styles.cellValue}>{trip.time || "--:--"}</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.cellLabel}>{isCOD || isQR ? "COD" : "Payment"}</Text>
          <Text style={styles.cellValue}>{isCOD || isQR ? `₹${collection.toFixed(2)}` : "Online"}</Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={styles.cellLabel}>Earning</Text>
          <Text style={styles.cellValue}>₹{payout.toFixed(2)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function DropdownOption({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && { backgroundColor: dvColor("bg-green-50", light) },
        pressed && !selected && { backgroundColor: tw.gray50 },
      ]}
    >
      <Text style={[styles.optionText, selected && { color: ACCENT, fontWeight: "700" }]}>{label}</Text>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const goBack = useAppBack();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedTripType, setSelectedTripType] = useState("ALL TRIPS");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTripTypePicker, setShowTripTypePicker] = useState(false);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [bonusLoading, setBonusLoading] = useState(false);
  const [focusKey, setFocusKey] = useState(0);

  // Mount on focus, reset on blur (the web unmounts HistoryV2 when the tab changes).
  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
      return () => {
        setActiveTab("daily");
        setSelectedDate(new Date());
        setSelectedTripType("ALL TRIPS");
        setShowDatePicker(false);
        setShowTripTypePicker(false);
        setShowBonusModal(false);
        setBonusTransactions([]);
      };
    }, []),
  );

  useEffect(() => {
    if (focusKey === 0) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const params = {
          period: activeTab,
          date: dayjs(selectedDate).format("YYYY-MM-DD"),
          status: selectedTripType !== "ALL TRIPS" ? selectedTripType : undefined,
          limit: 1000,
        };
        const response = await getTripHistory(params);
        if (alive && response?.success) {
          const fetched = response?.data?.trips;
          setTrips(Array.isArray(fetched) ? fetched : []);
        }
      } catch {
        if (alive) toast.error("Failed to load history");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [focusKey, selectedDate, activeTab, selectedTripType]);

  useEffect(() => {
    if (!showBonusModal) return undefined;
    let alive = true;
    (async () => {
      setBonusLoading(true);
      try {
        const res = await getWalletTransactions({ type: "bonus", limit: 50 });
        if (alive && res?.success) {
          const transactions = res?.data?.transactions;
          setBonusTransactions(Array.isArray(transactions) ? transactions : []);
        }
      } catch {
        if (alive) toast.error("Failed to load bonuses");
      } finally {
        if (alive) setBonusLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [showBonusModal]);

  const recentDates = useMemo(
    () =>
      [...Array(30)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d;
      }),
    [],
  );

  const metrics = useMemo(
    () =>
      trips.reduce(
        (acc, trip) => {
          if (trip.status === "Completed") {
            acc.earnings += tripPayout(trip);
            const method = String(trip.paymentMethod || "").toLowerCase();
            if (method === "cash" || method === "cod") acc.cod += Number(trip.codCollectedAmount || trip.orderTotal || 0);
          }
          return acc;
        },
        { earnings: 0, cod: 0 },
      ),
    [trips],
  );

  const closeBonus = useCallback(() => setShowBonusModal(false), []);

  return (
    <Screen edges={[]} background="#ffffff" statusBarStyle="light">
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={goBack} style={({ pressed }) => [styles.backBtn, pressed && { transform: [{ scale: 0.9 }] }]}>
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
          <View>
            <Text style={styles.title}>TRIP HISTORY</Text>
            <Text style={styles.subtitle}>YOUR DELIVERY MILESTONES</Text>
          </View>
        </View>
        <Pressable
          onPress={() => setShowBonusModal(true)}
          style={({ pressed }) => [styles.giftBtn, pressed && { transform: [{ scale: 0.9 }] }]}
        >
          <Gift size={20} color={ACCENT} />
          {bonusTransactions.length > 0 && (
            <View style={styles.giftBadge}>
              <Text style={styles.giftBadgeText}>{bonusTransactions.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={styles.tab}>
              <Text style={[styles.tabText, { color: active ? ACCENT : tw.gray400 }]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {active && <View style={styles.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.filtersWrap}>
          <View style={styles.filters}>
            <Pressable
              onPress={() => {
                setShowDatePicker((v) => !v);
                setShowTripTypePicker(false);
              }}
              style={[styles.filterBtn, { flex: 1 }]}
            >
              <Text style={styles.filterText}>{formatDateDisplay(selectedDate)}</Text>
              <ChevronDown
                size={16}
                color={tw.gray400}
                style={{ transform: [{ rotate: showDatePicker ? "180deg" : "0deg" }] }}
              />
            </Pressable>
            <Pressable
              onPress={() => {
                setShowTripTypePicker((v) => !v);
                setShowDatePicker(false);
              }}
              style={[styles.filterBtn, { width: 140 }]}
            >
              <Text style={styles.filterText} numberOfLines={1}>
                {selectedTripType}
              </Text>
              <ChevronDown
                size={16}
                color={tw.gray400}
                style={{ transform: [{ rotate: showTripTypePicker ? "180deg" : "0deg" }] }}
              />
            </Pressable>
          </View>

          {showDatePicker && (
            <View style={[styles.dropdown, { left: 16, right: 16, maxHeight: 300 }]}>
              <FlatList
                data={recentDates}
                keyExtractor={(d) => d.toDateString()}
                renderItem={({ item }) => (
                  <DropdownOption
                    label={formatDateDisplay(item)}
                    selected={item.toDateString() === selectedDate.toDateString()}
                    onPress={() => {
                      setSelectedDate(item);
                      setShowDatePicker(false);
                    }}
                  />
                )}
              />
            </View>
          )}
          {showTripTypePicker && (
            <View style={[styles.dropdown, { right: 16, width: 192 }]}>
              {TRIP_TYPES.map((type) => (
                <DropdownOption
                  key={type}
                  label={type}
                  selected={type === selectedTripType}
                  onPress={() => {
                    setSelectedTripType(type);
                    setShowTripTypePicker(false);
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <FlatList
          data={loading ? [] : trips}
          keyExtractor={(trip, idx) => String(trip.orderId || idx)}
          renderItem={({ item }) => <TripCard trip={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={[styles.summary, dvCard]}>
              <View>
                <Text style={styles.summaryLabel}>COD Collected</Text>
                <Text style={styles.summaryValue}>₹{metrics.cod.toFixed(2)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.summaryLabel}>Earnings</Text>
                <Text style={styles.summaryValue}>₹{metrics.earnings.toFixed(2)}</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <Spinner size={32} color={ACCENT} />
                <Text style={styles.fetching}>Fetching trips...</Text>
              </View>
            ) : (
              <View style={styles.center}>
                <Clock size={48} color={tw.gray100} style={{ marginBottom: 4 }} />
                <Text style={styles.emptyText}>NO TRIPS RECORDED</Text>
              </View>
            )
          }
        />
      </View>

      <BonusSheet visible={showBonusModal} onClose={closeBonus} loading={bonusLoading} transactions={bonusTransactions} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 100,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "900", color: "#ffffff", letterSpacing: -1 },
  subtitle: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 1, marginTop: 2 },
  giftBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: dvColor("bg-green-500/10", light),
    borderWidth: 1,
    borderColor: dvColor("border-green-500/20", light),
    alignItems: "center",
    justifyContent: "center",
  },
  giftBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: dvColor("bg-[#10B981]", light),
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  giftBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  tabs: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    zIndex: 90,
  },
  tab: { paddingVertical: 16 },
  tabText: { fontSize: 16, fontWeight: "500" },
  tabIndicator: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: ACCENT },
  filtersWrap: { zIndex: 200 },
  filters: { backgroundColor: "#ffffff", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", gap: 12 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: tw.gray100,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  filterText: { fontSize: 14, fontWeight: "500", color: tw.gray800, flexShrink: 1 },
  dropdown: {
    position: "absolute",
    top: "100%",
    marginTop: -9,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    ...dvCard,
  },
  option: { width: "100%", padding: 16, borderRadius: 14 },
  optionText: { fontSize: 14, fontWeight: "500", color: tw.gray700 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  summary: {
    backgroundColor: "#E9F9F4",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  summaryLabel: { fontSize: 11, fontWeight: "700", color: ACCENT, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: "700", color: tw.gray950 },
  center: { paddingVertical: 80, alignItems: "center", justifyContent: "center", gap: 12 },
  fetching: { color: tw.gray400, fontSize: 12, fontWeight: "500" },
  emptyText: { fontSize: 14, fontWeight: "700", color: tw.gray400, letterSpacing: 1.4 },
  trip: { backgroundColor: "#ffffff", borderRadius: 16, padding: 20, borderWidth: 1 },
  tripTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  tripId: { fontSize: 16, fontWeight: "700", color: tw.gray950 },
  tripRestaurant: { fontSize: 14, fontWeight: "500", color: tw.gray500, marginTop: 2 },
  tripItems: { fontSize: 12, color: tw.gray400, fontWeight: "500", marginTop: 2 },
  tripStatus: { fontSize: 14, fontWeight: "700" },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 16, marginTop: 12 },
  payBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  payBadgeText: { fontSize: 10, fontWeight: "700" },
  grid: { flexDirection: "row", gap: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: tw.gray50 },
  cellLabel: { fontSize: 11, fontWeight: "500", color: tw.gray400, marginBottom: 4 },
  cellValue: { fontSize: 14, fontWeight: "700", color: tw.gray950 },
});
