// Shared body of Terms.jsx / Privacy.jsx / Refund.jsx / Shipping.jsx / Cancellation.jsx:
// sticky header, CMS HTML card from GET /food/pages/:key, and the policy footer.
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPage } from "../../api";
import { Screen, Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { brand, shadow } from "../../theme/tokens";
import FadeIn from "./FadeIn";
import HtmlContent from "./HtmlContent";
import Spinner from "./Spinner";
import { c, formatEnUsLongDate } from "./palette";

/**
 * pageKey: about | terms | privacy | refund | shipping | cancellation
 * defaultTitle: the web's fallback title ("Terms of Service", ...)
 * tagline: small uppercase line under the title ("CityFood Policy" / "CityFood Ecosystem")
 * EmptyIcon: lucide icon for the "No content" state
 * onBack: header back action (each web page has its own handleBack)
 */
export default function LegalPage({ pageKey, defaultTitle, tagline, EmptyIcon, onBack }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState({ title: defaultTitle, content: "" });

  useEffect(() => {
    let active = true;
    getPage(pageKey)
      .then((res) => {
        if (active && res?.success) setPage(res.data || { title: defaultTitle, content: "" });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pageKey, defaultTitle]);

  const pageBg = isDark ? "#0a0a0a" : "#ffffff";

  if (loading) {
    return (
      <Screen background={pageBg}>
        <View style={styles.loading}>
          <Spinner size={40} color={brand.zomatoRed} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  const now = new Date();
  // px-4 page gutter + p-6 card padding + 1px card border, on each side.
  const htmlWidth = width - 2 * (16 + 24 + 1);

  return (
    <Screen background={pageBg}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? "rgba(10,10,10,0.8)" : "rgba(255,255,255,0.8)",
            borderBottomColor: isDark ? c.gray900 : c.gray100,
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { backgroundColor: isDark ? c.gray900 : c.gray100, transform: [{ scale: 0.95 }] },
          ]}
        >
          <ArrowLeft size={16} color={isDark ? "#ffffff" : c.gray900} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: isDark ? "#ffffff" : c.gray900 }]} numberOfLines={2}>
            {page.title || defaultTitle}
          </Text>
          <Text style={styles.tagline}>{tagline}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + 40 + insets.bottom }]}>
        <FadeIn offset={15} duration={300}>
          <View
            style={[
              styles.card,
              { backgroundColor: isDark ? "#111111" : "#ffffff", borderColor: isDark ? c.gray900 : c.gray50 },
            ]}
          >
            {page.content ? (
              <HtmlContent
                html={page.content}
                width={htmlWidth}
                isDark={isDark}
                linkColor={isDark ? colors.primary : brand.zomatoRed}
              />
            ) : (
              <View style={styles.empty}>
                <EmptyIcon size={64} color={isDark ? c.gray800 : c.gray100} style={styles.emptyIcon} />
                <Text style={styles.emptyText}>No content available at the moment.</Text>
              </View>
            )}
          </View>
        </FadeIn>

        <Text style={styles.footer}>
          {`Last updated: ${formatEnUsLongDate(now)}\n© ${now.getFullYear()} CityFood. All Rights Reserved.`}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  loadingText: {
    color: c.gray500,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderBottomWidth: 1,
    zIndex: 50,
  },
  backBtn: { width: 40, height: 40, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5, lineHeight: 24 },
  tagline: {
    fontSize: 10,
    color: c.gray400,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  content: { paddingHorizontal: 16, paddingTop: 32 },
  card: { borderRadius: 32, padding: 24, borderWidth: 1, ...shadow.sm },
  empty: { alignItems: "center", paddingVertical: 80 },
  emptyIcon: { marginBottom: 16 },
  emptyText: { color: c.gray400, fontWeight: "500", fontSize: 16, textAlign: "center" },
  footer: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 10,
    lineHeight: 16,
    color: c.gray400,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
