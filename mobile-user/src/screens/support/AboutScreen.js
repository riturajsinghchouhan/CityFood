// Port of pages/user/profile/About.jsx: CMS about content (GET /food/pages/about) and legal links.
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Clock,
  FileText,
  Heart,
  Lock,
  Receipt,
  Shield,
  Star,
  Truck,
  Users,
  XCircle,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAbout } from "../../api";
import FadeIn from "../../components/support/FadeIn";
import { c } from "../../components/support/palette";
import Spinner from "../../components/support/Spinner";
import { Card, ScalePressable, Screen, Text } from "../../components/ui";
import { useAppSettings } from "../../context/AppSettingsContext";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";

const iconMap = { Heart, Users, Shield, Clock, Star, Award };

// The admin stores Tailwind classes (AboutUs.jsx colorOptions), e.g. "text-pink-600 dark:text-pink-400".
const FEATURE_COLORS = {
  pink: { fg: "#e60076", fgDark: "#fb64b6", bg: "#fce7f3", bgDark: "rgba(131,24,67,0.3)" },
  blue: { fg: "#155dfc", fgDark: "#51a2ff", bg: "#dbeafe", bgDark: "rgba(30,58,138,0.3)" },
  green: { fg: "#00a63e", fgDark: "#05df72", bg: "#dcfce7", bgDark: "rgba(20,83,45,0.3)" },
  orange: { fg: "#f54900", fgDark: "#ff8904", bg: "#ffedd4", bgDark: "rgba(124,45,18,0.3)" },
  purple: { fg: "#9810fa", fgDark: "#c27aff", bg: "#f3e8ff", bgDark: "rgba(88,28,135,0.3)" },
  red: { fg: "#dc2626", fgDark: "#ff6467", bg: "#ffe2e2", bgDark: "rgba(127,29,29,0.3)" },
};

function featureColors(feature, isDark) {
  const fgKey = /text-(\w+)-\d+/.exec(feature?.color || "")?.[1];
  const bgKey = /bg-(\w+)-\d+/.exec(feature?.bgColor || "")?.[1];
  const fg = FEATURE_COLORS[fgKey];
  const bg = FEATURE_COLORS[bgKey];
  return {
    fg: fg ? (isDark ? fg.fgDark : fg.fg) : isDark ? "#F3F4F6" : "#3c0f3d",
    bg: bg ? (isDark ? bg.bgDark : bg.bg) : "transparent",
  };
}

const LEGAL_LINKS = [
  { path: "/profile/terms", Icon: FileText, title: "Terms and Conditions", sub: "Read our terms and conditions" },
  { path: "/profile/privacy", Icon: Lock, title: "Privacy Policy", sub: "Learn how we protect your data" },
  { path: "/profile/refund", Icon: Receipt, title: "Refund Policy", sub: "Read our refund terms and conditions" },
  { path: "/profile/shipping", Icon: Truck, title: "Shipping Policy", sub: "Learn about our shipping terms" },
  {
    path: "/profile/cancellation",
    Icon: XCircle,
    title: "Cancellation Policy",
    sub: "Read our cancellation terms and conditions",
  },
];

// bg-primary rounded-full blur-2xl opacity-30 animate-pulse behind the logo.
function LogoGlow({ color }) {
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.glow, { opacity: pulse, boxShadow: `0px 0px 40px 12px ${color}4D` }]}
    />
  );
}

export default function AboutScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { settings, companyName } = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);
  const [aboutData, setAboutData] = useState({
    appName: "",
    version: "",
    description: "",
    logo: "",
    features: [],
    stats: [],
  });
  const logoUrl = settings?.logo?.url || null;

  useEffect(() => {
    let active = true;
    getAbout()
      .then((res) => {
        if (active && res?.success) setAboutData(res.data || {});
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const bgColors = isDark ? ["#0a0a0a", "#1a1a1a"] : [c.gray50, "#ffffff"];
  const titleColor = isDark ? "#ffffff" : c.gray900;
  const cardBg = isDark ? "#1a1a1a" : "#ffffff";
  const cardBorder = isDark ? c.gray800 : "transparent";

  if (loading) {
    return (
      <Screen>
        <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />
        <View style={[styles.loading, { minHeight: height * 0.6 }]}>
          <Spinner size={32} color={isDark ? c.gray400 : c.gray600} style={styles.loadingSpinner} />
          <Text style={[styles.loadingText, { color: isDark ? c.gray400 : c.gray600 }]}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  const appName = aboutData.appName || companyName || "About";
  const features = Array.isArray(aboutData.features) ? aboutData.features : [];

  return (
    <Screen>
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 24 + insets.bottom }]}>
        <FadeIn>
          <View style={styles.header}>
            <Pressable onPress={() => goTo("/profile")} style={styles.backBtn} accessibilityLabel="Back">
              <ArrowLeft size={16} color={titleColor} />
            </Pressable>
            <Text style={[styles.h1, { color: titleColor }]}>About</Text>
          </View>

          <FadeIn duration={500}>
            <Card
              style={[styles.infoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
            >
              <LinearGradient
                colors={isDark ? ["rgba(124,45,18,0.2)", "rgba(120,53,15,0.2)"] : [c.orange50, c.amber50]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <FadeIn delay={200} duration={500} offset={0} scaleFrom={0.8} style={styles.logoRow}>
                  <View>
                    <LogoGlow color={colors.primary} />
                    <View style={[styles.logoCircle, { backgroundColor: isDark ? c.gray800 : "#ffffff" }]}>
                      {logoUrl ? (
                        logoFailed ? null : (
                          <Image
                            source={{ uri: logoUrl }}
                            style={styles.logo}
                            contentFit="contain"
                            onError={() => setLogoFailed(true)}
                          />
                        )
                      ) : (
                        <Text style={[styles.logoLetter, { color: colors.primary }]}>
                          {(aboutData.appName || companyName || "T").charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                  </View>
                </FadeIn>
                <FadeIn delay={300} duration={500} offset={10}>
                  <Text style={[styles.appName, { color: titleColor }]}>{appName}</Text>
                </FadeIn>
                <FadeIn delay={400} duration={500} offset={10}>
                  <Text style={[styles.version, { color: isDark ? c.gray400 : c.gray600 }]}>
                    {aboutData.version ? `Version ${aboutData.version}` : " "}
                  </Text>
                </FadeIn>
                <FadeIn delay={500} duration={500} offset={10}>
                  <Text style={[styles.description, { color: isDark ? c.gray300 : c.gray700 }]}>
                    {aboutData.description
                      ? aboutData.description
                      : "This page will appear once the admin adds About content."}
                  </Text>
                </FadeIn>
              </LinearGradient>
            </Card>
          </FadeIn>

          {features.length > 0 ? (
            <FadeIn delay={700} duration={500} style={styles.features}>
              {features.map((feature, index) => {
                const Icon = iconMap[feature.icon] || Heart;
                const fc = featureColors(feature, isDark);
                return (
                  <FadeIn key={index} delay={800 + index * 100} duration={300} offset={0} scaleFrom={0.95}>
                    <ScalePressable scaleTo={0.98}>
                      <Card
                        style={[
                          styles.featureCard,
                          { backgroundColor: cardBg, borderColor: cardBorder },
                        ]}
                      >
                        <View style={styles.featureRow}>
                          <View style={[styles.featureIcon, { backgroundColor: fc.bg }]}>
                            <Icon size={24} color={fc.fg} />
                          </View>
                          <View style={styles.flex}>
                            <Text style={[styles.featureTitle, { color: titleColor }]}>{feature.title}</Text>
                            <Text style={[styles.featureDesc, { color: isDark ? c.gray400 : c.gray600 }]}>
                              {feature.description}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    </ScalePressable>
                  </FadeIn>
                );
              })}
            </FadeIn>
          ) : null}

          <FadeIn delay={1200} duration={500}>
            <Card style={[styles.legalCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.legalTitleRow}>
                <FileText size={20} color={isDark ? c.gray400 : c.gray600} />
                <Text style={[styles.legalTitle, { color: titleColor }]}>Legal Information</Text>
              </View>
              <View style={styles.legalList}>
                {LEGAL_LINKS.map(({ path, Icon, title, sub }) => (
                  <Pressable
                    key={path}
                    onPress={() => router.push(path)}
                    style={({ pressed }) => [
                      styles.legalRow,
                      pressed && { backgroundColor: isDark ? c.gray800 : c.gray50 },
                    ]}
                  >
                    <View style={[styles.legalIcon, { backgroundColor: isDark ? c.gray800 : c.gray100 }]}>
                      <Icon size={20} color={isDark ? c.gray400 : c.gray600} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.legalRowTitle, { color: titleColor }]}>{title}</Text>
                      <Text style={styles.legalRowSub}>{sub}</Text>
                    </View>
                    <ArrowRight size={20} color={c.gray400} />
                  </Pressable>
                ))}
              </View>
            </Card>
          </FadeIn>

          <FadeIn delay={1400} duration={500} offset={0}>
            <Text style={styles.footer}>
              © {new Date().getFullYear()} {companyName}. All rights reserved.
            </Text>
          </FadeIn>
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingHorizontal: 16, paddingTop: 24 },
  loading: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 24 },
  loadingSpinner: { marginBottom: 16 },
  loadingText: { fontSize: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 24, fontWeight: "700" },
  infoCard: { borderRadius: 16, borderWidth: 1, marginBottom: 24, overflow: "hidden", ...shadow.lg },
  hero: { padding: 32, alignItems: "center" },
  logoRow: { alignItems: "center", marginBottom: 24 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 9999 },
  logoCircle: {
    minWidth: 96,
    minHeight: 96,
    padding: 16,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.xl,
  },
  logo: { width: 64, height: 64, borderRadius: 9999 },
  logoLetter: { fontSize: 24, fontWeight: "700" },
  appName: { fontSize: 30, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  version: { fontSize: 14, marginBottom: 16, textAlign: "center" },
  description: { fontSize: 16, lineHeight: 26, textAlign: "center" },
  features: { gap: 16, marginBottom: 24 },
  featureCard: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, ...shadow.md },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingVertical: 20 },
  featureIcon: { borderRadius: 12, padding: 12 },
  featureTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  featureDesc: { fontSize: 14, lineHeight: 23 },
  legalCard: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, ...shadow.md },
  legalTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 16 },
  legalTitle: { fontSize: 18, fontWeight: "600" },
  legalList: { gap: 12, paddingBottom: 20 },
  legalRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 8 },
  legalIcon: { borderRadius: 8, padding: 8 },
  legalRowTitle: { fontSize: 16, fontWeight: "500" },
  legalRowSub: { fontSize: 14, color: c.gray500 },
  footer: { textAlign: "center", marginTop: 32, marginBottom: 16, fontSize: 14, color: c.gray500 },
});
