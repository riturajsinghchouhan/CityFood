// Port of pages/restaurant/UpdateBankDetails.jsx (/update-bank-details): bank account and UPI
// details saved through PATCH /food/restaurant/profile, plus the UPI QR image (POST /uploads/image,
// folder food/restaurants/upi-qr). The web's <input type=file> becomes the camera/gallery
// ImageSourcePicker; window.alert becomes Alert.alert. As on web, no extra re-approval warning.
import { AlertCircle, ArrowLeft, Upload } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { getCurrentRestaurant, updateBankDetails, uploadMedia } from "../../api";
import ImageSourcePicker from "../../components/auth/onboarding/ImageSourcePicker";
import { fmtDateTimeIN2 } from "../../components/finance/format";
import { getImageValidationError, getUploadErrorMessage } from "../../components/menu/uploadErrors";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { AppImage, Text, toast } from "../../components/ui";
import { useScopedFont } from "../../components/ui/Text";
import { withProtected } from "../../navigation/Protected";
import { useAppBack } from "../../navigation/back";
import { tw } from "../../theme/tokens";

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

const EMPTY_FORM = {
  accountHolderName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  upiId: "",
  upiQrImage: "",
};

const blue400 = "#51a2ff";
const blue500 = "#2b7fff";
const blue700 = "#1447e6";

function FieldError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow}>
      <AlertCircle size={12} color={tw.red600} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function UpdateBankDetailsScreen() {
  const goBack = useAppBack();
  const bottomInset = useShellBottomInset();
  const font = useScopedFont("400");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState("");
  const [isQrPickerOpen, setIsQrPickerOpen] = useState(false);

  const formattedUpdatedAt = useMemo(() => {
    if (!lastUpdated) return "";
    const date = new Date(lastUpdated);
    if (Number.isNaN(date.getTime())) return "";
    return fmtDateTimeIN2(date);
  }, [lastUpdated]);

  const validate = () => {
    const nextErrors = {};
    const accountHolderName = String(form.accountHolderName || "").trim();
    const accountNumber = String(form.accountNumber || "").replace(/\s|-/g, "");
    const confirmAccountNumber = String(form.confirmAccountNumber || "").replace(/\s|-/g, "");
    const ifscCode = String(form.ifscCode || "").trim().toUpperCase();
    const upiId = String(form.upiId || "").trim();
    const anyBankField = Boolean(accountHolderName || accountNumber || ifscCode);

    if (anyBankField) {
      if (!accountHolderName) nextErrors.accountHolderName = "Account holder name is required";
      if (!accountNumber) nextErrors.accountNumber = "Account number is required";
      else if (!/^\d{9,18}$/.test(accountNumber)) nextErrors.accountNumber = "Account number must be 9 to 18 digits";
      if (!confirmAccountNumber) nextErrors.confirmAccountNumber = "Please confirm account number";
      else if (confirmAccountNumber !== accountNumber) nextErrors.confirmAccountNumber = "Account numbers do not match";
      if (!ifscCode) nextErrors.ifscCode = "IFSC code is required";
      else if (!IFSC_REGEX.test(ifscCode)) nextErrors.ifscCode = "Invalid IFSC format (e.g. SBIN0018764)";
    }
    if (upiId && !UPI_REGEX.test(upiId)) nextErrors.upiId = "Invalid UPI ID format (e.g. name@bank)";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const loadProfile = useCallback(async (options = {}) => {
    try {
      setLoading(true);
      const response = await getCurrentRestaurant(options);
      const doc = response?.data?.restaurant || null;
      if (!doc) return;
      const accountNumber = String(doc.accountNumber || "").replace(/\s|-/g, "");
      const upiQrImage = typeof doc.upiQrImage === "string" ? doc.upiQrImage : String(doc.upiQrImage?.url || "");
      setForm({
        accountHolderName: String(doc.accountHolderName || ""),
        accountNumber,
        confirmAccountNumber: accountNumber,
        ifscCode: String(doc.ifscCode || "").toUpperCase(),
        upiId: String(doc.upiId || ""),
        upiQrImage,
      });
      setLastUpdated(doc.updatedAt || "");
    } catch (error) {
      Alert.alert("", error?.data?.message || "Failed to load bank details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleQrUpload = async (file) => {
    if (!file) return;
    try {
      const imageValidationError = getImageValidationError(file);
      if (imageValidationError) {
        toast.error(imageValidationError);
        return;
      }
      setUploadingQr(true);
      const response = await uploadMedia(file, { folder: "food/restaurants/upi-qr" });
      const url = response?.data?.url || "";
      if (!url) throw new Error("Upload failed");
      setForm((prev) => ({ ...prev, upiQrImage: url }));
      toast.success("QR updated successfully");
    } catch (error) {
      toast.error(getUploadErrorMessage(error, { fallback: "Failed to upload QR image." }));
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSubmit = async () => {
    if (saving || uploadingQr) return;
    if (!validate()) return;
    const payload = {
      accountHolderName: String(form.accountHolderName || "").trim(),
      accountNumber: String(form.accountNumber || "").replace(/\s|-/g, ""),
      ifscCode: String(form.ifscCode || "").trim().toUpperCase(),
      upiId: String(form.upiId || "").trim(),
      upiQrImage: String(form.upiQrImage || "").trim(),
    };
    try {
      setSaving(true);
      await updateBankDetails(payload);
      await loadProfile({ noCache: true });
      setErrors({});
      Alert.alert("", "Bank details updated successfully");
    } catch (error) {
      Alert.alert("", error?.data?.message || "Failed to update bank details");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = (key) => [
    styles.input,
    font,
    errors[key]
      ? { borderColor: tw.red500, borderWidth: focused === key ? 2 : 1 }
      : focused === key
        ? { borderColor: blue500, borderWidth: 2 }
        : null,
  ];

  const inputProps = (key) => ({
    onFocus: () => setFocused(key),
    onBlur: () => setFocused((f) => (f === key ? "" : f)),
    placeholderTextColor: tw.gray400,
    style: inputStyle(key),
  });

  const submitDisabled = saving || uploadingQr;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.page}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: tw.gray100 }]}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={tw.gray900} />
        </Pressable>
        <Text style={styles.title}>{"Bank & UPI Details"}</Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 + bottomInset }}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size={16} color={tw.gray600} />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Account details</Text>
              {formattedUpdatedAt ? <Text style={styles.updated}>Last updated: {formattedUpdatedAt}</Text> : null}
            </View>

            <View>
              <Text style={styles.label}>Account holder name</Text>
              <TextInput
                value={form.accountHolderName}
                onChangeText={(v) => setForm((p) => ({ ...p, accountHolderName: v }))}
                placeholder="Enter account holder name"
                {...inputProps("accountHolderName")}
              />
              <FieldError message={errors.accountHolderName} />
            </View>

            <View>
              <Text style={styles.label}>Account number</Text>
              <TextInput
                value={form.accountNumber}
                keyboardType="number-pad"
                onChangeText={(v) => setForm((p) => ({ ...p, accountNumber: v.replace(/[^\d\s-]/g, "") }))}
                placeholder="Enter account number"
                {...inputProps("accountNumber")}
              />
              <FieldError message={errors.accountNumber} />
            </View>

            <View>
              <Text style={styles.label}>Confirm account number</Text>
              <TextInput
                value={form.confirmAccountNumber}
                keyboardType="number-pad"
                onChangeText={(v) => setForm((p) => ({ ...p, confirmAccountNumber: v.replace(/[^\d\s-]/g, "") }))}
                placeholder="Re-enter account number"
                {...inputProps("confirmAccountNumber")}
              />
              <FieldError message={errors.confirmAccountNumber} />
            </View>

            <View>
              <Text style={styles.label}>IFSC code</Text>
              <TextInput
                value={form.ifscCode}
                maxLength={11}
                autoCapitalize="characters"
                onChangeText={(v) => setForm((p) => ({ ...p, ifscCode: v.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                placeholder="e.g. SBIN0018764"
                {...inputProps("ifscCode")}
              />
              <FieldError message={errors.ifscCode} />
            </View>

            <View style={styles.upiSection}>
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>UPI details</Text>
              <Text style={styles.label}>UPI ID</Text>
              <TextInput
                value={form.upiId}
                autoCapitalize="none"
                onChangeText={(v) => setForm((p) => ({ ...p, upiId: v.trim() }))}
                placeholder="e.g. merchant@okaxis"
                {...inputProps("upiId")}
              />
              <FieldError message={errors.upiId} />

              <View style={{ marginTop: 16 }}>
                <Text style={styles.label}>UPI QR image</Text>
                {form.upiQrImage ? (
                  <AppImage src={form.upiQrImage} width={160} contentFit="contain" style={styles.qr} />
                ) : (
                  <View style={[styles.qr, styles.qrEmpty]}>
                    <Text style={styles.qrEmptyText}>No QR uploaded</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => {
                    if (!uploadingQr) setIsQrPickerOpen(true);
                  }}
                  style={({ pressed }) => [styles.uploadBtn, pressed && { backgroundColor: tw.gray50 }]}
                >
                  {uploadingQr ? <ActivityIndicator size={16} color={tw.gray900} /> : <Upload size={16} color={tw.gray900} />}
                  <Text style={styles.uploadText}>{uploadingQr ? "Uploading..." : "Upload QR Image"}</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={submitDisabled}
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: submitDisabled ? blue400 : pressed ? blue700 : tw.blue600 },
              ]}
            >
              <Text style={styles.submitText}>{saving ? "Saving..." : "Submit"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <ImageSourcePicker
        isOpen={isQrPickerOpen}
        onClose={() => setIsQrPickerOpen(false)}
        onFileSelect={handleQrUpload}
        title="Upload UPI QR"
        description="Choose how to upload your bank UPI QR image"
      />
    </KeyboardAvoidingView>
  );
}

export default withProtected(UpdateBankDetailsScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
  },
  backBtn: { padding: 8, borderRadius: 9999 },
  title: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  loading: { paddingVertical: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: tw.gray600, fontSize: 16 },
  form: { gap: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  updated: { fontSize: 14, color: tw.gray500, marginTop: 4 },
  label: { fontSize: 14, fontWeight: "500", color: tw.gray700, marginBottom: 8 },
  input: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: tw.gray300,
    borderRadius: 8,
    fontSize: 16,
    color: tw.gray900,
  },
  errorRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  errorText: { fontSize: 12, color: tw.red600 },
  upiSection: { paddingTop: 8, borderTopWidth: 1, borderTopColor: tw.gray200 },
  qr: { width: 160, height: 160, borderWidth: 1, borderColor: tw.gray200, borderRadius: 8, backgroundColor: "#ffffff" },
  qrEmpty: { borderStyle: "dashed", borderColor: tw.gray300, alignItems: "center", justifyContent: "center" },
  qrEmptyText: { fontSize: 12, color: tw.gray500 },
  uploadBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tw.gray300,
  },
  uploadText: { fontSize: 14, fontWeight: "500", color: tw.gray900 },
  submit: { width: "100%", paddingVertical: 16, borderRadius: 8, alignItems: "center" },
  submitText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
});
