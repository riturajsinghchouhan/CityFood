// Port of pages/user/profile/Support.jsx: support ticket wizard (order / restaurant / other) and "My Tickets".
import { ArrowLeft, Building2, ChevronRight, HelpCircle, ShoppingBag } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createTicket, getCurrentUser, getMyTickets, getOrders, getRestaurants } from "../../api";
import FadeIn from "../../components/support/FadeIn";
import { c, webVars } from "../../components/support/palette";
import { CardBottom, CardMiddle, CardTop } from "../../components/support/SplitCard";
import { Button, Card, Input, inputFont, Screen, Text, toast } from "../../components/ui";
import { goTo, useBackOverride } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";

const orderIssues = ["Item missing", "Wrong item", "Not delivered", "Payment issue"];
const restaurantIssues = ["Bad service", "Wrong info", "Other"];

const restaurantNameOf = (order) =>
  order?.restaurantId?.restaurantName ||
  order?.restaurantId?.name ||
  order?.restaurantName ||
  order?.restaurant?.restaurantName ||
  "";

function getOrderLabel(order) {
  const restaurantName = restaurantNameOf(order) || "Restaurant";
  const dateValue = order?.createdAt || order?.date;
  const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString() : "No date";
  const amount = order?.pricing?.total ?? order?.total ?? 0;
  const itemNames = (order?.items || [])
    .map((i) => i?.name || i?.foodName)
    .filter(Boolean)
    .join(", ");
  const itemString = itemNames ? ` • ${itemNames}` : "";
  return `${restaurantName}${itemString} • ${dateLabel} • ₹${amount}`;
}

function getRestaurantLabel(restaurant) {
  const name = restaurant?.restaurantName || restaurant?.name || "Restaurant";
  const location = restaurant?.city || restaurant?.area || "";
  return `${name}${location ? ` • ${location}` : ""}`;
}

function statusColors(status) {
  const s = String(status || "").toLowerCase();
  if (s === "resolved" || s === "closed") return { bg: c.green100, fg: c.green700 };
  if (s === "open") return { bg: c.amber100, fg: c.amber700 };
  return { bg: c.slate100, fg: c.slate700 };
}

export default function SupportScreen() {
  const { isDark } = useTheme();
  const v = webVars(isDark);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState("pick");
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [issueType, setIssueType] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [orderSearch, setOrderSearch] = useState("");
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [focusedList, setFocusedList] = useState(null);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .catch(() => null)
      .finally(async () => {
        try {
          const res = await getMyTickets();
          const list = res?.data?.tickets || res?.tickets || [];
          if (active) setTickets(list);
        } catch {}
        if (active) setLoadingTickets(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // The header arrow returns to the first step; hardware back does the same while inside the wizard.
  useBackOverride(() => {
    if (step === "pick") return false;
    setStep("pick");
    return true;
  });

  const fetchOrders = async () => {
    try {
      const res = await getOrders({ limit: 10, page: 1 });
      setOrders(res?.data?.orders || res?.orders || []);
    } catch {
      toast.error("Failed to load orders");
    }
  };

  const fetchRestaurants = async () => {
    try {
      const res = await getRestaurants({ limit: 20, page: 1 });
      setRestaurants(res?.data?.restaurants || res?.restaurants || []);
    } catch {
      toast.error("Failed to load restaurants");
    }
  };

  const handlePick = (t) => {
    setOrderSearch("");
    setRestaurantSearch("");
    if (t === "order") {
      fetchOrders();
      setStep("choose_order");
    } else if (t === "restaurant") {
      fetchRestaurants();
      setStep("choose_restaurant");
    } else {
      setStep("other_form");
    }
  };

  const submitTicket = async (payload) => {
    setSubmitting(true);
    try {
      const res = await createTicket(payload);
      if (!res?.success) throw new Error(res?.message || "Failed");
      toast.success("Ticket created");
      const ticket = res?.data?.ticket;
      if (ticket) setTickets((prev) => [ticket, ...prev]);
      setStep("pick");
      setSelectedOrder(null);
      setSelectedRestaurant(null);
      setIssueType("");
      setSubject("");
      setDescription("");
    } catch (e) {
      toast.error(e?.message || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    const restaurantName = restaurantNameOf(order).toLowerCase();
    const orderId = String(order?._id || order?.id || "").toLowerCase();
    const itemsString = (order?.items || [])
      .map((i) => i?.name || i?.foodName)
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return restaurantName.includes(q) || orderId.includes(q) || itemsString.includes(q);
  });

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const q = restaurantSearch.trim().toLowerCase();
    if (!q) return true;
    const name = String(restaurant?.restaurantName || restaurant?.name || "").toLowerCase();
    const city = String(restaurant?.city || restaurant?.area || "").toLowerCase();
    const id = String(restaurant?._id || restaurant?.id || "").toLowerCase();
    return name.includes(q) || city.includes(q) || id.includes(q);
  });

  const handleOrderSearchChange = (value) => {
    setOrderSearch(value);
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    const selected = filteredOrders.find((o) => getOrderLabel(o).toLowerCase() === normalized);
    if (selected) {
      setSelectedOrder(selected);
      setStep("order_issue");
    }
  };

  const handleRestaurantSearchChange = (value) => {
    setRestaurantSearch(value);
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    const selected = filteredRestaurants.find((r) => getRestaurantLabel(r).toLowerCase() === normalized);
    if (selected) {
      setSelectedRestaurant(selected);
      setStep("restaurant_issue");
    }
  };

  const cardBg = isDark ? "#1a1a1a" : "#ffffff";
  const cardBorder = isDark ? c.gray800 : c.slate200;
  const strong = isDark ? "#ffffff" : c.slate900;
  const innerBorder = isDark ? c.slate700 : c.slate200;
  const outlineBg = !isDark && { backgroundColor: v.background };
  const outlineText = { color: v.foreground };

  const textArea = (placeholder, value, onChange) => (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={v.mutedForeground}
      value={value}
      onChangeText={onChange}
      multiline
      textAlignVertical="top"
      style={[
        styles.textarea,
        { borderColor: isDark ? "#27272A" : c.slate200, backgroundColor: v.inputBg, color: v.foreground },
      ]}
    />
  );

  // <input list> + <datalist>: matching options shown under the field while it is focused.
  const datalist = (key, items, labelOf, onChoose) =>
    focusedList === key && items.length > 0 ? (
      <View style={[styles.datalist, { borderColor: innerBorder, backgroundColor: cardBg }]}>
        {items.map((item) => {
          const label = labelOf(item);
          return (
            <Pressable
              key={String(item?._id || item?.id || label)}
              onPress={() => onChoose(label)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: isDark ? c.slate800 : c.slate100 }]}
            >
              <Text style={[styles.optionText, { color: v.foreground }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    ) : null;

  const issueStep = (issues, onSubmit) => (
    <View style={styles.stack}>
      <Text style={[styles.h3, { color: strong }]}>Issue type</Text>
      <View style={styles.issueGrid}>
        {issues.map((it) => (
          <Button
            key={it}
            title={it}
            variant={issueType === it ? "default" : "outline"}
            onPress={() => setIssueType(it)}
            style={[styles.issueBtn, issueType !== it && outlineBg]}
            textStyle={issueType !== it ? outlineText : undefined}
          />
        ))}
      </View>
      {textArea("Describe the issue (optional)", description, setDescription)}
      <View style={styles.actions}>
        <Button title={submitting ? "Submitting..." : "Submit Ticket"} onPress={onSubmit} disabled={!issueType || submitting} />
        <Button variant="outline" title="Cancel" onPress={() => setStep("pick")} style={outlineBg} textStyle={outlineText} />
      </View>
    </View>
  );

  const pickCard = (type, Icon, title, sub) => (
    <Pressable
      key={type}
      onPress={() => handlePick(type)}
      style={({ pressed }) => [
        styles.pickCard,
        { borderColor: innerBorder },
        pressed && { backgroundColor: isDark ? c.slate800 : "#f8fafc" },
      ]}
    >
      <View style={styles.pickHead}>
        <Icon size={20} color={isDark ? c.slate200 : c.slate700} />
        <ChevronRight size={16} color={c.slate400} />
      </View>
      <Text style={[styles.pickTitle, { color: strong }]}>{title}</Text>
      <Text style={styles.pickSub}>{sub}</Text>
    </Pressable>
  );

  const header = (
    <View>
      <View style={styles.backRow}>
        <Pressable
          onPress={() => (step === "pick" ? goTo("/profile") : setStep("pick"))}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={16} color={isDark ? "#ffffff" : "#000000"} />
        </Pressable>
      </View>

      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.cardPad}>
          <Text style={[styles.h1, { color: strong }]}>Help & Support</Text>
          <Text style={styles.lead}>Raise a support ticket and track updates in one place.</Text>
        </View>
      </Card>

      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.cardPad}>
          {step === "pick" ? (
            <View style={styles.pickList}>
              {pickCard("order", ShoppingBag, "Order Issue", "Missing item, wrong item, delivery issue")}
              {pickCard("restaurant", Building2, "Restaurant Issue", "Service, listing info, behavior report")}
              {pickCard("other", HelpCircle, "Other Issue", "Account, app, payment or general query")}
            </View>
          ) : null}

          {step === "choose_order" ? (
            <View style={styles.stack}>
              <Text style={[styles.h3, { color: strong }]}>Select an order</Text>
              {orders.length > 0 ? (
                <View style={styles.stackSm}>
                  <Input
                    value={orderSearch}
                    onChangeText={handleOrderSearchChange}
                    placeholder="Select/search order"
                    onFocus={() => setFocusedList("orders")}
                    onBlur={() => setFocusedList(null)}
                    style={{ backgroundColor: v.inputBg, borderColor: isDark ? "#27272A" : c.slate200 }}
                  />
                  {datalist("orders", filteredOrders, getOrderLabel, handleOrderSearchChange)}
                  {filteredOrders.length === 0 ? <Text style={styles.note}>No matching orders found</Text> : null}
                </View>
              ) : (
                <Text style={styles.note}>No recent orders found</Text>
              )}
              <View style={styles.actions}>
                <Button variant="outline" title="Back" onPress={() => setStep("pick")} style={outlineBg} textStyle={outlineText} />
              </View>
            </View>
          ) : null}

          {step === "order_issue" && selectedOrder
            ? issueStep(orderIssues, () =>
                submitTicket({
                  type: "order",
                  orderId: selectedOrder._id || selectedOrder.id,
                  issueType,
                  description,
                }),
              )
            : null}

          {step === "choose_restaurant" ? (
            <View style={styles.stack}>
              <Text style={[styles.h3, { color: strong }]}>Select a restaurant</Text>
              {restaurants.length > 0 ? (
                <View style={styles.stackSm}>
                  <Input
                    value={restaurantSearch}
                    onChangeText={handleRestaurantSearchChange}
                    placeholder="Select/search restaurant"
                    onFocus={() => setFocusedList("restaurants")}
                    onBlur={() => setFocusedList(null)}
                    style={{ backgroundColor: v.inputBg, borderColor: isDark ? "#27272A" : c.slate200 }}
                  />
                  {datalist("restaurants", filteredRestaurants, getRestaurantLabel, handleRestaurantSearchChange)}
                  {filteredRestaurants.length === 0 ? (
                    <Text style={styles.note}>No matching restaurants found</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.note}>No restaurants found</Text>
              )}
              <View style={styles.actions}>
                <Button variant="outline" title="Back" onPress={() => setStep("pick")} style={outlineBg} textStyle={outlineText} />
              </View>
            </View>
          ) : null}

          {step === "restaurant_issue" && selectedRestaurant
            ? issueStep(restaurantIssues, () =>
                submitTicket({
                  type: "restaurant",
                  restaurantId: selectedRestaurant._id || selectedRestaurant.id,
                  issueType,
                  description,
                }),
              )
            : null}

          {step === "other_form" ? (
            <View style={styles.stack}>
              <Input
                placeholder="Subject"
                value={subject}
                onChangeText={setSubject}
                style={{ backgroundColor: v.inputBg, borderColor: isDark ? "#27272A" : c.slate200 }}
              />
              {textArea("Describe your issue", description, setDescription)}
              <View style={styles.actions}>
                <Button
                  title={submitting ? "Submitting..." : "Submit Ticket"}
                  onPress={() => submitTicket({ type: "other", issueType: subject || "Other", description })}
                  disabled={!subject || submitting}
                />
                <Button variant="outline" title="Cancel" onPress={() => setStep("pick")} style={outlineBg} textStyle={outlineText} />
              </View>
            </View>
          ) : null}
        </View>
      </Card>

      <CardTop bg={cardBg} border={cardBorder} style={shadow.sm}>
        <View style={styles.ticketsHead}>
          <Text style={[styles.ticketsTitle, { color: isDark ? "#ffffff" : c.gray900 }]}>My Tickets</Text>
          <View style={[styles.countBadge, { backgroundColor: isDark ? c.slate800 : c.slate100 }]}>
            <Text style={[styles.countText, { color: isDark ? c.slate300 : c.slate600 }]}>{tickets.length}</Text>
          </View>
        </View>
        {loadingTickets ? (
          <Text style={styles.note}>Loading tickets...</Text>
        ) : tickets.length === 0 ? (
          <Text style={styles.note}>No tickets yet</Text>
        ) : null}
      </CardTop>
    </View>
  );

  const renderTicket = ({ item: t, index }) => {
    const sc = statusColors(t.status);
    return (
      <CardMiddle bg={cardBg} border={cardBorder} gapTop={index === 0 ? 0 : 8}>
        <View
          style={[
            styles.ticket,
            { borderColor: innerBorder, backgroundColor: isDark ? "#171717" : "#ffffff" },
          ]}
        >
          <View style={styles.ticketRow}>
            <View style={styles.flexShrink}>
              <Text style={[styles.ticketTitle, { color: isDark ? "#ffffff" : c.slate900 }]}>
                #{String(t._id || t.id).slice(-6)} • {t.type} • {t.issueType}
              </Text>
              <Text style={styles.ticketDate}>{new Date(t.createdAt).toLocaleDateString()}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.fg }]}>{t.status}</Text>
            </View>
          </View>
          {t.adminResponse ? (
            <Text style={[styles.reply, { color: isDark ? c.slate300 : c.slate600 }]}>Reply: {t.adminResponse}</Text>
          ) : null}
        </View>
      </CardMiddle>
    );
  };

  return (
    <Screen background={isDark ? "#0a0a0a" : "#f5f5f5"}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <FadeIn style={styles.flex}>
          <FlatList
            data={loadingTickets ? [] : tickets}
            keyExtractor={(t, i) => String(t?._id || t?.id || i)}
            renderItem={renderTicket}
            ListHeaderComponent={header}
            ListFooterComponent={<CardBottom bg={cardBg} border={cardBorder} />}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.page, { paddingBottom: 80 + insets.bottom }]}
          />
        </FadeIn>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  page: { paddingHorizontal: 16, paddingTop: 16 },
  backRow: { marginBottom: 16, flexDirection: "row" },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 12, marginBottom: 12, paddingHorizontal: 16 },
  cardPad: { paddingVertical: 16 },
  h1: { fontSize: 20, fontWeight: "700" },
  lead: { fontSize: 14, color: c.slate500, marginTop: 4 },
  pickList: { gap: 12 },
  pickCard: { borderWidth: 1, borderRadius: 12, padding: 16 },
  pickHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickTitle: { marginTop: 12, fontSize: 16, fontWeight: "600" },
  pickSub: { fontSize: 12, color: c.slate500, marginTop: 4 },
  stack: { gap: 12 },
  stackSm: { gap: 8 },
  h3: { fontSize: 16, fontWeight: "600" },
  note: { fontSize: 14, color: c.slate500 },
  actions: { flexDirection: "row", gap: 8 },
  issueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  issueBtn: { flexGrow: 1, flexBasis: "45%" },
  textarea: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    ...inputFont,
  },
  datalist: { borderWidth: 1, borderRadius: 8, overflow: "hidden", ...shadow.md },
  option: { paddingHorizontal: 12, paddingVertical: 10 },
  optionText: { fontSize: 14 },
  ticketsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  ticketsTitle: { fontSize: 16, fontWeight: "600" },
  countBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  countText: { fontSize: 12, fontWeight: "500" },
  ticket: { borderWidth: 1, borderRadius: 8, padding: 12 },
  ticketRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  ticketTitle: { fontSize: 14, fontWeight: "600" },
  ticketDate: { fontSize: 12, color: c.slate500, marginTop: 4 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 11, fontWeight: "600" },
  reply: { fontSize: 12, marginTop: 8 },
});
