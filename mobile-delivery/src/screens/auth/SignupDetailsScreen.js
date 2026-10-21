// auth/SignupStep1.jsx (/signup/details): "Complete Your Profile" step 1 of 2. All fields, sanitizers
// and validations are the web's; the draft is saved to deliverySignupDetails on every change. The
// service zone comes from GET /food/zones/public. Continue saves the cleaned details and opens
// /signup/documents. `ref` (referral rider id) comes from the route param or from /signup?ref=.
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { getPublicZones } from "../../api";
import { FieldError, FieldLabel, SelectField, SubHeader, TextField } from "../../components/auth/FormFields";
import { REFERRAL_KEY } from "../../components/auth/referral";
import { ScalePressable, Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAppBack } from "../../navigation/back";
import { store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

// Frontend/src/shared/utils/emailValidation.js
const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|net|org|edu|gov|mil|biz|info|name|museum|co\.in|in|co|us|me|io|uk)$/i;
const VEHICLE_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;
const DL_REGEX = /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const VEHICLE_TYPES = [
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "bicycle", label: "Bicycle" },
  { value: "ev", label: "EV" },
];

const BASE = {
  name: "",
  phone: "",
  countryCode: "+91",
  ref: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zoneId: "",
  vehicleType: "bike",
  vehicleName: "",
  vehicleNumber: "",
  drivingLicenseNumber: "",
  panNumber: "",
  aadharNumber: "",
};

const sanitizeLocationValue = (value) => value.replace(/[^A-Za-z\s.-]/g, "").replace(/\s{2,}/g, " ");
const sanitizeNameValue = (value) => value.replace(/[^A-Za-z\s]/g, "").replace(/\s{2,}/g, " ");
const isValidLocationValue = (value) => /^[A-Za-z][A-Za-z\s.-]*[A-Za-z.]$/.test(value.trim());
const isValidNameValue = (value) => /^[A-Za-z][A-Za-z\s]*[A-Za-z]$/.test(value.trim());
const isValidEmailValue = (value) => EMAIL_REGEX.test(String(value || "").trim());
const sanitizeEmailValue = (value) => value.replace(/\s/g, "").toLowerCase();

function validate(formData) {
  const e = {};
  if (!formData.name.trim()) e.name = "Name is required";
  else if (!isValidNameValue(formData.name)) e.name = "Name can contain letters only";

  if (!formData.email.trim()) e.email = "Email is required";
  else if (!isValidEmailValue(formData.email)) e.email = "Please enter a valid email address (e.g., aaa@gmail.com)";

  if (!formData.address.trim()) e.address = "Address is required";

  if (!formData.city.trim()) e.city = "City is required";
  else if (!isValidLocationValue(formData.city)) e.city = "City can contain letters only";

  if (!formData.state.trim()) e.state = "State is required";
  else if (!isValidLocationValue(formData.state)) e.state = "State can contain letters only";

  if (!formData.zoneId) e.zoneId = "Please select your service zone";

  const isBicycle = formData.vehicleType === "bicycle";
  const isEVorBicycle = formData.vehicleType === "ev" || formData.vehicleType === "bicycle";

  if (!isBicycle && !formData.vehicleNumber.trim()) e.vehicleNumber = "Vehicle number is required";
  else if (formData.vehicleNumber.trim() && !VEHICLE_REGEX.test(formData.vehicleNumber)) {
    e.vehicleNumber = "Invalid CityFood vehicle number format (e.g., MH12AB1234)";
  }

  if (!isEVorBicycle && !formData.drivingLicenseNumber.trim()) {
    e.drivingLicenseNumber = "Driving License is required for this vehicle type";
  } else if (formData.drivingLicenseNumber.trim() && !DL_REGEX.test(formData.drivingLicenseNumber)) {
    e.drivingLicenseNumber = "Invalid DL format (e.g., MH1220110012345)";
  }

  if (!formData.panNumber.trim()) e.panNumber = "PAN number is required";
  else if (!PAN_REGEX.test(formData.panNumber)) e.panNumber = "Invalid PAN format (e.g., ABCDE1234F)";

  if (!formData.aadharNumber.trim()) e.aadharNumber = "Aadhar number is required";
  else if (!/^\d{12}$/.test(formData.aadharNumber.replace(/\s/g, ""))) e.aadharNumber = "Aadhar number must be 12 digits";

  return e;
}

export default function SignupDetailsScreen() {
  const { colors } = useTheme();
  const goBack = useAppBack();
  const params = useLocalSearchParams();
  const { getSignupDetails, saveSignupDetails } = useAuth();
  const [formData, setFormData] = useState(BASE);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const paramRef = typeof params.ref === "string" ? params.ref.trim().slice(0, 64) : "";

  // localStorage.deliverySignupDetails merged over the defaults.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getSignupDetails();
      const storedRef = await store.get(REFERRAL_KEY);
      if (cancelled) return;
      const next = { ...BASE, ...(saved && typeof saved === "object" ? saved : {}) };
      if (paramRef) next.ref = paramRef;
      else if (!next.ref && storedRef) next.ref = String(storedRef);
      setFormData(next);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [getSignupDetails, paramRef]);

  useEffect(() => {
    if (hydrated) saveSignupDetails(formData);
  }, [formData, hydrated, saveSignupDetails]);

  useEffect(() => {
    let cancelled = false;
    getPublicZones()
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.zones || res?.data || [];
        setZones(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load service zones. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (name, value) => {
    let updatedValue = value;
    if (name === "vehicleNumber" || name === "panNumber" || name === "drivingLicenseNumber") {
      updatedValue = value.toUpperCase();
    }
    if (name === "name") updatedValue = sanitizeNameValue(value);
    if (name === "vehicleNumber") updatedValue = updatedValue.replace(/[^A-Z0-9]/g, "").slice(0, 10);
    if (name === "drivingLicenseNumber") updatedValue = updatedValue.replace(/[^A-Z0-9]/g, "").slice(0, 15);
    if (name === "aadharNumber") updatedValue = value.replace(/\D/g, "").slice(0, 12);
    if (name === "city" || name === "state") updatedValue = sanitizeLocationValue(value);
    if (name === "email") {
      updatedValue = sanitizeEmailValue(value);
      let emailError = "";
      if (updatedValue && !isValidEmailValue(updatedValue)) {
        emailError = "Please enter a valid email address (e.g., aaa@gmail.com)";
      } else if (!updatedValue) {
        emailError = "Email is required";
      }
      setErrors((prev) => ({ ...prev, email: emailError }));
    }
    setFormData((prev) => ({ ...prev, [name]: updatedValue }));
    if (name !== "email") {
      setErrors((prev) => (prev[name] ? { ...prev, [name]: "" } : prev));
    }
  };

  const handleSubmit = async () => {
    const nextErrors = validate(formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fill all required fields correctly");
      return;
    }
    setIsSubmitting(true);
    try {
      const details = {
        name: formData.name.trim(),
        phone: String(formData.phone || "").replace(/\D/g, "").slice(0, 15),
        countryCode: formData.countryCode || "+91",
        ref: String(formData.ref || "").trim() || "",
        email: formData.email?.trim() || "",
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        zoneId: formData.zoneId,
        vehicleType: formData.vehicleType || "bike",
        vehicleName: formData.vehicleName?.trim() || "",
        vehicleNumber: formData.vehicleNumber.trim(),
        drivingLicenseNumber: formData.drivingLicenseNumber.trim().toUpperCase(),
        panNumber: formData.panNumber.trim().toUpperCase(),
        aadharNumber: formData.aadharNumber.replace(/\s/g, ""),
      };
      await saveSignupDetails(details);
      toast.success("Details saved");
      router.push("/signup/documents");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const zoneOptions = zones
    .map((z) => {
      const id = String(z?._id || z?.id || "");
      return { value: id, label: z?.name || z?.zoneName || z?.serviceLocation || id };
    })
    .filter((o) => o.value);

  const isBicycle = formData.vehicleType === "bicycle";
  const dlOptional = formData.vehicleType === "ev" || isBicycle;
  const submitDisabled =
    isSubmitting ||
    !formData.email ||
    !isValidEmailValue(formData.email) ||
    Object.values(errors).some((err) => err !== "");

  const field = (name) => ({
    value: formData[name],
    onChangeText: (text) => handleChange(name, text),
  });

  return (
    <Screen background={tw.gray100}>
      <SubHeader title="Complete Your Profile" onBack={goBack} />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Text heading style={styles.h2}>
              Basic Details
            </Text>
            <Text style={styles.introText}>Please provide your information to continue</Text>
          </View>

          <View style={styles.form}>
            <View>
              <FieldLabel label="Full Name" required />
              <TextField {...field("name")} placeholder="Enter your full name" autoCapitalize="words" />
              <FieldError message={errors.name} />
            </View>

            <View>
              <FieldLabel label="Email" required />
              <TextField
                {...field("email")}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
              <FieldError message={errors.email} />
            </View>

            <View>
              <FieldLabel label="Address" required />
              <TextField {...field("address")} placeholder="Enter your address" multiline rows={3} />
              <FieldError message={errors.address} />
            </View>

            <View style={styles.grid2}>
              <View style={styles.col}>
                <FieldLabel label="City" required />
                <TextField {...field("city")} placeholder="City" autoCapitalize="words" />
                <FieldError message={errors.city} />
              </View>
              <View style={styles.col}>
                <FieldLabel label="State" required />
                <TextField {...field("state")} placeholder="State" autoCapitalize="words" />
                <FieldError message={errors.state} />
              </View>
            </View>

            <View>
              <FieldLabel label="Service Zone" required />
              <SelectField
                title="Service Zone"
                value={formData.zoneId}
                options={zoneOptions}
                onChange={(v) => handleChange("zoneId", v)}
                placeholder={zonesLoading ? "Loading zones..." : "Select your service zone"}
                disabled={zonesLoading}
              />
              {errors.zoneId ? (
                <FieldError message={errors.zoneId} />
              ) : (
                <Text style={styles.hint}>You will get orders only from this zone.</Text>
              )}
            </View>

            <View>
              <FieldLabel label="Vehicle Type" required />
              <SelectField
                title="Vehicle Type"
                value={formData.vehicleType}
                options={VEHICLE_TYPES}
                onChange={(v) => handleChange("vehicleType", v)}
                placeholder="Bike"
              />
            </View>

            <View>
              <FieldLabel label="Vehicle Name/Model (Optional)" />
              <TextField {...field("vehicleName")} placeholder="e.g., Honda Activa" />
            </View>

            <View>
              <FieldLabel label="Vehicle Number" required={!isBicycle} suffix={isBicycle ? "(Optional)" : ""} />
              <TextField
                {...field("vehicleNumber")}
                placeholder="e.g., MH12AB1234"
                maxLength={10}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <FieldError message={errors.vehicleNumber} />
            </View>

            <View>
              <FieldLabel
                label="Driving License Number"
                required={!dlOptional}
                suffix={dlOptional ? "(Optional)" : ""}
              />
              <TextField
                {...field("drivingLicenseNumber")}
                placeholder="E.G., MH1220110012345"
                maxLength={15}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <FieldError message={errors.drivingLicenseNumber} />
            </View>

            <View>
              <FieldLabel label="PAN Number" required />
              <TextField
                {...field("panNumber")}
                placeholder="ABCDE1234F"
                maxLength={10}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <FieldError message={errors.panNumber} />
            </View>

            <View>
              <FieldLabel label="Aadhar Number" required />
              <TextField
                {...field("aadharNumber")}
                placeholder="123456789012"
                maxLength={12}
                keyboardType="number-pad"
                inputMode="numeric"
              />
              <FieldError message={errors.aadharNumber} />
            </View>

            <ScalePressable
              scaleTo={0.99}
              onPress={handleSubmit}
              disabled={submitDisabled}
              style={[styles.submit, { backgroundColor: submitDisabled ? tw.gray400 : colors.primary }]}
            >
              <Text style={styles.submitText}>{isSubmitting ? "Saving..." : "Continue"}</Text>
            </ScalePressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingVertical: 24 },
  intro: { marginBottom: 24 },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: tw.gray900, marginBottom: 8 },
  introText: { fontSize: 14, lineHeight: 20, color: tw.gray600 },
  form: { gap: 16 },
  grid2: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  hint: { fontSize: 12, lineHeight: 16, color: tw.gray500, marginTop: 4 },
  submit: { width: "100%", paddingVertical: 16, borderRadius: 8, alignItems: "center", marginTop: 24 },
  submitText: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: "#ffffff" },
});
