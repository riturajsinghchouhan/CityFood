// auth/OTP.jsx (/otp): "Verify your number", six code boxes with auto-verify on the 6th digit and a 60 s
// resend timer. verifyOtp outcomes are routed like the web:
//   authenticated     -> "/" (replace)
//   needsRegistration -> /signup/details (replace)
//   pendingApproval   -> stay here and show the amber "Pending Verification" or red "Application
//                        Rejected" card (with the reason and "Re-apply Now"), plus "Back to login".
// The web's name step (showNameInput / handleSubmitName) is dead code and is not ported.
// One hidden TextInput drives the six boxes: per-box inputs that hop focus lose digits on Android.
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import Spinner from "../../components/content/Spinner";
import { ScalePressable, Screen, Text } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { brand, mixWithWhite, tw } from "../../theme/tokens";

const OTP_INDEXES = [0, 1, 2, 3, 4, 5];
const RESEND_SECONDS = 60;
const CYAN = "#4CB8C4";
const AMBER = { bg: "rgba(255,251,235,0.8)", title: "#bb4d00", text: "#e17100" }; // amber-50/80, 700, 600
const RED = { bg: "rgba(254,242,242,0.8)", title: tw.red700, text: tw.red600, label: tw.red500 };

// "+91 9876543210" -> "+91-9876543210"
function formatPhone(phone) {
  const cleaned = String(phone || "").replace(/\s/g, "");
  if (cleaned.startsWith("+91") && cleaned.length > 3) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return cleaned;
}

// The page's two blurred ambient circles (bg-[#FFE4C4]/40 and bg-[#E0F7FA]/50, blur-[100px]).
function AmbientBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="peach" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFE4C4" stopOpacity="0.4" />
          <Stop offset="1" stopColor="#FFE4C4" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="aqua" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#E0F7FA" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#E0F7FA" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="25%" cy="5%" rx="55%" ry="40%" fill="url(#peach)" />
      <Ellipse cx="80%" cy="95%" rx="50%" ry="35%" fill="url(#aqua)" />
    </Svg>
  );
}

export default function OtpScreen() {
  const { colors } = useTheme();
  const { ready, isAuthenticated, authData: storedAuthData, requestOtp, verifyOtp, reapply } = useAuth();
  // Captured once like the web's local state: verify clears deliveryAuthData but the page stays.
  const [authData, setAuthData] = useState(null);
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [pending, setPending] = useState(null); // {message, isRejected, rejectionReason}
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const verifying = useRef(false);
  const unmounted = useRef(false);

  useEffect(
    () => () => {
      unmounted.current = true;
    },
    [],
  );

  if (!authData && storedAuthData?.phone) {
    setAuthData(storedAuthData);
    setResendTimer(RESEND_SECONDS);
  }

  // No OTP hand-off: a logged-in rider goes home, anyone else back to SignIn.
  useEffect(() => {
    if (!ready || authData || storedAuthData?.phone) return;
    router.replace(isAuthenticated ? "/" : "/login");
  }, [ready, authData, storedAuthData, isAuthenticated]);

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const t = setTimeout(() => setResendTimer((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleVerify = useCallback(
    async (code) => {
      if (code.length !== 6 || verifying.current) return;
      const phone = authData?.phone;
      if (!phone) {
        setError("Phone number not found. Please try again.");
        return;
      }
      verifying.current = true;
      setIsLoading(true);
      setError("");
      try {
        const result = await verifyOtp({ otp: code, phone });
        if (unmounted.current) return;
        if (result.outcome === "pendingApproval") {
          setPending({
            message: result.message,
            isRejected: result.isRejected,
            rejectionReason: result.rejectionReason || "",
          });
          setIsLoading(false);
          return;
        }
        if (result.outcome === "needsRegistration") {
          setIsLoading(false);
          router.replace("/signup/details");
          return;
        }
        setIsLoading(false);
        router.replace("/");
      } catch (err) {
        if (unmounted.current) return;
        setError(err?.message || "Failed to verify OTP. Please try again.");
        setIsLoading(false);
      } finally {
        verifying.current = false;
      }
    },
    [authData, verifyOtp],
  );

  const onChangeOtp = (text) => {
    const next = text.replace(/\D/g, "").slice(0, 6);
    setOtp(next);
    setError("");
    if (next.length === 6) handleVerify(next);
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    setError("");
    try {
      const phone = authData?.phone;
      if (!phone) {
        setError("Phone number not found. Please go back and try again.");
      } else {
        await requestOtp(phone);
      }
    } catch (err) {
      setError(err?.message || "Failed to resend OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
    setResendTimer(RESEND_SECONDS);
    setOtp("");
    inputRef.current?.focus();
  };

  const handleReapply = async () => {
    await reapply(authData?.phone);
    router.replace("/signup/details");
  };

  if (!authData) return null;

  const activeIndex = focused && !isLoading ? Math.min(otp.length, 5) : -1;
  const focusBorder = mixWithWhite(colors.primary, 0.55);
  const tone = pending?.isRejected ? RED : AMBER;

  return (
    <Screen background="#FFF9F2">
      <AmbientBackground />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.header}>
          <ScalePressable
            scaleTo={0.95}
            onPress={() => goTo("/login")}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color={tw.gray800} />
          </ScalePressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <LinearGradient
              colors={["transparent", "rgba(76,184,196,0.4)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topBar}
            />

            <View style={styles.message}>
              <Text heading style={styles.title}>
                Verify your number
              </Text>
              <LinearGradient
                colors={[CYAN, "#3CD3AD"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.titleBar}
              />
              <Text style={styles.sentTo}>We have sent a verification code to</Text>
              <Text style={styles.phone}>{formatPhone(authData.phone)}</Text>
            </View>

            {pending ? (
              <View style={[styles.pendingCard, { backgroundColor: tone.bg }]}>
                <View style={styles.gap8}>
                  <Text heading style={[styles.pendingTitle, { color: tone.title }]}>
                    {pending.isRejected ? "APPLICATION REJECTED" : "PENDING VERIFICATION"}
                  </Text>
                  <Text style={[styles.pendingText, { color: tone.text }]}>{pending.message}</Text>
                  {pending.isRejected && pending.rejectionReason ? (
                    <View style={styles.reasonBox}>
                      <Text heading style={styles.reasonLabel}>
                        REASON
                      </Text>
                      <Text style={styles.reasonText}>&quot;{pending.rejectionReason}&quot;</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.pendingActions}>
                  {pending.isRejected ? (
                    <ScalePressable scaleTo={0.95} onPress={handleReapply} style={styles.reapplyBtn}>
                      <Text style={styles.reapplyText}>Re-apply Now</Text>
                    </ScalePressable>
                  ) : null}
                  <Pressable onPress={() => router.replace("/login")} hitSlop={6}>
                    <Text style={[styles.backLink, { color: pending.isRejected ? RED.label : AMBER.text }]}>
                      Back to login
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {!pending ? (
              <View style={styles.gap32}>
                <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
                  {OTP_INDEXES.map((index) => {
                    const active = index === activeIndex;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.otpBox,
                          active && { borderColor: focusBorder, boxShadow: "0px 0px 0px 4px rgba(21,73,139,0.15)" },
                          isLoading && styles.otpDisabled,
                        ]}
                      >
                        <Text heading style={styles.otpDigit}>
                          {otp[index] || ""}
                        </Text>
                      </View>
                    );
                  })}
                  <TextInput
                    ref={inputRef}
                    value={otp}
                    onChangeText={onChangeOtp}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    editable={!isLoading}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    maxLength={6}
                    autoFocus
                    caretHidden
                    style={styles.otpHiddenInput}
                  />
                </Pressable>

                <View style={styles.resend}>
                  <Text style={styles.resendLabel}>DIDN&apos;T GET THE OTP?</Text>
                  {resendTimer > 0 ? (
                    <View style={styles.timerPill}>
                      <Text style={styles.timerText}>
                        Resend SMS in <Text style={[styles.timerText, { color: CYAN }]}>{resendTimer}s</Text>
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={handleResend}
                      disabled={isLoading}
                      style={[styles.resendBtn, isLoading && styles.dim]}
                    >
                      <Text style={styles.resendBtnText}>Resend SMS</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : null}

            {isLoading ? (
              <View style={styles.spinner}>
                <Spinner size={32} color={CYAN} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { height: 88, justifyContent: "center", paddingHorizontal: 24, zIndex: 20 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 17.6, paddingTop: 16, paddingBottom: 48 },
  card: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 48,
    padding: 17.6,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    overflow: "hidden",
    gap: 32,
    boxShadow: "0px 20px 60px -15px rgba(0,0,0,0.05)",
  },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6 },
  message: { alignItems: "center", gap: 12 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: "900", color: tw.gray900, letterSpacing: -0.6 },
  titleBar: { height: 4, width: 48, borderRadius: 9999 },
  sentTo: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: tw.gray500, textAlign: "center" },
  phone: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: tw.gray800, letterSpacing: 0.4 },
  pendingCard: {
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: brand.dvBorder,
    boxShadow: "0px 10px 28px -18px rgba(17,39,67,0.24)",
  },
  gap8: { gap: 8 },
  pendingTitle: { fontSize: 14, lineHeight: 20, fontWeight: "900", letterSpacing: 0.7, textAlign: "center" },
  pendingText: { fontSize: 14, lineHeight: 23, fontWeight: "500", textAlign: "center" },
  reasonBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tw.red100,
  },
  reasonLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    color: tw.red500,
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: "center",
  },
  reasonText: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: tw.red700, fontStyle: "italic", textAlign: "center" },
  pendingActions: { gap: 12, paddingTop: 8, alignItems: "center" },
  reapplyBtn: {
    width: "100%",
    paddingVertical: 14,
    backgroundColor: tw.red500,
    borderRadius: 16,
    alignItems: "center",
    boxShadow: "0px 10px 15px -3px rgba(251,44,54,0.2), 0px 4px 6px -4px rgba(251,44,54,0.2)",
  },
  reapplyText: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: "#ffffff" },
  backLink: { fontSize: 14, lineHeight: 20, fontWeight: "700", textDecorationLine: "underline" },
  errorBox: {
    backgroundColor: tw.red50,
    borderWidth: 1,
    borderColor: tw.red100,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: tw.red500, textAlign: "center" },
  gap32: { gap: 32 },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  otpBox: {
    width: 40,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: brand.inputBorder,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  otpDisabled: { opacity: 0.5 },
  otpDigit: { fontSize: 20, lineHeight: 28, fontWeight: "900", color: brand.text },
  otpHiddenInput: { ...StyleSheet.absoluteFill, opacity: 0, color: "transparent" },
  resend: { alignItems: "center", gap: 8 },
  resendLabel: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: tw.gray400, letterSpacing: 1.2 },
  timerPill: {
    backgroundColor: "rgba(243,244,246,0.5)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
  },
  timerText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: tw.gray500 },
  resendBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: "rgba(76,184,196,0.1)",
  },
  resendBtnText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: CYAN },
  dim: { opacity: 0.5 },
  spinner: { alignItems: "center", paddingTop: 16 },
});
