// auth/Signup.jsx (phone layout; the desktop-only left image panel is not shown): restaurant name +
// country code + phone, then a register OTP and /otp with isSignUp.
// Not ported: the "Demo Credentials" box (+91 9876543210 / OTP 1234), a dev shortcut.
import { router } from "expo-router";
import { AlertCircle, Phone, User, UtensilsCrossed } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from "react-native";
import SelectField from "../../components/auth/SelectField";
import { useBranding } from "../../components/auth/useBranding";
import { Screen, ScalePressable, Text } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { fontFamilyByWeight, radius, shadow, tw } from "../../theme/tokens";

const countryCodes = [{ code: "+91", country: "IN", flag: "\u{1F1EE}\u{1F1F3}" }];

const validatePhone = (phone) => {
  if (!phone.trim()) return "Phone number is required";
  const cleanPhone = phone.replace(/[\s\-()]/g, "");
  if (!/^\d{7,15}$/.test(cleanPhone)) return "Phone number must be 7-15 digits";
  return "";
};

const validateName = (name) => {
  if (!name.trim()) return "Restaurant name is required";
  if (name.trim().length < 2) return "Restaurant name must be at least 2 characters";
  if (name.trim().length > 50) return "Restaurant name must be less than 50 characters";
  return "";
};

function ErrorLine({ message }) {
  return (
    <View style={styles.errorRow}>
      <AlertCircle size={12} color={tw.red600} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function IconInput({ icon, error, ...props }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputWrap}>
      <View style={styles.inputIcon} pointerEvents="none">
        {icon}
      </View>
      <TextInput
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={tw.gray400}
        selectionColor={colors.primary}
        style={[
          styles.input,
          error && { borderColor: tw.red500 },
          focused && { borderColor: colors.focusBorder, boxShadow: `0px 0px 0px 2px ${colors.primary}` },
        ]}
      />
    </View>
  );
}

export default function SignupScreen() {
  const { colors } = useTheme();
  const { companyName } = useBranding();
  const { requestOtp } = useAuth();
  const [formData, setFormData] = useState({ phone: "", countryCode: "+91", name: "" });
  const [errors, setErrors] = useState({ phone: "", name: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "phone") setErrors((prev) => ({ ...prev, phone: validatePhone(value) }));
    else if (name === "name") setErrors((prev) => ({ ...prev, name: validateName(value) }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setApiError("");
    const newErrors = { phone: validatePhone(formData.phone), name: validateName(formData.name) };
    setErrors(newErrors);
    if (newErrors.phone || newErrors.name) {
      setIsLoading(false);
      return;
    }
    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim();
    try {
      await requestOtp(fullPhone);
      router.push({ pathname: "/otp", params: { phone: fullPhone, isSignUp: "1", name: formData.name } });
    } catch (error) {
      setApiError(error?.isNetworkError || !error?.message ? "Failed to send OTP. Please try again." : error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen background="#ffffff">
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <View style={styles.brandRow}>
              <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
                <UtensilsCrossed size={24} color="#ffffff" />
              </View>
              <View>
                <Text style={[styles.brandName, { color: colors.primary }]}>{companyName}</Text>
                <Text style={styles.brandSub}>Restaurant Panel</Text>
              </View>
            </View>
            <View style={styles.version}>
              <Text style={styles.versionText}>Software Version : 1.0.0</Text>
            </View>
          </View>

          <View style={styles.center}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Register Your Restaurant</Text>
              <Text style={styles.subtitle}>Enter your details to get started.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Restaurant Name</Text>
                <IconInput
                  icon={<User size={16} color={tw.gray400} />}
                  value={formData.name}
                  onChangeText={(v) => handleChange("name", v)}
                  placeholder="Enter restaurant name"
                  error={Boolean(errors.name)}
                />
                {errors.name ? <ErrorLine message={errors.name} /> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.phoneRow}>
                  <SelectField
                    value={formData.countryCode}
                    onChange={(v) => setFormData((prev) => ({ ...prev, countryCode: v }))}
                    options={countryCodes.map((c) => ({
                      value: c.code,
                      label: c.code,
                      left: <Text style={styles.flag}>{c.flag}</Text>,
                    }))}
                    placeholder="Code"
                    style={styles.codeTrigger}
                    textStyle={styles.codeText}
                  />
                  <View style={styles.flex}>
                    <IconInput
                      icon={<Phone size={16} color={tw.gray400} />}
                      value={formData.phone}
                      onChangeText={(v) => handleChange("phone", v)}
                      placeholder="Enter phone number"
                      keyboardType="phone-pad"
                      error={Boolean(errors.phone)}
                    />
                  </View>
                </View>
                {errors.phone ? <ErrorLine message={errors.phone} /> : null}
                {apiError && !errors.phone ? <ErrorLine message={apiError} /> : null}
              </View>

              <ScalePressable
                scaleTo={0.98}
                onPress={handleSubmit}
                disabled={isLoading}
                style={[styles.submit, { backgroundColor: colors.primary, opacity: isLoading ? 0.5 : 1 }]}
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator size={16} color="#ffffff" />
                    <Text style={styles.submitText}>Sending OTP...</Text>
                  </>
                ) : (
                  <Text style={styles.submitText}>Send OTP</Text>
                )}
              </ScalePressable>
            </View>

            <View style={styles.links}>
              <Text style={styles.linkLine}>
                <Text style={[styles.linkLine, { color: tw.gray600 }]}>Already have an account? </Text>
                <Text
                  style={[styles.linkLine, { color: colors.primary, fontWeight: "500" }]}
                  onPress={() => router.push("/login")}
                >
                  Login
                </Text>
              </Text>
              <Text style={styles.agree}>
                By continuing, you agree to our{" "}
                <Text style={[styles.agree, { color: colors.primary }]} onPress={() => router.push("/profile/terms")}>
                  Terms of Service
                </Text>
                {" & "}
                <Text style={[styles.agree, { color: colors.primary }]} onPress={() => router.push("/profile/privacy")}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  top: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", ...shadow.lg },
  brandName: { fontSize: 24, lineHeight: 32, fontWeight: "700", letterSpacing: 0.6 },
  brandSub: { fontSize: 12, fontWeight: "500", color: tw.gray500 },
  version: {
    position: "absolute",
    right: 24,
    top: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a4f4cf",
    ...shadow.sm,
  },
  versionText: { fontSize: 11, fontWeight: "500", color: "#007a55" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 32 },
  titleBlock: { marginBottom: 32, alignItems: "center" },
  title: { fontSize: 24, lineHeight: 32, fontWeight: "600", color: tw.gray900, marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: tw.gray500 },
  form: { width: "100%", gap: 20, padding: 4 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500", color: tw.gray700 },
  inputWrap: { justifyContent: "center" },
  inputIcon: { position: "absolute", left: 12, zIndex: 1 },
  input: {
    height: 44,
    paddingLeft: 36,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: tw.gray300,
    borderRadius: radius.md,
    backgroundColor: "#ffffff",
    fontSize: 16,
    color: tw.gray900,
    fontFamily: fontFamilyByWeight["400"],
    ...shadow.sm,
  },
  phoneRow: { flexDirection: "row", gap: 8 },
  codeTrigger: { width: 80, height: 44, paddingHorizontal: 8 },
  codeText: { fontSize: 12 },
  flag: { fontSize: 12 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  errorText: { fontSize: 12, color: tw.red600, flexShrink: 1 },
  submit: {
    marginTop: 8,
    height: 44,
    width: "100%",
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadow.md,
  },
  submitText: { fontSize: 16, fontWeight: "600", color: "#ffffff" },
  links: { marginTop: 24, alignItems: "center", gap: 8 },
  linkLine: { fontSize: 14, textAlign: "center" },
  agree: { fontSize: 12, color: tw.gray500, textAlign: "center" },
});
