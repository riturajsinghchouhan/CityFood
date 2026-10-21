// Shared body of TermsAndConditionsV2 / PrivacyPolicyV2: white page, header with a back arrow, CMS
// HTML from GET /food/pages/:key ("<kind>_delivery" first, then "<kind>" when it has no content), a
// red spinner while loading and an optional "Last updated" footer.
import dayjs from "dayjs";
import { usePathname } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { getPage } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { goTo, useAppBack } from "../../navigation/back";
import { shadow, tw } from "../../theme/tokens";
import { Screen, Text } from "../ui";
import HtmlContent from "./HtmlContent";
import Spinner from "./Spinner";

const H_PADDING = 20;

function formatDate(value) {
  if (!value) return "January 1, 2024";
  const d = dayjs(value);
  return d.isValid() ? d.format("MMMM D, YYYY") : "January 1, 2024";
}


// Web fetchTerms / fetchPrivacy. Terms takes the payload whenever the response succeeded; Privacy only
// when data is present (requireData).
async function fetchPage(kind, requireData) {
  let res = await getPage(`${kind}_delivery`);
  if (!res?.success || !res?.data?.content) res = await getPage(kind);
  if (!res?.success) return null;
  if (requireData && !res.data) return null;
  const payload = res.data || {};
  return { content: payload.content || "", updatedAt: payload.updatedAt || "" };
}

/**
 * kind: "terms" | "privacy". title: header text. loadingText. emptyText: shown when there is no
 * content (Terms only; Privacy renders an empty block). fixedHeader: Terms' header is `fixed` with a
 * pt-24 body; Privacy's is sticky with py-6. arrowColor: gray-900 (Terms) / gray-600 (Privacy).
 */
export default function LegalPage({ kind, title, loadingText, emptyText, fixedHeader, arrowColor, requireData }) {
  const { width } = useWindowDimensions();
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const appBack = useAppBack();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    fetchPage(kind, requireData)
      .then((page) => {
        if (!mounted.current || !page) return;
        setContent(page.content);
        setLastUpdated(page.updatedAt);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, [kind, requireData]);

  // Web goes back to /profile, which ProtectedRoute bounces to /login for a logged-out rider (these
  // pages are linked from SignIn); go to /login directly in that case.
  const onBack = () => {
    if (!isAuthenticated && pathname.startsWith("/profile/")) goTo("/login");
    else appBack();
  };

  return (
    <Screen background="#ffffff">
      <View style={[styles.header, shadow.sm]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={6}>
          <ArrowLeft size={20} color={arrowColor} />
        </Pressable>
        <Text heading style={styles.title}>
          {title}
        </Text>
      </View>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.body, { paddingTop: fixedHeader ? 27 : 24 }]}
      >
        {loading ? (
          <View style={styles.loading}>
            <Spinner />
            <Text style={styles.loadingText}>{loadingText}</Text>
          </View>
        ) : (
          <View>
            {content ? (
              <HtmlContent html={content} width={width - H_PADDING * 2} />
            ) : emptyText ? (
              <Text style={styles.empty}>{emptyText}</Text>
            ) : null}
            {lastUpdated ? (
              <View style={styles.updated}>
                <Text style={styles.updatedText}>Last updated: {formatDate(lastUpdated)}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    zIndex: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backBtn: { padding: 8, borderRadius: 8 },
  title: { fontSize: 18, lineHeight: 28, fontWeight: "700", color: tw.gray900 },
  body: { paddingHorizontal: H_PADDING, paddingBottom: 24 },
  loading: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 16 },
  loadingText: { fontSize: 16, color: tw.gray500 },
  empty: { fontSize: 16, lineHeight: 24, color: tw.gray500 },
  updated: { marginTop: 48, paddingTop: 24, borderTopWidth: 1, borderTopColor: tw.gray100 },
  updatedText: { fontSize: 12, color: tw.gray400, fontStyle: "italic" },
});
