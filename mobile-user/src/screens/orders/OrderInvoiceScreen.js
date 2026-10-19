// Port of pages/user/orders/OrderInvoice.jsx (tax invoice with print and PDF).
import dayjs from "dayjs";
import { useLocalSearchParams } from "expo-router";
import { ArrowLeft, Download, Printer } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { getOrderDetails } from "../../api";
import { buildTaxInvoiceHtml, printHtml, sharePdf } from "../../components/orders/invoicePdf";
import { Button, Screen, Text } from "../../components/ui";
import { useCompanyName } from "../../context/AppSettingsContext";
import { useOrders } from "../../context/OrdersContext";
import { goTo } from "../../navigation/back";
import { withProtected } from "../../navigation/Protected";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";

function numberToWords(num) {
  const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const s = num.toString();
  if (s.length > 9) return "overflow";
  const n = `000000000${s}`.slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  const part = (x) => a[Number(x)] || `${b[x[0]]} ${a[x[1]]}`;
  let str = "";
  str += Number(n[1]) !== 0 ? `${part(n[1])}Crore ` : "";
  str += Number(n[2]) !== 0 ? `${part(n[2])}Lakh ` : "";
  str += Number(n[3]) !== 0 ? `${part(n[3])}Thousand ` : "";
  str += Number(n[4]) !== 0 ? `${part(n[4])}Hundred ` : "";
  str += Number(n[5]) !== 0 ? `${str !== "" ? "and " : ""}${part(n[5])}Rupees Only` : "Rupees Only";
  return str.trim();
}

// The web read local-context fields (order.subtotal, order.total, order.restaurant...) and crashed on
// API orders, which nest them under pricing / restaurantId. Both shapes are read here.
function toInvoice(order, companyName) {
  const pricing = order.pricing || {};
  const rest =
    (order.restaurant && typeof order.restaurant === "object" && order.restaurant) ||
    (order.restaurantId && typeof order.restaurantId === "object" && order.restaurantId) ||
    {};
  const rLoc = rest.location || {};
  const cust = order.address || order.deliveryAddress || {};
  const num = (v) => Number(v) || 0;
  const items = (order.items || []).map((item) => ({ ...item, quantity: num(item.quantity) || 1 }));
  return {
    companyName,
    id: String(order.id || order.orderId || order._id || ""),
    sellerName: rest.restaurantName || order.restaurantName || companyName,
    sellerLines: [
      rest.addressLine1 || rLoc.addressLine1 || "Shop No. 38 First Floor",
      rest.addressLine2 || rLoc.addressLine2 || "V S Place Bodla Agra",
      [rest.city || rLoc.city, rest.state || rLoc.state, rest.pincode || rLoc.pincode].filter(Boolean).join(" "),
    ],
    gstNumber: rest.gstNumber,
    fssaiNumber: rest.fssaiNumber,
    panNumber: rest.panNumber,
    customerName: order.user?.name || order.userName || "Customer",
    customerLines: [
      `${cust.street || "Corporate House, 103, Film Colony Rd"}, ${cust.additionalDetails || ""}`,
      `${cust.city || "Indore"}, ${cust.state || "Madhya Pradesh"} ${cust.zipCode || "452001"}`,
    ],
    date: dayjs(order.createdAt).format("MMM D, YYYY"),
    payment: (order.paymentMethod?.type || order.payment?.method || "")?.toUpperCase() || "CASH",
    items,
    totalQty: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: num(order.subtotal ?? pricing.subtotal),
    deliveryFee: num(order.deliveryFee ?? pricing.deliveryFee),
    platformFee: num(order.platformFee ?? pricing.platformFee),
    tax: num(order.tax ?? pricing.tax),
    discount: num(order.discount ?? pricing.discount),
    total: num(order.total ?? pricing.total),
    amountInWords: numberToWords(Math.round(num(order.total ?? pricing.total))),
  };
}

function Cell({ children, style, flex, align = "left", right = true, textStyle }) {
  return (
    <View style={[styles.cell, { flex, alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }, right && styles.cellRight, style]}>
      {typeof children === "string" || typeof children === "number" ? <Text style={[styles.cellText, textStyle]}>{children}</Text> : children}
    </View>
  );
}

function OrderInvoiceScreen() {
  const { colors, isDark } = useTheme();
  const companyName = useCompanyName();
  const { orderId } = useLocalSearchParams();
  const { getOrderById } = useOrders();
  const [order, setOrder] = useState(() => getOrderById(orderId));
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState(null);

  const hasOrder = Boolean(order);
  useEffect(() => {
    if (hasOrder) return undefined;
    let active = true;
    getOrderDetails(orderId)
      .then((res) => {
        if (!active) return;
        if (res?.success && res?.data?.order) setOrder(res.data.order);
        else setError("Order not found");
      })
      .catch(() => active && setError("Failed to load invoice details"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [orderId, hasOrder]);

  const inv = useMemo(() => (order ? toInvoice(order, companyName) : null), [order, companyName]);
  const page = isDark ? "#0a0a0a" : "#f9fafb";

  if (loading) {
    return (
      <Screen background={isDark ? "#0a0a0a" : "#f5f5f5"}>
        <View style={{ paddingVertical: 80, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" style={{ marginBottom: 16 }} />
          <Text style={{ color: colors.textMuted }}>Generating invoice...</Text>
        </View>
      </Screen>
    );
  }

  if (error || !inv) {
    return (
      <Screen background={isDark ? "#0a0a0a" : "#f5f5f5"}>
        <View style={{ paddingVertical: 80, alignItems: "center", paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 16 }}>{error || "Order Not Found"}</Text>
          <Button title="Back to Orders" onPress={() => goTo("/orders")} />
        </View>
      </Screen>
    );
  }

  const html = buildTaxInvoiceHtml(inv);
  const handlePrint = () => printHtml(html).catch(() => {});
  const handleDownloadPDF = () => sharePdf(html, `Invoice_${inv.id}.pdf`).catch(() => handlePrint());

  const label = { fontSize: 10, color: "#6a7282", fontWeight: "500" };
  const bold = { fontSize: 10, fontWeight: "700", color: "#000000" };

  return (
    <Screen background={page}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        <View style={styles.topBar}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable onPress={() => goTo(`/orders/${orderId}`)} style={styles.iconBtn}>
              <ArrowLeft size={20} color={colors.text} />
            </Pressable>
            <Text style={{ fontSize: 20, fontWeight: "700" }}>Invoice Details</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="outline" onPress={handlePrint} left={<Printer size={16} color={colors.text} />} />
            <Button onPress={handleDownloadPDF} left={<Download size={16} color="#ffffff" />} />
          </View>
        </View>

        <View style={styles.paper}>
          <View style={styles.head}>
            <View style={styles.badge}>
              <View style={styles.chef}>
                <Text style={{ fontSize: 22, lineHeight: 28 }}>👩‍🍳</Text>
              </View>
              <Text style={styles.badgeName}>{companyName.toUpperCase()}</Text>
            </View>
            <View style={{ alignItems: "flex-end", flexShrink: 1, marginLeft: 8 }}>
              <Text style={styles.taxTitle}>TAX INVOICE</Text>
              <Text style={[label, { fontSize: 12, marginTop: 8 }]}>INVOICE NUMBER</Text>
              <Text style={{ fontWeight: "700", color: "#1e2939" }}>{inv.id}</Text>
            </View>
          </View>

          <View style={[styles.box, { flexDirection: "row" }]}>
            <View style={[styles.half, styles.cellRight]}>
              <Text style={styles.cap}>SOLD BY / SELLER</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1e2939" }}>{inv.sellerName.toUpperCase()}</Text>
              <Text style={styles.addr}>{inv.sellerLines.join("\n")}</Text>
              {[
                ["GSTIN", inv.gstNumber],
                ["FSSAI License", inv.fssaiNumber],
                ["PAN", inv.panNumber],
              ].map(([k, v]) => (
                <View key={k} style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <Text style={[label, { width: 80, fontSize: 12 }]}>{k}</Text>
                  <Text style={[bold, { fontSize: 12, flex: 1 }]}>: {v || "N/A"}</Text>
                </View>
              ))}
            </View>
            <View style={styles.half}>
              <Text style={styles.cap}>INVOICE TO</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1e2939" }}>{inv.customerName}</Text>
              <Text style={styles.addr}>{inv.customerLines.join("\n")}</Text>
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb", gap: 4 }}>
                {[
                  ["Order ID", inv.id],
                  ["Invoice Date", inv.date],
                  ["Payment", inv.payment],
                ].map(([k, v]) => (
                  <View key={k} style={{ flexDirection: "row", gap: 8 }}>
                    <Text style={[label, { width: 100, fontSize: 12 }]}>{k}</Text>
                    <Text style={[bold, { fontSize: 12 }]}>:</Text>
                    <Text style={[bold, { fontSize: 12, flex: 1 }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.box}>
            <View style={[styles.tr, { backgroundColor: "#f3f4f6", borderBottomWidth: 1, borderBottomColor: "#99a1af" }]}>
              <Cell flex={0.7} align="center" textStyle={styles.th}>SR. NO</Cell>
              <Cell flex={2} textStyle={styles.th}>ITEM DESCRIPTION</Cell>
              <Cell flex={0.8} align="center" textStyle={styles.th}>QTY</Cell>
              <Cell flex={1.3} align="right" textStyle={styles.th}>UNIT PRICE</Cell>
              <Cell flex={1.3} align="right" right={false} textStyle={styles.th}>TOTAL</Cell>
            </View>
            {inv.items.map((item, index) => {
              const d = Number(item.price) || 0;
              const o = Math.max(d, Number(item.originalPrice) || 0);
              const disc = o > d;
              return (
                <View key={item.id || item.itemId || index} style={[styles.tr, index < inv.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#d1d5dc" }]}>
                  <Cell flex={0.7} align="center">{String(index + 1)}</Cell>
                  <Cell flex={2} textStyle={{ fontWeight: "500", color: "#101828" }}>
                    {`${item.name} ${item.variantName ? `(${item.variantName})` : ""}`}
                  </Cell>
                  <Cell flex={0.8} align="center" textStyle={{ fontWeight: "700" }}>{String(item.quantity)}</Cell>
                  <Cell flex={1.3} align="right">
                    {disc ? <Text style={styles.strike}>₹{o.toFixed(2)}</Text> : null}
                    <Text style={[styles.cellText, disc && { fontWeight: "700", color: "#008236" }]}>₹{d.toFixed(2)}</Text>
                  </Cell>
                  <Cell flex={1.3} align="right" right={false}>
                    {disc ? <Text style={styles.strike}>₹{(o * item.quantity).toFixed(2)}</Text> : null}
                    <Text style={[styles.cellText, { fontWeight: "700", color: "#101828" }]}>₹{(d * item.quantity).toFixed(2)}</Text>
                  </Cell>
                </View>
              );
            })}
            <View style={[styles.tr, { borderTopWidth: 2, borderTopColor: "#99a1af", backgroundColor: "#f9fafb" }]}>
              <Cell flex={2.7} align="right" textStyle={{ fontWeight: "700", fontSize: 12 }}>TOTAL</Cell>
              <Cell flex={0.8} align="center" textStyle={{ fontWeight: "700" }}>{String(inv.totalQty)}</Cell>
              <Cell flex={1.3}>{""}</Cell>
              <Cell flex={1.3} align="right" right={false} textStyle={{ fontWeight: "700", color: "#101828" }}>{`₹${inv.subtotal.toFixed(2)}`}</Cell>
            </View>
            {[
              [inv.deliveryFee > 0, "DELIVERY CHARGES", `₹${inv.deliveryFee.toFixed(2)}`, { fontWeight: "500" }],
              [inv.platformFee > 0, "PLATFORM FEE", `₹${inv.platformFee.toFixed(2)}`, { fontWeight: "500" }],
              [inv.tax > 0, "GST (GOV. TAXES)", `₹${inv.tax.toFixed(2)}`, { fontWeight: "500" }],
              [inv.discount > 0, "DISCOUNT", `-₹${inv.discount.toFixed(2)}`, { fontWeight: "700", color: "#008236" }],
            ]
              .filter((row) => row[0])
              .map(([, k, v, vs]) => (
                <View key={k} style={[styles.tr, { borderTopWidth: 1, borderTopColor: "#d1d5dc" }]}>
                  <Cell flex={4.8} align="right" textStyle={{ fontWeight: "700", fontSize: 10, letterSpacing: 0.5 }}>{k}</Cell>
                  <Cell flex={1.3} align="right" right={false} textStyle={vs}>{v}</Cell>
                </View>
              ))}
            <View style={[styles.tr, { borderTopWidth: 2, borderTopColor: "#99a1af", backgroundColor: "#f3f4f6" }]}>
              <Cell flex={4.8} align="right" style={{ paddingVertical: 12 }} textStyle={{ fontWeight: "800", fontSize: 14 }}>GRAND TOTAL</Cell>
              <Cell flex={1.3} align="right" right={false} style={{ paddingVertical: 12 }} textStyle={{ fontWeight: "800", fontSize: 16, color: "#101828" }}>
                {`₹${inv.total.toFixed(2)}`}
              </Cell>
            </View>
          </View>

          <View style={[styles.box, { padding: 12, backgroundColor: "#f9fafb", flexDirection: "row", flexWrap: "wrap", alignItems: "center" }]}>
            <Text style={[label, { fontSize: 12, fontWeight: "600", marginRight: 8 }]}>AMOUNT IN WORDS:</Text>
            <Text style={{ fontWeight: "700", color: "#101828" }}>{inv.amountInWords}</Text>
          </View>

          <View style={[styles.box, { flexDirection: "row", marginBottom: 0 }]}>
            <View style={[styles.cellRight, { flex: 2, padding: 16 }]}>
              <Text style={[bold, { marginBottom: 8, color: "#1e2939", letterSpacing: 0.5 }]}>TERMS & CONDITIONS:</Text>
              {[
                "If you have any issues or queries in respect of your order, please contact customer chat support through the platform.",
                "In case you need to get more information about the seller's FSSAI status, please visit foscos.fssai.gov.in.",
                "Please note that we never ask for bank account details such as CVV, account number, UPI Pin, etc. across our support channels.",
              ].map((line, i) => (
                <Text key={i} style={{ fontSize: 10, color: "#4a5565", marginBottom: 6 }}>
                  {i + 1}. {line}
                </Text>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.sign}>
                <Text style={styles.signText}>{companyName}</Text>
              </View>
              <Text style={styles.signLabel}>AUTHORISED SIGNATORY</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

export default withProtected(OrderInvoiceScreen);

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  paper: { backgroundColor: "#ffffff", padding: 32, borderWidth: 1, borderColor: "#e5e7eb", ...shadow.sm },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 16, marginBottom: 16 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#dc2626",
    borderWidth: 2,
    borderColor: "#c10007",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  chef: { backgroundColor: "#ffffff", borderRadius: 999, padding: 4, marginBottom: 4 },
  badgeName: { fontSize: 10, fontWeight: "700", color: "#ffffff", letterSpacing: 0.5, textAlign: "center", lineHeight: 12 },
  taxTitle: { fontSize: 30, fontWeight: "800", color: "#1e2939", letterSpacing: 0.75, textAlign: "right" },
  box: { borderWidth: 1, borderColor: "#99a1af", marginBottom: 24 },
  half: { flex: 1, padding: 16 },
  cap: { fontSize: 12, color: "#6a7282", fontWeight: "600", letterSpacing: 0.6, marginBottom: 8 },
  addr: { fontSize: 14, color: "#4a5565", marginTop: 4, marginBottom: 16, lineHeight: 19 },
  tr: { flexDirection: "row" },
  cell: { paddingHorizontal: 12, paddingVertical: 8, justifyContent: "center" },
  cellRight: { borderRightWidth: 1, borderRightColor: "#99a1af" },
  cellText: { fontSize: 14, color: "#1e2939" },
  th: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: "#1e2939" },
  strike: { fontSize: 10, color: "#99a1af", textDecorationLine: "line-through", marginRight: 4 },
  sign: {
    flex: 1,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#99a1af",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,250,251,0.5)",
  },
  signText: { fontFamily: "serif", fontSize: 20, color: "#6a7282", fontStyle: "italic", opacity: 0.8, marginTop: 16, transform: [{ rotate: "-12deg" }] },
  signLabel: { paddingVertical: 8, textAlign: "center", fontWeight: "700", color: "#1e2939", letterSpacing: 1, fontSize: 10, backgroundColor: "#ffffff" },
});
