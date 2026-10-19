// Port of Frontend/src/modules/auth/pages/Login.jsx (phone -> OTP -> name for a new user).
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ArrowRight,
  ChevronDown,
  CircleCheck,
  Headphones,
  Pen,
  RotateCcw,
  Smartphone,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { updateProfile } from "../../api";
import AccountDialog from "../../components/account/AccountDialog";
import FadeInUp from "../../components/account/FadeInUp";
import LoginDecor from "../../components/account/LoginDecor";
import { FontScope, ScalePressable, Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { goTo, useBackOverride } from "../../navigation/back";
import { KEYS, store } from "../../storage";
import { tw } from "../../theme/tokens";

const RESEND_COOLDOWN_SECONDS = 60;
const RED = "#E52E2E";
const GREEN = "#0A4D27";
const OTP_INDEXES = [0, 1, 2, 3, 4, 5];
const LOGO = require("../../../assets/images/logo.png");
const BOTTOM_BANNER = require("../../../assets/images/public-food/login-bottom-banner.png");

// sessionStorage "draft_phone_login": kept for the app session only.
let draftPhone = "";

function LogoBadge() {
  const [scale] = useState(() => new Animated.Value(0.85));
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.spring(scale, { toValue: 1, bounciness: 10, speed: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [scale, opacity]);
  return (
    <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
      <Image source={LOGO} style={styles.logo} contentFit="cover" />
    </Animated.View>
  );
}

function LoginScreenContent() {
  const { requestOtp, verifyOtp, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [phoneNumber, setPhoneNumber] = useState(draftPhone);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  // Set when verify logged in an existing account that has no name yet (web's tempAuth path).
  const [tempAuth, setTempAuth] = useState(null);
  const [pendingVerify, setPendingVerify] = useState(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [focusedOtp, setFocusedOtp] = useState(-1);
  const submitting = useRef(false);
  const otpRefs = useRef([]);

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15);
    return digits.length >= 8 ? digits : "";
  };

  const handleSendOTP = async () => {
    const phone = normalizedPhone();
    if (phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      await requestOtp(phoneNumber);
      setOtp("");
      setStep(2);
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      toast.success("OTP sent successfully!");
    } catch (err) {
      toast.error(err?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const handleResendOTP = async () => {
    const phone = normalizedPhone();
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (resendTimer > 0 || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      await requestOtp(phoneNumber);
      setOtp("");
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      toast.success("OTP resent successfully.");
    } catch (err) {
      toast.error(err?.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const handleEditNumber = () => {
    setStep(1);
    setOtp("");
    setResendTimer(0);
    setPendingVerify(null);
    setShowNameModal(false);
    setNewName("");
  };

  useBackOverride(() => {
    if (step === 2) {
      handleEditNumber();
      return true;
    }
    return false;
  });

  const handleVerifyOTP = async () => {
    const otpDigits = String(otp).replace(/\D/g, "").slice(0, 6);
    if (otpDigits.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    let fcmToken = null;
    try {
      fcmToken = (await store.get(KEYS.fcmToken)) || null;
    } catch {
      fcmToken = null;
    }
    try {
      const result = await verifyOtp({ phone: phoneNumber, otp: otpDigits, fcmToken });
      if (result?.needsName) {
        setPendingVerify({ phone: phoneNumber, otp: otpDigits, fcmToken });
        setShowNameModal(true);
        return;
      }
      const user = result?.user;
      const nameMissing =
        user && (!user.name || String(user.name).trim().length === 0 || String(user.name).toLowerCase() === "null");
      if (nameMissing) {
        setTempAuth({ user });
        setShowNameModal(true);
        return;
      }
      toast.success("Welcome back!");
      goTo("/");
    } catch (err) {
      const status = err?.status;
      let msg = err?.message || "Invalid OTP. Please try again.";
      const nameRequired =
        /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(
          String(msg),
        );
      if (nameRequired) {
        setPendingVerify({ phone: phoneNumber, otp: otpDigits, fcmToken });
        setShowNameModal(true);
        return;
      }
      if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support.";
        } else {
          msg = "Invalid or expired code, or account not active.";
        }
      }
      toast.error(msg);
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const handleNameSubmit = async () => {
    if (!newName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    try {
      setIsUpdatingName(true);
      if (pendingVerify) {
        await verifyOtp({
          phone: pendingVerify.phone,
          otp: pendingVerify.otp,
          name: newName.trim(),
          fcmToken: pendingVerify.fcmToken,
        });
        setPendingVerify(null);
        toast.success(`Welcome, ${newName.trim()}!`);
        setShowNameModal(false);
        goTo("/");
        return;
      }
      await updateProfile({ name: newName.trim() });
      updateUser({ ...(tempAuth?.user || {}), name: newName.trim() });
      toast.success(`Welcome, ${newName.trim()}!`);
      setShowNameModal(false);
      goTo("/");
    } catch (err) {
      toast.error("Failed to update name. You can skip this for now or try again.");
      console.error(err);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const closeNameModal = () => {
    setShowNameModal(false);
    // The account is already signed in on this path, so leaving the prompt continues to Home.
    if (tempAuth) goTo("/");
  };

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return undefined;
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [step, resendTimer]);

  const otpFilled = otp.replace(/\D/g, "").length === 6;

  return (
    <Screen background="#FAF7F2" edges={["top"]} statusBarStyle="dark">
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.flexGrow}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.page, { minHeight: windowHeight - insets.top }]}>
            <LoginDecor />

            <View style={styles.topBar}>
              <ScalePressable scaleTo={0.95} onPress={() => router.push("/support")} style={styles.supportPill}>
                <Headphones size={16} color="#FF6900" strokeWidth={2.5} />
                <Text style={styles.supportText}>SUPPORT</Text>
              </ScalePressable>
            </View>

            <View style={styles.main}>
              <LogoBadge />

              <FadeInUp from={15} duration={400} delay={100} style={styles.heading}>
                {step === 1 ? (
                  <>
                    <Text style={[styles.h1, { color: GREEN }]}>Delicious food</Text>
                    <View style={styles.h1Row}>
                      <Text style={[styles.h1, { color: RED }]}>Delivered fast</Text>
                      <Text style={styles.emoji}>🍕</Text>
                    </View>
                    <Text style={styles.subtitle}>Login with your mobile number</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.h1Otp}>Verify OTP</Text>
                    <View style={styles.sentRow}>
                      <Text style={styles.subtitleSmall}>
                        Code sent to <Text style={[styles.subtitleSmall, styles.strong]}>+91 {phoneNumber}</Text>
                      </Text>
                      <Pressable
                        onPress={handleEditNumber}
                        accessibilityLabel="Change phone number"
                        hitSlop={8}
                        style={styles.editBtn}
                      >
                        <Pen size={14} color={RED} />
                      </Pressable>
                    </View>
                  </>
                )}
              </FadeInUp>

              <View style={styles.form}>
                {step === 1 ? (
                  <FadeInUp key="step-1" style={styles.formInner}>
                    <View
                      style={[
                        styles.phonePill,
                        phoneFocused && { borderColor: "#ffa2a2", boxShadow: "0px 8px 30px rgba(229,46,46,0.12)" },
                      ]}
                    >
                      <View style={styles.country}>
                        <Text style={styles.countryText}>IN</Text>
                        <ChevronDown size={16} color={tw.gray500} strokeWidth={2.2} />
                      </View>
                      <View style={styles.vDivider} />
                      <Smartphone size={20} color={tw.gray400} strokeWidth={1.8} style={styles.phoneIcon} />
                      <View style={styles.phoneInputRow}>
                        <Text style={styles.prefix}>+91</Text>
                        <TextInput
                          value={phoneNumber}
                          onChangeText={(text) => {
                            const val = text.replace(/\D/g, "").slice(0, 10);
                            setPhoneNumber(val);
                            draftPhone = val;
                          }}
                          onFocus={() => setPhoneFocused(true)}
                          onBlur={() => setPhoneFocused(false)}
                          onSubmitEditing={handleSendOTP}
                          keyboardType="number-pad"
                          maxLength={10}
                          autoFocus
                          placeholder="9755633314"
                          placeholderTextColor={tw.gray400}
                          selectionColor={RED}
                          style={[
                            styles.phoneInput,
                            { fontWeight: phoneNumber ? "600" : "400" },
                          ]}
                        />
                      </View>
                    </View>

                    <ScalePressable
                      scaleTo={0.98}
                      disabled={loading}
                      onPress={handleSendOTP}
                      style={[styles.redButton, styles.mt16]}
                    >
                      {loading ? (
                        <ActivityIndicator size={24} color="#ffffff" />
                      ) : (
                        <>
                          <Text style={styles.redButtonText}>Send OTP</Text>
                          <ArrowRight size={20} color="#ffffff" strokeWidth={2.5} />
                        </>
                      )}
                    </ScalePressable>

                    <Text style={styles.terms}>
                      By continuing, you agree to our{" "}
                      <Text style={styles.termsLink} onPress={() => router.push("/profile/terms")}>
                        Terms & Privacy Policy
                      </Text>
                    </Text>
                  </FadeInUp>
                ) : (
                  <FadeInUp key="step-2" style={styles.formInner}>
                    <View style={styles.otpRow}>
                      {OTP_INDEXES.map((index) => (
                        <TextInput
                          key={index}
                          ref={(el) => {
                            otpRefs.current[index] = el;
                          }}
                          value={otp[index] || ""}
                          onChangeText={(text) => {
                            // Web logic, but focus moves asynchronously on Android, so fast
                            // typing or an autofilled code can land several digits in one box:
                            // spread them over the following boxes.
                            // A filled box keeps its digit (web maxLength={1}); extra digits continue
                            // in the next boxes.
                            let digits = text.replace(/\D/g, "");
                            let start = index;
                            if (digits.length > 1 && otp[index] && digits.startsWith(otp[index])) {
                              digits = digits.slice(1);
                              start = index + 1;
                            }
                            if (start > 5) return;
                            const chars = digits ? digits.split("").slice(0, 6 - start) : [""];
                            setOtp((prev) => {
                              const newOtp = prev.split("");
                              chars.forEach((c, k) => {
                                newOtp[start + k] = c;
                              });
                              return newOtp.join("").slice(0, 6);
                            });
                            const next = start + chars.length;
                            if (digits && next <= 5) otpRefs.current[next]?.focus();
                          }}
                          onKeyPress={({ nativeEvent }) => {
                            if (nativeEvent.key !== "Backspace") return;
                            if (!otp[index] && index > 0) {
                              otpRefs.current[index - 1]?.focus();
                            } else {
                              const newOtp = otp.split("");
                              newOtp[index] = "";
                              setOtp(newOtp.join(""));
                            }
                          }}
                          onFocus={() => setFocusedOtp(index)}
                          onBlur={() => setFocusedOtp((cur) => (cur === index ? -1 : cur))}
                          keyboardType="number-pad"
                          autoFocus={index === 0}
                          selectionColor={RED}
                          textAlign="center"
                          style={[
                            styles.otpBox,
                            focusedOtp === index && {
                              borderColor: RED,
                              boxShadow: "0px 0px 0px 2px rgba(229,46,46,0.2)",
                            },
                          ]}
                        />
                      ))}
                    </View>

                    <View style={styles.resendRow}>
                      {resendTimer > 0 ? (
                        <Text style={styles.resendText}>
                          Resend code in <Text style={[styles.resendText, styles.resendStrong]}>{resendTimer}s</Text>
                        </Text>
                      ) : (
                        <Pressable onPress={handleResendOTP} disabled={loading} style={styles.resendBtn} hitSlop={6}>
                          <RotateCcw size={12} color={RED} />
                          <Text style={styles.resendBtnText}>Resend OTP</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={handleEditNumber} hitSlop={6}>
                        <Text style={styles.changeNumber}>Change Number</Text>
                      </Pressable>
                    </View>

                    <ScalePressable
                      scaleTo={0.98}
                      disabled={loading || !otpFilled}
                      onPress={handleVerifyOTP}
                      style={[styles.redButton, styles.mt12, (loading || !otpFilled) && styles.disabled]}
                    >
                      {loading ? (
                        <ActivityIndicator size={24} color="#ffffff" />
                      ) : (
                        <>
                          <Text style={styles.redButtonText}>Verify & Login</Text>
                          <CircleCheck size={20} color="#ffffff" strokeWidth={2.2} />
                        </>
                      )}
                    </ScalePressable>
                  </FadeInUp>
                )}
              </View>
            </View>

            <View pointerEvents="none" style={styles.bannerWrap}>
              <Image source={BOTTOM_BANNER} style={styles.banner} contentFit="cover" contentPosition="top" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AccountDialog
        visible={showNameModal}
        onClose={closeNameModal}
        maxWidth={512}
        style={styles.nameDialog}
        closeColor={tw.gray900}
      >
        <Text style={styles.nameTitle}>Welcome to CityFood! 🎉</Text>
        <Text style={styles.nameDesc}>
          What should we call you? Please enter your name to complete your profile.
        </Text>
        <View style={styles.nameForm}>
          <View style={styles.nameField}>
            <Text style={styles.nameLabel}>FULL NAME</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. John Doe"
              placeholderTextColor={tw.gray400}
              selectionColor={RED}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleNameSubmit}
              style={styles.nameInput}
            />
          </View>
          <Pressable
            onPress={handleNameSubmit}
            disabled={isUpdatingName || !newName.trim()}
            style={[styles.nameButton, (isUpdatingName || !newName.trim()) && styles.nameButtonDisabled]}
          >
            {isUpdatingName ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.nameButtonText}>Continue to CityFood</Text>
            )}
          </Pressable>
        </View>
      </AccountDialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  page: { justifyContent: "space-between", overflow: "hidden" },
  topBar: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8, flexDirection: "row", justifyContent: "flex-end", zIndex: 20 },
  supportPill: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tw.gray100,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    boxShadow: "0px 2px 10px rgba(0,0,0,0.06)",
  },
  supportText: { color: "#1D293D", fontWeight: "800", fontSize: 12, letterSpacing: 0.6 },
  main: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: 4, paddingBottom: 16, zIndex: 20 },
  logoWrap: {
    width: 176,
    height: 176,
    marginBottom: 20,
    borderRadius: 88,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 12px 28px rgba(0,0,0,0.08)",
  },
  logo: { width: "100%", height: "100%", transform: [{ scale: 1.04 }] },
  heading: { width: "100%", alignItems: "center", marginBottom: 24 },
  h1: { fontSize: 34, fontWeight: "800", letterSpacing: -1.02, lineHeight: 38, textAlign: "center" },
  h1Row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 2 },
  emoji: { fontSize: 32, lineHeight: 38 },
  subtitle: { color: "#6A7282", fontWeight: "500", fontSize: 15, marginTop: 8, textAlign: "center" },
  h1Otp: { fontSize: 30, fontWeight: "800", letterSpacing: -0.75, color: GREEN, textAlign: "center" },
  sentRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 },
  subtitleSmall: { color: "#6A7282", fontWeight: "500", fontSize: 15 },
  strong: { fontWeight: "700" },
  editBtn: { padding: 4, borderRadius: 999 },
  form: { width: "100%", maxWidth: 360 },
  formInner: { width: "100%", alignItems: "center" },
  phonePill: {
    width: "100%",
    height: 58,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(243,244,246,0.9)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    boxShadow: "0px 4px 22px rgba(0,0,0,0.06)",
  },
  country: { flexDirection: "row", alignItems: "center", gap: 4 },
  countryText: { fontWeight: "700", color: "#101828", fontSize: 15, letterSpacing: 0.375 },
  vDivider: { height: 24, width: 1, backgroundColor: tw.gray200, marginHorizontal: 12 },
  phoneIcon: { marginRight: 10 },
  phoneInputRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  prefix: { fontWeight: "600", color: tw.gray700, fontSize: 15, marginRight: 6 },
  phoneInput: { flex: 1, color: "#101828", fontSize: 16, letterSpacing: 0.8, padding: 0, height: 40 },
  redButton: {
    width: "100%",
    height: 56,
    borderRadius: 999,
    backgroundColor: RED,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0px 12px 28px rgba(229,46,46,0.36)",
  },
  redButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 17 },
  mt16: { marginTop: 16 },
  mt12: { marginTop: 12 },
  disabled: { opacity: 0.6 },
  terms: { fontSize: 12, color: "#6A7282", textAlign: "center", marginTop: 16 },
  termsLink: { fontSize: 12, color: GREEN, fontWeight: "700", textDecorationLine: "underline" },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, width: "100%", marginBottom: 16 },
  otpBox: {
    width: 48,
    height: 56,
    fontSize: 24,
    fontWeight: "700",
    color: "#101828",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 16,
    padding: 0,
    boxShadow: "0px 2px 10px rgba(0,0,0,0.04)",
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  resendText: { fontSize: 12, color: tw.gray500, fontWeight: "500" },
  resendStrong: { color: tw.gray800, fontWeight: "700" },
  resendBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  resendBtnText: { fontSize: 12, color: RED, fontWeight: "700" },
  changeNumber: { fontSize: 12, color: tw.gray600, fontWeight: "500" },
  bannerWrap: { width: "100%", zIndex: 10, marginTop: "auto" },
  banner: { width: "100%", aspectRatio: 576 / 236 },
  nameDialog: { backgroundColor: "#ffffff", borderRadius: 24, padding: 24, borderWidth: 0 },
  nameTitle: { fontSize: 20, fontWeight: "800", color: GREEN, textAlign: "center", paddingHorizontal: 24 },
  nameDesc: { textAlign: "center", color: tw.gray600, fontSize: 14, marginTop: 4 },
  nameForm: { marginTop: 16, gap: 16 },
  nameField: { gap: 6 },
  nameLabel: { fontSize: 12, fontWeight: "700", color: tw.gray700, letterSpacing: 0.6 },
  nameInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: tw.gray50,
    borderWidth: 1,
    borderColor: tw.gray200,
    color: tw.gray900,
    fontWeight: "600",
    fontSize: 16,
    paddingHorizontal: 12,
  },
  nameButton: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(239,68,68,0.3), 0px 4px 6px -4px rgba(239,68,68,0.3)",
  },
  nameButtonDisabled: { opacity: 0.5 },
  nameButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
});

// The web login renders in the system font (ui-sans-serif), not Poppins.
export default function LoginScreen() {
  return (
    <FontScope family="system">
      <LoginScreenContent />
    </FontScope>
  );
}
