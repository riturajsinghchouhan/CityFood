// auth/SignIn.jsx (/login): logo badge, "Deliver smiles. / Earn on your schedule.", the rider hero,
// a +91 phone pill and "Send OTP to Register/Login" -> requestOtp -> /otp. The phone draft is kept in
// delivery_draft_phone (falling back to deliveryAuthData.phone), like the web.
import { LinearGradient } from "expo-linear-gradient";
import { Link, router, useLocalSearchParams } from "expo-router";
import { ArrowRight, CheckCircle2, ChevronDown, Headphones, Smartphone, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { getBusinessSettings } from "../../api";
import LoginDecorations, { IndiaFlag } from "../../components/auth/LoginDecorations";
import { REFERRAL_KEY } from "../../components/auth/referral";
import { AppImage, ScalePressable, Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { KEYS, store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { fontFamilyByWeight, tw } from "../../theme/tokens";

const LOGO = require("../../../assets/images/logo.png");
const HERO = require("../../../assets/images/delivery-hero-clean.png");
const HERO_RATIO = 576 / 206;
const SLATE = "#1e293b";
const TEAL = "#0f766e";
const GUTTER = 17.6; // px-6, shrunk to 1.1rem under 640px by deliveryTheme.css

const validatePhone = (num) => {
  const digits = String(num || "").replace(/\D/g, "");
  return digits.length === 10 && ["6", "7", "8", "9"].includes(digits[0]);
};

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const { colors, logoUrl: configLogo } = useTheme();
  const { requestOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsLogo, setSettingsLogo] = useState(null);
  const submitting = useRef(false);
  const [logoIn] = useState(() => new Animated.Value(0));
  const [heroIn] = useState(() => new Animated.Value(0));
  const { ref } = useLocalSearchParams();

  // toNativePath maps a /signup?ref= link to /login?ref=; keep the referral for SignupDetails.
  useEffect(() => {
    const refId = typeof ref === "string" ? ref.trim().slice(0, 64) : "";
    if (refId) store.set(REFERRAL_KEY, refId);
  }, [ref]);

  // Draft phone, else the phone of a pending OTP hand-off.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await store.get(KEYS.draftPhone);
      let initial = draft ? String(draft) : "";
      if (!initial) {
        const authData = await store.get(KEYS.authData);
        initial = authData?.phone ? String(authData.phone).replace("+91", "").trim() : "";
      }
      if (!cancelled && initial) setPhone((prev) => prev || initial);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // useAppLogo("delivery_app"): business settings deliveryLogo, then logo, then the app-config logo.
  useEffect(() => {
    let cancelled = false;
    getBusinessSettings()
      .then((res) => {
        const s = res?.data || {};
        const url = s.deliveryLogo?.url || s.logo?.url || null;
        if (!cancelled && url) setSettingsLogo(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    Animated.spring(logoIn, { toValue: 1, stiffness: 200, damping: 20, useNativeDriver: true }).start();
    Animated.timing(heroIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [logoIn, heroIn]);

  const isValidNumber = validatePhone(phone);

  const onChangePhone = (text) => {
    const val = text.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
    store.set(KEYS.draftPhone, val);
  };

  const handleSendOTP = async () => {
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      await requestOtp(`+91 ${phone}`);
      toast.success("Verification code sent to your phone!");
      router.push("/otp");
    } catch (err) {
      toast.error(err?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const logo = settingsLogo || configLogo;
  const disabled = loading || !isValidNumber;

  return (
    <Screen background="#FFFDF9">
      <LinearGradient colors={["#FFFDF9", "#FDF9F2", "#FFFBF5"]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LoginDecorations />

          <View style={styles.top}>
            <Animated.View
              style={[
                styles.logoBadge,
                { opacity: logoIn, transform: [{ scale: logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
              ]}
            >
              {logo ? (
                <AppImage
                  src={logo}
                  fallbackSrc={LOGO}
                  contentFit="contain"
                  placeholderType="none"
                  style={styles.logoImg}
                />
              ) : (
                <Image source={LOGO} style={styles.logoImg} resizeMode="contain" />
              )}
            </Animated.View>

            <View style={styles.copy}>
              <Text heading style={[styles.h1, { color: SLATE }]}>
                Deliver smiles.
              </Text>
              <Text heading style={[styles.h1, { color: TEAL }]}>
                Earn on your schedule.
              </Text>
              <Text heading style={styles.h2}>
                Delivery Partner Login
              </Text>
              <Text style={styles.sub}>Login with your mobile number to continue</Text>
            </View>
          </View>

          <Animated.View
            style={[
              styles.heroWrap,
              {
                width,
                opacity: heroIn,
                transform: [
                  { translateY: heroIn.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
                  { scale: heroIn.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
                ],
              },
            ]}
          >
            <Image source={HERO} style={{ width, height: width / HERO_RATIO }} resizeMode="cover" />
          </Animated.View>

          <View style={styles.bottom}>
            <View style={styles.pill}>
              <View style={styles.cc}>
                <IndiaFlag width={20} />
                <Text style={styles.ccText}>+91</Text>
                <ChevronDown size={14} color={tw.gray500} strokeWidth={2.2} />
              </View>
              <View style={styles.vDivider} />
              <Smartphone size={18} color={tw.gray400} strokeWidth={2} style={styles.phoneIcon} />
              <TextInput
                value={phone}
                onChangeText={onChangePhone}
                keyboardType="phone-pad"
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
                placeholder="9755633147"
                placeholderTextColor={tw.gray300}
                selectionColor={colors.primary}
                returnKeyType="done"
                onSubmitEditing={handleSendOTP}
                style={[styles.input, phone ? styles.inputFilled : null]}
              />
              {phone.length > 0 ? (
                <View style={styles.status}>
                  {isValidNumber ? (
                    <CheckCircle2 size={20} color={colors.primary} strokeWidth={2.5} />
                  ) : (
                    <Pressable onPress={() => onChangePhone("")} style={styles.clearBtn} hitSlop={8}>
                      <X size={16} color={tw.gray400} />
                    </Pressable>
                  )}
                </View>
              ) : null}
            </View>

            <ScalePressable
              scaleTo={0.98}
              onPress={handleSendOTP}
              disabled={disabled}
              style={[styles.ctaWrap, disabled ? styles.ctaDisabled : styles.ctaShadow]}
            >
              <LinearGradient
                colors={["#00A896", "#02C39A", "#05D59C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {loading ? (
                  <View style={styles.row8}>
                    <ActivityIndicator size={20} color="#ffffff" />
                    <Text style={styles.ctaText}>Sending OTP...</Text>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <Text style={styles.ctaText}>Send OTP to Register/Login</Text>
                    <View style={styles.arrowBadge}>
                      <ArrowRight size={16} color="#ffffff" strokeWidth={2.8} />
                    </View>
                  </View>
                )}
              </LinearGradient>
            </ScalePressable>

            <View style={styles.supportRow}>
              <ScalePressable scaleTo={0.95} onPress={() => router.push("/support")} style={styles.supportBtn}>
                <Headphones size={16} color="#0f172a" strokeWidth={2.2} />
                <Text style={styles.supportText}>Need Help? Support</Text>
              </ScalePressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                By continuing, you agree to our{"\n"}
                <Link href="/profile/terms" style={styles.footerLink}>
                  {" Terms "}
                </Link>
                &
                <Link href="/profile/privacy" style={styles.footerLink}>
                  {" Privacy Policy"}
                </Link>
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
  container: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingTop: 28,
    paddingBottom: 24,
  },
  top: { zIndex: 20, alignItems: "center", paddingTop: 4 },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#ffffff",
    borderWidth: 4,
    borderColor: "#ffffff",
    padding: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    boxShadow: "0px 8px 24px rgba(0,0,0,0.08)",
  },
  logoImg: { width: "100%", height: "100%", backgroundColor: "transparent" },
  copy: { alignItems: "center", paddingHorizontal: 8 },
  h1: { fontSize: 26, lineHeight: 30, fontWeight: "900", letterSpacing: -0.65, textAlign: "center" },
  h2: { fontSize: 19, lineHeight: 28, fontWeight: "700", color: SLATE, letterSpacing: -0.475, marginTop: 10 },
  sub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: "#64748b",
    marginTop: 4,
    maxWidth: 240,
    textAlign: "center",
  },
  heroWrap: { marginHorizontal: -GUTTER, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  bottom: { zIndex: 20, width: "100%", gap: 14 },
  pill: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(243,244,246,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    boxShadow: "0px 4px 22px rgba(0,0,0,0.06)",
  },
  cc: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, paddingRight: 10 },
  ccText: { fontSize: 15, fontWeight: "700", color: SLATE, letterSpacing: -0.375 },
  vDivider: { height: 24, width: 1.5, backgroundColor: tw.gray200, marginHorizontal: 8 },
  phoneIcon: { marginRight: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 16,
    color: SLATE,
    fontFamily: fontFamilyByWeight["500"],
  },
  inputFilled: { fontFamily: fontFamilyByWeight["700"], letterSpacing: 0.8 },
  status: { paddingRight: 4, flexDirection: "row", alignItems: "center" },
  clearBtn: { padding: 4, borderRadius: 9999 },
  ctaWrap: { width: "100%", borderRadius: 9999 },
  ctaShadow: { boxShadow: "0px 12px 26px -6px rgba(2,195,154,0.45)" },
  ctaDisabled: { opacity: 0.5 },
  cta: { width: "100%", paddingVertical: 16, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  row8: { flexDirection: "row", alignItems: "center", gap: 8 },
  ctaText: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: "#ffffff", letterSpacing: 0.4 },
  arrowBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  supportRow: { alignItems: "center", paddingTop: 4 },
  supportBtn: {
    width: "100%",
    maxWidth: 270,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.2)",
    backgroundColor: "rgba(255,255,255,0.9)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0px 2px 8px rgba(0,0,0,0.04)",
  },
  supportText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: "#0f172a" },
  footer: { alignItems: "center", paddingTop: 8 },
  footerText: { fontSize: 11, lineHeight: 18, fontWeight: "500", color: tw.gray500, textAlign: "center" },
  footerLink: { fontSize: 11, fontWeight: "700", color: TEAL, fontFamily: fontFamilyByWeight["700"] },
});
