// Port of components/restaurant/GlobalPickupOtpModal.jsx ("Delivery Partner Arrived"), driven by
// RestaurantNotificationsContext.pickupOtpReveal. Mounted once by the protected layout.
import { Pressable, StyleSheet, View } from "react-native";
import { useRestaurantNotifications } from "../../context/RestaurantNotificationsContext";
import { useTheme } from "../../theme/ThemeContext";
import { brand, rtButtonColor, tw } from "../../theme/tokens";
import Text from "../ui/Text";
import RestaurantModal from "./RestaurantModal";

export default function GlobalPickupOtpModal() {
  const { pickupOtpReveal, clearPickupOtpReveal } = useRestaurantNotifications();
  const { colors } = useTheme();
  return (
    <RestaurantModal open={Boolean(pickupOtpReveal)} onClose={clearPickupOtpReveal} size="sm" showClose={false}>
      <View style={styles.wrap}>
        <View style={styles.iconCircle}>
          <Text style={styles.emoji}>🛵</Text>
        </View>
        <Text style={styles.kicker}>DELIVERY PARTNER ARRIVED</Text>
        <Text style={styles.lead}>
          Share this OTP with the delivery partner for Order #{pickupOtpReveal?.orderId || ""}
        </Text>
        <View style={styles.otpBox}>
          <Text style={styles.otpLabel}>PICKUP VERIFICATION OTP</Text>
          <Text style={styles.otp}>{pickupOtpReveal?.otp}</Text>
        </View>
        <Text style={styles.hint}>Tell this code to the delivery partner so they can complete the pickup.</Text>
        {/* bg-gray-900 button -> --rt-primary (restaurantTheme.css) */}
        <Pressable
          onPress={clearPickupOtpReveal}
          style={[styles.button, { backgroundColor: rtButtonColor(tw.gray900, colors) }]}
        >
          <Text style={styles.buttonText}>Got it</Text>
        </Pressable>
      </View>
    </RestaurantModal>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: -8 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tw.orange100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emoji: { fontSize: 24, lineHeight: 32 },
  kicker: { fontSize: 12, fontWeight: "900", color: "#f54900", letterSpacing: 1.2, marginBottom: 4, textAlign: "center" },
  lead: { fontSize: 13, color: tw.gray500, fontWeight: "500", marginBottom: 20, textAlign: "center" },
  otpBox: {
    width: "100%",
    backgroundColor: brand.pickupOtpBg,
    borderWidth: 2,
    borderColor: brand.pickupOtpBorder,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 20,
    alignItems: "center",
  },
  otpLabel: { fontSize: 10, fontWeight: "700", color: brand.pickupOtpLabel, letterSpacing: 0.5, marginBottom: 4 },
  otp: { fontSize: 36, lineHeight: 40, fontWeight: "900", color: brand.pickupOtpText, letterSpacing: 10.8 },
  hint: { fontSize: 11, color: tw.gray400, fontWeight: "500", marginBottom: 16, textAlign: "center" },
  button: { width: "100%", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
});
