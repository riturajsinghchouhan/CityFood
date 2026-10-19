// OrdersMain.jsx order cards: OrderCard (All, New, Preparing, Ready, Out for delivery, Scheduled,
// search results) and the history card shared by the Completed, Cancelled and Dead tabs.
// Both sit in a restaurant-bento-card surface.
import { Calendar, Check } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { mixWithWhite, tw } from "../../theme/tokens";
import AppImage from "../ui/AppImage";
import Text from "../ui/Text";
import { fmtMonthDayTime, fmtMonthDayYearTime, pal } from "./ordersUtils";
import ResendNotificationButton from "./ResendNotificationButton";

const BRAND = "#7e3866"; // hard-coded on web, not remapped by restaurantTheme.css

export const bentoCard = {
  backgroundColor: "#ffffff",
  borderWidth: 1,
  borderColor: mixWithWhite("#f0ccd5", 0.65),
  borderRadius: 20,
  boxShadow: "0px 1px 2px rgba(15,23,42,0.04), 0px 8px 24px -10px rgba(15,23,42,0.08)",
  overflow: "hidden",
};

export function OrderCard({
  orderId,
  mongoId,
  status,
  customerName,
  type,
  tableOrToken,
  timePlaced,
  eta,
  itemsSummary,
  paymentMethod,
  photoUrl,
  photoAlt,
  deliveryPartnerId,
  dispatchStatus,
  onSelect,
  onMarkReady,
  isMarkingReady = false,
  scheduledAt = null,
  restaurantNote = null,
  pickupOtp = null,
  cancellationReason = null,
  rejectionReason = null,
}) {
  const normalizedStatus = String(status || "").toLowerCase();
  const isReady = normalizedStatus === "ready";
  const isPreparing = normalizedStatus === "preparing";

  let statusLabel = String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  // Not accepted by the restaurant yet: shown as Pending instead of Confirmed.
  if (normalizedStatus === "confirmed" || normalizedStatus === "created") statusLabel = "Pending";

  const chip = isReady
    ? { bg: pal.emerald50, fg: pal.emerald600, border: pal.emerald100 }
    : normalizedStatus === "confirmed"
      ? { bg: pal.amber50, fg: pal.amber600, border: pal.amber100 }
      : { bg: pal.slate50, fg: pal.slate500, border: pal.slate100 };

  const select = () =>
    onSelect?.({
      orderId,
      mongoId,
      status,
      customerName,
      type,
      tableOrToken,
      timePlaced,
      eta,
      itemsSummary,
      paymentMethod,
      scheduledAt,
      restaurantNote,
      pickupOtp,
      deliveryPartnerId,
      dispatchStatus,
      cancellationReason,
      rejectionReason,
    });

  const activeish = isPreparing || isReady || normalizedStatus === "confirmed";

  return (
    <View style={[bentoCard, styles.card]}>
      <View style={[styles.accent, { backgroundColor: BRAND }]} />
      <Pressable onPress={select} style={({ pressed }) => [styles.cardRow, pressed && { backgroundColor: pal.slate50 }]}>
        <View style={styles.photo}>
          {photoUrl ? (
            <AppImage src={photoUrl} width={56} style={styles.fill} placeholderType="none" />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.photoAlt} numberOfLines={3}>
                {photoAlt}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.orderId} numberOfLines={1}>
              #<Text style={[styles.orderId, { color: BRAND }]}>{orderId}</Text>
            </Text>
            <View style={styles.chips}>
              {scheduledAt ? (
                <View style={[styles.chip, { backgroundColor: tw.green50, borderColor: tw.green100 }]}>
                  <Calendar size={8} color={pal.green600} />
                  <Text style={[styles.chipText, { color: pal.green600 }]}>SCHEDULED</Text>
                </View>
              ) : null}
              <View style={[styles.chip, { backgroundColor: chip.bg, borderColor: chip.border }]}>
                <Text style={[styles.chipText, styles.chipTracking, { color: chip.fg }]}>{statusLabel.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.customerRow}>
            <Text style={[styles.customerText, { maxWidth: "60%" }]} numberOfLines={1}>
              {String(customerName || "").toUpperCase()}
            </Text>
            <Text style={styles.customerText} numberOfLines={1}>
              {String(type || "").toUpperCase()}
            </Text>
          </View>

          <Text style={styles.items} numberOfLines={1}>
            {itemsSummary}
          </Text>

          {restaurantNote ? (
            <View style={styles.note}>
              <Text style={styles.noteText} numberOfLines={1}>
                Note: {restaurantNote}
              </Text>
            </View>
          ) : null}

          {pickupOtp ? (
            // stopPropagation on web: tapping the OTP does not open the order sheet.
            <Pressable onPress={() => {}} style={styles.otp}>
              <Text style={styles.otpLabel}>PICKUP OTP</Text>
              <Text style={styles.otpValue}>{pickupOtp}</Text>
            </Pressable>
          ) : activeish && type === "Home Delivery" ? (
            <View style={styles.otpPending}>
              <Text style={styles.otpPendingText}>OTP SHOWN UPON RIDER ARRIVAL</Text>
            </View>
          ) : null}

          <View style={styles.bottomRow}>
            {scheduledAt ? (
              <View style={styles.col}>
                <Text style={styles.scheduledLabel}>SCHEDULED FOR</Text>
                <Text style={styles.scheduledValue}>{fmtMonthDayTime(scheduledAt)}</Text>
              </View>
            ) : (
              <View style={styles.col}>
                {!isReady && eta ? (
                  <View style={styles.etaRow}>
                    <Text style={styles.etaLabel}>ETA</Text>
                    <Text style={styles.etaValue}>{eta}</Text>
                  </View>
                ) : null}
                <Text style={styles.placed}>{String(timePlaced || "").toUpperCase()}</Text>
              </View>
            )}

            <View style={styles.actions}>
              {activeish ? (
                <>
                  {deliveryPartnerId ? (
                    <View style={styles.driver} accessibilityLabel="Driver Assigned">
                      <Check size={12} strokeWidth={3} color={pal.emerald600} />
                    </View>
                  ) : null}
                  {!deliveryPartnerId && isPreparing ? (
                    <View style={styles.noRider}>
                      <Text style={styles.noRiderText}>NO RIDER</Text>
                    </View>
                  ) : null}
                  {/* Web passed onSuccess={onSelect} with no order, which opened nothing. */}
                  {dispatchStatus !== "accepted" ? <ResendNotificationButton orderId={orderId} mongoId={mongoId} /> : null}
                </>
              ) : null}

              {isPreparing && onMarkReady ? (
                <Pressable
                  onPress={() => onMarkReady({ orderId, mongoId, customerName })}
                  disabled={isMarkingReady}
                  style={({ pressed }) => [
                    styles.markReady,
                    { backgroundColor: BRAND },
                    pressed && { transform: [{ scale: 0.95 }] },
                    isMarkingReady && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.markReadyText}>{isMarkingReady ? "..." : "MARK READY"}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const HISTORY_BADGE = {
  delivered: { label: "Delivered", bg: pal.emerald50, fg: pal.emerald600, border: pal.emerald200, dot: pal.emerald500 },
  cancelledUser: { bg: tw.orange50, fg: pal.orange600, border: pal.orange200, dot: tw.orange500 },
  cancelled: { bg: pal.rose50, fg: pal.rose600, border: pal.rose200, dot: pal.rose500 },
  dead: { label: "Dead Order", bg: pal.zinc100, fg: pal.zinc600, border: pal.zinc200, dot: pal.zinc500 },
};

/** kind: "delivered" | "cancelled" | "dead". */
export function HistoryOrderCard({ order, kind, onSelect }) {
  const when = kind === "delivered" ? order.deliveredAt : order.cancelledAt;
  const dateText = when ? fmtMonthDayYearTime(when) : "N/A";

  let badge = HISTORY_BADGE[kind];
  let label = badge.label;
  if (kind === "cancelled") {
    badge = order.cancelledBy === "user" ? HISTORY_BADGE.cancelledUser : HISTORY_BADGE.cancelled;
    label =
      order.cancelledBy === "user"
        ? "Cancelled by User"
        : order.cancelledBy === "restaurant"
          ? "Cancelled by Restaurant"
          : "Cancelled";
  }
  const sheetStatus = kind === "delivered" ? "Delivered" : kind === "dead" ? "Dead" : "Cancelled";

  return (
    <View style={[bentoCard, styles.historyCard]}>
      <Pressable
        onPress={() =>
          onSelect?.({
            orderId: order.orderId,
            status: sheetStatus,
            customerName: order.customerName,
            type: order.type,
            tableOrToken: order.tableOrToken,
            timePlaced: dateText,
            itemsSummary: order.itemsSummary,
            paymentMethod: order.paymentMethod,
          })
        }
        style={styles.historyRow}
      >
        <View style={styles.historyPhoto}>
          {order.photoUrl ? (
            <AppImage src={order.photoUrl} width={64} style={styles.fill} placeholderType="none" />
          ) : (
            <View style={[styles.photoFallback, { backgroundColor: tw.gray50 }]}>
              <Text style={styles.historyPhotoAlt} numberOfLines={3}>
                {order.photoAlt}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.historyContent}>
          <View style={styles.historyTop}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.historyId}>Order #{order.orderId}</Text>
              <Text style={styles.historyCustomer}>{order.customerName}</Text>
            </View>
            <View style={styles.historyBadgeCol}>
              <View style={[styles.historyBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                <View style={[styles.historyDot, { backgroundColor: badge.dot }]} />
                <Text style={[styles.historyBadgeText, { color: badge.fg }]}>{label}</Text>
              </View>
              <Text style={styles.historyDate}>{dateText}</Text>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={styles.historyItems} numberOfLines={1}>
              {order.itemsSummary}
            </Text>
            {order.cancellationReason ? (
              <Text style={styles.historyReason} numberOfLines={1}>
                Reason: {order.cancellationReason}
              </Text>
            ) : null}
          </View>

          <View style={styles.historyBottom}>
            <Text style={styles.historyType}>{order.type}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.historyType}>Amount</Text>
              <Text style={styles.amount}>₹{Number(order.amount || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: "100%", height: "100%" },
  card: { width: "100%", padding: 12, marginBottom: 12 },
  accent: { position: "absolute", top: 0, left: 0, bottom: 0, width: 4 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingLeft: 4 },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: pal.slate50,
    borderWidth: 1,
    borderColor: pal.slate100,
    marginTop: 2,
  },
  photoFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 4, backgroundColor: pal.slate50 },
  photoAlt: { fontSize: 8, lineHeight: 9, fontWeight: "700", color: pal.slate300, textAlign: "center", textTransform: "uppercase" },
  content: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  orderId: { flexShrink: 1, fontSize: 13, fontWeight: "900", color: pal.slate900 },
  chips: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
  },
  chipText: { fontSize: 8, lineHeight: 11, fontWeight: "900" },
  chipTracking: { letterSpacing: 0.4 },
  customerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  customerText: { fontSize: 9, fontWeight: "700", color: pal.slate400, letterSpacing: -0.2 },
  items: { fontSize: 10, fontWeight: "700", fontStyle: "italic", color: pal.slate600, marginBottom: 4 },
  note: {
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: tw.blue50,
    borderWidth: 1,
    borderColor: pal.blue100,
    borderRadius: 6,
  },
  noteText: { fontSize: 9, fontWeight: "700", fontStyle: "italic", color: pal.blue700 },
  otp: {
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: pal.emerald50,
    borderWidth: 1,
    borderColor: pal.emerald100,
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  otpLabel: { fontSize: 9, fontWeight: "700", color: pal.emerald700 },
  otpValue: { fontSize: 13, fontWeight: "900", color: pal.emerald800, letterSpacing: 2.6 },
  otpPending: {
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: tw.gray50,
    borderWidth: 1,
    borderColor: tw.gray100,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  otpPendingText: { fontSize: 8, fontWeight: "700", color: tw.gray500, letterSpacing: 0.4, textAlign: "center" },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: pal.slate50,
  },
  col: { gap: 2, flexShrink: 1 },
  scheduledLabel: { fontSize: 8, fontWeight: "700", color: pal.green600 },
  scheduledValue: { fontSize: 10, fontWeight: "900", color: pal.green700 },
  etaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  etaLabel: { fontSize: 8, fontWeight: "700", color: pal.slate400 },
  etaValue: { fontSize: 11, fontWeight: "900", color: pal.slate800 },
  placed: { fontSize: 7, fontWeight: "700", color: pal.slate300 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  driver: {
    width: 20,
    height: 20,
    borderRadius: 9999,
    backgroundColor: pal.emerald100,
    alignItems: "center",
    justifyContent: "center",
  },
  noRider: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: pal.slate50,
    borderWidth: 1,
    borderColor: pal.slate100,
  },
  noRiderText: { fontSize: 7, fontWeight: "900", color: pal.slate400, letterSpacing: -0.35 },
  markReady: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  markReadyText: { fontSize: 9, fontWeight: "900", color: "#fff" },

  historyCard: { width: "100%", padding: 12, marginBottom: 10 },
  historyRow: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  historyPhoto: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: tw.gray50,
    borderWidth: 1,
    borderColor: tw.gray100,
    alignSelf: "center",
  },
  historyPhotoAlt: { fontSize: 9, lineHeight: 11, fontWeight: "500", color: tw.gray400, textAlign: "center" },
  historyContent: { flex: 1, minHeight: 80, justifyContent: "space-between" },
  historyTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  historyId: { fontSize: 13, lineHeight: 14, fontWeight: "700", color: pal.slate900 },
  historyCustomer: { fontSize: 10, marginTop: 4, fontWeight: "500", color: tw.gray500, textTransform: "capitalize" },
  historyBadgeCol: { alignItems: "flex-end", gap: 4 },
  historyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
  },
  historyDot: { width: 4, height: 4, borderRadius: 9999 },
  historyBadgeText: { fontSize: 9, fontWeight: "700" },
  historyDate: { fontSize: 9, fontWeight: "500", color: tw.gray400 },
  historyItems: { fontSize: 12, color: tw.gray600 },
  historyReason: { fontSize: 10, color: tw.red600, marginTop: 4 },
  historyBottom: { marginTop: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  historyType: { fontSize: 11, color: tw.gray500 },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  amount: { fontSize: 12, fontWeight: "500", color: "#000" },
});
