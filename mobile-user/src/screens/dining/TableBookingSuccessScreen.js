// Port of Frontend/src/modules/Food/pages/user/dining/TableBookingSuccess.jsx (/dining/book-success).
// No header; without a booking in the navigation state it goes back to Dining, as on web.
import { router } from "expo-router";
import { Calendar, CheckCircle2, Clock, Home, Info, List, MapPin, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FadeInUp from "../../components/account/FadeInUp";
import DashedLine from "../../components/orders/DashedLine";
import { AppImage, Confetti, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { NAV_KEYS, formatBookingLocation, formatDayMonthYear, getNavState, pal } from "./diningLib";

function PopIn({ style, children }) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.spring(value, { toValue: 1, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [value]);
  return (
    <Animated.View
      style={[style, { opacity: value, transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

function FadeIn({ delay, style, children }) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(value, { toValue: 1, duration: 300, delay, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [value, delay]);
  return <Animated.View style={[style, { opacity: value }]}>{children}</Animated.View>;
}

function TicketField({ label, icon: Icon, children, isDark }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: isDark ? pal.slate500 : pal.slate400 }]}>{label}</Text>
      <View style={styles.fieldRow}>
        {Icon ? <Icon size={16} color={pal.red500} /> : null}
        {children}
      </View>
    </View>
  );
}

export default function TableBookingSuccessScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [{ booking } = {}] = useState(() => getNavState(NAV_KEYS.success) || {});
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!booking) router.replace("/dining");
  }, [booking]);

  if (!booking) return null;

  const isPending = booking.status === "pending";
  const bookingDate = new Date(booking.date);
  const formattedDate = Number.isNaN(bookingDate.getTime()) ? "Invalid Date" : formatDayMonthYear(bookingDate);
  const pageBg = isDark ? pal.slate950 : "#ffffff";
  const strong = { color: isDark ? pal.slate200 : tw.gray800 };
  const image = booking.restaurant?.image || booking.restaurant?.profileImage?.url || "";

  return (
    <Screen background={pageBg} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <PopIn
          style={[
            styles.statusCircle,
            { backgroundColor: isPending ? (isDark ? "rgba(69,26,3,0.2)" : pal.amber50) : isDark ? pal.slate900 : "#F9F9FB" },
          ]}
        >
          {isPending ? <Clock size={48} color={pal.amber500} /> : <CheckCircle2 size={48} color={colors.primary} />}
        </PopIn>

        <FadeInUp from={20} delay={200} style={styles.headline}>
          <Text style={[styles.title, { color: isDark ? pal.slate100 : tw.gray900 }]}>
            {isPending ? "Booking Requested!" : "Seat Confirmed!"}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? pal.slate400 : tw.gray500 }]}>
            {isPending ? "Waiting for restaurant approval" : "Your table is ready for you"}
          </Text>
          <View
            style={[
              styles.idPill,
              {
                backgroundColor: isDark ? pal.slate900 : "#F9F9FB",
                borderColor: isDark ? "rgba(192,132,252,0.2)" : colors.primary + "33",
              },
            ]}
          >
            <Text style={[styles.idText, { color: isDark ? pal.purple400 : colors.primary }]}>BOOKING ID: {booking.bookingId}</Text>
          </View>

          {isPending ? (
            <View
              style={[
                styles.pendingNote,
                {
                  backgroundColor: isDark ? "rgba(69,26,3,0.2)" : pal.amber50,
                  borderColor: isDark ? "rgba(120,53,15,0.3)" : pal.amber100,
                },
              ]}
            >
              <View style={styles.pendingIcon}>
                <Info size={16} color={pal.amber600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pendingTitle, { color: isDark ? pal.amber300 : pal.amber900 }]}>Waiting for Confirmation</Text>
                <Text style={[styles.pendingBody, { color: isDark ? "rgba(251,191,36,0.8)" : pal.amber700 }]}>
                  The restaurant will review and approve your request shortly. You&apos;ll be notified of the status.
                </Text>
              </View>
            </View>
          ) : null}
        </FadeInUp>

        <FadeInUp from={30} delay={400} style={{ width: "100%", maxWidth: 384 }}>
          <View
            style={[
              styles.ticket,
              {
                backgroundColor: isDark ? pal.slate900 : pal.slate50,
                borderColor: isDark ? pal.slate800 : pal.slate100,
                boxShadow: isDark ? "none" : "0px 20px 25px -5px rgba(226,232,240,1), 0px 8px 10px -6px rgba(226,232,240,1)",
              },
            ]}
          >
            <View style={styles.ticketInner}>
              <View style={styles.restaurantRow}>
                <View
                  style={[
                    styles.thumbBox,
                    { backgroundColor: isDark ? pal.slate800 : "#ffffff", borderColor: isDark ? pal.slate700 : pal.slate100 },
                  ]}
                >
                  {image && !imageFailed ? (
                    <AppImage
                      src={image}
                      width={56}
                      placeholderType="none"
                      style={[styles.thumb, { backgroundColor: "transparent" }]}
                      onError={() => setImageFailed(true)}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[styles.restaurantName, { color: isDark ? pal.slate100 : tw.gray900 }]}>
                    {booking.restaurant?.name || "The Great CityFood Restaurant"}
                  </Text>
                  <View style={styles.addressRow}>
                    <MapPin size={12} color={isDark ? pal.slate500 : tw.gray400} />
                    <Text numberOfLines={1} style={[styles.address, { color: isDark ? pal.slate500 : tw.gray400 }]}>
                      {formatBookingLocation(booking.restaurant?.location)}
                    </Text>
                  </View>
                </View>
              </View>

              <DashedLine color={isDark ? pal.slate800 : pal.slate200} />
              <View style={styles.fields}>
                <TicketField label="DATE" icon={Calendar} isDark={isDark}>
                  <Text style={[styles.fieldValue, strong]}>{formattedDate}</Text>
                </TicketField>
                <TicketField label="TIME" icon={Clock} isDark={isDark}>
                  <Text style={[styles.fieldValue, strong]}>{booking.timeSlot}</Text>
                </TicketField>
                <TicketField label="GUESTS" icon={Users} isDark={isDark}>
                  <Text style={[styles.fieldValue, strong]}>{booking.guests} People</Text>
                </TicketField>
                <TicketField label="STATUS" isDark={isDark}>
                  <View style={[styles.statusBadge, { backgroundColor: isPending ? pal.amber500 : pal.emerald500 }]}>
                    <Text style={styles.statusBadgeText}>{isPending ? "PENDING" : "CONFIRMED"}</Text>
                  </View>
                </TicketField>
              </View>
              <DashedLine color={isDark ? pal.slate800 : pal.slate200} />

              {/* Circle cutouts for the ticket look */}
              <View style={[styles.cutout, { left: -12, backgroundColor: pageBg, borderColor: isDark ? pal.slate800 : pal.slate100 }]} />
              <View style={[styles.cutout, { right: -12, backgroundColor: pageBg, borderColor: isDark ? pal.slate800 : pal.slate100 }]} />
            </View>
          </View>
        </FadeInUp>

        <FadeIn delay={600} style={styles.actions}>
          <Pressable onPress={() => router.push("/bookings")} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
            <List size={20} color="#ffffff" />
            <Text style={styles.primaryBtnText}>View My Bookings</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/")}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: isDark ? (pressed ? pal.slate800 : pal.slate900) : pressed ? pal.slate50 : "#ffffff",
                borderColor: isDark ? pal.slate800 : pal.slate100,
              },
            ]}
          >
            <Home size={20} color={isDark ? pal.slate300 : pal.slate600} />
            <Text style={[styles.secondaryBtnText, { color: isDark ? pal.slate300 : pal.slate600 }]}>Go to Home</Text>
          </Pressable>
        </FadeIn>
      </ScrollView>

      <Text style={[styles.footerNote, { bottom: 40 + insets.bottom }]}>SHOW THIS TICKET AT THE RESTAURANT FOR A SMOOTH ENTRY</Text>
      <Confetti count={120} duration={3000} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  statusCircle: { width: 80, height: 80, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  headline: { alignItems: "center", gap: 8, marginBottom: 40 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "900", textAlign: "center" },
  subtitle: { fontSize: 16, fontWeight: "500", fontStyle: "italic", letterSpacing: 0.4, textAlign: "center" },
  idPill: { marginTop: 8, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 4 },
  idText: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  pendingNote: {
    marginTop: 24,
    maxWidth: 320,
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    boxShadow: "0px 1px 2px rgba(254,243,199,0.5)",
  },
  pendingIcon: { alignSelf: "flex-start", backgroundColor: pal.amber100, padding: 8, borderRadius: 12 },
  pendingTitle: { fontSize: 12, fontWeight: "700" },
  pendingBody: { marginTop: 4, fontSize: 10, lineHeight: 16 },
  ticket: { borderRadius: 24, borderWidth: 1 },
  ticketInner: { padding: 24, gap: 24 },
  restaurantRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  thumbBox: { width: 64, height: 64, borderRadius: 16, borderWidth: 1, padding: 4 },
  thumb: { flex: 1, borderRadius: 12 },
  restaurantName: { fontSize: 18, fontWeight: "900" },
  addressRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 },
  address: { flex: 1, fontSize: 12 },
  fields: { flexDirection: "row", flexWrap: "wrap", rowGap: 16, marginVertical: 0 },
  field: { width: "50%", gap: 4, paddingRight: 8 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldValue: { fontSize: 14, fontWeight: "700" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: "#ffffff" },
  cutout: { position: "absolute", top: "50%", marginTop: -12, width: 24, height: 24, borderRadius: 999, borderWidth: 1 },
  actions: { marginTop: 48, width: "100%", maxWidth: 384, gap: 12 },
  primaryBtn: {
    height: 56,
    width: "100%",
    borderRadius: 16,
    backgroundColor: pal.red500,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0px 20px 25px -5px rgba(254,226,226,1), 0px 8px 10px -6px rgba(254,226,226,1)",
  },
  primaryBtnText: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
  secondaryBtn: {
    height: 56,
    width: "100%",
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { fontSize: 18, fontWeight: "700" },
  footerNote: {
    position: "absolute",
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: pal.slate300,
  },
});
