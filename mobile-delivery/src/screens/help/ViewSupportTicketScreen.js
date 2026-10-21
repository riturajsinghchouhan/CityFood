// DeliveryV2/pages/help/ViewSupportTicketV2 (/help/tickets/:ticketId): ID reference + status,
// subject and description, the support response (or the "currently reviewing" note) and the footer.
// Like the web, the loading and "Ticket Not Found" states have no header (Android back still works).
import { useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import { Mail, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { getSupportTicketById } from "../../api";
import Spinner from "../../components/content/Spinner";
import { HelpHeader, detailStatusColors } from "../../components/help/HelpParts";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, dvColor, light, tw } from "../../theme/tokens";

export default function ViewSupportTicketScreen() {
  const goBack = useAppBack();
  const { ticketId } = useLocalSearchParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await getSupportTicketById(ticketId);
        if (alive && res?.success) setTicket(res?.data?.ticket || res?.data || res?.ticket || null);
      } catch {
        if (alive) toast.error("Failed to load ticket details");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ticketId]);

  if (loading) {
    return (
      <Screen background="#ffffff">
        <View style={styles.center}>
          <Spinner size={32} color={brand.primary} />
        </View>
      </Screen>
    );
  }

  if (!ticket) {
    return (
      <Screen background="#ffffff">
        <Text style={styles.notFound}>Ticket Not Found</Text>
      </Screen>
    );
  }

  const c = detailStatusColors(ticket.status);
  const respondedAt = ticket.respondedAt ? dayjs(ticket.respondedAt) : null;

  return (
    <Screen edges={[]} background={tw.gray50}>
      <HelpHeader title="Ticket Info" onBack={goBack} uppercase />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, styles.idCard]}>
          <View style={styles.flexShrink}>
            <Text style={styles.label}>ID Reference</Text>
            <Text heading style={styles.idText}>
              #{ticket.ticketId || "Pending"}
            </Text>
          </View>
          <View style={[styles.status, { backgroundColor: c.bg }]}>
            <Text style={[styles.statusText, { color: c.text }]}>{ticket.status}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.card3xl]}>
          <View style={styles.block}>
            <Text style={styles.label}>Subject</Text>
            <Text heading style={styles.subject}>
              {ticket.subject}
            </Text>
          </View>
          <View style={[styles.block, styles.descBlock]}>
            <Text style={styles.label}>Detail Description</Text>
            <Text style={styles.desc}>{ticket.description}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.card3xl, styles.response]}>
          <View style={styles.responseIcon}>
            <ShieldCheck size={20} color={brand.primary} />
          </View>
          <View style={styles.responseBody}>
            <Text style={styles.label}>Support Response</Text>
            <Text style={styles.responseText}>
              {ticket.adminResponse ||
                "Our support team is currently reviewing your ticket. You'll receive a notification once there is an update."}
            </Text>
            {respondedAt ? (
              <Text style={styles.updated}>
                Updated {respondedAt.isValid() ? respondedAt.format("D/M/YYYY, h:mm:ss a") : "Invalid Date"}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          <Mail size={48} color={brand.text} />
          <Text style={styles.footerText}>CityFood Support Fleet</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const LABEL = {
  fontSize: 10,
  lineHeight: 15,
  fontWeight: "900",
  color: tw.gray400,
  textTransform: "uppercase",
  letterSpacing: 1,
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  flexShrink: { flexShrink: 1 },
  notFound: {
    padding: 80,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  scroll: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 80, gap: 24 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: brand.dvBorder,
    ...brand.cardShadow,
  },
  card3xl: { borderRadius: 24 },
  idCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: LABEL,
  idText: { fontSize: 18, lineHeight: 28, fontWeight: "900", color: tw.gray950, marginTop: 4 },
  status: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14 },
  statusText: { ...LABEL, color: undefined },
  block: { gap: 4 },
  subject: { fontSize: 14, lineHeight: 20, fontWeight: "900", color: tw.gray950 },
  descBlock: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: tw.gray50 },
  desc: { fontSize: 12, lineHeight: 19.5, fontWeight: "500", color: tw.gray600 },
  response: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    borderColor: dvColor("border-orange-100", light),
  },
  responseIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    ...brand.cardShadow,
  },
  responseBody: { flex: 1, gap: 8 },
  responseText: { fontSize: 12, lineHeight: 19.5, fontWeight: "700", color: brand.primary, fontStyle: "italic" },
  updated: { ...LABEL, fontWeight: "700" },
  footer: { marginTop: 40, alignItems: "center", justifyContent: "center", gap: 16, opacity: 0.2 },
  footerText: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
    color: brand.text,
    textTransform: "uppercase",
    letterSpacing: 4,
    textAlign: "center",
  },
});
