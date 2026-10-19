// Port of pages/restaurant/RatingsReviews.jsx (/ratings-reviews): a static help page with the
// remote banner, the (hard-coded on web) 4.0 rating chip, six FAQ accordions and the
// "Was this helpful?" popups. No API calls, as on web.
import { router } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronRight, Star, ThumbsDown, ThumbsUp } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import BottomPopup from "../../components/feedback/BottomPopup";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { AppImage, Text } from "../../components/ui";
import { withProtected } from "../../navigation/Protected";
import { useAppBack } from "../../navigation/back";
import { tw } from "../../theme/tokens";

const restaurantReviewBanner = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=400&fit=crop";

const accordionItems = [
  {
    id: 1,
    question: "How is my restaurant's rating calculated",
    answer:
      "Your restaurant's rating is calculated based on customer reviews and ratings from delivery and dining orders. The system takes an average of all ratings received, with more recent reviews having slightly more weight.",
  },
  {
    id: 2,
    question: "Why am I not getting rating on all orders",
    answer:
      "Not all customers leave ratings after their orders. Some customers may skip the rating step, while others may not have the option to rate depending on the order type or platform. Typically, about 30-40% of customers provide ratings.",
  },
  {
    id: 3,
    question: "Can I call customer to discuss rating",
    answer:
      "Yes, you can contact customers through the order details page if they have provided a phone number. However, please be respectful and professional when discussing ratings.",
  },
  {
    id: 4,
    question: "How to raise a concern if I think rating was bad due to delivery partner",
    answer:
      "If you believe a low rating was due to delivery partner issues, you can raise a concern through the order details page. Navigate to the specific order, click on 'Raise Concern', and select 'Delivery Partner Issue'.",
  },
  {
    id: 5,
    question: "What if I don't agree with the rating",
    answer:
      "If you disagree with a customer's rating, you can reply to the review publicly to address concerns professionally. You can also raise a concern if you believe the rating violates our guidelines.",
  },
  {
    id: 6,
    question: "How can I reply on a customer review",
    answer:
      "To reply to a customer review, go to the Reviews section in your restaurant dashboard. Find the review you want to respond to and click the 'Reply' button. Write a professional, courteous response.",
  },
];

function AccordionAnswer({ text }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View style={[styles.answerWrap, { opacity: anim }]}>
      <Text style={styles.answer}>{text}</Text>
    </Animated.View>
  );
}

function RatingsReviewsScreen() {
  const goBack = useAppBack();
  const bottomInset = useShellBottomInset();
  const [expandedItems, setExpandedItems] = useState(() => new Set());
  const [showThankYouPopup, setShowThankYouPopup] = useState(false);
  const [showNotHelpfulPopup, setShowNotHelpfulPopup] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const toggleAccordion = (itemId) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: tw.gray100 }]}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={tw.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Ratings, reviews</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 + bottomInset }}>
        <AppImage src={restaurantReviewBanner} style={styles.banner} placeholderType="shop" />

        <View style={styles.ratingSection}>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingTitle}>Your restaurant&apos;s rating</Text>
            <View style={styles.ratingChip}>
              <Text style={styles.ratingValue}>4.0</Text>
              <Star size={16} color="#ffffff" fill="#ffffff" />
            </View>
          </View>
          <Pressable onPress={() => router.dismissTo("/feedback?tab=reviews")} style={styles.linkRow}>
            {({ pressed }) => (
              <>
                <Text style={[styles.linkText, pressed && { color: "#1447e6" }]}>View order ratings</Text>
                <ChevronRight size={16} color={pressed ? "#1447e6" : tw.blue600} />
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.concernOuter}>
          <View style={styles.concernCard}>
            <Text style={styles.concernTitle}>Select your concern</Text>
            {accordionItems.map((item, index) => {
              const isExpanded = expandedItems.has(item.id);
              return (
                <View key={item.id}>
                  <Pressable onPress={() => toggleAccordion(item.id)} style={styles.question}>
                    <Text style={styles.questionText}>{item.question}</Text>
                    <ChevronDown
                      size={20}
                      color={tw.gray900}
                      style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }}
                    />
                  </Pressable>
                  {index < accordionItems.length - 1 ? <View style={styles.divider} /> : null}
                  {isExpanded ? <AccordionAnswer text={item.answer} /> : null}
                </View>
              );
            })}
          </View>
        </View>

        {!feedbackSubmitted ? (
          <View style={styles.feedback}>
            <Text style={styles.feedbackTitle}>Was this helpful in resolving your query?</Text>
            <View style={styles.feedbackRow}>
              <Pressable
                onPress={() => {
                  setShowThankYouPopup(true);
                  setFeedbackSubmitted(true);
                }}
                style={({ pressed }) => [styles.yesBtn, pressed && { backgroundColor: tw.blue50 }]}
              >
                <ThumbsUp size={20} color={tw.blue600} />
                <Text style={styles.yesText}>Yes, thank you</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowNotHelpfulPopup(true);
                  setFeedbackSubmitted(true);
                }}
                style={({ pressed }) => [styles.noBtn, pressed && { backgroundColor: tw.gray50 }]}
              >
                <ThumbsDown size={20} color={tw.gray600} />
                <Text style={styles.noText}>Not helpful</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <BottomPopup isOpen={showThankYouPopup} onClose={() => setShowThankYouPopup(false)} showHandle>
        <View style={styles.popupBody}>
          <View style={[styles.popupIcon, { backgroundColor: tw.green100 }]}>
            <ThumbsUp size={32} color={tw.green600} />
          </View>
          <Text style={styles.popupTitle}>Thank you!</Text>
          <Text style={styles.popupText}>We&apos;re glad we could help resolve your query.</Text>
        </View>
      </BottomPopup>

      <BottomPopup isOpen={showNotHelpfulPopup} onClose={() => setShowNotHelpfulPopup(false)} showHandle>
        <View style={styles.popupBody}>
          <View style={[styles.popupIcon, { backgroundColor: tw.gray100 }]}>
            <ThumbsDown size={32} color={tw.gray600} />
          </View>
          <Text style={styles.popupTitle}>We&apos;re sorry</Text>
          <Text style={[styles.popupText, { marginBottom: 16 }]}>
            We&apos;re sorry this wasn&apos;t helpful. Please contact our support team for further assistance.
          </Text>
          <Pressable
            onPress={() => setShowNotHelpfulPopup(false)}
            style={({ pressed }) => [styles.supportBtn, pressed && { backgroundColor: "#1447e6" }]}
          >
            <Text style={styles.supportText}>Contact Support</Text>
          </Pressable>
        </View>
      </BottomPopup>
    </View>
  );
}

export default withProtected(RatingsReviewsScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: { padding: 6, borderRadius: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  banner: { width: "100%", aspectRatio: 3 },
  ratingSection: { paddingHorizontal: 16, paddingVertical: 16, backgroundColor: "#ffffff" },
  ratingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  ratingTitle: { fontSize: 16, fontWeight: "600", color: tw.gray900 },
  ratingChip: {
    backgroundColor: tw.green600,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingValue: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  linkText: { color: tw.blue600, fontSize: 14 },
  concernOuter: { paddingHorizontal: 16, paddingVertical: 16 },
  concernCard: { borderWidth: 1, borderColor: tw.gray100, borderRadius: 8, padding: 16 },
  concernTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900, marginBottom: 16 },
  question: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  questionText: { flex: 1, fontSize: 14, color: tw.gray900, paddingRight: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: tw.gray300 },
  answerWrap: { paddingBottom: 12, paddingTop: 4 },
  answer: { fontSize: 14, color: tw.gray700, lineHeight: 22.75 },
  feedback: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32 },
  feedbackTitle: { fontSize: 16, fontWeight: "600", color: tw.gray900, textAlign: "center", marginBottom: 16 },
  feedbackRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  yesBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: tw.blue600,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  yesText: { color: tw.blue600, fontSize: 14, fontWeight: "600" },
  noBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: tw.gray400,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  noText: { color: tw.gray600, fontSize: 14, fontWeight: "600" },
  popupBody: { alignItems: "center", paddingVertical: 24 },
  popupIcon: { width: 64, height: 64, borderRadius: 9999, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  popupTitle: { fontSize: 20, fontWeight: "700", color: tw.gray900, marginBottom: 8 },
  popupText: { fontSize: 14, color: tw.gray600, textAlign: "center" },
  supportBtn: { width: "100%", backgroundColor: tw.blue600, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: "center" },
  supportText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
});
