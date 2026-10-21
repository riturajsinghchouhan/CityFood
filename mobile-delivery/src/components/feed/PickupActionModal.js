// Port of DeliveryV2/components/modals/PickupActionModal.jsx (PICKING_UP / REACHED_PICKUP) over a
// black/40 scrim: restaurant logo, name, order id, distance/ETA or "Reached Location √", call and
// navigate (Google Maps), then
//   PICKING_UP:     range hint + "Slide to Reach" (locked until within range) + Mark as Delivered;
//   REACHED_PICKUP: "Request OTP" / "Resend" (the restaurant gets the code), the 4-digit pickup OTP
//                   input and "Slide to Pick Up" + Mark as Delivered;
// the user note and the collapsible item list.
// Not ported: "Skip OTP" — its only effect is the "Slide to Pick Up (Bypass OTP)" slider, which the
// conversion drops (dev/test shortcut); the hint text no longer offers "or Skip".
import { ChefHat, ChevronDown, ChevronUp, Navigation, Package, Phone } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDelivery } from "../../context/DeliveryContext";
import { TRIP_STATUS } from "../../lib/delivery/orders";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import AppImage from "../ui/AppImage";
import Text, { useScopedFont } from "../ui/Text";
import { toast } from "../ui/Toast";
import ActionSlider from "./ActionSlider";
import { callPhone, openRestaurantInMaps } from "./mapUtils";
import { p } from "./palette";
import { MarkDeliveredButton, MinimizeHandle } from "./tripParts";
import useKeyboardHeight from "./useKeyboardHeight";

export default function PickupActionModal({
  order,
  status,
  isWithinRange,
  distanceToTarget,
  eta,
  onReachedPickup,
  onPickedUp,
  onMarkDelivered,
  onMinimize,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const otpFont = useScopedFont("900");
  const { requestPickupOtp, pickupOtpRequested, actionInFlight } = useDelivery();
  const [showItems, setShowItems] = useState(false);
  const [pickupOtp, setPickupOtp] = useState("");
  const [otpFocused, setOtpFocused] = useState(false);
  const isRequestingOtp = actionInFlight === "requestPickupOtp";

  if (!order) return null;

  const isAtPickup = status === TRIP_STATUS.REACHED_PICKUP;
  const restaurantName =
    order.restaurantName ||
    order.restaurant_name ||
    order.restaurantId?.restaurantName ||
    order.restaurant?.restaurantName ||
    "Restaurant";
  const restaurantAddress =
    order.restaurantAddress ||
    order.restaurant_address ||
    order.restaurantLocation?.address ||
    order.restaurantId?.address ||
    "Address not available";
  const restaurantPhone = order.restaurantPhone || order.restaurant_phone || order.restaurantId?.phone || "";
  const distanceLabel = Number.isFinite(distanceToTarget)
    ? `${(distanceToTarget / 1000).toFixed(1)} km • ${eta || "--"} min to Store`
    : "Locating your position...";
  const items = order.items || [];
  const restaurantLogo =
    order.restaurantImage ||
    order.restaurant?.logo ||
    order.restaurant?.profileImage ||
    order.restaurantId?.profileImage ||
    order.restaurantId?.logo ||
    null;

  const handleRequestOtp = async () => {
    const orderId = order.order_id || order.orderId || order._id || order.orderMongoId;
    if (!orderId) {
      toast.error("Order ID missing");
      return;
    }
    try {
      await requestPickupOtp();
      toast.success("OTP sent to restaurant! Ask them for the code.");
    } catch (err) {
      toast.error(err?.data?.error || "Failed to send OTP to restaurant");
    }
  };

  return (
    <View style={styles.scrim}>
      <View
        style={[
          styles.sheet,
          {
            maxHeight: Dimensions.get("window").height * 0.84 - keyboard,
            marginBottom: keyboard,
            paddingBottom: 24 + (keyboard ? 0 : insets.bottom),
          },
        ]}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <MinimizeHandle onPress={onMinimize} style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.logo}>
                <AppImage src={restaurantLogo} width={56} placeholderType="shop" style={styles.logoImg} />
              </View>
              <View style={styles.flexShrink}>
                <Text heading style={styles.name}>{restaurantName}</Text>
                <Text style={[styles.orderId, { color: colors.primary }]}>
                  ORDER #{order.order_id || order.orderId || order._id}
                </Text>
                <Text style={[styles.distance, { color: colors.primary }]}>
                  {isAtPickup ? "Reached Location √" : distanceLabel}
                </Text>
              </View>
            </View>
            <View style={styles.headerBtns}>
              {restaurantPhone ? (
                <Pressable
                  onPress={() => callPhone(restaurantPhone)}
                  style={[styles.round, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder, borderWidth: 1 }]}
                >
                  <Phone size={20} color={colors.primary} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => openRestaurantInMaps(order, restaurantAddress)}
                style={[styles.round, styles.navBtn]}
              >
                <Navigation size={20} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.actions}>
            {!isAtPickup ? (
              <View>
                <Text style={[styles.hint, { color: colors.primary, opacity: isWithinRange ? 1 : 0.85 }]}>
                  {isWithinRange ? "Ready - Swipe to confirm arrival" : "Get closer to restaurant"}
                </Text>
                <ActionSlider
                  key="action-reach"
                  label="Slide to Reach"
                  successLabel="Reached!"
                  disabled={!isWithinRange}
                  onConfirm={onReachedPickup}
                  color={colors.primary}
                />
                <View style={styles.markWrap}>
                  <MarkDeliveredButton onPress={() => onMarkDelivered?.(order)} />
                </View>
              </View>
            ) : (
              <View>
                <Text style={[styles.hint, { color: colors.primary }]}>
                  {pickupOtpRequested ? "Enter OTP & Swipe to pick up" : "Request OTP from restaurant"}
                </Text>
                <View style={styles.otpBtnRow}>
                  <Pressable
                    onPress={handleRequestOtp}
                    disabled={isRequestingOtp}
                    style={({ pressed }) => [
                      styles.requestBtn,
                      { backgroundColor: pickupOtpRequested ? p.orange400 : colors.primary },
                      isRequestingOtp && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    {isRequestingOtp ? (
                      <>
                        <ActivityIndicator size="small" color="#ffffff" />
                        <Text style={styles.requestText}>Sending...</Text>
                      </>
                    ) : (
                      <Text style={styles.requestText}>{pickupOtpRequested ? "🔔 Resend" : "🔔 Request OTP"}</Text>
                    )}
                  </Pressable>
                </View>

                {pickupOtpRequested ? (
                  <>
                    <View style={styles.otpWrap}>
                      <TextInput
                        value={pickupOtp}
                        onChangeText={(t) => setPickupOtp(t.replace(/\D/g, "").slice(0, 4))}
                        placeholder="Enter 4-digit Pickup OTP"
                        placeholderTextColor={tw.gray400}
                        keyboardType="number-pad"
                        maxLength={4}
                        onFocus={() => setOtpFocused(true)}
                        onBlur={() => setOtpFocused(false)}
                        style={[
                          styles.otpInput,
                          otpFont,
                          pickupOtp ? styles.otpFilled : null,
                          otpFocused && { borderColor: colors.primary, boxShadow: `0px 0px 0px 2px ${colors.primary}33` },
                        ]}
                      />
                    </View>
                    <ActionSlider
                      key="action-pickup"
                      label="Slide to Pick Up"
                      successLabel="Picked Up!"
                      disabled={pickupOtp.length !== 4}
                      onConfirm={() => onPickedUp(pickupOtp)}
                      color={colors.primary}
                    />
                  </>
                ) : null}

                <View style={styles.markWrap}>
                  <MarkDeliveredButton onPress={() => onMarkDelivered?.(order)} />
                </View>
              </View>
            )}

            {order?.note ? (
              <View style={[styles.note, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}>
                <ChefHat size={20} color={colors.primary} style={styles.noteIcon} />
                <View style={styles.flexShrink}>
                  <Text style={[styles.noteLabel, { color: colors.primary }]}>User Instructions</Text>
                  <Text style={styles.noteText}>&quot;{order.note}&quot;</Text>
                </View>
              </View>
            ) : null}

            <Pressable onPress={() => setShowItems((v) => !v)} style={styles.itemsToggle}>
              <View style={styles.itemsToggleLeft}>
                <Package size={20} color={tw.gray400} />
                <Text style={styles.itemsToggleText}>Order Details ({items.length || 0})</Text>
              </View>
              {showItems ? <ChevronDown size={16} color={tw.gray900} /> : <ChevronUp size={16} color={tw.gray900} />}
            </Pressable>

            {showItems ? (
              <View style={styles.itemList}>
                {items.map((item, idx) => (
                  <View key={idx} style={[styles.itemRow, idx < items.length - 1 && styles.itemBorder]}>
                    <Text style={styles.itemName}>{item.name || "Item Name"}</Text>
                    <Text style={[styles.itemQty, { color: colors.primary, backgroundColor: colors.primarySoft }]}>
                      x{item.quantity || 1}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end", zIndex: 110 },
  sheet: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    boxShadow: "0px -20px 60px rgba(0,0,0,0.3)",
  },
  content: { paddingBottom: 0 },
  handle: { paddingBottom: 8, paddingTop: 4 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray50,
    gap: 8,
  },
  headerLeft: { flexDirection: "row", gap: 12, flexShrink: 1 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.05)",
  },
  logoImg: { width: "100%", height: "100%" },
  flexShrink: { flexShrink: 1 },
  name: { color: tw.gray950, fontSize: 18, fontWeight: "700" },
  orderId: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1, marginTop: 2 },
  distance: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: 6 },
  headerBtns: { flexDirection: "row", gap: 8 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  navBtn: { backgroundColor: tw.gray900, boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)" },
  actions: { gap: 16 },
  hint: { textAlign: "center", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  markWrap: { paddingTop: 8 },
  otpBtnRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  requestBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)",
  },
  requestText: { color: "#ffffff", fontWeight: "900", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2 },
  disabled: { opacity: 0.6 },
  pressed: { transform: [{ scale: 0.95 }] },
  otpWrap: { marginBottom: 16, paddingHorizontal: 8 },
  otpInput: {
    width: "100%",
    backgroundColor: tw.gray50,
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: "center",
    fontSize: 18,
    color: tw.gray900,
  },
  otpFilled: { letterSpacing: 18 * 0.25 },
  note: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  noteIcon: { marginTop: 2 },
  noteLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  noteText: { fontSize: 14, fontWeight: "700", color: tw.gray800, lineHeight: 19 },
  itemsToggle: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: tw.gray50,
    borderRadius: 16,
  },
  itemsToggleLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  itemsToggleText: { color: tw.gray900, fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2 },
  itemList: { paddingHorizontal: 4, gap: 8 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: tw.gray50 },
  itemName: { flexShrink: 1, color: tw.gray700, fontSize: 14, fontWeight: "700" },
  itemQty: { fontWeight: "700", fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: "hidden" },
});
