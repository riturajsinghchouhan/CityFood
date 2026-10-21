// auth/SignupStep2.jsx (/signup/documents): "Upload Documents" step 2 of 2. Required photos: profile,
// Aadhaar front/back, PAN, RC; DL front/back are optional. Each slot offers camera or gallery; photos
// persist across restarts (signupFiles). "Complete Signup" posts the step-1 details plus the photos as
// multipart to POST /food/delivery/register (deliveryNeedsRegistration) or PATCH /food/delivery/profile
// (otherwise, as the web does), then shows "Profile Under Review" -> Back to Login.
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { buildRegisterFormData, completeProfile } from "../../api";
import DocumentUpload from "../../components/auth/DocumentUpload";
import { SubHeader } from "../../components/auth/FormFields";
import { REFERRAL_KEY } from "../../components/auth/referral";
import {
  clearSignupPhotos,
  deleteSignupPhoto,
  emptyDocs,
  hydrateSignupDocs,
  pickSignupPhoto,
} from "../../components/auth/signupFiles";
import { ScalePressable, Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import useLatest from "../../hooks/useLatest";
import { getPushTokenForLogin } from "../../lib/push";
import { useAppBack } from "../../navigation/back";
import { KEYS, store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { brand, tw } from "../../theme/tokens";

const SLOTS = [
  { docType: "profilePhoto", label: "Profile Photo", required: true },
  { docType: "aadharFrontPhoto", label: "Aadhar Card (Front)", required: true },
  { docType: "aadharBackPhoto", label: "Aadhar Card (Back)", required: true },
  { docType: "panPhoto", label: "PAN Card Photo", required: true },
  { docType: "drivingLicenseFrontPhoto", label: "Driving License (Front)", required: false },
  { docType: "drivingLicenseBackPhoto", label: "Driving License (Back)", required: false },
  { docType: "rcPhoto", label: "RC (Registration Certificate)", required: true },
];

const REQUIRED_MESSAGES = [
  ["profilePhoto", "Profile Photo is required"],
  ["aadharFrontPhoto", "Aadhar Card (Front) is required"],
  ["aadharBackPhoto", "Aadhar Card (Back) is required"],
  ["panPhoto", "PAN Card Photo is required"],
  ["rcPhoto", "RC (Registration Certificate) is required"],
];

function getFriendlyRegistrationError(error) {
  const rawMessage = error?.data?.message || error?.data?.error || error?.message || "";
  if (/E11000 duplicate key error/i.test(rawMessage)) {
    if (/vehicleNumber_1/i.test(rawMessage) || /vehicleNumber/i.test(rawMessage)) {
      return "This vehicle number is already registered. Please use a different vehicle number.";
    }
    if (/panNumber_1/i.test(rawMessage) || /panNumber/i.test(rawMessage)) return "This PAN number is already registered.";
    if (/aadharNumber_1/i.test(rawMessage) || /aadharNumber/i.test(rawMessage)) {
      return "This Aadhar number is already registered.";
    }
    if (/drivingLicense/i.test(rawMessage)) return "This driving license number is already registered.";
    return "This account detail is already registered. Please check your information.";
  }
  return rawMessage || "Failed to register. Please try again.";
}

// "aadharFrontPhoto" -> "aadhar Front Photo" (the web's toast text).
const humanize = (docType) => docType.replace(/([A-Z])/g, " $1").trim();

function SuccessCard() {
  return (
    <Screen background={tw.gray100}>
      <View style={styles.successWrap}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Check size={40} color={tw.amber500} />
          </View>
          <Text heading style={styles.successTitle}>
            Profile Under Review
          </Text>
          <Text style={styles.successText}>
            Your profile has been submitted successfully. It is currently under review by the admin. We will notify you
            once your request is approved.
          </Text>
          <ScalePressable scaleTo={0.95} onPress={() => router.replace("/login")} style={styles.successBtn}>
            <Text style={styles.successBtnText}>Back to Login</Text>
          </ScalePressable>
        </View>
      </View>
    </Screen>
  );
}

export default function SignupDocumentsScreen() {
  const { colors } = useTheme();
  const goBack = useAppBack();
  const { register, getSignupDetails, getSignupDocs, saveSignupDocs, clearSignupDrafts } = useAuth();
  const [documents, setDocuments] = useState(emptyDocs);
  const [hydrated, setHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const documentsRef = useLatest(documents);

  useEffect(() => {
    let cancelled = false;
    getSignupDocs().then((saved) => {
      if (cancelled) return;
      setDocuments(hydrateSignupDocs(saved));
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [getSignupDocs]);

  useEffect(() => {
    if (hydrated) saveSignupDocs(documents);
  }, [documents, hydrated, saveSignupDocs]);

  const handlePick = useCallback(async (docType, source) => {
    try {
      const result = await pickSignupPhoto(docType, source);
      if (!result) return;
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDocuments((prev) => ({ ...prev, [docType]: result.doc }));
      toast.success(`${humanize(docType)} selected`);
    } catch {
      toast.error("Failed to process image. Please try another one.");
    }
  }, []);

  const handleRemove = useCallback(
    (docType) => {
      deleteSignupPhoto(documentsRef.current[docType]);
      setDocuments((prev) => ({ ...prev, [docType]: null }));
    },
    [documentsRef],
  );

  const handleSubmit = async () => {
    const details = await getSignupDetails();
    if (!details || typeof details !== "object") {
      toast.error("Session expired. Please start from Create Account.");
      router.replace("/login"); // web: /signup, which redirects to login
      return;
    }
    if (!details.zoneId) {
      toast.error("Please select your service zone");
      router.push("/signup/details");
      return;
    }
    for (const [key, message] of REQUIRED_MESSAGES) {
      if (!documents[key]) {
        toast.error(message);
        return;
      }
    }

    const files = Object.fromEntries(Object.entries(documents).filter(([, v]) => Boolean(v)));
    const isNewRegistration = (await store.get(KEYS.needsRegistration)) === "true";

    setIsSubmitting(true);
    try {
      let res;
      if (isNewRegistration) {
        res = await register(details, files);
      } else {
        const fcmToken = await getPushTokenForLogin();
        res = await completeProfile(buildRegisterFormData(details, files, { fcmToken, platform: "mobile" }));
      }
      if (res?.success) {
        await clearSignupDrafts();
        await store.remove(REFERRAL_KEY);
        clearSignupPhotos();
        setIsSuccess(true);
      }
    } catch (error) {
      toast.error(getFriendlyRegistrationError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) return <SuccessCard />;

  return (
    <Screen background={tw.gray100}>
      <SubHeader title="Upload Documents" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text heading style={styles.h2}>
            Document Verification
          </Text>
          <Text style={styles.introText}>Please upload clear photos of your documents</Text>
        </View>

        <View style={styles.form}>
          {SLOTS.map((slot) => (
            <DocumentUpload
              key={slot.docType}
              docType={slot.docType}
              label={slot.label}
              required={slot.required}
              doc={documents[slot.docType]}
              onPick={handlePick}
              onRemove={handleRemove}
            />
          ))}

          <ScalePressable
            scaleTo={0.99}
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[styles.submit, { backgroundColor: isSubmitting ? tw.gray400 : colors.primary }]}
          >
            <Text style={styles.submitText}>{isSubmitting ? "Submitting..." : "Complete Signup"}</Text>
          </ScalePressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingVertical: 24 },
  intro: { marginBottom: 24 },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: tw.gray900, marginBottom: 8 },
  introText: { fontSize: 14, lineHeight: 20, color: tw.gray600 },
  form: { gap: 16 },
  submit: { width: "100%", paddingVertical: 16, borderRadius: 8, alignItems: "center", marginTop: 24 },
  submitText: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: "#ffffff" },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  successCard: {
    width: "100%",
    maxWidth: 384,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: brand.dvBorder,
    boxShadow: "0px 10px 28px -18px rgba(17,39,67,0.24)",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fef3c6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    boxShadow: "inset 0px 2px 4px rgba(0,0,0,0.05)",
  },
  successTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
    color: tw.gray900,
    letterSpacing: -0.6,
    marginBottom: 12,
    textAlign: "center",
  },
  successText: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "500",
    color: tw.gray500,
    marginBottom: 32,
    textAlign: "center",
  },
  successBtn: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: tw.gray900,
    borderRadius: 12,
    alignItems: "center",
    boxShadow: "0px 10px 15px -3px rgba(16,24,40,0.2), 0px 4px 6px -4px rgba(16,24,40,0.2)",
  },
  successBtnText: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: "#ffffff" },
});
