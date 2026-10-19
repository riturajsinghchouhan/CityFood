// Port of pages/restaurant/RestaurantSupport.jsx (/help-centre/support): ticket stats, the
// raise-ticket form and the restaurant's tickets with a status filter. Phone layout (the
// md:max-w-4xl frame is desktop only); the ticket list is the FlatList body, inside the
// "My tickets" card.
import dayjs from "dayjs";
import { ChevronLeft, Send } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from "react-native";
import { createSupportTicket, getSupportTickets } from "../../api";
import { SelectField } from "../../components/menu/common";
import { pal } from "../../components/menu/palette";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { Text, toast } from "../../components/ui";
import { useScopedFont } from "../../components/ui/Text";
import { withProtected } from "../../navigation/Protected";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";

const CATEGORY_OPTIONS = [
  { value: "orders", label: "Orders" },
  { value: "payments", label: "Payments" },
  { value: "menu", label: "Menu" },
  { value: "restaurant", label: "Restaurant Profile" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const c = {
  ...pal,
  emerald100: "#d0fae5",
  emerald800: "#006045",
  blue200: "#bedbff",
  blue800: "#193cb8",
  amber800: "#973c00",
};

const getStatusStyle = (status) => {
  if (status === "resolved") return { bg: c.emerald100, fg: c.emerald700, border: c.emerald200 };
  if (status === "in-progress") return { bg: c.blue100, fg: c.blue700, border: c.blue200 };
  return { bg: c.amber100, fg: c.amber700, border: c.amber200 };
};

const EMPTY_FORM = {
  category: "orders",
  issueType: "",
  subject: "",
  orderRef: "",
  priority: "medium",
  description: "",
};

function TicketRow({ ticket, isLast }) {
  const st = getStatusStyle(ticket.status);
  return (
    <View style={[styles.cardMiddle, isLast ? styles.cardBottom : null]}>
      <View style={styles.ticket}>
        <View style={styles.ticketTop}>
          <Text style={styles.ticketMeta}>
            #{String(ticket._id).slice(-6)} • {dayjs(ticket.createdAt).format("M/D/YYYY, h:mm:ss A")}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: st.bg, borderColor: st.border }]}>
            <Text style={[styles.statusText, { color: st.fg }]}>
              {String(ticket.status || "").replace(/(^|\s)\S/g, (m) => m.toUpperCase())}
            </Text>
          </View>
        </View>
        <Text style={styles.ticketIssue}>{ticket.issueType}</Text>
        {ticket.subject ? <Text style={styles.ticketLine}>Subject: {ticket.subject}</Text> : null}
        {ticket.orderRef ? <Text style={styles.ticketLine}>Order: {ticket.orderRef}</Text> : null}
        {ticket.description ? <Text style={styles.ticketDesc}>{ticket.description}</Text> : null}
        {ticket.adminResponse ? (
          <View style={styles.adminBox}>
            <Text style={styles.adminLabel}>ADMIN RESPONSE</Text>
            <Text style={styles.adminText}>{ticket.adminResponse}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function RestaurantSupportScreen() {
  const { colors } = useTheme();
  const goBack = useAppBack();
  const bottomInset = useShellBottomInset();
  const inputFont = useScopedFont("400");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === "open").length;
    const inProgress = tickets.filter((t) => t.status === "in-progress").length;
    const resolved = tickets.filter((t) => t.status === "resolved").length;
    return { total, open, inProgress, resolved };
  }, [tickets]);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getSupportTickets({ status: statusFilter || undefined, limit: 100, page: 1 });
      setTickets(response?.data?.tickets || []);
    } catch (error) {
      toast.error(error?.data?.message || "Failed to load support tickets");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.issueType.trim()) {
      toast.error("Issue type is required");
      return;
    }
    try {
      setSubmitting(true);
      await createSupportTicket({
        category: form.category,
        issueType: form.issueType.trim(),
        subject: form.subject.trim(),
        orderRef: form.orderRef.trim(),
        priority: form.priority,
        description: form.description.trim(),
      });
      toast.success("Support ticket submitted");
      setForm((prev) => ({ ...prev, issueType: "", subject: "", orderRef: "", description: "" }));
      await loadTickets();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to submit support ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const header = (
    <View style={styles.headerContent}>
      <View style={styles.statsGrid}>
        <View style={[styles.statTile, { borderColor: c.slate200, backgroundColor: "#ffffff" }]}>
          <Text style={[styles.statLabel, { color: c.slate500 }]}>Total</Text>
          <Text style={[styles.statValue, { color: c.slate900 }]}>{stats.total}</Text>
        </View>
        <View style={[styles.statTile, { borderColor: c.amber200, backgroundColor: c.amber50 }]}>
          <Text style={[styles.statLabel, { color: c.amber700 }]}>Open</Text>
          <Text style={[styles.statValue, { color: c.amber800 }]}>{stats.open}</Text>
        </View>
        <View style={[styles.statTile, { borderColor: c.blue200, backgroundColor: c.blue50 }]}>
          <Text style={[styles.statLabel, { color: c.blue700 }]}>In progress</Text>
          <Text style={[styles.statValue, { color: c.blue800 }]}>{stats.inProgress}</Text>
        </View>
        <View style={[styles.statTile, { borderColor: c.emerald200, backgroundColor: c.emerald50 }]}>
          <Text style={[styles.statLabel, { color: c.emerald700 }]}>Resolved</Text>
          <Text style={[styles.statValue, { color: c.emerald800 }]}>{stats.resolved}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Raise support ticket</Text>
        <SelectField
          value={form.category}
          options={CATEGORY_OPTIONS}
          onChange={setField("category")}
          style={styles.select}
          textStyle={styles.selectText}
          iconColor={c.slate500}
        />
        <SelectField
          value={form.priority}
          options={PRIORITY_OPTIONS}
          onChange={setField("priority")}
          style={styles.select}
          textStyle={styles.selectText}
          iconColor={c.slate500}
        />
        <TextInput
          value={form.issueType}
          onChangeText={setField("issueType")}
          placeholder="Issue type (required)"
          placeholderTextColor={c.gray400}
          maxLength={120}
          style={[styles.input, inputFont]}
        />
        <TextInput
          value={form.subject}
          onChangeText={setField("subject")}
          placeholder="Short subject"
          placeholderTextColor={c.gray400}
          maxLength={180}
          style={[styles.input, inputFont]}
        />
        <TextInput
          value={form.orderRef}
          onChangeText={setField("orderRef")}
          placeholder="Order ID (optional)"
          placeholderTextColor={c.gray400}
          maxLength={80}
          style={[styles.input, inputFont]}
        />
        <TextInput
          value={form.description}
          onChangeText={setField("description")}
          placeholder="Describe your issue"
          placeholderTextColor={c.gray400}
          maxLength={1000}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.textarea, inputFont]}
        />
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
        >
          {submitting ? <ActivityIndicator size={16} color="#ffffff" /> : <Send size={16} color="#ffffff" />}
          <Text style={styles.submitText}>Submit Ticket</Text>
        </Pressable>
      </View>

      <View style={[styles.cardTop, !loading && tickets.length > 0 ? null : styles.cardTopOnly]}>
        <View style={styles.ticketsHeader}>
          <Text style={styles.cardTitle}>My tickets</Text>
          <SelectField
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
            style={styles.filterSelect}
            textStyle={styles.filterText}
            iconColor={c.slate500}
          />
        </View>
        {loading ? (
          <View style={styles.stateRow}>
            <ActivityIndicator size={16} color={c.slate500} />
            <Text style={styles.stateText}>Loading tickets...</Text>
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.stateRow}>
            <Text style={styles.stateText}>No support tickets found.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.page}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: c.slate100 }]}
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={c.slate900} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Support</Text>
          <Text style={styles.headerSub}>Raise issue and track admin response</Text>
        </View>
      </View>
      <FlatList
        data={loading ? [] : tickets}
        keyExtractor={(t) => String(t._id)}
        renderItem={({ item, index }) => <TicketRow ticket={item} isLast={index === tickets.length - 1} />}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: 112 + bottomInset }]}
      />
    </KeyboardAvoidingView>
  );
}

export default withProtected(RestaurantSupportScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.slate50 },
  header: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: c.slate200,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: { padding: 4, borderRadius: 9999 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: c.slate900 },
  headerSub: { fontSize: 12, color: c.slate500 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  headerContent: { gap: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statTile: { flexGrow: 1, flexBasis: "45%", borderRadius: 12, borderWidth: 1, padding: 12 },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 18, fontWeight: "700" },
  formCard: { backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: c.slate200, padding: 16, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: c.slate900 },
  select: { borderColor: c.slate300, paddingHorizontal: 12, paddingVertical: 8 },
  selectText: { fontSize: 14, color: c.slate900 },
  input: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.slate300,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: c.slate900,
  },
  textarea: { minHeight: 96 },
  submitBtn: { width: "100%", borderRadius: 8, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  cardTop: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.slate200,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cardTopOnly: { borderBottomWidth: 1, borderRadius: 16, paddingBottom: 16 },
  ticketsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  filterSelect: { borderColor: c.slate300, paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  filterText: { flex: 0, fontSize: 12, color: c.slate900, marginRight: 4 },
  stateRow: { paddingVertical: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  stateText: { fontSize: 14, color: c.slate500, textAlign: "center" },
  cardMiddle: {
    backgroundColor: "#ffffff",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: c.slate200,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  cardBottom: { borderBottomWidth: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingBottom: 16 },
  ticket: { borderRadius: 12, borderWidth: 1, borderColor: c.slate200, padding: 12 },
  ticketTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ticketMeta: { flexShrink: 1, fontSize: 12, fontWeight: "600", color: c.slate500 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "600" },
  ticketIssue: { marginTop: 8, fontSize: 14, fontWeight: "600", color: c.slate900 },
  ticketLine: { fontSize: 12, color: c.slate600, marginTop: 4 },
  ticketDesc: { fontSize: 14, color: c.slate700, marginTop: 8 },
  adminBox: { marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: c.blue200, backgroundColor: c.blue50, padding: 10 },
  adminLabel: { fontSize: 11, fontWeight: "600", color: c.blue700 },
  adminText: { fontSize: 14, color: c.blue900, marginTop: 4 },
});
