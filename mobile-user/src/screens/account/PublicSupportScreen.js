// Port of Frontend/src/modules/auth/pages/PublicSupport.jsx (public; no dark variant on web).
import { router } from "expo-router";
import { ArrowLeft, Clock, Mail, MessageSquare, Phone, ShieldCheck } from "lucide-react-native";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Screen, Text } from "../../components/ui";
import { useAppSettings } from "../../context/AppSettingsContext";
import { goTo } from "../../navigation/back";
import { tw } from "../../theme/tokens";

const RED = "#DC2626";
const DEFAULT_EMAIL = "switcheatsofficial@gmail.com";
const DEFAULT_PHONE = "8919142335";
const DEFAULT_HOURS = "Merchant support is available from 8 AM to 12 AM, 7 days a week.";

const FAQS = [
  {
    question: "How to update menu prices?",
    answer: "You can update prices instantly through the 'Menu Management' section in your portal.",
  },
  {
    question: "Delay in payout settlement?",
    answer: "Payouts are settled within 48 hours of order completion. Contact support for delays exceeding 3 days.",
  },
  {
    question: "Technical issue with tablet?",
    answer: "Restart the app and check internet connectivity. If issue persists, call our technical helpline.",
  },
];

function ContactCard({ Icon, title, value, action, onPress }) {
  return (
    <View style={styles.contactCard}>
      <View style={styles.iconBox}>
        <Icon size={20} color={RED} />
      </View>
      <Text style={styles.contactTitle}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={4}>
        <Text style={styles.contactValue}>{value}</Text>
      </Pressable>
      <Pressable onPress={onPress} hitSlop={6}>
        <Text style={styles.contactAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

function InfoCard({ Icon, title, text }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Icon size={18} color={RED} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoText}>{text}</Text>
      </View>
    </View>
  );
}

export default function PublicSupportScreen() {
  const { settings: data } = useAppSettings();
  const settings = {
    supportEmail: data?.supportEmail || DEFAULT_EMAIL,
    supportPhone: data?.supportPhone || DEFAULT_PHONE,
    supportHours: data?.supportHours || DEFAULT_HOURS,
  };
  const phoneHref = `tel:${String(settings.supportPhone).replace(/[^0-9+]/g, "")}`;
  const mailHref = `mailto:${settings.supportEmail}`;
  const open = (url) => Linking.openURL(url).catch(() => {});
  const goBack = () => (router.canGoBack() ? router.back() : goTo("/login"));

  return (
    <Screen background="#F8F9FA" statusBarStyle="dark">
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={20} color={tw.gray800} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSub}>RESTAURANT PARTNER INFORMATION</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.contacts}>
          <ContactCard
            Icon={Mail}
            title="MERCHANT SUPPORT"
            value={settings.supportEmail}
            action="EMAIL SUPPORT"
            onPress={() => open(mailHref)}
          />
          <ContactCard
            Icon={Phone}
            title="MERCHANT HELPLINE"
            value={settings.supportPhone}
            action="INSTANT CALL"
            onPress={() => open(phoneHref)}
          />
        </View>

        <View style={styles.faqSection}>
          <Text style={styles.faqHeading}>Merchant FAQs</Text>
          <View style={styles.faqList}>
            {FAQS.map((faq) => (
              <View key={faq.question} style={styles.faqRow}>
                <View style={styles.faqIcon}>
                  <MessageSquare size={18} color={RED} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.faqQ}>{faq.question}</Text>
                  <Text style={styles.faqA}>{faq.answer}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.infoList}>
          <InfoCard Icon={Clock} title="BUSINESS HOURS" text={settings.supportHours} />
          <InfoCard
            Icon={ShieldCheck}
            title="SECURE SUPPORT"
            text="Our support staff will never ask for your password or financial credentials."
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, styles.mb4]}>LAST UPDATED: JUNE 2, 2026</Text>
          <Text style={styles.footerText}>© 2026 SWITCHEATS. ALL RIGHTS RESERVED.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const cardShadow = { boxShadow: "0px 2px 10px -4px rgba(0,0,0,0.05)" };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
  },
  backBtn: { padding: 4, borderRadius: 999 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: tw.gray900, lineHeight: 22 },
  headerSub: { fontSize: 10, fontWeight: "700", color: tw.gray400, letterSpacing: 0.5, marginTop: 2 },
  content: { paddingHorizontal: 16, paddingVertical: 24 },
  contacts: { gap: 16, marginBottom: 32 },
  contactCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: tw.gray50,
    ...cardShadow,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: RED,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    backgroundColor: "rgba(254,242,242,0.5)",
  },
  contactTitle: { fontSize: 11, fontWeight: "700", color: tw.gray900, letterSpacing: 1.1, marginBottom: 8, textAlign: "center" },
  contactValue: { fontSize: 13, fontWeight: "500", color: tw.gray600, marginBottom: 12, textAlign: "center" },
  contactAction: { fontSize: 10, fontWeight: "700", color: RED, letterSpacing: 1 },
  faqSection: { marginBottom: 32 },
  faqHeading: { fontSize: 17, fontWeight: "700", color: tw.gray900, marginBottom: 24 },
  faqList: { gap: 24 },
  faqRow: { flexDirection: "row", gap: 12 },
  faqIcon: { marginTop: 2 },
  faqQ: { fontSize: 13, fontWeight: "700", color: tw.gray900, marginBottom: 4 },
  faqA: { fontSize: 12, color: tw.gray500, lineHeight: 19.5 },
  infoList: { gap: 12, marginBottom: 48 },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    gap: 16,
    borderWidth: 1,
    borderColor: tw.gray50,
    ...cardShadow,
  },
  infoIcon: { marginTop: 2 },
  infoTitle: { fontSize: 10, fontWeight: "700", color: tw.gray900, letterSpacing: 1, marginBottom: 4 },
  infoText: { fontSize: 11, color: tw.gray500, lineHeight: 18 },
  footer: { alignItems: "center", paddingBottom: 32 },
  footerText: { fontSize: 9, fontWeight: "700", color: tw.gray400, letterSpacing: 0.9, textAlign: "center" },
  mb4: { marginBottom: 4 },
});
