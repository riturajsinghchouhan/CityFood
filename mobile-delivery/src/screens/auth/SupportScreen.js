// help/PublicSupportV2 (/support): static "Help & Support" for riders, reachable logged out from
// SignIn. The web hard-codes support@thetuggo.com / +91 9917675609 (a stale brand); here the email
// and phone come from the admin business settings (supportEmail / supportPhone), falling back to
// the web's values when those are empty. Back is navigate(-1).
import { Clock, Mail, MessageSquare, Phone, ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { getBusinessSettings } from "../../api";
import { Screen, Text } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { shadow, tw } from "../../theme/tokens";

const NAVY = "#1A2642";
const RED = "#E53935";
const WEB_EMAIL = "support@thetuggo.com";
const WEB_PHONE = "9917675609";

const FAQS = [
  {
    q: "How to resolve login issues?",
    a: "Ensure you're using the correct registered mobile number. If the issue persists, contact our helpline for an instant OTP reset.",
  },
  {
    q: "Delay in payout settlement?",
    a: "Payouts are settled according to your active withdrawal cycle. Contact support for delays exceeding 48 hours.",
  },
  {
    q: "Technical issue with app?",
    a: "Restart the app and check internet connectivity. Make sure your app is updated to the latest version.",
  },
];

// "9917675609" -> "tel:+919917675609" (the web's link); other formats are dialled as given.
function telHref(phone) {
  const digits = String(phone).replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(digits)) return `tel:+91${digits}`;
  return `tel:${digits}`;
}

function ContactCard({ icon: Icon, title, value, action, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, shadow.sm]}>
      <View style={styles.iconBox}>
        <Icon size={24} color={RED} strokeWidth={2} />
      </View>
      <Text heading style={styles.cardTitle}>
        {title}
      </Text>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardAction}>{action}</Text>
    </Pressable>
  );
}

export default function SupportScreen() {
  const goBack = useAppBack();
  const [contact, setContact] = useState({ email: WEB_EMAIL, phone: WEB_PHONE });

  useEffect(() => {
    let cancelled = false;
    getBusinessSettings()
      .then((res) => {
        const s = res?.data || {};
        const email = typeof s.supportEmail === "string" ? s.supportEmail.trim() : "";
        const phone = typeof s.supportPhone === "string" ? s.supportPhone.trim() : "";
        if (!cancelled && (email || phone)) {
          setContact({ email: email || WEB_EMAIL, phone: phone || WEB_PHONE });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen background="#F8F9FA">
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={24} color={NAVY} strokeWidth={2.5} />
        </Pressable>
        <View>
          <Text heading style={styles.title}>
            Help & Support
          </Text>
          <Text style={styles.subtitle}>DELIVERY PARTNER INFORMATION</Text>
        </View>
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.body}>
        <ContactCard
          icon={Mail}
          title="DELIVERY SUPPORT"
          value={contact.email}
          action="EMAIL SUPPORT"
          onPress={() => Linking.openURL(`mailto:${contact.email}`).catch(() => {})}
        />
        <ContactCard
          icon={Phone}
          title="DELIVERY HELPLINE"
          value={contact.phone}
          action="INSTANT CALL"
          onPress={() => Linking.openURL(telHref(contact.phone)).catch(() => {})}
        />

        <View style={styles.faqSection}>
          <Text heading style={styles.faqHeading}>
            Delivery FAQs
          </Text>
          <View style={styles.faqList}>
            {FAQS.map((item) => (
              <View key={item.q} style={styles.faqRow}>
                <MessageSquare size={20} color={RED} strokeWidth={2} style={styles.faqIcon} />
                <View style={styles.fill}>
                  <Text heading style={styles.faqQ}>
                    {item.q}
                  </Text>
                  <Text style={styles.faqA}>{item.a}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.hours, shadow.sm]}>
          <Clock size={20} color={RED} strokeWidth={2} style={styles.faqIcon} />
          <View style={styles.fill}>
            <Text heading style={styles.hoursTitle}>
              BUSINESS HOURS
            </Text>
            <Text style={styles.faqA}>Delivery support is available from 8 AM to 12 AM, 7 days a week.</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    zIndex: 50,
  },
  backBtn: { padding: 4, marginLeft: -4, borderRadius: 9999 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: "700", color: NAVY },
  subtitle: { fontSize: 11, lineHeight: 16, fontWeight: "700", color: tw.gray400, letterSpacing: 0.275 },
  body: { padding: 16, paddingBottom: 32, gap: 16 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: RED,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardTitle: { fontSize: 13, lineHeight: 20, fontWeight: "700", color: NAVY, letterSpacing: 0.65, marginBottom: 6 },
  cardValue: { fontSize: 15, lineHeight: 22, fontWeight: "500", color: "#2c3e50", marginBottom: 12, textAlign: "center" },
  cardAction: { fontSize: 11, lineHeight: 16, fontWeight: "700", color: RED, letterSpacing: 0.55 },
  faqSection: { marginTop: 16 },
  faqHeading: { fontSize: 18, lineHeight: 28, fontWeight: "700", color: NAVY, marginBottom: 20, paddingHorizontal: 4 },
  faqList: { gap: 24, paddingHorizontal: 4 },
  faqRow: { flexDirection: "row", gap: 16 },
  faqIcon: { marginTop: 2 },
  faqQ: { fontSize: 15, lineHeight: 22, fontWeight: "700", color: NAVY, marginBottom: 6 },
  faqA: { fontSize: 14, lineHeight: 23, color: tw.gray500 },
  hours: {
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  hoursTitle: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: NAVY, letterSpacing: 0.6, marginBottom: 6 },
});
