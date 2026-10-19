// Port of pages/user/profile/ReportSafetyEmergency.jsx: emergency call card, report form and report history.
import { AlertTriangle, ArrowLeft, Phone, Shield, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createSafetyEmergencyReport, getMySafetyEmergencyReports } from "../../api";
import { c, webVars } from "../../components/support/palette";
import Pill from "../../components/support/Pill";
import { CardBottom, CardMiddle, CardTop } from "../../components/support/SplitCard";
import Spinner from "../../components/support/Spinner";
import FadeIn from "../../components/support/FadeIn";
import { Button, Card, Dialog, inputFont, Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";

const STATUS = {
  unread: { bg: c.blue100, fg: c.blue700 },
  read: { bg: c.slate100, fg: c.slate700 },
  urgent: { bg: c.red100, fg: c.red700 },
  resolved: { bg: c.green100, fg: c.green700 },
};
const PRIORITY = {
  low: { bg: c.gray100, fg: c.gray700 },
  medium: { bg: c.yellow100, fg: c.yellow700 },
  high: { bg: c.orange100, fg: c.orange700 },
  critical: { bg: c.red100, fg: c.red700, bold: true },
};

const capitalize = (s) => s.replace(/^\w/, (ch) => ch.toUpperCase());

function StatusPill({ status }) {
  const s = STATUS[String(status)] || STATUS.unread;
  return <Pill label={capitalize(String(status || "unread"))} bg={s.bg} fg={s.fg} />;
}

function PriorityPill({ priority }) {
  const p = PRIORITY[String(priority)] || PRIORITY.medium;
  return <Pill label={capitalize(String(priority || "medium"))} bg={p.bg} fg={p.fg} bold={p.bold} />;
}

function loadHistory() {
  return getMySafetyEmergencyReports({ page: 1, limit: 20 })
    .then((res) => {
      const list = res?.data?.safetyEmergencies ?? [];
      return Array.isArray(list) ? list : [];
    })
    .catch(() => []);
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function ReportSafetyEmergencyScreen() {
  const { isDark } = useTheme();
  const v = webVars(isDark);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const goBack = useAppBack();
  const [report, setReport] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const mounted = useRef(true);
  const successTimer = useRef(null);

  const applyHistory = useCallback((list) => {
    if (!mounted.current) return;
    setHistory(list);
    setHistoryLoading(false);
  }, []);

  // Refresh button and after a submit. The first load starts with historyLoading already true.
  const fetchHistory = useCallback(() => {
    setHistoryLoading(true);
    loadHistory().then(applyHistory);
  }, [applyHistory]);

  useEffect(() => {
    mounted.current = true;
    loadHistory().then(applyHistory);
    return () => {
      mounted.current = false;
      clearTimeout(successTimer.current);
    };
  }, [applyHistory]);

  const historySorted = useMemo(() => {
    const arr = Array.isArray(history) ? [...history] : [];
    arr.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
    return arr;
  }, [history]);

  const handleSubmit = async () => {
    if (!report.trim()) {
      toast.error("Please describe the safety concern or emergency");
      return;
    }
    if (report.trim().length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await createSafetyEmergencyReport(report.trim());
      if (res?.success) {
        setIsSubmitted(true);
        setReport("");
        toast.success("Safety emergency report submitted successfully!");
        fetchHistory();
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setIsSubmitted(false), 5000);
      }
    } catch (error) {
      toast.error(error?.message || "Failed to submit safety emergency report. Please try again.");
    } finally {
      if (mounted.current) setIsSubmitting(false);
    }
  };

  const cardBg = isDark ? "#1a1a1a" : "#ffffff";
  const cardBorder = isDark ? c.gray800 : "transparent";
  const titleColor = isDark ? "#ffffff" : c.gray900;
  const subColor = isDark ? c.gray400 : c.gray600;
  const mutedColor = isDark ? c.gray400 : c.gray500;
  const tooShort = report.trim().length < 10;
  const showList = !isSubmitted && historySorted.length > 0;

  const header = (
    <View>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft size={16} color={isDark ? "#ffffff" : "#000000"} />
        </Pressable>
        <Text style={[styles.h1, { color: isDark ? "#ffffff" : "#000000" }]}>Report a safety emergency</Text>
      </View>

      <Card
        style={[
          styles.card,
          {
            backgroundColor: isDark ? "rgba(127,29,29,0.2)" : c.red50,
            borderColor: isDark ? c.red800 : c.red200,
          },
        ]}
      >
        <View style={styles.cardRow}>
          <View style={[styles.circleIcon, { backgroundColor: isDark ? "rgba(127,29,29,0.4)" : c.red100 }]}>
            <Phone size={20} color={isDark ? c.red400 : c.red600} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: isDark ? c.red200 : c.red900 }]}>Emergency Contact</Text>
            <Text style={[styles.cardBody, styles.mb12, { color: isDark ? c.red300 : c.red700 }]}>
              For immediate emergencies, please call your local emergency services.
            </Text>
            <Pressable onPress={() => Linking.openURL("tel:100").catch(() => {})}>
              <Text style={[styles.emergencyLink, { color: isDark ? c.red400 : c.red600 }]}>Emergency: 100</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      {!isSubmitted ? (
        <>
          <Card style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardRow}>
              <View style={[styles.circleIcon, { backgroundColor: isDark ? c.gray800 : c.gray100 }]}>
                <Shield size={20} color={isDark ? c.gray300 : c.gray700} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: titleColor }]}>Safety is our priority</Text>
                <Text style={[styles.cardBody, { color: subColor }]}>
                  Report any safety concerns, incidents, or emergencies related to your order or delivery experience.
                </Text>
              </View>
            </View>
          </Card>

          <Card style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardPad}>
              <Text style={[styles.label, { color: titleColor }]}>Describe the safety concern or emergency</Text>
              <TextInput
                placeholder="Please provide details about the safety issue..."
                placeholderTextColor={v.mutedForeground}
                value={report}
                onChangeText={setReport}
                multiline
                textAlignVertical="top"
                style={[
                  styles.textarea,
                  { borderColor: isDark ? "#27272A" : c.slate200, backgroundColor: v.inputBg, color: v.foreground },
                ]}
              />
              <View style={styles.counterRow}>
                <Text style={[styles.counter, { color: tooShort ? c.red500 : mutedColor }]}>
                  {report.length} characters
                </Text>
                <Text style={[styles.counter, { color: tooShort ? c.red500 : mutedColor }]}>Min 10 characters</Text>
              </View>
            </View>
          </Card>

          <Pressable
            onPress={handleSubmit}
            disabled={tooShort || isSubmitting}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: pressed ? c.red700 : c.red600, opacity: tooShort || isSubmitting ? 0.5 : 1 },
            ]}
          >
            {isSubmitting ? <Spinner size={16} color="#ffffff" /> : null}
            <Text style={styles.submitText}>{isSubmitting ? "Submitting..." : "Report Safety Issue"}</Text>
          </Pressable>

          <CardTop bg={cardBg} border={cardBorder} style={styles.historyTop}>
            <View style={styles.historyHead}>
              <Text style={[styles.historyTitle, { color: titleColor }]}>Your report history</Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => fetchHistory()}
                disabled={historyLoading}
                style={!isDark && { backgroundColor: v.background }}
              >
                <View style={styles.btnRow}>
                  {historyLoading ? <Spinner size={16} color={v.foreground} /> : null}
                  <Text style={[styles.btnText, { color: v.foreground }]}>{historyLoading ? "Loading" : "Refresh"}</Text>
                </View>
              </Button>
            </View>
            {historyLoading && historySorted.length === 0 ? (
              <Text style={[styles.historyEmpty, { color: mutedColor }]}>Loading your reports...</Text>
            ) : historySorted.length === 0 ? (
              <Text style={[styles.historyEmpty, { color: mutedColor }]}>No reports yet.</Text>
            ) : null}
          </CardTop>
        </>
      ) : (
        <Card style={[styles.successCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.successBody}>
            <View style={[styles.successIcon, { backgroundColor: isDark ? "rgba(127,29,29,0.4)" : c.red100 }]}>
              <AlertTriangle size={32} color={isDark ? c.red400 : c.red600} />
            </View>
            <Text style={[styles.successTitle, { color: titleColor }]}>Report Submitted</Text>
            <Text style={[styles.successText, { color: subColor }]}>
              Your safety report has been submitted. Our team will review it immediately and take appropriate action.
            </Text>
            <Text style={[styles.successNote, { color: isDark ? c.red400 : c.red600 }]}>
              If this is a life-threatening emergency, please call 100 immediately.
            </Text>
          </View>
        </Card>
      )}
    </View>
  );

  const renderItem = ({ item, index }) => (
    <CardMiddle bg={cardBg} border={cardBorder} gapTop={index === 0 ? 16 : 12}>
      <Pressable
        onPress={() => {
          setSelectedHistoryItem(item);
          setIsHistoryDialogOpen(true);
        }}
        style={({ pressed }) => [
          styles.historyItem,
          {
            borderColor: isDark ? c.gray800 : c.gray200,
            backgroundColor: pressed ? (isDark ? "#141414" : c.gray100) : isDark ? "#101010" : c.gray50,
          },
        ]}
      >
        <View style={styles.flexShrink}>
          <Text style={[styles.itemMsg, { color: titleColor }]} numberOfLines={1}>
            {item?.message || "—"}
          </Text>
          <Text style={[styles.itemDate, { color: mutedColor }]}>{formatDateTime(item?.createdAt)}</Text>
        </View>
        <StatusPill status={item?.status} />
      </Pressable>
    </CardMiddle>
  );

  const sel = selectedHistoryItem;

  return (
    <Screen background={isDark ? "#0a0a0a" : "#f5f5f5"}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <FadeIn style={styles.flex}>
          <FlatList
            data={showList ? historySorted : []}
            keyExtractor={(item, i) => String(item?._id || item?.id || `${item?.createdAt}-${i}`)}
            renderItem={renderItem}
            ListHeaderComponent={header}
            ListFooterComponent={isSubmitted ? null : <CardBottom bg={cardBg} border={cardBorder} />}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.page, { paddingBottom: 96 + insets.bottom }]}
          />
        </FadeIn>
      </KeyboardAvoidingView>

      <Dialog
        visible={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
        style={styles.dialog}
      >
        <ScrollView style={{ maxHeight: height * 0.85 - 48 }}>
          <View style={styles.dialogTitleRow}>
            <AlertTriangle size={20} color={c.red600} />
            <Text style={[styles.dialogTitle, { color: v.foreground }]}>Report Details</Text>
          </View>
          <Text style={[styles.dialogDesc, { color: v.mutedForeground }]}>
            Full details of your safety emergency report.
          </Text>
          {sel ? (
            <View style={styles.dialogBody}>
              <View style={styles.pillRow}>
                <StatusPill status={sel?.status} />
                {sel?.priority ? <PriorityPill priority={sel.priority} /> : null}
                {sel?.createdAt ? (
                  <Text style={[styles.itemDate, styles.noMargin, { color: mutedColor }]}>
                    {formatDateTime(sel.createdAt)}
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.msgBox,
                  { borderColor: isDark ? c.gray800 : c.gray200, backgroundColor: isDark ? "#0f0f0f" : "#ffffff" },
                ]}
              >
                <Text style={[styles.msgText, { color: isDark ? c.gray200 : c.gray800 }]}>{sel?.message || "—"}</Text>
              </View>
              {sel?.adminResponse ? (
                <View
                  style={[
                    styles.msgBox,
                    {
                      borderColor: isDark ? "rgba(6,78,59,0.4)" : c.emerald200,
                      backgroundColor: isDark ? "rgba(6,78,59,0.1)" : "rgba(236,253,245,0.6)",
                    },
                  ]}
                >
                  <Text style={[styles.adminLabel, { color: isDark ? c.emerald300 : c.emerald700 }]}>
                    Admin response
                  </Text>
                  <Text style={[styles.msgText, { color: isDark ? c.emerald100 : c.emerald900 }]}>
                    {sel.adminResponse}
                  </Text>
                  {sel?.respondedAt ? (
                    <Text
                      style={[
                        styles.respondedAt,
                        { color: isDark ? "rgba(110,231,183,0.8)" : "rgba(4,120,87,0.8)" },
                      ]}
                    >
                      Responded at: {formatDateTime(sel.respondedAt)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        <Pressable
          onPress={() => setIsHistoryDialogOpen(false)}
          style={styles.dialogClose}
          hitSlop={6}
          accessibilityLabel="Close"
        >
          <X size={20} color={v.foreground} />
        </Pressable>
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  page: { paddingHorizontal: 16, paddingTop: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 20, fontWeight: "700", flexShrink: 1 },
  card: { borderRadius: 12, marginBottom: 16, paddingHorizontal: 16 },
  cardPad: { paddingVertical: 16 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 16 },
  circleIcon: { borderRadius: 9999, padding: 8, marginTop: 2 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  cardBody: { fontSize: 14 },
  mb12: { marginBottom: 12 },
  emergencyLink: { fontSize: 16, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
  textarea: {
    minHeight: 150,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 23,
    ...inputFont,
  },
  counterRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  counter: { fontSize: 12 },
  submit: {
    height: 40,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
  historyTop: { marginTop: 20, ...shadow.sm },
  historyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  historyTitle: { fontSize: 16, fontWeight: "600" },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { fontSize: 14, fontWeight: "500" },
  historyEmpty: { fontSize: 14, marginTop: 16 },
  historyItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  itemMsg: { fontSize: 14, fontWeight: "500" },
  itemDate: { fontSize: 12, marginTop: 4 },
  noMargin: { marginTop: 0 },
  successCard: { borderRadius: 16, overflow: "hidden", ...shadow.md },
  successBody: { padding: 24, alignItems: "center" },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  successText: { fontSize: 14, marginBottom: 12, textAlign: "center" },
  successNote: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  dialog: { borderRadius: 16, ...shadow["2xl"] },
  dialogTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 32 },
  dialogTitle: { fontSize: 18, fontWeight: "600" },
  dialogDesc: { fontSize: 14, textAlign: "center", marginTop: 8 },
  dialogBody: { gap: 16, marginTop: 16 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  msgBox: { borderRadius: 8, borderWidth: 1, padding: 16 },
  msgText: { fontSize: 14, lineHeight: 23 },
  adminLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  respondedAt: { fontSize: 12, marginTop: 8 },
  dialogClose: { position: "absolute", top: 16, right: 16, padding: 8, borderRadius: 9999, opacity: 0.7 },
});
