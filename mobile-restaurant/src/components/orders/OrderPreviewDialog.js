// OrdersMain "Bottom Sheet for Order Details": at phone width a centred restaurant-modal-panel
// (max-w-md, rounded-2xl, p-4, max-h 85vh) with the order summary and "View Details & Bill".
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";
import { pal } from "./ordersUtils";
import ResendNotificationButton from "./ResendNotificationButton";

export default function OrderPreviewDialog({ order, visible, onClose, onViewDetails }) {
  const { colors } = useTheme();
  const o = order;
  if (!visible || !o) return null;

  const statusLower = String(o.status).toLowerCase();
  const isReadyLabel = o.status === "Ready";
  const raw = o.paymentMethod;
  const normalized = raw != null ? String(raw).toLowerCase().trim() : "";
  const isCod = normalized === "cash" || normalized === "cod";
  const maxHeight = Dimensions.get("window").height * 0.85;

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
        <View style={[styles.panel, { maxHeight }]}>
          <ScrollView contentContainerStyle={styles.body} bounces={false}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            <View style={styles.headRow}>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.orderId}>Order #{o.orderId}</Text>
                <Text style={styles.customer}>{o.customerName}</Text>
                <Text style={styles.type}>
                  {o.type}
                  {o.tableOrToken ? ` • ${o.tableOrToken}` : ""}
                </Text>
              </View>
              <View style={styles.headRight}>
                <View style={[styles.status, { borderColor: isReadyLabel ? tw.green500 : tw.gray800 }]}>
                  <View style={[styles.statusDot, { backgroundColor: isReadyLabel ? tw.green500 : tw.gray800 }]} />
                  <Text style={[styles.statusText, { color: isReadyLabel ? tw.green600 : tw.gray900 }]}>{o.status}</Text>
                </View>
                <Text style={styles.type}>{o.timePlaced}</Text>
                {(statusLower === "preparing" || statusLower === "ready") && !o.deliveryPartnerId ? (
                  <View style={{ marginTop: 4 }}>
                    <ResendNotificationButton orderId={o.orderId} mongoId={o.mongoId} onSuccess={onClose} />
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={{ marginBottom: 12 }}>
              <Text style={styles.itemsLabel}>Items</Text>
              <Text style={styles.itemsText}>{o.itemsSummary}</Text>
            </View>

            <View style={styles.metaRow}>
              {o.status !== "ready" && o.eta ? (
                <Text style={styles.meta}>
                  ETA: <Text style={[styles.meta, styles.metaStrong]}>{o.eta}</Text>
                </Text>
              ) : null}
              <Text style={styles.meta}>
                Payment:{" "}
                <Text style={[styles.meta, styles.metaStrong, { color: isCod ? pal.amber700 : "#000" }]}>
                  {isCod ? "Cash on Delivery" : "Paid online"}
                </Text>
              </Text>
            </View>

            {o.status === "cancelled" && o.cancellationReason ? (
              <View style={[styles.box, { backgroundColor: tw.red50, borderColor: tw.red100 }]}>
                <Text style={[styles.boxLabel, { color: tw.red500 }]}>CANCELLATION REASON</Text>
                <Text style={[styles.boxText, { color: tw.red700 }]}>{o.cancellationReason}</Text>
              </View>
            ) : null}

            {o.status === "rejected" && o.rejectionReason ? (
              <View style={[styles.box, { backgroundColor: pal.amber50, borderColor: pal.amber100 }]}>
                <Text style={[styles.boxLabel, { color: pal.amber600 }]}>REJECTION REASON</Text>
                <Text style={[styles.boxText, { color: pal.amber700 }]}>{o.rejectionReason}</Text>
              </View>
            ) : null}

            {o.restaurantNote ? (
              <View style={[styles.box, { backgroundColor: tw.blue50, borderColor: pal.blue100 }]}>
                <Text style={[styles.boxLabel, { color: tw.blue600 }]}>NOTE FOR RESTAURANT</Text>
                <Text style={[styles.boxText, { color: pal.blue700 }]}>{o.restaurantNote}</Text>
              </View>
            ) : null}

            {o.pickupOtp ? (
              <View style={[styles.box, styles.otpBox]}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={[styles.otpLabel, { color: pal.emerald700 }]}>PICKUP VERIFICATION OTP</Text>
                  <Text style={[styles.otpHint, { color: pal.emerald600 }]}>Share this code with the delivery partner.</Text>
                </View>
                <View style={styles.otpValueWrap}>
                  <Text style={styles.otpValue}>{o.pickupOtp}</Text>
                </View>
              </View>
            ) : (o.status === "READY" || o.status === "PREPARING" || o.status === "CONFIRMED") &&
              o.deliveryPartnerId &&
              o.type === "Home Delivery" ? (
              <View style={[styles.box, { backgroundColor: tw.gray50, borderColor: tw.gray200 }]}>
                <Text style={[styles.otpLabel, { color: tw.gray700 }]}>PICKUP VERIFICATION OTP</Text>
                <Text style={[styles.otpHint, { color: tw.gray500 }]}>
                  Will be shown when the delivery partner reaches the restaurant.
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnOutline,
                  { borderColor: colors.primaryBorder || colors.primary },
                  pressed && { backgroundColor: tw.red50 },
                ]}
              >
                <Text style={[styles.btnText, { color: colors.primary }]}>Close</Text>
              </Pressable>
              <Pressable
                onPress={() => onViewDetails?.(o)}
                style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary }, pressed && { opacity: 0.9 }]}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>View Details & Bill</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.4)" },
  panel: {
    width: "100%",
    maxWidth: 448,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  body: { padding: 16 },
  handleWrap: { alignItems: "center", marginBottom: 12 },
  handle: { width: 40, height: 4, borderRadius: 9999, backgroundColor: tw.gray300 },
  headRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: "600", color: "#000" },
  customer: { fontSize: 12, color: tw.gray500, marginTop: 4 },
  type: { fontSize: 11, color: tw.gray500, marginTop: 4 },
  headRight: { alignItems: "flex-end", gap: 4 },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 9999 },
  statusText: { fontSize: 11, fontWeight: "500" },
  divider: { height: 1, backgroundColor: tw.gray100, marginVertical: 12 },
  itemsLabel: { fontSize: 12, fontWeight: "500", color: tw.gray700, marginBottom: 4 },
  itemsText: { fontSize: 12, color: tw.gray600 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  meta: { fontSize: 11, color: tw.gray500 },
  metaStrong: { fontWeight: "500", color: "#000" },
  box: { marginBottom: 16, padding: 12, borderWidth: 1, borderRadius: 14 },
  boxLabel: { fontSize: 10, fontWeight: "700", marginBottom: 4 },
  boxText: { fontSize: 12, fontWeight: "500" },
  otpBox: {
    backgroundColor: pal.emerald50,
    borderColor: pal.emerald100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  otpLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
  otpHint: { fontSize: 9, lineHeight: 11, fontWeight: "500" },
  otpValueWrap: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: pal.emerald200,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  otpValue: { fontSize: 18, fontWeight: "900", color: pal.emerald800, letterSpacing: 3.6 },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnOutline: { borderWidth: 2, backgroundColor: "#fff" },
  btnText: { fontSize: 14, fontWeight: "500" },
});
