// Port of DeliveryV2/components/modals/NewOrderModal.jsx: incoming offer sheet over a black/60 scrim.
// Gradient header with earnings (+ bonus split), payment badge, order value and the countdown pill;
// queue chips when several offers wait; pickup/drop timeline with "Map" links; bill + payment card;
// distance/ETA tiles; Slide to Accept; Cancel (minimise) and "Pass this task".
// The 60 s countdown, its auto-pass at 0 and the ring live in DeliveryContext (offerTimeLeft).
import { LinearGradient } from "expo-linear-gradient";
import { Banknote, ChefHat, Clock, CreditCard, ExternalLink, MapPin, Store } from "lucide-react-native";
import { useMemo } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getHaversineDistance } from "../../lib/delivery/geo";
import { getCustomerDisplayInfo, getOrderPaymentInfo, getRestaurantDisplayInfo } from "../../lib/delivery/orderLocation";
import { getOrderDisplayId, getOrderMongoId, isSameOrder } from "../../lib/delivery/orders";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";
import ActionSlider from "./ActionSlider";
import { openUrl } from "./mapUtils";
import { alpha, GRADIENT_33DEG, p } from "./palette";
import { MinimizeHandle } from "./tripParts";

function useTripEstimates(order, riderLocation, restaurantInfo, customerInfo) {
  return useMemo(() => {
    const etaFromMeters = (meters, extraMins = 0) => Math.max(1, Math.ceil(meters / 416) + extraMins);
    const fmtKm = (km) => (km != null && Number.isFinite(km) ? km.toFixed(1) : "??");
    const fmtMins = (mins) => (mins != null && Number.isFinite(mins) ? mins : "??");

    let pickupDistKm = null;
    let pickupEta = null;
    const rawPickup = order.pickupDistanceKm ?? order.distanceKm;
    if (rawPickup != null) {
      pickupDistKm = Number(rawPickup);
      const rawEta = order.estimatedTime || order.duration || order.eta;
      pickupEta = rawEta && rawEta > 0 ? Math.ceil(rawEta) : etaFromMeters(pickupDistKm * 1000, 5);
    } else if (riderLocation && restaurantInfo?.coords) {
      const distM = getHaversineDistance(riderLocation.lat, riderLocation.lng, restaurantInfo.coords.lat, restaurantInfo.coords.lng);
      pickupDistKm = distM / 1000;
      pickupEta = etaFromMeters(distM, order.prepTime || 5);
    }

    let dropDistKm = null;
    let dropEta = null;
    const rawDrop = order.dropDistanceKm ?? order.deliveryDistanceKm;
    if (rawDrop != null) {
      dropDistKm = Number(rawDrop);
      dropEta = order.dropEta ? Math.ceil(order.dropEta) : etaFromMeters(dropDistKm * 1000, 0);
    } else if (restaurantInfo?.coords && customerInfo?.coords) {
      const distM = getHaversineDistance(
        restaurantInfo.coords.lat,
        restaurantInfo.coords.lng,
        customerInfo.coords.lat,
        customerInfo.coords.lng,
      );
      dropDistKm = distM / 1000;
      dropEta = etaFromMeters(distM, 0);
    }

    const totalKm = pickupDistKm != null && dropDistKm != null ? pickupDistKm + dropDistKm : null;
    const totalEta = pickupEta != null && dropEta != null ? pickupEta + dropEta : null;
    return {
      pickup: { distanceKm: fmtKm(pickupDistKm), etaMins: fmtMins(pickupEta) },
      drop: { distanceKm: fmtKm(dropDistKm), etaMins: fmtMins(dropEta) },
      total: { distanceKm: fmtKm(totalKm), etaMins: fmtMins(totalEta) },
    };
  }, [order, riderLocation, restaurantInfo, customerInfo]);
}

function QueueChip({ queuedOrder, index, active, onPress }) {
  const { colors } = useTheme();
  const qEarnings = queuedOrder.earnings || queuedOrder.riderEarning || queuedOrder.pricing?.deliveryFee || 0;
  const label = getOrderDisplayId(queuedOrder) || `Order ${index + 1}`;
  const qRest = getRestaurantDisplayInfo(queuedOrder);
  const qCust = getCustomerDisplayInfo(queuedOrder);
  const qPayment = getOrderPaymentInfo(queuedOrder);
  const pill = qPayment.isCod
    ? active
      ? { bg: alpha(p.amber400, 0.3), fg: p.amber300 }
      : { bg: p.amber100, fg: p.amber800 }
    : active
      ? { bg: alpha(p.emerald400, 0.3), fg: p.emerald300 }
      : { bg: p.emerald100, fg: p.emerald800 };
  const fg = active ? "#ffffff" : tw.gray700;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: tw.gray900, borderColor: alpha(p.blue400, 0.4), borderWidth: 2 }
          : { backgroundColor: "#ffffff", borderColor: tw.gray200 },
      ]}
    >
      <View style={styles.chipTop}>
        <Text numberOfLines={1} style={[styles.chipLabel, { color: fg }]}>
          {label}
        </Text>
        <View style={styles.chipRight}>
          <Text style={[styles.chipEarn, { color: colors.primary }]}>₹{Number(qEarnings || 0).toFixed(0)}</Text>
          <View style={[styles.chipPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.chipPillText, { color: pill.fg }]}>
              {qPayment.paymentLabel} · ₹{Math.round(qPayment.totalAmount)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.chipLine}>
        <Store size={14} color={active ? p.green400 : colors.primary} />
        <Text numberOfLines={1} style={[styles.chipRest, { color: fg }]}>
          {qRest.name}
          {qRest.shortAddress && qRest.shortAddress !== qRest.name ? (
            <Text style={[styles.chipSub, { color: fg }]}> ({qRest.shortAddress})</Text>
          ) : null}
        </Text>
      </View>
      <View style={styles.chipLine}>
        <MapPin size={14} color={active ? p.blue400 : colors.primary} />
        <Text numberOfLines={1} style={[styles.chipAddr, { color: fg }]}>
          {qCust.shortAddress || qCust.address}
        </Text>
      </View>
    </Pressable>
  );
}

function Tile({ icon: Icon, label, value, labelColor, tileBg, tileBorder, iconColor }) {
  return (
    <View style={[styles.tile, { backgroundColor: tileBg, borderColor: tileBorder }]}>
      <Icon size={20} color={iconColor} />
      <View>
        <Text style={[styles.tileLabel, { color: labelColor }]}>{label}</Text>
        <Text style={styles.tileValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function NewOrderModal({
  order,
  queuedOrders = [],
  timeLeft,
  riderLocation,
  onSelectOrder,
  onAccept,
  onReject,
  onMinimize,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const restaurantInfo = useMemo(() => getRestaurantDisplayInfo(order), [order]);
  const customerInfo = useMemo(() => getCustomerDisplayInfo(order), [order]);
  const paymentInfo = useMemo(() => getOrderPaymentInfo(order), [order]);
  const { pickup, drop, total } = useTripEstimates(order, riderLocation, restaurantInfo, customerInfo);
  const orderKey = getOrderMongoId(order) || getOrderDisplayId(order);

  const bonus = order.deliveryBonusAmount || 0;
  const earnings = order.earnings || order.riderEarning || (order.orderAmount ? order.orderAmount * 0.1 : 0);
  const baseEarnings = Math.max(0, earnings - bonus);
  const customerName = customerInfo.name && customerInfo.name !== "Customer" ? customerInfo.name : "Customer Drop";
  const cod = paymentInfo.isCod;
  const greenTile = { tileBg: colors.primarySoft, tileBorder: colors.primaryBorder, iconColor: colors.primary, labelColor: alpha(p.green600, 0.8) };
  const blueTile = { tileBg: colors.primarySoft, tileBorder: colors.primaryBorder, iconColor: colors.primary, labelColor: alpha(p.blue600, 0.8) };

  return (
    <View style={styles.scrim}>
      <View style={styles.sheet}>
        <MinimizeHandle onPress={onMinimize} style={styles.handle} />

        <LinearGradient colors={["#15498b", "#000000"]} {...GRADIENT_33DEG} style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerRow}>
              <Text style={styles.incoming}>Incoming Request</Text>
              <View
                style={[
                  styles.badge,
                  cod
                    ? { backgroundColor: alpha(p.amber400, 0.25), borderColor: alpha(p.amber400, 0.4) }
                    : { backgroundColor: alpha(p.emerald400, 0.25), borderColor: alpha(p.emerald400, 0.4) },
                ]}
              >
                <Text style={[styles.badgeText, { color: cod ? p.amber300 : p.emerald300 }]}>{paymentInfo.paymentLabel}</Text>
              </View>
            </View>
            <View style={styles.earnRow}>
              <Text heading style={styles.earn}>₹{Number(earnings || 0).toFixed(2)}</Text>
              {bonus > 0 ? (
                <Text style={styles.bonus}>
                  (₹{Number(baseEarnings).toFixed(0)} + ₹{Number(bonus).toFixed(0)} Bonus)
                </Text>
              ) : null}
            </View>
            <Text style={styles.orderValue}>
              Order Value: <Text style={styles.orderValueStrong}>₹{paymentInfo.totalAmount.toFixed(2)}</Text>
            </Text>
          </View>
          <View style={styles.timer}>
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </View>
        </LinearGradient>

        {queuedOrders.length > 1 ? (
          <View style={styles.queue}>
            <Text style={styles.queueTitle}>{queuedOrders.length} orders available — tap to switch</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.queueRow}>
              {queuedOrders.map((q, index) => (
                <QueueChip
                  key={getOrderMongoId(q) || getOrderDisplayId(q) || `order-${index}`}
                  queuedOrder={q}
                  index={index}
                  active={isSameOrder(q, order)}
                  onPress={() => onSelectOrder?.(q)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView style={{ maxHeight: Dimensions.get("window").height * 0.78 }} contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.timeline}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: colors.primary, borderColor: p.green50 }]} />
              <View style={styles.railLine} />
              <View style={[styles.dot, { backgroundColor: colors.primary, borderColor: p.blue50 }]} />
            </View>
            <View style={styles.stops}>
              <View>
                <View style={styles.stopHead}>
                  <View style={styles.stopTag}>
                    <ChefHat size={16} color={colors.primary} />
                    <Text style={[styles.stopTagText, { color: colors.primary }]}>Restaurant Pickup</Text>
                  </View>
                  {restaurantInfo.mapsUrl ? (
                    <Pressable onPress={() => openUrl(restaurantInfo.mapsUrl)} hitSlop={8} style={styles.mapLink}>
                      <Text style={[styles.stopTagText, { color: colors.primary }]}>Map</Text>
                      <ExternalLink size={12} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.stopName}>{restaurantInfo.name}</Text>
                <Text style={styles.stopAddr}>{restaurantInfo.address}</Text>
              </View>
              <View>
                <View style={styles.stopHead}>
                  <View style={styles.stopTag}>
                    <MapPin size={16} color={colors.primary} />
                    <Text style={[styles.stopTagText, { color: colors.primary }]}>Customer Drop</Text>
                  </View>
                  {customerInfo.mapsUrl ? (
                    <Pressable onPress={() => openUrl(customerInfo.mapsUrl)} hitSlop={8} style={styles.mapLink}>
                      <Text style={[styles.stopTagText, { color: colors.primary }]}>Map</Text>
                      <ExternalLink size={12} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.stopName}>{customerName}</Text>
                <Text numberOfLines={2} style={styles.stopAddr}>
                  {customerInfo.address}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.payCard,
              cod
                ? { backgroundColor: alpha(p.amber50, 0.9), borderColor: p.amber200 }
                : { backgroundColor: alpha(p.emerald50, 0.9), borderColor: colors.primaryBorder },
            ]}
          >
            <View style={styles.payLeft}>
              <View style={[styles.payIcon, { backgroundColor: cod ? p.amber500 : colors.primary }]}>
                {cod ? <Banknote size={20} color="#fff" /> : <CreditCard size={20} color="#fff" />}
              </View>
              <View style={styles.flexShrink}>
                <View style={styles.payRow}>
                  <View style={[styles.payPill, { backgroundColor: cod ? p.amber200 : p.emerald200 }]}>
                    <Text style={[styles.payPillText, { color: cod ? p.amber900 : p.emerald900 }]}>{paymentInfo.paymentLabel}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.payStatus}>
                    {paymentInfo.paymentStatusText}
                  </Text>
                </View>
                <Text numberOfLines={1} style={[styles.payNotice, { color: cod ? p.amber800 : p.emerald800 }]}>
                  {paymentInfo.collectionNotice}
                </Text>
              </View>
            </View>
            <View style={styles.billBox}>
              <Text style={styles.billLabel}>Order Bill</Text>
              <Text style={styles.billValue}>₹{paymentInfo.totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.tiles}>
            <Tile icon={MapPin} label="To Restaurant" value={`${pickup.distanceKm} KM`} {...greenTile} />
            <Tile icon={Clock} label="Pickup Time" value={`${pickup.etaMins} MINS`} {...greenTile} />
            <Tile icon={MapPin} label="To Customer" value={`${drop.distanceKm} KM`} {...blueTile} />
            <Tile icon={Clock} label="Drop Time" value={`${drop.etaMins} MINS`} {...blueTile} />
          </View>
          {total.distanceKm !== "??" ? (
            <Text style={styles.totalTrip}>
              Total trip ~ {total.distanceKm} KM · ~ {total.etaMins} MINS
            </Text>
          ) : null}

          <View style={styles.actions}>
            <ActionSlider
              key={orderKey}
              label="Slide to Accept"
              onConfirm={() => onAccept(order)}
              color="#000000"
              successLabel="Order Accepted ✓"
            />
            <View style={styles.actionRow}>
              <Pressable onPress={onMinimize} hitSlop={8}>
                <Text style={styles.textBtn}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onReject} hitSlop={8}>
                <Text style={styles.textBtn}>Pass this task</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end", zIndex: 1000 },
  sheet: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    paddingTop: 4,
    boxShadow: "0px -20px 60px rgba(0,0,0,0.5)",
  },
  handle: { paddingBottom: 6, paddingTop: 4, marginBottom: -4, zIndex: 10, backgroundColor: "#ffffff" },
  header: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerLeft: { flexShrink: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  incoming: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  earnRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  earn: { color: "#ffffff", fontSize: 24, lineHeight: 32, fontWeight: "700", letterSpacing: -1.2 },
  bonus: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600", marginBottom: 4 },
  orderValue: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600", marginTop: 4 },
  orderValueStrong: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  timer: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timerText: { color: "#ffffff", fontWeight: "700", fontSize: 18, fontVariant: ["tabular-nums"] },
  queue: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tw.gray50, borderBottomWidth: 1, borderBottomColor: tw.gray100 },
  queueTitle: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: tw.gray400, marginBottom: 8 },
  queueRow: { gap: 8, paddingBottom: 4 },
  chip: { borderRadius: 16, padding: 12, borderWidth: 1, minWidth: 210, maxWidth: 260 },
  chipTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  chipLabel: { flexShrink: 1, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.8 },
  chipRight: { alignItems: "flex-end" },
  chipEarn: { fontSize: 14, fontWeight: "900" },
  chipPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chipPillText: { fontSize: 9, fontWeight: "700", lineHeight: 11 },
  chipLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  chipRest: { flexShrink: 1, fontSize: 11, fontWeight: "600" },
  chipSub: { fontSize: 10, opacity: 0.7 },
  chipAddr: { flexShrink: 1, fontSize: 11, fontWeight: "500", opacity: 0.9 },
  body: { padding: 16, paddingBottom: 24, gap: 20 },
  timeline: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", gap: 6, marginTop: 8, paddingVertical: 4 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 4 },
  railLine: { width: 2, height: 64, borderLeftWidth: 2, borderLeftColor: tw.gray100, borderStyle: "dashed" },
  stops: { flex: 1, gap: 20 },
  stopHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  stopTag: { flexDirection: "row", alignItems: "center", gap: 8 },
  stopTagText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  mapLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  stopName: { color: tw.gray950, fontWeight: "700", fontSize: 16, lineHeight: 20 },
  stopAddr: { color: tw.gray500, fontSize: 14, fontWeight: "500", lineHeight: 22, marginTop: 2 },
  payCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  payLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  payIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  flexShrink: { flexShrink: 1 },
  payRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  payPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  payPillText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  payStatus: { flexShrink: 1, fontSize: 12, fontWeight: "700", color: tw.gray900 },
  payNotice: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  billBox: { alignItems: "flex-end" },
  billLabel: { fontSize: 10, fontWeight: "700", color: tw.gray500, textTransform: "uppercase", letterSpacing: 0.5 },
  billValue: { fontSize: 16, fontWeight: "900", color: tw.gray950 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48.4%",
    flexGrow: 1,
    flexBasis: "45%",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tileLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  tileValue: { fontSize: 14, fontWeight: "700", color: tw.gray900 },
  totalTrip: { textAlign: "center", fontSize: 11, fontWeight: "600", color: tw.gray500, marginTop: -8 },
  actions: { gap: 16, paddingTop: 4 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8 },
  textBtn: { color: tw.gray400, fontWeight: "700", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
});
