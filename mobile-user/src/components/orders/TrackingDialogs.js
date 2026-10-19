// Dialogs from OrderTracking.jsx: cancel, order details, delivery instructions, rating.
import dayjs from "dayjs";
import { LinearGradient } from "expo-linear-gradient";
import { Clock, CreditCard, MessageSquare, Star, X } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { Dialog, inputFont, ScalePressable, Text } from "../ui";
import Spinner from "./Spinner";
import { isRazorpayPaid, money } from "./orderUtils";

function DialogTitleRow({ children, onClose, style }) {
  return (
    <View style={[styles.titleRow, style]}>
      <View style={{ flex: 1 }}>{children}</View>
      <Pressable onPress={onClose} hitSlop={8} style={styles.closeX}>
        <X size={16} color="#99a1af" />
      </Pressable>
    </View>
  );
}

function Radio({ checked, color }) {
  return (
    <View style={[styles.radio, { borderColor: checked ? color : "#99a1af" }]}>
      {checked ? <View style={[styles.radioDot, { backgroundColor: color }]} /> : null}
    </View>
  );
}

export function CancelOrderDialog({ visible, order, reason, onReason, refundDestination, onRefundDestination, cancelling, onClose, onConfirm }) {
  const { colors } = useTheme();
  const showRefund = isRazorpayPaid(order);
  const confirmDisabled = cancelling || !reason.trim();
  return (
    <Dialog visible={visible} onClose={onClose} style={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb" }}>
      <DialogTitleRow onClose={onClose}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#101828" }}>Cancel Order</Text>
      </DialogTitleRow>
      <View style={{ paddingVertical: 24, paddingHorizontal: 8, gap: 20 }}>
        {showRefund ? (
          <View style={styles.refundBox}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#101828" }}>Refund preference</Text>
            {[
              ["source", "Refund to original payment method (5-7 working days)"],
              ["wallet", "Refund to wallet (instant credit)"],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                disabled={cancelling}
                onPress={() => onRefundDestination(value)}
                style={styles.refundOption}
              >
                <Radio checked={refundDestination === value} color={colors.primary} />
                <Text style={{ flex: 1, fontSize: 14, color: "#364153" }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <TextInput
          multiline
          value={reason}
          onChangeText={onReason}
          editable={!cancelling}
          placeholder="e.g., Changed my mind, Wrong address, etc."
          placeholderTextColor="#99a1af"
          style={[styles.cancelInput, cancelling && { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb" }]}
        />
        <View style={{ flexDirection: "row", gap: 12, paddingTop: 8 }}>
          <Pressable disabled={cancelling} onPress={onClose} style={[styles.btn, styles.outlineBtn, { opacity: cancelling ? 0.5 : 1 }]}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#101828" }}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={confirmDisabled}
            onPress={onConfirm}
            style={[styles.btn, { backgroundColor: "#dc2626", opacity: confirmDisabled ? 0.5 : 1 }]}
          >
            {cancelling ? <Spinner size={16} style={{ marginRight: 8 }} /> : null}
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#ffffff" }}>{cancelling ? "Cancelling..." : "Confirm Cancellation"}</Text>
          </Pressable>
        </View>
      </View>
    </Dialog>
  );
}

function BillRow({ label, value, valueNode, color }) {
  return (
    <View style={styles.billRow}>
      <Text style={{ fontSize: 12, color: color.label }}>{label}</Text>
      {valueNode || <Text style={{ fontSize: 12, fontWeight: "500", color: color.value }}>{value}</Text>}
    </View>
  );
}

export function OrderDetailsDialog({ visible, order, onClose }) {
  const { isDark } = useTheme();
  const cancelled = order?.status?.toLowerCase().includes("cancel");
  const totalQty = order?.items?.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0) || order?.items?.length || 0;
  const tone = { label: isDark ? "#d1d5dc" : "#4a5565", value: isDark ? "#f3f4f6" : "#101828" };
  const strip = isDark ? "rgba(31,41,55,0.4)" : "rgba(249,250,251,0.8)";
  const line = isDark ? "#1e2939" : "#f3f4f6";
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      style={[styles.detailsDialog, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: line }]}
    >
      <DialogTitleRow onClose={onClose} style={[styles.detailsHead, { borderBottomColor: line }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: isDark ? "#ffffff" : "#101828" }}>Order Details</Text>
          {order?.orderId ? (
            <Text style={{ fontSize: 12, color: isDark ? "#6a7282" : "#99a1af", fontFamily: "monospace" }}>
              #{String(order.orderId).slice(-6)}
            </Text>
          ) : null}
        </View>
      </DialogTitleRow>

      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
        <View style={[styles.metaStrip, { backgroundColor: strip, borderColor: line }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
            <Clock size={14} color="#99a1af" />
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "500", color: isDark ? "#d1d5dc" : "#4a5565" }}>
              {order?.createdAt ? dayjs(order.createdAt).format("D MMM YYYY, h:mm a") : "N/A"}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              cancelled
                ? { backgroundColor: isDark ? "rgba(76,5,25,0.4)" : "#fff1f2", borderColor: isDark ? "rgba(159,18,57,0.4)" : "#ffccd3" }
                : { backgroundColor: isDark ? "rgba(2,44,34,0.4)" : "#ecfdf5", borderColor: isDark ? "rgba(6,95,70,0.4)" : "#a4f4cf" },
            ]}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: cancelled ? (isDark ? "#ff637e" : "#c70036") : isDark ? "#00d492" : "#007a55",
              }}
            >
              {order?.status?.replace(/_/g, " ") || "CREATED"}
            </Text>
          </View>
        </View>

        {order?.note ? (
          <View style={[styles.noteBox, { backgroundColor: isDark ? "rgba(69,26,3,0.2)" : "rgba(255,251,235,0.7)", borderColor: isDark ? "rgba(146,64,14,0.4)" : "rgba(253,230,138,0.6)" }]}>
            <MessageSquare size={14} color={isDark ? "#ffb900" : "#e17100"} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.5, color: isDark ? "#ffd230" : "#973c00" }}>
                DELIVERY INSTRUCTIONS
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "500", marginTop: 2, textTransform: "capitalize", color: isDark ? "#d1d5dc" : "#364153" }}>
                {order.note}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={styles.sectionLabel}>ORDER ITEMS ({totalQty})</Text>
          {order?.items?.map((item, index) => {
            const isVeg = item?.isVeg !== false && item?.foodType !== "non-veg" && item?.foodType !== "non_veg";
            const vegColor = isVeg ? "#009966" : "#ec003f";
            return (
              <View
                key={index}
                style={[styles.itemRow, index > 0 && { borderTopWidth: 1, borderTopColor: isDark ? "rgba(31,41,55,0.6)" : "#f3f4f6", paddingTop: 6 }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <View style={[styles.vegBox, { borderColor: vegColor }]}>
                    <View style={[styles.vegDot, { backgroundColor: vegColor }]} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: isDark ? "#f3f4f6" : "#101828" }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: "500", color: isDark ? "#99a1af" : "#6a7282" }}>× {item.quantity}</Text>
                    </View>
                    {item.variantName ? (
                      <Text numberOfLines={1} style={{ fontSize: 11, color: isDark ? "#6a7282" : "#99a1af" }}>
                        {item.variantName}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: isDark ? "#f3f4f6" : "#101828" }}>
                  ₹{((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.billBox, { backgroundColor: strip, borderColor: line }]}>
          <Text style={[styles.sectionLabel, { marginBottom: 6 }]}>BILL SUMMARY</Text>
          <BillRow label="Item Total" value={`₹${money(order?.subtotal)}`} color={tone} />
          {Number(order?.packagingFee) > 0 ? <BillRow label="Packaging Charges" value={`₹${money(order.packagingFee)}`} color={tone} /> : null}
          {Number(order?.platformFee) > 0 ? <BillRow label="Platform Fee" value={`₹${money(order.platformFee)}`} color={tone} /> : null}
          <BillRow
            label="Delivery Fee"
            color={tone}
            valueNode={
              Number(order?.deliveryFee || 0) === 0 ? (
                <Text style={{ fontSize: 12, fontWeight: "600", color: isDark ? "#00d492" : "#009966" }}>FREE</Text>
              ) : null
            }
            value={`₹${money(order?.deliveryFee)}`}
          />
          <BillRow label="GST" value={`₹${money(order?.gst)}`} color={tone} />
          {Number(order?.discount) > 0 ? (
            <BillRow
              label="Discount Applied"
              value={`-₹${money(order.discount)}`}
              color={{ label: isDark ? "#00d492" : "#009966", value: isDark ? "#00d492" : "#009966" }}
            />
          ) : null}
          <View style={[styles.billRow, styles.billTotal, { borderTopColor: isDark ? "rgba(55,65,81,0.6)" : "#e5e7eb" }]}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#ffffff" : "#101828" }}>Total Amount</Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: isDark ? "#ffffff" : "#101828" }}>₹{money(order?.totalAmount)}</Text>
          </View>
        </View>

        {order?.paymentMethod ? (
          <View style={[styles.billRow, { paddingHorizontal: 4 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <CreditCard size={14} color="#99a1af" />
              <Text style={{ fontSize: 12, color: isDark ? "#99a1af" : "#6a7282" }}>Payment Method</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", color: isDark ? "#e5e7eb" : "#1e2939" }}>
              {order.paymentMethod}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.detailsFoot, { borderTopColor: line, backgroundColor: isDark ? "rgba(17,24,39,0.5)" : "rgba(249,250,251,0.5)" }]}>
        <Pressable onPress={onClose} style={[styles.okBtn, { backgroundColor: isDark ? "#ffffff" : "#101828" }]}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: isDark ? "#101828" : "#ffffff" }}>Okay</Text>
        </Pressable>
      </View>
    </Dialog>
  );
}

export function InstructionsDialog({ visible, value, onChange, saving, onSave, onClose }) {
  const { colors, isDark } = useTheme();
  return (
    <Dialog visible={visible} onClose={onClose} style={[styles.roundDialog, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
      <DialogTitleRow onClose={onClose} style={{ marginBottom: 8 }}>
        {/* The web's gradient class is invalid (from-#55254b), so the title renders transparent-to-orange; shown in the secondary color. */}
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.secondary }}>Delivery Instructions</Text>
      </DialogTitleRow>
      <View style={{ gap: 16 }}>
        <Text style={{ fontSize: 14, color: "#6a7282" }}>
          Add instructions for the delivery partner to help them find your address or know where to leave your order.
        </Text>
        <TextInput
          multiline
          value={value}
          onChangeText={onChange}
          placeholder="E.g. Ring the doorbell, leave at the front desk..."
          placeholderTextColor="#99a1af"
          selectionColor={colors.primary}
          style={[styles.textarea, { minHeight: 120, fontSize: 16, backgroundColor: "#f9fafb", borderColor: "#e5e7eb", color: "#101828" }]}
        />
        <Pressable disabled={saving} onPress={onSave} style={{ opacity: saving ? 0.5 : 1 }}>
          <LinearGradient colors={[colors.primary, "#fe9a00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bigBtn}>
            {saving ? <Spinner size={20} /> : <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>Save Instructions</Text>}
          </LinearGradient>
        </Pressable>
      </View>
    </Dialog>
  );
}

function StarPicker({ value, onChange, prefix, isDark }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const on = star <= (value || 0);
        return (
          <ScalePressable key={`${prefix}-${star}`} scaleTo={0.9} onPress={() => onChange(star)} style={{ padding: 4 }}>
            <Star size={40} color={on ? "#fdc700" : isDark ? "#1e2939" : "#e5e7eb"} fill={on ? "#fdc700" : "transparent"} />
          </ScalePressable>
        );
      })}
    </View>
  );
}

export function TrackingRatingDialog({
  visible,
  order,
  hasDeliveryPartner,
  restaurantRating,
  deliveryRating,
  restaurantText,
  deliveryText,
  onRestaurantRating,
  onDeliveryRating,
  onRestaurantText,
  onDeliveryText,
  submitting,
  onSubmit,
  onClose,
}) {
  const { colors, isDark } = useTheme();
  const disabled = submitting || restaurantRating === null || (hasDeliveryPartner && deliveryRating === null);
  const area = [
    styles.textarea,
    {
      minHeight: 80,
      fontSize: 14,
      backgroundColor: isDark ? "rgba(31,41,55,0.5)" : "#f9fafb",
      borderColor: isDark ? "#1e2939" : "#f3f4f6",
      color: isDark ? "#f3f4f6" : "#101828",
    },
  ];
  const q = { fontSize: 14, fontWeight: "600", color: isDark ? "#e5e7eb" : "#1e2939" };
  return (
    <Dialog visible={visible} onClose={onClose} style={[styles.roundDialog, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
      <ScrollView style={{ maxHeight: 600 }} keyboardShouldPersistTaps="handled">
        <DialogTitleRow onClose={onClose} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Star size={24} color={colors.primary} fill={colors.primary} />
            <Text style={{ fontSize: 20, fontWeight: "700", color: isDark ? "#ffffff" : "#101828" }}>Rate your Experience</Text>
          </View>
        </DialogTitleRow>
        <View style={{ gap: 24, paddingVertical: 8 }}>
          <View style={{ gap: 12 }}>
            <View style={styles.rateHead}>
              <Text style={q}>How was the food?</Text>
              <View style={[styles.tag, { backgroundColor: isDark ? "rgba(67,20,7,0.3)" : "#fff7ed" }]}>
                <Text style={{ fontSize: 12, fontWeight: "500", color: isDark ? "#ff8904" : "#f54900" }}>Restaurant</Text>
              </View>
            </View>
            <StarPicker value={restaurantRating} onChange={onRestaurantRating} prefix="res" isDark={isDark} />
            <TextInput
              multiline
              placeholder="Write a quick review for the food (optional)"
              placeholderTextColor="#99a1af"
              value={restaurantText}
              onChangeText={onRestaurantText}
              style={area}
            />
          </View>
          {hasDeliveryPartner ? (
            <View style={{ gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: isDark ? "#1e2939" : "#f3f4f6" }}>
              <View style={styles.rateHead}>
                <Text style={q}>How was the delivery?</Text>
                <View style={[styles.tag, { backgroundColor: isDark ? "rgba(23,37,84,0.3)" : "#eff6ff" }]}>
                  <Text style={{ fontSize: 12, fontWeight: "500", color: isDark ? "#51a2ff" : "#155dfc" }}>Delivery</Text>
                </View>
              </View>
              <StarPicker value={deliveryRating} onChange={onDeliveryRating} prefix="del" isDark={isDark} />
              <TextInput
                multiline
                placeholder={`How was ${order?.deliveryPartnerName || "the rider"}? (optional)`}
                placeholderTextColor="#99a1af"
                value={deliveryText}
                onChangeText={onDeliveryText}
                style={area}
              />
            </View>
          ) : null}
          <Pressable
            disabled={disabled}
            onPress={onSubmit}
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}
          >
            {submitting ? <Spinner size={20} /> : <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>Submit Feedback</Text>}
          </Pressable>
          <Pressable onPress={onClose} style={{ paddingVertical: 8, marginTop: -16 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", textAlign: "center", color: isDark ? "#6a7282" : "#99a1af" }}>Maybe later</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  closeX: { padding: 4, opacity: 0.7 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 2 },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  refundBox: { gap: 12, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb", padding: 16 },
  refundOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelInput: {
    minHeight: 100,
    borderWidth: 2,
    borderColor: "#d1d5dc",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#101828",
    textAlignVertical: "top",
    ...inputFont,
  },
  btn: { flex: 1, height: 36, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  outlineBtn: { borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#ffffff" },
  detailsDialog: { padding: 0, borderRadius: 16, maxWidth: 384, overflow: "hidden" },
  detailsHead: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  metaStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  statusPill: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  noteBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: "#6a7282" },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 6 },
  vegBox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  billBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  billTotal: { paddingTop: 8, marginTop: 4, borderTopWidth: 1 },
  detailsFoot: { padding: 12, borderTopWidth: 1 },
  okBtn: { height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  roundDialog: { borderRadius: 24, borderWidth: 0, padding: 24 },
  textarea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, textAlignVertical: "top", ...inputFont },
  bigBtn: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rateHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  submitBtn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 16 },
});
