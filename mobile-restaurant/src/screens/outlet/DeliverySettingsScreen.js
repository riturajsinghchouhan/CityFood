// Port of pages/restaurant/DeliverySettings.jsx (/delivery-settings): the "Turn on delivery"
// switch (PATCH /availability, applied first and rolled back on error). Turning it off asks for
// confirmation in a RestaurantModal. The value is mirrored into the navbar's Online/Offline pill.
// The web's "outside outlet timings" branches are dead (canEnableDelivery is always true).
import { AlertCircle, Truck } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { getCurrentRestaurant, updateAcceptingOrders } from "../../api";
import { DarkToast, PageHeader, ShadSwitch, extra } from "../../components/outlet/common";
import { FadeUp } from "../../components/outlet/ExploreParts";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import RestaurantModal from "../../components/shell/RestaurantModal";
import { setRestaurantOnlineStatus, useStoredOnlineStatus } from "../../components/shell/stores";
import { Text } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { tw } from "../../theme/tokens";

function PulseDot({ active }) {
  const [anim] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!active) {
      anim.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim]);
  return <Animated.View style={[styles.dot, { backgroundColor: active ? tw.green500 : tw.gray600, opacity: anim }]} />;
}

export default function DeliverySettingsScreen() {
  const goBack = useAppBack();
  const shellInset = useShellBottomInset();
  const storedStatus = useStoredOnlineStatus();
  const [deliveryStatus, setDeliveryStatus] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const loadedRef = useRef(false);
  const toastTimer = useRef(null);
  const [scale] = useState(() => new Animated.Value(1));

  // The stored flag shows first (web reads localStorage on mount); the backend value wins.
  useEffect(() => {
    if (!loadedRef.current && storedStatus !== null) setDeliveryStatus(storedStatus);
  }, [storedStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getCurrentRestaurant();
        const next = res?.data?.restaurant?.isAcceptingOrders === true;
        if (!cancelled) {
          loadedRef.current = true;
          setDeliveryStatus(next);
          setRestaurantOnlineStatus(next);
        }
      } catch {
        // keep the stored value
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    Animated.timing(scale, { toValue: deliveryStatus ? 1.05 : 1, duration: 200, useNativeDriver: true }).start();
  }, [deliveryStatus, scale]);

  const showToast = (message) => {
    setToastMessage(message);
    setShowSuccessToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const saveDeliveryStatusToBackend = async (status) => {
    const previousStatus = deliveryStatus;
    const nextStatus = Boolean(status);
    try {
      setSavingStatus(true);
      loadedRef.current = true;
      setDeliveryStatus(nextStatus);
      setRestaurantOnlineStatus(nextStatus);
      showToast(nextStatus ? "Delivery is now ON - You're receiving orders" : "Delivery is now OFF - Not receiving orders");
      await updateAcceptingOrders(nextStatus);
    } catch (error) {
      setDeliveryStatus(previousStatus);
      setRestaurantOnlineStatus(previousStatus);
      showToast((!error?.isNetworkError && error?.data?.message) || "Error updating delivery status");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDeliveryStatusChange = (checked) => {
    if (savingStatus) return;
    if (!checked && deliveryStatus) {
      setPendingStatus(checked);
      setShowConfirmDialog(true);
      return;
    }
    saveDeliveryStatusToBackend(checked);
  };

  const handleConfirmStatusChange = () => {
    saveDeliveryStatusToBackend(pendingStatus);
    setShowConfirmDialog(false);
  };

  const handleCancelStatusChange = () => {
    setShowConfirmDialog(false);
    setPendingStatus(deliveryStatus);
  };

  return (
    <View style={styles.page}>
      <PageHeader title="Delivery Settings" subtitle="Manage your delivery status" onBack={goBack} />
      <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingBottom: 24 + shellInset }]}>
        <FadeUp>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.iconBox}>
                <Truck size={20} color={tw.gray900} />
              </View>
              <View style={styles.flexShrink}>
                <Text style={styles.cardTitle}>Delivery Status</Text>
                <Text style={styles.cardSub}>Control when you receive delivery orders</Text>
              </View>
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle} numberOfLines={1}>
                  Turn on delivery
                </Text>
                <Animated.View style={[styles.statusRow, { transform: [{ scale }] }]}>
                  <PulseDot active={deliveryStatus} />
                  <Text style={styles.statusText} numberOfLines={1}>
                    {deliveryStatus ? "Receiving orders" : "Not receiving orders"}
                  </Text>
                </Animated.View>
              </View>
              <ShadSwitch checked={deliveryStatus} onCheckedChange={handleDeliveryStatusChange} disabled={savingStatus} />
            </View>
          </View>
        </FadeUp>

        <FadeUp delay={0.1} style={styles.infoWrap}>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Note:</Text> When delivery is turned off, customers won&apos;t be able to place delivery
              orders from your restaurant. You can turn it back on anytime.
            </Text>
          </View>
        </FadeUp>
      </ScrollView>

      <RestaurantModal open={showConfirmDialog} onClose={handleCancelStatusChange} size="sm" showClose={false}>
        <View style={styles.modalBody}>
          <View style={[styles.modalIcon, { backgroundColor: pendingStatus ? tw.orange100 : tw.red100 }]}>
            <AlertCircle size={40} color={pendingStatus ? extra.orange600 : tw.red600} />
          </View>
          <Text style={styles.modalTitle}>{pendingStatus ? "Enable Delivery?" : "Disable Delivery?"}</Text>
          <Text style={styles.modalText}>
            {pendingStatus
              ? "You will start receiving delivery orders. Make sure you're ready to accept orders."
              : "Customers won't be able to place delivery orders. You can turn it back on anytime."}
          </Text>
          <View style={styles.modalRow}>
            <Pressable
              onPress={handleCancelStatusChange}
              style={({ pressed }) => [styles.modalBtn, { backgroundColor: pressed ? tw.gray200 : tw.gray100 }]}
            >
              <Text style={[styles.modalBtnText, { color: tw.gray900 }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirmStatusChange}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: pendingStatus
                    ? pressed
                      ? tw.green700
                      : tw.green600
                    : pressed
                      ? tw.red700
                      : tw.red600,
                },
              ]}
            >
              <Text style={[styles.modalBtnText, { color: "#ffffff" }]}>{pendingStatus ? "Enable" : "Disable"}</Text>
            </Pressable>
          </View>
        </View>
      </RestaurantModal>

      <DarkToast visible={showSuccessToast} message={toastMessage} bottom={shellInset + 8} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tw.gray100 },
  fill: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  content: { paddingHorizontal: 16, paddingTop: 24 },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 12,
    paddingVertical: 40,
    paddingHorizontal: 16,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)",
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  iconBox: { padding: 8, backgroundColor: tw.gray100, borderRadius: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  cardSub: { fontSize: 14, color: tw.gray500 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  toggleText: { flex: 1, minWidth: 0 },
  toggleTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900, marginBottom: 6 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, transformOrigin: "left" },
  dot: { width: 8, height: 8, borderRadius: 9999 },
  statusText: { flexShrink: 1, fontSize: 14, color: tw.gray500 },
  infoWrap: { marginTop: 16 },
  infoCard: {
    backgroundColor: tw.blue50,
    borderWidth: 1,
    borderColor: extra.blue200,
    borderRadius: 12,
    paddingVertical: 40,
    paddingHorizontal: 16,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)",
  },
  infoText: { fontSize: 14, color: tw.gray700 },
  bold: { fontWeight: "700" },
  modalBody: { alignItems: "center", marginTop: -8 },
  modalIcon: { width: 64, height: 64, borderRadius: 9999, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: tw.gray900, marginBottom: 8, textAlign: "center" },
  modalText: { fontSize: 14, color: tw.gray600, marginBottom: 24, textAlign: "center" },
  modalRow: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtn: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  modalBtnText: { fontSize: 16, fontWeight: "600" },
});
