// ProfileDetailsV2 "Bank & Payments" popup (max 85vh): account holder, account number (digits),
// IFSC (upper), bank name, PAN (upper), UPI ID, the UPI QR scanner (camera / gallery tiles, or the
// preview with a remove button) and "Update Systems". The remove button only clears a newly picked
// QR, exactly like the web: a saved QR keeps showing and cannot be removed here.
import { Banknote, Camera, FileText, Image as ImageIcon, MapPin, Shield, Smartphone, User, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Spinner from "../content/Spinner";
import AppImage from "../ui/AppImage";
import Text from "../ui/Text";
import { brand, fontFamilyByWeight, mixWithWhite, shadow, tw } from "../../theme/tokens";
import ProfilePopup from "./ProfilePopup";
import { FOCUS_RING, dvCard, twp } from "./common";

const FIELDS = [
  { label: "Account Holder", key: "accountHolderName", icon: User, maxLength: 60 },
  { label: "Account Number", key: "accountNumber", icon: Banknote, maxLength: 20, isNumeric: true },
  { label: "IFSC Code", key: "ifscCode", icon: Shield, format: (v) => v.toUpperCase(), maxLength: 11 },
  { label: "Bank Name", key: "bankName", icon: MapPin, maxLength: 60 },
  { label: "PAN Number", key: "panNumber", icon: FileText, format: (v) => v.toUpperCase(), maxLength: 10 },
  { label: "UPI ID", key: "upiId", icon: Smartphone, maxLength: 60 },
];

const FOCUS_WITHIN = "rgba(255,105,0,0.5)"; // focus-within:border-orange-500/50 (not remapped)

function BankField({ field, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const Icon = field.icon;
  return (
    <View style={[styles.field, focused && { borderColor: FOCUS_WITHIN }]}>
      <View style={styles.fieldLabelRow}>
        <Icon size={14} color={tw.gray400} />
        <Text style={styles.fieldLabel}>{field.label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={(text) => {
          let val = text;
          if (field.isNumeric) val = val.replace(/\D/g, "");
          if (field.maxLength && val.length > field.maxLength) return;
          if (field.format) val = field.format(val);
          onChange(val);
        }}
        keyboardType={field.isNumeric ? "number-pad" : "default"}
        autoCapitalize={field.format ? "characters" : field.key === "upiId" ? "none" : "words"}
        autoCorrect={false}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        placeholderTextColor={tw.gray400}
        selectionColor={brand.primary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && { borderColor: mixWithWhite(brand.primary, 0.55), boxShadow: FOCUS_RING }]}
      />
    </View>
  );
}

export default function BankSheet({
  isOpen,
  onClose,
  bankDetails,
  setBankDetails,
  upiQrPreview,
  onClearQr,
  onPickQr,
  onSubmit,
  submitting,
}) {
  const qrSrc = upiQrPreview || bankDetails.upiQrCode;
  return (
    <ProfilePopup isOpen={isOpen} onClose={onClose} title="Bank & Payments" maxHeight="85%" showHandle={false}>
      <View style={styles.wrap}>
        <View style={styles.grid}>
          {FIELDS.map((field) => (
            <BankField
              key={field.key}
              field={field}
              value={bankDetails[field.key]}
              onChange={(val) => setBankDetails((prev) => ({ ...prev, [field.key]: val }))}
            />
          ))}

          <View style={styles.qrBox}>
            <Text style={styles.qrTitle}>UPI Payment QR Scanner</Text>
            {qrSrc ? (
              <View>
                <AppImage src={qrSrc} placeholderType="none" style={styles.qrPreview} />
                <Pressable onPress={onClearQr} style={styles.qrRemove} hitSlop={6} accessibilityLabel="Remove QR">
                  <X size={14} color="#ffffff" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.tiles}>
                <Pressable onPress={() => onPickQr("camera")} style={styles.tile}>
                  <Camera size={24} color={twp.purple300} />
                  <Text style={styles.tileText}>Camera</Text>
                </Pressable>
                <Pressable onPress={() => onPickQr("gallery")} style={styles.tile}>
                  <ImageIcon size={24} color={twp.purple300} />
                  <Text style={styles.tileText}>Gallery</Text>
                </Pressable>
              </View>
            )}
            <Text style={styles.qrHint}>
              Upload your UPI QR code from Google Pay, PhonePe, etc. to receive easy payouts.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.submit,
            submitting && { opacity: 0.5 },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          {submitting ? (
            <>
              <Spinner size={20} color="#ffffff" />
              <Text style={styles.submitText}>saving...</Text>
            </>
          ) : (
            <Text style={styles.submitText}>Update Systems</Text>
          )}
        </Pressable>
      </View>
    </ProfilePopup>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20, paddingBottom: 40 },
  grid: { gap: 16 },
  field: {
    backgroundColor: "rgba(249,250,251,0.5)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    ...dvCard,
  },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  fieldLabel: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 0,
    borderColor: brand.inputBorder,
    fontSize: 14,
    fontFamily: fontFamilyByWeight["700"],
    color: brand.text,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  qrBox: {
    backgroundColor: twp.purple50,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    ...dvCard,
    alignItems: "center",
    gap: 16,
  },
  qrTitle: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
    color: twp.purple600,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  qrPreview: { width: 128, height: 128, borderRadius: 14, borderWidth: 4, borderColor: "#ffffff", ...shadow.xl },
  qrRemove: {
    position: "absolute",
    top: -12,
    right: -12,
    backgroundColor: tw.red500,
    padding: 6,
    borderRadius: 9999,
    ...shadow.lg,
  },
  tiles: { width: "100%", flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: tw.gray50,
    borderWidth: 2,
    borderStyle: "dashed",
    ...dvCard,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tileText: { fontSize: 8, lineHeight: 12, fontWeight: "900", color: twp.purple400, textTransform: "uppercase" },
  qrHint: { fontSize: 9, lineHeight: 13, fontWeight: "500", color: twp.purple400, textAlign: "center" },
  submit: {
    width: "100%",
    backgroundColor: brand.primary,
    paddingVertical: 20,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    ...shadow.xl,
  },
  submitText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 16 * 0.2,
  },
});
