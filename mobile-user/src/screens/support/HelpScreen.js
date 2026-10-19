// Port of pages/user/help/Help.jsx: static help centre (search, quick actions, FAQ accordion, contact card).
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  HelpCircle,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Search,
  Shield,
  Truck,
  User,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FadeIn from "../../components/support/FadeIn";
import { c, webVars } from "../../components/support/palette";
import WarmGradient from "../../components/support/WarmGradient";
import { Button, Card, Input, Screen, Text } from "../../components/ui";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";

// color: "primary" | "foreground" (Delivery's "text-#55254b" is not a valid class, so it inherits) | hex.
const helpCategories = [
  {
    id: "ordering",
    title: "Ordering",
    icon: Package,
    color: "primary",
    bgColor: c.orange50,
    description: "Learn how to place and manage orders",
    topics: [
      {
        question: "How do I place an order?",
        answer:
          "To place an order, browse restaurants, add items to your cart, and proceed to checkout. Select your delivery address and payment method, then confirm your order.",
      },
      {
        question: "Can I modify or cancel my order?",
        answer:
          "You can modify or cancel your order within 5 minutes of placing it. After that, please contact support for assistance.",
      },
      {
        question: "How do I track my order?",
        answer:
          "Go to 'My Orders' in your profile, select the order you want to track, and you'll see real-time updates on your order status.",
      },
      {
        question: "What is the minimum order amount?",
        answer:
          "The minimum order amount varies by restaurant, typically ranging from $10 to $15. This information is displayed on each restaurant's page.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    icon: CreditCard,
    color: "primary",
    bgColor: c.orange50,
    description: "Payment methods and billing questions",
    topics: [
      {
        question: "What payment methods do you accept?",
        answer:
          "We accept all major credit cards, debit cards, digital wallets (Apple Pay, Google Pay), and cash on delivery in select areas.",
      },
      {
        question: "Is my payment information secure?",
        answer:
          "Yes, we use industry-standard encryption to protect your payment information. We never store your full card details.",
      },
      {
        question: "Can I get a refund?",
        answer:
          "Refunds are processed for cancelled orders, incorrect items, or quality issues. Contact support within 24 hours of delivery for assistance.",
      },
      {
        question: "Why was my payment declined?",
        answer:
          "Payment can be declined due to insufficient funds, incorrect card details, or bank restrictions. Please verify your payment method and try again.",
      },
    ],
  },
  {
    id: "delivery",
    title: "Delivery",
    icon: Truck,
    color: "foreground",
    bgColor: c.orange50,
    description: "Delivery times, fees, and tracking",
    topics: [
      {
        question: "What are your delivery times?",
        answer:
          "Delivery times typically range from 30-60 minutes, depending on the restaurant and your location. Estimated time is shown before checkout.",
      },
      {
        question: "How much is the delivery fee?",
        answer:
          "Delivery fees vary by restaurant and distance, typically ranging from $2.99 to $5.99. The exact fee is shown before you place your order.",
      },
      {
        question: "Can I schedule a delivery for later?",
        answer:
          "Yes, you can schedule orders for up to 7 days in advance during checkout. Select your preferred delivery time.",
      },
      {
        question: "What if my order is late?",
        answer:
          "If your order is significantly delayed, contact support. We'll investigate and may provide compensation or a refund.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & Profile",
    icon: User,
    color: "primary",
    bgColor: c.orange50,
    description: "Manage your account and preferences",
    topics: [
      {
        question: "How do I update my profile?",
        answer:
          "Go to 'Profile' in the menu, then select 'Edit Profile' to update your name, email, phone number, and other information.",
      },
      {
        question: "How do I change my password?",
        answer:
          "Go to Profile > Settings > Security to change your password. You'll need to verify your current password first.",
      },
      {
        question: "How do I manage my addresses?",
        answer:
          "Navigate to Profile > Addresses to view, add, edit, or delete delivery addresses. Set a default address for faster checkout.",
      },
      {
        question: "How do I save my favorite restaurants?",
        answer:
          "Click the heart icon on any restaurant page to add it to your favorites. View all favorites in Profile > Favorites.",
      },
    ],
  },
  {
    id: "refunds",
    title: "Refunds & Returns",
    icon: Shield,
    color: "primary",
    bgColor: c.orange50,
    description: "Refund policy and return process",
    topics: [
      {
        question: "What is your refund policy?",
        answer:
          "We offer full refunds for cancelled orders, incorrect items, or quality issues reported within 24 hours of delivery.",
      },
      {
        question: "How long do refunds take?",
        answer:
          "Refunds are typically processed within 5-7 business days, depending on your payment method. You'll receive a confirmation email.",
      },
      {
        question: "Can I return food items?",
        answer:
          "Due to food safety regulations, we cannot accept returns of food items. However, we'll provide a full refund for quality issues.",
      },
      {
        question: "What if I received the wrong order?",
        answer:
          "Contact support immediately with your order number. We'll arrange a replacement or full refund, and you can keep the incorrect order.",
      },
    ],
  },
  {
    id: "general",
    title: "General Questions",
    icon: HelpCircle,
    color: c.gray600,
    bgColor: c.gray50,
    description: "Other frequently asked questions",
    topics: [
      {
        question: "Do you offer discounts or promotions?",
        answer: "Yes! Check the 'Offers' section for current promotions, discount codes, and special deals from restaurants.",
      },
      {
        question: "How do I contact customer support?",
        answer:
          "You can contact us via phone, email, or live chat. Visit the 'Contact Support' section below for all contact options.",
      },
      {
        question: "Is there a mobile app?",
        answer:
          "Yes, our mobile app is available for iOS and Android. Download it from the App Store or Google Play for the best experience.",
      },
      {
        question: "Do you deliver to my area?",
        answer:
          "Enter your delivery address to see available restaurants in your area. We're constantly expanding our delivery zones.",
      },
    ],
  },
];

export default function HelpScreen() {
  const { colors, isDark } = useTheme();
  const v = webVars(isDark);
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  const q = searchQuery.toLowerCase();
  const filteredCategories = helpCategories.filter(
    (category) =>
      category.title.toLowerCase().includes(q) ||
      category.topics.some((t) => t.question.toLowerCase().includes(q) || t.answer.toLowerCase().includes(q)),
  );

  const toggleCategory = (id) => {
    setExpandedCategory(expandedCategory === id ? null : id);
    setExpandedQuestion(null);
  };
  const toggleQuestion = (key) => setExpandedQuestion(expandedQuestion === key ? null : key);

  const iconColor = (color) => (color === "primary" ? colors.primary : color === "foreground" ? v.foreground : color);
  const cardStyle = [styles.card, { borderColor: v.border }];

  const quickAction = (key, Icon, bg, title, sub, onPress) => {
    const body = (
      <View style={styles.quickRow}>
        <View style={[styles.iconBox, { backgroundColor: bg }]}>
          <Icon size={20} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.quickTitle, { color: v.foreground }]}>{title}</Text>
          <Text style={[styles.quickSub, { color: v.mutedForeground }]}>{sub}</Text>
        </View>
      </View>
    );
    return onPress ? (
      <Pressable key={key} onPress={onPress}>
        {body}
      </Pressable>
    ) : (
      <View key={key}>{body}</View>
    );
  };

  const contact = (Icon, title, sub, action) => (
    <View style={styles.contactItem}>
      <View style={[styles.iconBox, { backgroundColor: c.orange100 }]}>
        <Icon size={20} color={colors.primary} />
      </View>
      <View style={styles.flexShrink}>
        <Text style={[styles.contactTitle, { color: v.foreground }]}>{title}</Text>
        <Text style={[styles.contactSub, { color: v.mutedForeground }]}>{sub}</Text>
        {action}
      </View>
    </View>
  );

  return (
    <Screen background={isDark ? "#0a0a0a" : v.background}>
      <WarmGradient isDark={isDark} />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.page, { paddingBottom: 16 + insets.bottom }]}
        >
          <FadeIn style={styles.stack}>
            <View style={styles.intro}>
              <Text style={[styles.h1, { color: v.foreground }]}>Help Center</Text>
              <Text style={[styles.lead, { color: v.mutedForeground }]}>
                Find answers to common questions or contact our support team
              </Text>
            </View>

            <Card style={[cardStyle, shadow.lg]}>
              <View style={styles.searchWrap}>
                <Search size={20} color={v.mutedForeground} style={styles.searchIcon} />
                <Input
                  placeholder="Search for help topics, questions, or keywords..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={[
                    styles.searchInput,
                    { backgroundColor: v.inputBg, borderColor: isDark ? "#27272A" : c.slate200, color: v.foreground },
                  ]}
                  placeholderTextColor={v.mutedForeground}
                />
              </View>
            </Card>

            <View style={styles.quickList}>
              {quickAction("orders", Package, c.yellow100, "Track Your Order", "View order status", () =>
                goTo("/orders"),
              )}
              {quickAction("profile", User, c.orange100, "Manage Account", "Update profile & settings", () =>
                goTo("/profile"),
              )}
              {quickAction("support", MessageCircle, c.orange100, "Contact Support", "Get help from our team")}
            </View>

            <View style={styles.stack}>
              <Text style={[styles.h2, { color: v.foreground }]}>Browse by Category</Text>
              {filteredCategories.length === 0 ? (
                <Card style={cardStyle}>
                  <View style={styles.noResults}>
                    <HelpCircle size={64} color={v.mutedForeground} style={styles.mb16} />
                    <Text style={[styles.noResultsTitle, { color: v.foreground }]}>No results found</Text>
                    <Text style={[styles.noResultsSub, { color: v.mutedForeground }]}>
                      Try searching with different keywords
                    </Text>
                    <Button
                      variant="outline"
                      title="Clear Search"
                      onPress={() => setSearchQuery("")}
                      style={!isDark && { backgroundColor: v.background }}
                      textStyle={{ color: v.foreground }}
                    />
                  </View>
                </Card>
              ) : (
                filteredCategories.map((category) => {
                  const Icon = category.icon;
                  const isExpanded = expandedCategory === category.id;
                  const Chevron = isExpanded ? ChevronDown : ChevronRight;
                  return (
                    <Card key={category.id} style={[cardStyle, styles.categoryCard, shadow.lg]}>
                      <Pressable onPress={() => toggleCategory(category.id)} style={styles.categoryHead}>
                        <View style={styles.categoryLeft}>
                          <View style={[styles.iconBox, { backgroundColor: category.bgColor }]}>
                            <Icon size={20} color={iconColor(category.color)} />
                          </View>
                          <View style={styles.flexShrink}>
                            <Text style={[styles.categoryTitle, { color: v.foreground }]}>{category.title}</Text>
                            <Text style={[styles.categoryDesc, { color: v.mutedForeground }]}>
                              {category.description}
                            </Text>
                          </View>
                        </View>
                        <Chevron size={20} color={v.mutedForeground} />
                      </Pressable>
                      {isExpanded ? (
                        <View style={styles.topics}>
                          {category.topics.map((topic, topicIndex) => {
                            const key = `${category.id}-${topicIndex}`;
                            const open = expandedQuestion === key;
                            const QChevron = open ? ChevronDown : ChevronRight;
                            return (
                              <View key={key} style={[styles.topic, { borderColor: v.border }]}>
                                <Pressable onPress={() => toggleQuestion(key)} style={styles.topicHead}>
                                  <Text style={[styles.question, { color: v.foreground }]}>{topic.question}</Text>
                                  <QChevron size={16} color={v.mutedForeground} />
                                </Pressable>
                                {open ? (
                                  <View
                                    style={[
                                      styles.answer,
                                      {
                                        borderTopColor: v.border,
                                        backgroundColor: isDark ? "rgba(31,41,55,0.3)" : "rgba(241,245,249,0.3)",
                                      },
                                    ]}
                                  >
                                    <Text style={[styles.answerText, { color: v.mutedForeground }]}>{topic.answer}</Text>
                                  </View>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </Card>
                  );
                })
              )}
            </View>

            <View style={[styles.stillCard, { borderColor: c.yellow200 }]}>
              <LinearGradient
                colors={[c.yellow50, c.orange50]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.stillInner}
              >
                <View style={styles.stillHead}>
                  <View style={styles.stillTitleRow}>
                    <MessageCircle size={20} color={colors.primary} />
                    <Text style={[styles.stillTitle, { color: v.foreground }]}>Still Need Help?</Text>
                  </View>
                  <Text style={[styles.stillDesc, { color: v.mutedForeground }]}>
                    Our support team is here to assist you 24/7
                  </Text>
                </View>
                <View style={styles.stillBody}>
                  <View style={styles.contactList}>
                    {contact(
                      Phone,
                      "Phone Support",
                      "Call us anytime",
                      <Pressable onPress={() => Linking.openURL("tel:+1-800-123-4567").catch(() => {})}>
                        <Text style={[styles.contactLink, { color: colors.primary }]}>+1 (800) 123-4567</Text>
                      </Pressable>,
                    )}
                    {contact(
                      Mail,
                      "Email Support",
                      "We'll respond within 24 hours",
                      <Pressable onPress={() => Linking.openURL("mailto:support@tuggo.com").catch(() => {})}>
                        <Text style={[styles.contactLink, { color: colors.primary }]}>support@tuggo.com</Text>
                      </Pressable>,
                    )}
                    {contact(
                      MessageCircle,
                      "Live Chat",
                      "Available 24/7",
                      <Button
                        variant="outline"
                        size="sm"
                        title="Start Chat"
                        onPress={() => Alert.alert("Live chat would open here")}
                        style={[styles.chatBtn, !isDark && { backgroundColor: v.background }]}
                        textStyle={{ color: v.foreground }}
                      />,
                    )}
                  </View>
                  <View style={[styles.responseRow, { borderTopColor: v.border }]}>
                    <Text style={[styles.responseText, { color: v.mutedForeground }]}>
                      <Clock size={16} color={v.mutedForeground} /> Average response time: Less than 5 minutes
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  mb16: { marginBottom: 16 },
  page: { padding: 16 },
  stack: { gap: 16 },
  intro: { alignItems: "center", gap: 12, marginBottom: 8 },
  h1: { fontSize: 30, fontWeight: "700", textAlign: "center" },
  lead: { fontSize: 16, textAlign: "center" },
  card: { paddingHorizontal: 16 },
  searchWrap: { justifyContent: "center", paddingVertical: 16 },
  searchIcon: { position: "absolute", left: 12, zIndex: 1 },
  searchInput: { height: 48, paddingLeft: 40 },
  quickList: { gap: 16 },
  quickRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  iconBox: { padding: 8, borderRadius: 8 },
  quickTitle: { fontSize: 14, fontWeight: "600" },
  quickSub: { fontSize: 12 },
  h2: { fontSize: 20, fontWeight: "700" },
  noResults: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 8 },
  noResultsTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  noResultsSub: { fontSize: 16, marginBottom: 16, textAlign: "center" },
  categoryCard: { paddingHorizontal: 0, gap: 24 },
  categoryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 8,
  },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  categoryTitle: { fontSize: 18, fontWeight: "600", lineHeight: 22 },
  categoryDesc: { fontSize: 14 },
  topics: { padding: 16, gap: 12 },
  topic: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  topicHead: { flexDirection: "row", alignItems: "center" },
  question: { fontSize: 16, fontWeight: "600", paddingRight: 16, flexShrink: 1 },
  answer: { padding: 16, borderTopWidth: 1 },
  answerText: { fontSize: 16 },
  stillCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", ...shadow.lg },
  stillInner: { paddingVertical: 24, gap: 24 },
  stillHead: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  stillTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stillTitle: { fontSize: 20, fontWeight: "600" },
  stillDesc: { fontSize: 14 },
  stillBody: { padding: 16, gap: 16 },
  contactList: { gap: 16 },
  contactItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 8,
  },
  contactTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  contactSub: { fontSize: 14, marginBottom: 8 },
  contactLink: { fontSize: 14, fontWeight: "500" },
  chatBtn: { marginTop: 4, alignSelf: "flex-start" },
  responseRow: { paddingTop: 16, borderTopWidth: 1 },
  responseText: { fontSize: 14, marginBottom: 12 },
});
