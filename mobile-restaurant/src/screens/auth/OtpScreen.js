// auth/OTP.jsx: "Verify Account" with six code boxes, auto-verify on the 6th digit, a 60 s resend
// countdown, and the three verify-otp outcomes routed exactly as the web does:
//   needsRegistration -> /onboarding, pendingApproval -> /pending-verification,
//   tokens -> (after 800 ms) signup ? /onboarding : incomplete ? /onboarding?step=N : "/".
// The phone/isSignUp handoff (web sessionStorage.restaurantAuthData) comes in as route params.
// One hidden TextInput drives the six boxes: per-box inputs that hop focus lose digits on Android.
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, RefreshCw, ShieldCheck, Timer } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ScalePressable, Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const OTP_INDEXES = [0, 1, 2, 3, 4, 5];
const RESEND_SECONDS = 60;

function formatContact(phone) {
  const match = String(phone || "").match(/(\+\d+)\s*(.+)/);
  return match ? `${match[1]} ${match[2].replace(/\D/g, "")}` : String(phone || "");
}

export default function OtpScreen() {
  const params = useLocalSearchParams();
  const phone = typeof params.phone === "string" ? params.phone : "";
  const isSignUp = params.isSignUp === "1" || params.isSignUp === "true";
  const { colors } = useTheme();
  const { requestOtp, verifyOtp } = useAuth();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const hasSubmittedRef = useRef(false);
  const redirectTimer = useRef(null);
  const [iconScale] = useState(() => new Animated.Value(0));
  const [enter] = useState(() => new Animated.Value(0));

  // No handoff data: back to Login (web: restaurantAuthData missing).
  useEffect(() => {
    if (!phone) router.replace("/login");
  }, [phone]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconScale, { toValue: 1, stiffness: 200, damping: 15, useNativeDriver: true }),
      Animated.timing(enter, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [iconScale, enter]);

  // Resend countdown. Restarted by resend (the web's interval stopped at 0 and never restarted).
  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const t = setTimeout(() => setResendTimer((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  const handleVerify = useCallback(
    async (code) => {
      if (code.length !== 6) {
        toast.error("Please enter the complete 6-digit code");
        hasSubmittedRef.current = false;
        return;
      }
      setIsLoading(true);
      try {
        const result = await verifyOtp({ phone, otp: code, isSignUp });

        if (result.outcome === "needsRegistration") {
          router.replace("/onboarding");
          return;
        }

        if (result.outcome === "pendingApproval") {
          router.replace({
            pathname: "/pending-verification",
            params: {
              phone: result.phone || "",
              isRejected: result.isRejected ? "1" : "0",
              rejectionReason: result.rejectionReason || "",
            },
          });
          return;
        }

        toast.success("Verification successful!");
        const step = result.onboardingStep;
        redirectTimer.current = setTimeout(() => {
          if (isSignUp) router.replace("/onboarding");
          else if (step) router.replace({ pathname: "/onboarding", params: { step: String(step) } });
          else router.replace("/");
        }, 800);
      } catch (err) {
        const message = err?.isNetworkError || !err?.message ? "Invalid OTP. Please try again." : err.message;
        toast.error(message);
        setOtp("");
        hasSubmittedRef.current = false;
        inputRef.current?.focus();
      } finally {
        setIsLoading(false);
      }
    },
    [phone, isSignUp, verifyOtp],
  );

  const onChangeOtp = (text) => {
    const next = text.replace(/\D/g, "").slice(0, 6);
    setOtp(next);
    if (next.length === 6 && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      handleVerify(next);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    try {
      await requestOtp(phone);
      toast.success("New code sent!");
      setResendTimer(RESEND_SECONDS);
    } catch (err) {
      toast.error(err?.message || "Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  if (!phone) return null;

  const isOtpComplete = otp.length === 6;
  const activeIndex = focused ? Math.min(otp.length, 5) : -1;
  const primary = colors.primary;

  return (
    <Screen background="#F7F7F7">
      <LinearGradient
        colors={[primary + "1A", primary + "0D", "transparent"]}
        style={styles.topGlow}
        pointerEvents="none"
      />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ScalePressable
              scaleTo={0.9}
              onPress={() => goTo("/login")}
              style={[styles.backBtn, { borderColor: primary + "0D", boxShadow: `0px 20px 25px -5px ${primary}1A` }]}
            >
              <ArrowLeft size={20} color={primary} />
            </ScalePressable>
          </View>

          <Animated.View
            style={[
              styles.body,
              {
                opacity: enter,
                transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
              },
            ]}
          >
            <View style={styles.titleBlock}>
              <Animated.View
                style={[
                  styles.iconBox,
                  { backgroundColor: primary, boxShadow: `0px 25px 50px -12px ${primary}4D`, transform: [{ scale: iconScale }] },
                ]}
              >
                <ShieldCheck size={40} color="#ffffff" />
              </Animated.View>
              <Text style={[styles.title, { color: primary }]}>Verify Account</Text>
              <Text style={styles.subtitle}>
                {"We've sent a 6-digit code to\n"}
                <Text style={[styles.subtitle, styles.contact, { color: primary }]}>{formatContact(phone)}</Text>
              </Text>
            </View>

            <View style={styles.card}>
              <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
                {OTP_INDEXES.map((index) => {
                  const active = index === activeIndex;
                  return (
                    <View key={index} style={styles.otpCell}>
                      <View
                        style={[
                          styles.otpBox,
                          active && {
                            borderColor: primary,
                            backgroundColor: "#ffffff",
                            transform: [{ scale: 1.05 }],
                            boxShadow: "0px 10px 30px rgba(126,56,102,0.1)",
                          },
                        ]}
                      >
                        <Text style={[styles.otpDigit, { color: primary }]}>{otp[index] || ""}</Text>
                      </View>
                      <View style={[styles.otpBar, active ? { backgroundColor: primary } : styles.otpBarHidden]} />
                    </View>
                  );
                })}
                <TextInput
                  ref={inputRef}
                  value={otp}
                  onChangeText={onChangeOtp}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  autoFocus
                  caretHidden
                  style={styles.hiddenInput}
                />
              </Pressable>

              <ScalePressable
                scaleTo={0.98}
                onPress={() => {
                  if (hasSubmittedRef.current) return;
                  hasSubmittedRef.current = true;
                  handleVerify(otp);
                }}
                disabled={isLoading || !isOtpComplete}
                style={[
                  styles.verifyBtn,
                  isLoading || !isOtpComplete
                    ? { backgroundColor: tw.gray200 }
                    : { backgroundColor: primary, boxShadow: `0px 20px 25px -5px ${primary}33` },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size={24} color={tw.gray400} />
                ) : (
                  <Text style={[styles.verifyText, { color: isOtpComplete ? "#ffffff" : tw.gray400 }]}>
                    Verify & Continue
                  </Text>
                )}
              </ScalePressable>

              <View style={styles.resendWrap}>
                {resendTimer > 0 ? (
                  <View style={styles.resendRow}>
                    <Timer size={14} color={primary} />
                    <Text style={styles.resendText}>
                      RESEND CODE IN <Text style={[styles.resendText, { color: primary }]}>{resendTimer}s</Text>
                    </Text>
                  </View>
                ) : (
                  <Pressable onPress={handleResend} disabled={isLoading} style={styles.resendRow} hitSlop={6}>
                    <RefreshCw size={14} color={primary} />
                    <Text style={[styles.resendBtnText, { color: primary }]}>RESEND OTP CODE</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Text style={styles.footer}>{"SECURE VERIFICATION • CITYFOOD PARTNER"}</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 600 },
  scroll: { flexGrow: 1 },
  header: { paddingHorizontal: 24, paddingVertical: 32, flexDirection: "row", alignItems: "center", zIndex: 20 },
  backBtn: { padding: 12, backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 80 },
  titleBlock: { alignItems: "center", marginBottom: 48 },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 36, lineHeight: 40, fontWeight: "900", letterSpacing: -0.9, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, fontWeight: "500", color: tw.gray500, textAlign: "center" },
  contact: { fontWeight: "700" },
  card: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 48,
    padding: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    boxShadow: "0px 40px 80px -20px rgba(126,56,102,0.2)",
  },
  otpRow: { flexDirection: "row", gap: 12, marginBottom: 40 },
  otpCell: { flex: 1 },
  otpBox: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: tw.gray100,
    borderWidth: 2,
    borderColor: tw.gray200,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigit: { fontSize: 26, lineHeight: 32, fontWeight: "900" },
  otpBar: { position: "absolute", bottom: -4, alignSelf: "center", width: 32, height: 4, borderRadius: 2 },
  otpBarHidden: { opacity: 0 },
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0, color: "transparent" },
  verifyBtn: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    minHeight: 64,
  },
  verifyText: { fontSize: 18, fontWeight: "700" },
  resendWrap: { alignItems: "center" },
  resendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  resendText: { fontSize: 10, fontWeight: "900", color: tw.gray400, letterSpacing: 0.25 },
  resendBtnText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  footer: {
    marginTop: 48,
    fontSize: 10,
    fontWeight: "900",
    color: tw.gray300,
    textAlign: "center",
    letterSpacing: 3,
  },
});
