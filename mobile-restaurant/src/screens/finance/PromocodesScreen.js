// Port of pages/restaurant/Promocodes.jsx (/promocodes): the restaurant's promo codes with an
// enable switch and delete, a floating + button, and the "New Promo Code" form, which the web
// renders inline as a page section (not a modal). The browser's `required`/min/max validation
// becomes a check before submit.
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { ArrowLeft, Calendar, Info, Plus, Ticket, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Animated, FlatList, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createPromocode, deletePromocode, getPromocodes, togglePromocodeStatus } from "../../api";
import { SelectField, confirmAsync } from "../../components/menu/common";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { ScalePressable, Text, toast } from "../../components/ui";
import { useScopedFont } from "../../components/ui/Text";
import { withProtected } from "../../navigation/Protected";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const EMPTY_FORM = {
  code: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  expiryDate: "",
  usageLimit: "",
};

const DISCOUNT_TYPES = [
  { value: "PERCENTAGE", label: "Percentage (%)" },
  { value: "FLAT", label: "Flat Amount (₹)" },
];

// The peer-checked toggle: w-11 h-6 track, h-5 w-5 thumb.
function Toggle({ value, onPress, color }) {
  const [x] = useState(() => new Animated.Value(value ? 1 : 0));
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [value, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(value) }}
      onPress={onPress}
      hitSlop={6}
      style={[styles.toggleTrack, { backgroundColor: value ? color : tw.gray200 }]}
    >
      <Animated.View
        style={[
          styles.toggleThumb,
          { borderColor: value ? "#ffffff" : tw.gray300 },
          { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] },
        ]}
      />
    </Pressable>
  );
}

function Field({ label, required, children }) {
  return (
    <View>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function validate(formData) {
  if (!formData.code.trim()) return "Please enter a code.";
  if (!formData.description.trim()) return "Please enter a description.";
  const value = Number(formData.discountValue);
  if (formData.discountValue === "" || !Number.isFinite(value)) return "Please enter a discount value.";
  if (value < 1) return "Discount value must be at least 1.";
  if (formData.discountType === "PERCENTAGE" && value > 100) return "Discount percentage must be 100 or less.";
  if (formData.minOrderAmount !== "" && !(Number(formData.minOrderAmount) >= 0)) return "Min order must be 0 or more.";
  if (formData.discountType === "PERCENTAGE" && formData.maxDiscountAmount !== "" && !(Number(formData.maxDiscountAmount) >= 1)) {
    return "Max discount must be at least 1.";
  }
  if (!formData.expiryDate) return "Please select an expiry date.";
  if (formData.usageLimit !== "" && !(Number(formData.usageLimit) >= 1)) return "Usage limit must be at least 1.";
  return "";
}

function PromocodesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = useShellBottomInset();
  const goBack = useAppBack();
  const font = useScopedFont("400");
  const boldFont = useScopedFont("700");
  const [promocodes, setPromocodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchPromocodes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPromocodes();
      setPromocodes(res?.data?.promocodeList || []);
    } catch {
      toast.error("Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromocodes();
  }, [fetchPromocodes]);

  const setField = (name) => (value) => setFormData((prev) => ({ ...prev, [name]: value }));

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await togglePromocodeStatus(id, !currentStatus);
      toast.success(currentStatus ? "Promo code disabled" : "Promo code enabled");
      fetchPromocodes();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmAsync("Are you sure you want to delete this promo code?"))) return;
    try {
      await deletePromocode(id);
      toast.success("Promo code deleted");
      fetchPromocodes();
    } catch {
      toast.error("Failed to delete promo code");
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const error = validate(formData);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = {
        code: formData.code.toUpperCase(),
        description: formData.description,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderAmount: Number(formData.minOrderAmount) || 0,
        expiryDate: new Date(formData.expiryDate).toISOString(),
      };
      if (formData.maxDiscountAmount && formData.discountType === "PERCENTAGE") {
        payload.maxDiscountAmount = Number(formData.maxDiscountAmount);
      }
      if (formData.usageLimit) payload.usageLimit = Number(formData.usageLimit);
      await createPromocode(payload);
      toast.success("Promo code created successfully!");
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      fetchPromocodes();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to create promo code");
    } finally {
      setIsSubmitting(false);
    }
  };

  // <input type="date" min={today}>
  const openDatePicker = () => {
    DateTimePickerAndroid.open({
      mode: "date",
      value: formData.expiryDate ? dayjs(formData.expiryDate).toDate() : new Date(),
      minimumDate: new Date(),
      onChange: (event, date) => {
        if (event.type === "set" && date) setField("expiryDate")(dayjs(date).format("YYYY-MM-DD"));
      },
    });
  };

  const tint10 = colors.primary + "1A";
  const tint20 = colors.primary + "33";
  const isPercent = formData.discountType === "PERCENTAGE";

  const renderPromo = ({ item: promo }) => (
    <View style={styles.card}>
      <View style={[styles.cardStripe, { backgroundColor: promo.isActive ? tw.green500 : tw.gray300 }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.codeChip, { backgroundColor: tint10, borderColor: tint20 }]}>
              <Text style={[styles.codeText, { color: colors.primary }]}>{promo.code}</Text>
            </View>
            <Text style={styles.description}>{promo.description}</Text>
          </View>
          <View style={styles.cardTopRight}>
            <Text style={[styles.discount, { color: colors.primary }]}>
              {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`}
            </Text>
            <Pressable
              onPress={() => handleDelete(promo._id)}
              style={({ pressed }) => [styles.deleteBtn, pressed && { backgroundColor: tw.red50 }]}
              accessibilityLabel="Delete promo code"
            >
              {({ pressed }) => <Trash2 size={16} color={pressed ? tw.red500 : tw.gray400} />}
            </Pressable>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Min Order</Text>
            <Text style={styles.infoValue}>₹{promo.minOrderAmount}</Text>
          </View>
          {promo.discountType === "PERCENTAGE" && promo.maxDiscountAmount ? (
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Max Discount</Text>
              <Text style={styles.infoValue}>₹{promo.maxDiscountAmount}</Text>
            </View>
          ) : null}
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Expires</Text>
            <Text style={styles.infoValue}>{dayjs(promo.expiryDate).format("M/D/YYYY")}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Usage</Text>
            <Text style={styles.infoValue}>
              {promo.usageCount} {promo.usageLimit ? `/ ${promo.usageLimit}` : "used"}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.statusText, { color: promo.isActive ? tw.green600 : tw.gray500 }]}>
            {promo.isActive ? "Active" : "Inactive"}
          </Text>
          <Toggle value={promo.isActive} color={colors.primary} onPress={() => handleToggleStatus(promo._id, promo.isActive)} />
        </View>
      </View>
    </View>
  );

  const header = (
    <View style={[styles.header, { backgroundColor: colors.primary }]}>
      <Pressable
        onPress={goBack}
        style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: "rgba(255,255,255,0.1)" }]}
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={24} color="#ffffff" />
      </Pressable>
      <Text style={styles.headerTitle}>Promo Codes</Text>
    </View>
  );

  const input = (name, { style, ...props } = {}) => (
    <TextInput
      value={formData[name]}
      onChangeText={setField(name)}
      placeholderTextColor={tw.gray400}
      style={[styles.input, font, style]}
      {...props}
    />
  );

  if (isModalOpen) {
    return (
      <KeyboardAvoidingView behavior="padding" style={styles.page}>
        {header}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 112 + bottomInset }}
        >
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>New Promo Code</Text>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                style={({ pressed }) => [styles.formClose, pressed && { backgroundColor: tw.gray100 }]}
                accessibilityLabel="Close"
              >
                <X size={20} color={tw.gray500} />
              </Pressable>
            </View>

            <View style={styles.formBody}>
              <Field label="Code" required>
                {input("code", {
                  placeholder: "e.g. SUMMER50",
                  autoCapitalize: "characters",
                  style: [boldFont, styles.codeInput],
                })}
              </Field>
              <Field label="Description" required>
                {input("description", { placeholder: "e.g. 50% off on all orders" })}
              </Field>
              <Field label="Discount Type">
                <SelectField
                  value={formData.discountType}
                  options={DISCOUNT_TYPES}
                  onChange={setField("discountType")}
                  style={styles.select}
                  textStyle={styles.selectText}
                />
              </Field>
              <Field label={isPercent ? "Discount Percentage (%)" : "Flat Amount (₹)"} required>
                {input("discountValue", { placeholder: isPercent ? "e.g. 50" : "e.g. 150", keyboardType: "numeric" })}
              </Field>
              <Field label="Min Order (₹)">{input("minOrderAmount", { placeholder: "0", keyboardType: "numeric" })}</Field>
              {isPercent ? (
                <Field label="Max Discount (₹)">
                  {input("maxDiscountAmount", { placeholder: "No limit", keyboardType: "numeric" })}
                </Field>
              ) : null}
              <Field label="Expiry Date" required>
                <Pressable onPress={openDatePicker} style={[styles.input, styles.dateInput]}>
                  <Text style={[styles.dateText, !formData.expiryDate && { color: tw.gray400 }]}>
                    {formData.expiryDate ? dayjs(formData.expiryDate).format("DD/MM/YYYY") : "dd/mm/yyyy"}
                  </Text>
                  <Calendar size={18} color={tw.gray900} />
                </Pressable>
              </Field>
              <Field label="Total Usage Limit">
                {input("usageLimit", { placeholder: "Unlimited", keyboardType: "numeric" })}
              </Field>
              <View style={styles.infoBox}>
                <Info size={20} color={tw.blue600} />
                <Text style={styles.infoBoxText}>
                  Once created, the promo code will immediately be visible and usable by your customers until it expires
                  or reaches its usage limit.
                </Text>
              </View>
            </View>

            <View style={styles.formFooter}>
              <ScalePressable
                scaleTo={0.98}
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size={20} color="#ffffff" />
                ) : (
                  <Text style={styles.submitText}>Create Promo Code</Text>
                )}
              </ScalePressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.page}>
      {header}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={promocodes}
          keyExtractor={(p) => String(p._id)}
          renderItem={renderPromo}
          ItemSeparatorComponent={Gap}
          contentContainerStyle={{ padding: 16, paddingBottom: 16 + 80 + bottomInset }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: tint10 }]}>
                <Ticket size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Promo Codes Yet</Text>
              <Text style={styles.emptyText}>
                Create your first promo code to boost your sales and attract more customers!
              </Text>
              <ScalePressable
                scaleTo={0.95}
                onPress={() => setIsModalOpen(true)}
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.emptyBtnText}>Create Promo Code</Text>
              </ScalePressable>
            </View>
          }
        />
      )}
      {promocodes.length > 0 ? (
        <ScalePressable
          scaleTo={0.95}
          onPress={() => setIsModalOpen(true)}
          style={[styles.fab, { backgroundColor: colors.primary, bottom: Math.max(bottomInset, insets.bottom + 24) }]}
          accessibilityLabel="Create promo code"
        >
          <Plus size={24} color="#ffffff" />
        </ScalePressable>
      ) : null}
    </View>
  );
}

function Gap() {
  return <View style={{ height: 16 }} />;
}

export default withProtected(PromocodesScreen);

const fieldBase = {
  width: "100%",
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 16,
  backgroundColor: tw.gray50,
  borderWidth: 1,
  borderColor: tw.gray200,
  borderRadius: 12,
  color: tw.gray900,
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tw.gray50 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
    zIndex: 10,
  },
  backBtn: { padding: 6, borderRadius: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#ffffff" },
  loader: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  empty: {
    alignItems: "center",
    paddingVertical: 64,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
    marginTop: 16,
  },
  emptyIcon: { width: 64, height: 64, borderRadius: 9999, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: tw.gray900, marginBottom: 8 },
  emptyText: { color: tw.gray500, marginBottom: 24, paddingHorizontal: 16, textAlign: "center", fontSize: 16 },
  emptyBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 9999 },
  emptyBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  cardStripe: { height: 8 },
  cardContent: { padding: 16 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  cardTopLeft: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  cardTopRight: { alignItems: "flex-end", gap: 8 },
  codeChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, borderWidth: 1, marginBottom: 8 },
  codeText: { fontWeight: "700", letterSpacing: 0.8, fontSize: 16 },
  description: { fontWeight: "600", color: tw.gray900, fontSize: 14 },
  discount: { fontWeight: "900", fontSize: 18 },
  deleteBtn: { padding: 6, borderRadius: 8 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16, marginBottom: 16 },
  infoCell: { flexBasis: "45%", flexGrow: 1, backgroundColor: tw.gray50, padding: 8, borderRadius: 8 },
  infoLabel: { fontSize: 12, color: tw.gray500, marginBottom: 2 },
  infoValue: { fontSize: 12, fontWeight: "500", color: tw.gray900 },
  cardFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tw.gray100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusText: { fontSize: 14, fontWeight: "500" },
  toggleTrack: { width: 44, height: 24, borderRadius: 9999, padding: 2, justifyContent: "center" },
  toggleThumb: { width: 20, height: 20, borderRadius: 9999, backgroundColor: "#ffffff", borderWidth: 1 },
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
    zIndex: 20,
  },
  formCard: {
    width: "100%",
    maxWidth: 512,
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  formTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  formClose: { padding: 8, borderRadius: 9999 },
  formBody: { paddingHorizontal: 16, paddingVertical: 20, gap: 16 },
  label: { fontSize: 14, fontWeight: "600", color: tw.gray700, marginBottom: 4 },
  required: { color: tw.red500, fontSize: 14, fontWeight: "600" },
  input: fieldBase,
  codeInput: { letterSpacing: 0.8, textTransform: "uppercase" },
  select: { ...fieldBase, paddingVertical: 12 },
  selectText: { fontSize: 16, color: tw.gray900 },
  dateInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateText: { fontSize: 16, color: tw.gray900 },
  infoBox: { backgroundColor: tw.blue50, padding: 12, borderRadius: 8, flexDirection: "row", gap: 12, marginTop: 8 },
  infoBoxText: { flex: 1, color: "#193cb8", fontSize: 14 },
  formFooter: {
    borderTopWidth: 1,
    borderTopColor: tw.gray100,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    boxShadow: "0px -10px 20px -10px rgba(0,0,0,0.1)",
  },
  submitBtn: { width: "100%", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  submitText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
});
