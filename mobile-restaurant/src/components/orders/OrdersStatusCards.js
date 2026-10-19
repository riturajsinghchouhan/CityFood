// OrdersMain.jsx banners above the order list: "Profile Update Pending", the verification card
// (Denied Verification / Verification Done in 24 Hours) and "Dining Activation Request Pending".
import { AlertCircle, Clock } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";
import { pal } from "./ordersUtils";

function useEnter(delay = 0) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, delay, useNativeDriver: true }).start();
  }, [anim, delay]);
  return anim;
}

export function PendingUpdateBanner({ reason }) {
  const anim = useEnter();
  return (
    <Animated.View style={[styles.bannerWrap, { opacity: anim }]}>
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Clock size={20} color={pal.amber600} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{reason || "Update Pending"}</Text>
          <Text style={styles.bannerText}>
            Your restaurant <Text style={[styles.bannerText, { fontWeight: "700" }]}>{reason || "profile update"}</Text> is
            pending approval. Please wait for admin response. You are currently continuing operations with your existing
            details/location.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export function VerificationCard({ rejectionReason, isReverifying, onReverify }) {
  const anim = useEnter(100);
  const lines = rejectionReason ? rejectionReason.split("\n").filter((l) => l.trim()) : [];
  return (
    <Animated.View
      style={[
        styles.card,
        { borderColor: rejectionReason ? pal.red200 : pal.yellow200 },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
      ]}
    >
      {rejectionReason ? (
        <>
          <View style={styles.deniedRow}>
            <View style={styles.deniedIcon}>
              <AlertCircle size={20} color={tw.red600} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.deniedTitle}>Denied Verification</Text>
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Reason for Rejection:</Text>
                {lines.length > 1 ? (
                  <View style={{ gap: 4 }}>
                    {lines.map((point, i) => (
                      <Text key={i} style={styles.reasonText}>
                        {"• "}
                        {point.trim()}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.reasonText}>{rejectionReason}</Text>
                )}
              </View>
            </View>
          </View>
          <Text style={styles.reverifyHint}>
            Please correct the above issues and click &quot;Reverify&quot; to resubmit your request for approval.
          </Text>
          <Pressable
            onPress={onReverify}
            disabled={isReverifying}
            style={({ pressed }) => [styles.reverifyBtn, pressed && { backgroundColor: pal.blue700 }, isReverifying && { opacity: 0.5 }]}
          >
            {isReverifying ? <ActivityIndicator size={16} color="#fff" /> : null}
            <Text style={styles.reverifyText}>{isReverifying ? "Submitting..." : "Reverify"}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.verifyTitle}>Verification Done in 24 Hours</Text>
          <Text style={styles.verifyText}>Your account is under verification. You&apos;ll be notified once approved.</Text>
        </>
      )}
    </Animated.View>
  );
}

function PingDot() {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1000, easing: Easing.bezier(0, 0, 0.2, 1), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <View style={styles.pingWrap}>
      <Animated.View
        style={[
          styles.ping,
          {
            opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
          },
        ]}
      />
      <View style={styles.pingDot} />
    </View>
  );
}

export function DiningPendingCard({ request }) {
  const anim = useEnter();
  return (
    <Animated.View
      style={[
        styles.card,
        { borderColor: pal.blue200 },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
      ]}
    >
      <View style={styles.diningHead}>
        <View style={styles.diningIcon}>
          <Clock size={16} color={tw.blue600} />
        </View>
        <Text style={styles.diningTitle}>Dining Activation Request Pending</Text>
      </View>
      <Text style={styles.verifyText}>
        Your request to {request?.requestedSettings?.isEnabled ? "enable" : "update"} dining services is being reviewed by
        our team. You&apos;ll be notified via SMS/Dashboard once it&apos;s approved.
      </Text>
      <View style={styles.reviewRow}>
        <PingDot />
        <Text style={styles.reviewText}>UNDER REVIEW</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: { paddingHorizontal: 16, marginTop: 12 },
  banner: {
    backgroundColor: pal.amber50,
    borderWidth: 1,
    borderColor: pal.amber200,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  bannerIcon: { backgroundColor: pal.amber100, padding: 8, borderRadius: 14 },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: pal.amber900 },
  bannerText: { fontSize: 12, lineHeight: 19, color: pal.amber700, marginTop: 4 },
  card: {
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  deniedRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  deniedIcon: { borderRadius: 9999, padding: 8, backgroundColor: tw.red100 },
  deniedTitle: { fontSize: 18, fontWeight: "700", color: tw.red600, marginBottom: 8 },
  reasonBox: { backgroundColor: tw.red50, borderWidth: 1, borderColor: pal.red200, borderRadius: 8, padding: 12, marginBottom: 12 },
  reasonLabel: { fontSize: 12, fontWeight: "600", color: "#9f0712", marginBottom: 8 },
  reasonText: { fontSize: 12, color: tw.red700 },
  reverifyHint: { fontSize: 14, color: tw.gray700, marginBottom: 12 },
  reverifyBtn: {
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: tw.blue600,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reverifyText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  verifyTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900, marginBottom: 4 },
  verifyText: { fontSize: 14, color: tw.gray600 },
  diningHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  diningIcon: { padding: 8, borderRadius: 9999, backgroundColor: pal.blue100 },
  diningTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: tw.gray900 },
  reviewRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  reviewText: { fontSize: 10, fontWeight: "900", color: pal.blue500, letterSpacing: 1 },
  pingWrap: { width: 8, height: 8 },
  ping: { ...StyleSheet.absoluteFill, borderRadius: 9999, backgroundColor: pal.blue400 },
  pingDot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: pal.blue500 },
});
