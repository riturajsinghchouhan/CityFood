// Port of components/restaurant/ResendNotificationButton.jsx: re-offers the order to delivery
// partners (POST .../resend-notification) and reports how many riders were alerted.
import { Volume2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { resendDeliveryNotification } from "../../api";
import Text from "../ui/Text";
import { toast } from "../ui/Toast";
import { apiMessage, pal } from "./ordersUtils";

export default function ResendNotificationButton({ orderId, mongoId, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const res = await resendDeliveryNotification(mongoId || orderId);
      if (res?.success) {
        const notifiedCount = Number(res.data?.notifiedCount || 0);
        const shortlistedCount = Number(res.data?.shortlistedCount || 0);
        const connectedSocketCount = res.data?.connectedSocketCount;
        const searchRadiusKm = res.data?.searchRadiusKm;
        const radiusLabel = searchRadiusKm ? ` within ${searchRadiusKm} km` : "";
        if (notifiedCount > 0) {
          toast.success(
            `Notification sent to ${notifiedCount} delivery partner${notifiedCount === 1 ? "" : "s"}${radiusLabel}${connectedSocketCount != null ? ` (live sockets: ${connectedSocketCount})` : ""}`,
          );
        } else {
          toast.warning(
            shortlistedCount > 0
              ? `No delivery partners received the alert${radiusLabel}. Shortlisted: ${shortlistedCount}${connectedSocketCount != null ? `, live sockets: ${connectedSocketCount}` : ""}.`
              : `No free online delivery partners found in this zone${radiusLabel}.`,
          );
        }
        onSuccess?.();
      } else {
        toast.error(res?.message || "Failed to send notification");
      }
    } catch (err) {
      toast.error(apiMessage(err, "Failed to send notification. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handleResend}
      disabled={loading}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, loading && styles.disabled]}
      accessibilityLabel="Resend notification to delivery partners"
    >
      {loading ? <ActivityIndicator size={12} color={pal.blue700} /> : <Volume2 size={12} color={pal.blue700} />}
      <Text style={styles.text}>{loading ? "Sending..." : "Resend"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    backgroundColor: pal.blue100,
    borderWidth: 1,
    borderColor: pal.blue300,
  },
  pressed: { backgroundColor: pal.blue200 },
  disabled: { opacity: 0.5 },
  text: { fontSize: 10, fontWeight: "500", color: pal.blue700 },
});
