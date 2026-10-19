// auth/Login.jsx "Restaurant Partner Support" dialog: helpline and WhatsApp cards plus two FAQs.
// The web's "Testing & Demo Access" block (demo phone/OTP) is a dev shortcut and is not ported.
import { Headphones, MessageCircle, Phone, X } from "lucide-react-native";
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Dialog, Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const RED = "#D3122A";
const HELPLINE_URL = "tel:18008894567";
const WHATSAPP_URL = "https://wa.me/919876543210";

const FAQS = [
  {
    q: "Not receiving the verification SMS?",
    a: "Wait up to 30 seconds or check cellular reception. You can request a resend OTP after countdown on the next screen.",
  },
  {
    q: "Changed your registered phone number?",
    a: "Call our Partner Helpline with your Restaurant Outlet ID or FSSAI registration number to update your phone number securely.",
  },
];

function ContactCard({ icon, iconBg, title, subtitle, url }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => [styles.contactCard, pressed && { backgroundColor: tw.gray100 }]}
    >
      <View style={[styles.contactIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <View>
        <Text style={styles.contactTitle}>{title}</Text>
        <Text style={styles.contactSub}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export default function SupportDialog({ visible, onClose }) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Dialog visible={visible} onClose={onClose} style={styles.dialog}>
      <View style={styles.header}>
        <Headphones size={20} color={RED} />
        <Text style={styles.headerTitle}>Restaurant Partner Support</Text>
      </View>
      <Pressable onPress={onClose} style={styles.close} hitSlop={8} accessibilityLabel="Close">
        <X size={16} color={tw.gray500} />
      </Pressable>

      <ScrollView style={{ maxHeight: height * 0.75 }} contentContainerStyle={styles.body}>
        <View style={styles.contacts}>
          <ContactCard
            icon={<Phone size={16} color="#009966" />}
            iconBg="rgba(0,188,125,0.1)"
            title="Partner Helpline"
            subtitle="1800-889-4567"
            url={HELPLINE_URL}
          />
          <ContactCard
            icon={<MessageCircle size={16} color="#25D366" />}
            iconBg="rgba(37,211,102,0.1)"
            title="WhatsApp Help"
            subtitle="Instant Chat"
            url={WHATSAPP_URL}
          />
        </View>

        <View style={styles.faqs}>
          <Text style={styles.faqLabel}>Common Questions</Text>
          {FAQS.map((f) => (
            <View key={f.q} style={styles.faq}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <Text style={styles.faqA}>{f.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, { backgroundColor: pressed ? colors.primaryStrong : colors.primary }]}
        >
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { padding: 0, borderRadius: 24, borderColor: tw.gray100, overflow: "hidden", backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingRight: 48,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  close: { position: "absolute", top: 18, right: 16, opacity: 0.7, padding: 2 },
  body: { padding: 20, gap: 16 },
  contacts: { gap: 10 },
  contactCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: tw.gray50,
    borderWidth: 1,
    borderColor: tw.gray100,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  contactIcon: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  contactTitle: { fontSize: 12, fontWeight: "700", color: tw.gray900 },
  contactSub: { fontSize: 11, color: tw.gray500 },
  faqs: { gap: 8, paddingTop: 4 },
  faqLabel: { fontSize: 10, fontWeight: "700", color: tw.gray400, textTransform: "uppercase", letterSpacing: 0.25 },
  faq: { padding: 10, borderRadius: 12, backgroundColor: tw.gray50, borderWidth: 1, borderColor: tw.gray100, gap: 4 },
  faqQ: { fontSize: 12, fontWeight: "600", color: tw.gray900 },
  faqA: { fontSize: 11, lineHeight: 18, color: tw.gray500 },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: tw.gray100, backgroundColor: "rgba(249,250,251,0.5)" },
  closeBtn: { height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontSize: 12, fontWeight: "600", color: "#ffffff" },
});
