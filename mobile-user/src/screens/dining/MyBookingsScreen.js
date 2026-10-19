// Port of Frontend/src/modules/Food/pages/user/dining/MyBookings.jsx (/bookings and
// /profile/dining-bookings, login required). Back goes to "/" as on web.
import { router } from "expo-router";
import { ArrowLeft, Calendar, Clock, MapPin, Star, Users, Utensils, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { createReview, getBookings } from "../../api";
import DiningLoader from "../../components/dining/DiningLoader";
import { AppImage, Dialog, Screen, Text, toast } from "../../components/ui";
import { goTo } from "../../navigation/back";
import { withProtected } from "../../navigation/Protected";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { formatBookingLocation, formatDayMonth, pal } from "./diningLib";

const getStatusLabel = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "pending") return "Approval Reqd";
  if (key === "accepted" || key === "confirmed") return "Confirmed";
  if (key === "checked-in") return "Checked-in";
  if (key === "completed") return "Completed";
  if (key === "cancelled") return "Cancelled";
  return String(status || "unknown");
};

const getStatusColors = (status, primary) => {
  const key = String(status || "").toLowerCase();
  if (key === "pending") return { bg: pal.amber100, fg: pal.amber700, weight: "500" };
  if (key === "accepted" || key === "confirmed") return { bg: pal.green100, fg: pal.green700, weight: "700" };
  if (key === "checked-in") return { bg: "#F9F9FB", fg: primary, weight: "500" };
  if (key === "completed") return { bg: pal.blue100, fg: pal.blue700, weight: "500" };
  if (key === "cancelled") return { bg: pal.red100, fg: pal.red700, weight: "500" };
  return { bg: pal.slate100, fg: pal.slate700, weight: "500" };
};

function ReviewModal({ booking, onClose, onSubmit }) {
  const { isDark } = useTheme();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast.error("Please add a comment");
      return;
    }
    setSubmitting(true);
    await onSubmit({ bookingId: booking._id, rating, comment });
    setSubmitting(false);
  };

  return (
    <Dialog
      visible
      onClose={onClose}
      style={[
        styles.modal,
        { backgroundColor: isDark ? pal.slate900 : "#ffffff", borderColor: isDark ? pal.slate800 : "transparent" },
      ]}
    >
      <View style={[styles.modalHeader, { borderColor: isDark ? pal.slate800 : pal.slate100 }]}>
        <Text style={[styles.modalTitle, { color: isDark ? "#ffffff" : pal.slate900 }]}>Review your experience</Text>
        <Pressable onPress={onClose} style={styles.modalClose}>
          <X size={20} color={isDark ? pal.slate500 : pal.slate400} />
        </Pressable>
      </View>
      <View style={styles.modalBody}>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.modalPrompt, { color: isDark ? tw.gray400 : pal.slate500 }]}>
            How was your visit to {booking.restaurant?.name}?
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                style={({ pressed }) => [{ padding: 4 }, pressed && { transform: [{ scale: 0.9 }] }]}
              >
                <Star
                  size={40}
                  color={star <= rating ? pal.yellow400 : isDark ? pal.slate700 : pal.slate200}
                  fill={star <= rating ? pal.yellow400 : "none"}
                />
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={[styles.feedbackLabel, { color: isDark ? tw.gray300 : pal.slate700 }]}>Share your feedback</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Write about the food, service, and atmosphere..."
            placeholderTextColor={isDark ? tw.gray500 : tw.gray400}
            selectionColor={pal.red500}
            multiline
            textAlignVertical="top"
            style={[styles.textarea, { backgroundColor: isDark ? pal.slate800 : pal.slate50, color: isDark ? "#ffffff" : tw.gray900 }]}
          />
        </View>
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
        >
          <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit Review"}</Text>
        </Pressable>
      </View>
    </Dialog>
  );
}

function BookingCard({ booking, onReview }) {
  const { colors, isDark } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const status = getStatusColors(booking.status, colors.primary);
  const image = booking.restaurant?.image || booking.restaurant?.profileImage?.url || "";
  const chipBg = isDark ? tw.gray800 : pal.slate100;
  const chipFg = isDark ? tw.gray300 : tw.gray600;
  const bookingDate = new Date(booking.date);
  return (
    <View style={[styles.card, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : pal.slate100 }]}>
      <View style={[styles.thumb, { backgroundColor: isDark ? tw.gray800 : pal.slate100 }]}>
        {image && !imageFailed ? (
          <AppImage
            src={image}
            width={80}
            placeholderType="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
            onError={() => setImageFailed(true)}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.name, { color: isDark ? "#ffffff" : tw.gray900 }]}>
            {booking.restaurant?.name}
          </Text>
          <View style={[styles.badge, { backgroundColor: status.bg, opacity: isDark ? 0.8 : 1 }]}>
            <Text style={[styles.badgeText, { color: status.fg, fontWeight: status.weight }]}>{getStatusLabel(booking.status)}</Text>
          </View>
        </View>
        <View style={styles.addressRow}>
          <MapPin size={12} color={isDark ? tw.gray400 : tw.gray500} />
          <Text numberOfLines={1} style={[styles.address, { color: isDark ? tw.gray400 : tw.gray500 }]}>
            {formatBookingLocation(booking.restaurant?.location)}
          </Text>
        </View>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: chipBg }]}>
            <Calendar size={12} color={chipFg} />
            <Text style={[styles.chipText, { color: chipFg }]}>
              {Number.isNaN(bookingDate.getTime()) ? "Invalid Date" : formatDayMonth(bookingDate)}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: chipBg }]}>
            <Clock size={12} color={chipFg} />
            <Text style={[styles.chipText, { color: chipFg }]}>{booking.timeSlot}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: chipBg }]}>
            <Users size={12} color={chipFg} />
            <Text style={[styles.chipText, { color: chipFg }]}>{booking.guests} Guests</Text>
          </View>
        </View>
        {booking.status === "completed" ? (
          <Pressable
            onPress={onReview}
            style={({ pressed }) => [
              styles.reviewBtn,
              {
                backgroundColor: pressed ? pal.red100 : isDark ? "rgba(69,10,10,0.2)" : pal.red50,
                borderColor: isDark ? "rgba(127,29,29,0.3)" : pal.red100,
              },
            ]}
          >
            <Text style={[styles.reviewText, { color: isDark ? pal.red400 : pal.red600 }]}>{"RATE & REVIEW"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MyBookingsScreen() {
  const { isDark } = useTheme();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getBookings();
        if (!cancelled && response?.success) setBookings(Array.isArray(response.data) ? response.data : []);
      } catch {
        // the web shows the empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleReviewSubmit = async (reviewData) => {
    try {
      const response = await createReview(reviewData);
      if (response?.success) {
        toast.success("Review submitted! Thank you for your feedback.");
        setSelectedBooking(null);
      }
    } catch (error) {
      toast.error(error?.message || "Failed to submit review");
    }
  };

  if (loading) return <DiningLoader />;

  return (
    <Screen background={isDark ? "#0a0a0a" : pal.slate50}>
      <View style={[styles.header, { backgroundColor: isDark ? "#0a0a0a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray200 }]}>
        <Pressable onPress={() => goTo("/")} hitSlop={8}>
          <ArrowLeft size={24} color={isDark ? "#ffffff" : tw.gray700} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? "#ffffff" : tw.gray800 }]}>My Table Bookings</Text>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item, index) => String(item._id || index)}
        renderItem={({ item }) => <BookingCard booking={item} onReview={() => setSelectedBooking(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? tw.gray800 : pal.slate100 }]}>
              <Utensils size={32} color={isDark ? tw.gray600 : pal.slate300} />
            </View>
            <Text style={[styles.emptyTitle, { color: isDark ? "#ffffff" : tw.gray800 }]}>No bookings yet</Text>
            <Text style={[styles.emptyBody, { color: isDark ? tw.gray400 : tw.gray500 }]}>
              Book your favorite restaurant for a great dining experience!
            </Text>
            <Pressable onPress={() => router.push("/dining")} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Book a table</Text>
            </Pressable>
          </View>
        }
      />

      {selectedBooking ? (
        <ReviewModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} onSubmit={handleReviewSubmit} />
      ) : null}
    </Screen>
  );
}

export default withProtected(MyBookingsScreen);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
    zIndex: 1,
  },
  headerTitle: { marginLeft: 16, fontSize: 20, fontWeight: "600" },
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  thumb: { width: 80, height: 80, borderRadius: 12, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: "700" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12 },
  addressRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 },
  address: { flex: 1, fontSize: 12 },
  chips: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 16, rowGap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: "700" },
  reviewBtn: { marginTop: 12, width: "100%", paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  reviewText: { fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 80 },
  emptyIcon: { width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { marginTop: 8, fontSize: 14, textAlign: "center" },
  emptyBtn: {
    marginTop: 24,
    backgroundColor: pal.red500,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    boxShadow: "0px 10px 15px -3px rgba(254,202,202,1), 0px 4px 6px -4px rgba(254,202,202,1)",
  },
  emptyBtnText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  modal: { maxWidth: 448, borderRadius: 24, padding: 0, overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 24, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: "700", flex: 1 },
  modalClose: { padding: 8, borderRadius: 999 },
  modalBody: { padding: 24, gap: 24 },
  modalPrompt: { fontSize: 14, fontWeight: "500", marginBottom: 12, textAlign: "center" },
  stars: { flexDirection: "row", gap: 8 },
  feedbackLabel: { fontSize: 14, fontWeight: "700" },
  textarea: { height: 128, padding: 16, borderRadius: 16, fontSize: 14, fontFamily: "Poppins_400Regular" },
  submitBtn: {
    height: 48,
    width: "100%",
    borderRadius: 16,
    backgroundColor: pal.red500,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(254,202,202,1), 0px 4px 6px -4px rgba(254,202,202,1)",
  },
  submitText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
});
