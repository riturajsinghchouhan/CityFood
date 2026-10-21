// Shared bits of the DeliveryV2 pocket pages: the "old style" white sub-page header, DetailRow,
// formatCurrency (@food/utils/currency), the payout/settlement status colours and date formats.
import dayjs from "dayjs";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Spinner from "../content/Spinner";
import Text from "../ui/Text";
import { brand, dvColor, light, tw } from "../../theme/tokens";

// Tailwind v4 shades the pocket/orders pages use that are not in theme/tokens `tw`.
export const twx = {
  amber50: "#fffbeb",
  amber100: "#fef3c6",
  amber200: "#fee685",
  amber600: "#e17100",
  amber800: "#973c00",
  amber900: "#7b3306",
  emerald50: "#ecfdf5",
  emerald100: "#d0fae5",
  emerald200: "#a4f4cf",
  emerald800: "#005f46",
  emerald900: "#004e3b",
  green200: "#b9f8cf",
  blue100: "#dbeafe",
  red200: "#ffc9c9",
  purple50: "#faf5ff",
  purple100: "#f3e8ff",
  purple600: "#9810fa",
  yellow500: "#f0b100",
};

// deliveryTheme.css: every rounded-2xl / rounded-3xl element gets this shadow and --dv-border borders.
export const dvCard = { borderColor: brand.dvBorder, ...brand.cardShadow };

// @food/utils/currency formatCurrency: "₹ 12.00" (parseFloat, so a missing amount shows "₹ NaN" like web).
export function formatCurrency(amount, currency = "₹") {
  return `${currency} ${parseFloat(amount).toFixed(2)}`;
}

// toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})
export function formatDateTimeIN(value) {
  const d = dayjs(value);
  return d.isValid() ? d.format("DD MMM YYYY, hh:mm a") : "Invalid Date";
}

// The web's {color, bgColor, borderColor} per payout / settlement status, after the colour remap.
export function getStatusInfo(status) {
  switch (String(status || "").toLowerCase()) {
    case "completed":
    case "approved":
      return {
        icon: CheckCircle2,
        color: dvColor("text-green-600", light),
        bgColor: dvColor("bg-green-50", light),
        borderColor: twx.green200,
      };
    case "pending":
      return {
        icon: Clock,
        color: dvColor("text-blue-600", light),
        bgColor: dvColor("bg-blue-50", light),
        borderColor: dvColor("border-blue-200", light),
      };
    case "denied":
    case "rejected":
      return { icon: XCircle, color: tw.red600, bgColor: tw.red50, borderColor: twx.red200 };
    default:
      return { icon: Clock, color: tw.gray600, bgColor: tw.gray50, borderColor: tw.gray200 };
  }
}

// "bg-white border-b border-gray-200 px-4 py-4 safe-top" header with an ArrowLeft back button.
export function SubHeader({ title, onBack, titleSize = 18 }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn} accessibilityLabel="Back">
        <ArrowLeft size={20} color={tw.gray600} />
      </Pressable>
      <Text style={[styles.title, { fontSize: titleSize }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

// py-4 flex justify-between border-b border-gray-100 row (PocketBalanceV2 / CashLimitInfoV2).
export function DetailRow({ label, value, subLabel }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subLabel ? <Text style={styles.rowSub}>{subLabel}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// Loader2 animate-spin + caption, centred (py-12 / py-20 loading blocks).
export function LoadingBlock({ color, label, labelStyle, paddingVertical = 48, size = 32, gap = 16 }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical, gap }}>
      <Spinner size={size} color={color} />
      {label ? <Text style={labelStyle}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backBtn: { padding: 8, borderRadius: 8 },
  title: { flex: 1, fontWeight: "700", color: tw.gray900 },
  row: {
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
  },
  rowLeft: { flex: 1, paddingRight: 16 },
  rowLabel: { fontSize: 14, fontWeight: "600", color: tw.gray800 },
  rowSub: { fontSize: 10, color: tw.gray400, fontWeight: "500", lineHeight: 12.5, marginTop: 2 },
  rowValue: { fontSize: 14, fontWeight: "700", color: tw.black },
});
