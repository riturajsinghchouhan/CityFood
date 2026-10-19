// Port of pages/user/complaints/SubmitComplaint.jsx: order complaint form (support ticket, type "order").
import { router, useLocalSearchParams } from "expo-router";
import { AlertCircle, ArrowLeft, Check, ChevronDown, FileText } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getOrderDetails, submitComplaint } from "../../api";
import { c, formatEnInDateTime } from "../../components/support/palette";
import { Dialog, inputFont, Screen, Text, toast } from "../../components/ui";
import { goTo, useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";

const COMPLAINT_TYPES = [
  { value: "Food Quality", label: "Food Quality Issue" },
  { value: "Wrong Item", label: "Wrong Item Received" },
  { value: "Missing Item", label: "Missing Item" },
  { value: "Packaging Issue", label: "Packaging Issue" },
  { value: "Late Delivery", label: "Late Delivery" },
  { value: "Other", label: "Other" },
];
const SELECT_OPTIONS = [{ value: "", label: "Select complaint type" }, ...COMPLAINT_TYPES];

function orderSummary(order) {
  const restaurantName =
    order?.restaurantId?.restaurantName ||
    order?.restaurantId?.name ||
    order?.restaurantName ||
    order?.restaurant?.restaurantName ||
    "Restaurant";
  const items = order?.items || [];
  const itemNames = items
    .map((i) => i?.name || i?.foodName)
    .filter(Boolean)
    .join(", ");
  return itemNames ? `${restaurantName} • ${itemNames}` : restaurantName;
}

export default function SubmitComplaintScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [formData, setFormData] = useState({ complaintType: "", subject: "", description: "" });
  const redirectTimer = useRef(null);

  useEffect(() => {
    let active = true;
    const leaveSoon = () => {
      redirectTimer.current = setTimeout(() => goTo("/orders"), 2000);
    };
    if (!orderId) {
      toast.error("Order ID is required");
      leaveSoon();
      return () => clearTimeout(redirectTimer.current);
    }
    getOrderDetails(String(orderId))
      .then((res) => {
        if (!active) return;
        const orderData = res?.success && res?.data?.order ? res.data.order : res?.order || null;
        if (!orderData) {
          toast.error("Order not found");
          leaveSoon();
          return;
        }
        setOrder(orderData);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error?.message || "Failed to load order details");
        leaveSoon();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(redirectTimer.current);
    };
  }, [orderId]);

  const handleSubmit = async () => {
    if (!formData.complaintType) {
      toast.error("Please select a complaint type");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    const orderMongoId = order?._id || orderId;
    if (!orderMongoId) {
      toast.error("Order ID not available");
      return;
    }
    try {
      setSubmitting(true);
      const res = await submitComplaint({
        orderId: String(orderMongoId),
        complaintType: formData.complaintType,
        subject: formData.subject,
        description: formData.description,
      });
      if (res?.success) {
        toast.success("Complaint submitted successfully");
        router.push(`/orders/${order?._id || orderId}/details`);
      } else {
        toast.error(res?.message || "Failed to submit complaint");
      }
    } catch (error) {
      toast.error(error?.message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  const pageBg = isDark ? "#0a0a0a" : c.gray50;
  const surface = isDark ? "#121212" : "#ffffff";
  const fieldStyle = [
    styles.field,
    {
      backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
      borderColor: isDark ? c.gray700 : c.gray300,
      color: isDark ? "#ffffff" : c.gray900,
    },
  ];
  const labelColor = isDark ? c.gray300 : c.gray700;

  if (loading) {
    return (
      <Screen background={pageBg}>
        <View style={styles.center}>
          <Text style={{ color: isDark ? c.gray400 : c.gray600 }}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  if (!order) return <Screen background={pageBg} />;

  const selectedLabel = SELECT_OPTIONS.find((o) => o.value === formData.complaintType)?.label;
  const label = (text) => (
    <Text style={[styles.label, { color: labelColor }]}>
      {text} <Text style={styles.required}>*</Text>
    </Text>
  );

  return (
    <Screen edges={[]} background={pageBg}>
      <View
        style={[
          styles.header,
          {
            paddingTop: 16 + insets.top,
            backgroundColor: surface,
            borderBottomColor: isDark ? c.gray800 : "#e2e8f0",
          },
        ]}
      >
        <Pressable onPress={goBack} hitSlop={6} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft size={24} color={isDark ? c.gray300 : c.gray700} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? "#ffffff" : c.gray800 }]}>Submit Complaint</Text>
        <Pressable onPress={() => router.push("/profile/support")} style={styles.historyBtn}>
          <Text style={[styles.historyText, { color: colors.primary }]}>View History</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View
            style={[styles.orderCard, { backgroundColor: surface, borderColor: isDark ? c.gray800 : "transparent" }]}
          >
            <View style={styles.orderRow}>
              <View style={[styles.orderIcon, { backgroundColor: isDark ? c.gray800 : c.gray100 }]}>
                <FileText size={20} color={isDark ? c.gray400 : c.gray600} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.orderTitle, { color: isDark ? "#ffffff" : c.gray800 }]}>
                  Order #{order.orderId || order._id}
                </Text>
                <Text style={[styles.orderSub, { color: isDark ? c.gray400 : c.gray500 }]}>{orderSummary(order)}</Text>
              </View>
            </View>
            <Text style={{ color: isDark ? c.gray400 : c.gray600 }}>{formatEnInDateTime(order.createdAt)}</Text>
          </View>

          <View style={styles.form}>
            <View>
              {label("Complaint Type")}
              <Pressable onPress={() => setSelectOpen(true)} style={[fieldStyle, styles.select]}>
                <Text style={[styles.selectText, { color: isDark ? "#ffffff" : c.gray900 }]}>{selectedLabel}</Text>
                <ChevronDown size={16} color={isDark ? "#ffffff" : c.gray900} />
              </Pressable>
            </View>

            <View>
              {label("Subject")}
              <TextInput
                value={formData.subject}
                onChangeText={(t) => setFormData((f) => ({ ...f, subject: t }))}
                placeholder="Brief description of your complaint"
                placeholderTextColor={c.gray400}
                selectionColor={colors.primary}
                maxLength={200}
                style={fieldStyle}
              />
            </View>

            <View>
              {label("Description")}
              <TextInput
                value={formData.description}
                onChangeText={(t) => setFormData((f) => ({ ...f, description: t }))}
                placeholder="Please provide detailed information about your complaint..."
                placeholderTextColor={c.gray400}
                selectionColor={colors.primary}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                style={[fieldStyle, styles.textarea]}
              />
              <Text style={[styles.counter, { color: isDark ? c.gray400 : c.gray500 }]}>
                {formData.description.length}/1000 characters
              </Text>
            </View>

            <View
              style={[
                styles.info,
                {
                  backgroundColor: isDark ? "rgba(30,58,138,0.2)" : c.blue50,
                  borderColor: isDark ? "rgba(30,58,138,0.5)" : c.blue200,
                },
              ]}
            >
              <AlertCircle size={20} color={isDark ? c.blue400 : c.blue600} style={styles.infoIcon} />
              <View style={styles.flex}>
                <Text style={[styles.infoTitle, { color: isDark ? c.blue200 : c.blue800 }]}>What happens next?</Text>
                <Text style={[styles.infoText, { color: isDark ? c.blue300 : c.blue700 }]}>
                  Your complaint will be sent to the restaurant. They will review and respond to your complaint. You
                  can track the status in your complaints section.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: 16 + insets.bottom,
              backgroundColor: surface,
              borderTopColor: isDark ? c.gray800 : c.gray200,
            },
          ]}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: pressed ? colors.secondary : colors.primary, opacity: submitting ? 0.5 : 1 },
            ]}
          >
            {submitting ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit Complaint"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Dialog visible={selectOpen} onClose={() => setSelectOpen(false)} style={styles.selectDialog}>
        {SELECT_OPTIONS.map((o) => {
          const selected = o.value === formData.complaintType;
          return (
            <Pressable
              key={o.label}
              onPress={() => {
                setFormData((f) => ({ ...f, complaintType: o.value }));
                setSelectOpen(false);
              }}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: isDark ? c.gray800 : c.gray100 }]}
            >
              <Text style={[styles.optionText, { color: isDark ? "#ffffff" : c.gray900 }]}>{o.label}</Text>
              {selected ? <Check size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    zIndex: 20,
    ...shadow.sm,
  },
  backBtn: { padding: 4, borderRadius: 9999 },
  headerTitle: { fontSize: 18, fontWeight: "600", marginLeft: 12 },
  historyBtn: { marginLeft: "auto" },
  historyText: { fontSize: 14, fontWeight: "600" },
  scroll: { paddingBottom: 24 },
  orderCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    ...shadow.sm,
  },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  orderIcon: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  orderTitle: { fontWeight: "600", fontSize: 16 },
  orderSub: { fontSize: 12 },
  form: { marginHorizontal: 16, marginTop: 16, gap: 16 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  required: { color: c.red500, fontSize: 14 },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    ...inputFont,
  },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectText: { fontSize: 16 },
  textarea: { height: 168 },
  counter: { fontSize: 12, marginTop: 4 },
  info: { borderWidth: 1, borderRadius: 8, padding: 16, flexDirection: "row", gap: 12 },
  infoIcon: { marginTop: 2 },
  infoTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  infoText: { fontSize: 14 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 16, borderTopWidth: 1 },
  submit: {
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  selectDialog: { padding: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  optionText: { fontSize: 16 },
});
