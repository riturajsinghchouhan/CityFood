// Port of pages/restaurant/ShareFeedback.jsx (/share-feedback): a 0-10 score, sent as a 1-5
// rating to POST /food/restaurant/feedback-experience, then a thank-you RestaurantModal.
// bg-black buttons render in the theme primary (restaurantTheme.css).
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { submitFeedbackExperience } from "../../api";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import RestaurantModal from "../../components/shell/RestaurantModal";
import { useBusinessSettings } from "../../components/shell/stores";
import { ScalePressable, Text, toast } from "../../components/ui";
import { withProtected } from "../../navigation/Protected";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

const numbers = Array.from({ length: 11 }, (_, i) => i);

function ScoreButton({ num, rating, onPress, activeColor }) {
  const isActive = rating === num;
  const intensity = rating === null ? 0 : Math.abs(num - rating);
  const target = isActive ? 1.05 : intensity === 1 ? 1.02 : 1;
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.spring(scale, { toValue: target, stiffness: 260, damping: 20, mass: 1, useNativeDriver: true }).start();
  }, [target, scale]);
  return (
    <Animated.View style={[styles.scoreCell, num > 0 && styles.scoreDivider, { transform: [{ scale }] }]}>
      <ScalePressable
        scaleTo={0.96}
        onPress={() => onPress(num)}
        style={[styles.scoreBtn, { backgroundColor: isActive ? activeColor : "#ffffff" }]}
      >
        <Text style={[styles.scoreText, { color: isActive ? "#ffffff" : tw.gray900 }]}>{num}</Text>
      </ScalePressable>
    </Animated.View>
  );
}

function RatedLine({ rating }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [rating, anim]);
  return (
    <Animated.View
      style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}
    >
      <Text style={styles.ratedText}>
        You rated your experience <Text style={styles.ratedValue}>{rating}/10</Text>.
      </Text>
    </Animated.View>
  );
}

function ShareFeedbackScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = useShellBottomInset();
  const { companyName: storedName } = useBusinessSettings();
  const companyName = storedName || "CityFood";
  const goBack = useAppBack();
  const [rating, setRating] = useState(null);
  const [showThanks, setShowThanks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (rating === null || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const response = await submitFeedbackExperience({
        rating: Math.ceil(rating / 2) || 1,
        module: "restaurant",
        comment: `User rated ${rating}/10 overall experience`,
      });
      if (response?.success) {
        setShowThanks(true);
      } else {
        throw new Error(response?.message || "Failed to submit");
      }
    } catch (error) {
      toast.error(error.message || "Failed to save feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeThanks = () => {
    setShowThanks(false);
    goBack();
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Share your feedback</Text>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [styles.closeBtn, pressed && { backgroundColor: tw.gray100 }]}
            accessibilityLabel="Close"
          >
            <X size={20} color={tw.gray900} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.question}>
            <Text style={styles.questionSmall}>Tell us about your</Text>
            <Text style={styles.questionBig}>Overall experience with {companyName.toLowerCase()}</Text>
          </View>

          <View style={{ marginBottom: 12 }}>
            <View style={styles.scale}>
              {numbers.map((num) => (
                <ScoreButton key={num} num={num} rating={rating} onPress={setRating} activeColor={colors.primary} />
              ))}
            </View>
            <View style={styles.scaleLabels}>
              <Text style={[styles.scaleLabel, { color: tw.red500 }]}>Very Bad</Text>
              <Text style={[styles.scaleLabel, { color: tw.green600 }]}>Very Good</Text>
            </View>
            {rating !== null ? <RatedLine rating={rating} /> : null}
          </View>

          <View style={styles.illustrationWrap}>
            <View style={styles.illustration}>
              <LinearGradient
                colors={["#e0e7ff", "#fce7f3", "#fef9c2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.bars}>
                <View style={[styles.bar, { height: 80, backgroundColor: "#a3b3ff" }]} />
                <View style={[styles.bar, { height: 128, backgroundColor: "#fda5d5" }]} />
                <View style={[styles.bar, { height: 96, backgroundColor: "#dab2ff" }]} />
                <View style={[styles.bar, { height: 112, backgroundColor: "#7bf1a8" }]} />
                <View style={[styles.bar, { height: 88, backgroundColor: "#ffdf20" }]} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 24 + Math.max(bottomInset, insets.bottom) }]}>
        <ScalePressable
          scaleTo={rating !== null ? 0.98 : 1}
          disabled={rating === null}
          onPress={handleContinue}
          style={[styles.continueBtn, { backgroundColor: rating === null ? tw.gray200 : colors.primary }]}
        >
          <Text style={[styles.continueText, { color: rating === null ? tw.gray500 : "#ffffff" }]}>Continue</Text>
        </ScalePressable>
      </View>

      <RestaurantModal open={showThanks} onClose={closeThanks} size="sm" showClose={false}>
        <View style={styles.thanks}>
          <View style={styles.thanksIcon}>
            <CheckCircle2 size={28} color={tw.green600} />
          </View>
          <Text style={styles.thanksTitle}>Thanks for your feedback</Text>
          <Text style={styles.thanksText}>It helps us improve your experience with {companyName.toLowerCase()}.</Text>
          <Pressable onPress={closeThanks} style={[styles.doneBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </RestaurantModal>
    </View>
  );
}

export default withProtected(ShareFeedbackScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  scroll: { flexGrow: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "600", color: tw.gray900 },
  closeBtn: { padding: 8, borderRadius: 9999 },
  body: { flex: 1, paddingHorizontal: 16 },
  question: { marginTop: 24, marginBottom: 24 },
  questionSmall: { fontSize: 14, color: tw.gray700, marginBottom: 4 },
  questionBig: { fontSize: 18, fontWeight: "600", color: tw.gray900 },
  scale: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tw.gray300,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    gap: 4,
  },
  scoreCell: { flex: 1 },
  scoreDivider: { borderLeftWidth: 1, borderLeftColor: tw.gray200 },
  scoreBtn: { paddingVertical: 8, alignItems: "center" },
  scoreText: { fontSize: 12, fontWeight: "500" },
  scaleLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  scaleLabel: { fontSize: 12 },
  ratedText: { marginTop: 12, fontSize: 12, color: tw.gray600 },
  ratedValue: { fontSize: 12, fontWeight: "600", color: tw.gray900 },
  illustrationWrap: { marginTop: 40, alignItems: "center", justifyContent: "center" },
  illustration: {
    maxWidth: 320,
    height: 192,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 8, justifyContent: "space-between" },
  bar: { width: 40, borderRadius: 9999 },
  footer: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: "#ffffff" },
  continueBtn: { width: "100%", paddingVertical: 12, borderRadius: 9999, alignItems: "center" },
  continueText: { fontSize: 14, fontWeight: "500" },
  thanks: { alignItems: "center", marginTop: -8 },
  thanksIcon: {
    marginBottom: 12,
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: tw.green100,
    alignItems: "center",
    justifyContent: "center",
  },
  thanksTitle: { fontSize: 16, fontWeight: "600", color: tw.gray900, marginBottom: 4, textAlign: "center" },
  thanksText: { fontSize: 12, color: tw.gray600, marginBottom: 16, textAlign: "center" },
  doneBtn: { width: "100%", paddingVertical: 10, borderRadius: 9999, alignItems: "center" },
  doneText: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
});
