// Port of Frontend/src/modules/Food/pages/user/dining/TableBookingConfirmation.jsx
// (/dining/book-confirmation). Booking data comes from the previous screen's state, else the
// session draft. The web's policy and edit-user modals are never opened there, so they are not ported.
import { router } from "expo-router";
import { ArrowLeft, Calendar, ChevronRight, Edit2, Info, MapPin, ShieldCheck, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBooking, getCurrentUser } from "../../api";
import DiningLoader from "../../components/dining/DiningLoader";
import DashedLine from "../../components/orders/DashedLine";
import { BottomSheet, Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import {
  NAV_KEYS,
  clearBookingDraft,
  formatBookingLocation,
  formatDayMonth,
  getNavState,
  navigateWithState,
  pal,
  readBookingDraft,
  setNavState,
} from "./diningLib";

const TERMS = [
  "Please arrive 15 minutes prior to your reservation time.",
  "Booking valid for the specified number of guests entered during reservation",
  "Cover charges upon entry are subject to the discretion of the restaurant",
  "House rules are to be observed at all times",
  "Special requests will be accommodated at the restaurant's discretion",
  "Cover charges cannot be refunded if slot is cancelled within 30 minutes of slot start time",
  "Additional service charges on the bill are at the restaurant's discretion",
];

function SectionDivider({ label, isDark }) {
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, { backgroundColor: isDark ? pal.slate800 : pal.slate200 }]} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={[styles.dividerLine, { backgroundColor: isDark ? pal.slate800 : pal.slate200 }]} />
    </View>
  );
}

function SpecialRequestSheet({ visible, onClose, value, onChange, onSave }) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} style={{ backgroundColor: "#ffffff" }}>
      <View style={styles.sheetBody}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>SPECIAL REQUEST</Text>
          <Pressable onPress={onClose} style={styles.sheetClose}>
            <ArrowLeft size={16} color={pal.slate500} style={{ transform: [{ rotate: "90deg" }] }} />
          </Pressable>
        </View>
        <View style={{ gap: 16 }}>
          <Text style={styles.sheetHint}>
            LET THE RESTAURANT KNOW IF YOU HAVE ANY ALLERGIES OR SPECIAL REQUIREMENTS (E.G. BIRTHDAY, ANNIVERSARY).
          </Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="E.g. I have a peanut allergy, or we are celebrating a birthday..."
            placeholderTextColor={tw.gray400}
            selectionColor={colors.primary}
            multiline
            autoFocus
            textAlignVertical="top"
            style={styles.textarea}
          />
          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} style={[styles.sheetBtn, { backgroundColor: pal.slate100 }]}>
              <Text style={[styles.sheetBtnText, { color: pal.slate600 }]}>CANCEL</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              style={[styles.sheetBtn, { backgroundColor: colors.primary, boxShadow: "0px 10px 15px -3px rgba(233,213,255,1)" }]}
            >
              <Text style={[styles.sheetBtnText, { color: "#ffffff" }]}>SAVE</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

export default function TableBookingConfirmationScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const { isAuthenticated } = useAuth();
  const [resolvedState] = useState(() => getNavState(NAV_KEYS.confirmation) || readBookingDraft() || {});
  const { restaurant, guests, date, timeSlot, discount } = resolvedState;

  const [specialRequest, setSpecialRequest] = useState("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [tempRequest, setTempRequest] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  useEffect(() => {
    if (!restaurant) {
      router.replace("/dining");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        // Logged-out customers have no profile; the web request just fails.
        if (!isAuthenticated) return;
        const response = await getCurrentUser();
        if (!cancelled && response?.success) {
          setUser(response?.data?.user || response?.data || null);
        }
      } catch {
        // the web keeps the placeholder details
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurant, isAuthenticated]);

  const handleBooking = async () => {
    try {
      setBookingInProgress(true);
      const restaurantId =
        restaurant?._id ||
        restaurant?.id ||
        restaurant?.restaurant?._id ||
        restaurant?.restaurant?.id ||
        restaurant?.restaurantId ||
        null;
      if (!restaurantId) {
        toast.error("Unable to proceed. Restaurant ID is missing.");
        return;
      }
      const response = await createBooking({
        restaurant: restaurantId,
        restaurantRef: restaurant,
        userRef: user,
        guests,
        date,
        timeSlot,
        specialRequest,
      });
      if (response?.success) {
        toast.success("Table booked successfully!");
        clearBookingDraft();
        navigateWithState("/dining/book-success", NAV_KEYS.success, { booking: response.data });
      }
    } catch (error) {
      toast.error(error?.message || "Failed to confirm booking");
    } finally {
      setBookingInProgress(false);
    }
  };

  if (loading || !restaurant) return <DiningLoader />;

  const bookingDate = new Date(date);
  const formattedDate = Number.isNaN(bookingDate.getTime()) ? "Today" : formatDayMonth(bookingDate);
  const card = [
    styles.card,
    { backgroundColor: isDark ? pal.slate900 : "#ffffff", borderColor: isDark ? pal.slate800 : pal.slate100 },
  ];
  const strong = { color: isDark ? pal.slate100 : tw.gray900 };

  return (
    <Screen background={isDark ? pal.slate950 : pal.slate50} edges={[]} statusBarStyle="light">
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: 16 + insets.top }]}>
        <Pressable onPress={goBack} style={styles.headerBack}>
          <ArrowLeft size={24} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerText}>
          Reach the restaurant 15 minutes before your booking time for a hassle-free experience
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={card}>
          <View style={styles.summaryRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? pal.slate800 : "#F9F9FB" }]}>
              <Calendar size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bold, strong]}>
                {formattedDate} at {timeSlot}
              </Text>
              <View style={styles.guestsRow}>
                <Users size={16} color={isDark ? pal.slate400 : tw.gray500} />
                <Text style={{ fontSize: 14, color: isDark ? pal.slate400 : tw.gray500 }}>{guests} guests</Text>
              </View>
            </View>
          </View>
          <DashedLine color={isDark ? pal.slate800 : pal.slate100} style={{ marginHorizontal: 16 }} />
          <View style={styles.summaryRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? "rgba(69,10,10,0.3)" : pal.red50 }]}>
              <MapPin size={20} color={pal.red500} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bold, strong]}>{restaurant.name}</Text>
              <Text numberOfLines={1} style={[styles.small, { color: isDark ? pal.slate400 : tw.gray500 }]}>
                {formatBookingLocation(restaurant.location)}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => {
            setTempRequest(specialRequest);
            setShowRequestModal(true);
          }}
          style={[card, styles.rowCard]}
        >
          <View style={[styles.rowStart, { flex: 1 }]}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: specialRequest
                    ? isDark
                      ? "rgba(59,7,100,0.3)"
                      : pal.purple50
                    : isDark
                      ? pal.slate800
                      : pal.slate100,
                },
              ]}
            >
              <Info size={20} color={specialRequest ? colors.primary : isDark ? pal.slate400 : pal.slate600} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bold, { color: isDark ? pal.slate200 : tw.gray700 }]}>
                {specialRequest ? "Special Request Added" : "Add special request"}
              </Text>
              {specialRequest ? (
                <Text numberOfLines={1} style={[styles.small, { fontWeight: "500", color: isDark ? pal.slate400 : pal.slate500 }]}>
                  {specialRequest}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.rowStart}>
            {specialRequest ? <Text style={[styles.editTag, { color: colors.primary + "66" }]}>EDIT</Text> : null}
            <ChevronRight size={20} color={pal.slate400} />
          </View>
        </Pressable>

        <View style={{ paddingTop: 16 }}>
          <SectionDivider label="GUEST PREFERENCES" isDark={isDark} />
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={() => {
                const targetSlug = restaurant?.slug || restaurant?._id || restaurant?.id || "restaurant";
                // The booking page reads guestCount/selectedDate/selectedTime, so only the restaurant carries over (as on web).
                navigateWithState({ pathname: "/dining/book/[slug]", params: { slug: targetSlug } }, NAV_KEYS.book(targetSlug), {
                  restaurant,
                  guests,
                  date,
                  timeSlot,
                  discount,
                  isModifying: true,
                });
              }}
              style={({ pressed }) => [card, styles.rowCard, pressed && styles.pressed]}
            >
              <View style={styles.rowTop}>
                <Edit2 size={20} color={isDark ? pal.purple400 : colors.primary} style={{ marginTop: 4 }} />
                <View>
                  <Text style={[styles.prefTitle, { color: isDark ? pal.slate100 : tw.gray800 }]}>Modification available</Text>
                  <Text style={[styles.prefSub, { color: isDark ? pal.slate500 : pal.slate400 }]}>Valid till {timeSlot}, today</Text>
                </View>
              </View>
              <ChevronRight size={16} color={pal.slate300} />
            </Pressable>

            <Pressable
              onPress={() => {
                setNavState(NAV_KEYS.confirmation, { restaurant, guests, date, timeSlot, discount, specialRequest, user });
                router.push({ pathname: "/profile/cancellation", params: { returnTo: "/dining/book-confirmation" } });
              }}
              style={({ pressed }) => [card, styles.rowCard, pressed && styles.pressed]}
            >
              <View style={styles.rowTop}>
                <ShieldCheck size={20} color={pal.red400} style={{ marginTop: 4 }} />
                <View>
                  <Text style={[styles.prefTitle, { color: isDark ? pal.slate100 : tw.gray800 }]}>Cancellation available</Text>
                  <Text style={[styles.prefSub, { color: isDark ? pal.slate500 : pal.slate400 }]}>Valid till {timeSlot}, today</Text>
                </View>
              </View>
              <ChevronRight size={16} color={pal.slate300} />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingTop: 16, gap: 12 }}>
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? pal.slate800 : pal.slate200 }]} />
            <Text style={[styles.dividerText, { fontWeight: "900", letterSpacing: 2 }]}>YOUR DETAILS</Text>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? pal.slate800 : pal.slate200 }]} />
          </View>
          <View style={[card, styles.detailsCard]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bold, strong]}>{user?.name || "Shailu"}</Text>
              <Text style={[styles.detailsPhone, { color: isDark ? pal.slate500 : pal.slate400 }]}>
                {user?.phone || user?.email || "8090512291"}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() =>
                navigateWithState("/dining/edit-user", NAV_KEYS.editUser, {
                  restaurant,
                  guests,
                  date,
                  timeSlot,
                  discount,
                  specialRequest,
                  user,
                })
              }
            >
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingTop: 16 }}>
          <SectionDivider label="TERMS AND CONDITIONS" isDark={isDark} />
          <View style={[card, { padding: 20, gap: 16 }]}>
            {TERMS.map((term) => (
              <View key={term} style={styles.termRow}>
                <View style={[styles.termDot, { backgroundColor: isDark ? pal.slate600 : pal.slate300 }]} />
                <Text style={[styles.termText, { color: isDark ? pal.slate400 : pal.slate600 }]}>{term}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(16, insets.bottom),
            backgroundColor: isDark ? pal.slate950 : "#ffffff",
            borderColor: isDark ? pal.slate800 : pal.slate100,
          },
        ]}
      >
        <Pressable
          onPress={handleBooking}
          disabled={bookingInProgress}
          style={({ pressed }) => [styles.confirmBtn, bookingInProgress && { opacity: 0.5 }, pressed && styles.pressed]}
        >
          <Text style={styles.confirmText}>{bookingInProgress ? "Confirming..." : "Confirm your seat"}</Text>
        </Pressable>
      </View>

      <SpecialRequestSheet
        visible={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        value={tempRequest}
        onChange={setTempRequest}
        onSave={() => {
          setSpecialRequest(tempRequest);
          setShowRequestModal(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 1,
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
  },
  headerBack: { padding: 4, borderRadius: 999 },
  headerText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#ffffff" },
  content: { padding: 16, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  summaryRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16 },
  iconBox: { padding: 8, borderRadius: 12 },
  bold: { fontSize: 16, fontWeight: "700" },
  small: { marginTop: 2, fontSize: 12 },
  guestsRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 8 },
  rowCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  editTag: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  pressed: { transform: [{ scale: 0.98 }] },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: pal.slate400 },
  prefTitle: { fontSize: 14, fontWeight: "700" },
  prefSub: { fontSize: 12 },
  detailsCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20 },
  detailsPhone: { marginTop: 4, fontSize: 14 },
  editLink: { fontSize: 14, fontWeight: "700", color: pal.red500 },
  termRow: { flexDirection: "row", gap: 12 },
  termDot: { marginTop: 8, height: 6, width: 6, borderRadius: 999 },
  termText: { flex: 1, fontSize: 12, lineHeight: 19, fontWeight: "500" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    boxShadow: "0px -10px 30px rgba(0,0,0,0.05)",
  },
  confirmBtn: {
    height: 56,
    width: "100%",
    borderRadius: 16,
    backgroundColor: pal.red500,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 20px 25px -5px rgba(254,202,202,1), 0px 8px 10px -6px rgba(254,202,202,1)",
  },
  confirmText: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
  sheetBody: { padding: 24 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  sheetTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.45, color: tw.gray900 },
  sheetClose: { height: 32, width: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: pal.slate100 },
  sheetHint: { fontSize: 12, lineHeight: 19, fontWeight: "700", letterSpacing: 1.2, color: pal.slate500 },
  textarea: {
    height: 128,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: pal.slate100,
    backgroundColor: pal.slate50,
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: tw.gray900,
  },
  sheetActions: { flexDirection: "row", gap: 12, paddingTop: 8 },
  sheetBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sheetBtnText: { fontSize: 14, fontWeight: "700", letterSpacing: 1.4 },
});
