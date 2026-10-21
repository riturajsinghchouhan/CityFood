// DeliveryHomeV2's inline drop panel (PICKED_UP) and the REACHED_DROP "VERIFY & COMPLETE" button.
// PICKED_UP: "Handover Drop" customer name/address, call + navigate (Google Maps, restaurant ->
// customer), items, time/distance tiles, drop message, "Slide to Arrive" (locked until within range),
// Mark as Delivered.
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle2, Clock, MapPin, Navigation, Package, Phone } from "lucide-react-native";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { ScalePressable } from "../ui/primitives";
import Text from "../ui/Text";
import ActionSlider from "./ActionSlider";
import { callPhone, openCustomerDropInMaps } from "./mapUtils";
import { GRADIENT_33DEG } from "./palette";
import { MarkDeliveredButton, MinimizeHandle } from "./tripParts";

export function DropCard({ order, isWithinRange, distanceToTarget, eta, onArrive, onMarkDelivered, onMinimize, maxHeight }) {
  const { colors } = useTheme();
  const phone = order?.userPhone || order?.deliveryAddress?.phone || order?.user?.phone;
  const items = Array.isArray(order?.items) ? order.items : [];
  const okColor = isWithinRange ? colors.primary : tw.gray900;
  return (
    <View style={[styles.card, { maxHeight: maxHeight || Dimensions.get("window").height * 0.75 }]}>
      <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
        <MinimizeHandle onPress={onMinimize} style={styles.handle} />
        <View style={styles.block}>
          <View style={styles.tag}>
            <MapPin size={16} color={colors.primary} />
            <Text style={[styles.tagText, { color: colors.primary }]}>Handover Drop</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.flexShrink}>
              <Text style={styles.name}>{order?.user?.name || order?.deliveryAddress?.name || "Customer"}</Text>
              <Text numberOfLines={2} style={styles.addr}>
                {order?.deliveryAddress?.address || order?.deliveryAddress?.street || "Customer Location"}
              </Text>
            </View>
            <View style={styles.btns}>
              {phone ? (
                <ScalePressable
                  scaleTo={0.95}
                  onPress={() => callPhone(phone)}
                  style={[styles.round, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder, borderWidth: 1 }]}
                >
                  <Phone size={16} color={colors.primary} fill={colors.primary} />
                </ScalePressable>
              ) : null}
              <ScalePressable
                scaleTo={0.95}
                onPress={() => openCustomerDropInMaps(order)}
                style={[styles.round, styles.navBtn]}
                accessibilityLabel="Navigate to customer"
              >
                <Navigation size={20} color="#ffffff" />
              </ScalePressable>
            </View>
          </View>

          {items.length > 0 ? (
            <View style={styles.itemsBox}>
              <Text style={styles.smallLabel}>Order Items</Text>
              <Text numberOfLines={2} style={styles.itemsText}>
                {items.map((item) => `${item.quantity}x ${item.menuItem?.name || item.name || "Item"}`).join(", ")}
              </Text>
            </View>
          ) : null}

          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Clock size={20} color={colors.primary} />
              <View>
                <Text style={styles.smallLabel}>Time</Text>
                <Text style={[styles.tileValue, { color: okColor }]}>{isWithinRange ? "Ready" : `${eta || "--"} MINS`}</Text>
              </View>
            </View>
            <View style={styles.tile}>
              <MapPin size={20} color={tw.gray400} />
              <View>
                <Text style={styles.smallLabel}>Distance</Text>
                <Text style={[styles.tileValue, { color: okColor }]}>
                  {isWithinRange ? "0 KM" : `${(distanceToTarget / 1000).toFixed(1)} KM`}
                </Text>
              </View>
            </View>
          </View>

          {order?.note ? (
            <View style={[styles.note, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}>
              <View style={[styles.noteIcon, { borderColor: colors.primarySoft }]}>
                <Package size={16} color={colors.primary} />
              </View>
              <View style={styles.flexShrink}>
                <Text style={[styles.noteLabel, { color: colors.primary }]}>Drop Message</Text>
                <Text style={styles.noteText}>&quot;{order.note}&quot;</Text>
              </View>
            </View>
          ) : null}
        </View>
        <ActionSlider
          label="Slide to Arrive"
          successLabel="Arrived ✓"
          disabled={!isWithinRange}
          onConfirm={onArrive}
          color={colors.primary}
        />
        <View style={styles.markWrap}>
          <MarkDeliveredButton onPress={() => onMarkDelivered?.(order)} />
        </View>
      </ScrollView>
    </View>
  );
}

export function VerifyCompleteButton({ onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.verifyWrap, pressed && { transform: [{ scale: 0.95 }] }]}>
      <LinearGradient colors={["#15498b", "#000000"]} {...GRADIENT_33DEG} style={styles.verify}>
        <CheckCircle2 size={24} color="#ffffff" />
        <Text style={styles.verifyText}>VERIFY & COMPLETE</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 48,
    borderWidth: 1,
    borderColor: tw.gray100,
    overflow: "hidden",
    boxShadow: "0px -20px 80px rgba(0,0,0,0.4)",
  },
  cardContent: { padding: 32, alignItems: "center" },
  handle: { paddingBottom: 16, marginTop: -8 },
  block: { width: "100%", marginBottom: 32, paddingHorizontal: 8 },
  tag: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  tagText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  flexShrink: { flexShrink: 1 },
  name: { color: tw.gray950, fontWeight: "700", fontSize: 16, lineHeight: 20 },
  addr: { color: tw.gray500, fontSize: 14, fontWeight: "500", lineHeight: 22, marginTop: 4 },
  btns: { flexDirection: "row", gap: 8, marginTop: 4 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  navBtn: { backgroundColor: tw.gray900, boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)" },
  itemsBox: { marginTop: 16, padding: 12, backgroundColor: tw.gray50, borderRadius: 12, borderWidth: 1, borderColor: tw.gray100 },
  smallLabel: { fontSize: 10, color: tw.gray400, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  itemsText: { fontSize: 14, fontWeight: "700", color: tw.gray800, lineHeight: 18, marginTop: 4 },
  tiles: { flexDirection: "row", gap: 10, marginTop: 16 },
  tile: {
    flex: 1,
    padding: 12,
    backgroundColor: tw.gray50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tw.gray100,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tileValue: { fontSize: 14, fontWeight: "700" },
  note: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  noteIcon: {
    width: 32,
    height: 32,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  noteLabel: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4, opacity: 0.8 },
  noteText: { fontSize: 14, fontWeight: "700", color: tw.gray950, lineHeight: 22, textTransform: "capitalize" },
  markWrap: { width: "100%", paddingTop: 12 },
  verifyWrap: { borderRadius: 16, boxShadow: "0px 14px 34px rgba(21,73,139,0.42)" },
  verify: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  verifyText: { color: "#ffffff", fontWeight: "700", fontSize: 12, letterSpacing: 12 * 0.14 },
});
