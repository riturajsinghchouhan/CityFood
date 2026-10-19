// auth/Login.jsx: banner with a crimson wave, round logo badge, "Partner Login" card with the +91
// phone input, Terms/Privacy links and trust badges. Sends a login OTP and opens /otp.
// Not ported: the "Demo" fill button (+91 9876543210 / OTP 1234), a dev shortcut.
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowRight, ChefHat, CheckCircle2, Headphones, Heart, ShieldCheck, X } from "lucide-react-native";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BannerWave, BotanicalLeaf, TomatoBadge } from "../../components/auth/LoginDecor";
import SupportDialog from "../../components/auth/SupportDialog";
import { useBranding } from "../../components/auth/useBranding";
import { ScalePressable, Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { fontFamilyByWeight, tw } from "../../theme/tokens";

const DEFAULT_COUNTRY_CODE = "+91";
const RED = "#D3122A";
const BANNER = require("../../../assets/images/restaurant-banner.jpg");
const FALLBACK_LOGO = require("../../../assets/images/logo.png");

// sessionStorage.restaurantLoginPhone: the typed number survives leaving and re-opening Login.
let lastLoginPhone = "";

const validatePhone = (num) => {
  const digits = num.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  return ["6", "7", "8", "9"].includes(digits[0]);
};

function useEntrance(delay = 0) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(v, { toValue: 1, duration: 500, delay, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [v, delay]);
  return v;
}

export default function LoginScreen() {
  const { requestOtp } = useAuth();
  const { companyName, logo } = useBranding();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState(lastLoginPhone);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const submitting = useRef(false);
  const logoAnim = useEntrance(0);
  const cardAnim = useEntrance(100);

  const isValidNumber = validatePhone(phone);

  const handleSendOTP = async () => {
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim();
    try {
      await requestOtp(fullPhone);
      lastLoginPhone = phone;
      toast.success("Verification code sent!");
      router.push({ pathname: "/otp", params: { phone: fullPhone, isSignUp: "0" } });
    } catch (apiErr) {
      toast.error(apiErr?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const onChangePhone = (text) => {
    const val = text.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
    lastLoginPhone = val;
  };

  return (
    <Screen edges={[]} background="#FFF9F4" statusBarStyle="light">
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <LinearGradient colors={["#FFFDF9", "#FFF9F4", "#FFF3EC"]} style={StyleSheet.absoluteFill} />

          {/* Banner */}
          <View style={[styles.banner, { height: 250 + insets.top }]}>
            <Image source={BANNER} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={[StyleSheet.absoluteFill, styles.dim]} />
            <LinearGradient
              colors={["rgba(122,0,24,0.9)", "rgba(153,0,34,0.6)", "transparent"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.2)", "transparent", "rgba(0,0,0,0.4)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.tomatoPos, { top: 12 + insets.top }]} pointerEvents="none">
              <TomatoBadge />
            </View>
            <View style={[styles.leafTopPos, { top: 12 + insets.top }]} pointerEvents="none">
              <BotanicalLeaf size={36} rotate={-25} opacity={0.95} />
            </View>
            <View style={[styles.chefPos, { top: 64 + insets.top }]} pointerEvents="none">
              <ChefHat size={40} color="#FF4D6D" strokeWidth={2.2} />
            </View>
            <Pressable
              onPress={() => setShowSupportModal(true)}
              style={({ pressed }) => [
                styles.supportBtn,
                { top: 20 + insets.top, backgroundColor: pressed ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.2)" },
              ]}
            >
              <Headphones size={16} color="rgba(255,255,255,0.95)" strokeWidth={2.4} />
              <Text style={styles.supportText}>Support</Text>
            </Pressable>
            <View style={styles.wave} pointerEvents="none">
              <BannerWave />
            </View>
          </View>

          {/* Logo badge + RESTAURANT PARTNER */}
          <View style={styles.logoBlock}>
            <Animated.View
              style={[
                styles.logoCircle,
                {
                  opacity: logoAnim,
                  transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                },
              ]}
            >
              <Image
                source={logo && !logoFailed ? { uri: logo } : FALLBACK_LOGO}
                onError={() => setLogoFailed(true)}
                style={styles.logoImg}
                contentFit="contain"
              />
            </Animated.View>
            <View style={styles.partnerWrap}>
              <Text style={styles.partnerText}>RESTAURANT PARTNER</Text>
              <View style={styles.partnerRule} />
            </View>
          </View>

          <View style={[styles.leafLeft, { top: 320 + insets.top }]} pointerEvents="none">
            <BotanicalLeaf size={44} rotate={-35} opacity={0.9} />
          </View>
          <View style={[styles.leafRight, { top: 340 + insets.top }]} pointerEvents="none">
            <BotanicalLeaf size={40} rotate={30} opacity={0.85} />
          </View>

          {/* Login card */}
          <View style={styles.cardWrap}>
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: cardAnim,
                  transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                },
              ]}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>
                  Partner <Text style={[styles.cardTitle, { color: RED }]}>Login</Text>
                </Text>
                <Text style={styles.cardSub}>Enter your registered mobile number to manage your restaurant</Text>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Mobile Number</Text>
                </View>
                <View
                  style={[
                    styles.inputBox,
                    focused && { borderColor: "rgba(211,18,42,0.7)", boxShadow: "0px 0px 0px 2px rgba(211,18,42,0.1)" },
                  ]}
                >
                  <View style={styles.prefix}>
                    <Image source={{ uri: "https://flagcdn.com/w40/in.png" }} style={styles.flag} contentFit="cover" />
                    <Text style={styles.prefixText}>+91</Text>
                  </View>
                  <View style={styles.divider} />
                  <TextInput
                    value={phone}
                    onChangeText={onChangePhone}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onSubmitEditing={handleSendOTP}
                    autoFocus
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="00000 00000"
                    placeholderTextColor={tw.gray300}
                    selectionColor={RED}
                    style={[styles.phoneInput, !phone && styles.phonePlaceholder]}
                  />
                  {phone.length > 0 ? (
                    <View style={styles.status}>
                      {isValidNumber ? (
                        <CheckCircle2 size={20} color="#00bc7d" strokeWidth={2.5} />
                      ) : (
                        <Pressable onPress={() => onChangePhone("")} hitSlop={8} style={styles.clearBtn}>
                          <X size={16} color={tw.gray400} />
                        </Pressable>
                      )}
                    </View>
                  ) : null}
                </View>
              </View>

              <ScalePressable
                scaleTo={0.98}
                onPress={handleSendOTP}
                disabled={loading || !isValidNumber}
                style={[styles.ctaWrap, (loading || !isValidNumber) ? styles.ctaDisabled : styles.ctaShadow]}
              >
                <LinearGradient
                  colors={["#C80F2E", RED, "#B00A25"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.cta}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator size={20} color="#ffffff" />
                      <Text style={styles.ctaText}>Verifying...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.ctaText}>Get Start</Text>
                      <ArrowRight size={20} color="#ffffff" strokeWidth={2.8} />
                    </>
                  )}
                </LinearGradient>
              </ScalePressable>
            </Animated.View>
          </View>

          {/* Terms & legal */}
          <View style={styles.legal}>
            <Text style={styles.legalText}>
              {`By continuing, you agree to ${companyName}'s\n`}
              <Text style={styles.legalLink} onPress={() => router.push("/profile/terms")}>
                {" Terms of Service "}
              </Text>
              &
              <Text style={styles.legalLink} onPress={() => router.push("/profile/privacy")}>
                {" Privacy Policy"}
              </Text>
            </Text>
          </View>

          {/* Trust badges */}
          <View style={styles.badges}>
            <View style={styles.badge}>
              <View style={styles.badgeIcon}>
                <ShieldCheck size={14} color={RED} />
              </View>
              <Text style={styles.badgeText}>BUSINESS VERIFIED</Text>
            </View>
            <View style={styles.badgeDivider} />
            <View style={styles.badge}>
              <View style={styles.badgeIcon}>
                <Heart size={14} color={RED} />
              </View>
              <Text style={styles.badgeText}>PARTNER SUCCESS</Text>
            </View>
          </View>

          <LinearGradient colors={["transparent", "#FFE8DA"]} style={[styles.bottomDecor, { marginBottom: insets.bottom }]} />
        </ScrollView>
      </KeyboardAvoidingView>

      <SupportDialog visible={showSupportModal} onClose={() => setShowSupportModal(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "space-between", paddingBottom: 24 },
  banner: { width: "100%", height: 250, overflow: "hidden" },
  dim: { backgroundColor: "rgba(0,0,0,0.08)" },
  tomatoPos: { position: "absolute", left: 12 },
  leafTopPos: { position: "absolute", left: 80 },
  chefPos: { position: "absolute", right: 36 },
  supportBtn: {
    position: "absolute",
    right: 20,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  supportText: { fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.95)" },
  wave: { position: "absolute", left: 0, right: 0, bottom: -4 },
  logoBlock: { zIndex: 20, alignItems: "center", marginTop: -64 },
  logoCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#ffffff",
    borderWidth: 4,
    borderColor: "#ffffff",
    padding: 6,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 12px 32px rgba(0,0,0,0.12)",
  },
  logoImg: { width: "100%", height: "100%" },
  partnerWrap: { marginTop: 12, alignItems: "center" },
  partnerText: { fontSize: 12, fontWeight: "900", letterSpacing: 3.1, color: tw.gray600 },
  partnerRule: { width: 48, height: 4, borderRadius: 2, backgroundColor: RED, marginTop: 6 },
  leafLeft: { position: "absolute", left: -8, zIndex: 10 },
  leafRight: { position: "absolute", right: -8, zIndex: 10 },
  cardWrap: { zIndex: 20, paddingHorizontal: 20, marginTop: 16 },
  card: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "#ffffff",
    padding: 24,
    boxShadow: "0px 15px 45px rgba(0,0,0,0.06)",
  },
  cardHead: { alignItems: "center", marginBottom: 24 },
  cardTitle: { fontSize: 30, lineHeight: 36, fontWeight: "900", color: "#111827", letterSpacing: -0.75 },
  cardSub: {
    fontSize: 14,
    lineHeight: 23,
    fontWeight: "500",
    color: "#64748b",
    textAlign: "center",
    maxWidth: 270,
    marginTop: 8,
  },
  fieldBlock: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase", color: RED },
  inputBox: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    boxShadow: "0px 1px rgba(0,0,0,0.05)",
  },
  prefix: { flexDirection: "row", alignItems: "center", gap: 8 },
  flag: { width: 20, height: 13, borderRadius: 2 },
  prefixText: { fontSize: 16, fontWeight: "700", color: "#1f2937", letterSpacing: -0.4 },
  divider: { height: 24, width: 1, backgroundColor: tw.gray200, marginHorizontal: 12 },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 16,
    letterSpacing: 0.8,
    color: "#111827",
    fontFamily: fontFamilyByWeight["700"],
  },
  phonePlaceholder: { fontFamily: fontFamilyByWeight["400"], letterSpacing: 1.6 },
  status: { paddingRight: 4, flexDirection: "row", alignItems: "center" },
  clearBtn: { padding: 4, borderRadius: 9999 },
  ctaWrap: { marginTop: 20, borderRadius: 9999 },
  ctaShadow: { boxShadow: "0px 12px 28px rgba(211,18,42,0.36)" },
  ctaDisabled: { opacity: 0.5 },
  cta: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 9999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { fontSize: 17, fontWeight: "700", color: "#ffffff", letterSpacing: 0.4 },
  legal: { zIndex: 20, paddingHorizontal: 16, marginTop: 24 },
  legalText: { fontSize: 12, lineHeight: 20, fontWeight: "500", color: tw.gray500, textAlign: "center" },
  legalLink: { fontSize: 12, fontWeight: "700", color: RED, textDecorationLine: "underline" },
  badges: {
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: 24,
    paddingBottom: 8,
  },
  badge: { flexDirection: "row", alignItems: "center", gap: 6 },
  badgeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(211,18,42,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.25, color: tw.gray400 },
  badgeDivider: { height: 16, width: 1, backgroundColor: tw.gray300 },
  bottomDecor: { width: "100%", height: 32, opacity: 0.4 },
});
