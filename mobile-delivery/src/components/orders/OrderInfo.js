// OrdersV2 OrderInfo: order id + payment badge + distance, restaurant name, rider pay, the pickup/drop
// box with "Map" links, and the bill / payment strip. Shared by the offer and accepted-order cards.
import { Banknote, CreditCard, ExternalLink, MapPin, Store } from "lucide-react-native";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Text from "../ui/Text";
import { twx } from "../pocket/common";
import { getCustomerDisplayInfo, getOrderPaymentInfo, getRestaurantDisplayInfo } from "../../lib/delivery/orderLocation";
import { getOrderAcceptId } from "../../lib/delivery/orders";
import { dvColor, light, tw } from "../../theme/tokens";

const PRIMARY = dvColor("text-blue-600", light);

const money = (value) => `₹${Number(value || 0).toFixed(0)}`;

export const displayOrderId = (order) => order?.order_id || order?.displayOrderId || getOrderAcceptId(order) || "Order";

function MapLink({ url }) {
  if (!url) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      hitSlop={8}
      style={({ pressed }) => [styles.mapLink, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <Text style={styles.mapText}>Map</Text>
      <ExternalLink size={10} color={PRIMARY} />
    </Pressable>
  );
}

function Stop({ icon: Icon, bubbleBg, label, info }) {
  return (
    <View style={styles.stop}>
      <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
        <Icon size={12} color={PRIMARY} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.stopHead}>
          <Text style={styles.stopLabel}>{label}</Text>
          <MapLink url={info.mapsUrl} />
        </View>
        <Text style={styles.stopName} numberOfLines={1}>
          {info.name}
        </Text>
        <Text style={styles.stopAddress} numberOfLines={2}>
          {info.address}
        </Text>
      </View>
    </View>
  );
}

export default function OrderInfo({ order }) {
  const amount =
    order?.earnings ||
    order?.riderEarning ||
    order?.deliveryEarning ||
    order?.deliveryFee ||
    order?.pricing?.deliveryFee ||
    order?.pricing?.total;
  const restaurantInfo = getRestaurantDisplayInfo(order);
  const customerInfo = getCustomerDisplayInfo(order);
  const paymentInfo = getOrderPaymentInfo(order);
  const distanceKm = order?.pickupDistanceKm ?? order?.distanceKm ?? order?.dropDistanceKm ?? order?.deliveryDistanceKm;
  const cod = paymentInfo.isCod;

  return (
    <>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <View style={styles.idRow}>
            <Text style={styles.orderId}>{String(displayOrderId(order)).toUpperCase()}</Text>
            <View
              style={[
                styles.payBadge,
                cod
                  ? { backgroundColor: twx.amber100, borderColor: twx.amber200 }
                  : { backgroundColor: twx.emerald100, borderColor: dvColor("border-emerald-200", light) },
              ]}
            >
              <Text style={[styles.payBadgeText, { color: cod ? twx.amber800 : twx.emerald800 }]}>
                {String(paymentInfo.paymentLabel).toUpperCase()}
              </Text>
            </View>
            {distanceKm != null && Number.isFinite(Number(distanceKm)) && (
              <View style={styles.kmChip}>
                <Text style={styles.kmText}>{Number(distanceKm).toFixed(1)} km</Text>
              </View>
            )}
          </View>
          <Text style={styles.restaurant}>{restaurantInfo.name}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={styles.payPill}>
            <Text style={styles.payPillText}>{money(amount)}</Text>
          </View>
          <Text style={styles.payCaption}>Rider Pay</Text>
        </View>
      </View>

      <View style={styles.box}>
        <Stop icon={Store} bubbleBg={tw.orange100} label="PICKUP LOCATION" info={restaurantInfo} />
        <View style={styles.dashedClip}>
          <View style={styles.dashed} />
        </View>
        <Stop icon={MapPin} bubbleBg={twx.blue100} label="CUSTOMER DROP" info={customerInfo} />
      </View>

      <View
        style={[
          styles.strip,
          cod
            ? { backgroundColor: "rgba(255,251,235,0.7)", borderColor: "rgba(254,230,133,0.8)" }
            : { backgroundColor: "rgba(236,253,245,0.7)", borderColor: "rgba(164,244,207,0.8)" },
        ]}
      >
        <View style={styles.stripLeft}>
          {cod ? (
            <Banknote size={16} color={twx.amber600} />
          ) : (
            <CreditCard size={16} color={dvColor("text-emerald-600", light)} />
          )}
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.stripTitle, { color: cod ? twx.amber900 : twx.emerald900 }]} numberOfLines={1}>
              {cod ? `Cash to Collect: ₹${paymentInfo.totalAmount.toFixed(2)}` : "Pre-paid Online (Collect ₹0)"}
            </Text>
            <Text style={[styles.stripNotice, { color: cod ? twx.amber900 : twx.emerald900 }]} numberOfLines={1}>
              {paymentInfo.collectionNotice}
            </Text>
          </View>
        </View>
        <View style={styles.stripRight}>
          <Text style={styles.billLabel}>TOTAL BILL</Text>
          <Text style={styles.billValue}>₹{paymentInfo.totalAmount.toFixed(2)}</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  idRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  orderId: { fontSize: 11, fontWeight: "700", letterSpacing: 0.55, color: tw.gray400 },
  payBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  payBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.45 },
  kmChip: { borderRadius: 6, backgroundColor: tw.gray100, paddingHorizontal: 6, paddingVertical: 2 },
  kmText: { fontSize: 10, fontWeight: "700", color: tw.gray600 },
  restaurant: { marginTop: 2, fontSize: 16, fontWeight: "900", color: tw.gray950 },
  payPill: {
    borderRadius: 14,
    backgroundColor: dvColor("bg-green-50", light),
    borderWidth: 1,
    borderColor: dvColor("border-green-100", light),
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  payPillText: { fontSize: 14, fontWeight: "900", color: tw.green700 },
  payCaption: { fontSize: 10, fontWeight: "600", color: tw.gray400, marginTop: 2 },
  box: {
    marginTop: 14,
    gap: 10,
    borderRadius: 14,
    backgroundColor: "rgba(249,250,251,0.8)",
    padding: 12,
    borderWidth: 1,
    borderColor: tw.gray100,
  },
  stop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bubble: { marginTop: 2, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stopHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stopLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, color: PRIMARY },
  mapLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  mapText: { fontSize: 10, fontWeight: "700", color: PRIMARY },
  stopName: { marginTop: 2, fontSize: 12, fontWeight: "600", color: tw.gray800 },
  stopAddress: { fontSize: 11, color: tw.gray500, lineHeight: 17.9 },
  // A one-sided dashed border renders solid on Android: clip the top edge of a dashed box.
  dashedClip: { height: 1, overflow: "hidden", marginLeft: 28 },
  dashed: { height: 4, borderWidth: 1, borderStyle: "dashed", borderColor: tw.gray200 },
  strip: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  stripLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 },
  stripTitle: { fontSize: 12, fontWeight: "700" },
  stripNotice: { fontSize: 10, opacity: 0.8 },
  stripRight: { alignItems: "flex-end", marginLeft: 8 },
  billLabel: { fontSize: 10, fontWeight: "700", color: tw.gray400 },
  billValue: { fontSize: 14, fontWeight: "900", color: tw.gray950 },
});
