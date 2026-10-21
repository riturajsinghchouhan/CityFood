// DeliveryV2/pages/OrdersV2 (/orders tab): "New offers" (Pass / Accept, limited by the order capacity)
// and "Accepted orders" (tap to open on the feed, "Mark Delivered" = verification with the OTP step
// skipped). State comes from DeliveryContext; the handlers are DeliveryHomeV2's (useShellActions).
import { CheckCircle2, Clock3, Package, X } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, SectionList, StyleSheet, View } from "react-native";
import OrderInfo from "../../components/orders/OrderInfo";
import { dvCard } from "../../components/pocket/common";
import useShellActions from "../../components/shell/useShellActions";
import { Screen, Text } from "../../components/ui";
import { useDelivery } from "../../context/DeliveryContext";
import { getOrderAcceptId, getOrderMongoId } from "../../lib/delivery/orders";
import { brand, dvColor, light, tw } from "../../theme/tokens";

const orderKey = (order, index) => String(getOrderMongoId(order) || getOrderAcceptId(order) || index);

function OfferCard({ order, canAccept, onAccept, onPass }) {
  return (
    <View style={[styles.card, dvCard]}>
      <OrderInfo order={order} />
      <View style={styles.offerActions}>
        <Pressable onPress={() => onPass(order)} style={({ pressed }) => [styles.passBtn, pressed && { opacity: 0.8 }]}>
          <X size={16} color={tw.gray700} />
          <Text style={styles.passText}>Pass</Text>
        </Pressable>
        <Pressable
          disabled={!canAccept}
          onPress={() => onAccept(order)}
          style={({ pressed }) => [
            styles.acceptBtn,
            { backgroundColor: canAccept ? tw.gray950 : tw.gray300 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <CheckCircle2 size={16} color="#ffffff" />
          <Text style={styles.acceptText}>{canAccept ? "Accept" : "Limit reached"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AcceptedCard({ order, onOpen, onMarkDelivered }) {
  return (
    <Pressable
      onPress={() => onOpen(order)}
      style={({ pressed }) => [styles.card, dvCard, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      <OrderInfo order={order} />
      <View style={styles.acceptedFoot}>
        <View style={styles.statusPill}>
          <Text style={styles.statusText} numberOfLines={1}>
            {String(order?.orderStatus || "accepted").replaceAll("_", " ").toUpperCase()}
          </Text>
        </View>
        <View style={styles.footRight}>
          <Pressable
            onPress={() => onMarkDelivered(order)}
            style={({ pressed }) => [styles.deliveredBtn, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            <CheckCircle2 size={14} color="#ffffff" />
            <Text style={styles.deliveredText}>MARK DELIVERED</Text>
          </Pressable>
          <Text style={styles.openText}>Open →</Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyCard({ text }) {
  return (
    <View style={[styles.empty, brand.cardShadow]}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export default function OrdersScreen() {
  const { incomingOrders = [], acceptedOrders = [], orderCapacity = {} } = useDelivery();
  const { acceptOrder, passOrder, openOrder, markDelivered } = useShellActions();

  const capacity = orderCapacity || {};
  const limit = Number(capacity.effectiveLimit || 1);
  const activeCount = Number(capacity.activeOrderCount ?? acceptedOrders.length);
  const canAccept = capacity.canAcceptMore !== false && activeCount < limit;

  const sections = useMemo(
    () => [
      { key: "offers", title: "New offers", icon: Clock3, iconColor: dvColor("text-orange-500", light), empty: "No new offers right now.", data: incomingOrders },
      {
        key: "accepted",
        title: "Accepted orders",
        icon: Package,
        iconColor: dvColor("text-green-600", light),
        empty: "No active deliveries.",
        data: acceptedOrders,
      },
    ],
    [acceptedOrders, incomingOrders],
  );

  // The context's accept rejects on failure (it already toasts); nothing more to do here.
  const handleAccept = (order) => {
    Promise.resolve(acceptOrder(order)).catch(() => {});
  };

  return (
    <Screen edges={["top"]} background={tw.gray50}>
      <SectionList
        sections={sections}
        keyExtractor={orderKey}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Orders</Text>
              <Text style={styles.subtitle}>Manage offers and active deliveries</Text>
            </View>
            <View style={styles.countPill}>
              <Text style={styles.countText}>
                {activeCount} / {limit} active
              </Text>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const Icon = section.icon;
          return (
            <View style={[styles.sectionHead, section.key === "accepted" && { marginTop: 28 }]}>
              <Icon size={20} color={section.iconColor} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          );
        }}
        renderSectionFooter={({ section }) => (section.data.length === 0 ? <EmptyCard text={section.empty} /> : null)}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item, section }) =>
          section.key === "offers" ? (
            <OfferCard order={item} canAccept={canAccept} onAccept={handleAccept} onPass={passOrder} />
          ) : (
            <AcceptedCard order={item} onOpen={openOrder} onMarkDelivered={markDelivered} />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  titleRow: { marginBottom: 20, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "900", color: tw.gray950 },
  subtitle: { marginTop: 4, fontSize: 14, fontWeight: "500", color: tw.gray500 },
  countPill: { borderRadius: 999, backgroundColor: tw.gray950, paddingHorizontal: 12, paddingVertical: 6 },
  countText: { fontSize: 12, fontWeight: "700", color: "#ffffff" },
  sectionHead: { marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontWeight: "900", color: tw.gray900, fontSize: 16 },
  card: { borderRadius: 16, borderWidth: 1, backgroundColor: "#ffffff", padding: 16 },
  offerActions: { marginTop: 16, flexDirection: "row", gap: 12 },
  passBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tw.gray300,
    paddingVertical: 12,
  },
  passText: { fontSize: 14, fontWeight: "700", color: tw.gray700 },
  acceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
  },
  acceptText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  acceptedFoot: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: tw.gray100,
    paddingTop: 12,
    gap: 8,
  },
  statusPill: {
    flexShrink: 1,
    borderRadius: 999,
    backgroundColor: dvColor("bg-green-50", light),
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: "900", color: tw.green700 },
  footRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  deliveredBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: dvColor("bg-emerald-600", light),
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  deliveredText: { color: "#ffffff", fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  openText: { fontSize: 12, fontWeight: "900", color: tw.gray900 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: brand.dvBorder,
    backgroundColor: "#ffffff",
    padding: 18,
    alignItems: "center",
  },
  emptyText: { fontSize: 14, color: tw.gray500, textAlign: "center" },
});
