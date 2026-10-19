// PrivacyPolicyPage.jsx / TermsAndConditionsPage.jsx: fixed white header with a back arrow, then a
// white card with the CMS title, "Last updated" date and the HTML content (GET /food/pages/:key).
import dayjs from "dayjs";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { getPage } from "../../api/content";
import HtmlContent from "../../components/content/HtmlContent";
import { Screen, Text } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadow, tw } from "../../theme/tokens";

const PAGES = {
  privacy: {
    header: "Privacy Policy",
    defaultTitle: "Privacy Policy",
    loading: "Loading privacy policy...",
    empty: "No privacy policy content available.",
  },
  terms: {
    header: "Terms & Conditions",
    defaultTitle: "Terms and Conditions",
    loading: "Loading terms...",
    empty: "No terms content available.",
  },
};

export default function LegalPageScreen({ pageKey }) {
  const page = PAGES[pageKey];
  const { colors } = useTheme();
  const goBack = useAppBack();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ title: page.defaultTitle, content: "", updatedAt: "" });

  useEffect(() => {
    let cancelled = false;
    getPage(pageKey)
      .then((res) => {
        if (cancelled || !res?.success) return;
        const payload = res?.data || {};
        setData({
          title: payload?.title || page.defaultTitle,
          content: payload?.content || "",
          updatedAt: payload?.updatedAt || "",
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageKey, page.defaultTitle]);

  const updated = data.updatedAt ? dayjs(data.updatedAt) : dayjs();
  // px-4 page gutter + p-6 card padding on each side.
  const contentWidth = width - 32 - 48;

  return (
    <Screen background="#ffffff">
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8} accessibilityLabel="Back">
          <ArrowLeft size={20} color={tw.gray600} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {page.header}
        </Text>
      </View>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, { backgroundColor: colors.primaryTint8 }]}>
          <View style={styles.card}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{data.title || page.defaultTitle}</Text>
              <Text style={styles.updated}>Last updated: {updated.isValid() ? updated.format("MMMM D, YYYY") : ""}</Text>
            </View>
            {loading ? (
              <Text style={styles.muted}>{page.loading}</Text>
            ) : data.content ? (
              <HtmlContent html={data.content} width={contentWidth} />
            ) : (
              <Text style={styles.muted}>{page.empty}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  backBtn: { padding: 6, borderRadius: radius.md },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: tw.gray900 },
  scrollContent: { flexGrow: 0 },
  page: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 64 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: tw.gray100,
    padding: 24,
    gap: 24,
    ...shadow.sm,
  },
  titleBlock: { gap: 16 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: tw.gray900 },
  updated: { fontSize: 14, color: tw.gray600 },
  muted: { fontSize: 14, color: tw.gray500 },
});
