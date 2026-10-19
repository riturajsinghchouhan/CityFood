// auth/VerificationPending.jsx: "Under Review" card, or "Action Required" with the rejection reason.
// With a token, checks GET /current once and again whenever the app returns to the foreground
// (web: focus/visibilitychange); approved -> "/". The web's router state {phone, isRejected,
// rejectionReason} comes in as route params, falling back to the last verify-otp/register outcome.
import { router, useLocalSearchParams } from "expo-router";
import { AlertCircle, Clock3, ShieldCheck } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useBranding } from "../../components/auth/useBranding";
import { Screen, ScalePressable, Text } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";

const slate = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  400: "#90a1b9",
  500: "#62748e",
  600: "#45556c",
  900: "#0f172b",
  950: "#020618",
};

function PulsingClock() {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View style={{ opacity }}>
      <Clock3 size={40} color="#fe9a00" />
    </Animated.View>
  );
}

export default function VerificationPendingScreen() {
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { companyName } = useBranding();
  const { isAuthenticated, pendingPhone: storedPendingPhone, pendingApproval, refreshRestaurant, clearPendingPhone } =
    useAuth();

  const hasParams = params.isRejected !== undefined || params.phone !== undefined;
  const isRejected = hasParams ? params.isRejected === "1" || params.isRejected === "true" : Boolean(pendingApproval?.isRejected);
  const rejectionReason = hasParams ? String(params.rejectionReason || "") : pendingApproval?.rejectionReason || "";
  const pendingPhone = (typeof params.phone === "string" && params.phone) || pendingApproval?.phone || storedPendingPhone || "";

  const [checkingStatus, setCheckingStatus] = useState(true);
  const checkingRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const checkApprovalStatus = async () => {
      if (isRejected && !checkingRef.current) return;
      // Pending/rejected owners normally have no token (verify-otp returned none).
      if (!isAuthenticated) {
        if (!cancelled) {
          checkingRef.current = false;
          setCheckingStatus(false);
        }
        return;
      }
      try {
        const restaurant = await refreshRestaurant({ noCache: true });
        if (cancelled) return;
        if (String(restaurant?.status || "").toLowerCase() === "approved") {
          clearPendingPhone();
          router.replace("/");
        }
      } catch {
        // Keep the pending screen visible if the status check fails.
      } finally {
        if (!cancelled) {
          checkingRef.current = false;
          setCheckingStatus(false);
        }
      }
    };

    checkApprovalStatus();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkApprovalStatus();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [isAuthenticated, isRejected, refreshRestaurant, clearPendingPhone]);

  const backToLogin = () => {
    clearPendingPhone();
    router.replace("/login");
  };

  return (
    <Screen edges={["top", "bottom"]} background={slate[50]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {isRejected ? (
              <View style={[styles.iconBox, styles.iconRejected]}>
                <AlertCircle size={40} color={tw.red500} />
              </View>
            ) : (
              <View style={[styles.iconBox, styles.iconPending]}>
                <PulsingClock />
              </View>
            )}
          </View>

          <View style={styles.textBlock}>
            <Text style={[styles.kicker, { color: isRejected ? tw.red600 : "#e17100" }]}>
              {isRejected ? "REGISTRATION REJECTED" : "VERIFICATION PENDING"}
            </Text>
            <Text style={styles.title}>{isRejected ? "Action Required" : "Under Review"}</Text>
            <Text style={styles.body}>
              {isRejected
                ? "Your restaurant registration was not approved. Please review the reason below and try again."
                : `${companyName} received your onboarding details successfully. Our team will verify your restaurant soon.`}
            </Text>
            {!isRejected && checkingStatus ? <Text style={styles.checking}>CHECKING APPROVAL STATUS...</Text> : null}
          </View>

          {isRejected && rejectionReason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>REJECTION REASON</Text>
              <Text style={styles.reasonText}>{`"${rejectionReason}"`}</Text>
            </View>
          ) : null}

          {!isRejected ? (
            <View style={styles.nextBox}>
              <View style={styles.nextRow}>
                <View style={styles.nextIcon}>
                  <ShieldCheck size={16} color="#009966" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.nextTitle}>{"What's next?"}</Text>
                  <Text style={styles.nextText}>{"We'll notify you via SMS/Email once verified."}</Text>
                  {pendingPhone ? (
                    <Text style={styles.idText}>
                      ID: <Text style={[styles.idText, { color: slate[600] }]}>{pendingPhone}</Text>
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            {isRejected ? (
              <ScalePressable
                scaleTo={0.98}
                onPress={() => router.replace("/onboarding")}
                style={[styles.primaryBtn, styles.retryBtn]}
              >
                <Text style={styles.primaryBtnText}>Retry Registration</Text>
              </ScalePressable>
            ) : (
              <ScalePressable
                scaleTo={0.98}
                onPress={backToLogin}
                style={[styles.primaryBtn, { backgroundColor: colors.primary, boxShadow: `0px 20px 25px -5px ${colors.primary}33` }]}
              >
                <Text style={styles.primaryBtnText}>Back to Login</Text>
              </ScalePressable>
            )}
            {isRejected ? (
              <Pressable onPress={backToLogin} style={styles.signOut}>
                <Text style={styles.signOutText}>SIGN OUT</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  card: {
    borderRadius: 48,
    borderWidth: 1,
    borderColor: slate[200],
    backgroundColor: "#ffffff",
    padding: 40,
    boxShadow: "0px 40px 100px rgba(15,23,42,0.1)",
  },
  iconWrap: { marginBottom: 32, alignItems: "center", justifyContent: "center" },
  iconBox: { width: 80, height: 80, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  iconPending: { backgroundColor: "#fffbeb", boxShadow: "0px 10px 15px -3px #fef3c6, 0px 4px 6px -4px #fef3c6" },
  iconRejected: { backgroundColor: tw.red50, boxShadow: "0px 10px 15px -3px #ffe2e2, 0px 4px 6px -4px #ffe2e2" },
  textBlock: { marginBottom: 32, alignItems: "center" },
  kicker: { marginBottom: 12, fontSize: 12, fontWeight: "900", letterSpacing: 3.6, textAlign: "center" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "900", color: slate[950], letterSpacing: -0.75, textAlign: "center" },
  body: { marginTop: 16, fontSize: 14, lineHeight: 23, fontWeight: "500", color: slate[500], textAlign: "center" },
  checking: { marginTop: 16, fontSize: 10, fontWeight: "700", letterSpacing: 2, color: slate[400], textAlign: "center" },
  reasonBox: {
    marginBottom: 32,
    borderRadius: 32,
    backgroundColor: "rgba(254,242,242,0.5)",
    borderWidth: 1,
    borderColor: tw.red100,
    padding: 24,
  },
  reasonLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: tw.red600, marginBottom: 8 },
  reasonText: { fontSize: 14, lineHeight: 23, fontWeight: "700", color: "#82181a", fontStyle: "italic" },
  nextBox: {
    marginBottom: 32,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: slate[100],
    backgroundColor: "rgba(248,250,252,0.5)",
    padding: 24,
  },
  nextRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  nextIcon: {
    marginTop: 4,
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  nextTitle: { fontSize: 14, fontWeight: "700", color: slate[900] },
  nextText: { marginTop: 4, fontSize: 14, color: slate[600], opacity: 0.8 },
  idText: { marginTop: 12, fontSize: 12, fontWeight: "500", color: slate[400] },
  actions: { gap: 16 },
  primaryBtn: { height: 56, width: "100%", borderRadius: 16, alignItems: "center", justifyContent: "center" },
  retryBtn: { backgroundColor: tw.red600, boxShadow: "0px 20px 25px -5px #ffc9c9" },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  signOut: { width: "100%", paddingVertical: 8, alignItems: "center" },
  signOutText: { fontSize: 12, fontWeight: "900", letterSpacing: 2.4, color: slate[400] },
});
