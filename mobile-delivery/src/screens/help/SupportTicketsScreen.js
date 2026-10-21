// DeliveryV2/pages/help/SupportTicketsV2 (/help/tickets): "Raise New Ticket" and the rider's tickets
// (subject, #ticketId, description, status pill, category, date) -> /help/tickets/:id.
// The web remounts the page when coming back from create/view, so the list reloads on focus.
import { router, useFocusEffect } from "expo-router";
import dayjs from "dayjs";
import { ChevronRight, MessageSquare, Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { getSupportTickets } from "../../api";
import Spinner from "../../components/content/Spinner";
import { HelpHeader, listStatusColors } from "../../components/help/HelpParts";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, tw } from "../../theme/tokens";

const WIDEST_9 = 0.9;

function TicketCard({ ticket }) {
  const c = listStatusColors(ticket.status);
  const date = dayjs(ticket.createdAt);
  return (
    <Pressable
      onPress={() => router.push(`/help/tickets/${ticket._id}`)}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardMain}>
          <View style={styles.subjectRow}>
            <Text heading style={styles.subject} numberOfLines={1}>
              {ticket.subject}
            </Text>
            {ticket.ticketId ? (
              <View style={styles.idTag}>
                <Text style={styles.idTagText}>#{ticket.ticketId}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.desc} numberOfLines={1}>
            {ticket.description}
          </Text>
        </View>
        <ChevronRight size={20} color={tw.gray200} />
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.metaLeft}>
          <View style={[styles.status, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Text style={[styles.statusText, { color: c.text }]}>{ticket.status?.replace("_", " ")}</Text>
          </View>
          <Text style={styles.category}>{ticket.category}</Text>
        </View>
        <Text style={styles.date}>{date.isValid() ? date.format("D/M/YYYY") : "Invalid Date"}</Text>
      </View>
    </Pressable>
  );
}

export default function SupportTicketsScreen() {
  const goBack = useAppBack();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      getSupportTickets()
        .then((res) => {
          if (alive && res?.success) setTickets(res.data?.tickets || []);
        })
        .catch(() => {
          if (alive) toast.error("Failed to load tickets");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  const createButton = (
    <Pressable
      onPress={() => router.push("/help/tickets/create")}
      style={({ pressed }) => [styles.createBtn, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <Plus size={20} color="#ffffff" />
      <Text style={styles.createText}>Raise New Ticket</Text>
    </Pressable>
  );

  return (
    <Screen edges={[]} background="#ffffff">
      <HelpHeader title="Support Tickets" onBack={goBack} />
      <FlatList
        data={loading ? [] : tickets}
        keyExtractor={(item, idx) => String(item._id || idx)}
        renderItem={({ item }) => <TicketCard ticket={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={<View style={styles.headerGap}>{createButton}</View>}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loading}>
              <Spinner size={32} color={tw.gray200} />
              <Text style={styles.loadingText}>Syncing Tickets...</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MessageSquare size={40} color={tw.gray200} />
              </View>
              <Text heading style={styles.emptyTitle}>
                No Active Tickets
              </Text>
              <Text style={styles.emptySub}>Create a ticket if you need assistance</Text>
            </View>
          )
        }
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  list: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 80 },
  headerGap: { marginBottom: 24 },
  sep: { height: 16 },
  createBtn: {
    width: "100%",
    backgroundColor: "#000000",
    padding: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    ...brand.cardShadow,
  },
  createText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  loading: { paddingVertical: 80, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  empty: { paddingVertical: 96, alignItems: "center" },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tw.gray50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    color: tw.gray950,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    color: tw.gray400,
    textTransform: "uppercase",
    marginTop: 8,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: brand.dvBorder,
    borderRadius: 16,
    padding: 20,
    overflow: "hidden",
    ...brand.cardShadow,
  },
  // web mb-3 + mt-4 on block siblings collapse to 16
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardMain: { flex: 1, paddingRight: 16 },
  subjectRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  subject: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    color: tw.gray950,
    textTransform: "uppercase",
    letterSpacing: -0.35,
  },
  idTag: { backgroundColor: tw.gray100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  idTagText: { fontSize: 9, lineHeight: 13, fontFamily: "monospace", fontWeight: "700", color: brand.text },
  desc: { fontSize: 12, lineHeight: 16, fontWeight: "500", color: tw.gray500 },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: tw.gray50,
  },
  metaLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  status: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  statusText: { fontSize: 9, lineHeight: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: WIDEST_9 },
  category: { fontSize: 9, lineHeight: 13, fontWeight: "700", color: tw.gray400, textTransform: "uppercase", letterSpacing: WIDEST_9 },
  date: { fontSize: 9, lineHeight: 13, fontWeight: "700", color: tw.gray300 },
});
