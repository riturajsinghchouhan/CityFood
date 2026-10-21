// DeliveryHomeV2 "1. TOP HEADER" (feed tab only, absolute, --dv-primary background, safe-top pb-2):
// avatar -> /profile, the online/offline pill (92x32, green #22c55e online / red #ef4444 offline),
// Emergency (red triangle), ID card -> /help/id-card, Bell with the unread badge; then the status strip:
// DISTANCE / ARRIVAL cards with an active order, else "System Online/Offline" (+ Team Leader call),
// and the "Cash Limit Alert" banner.
// Not ported: the DEV "SIM" button.
import { router } from "expo-router";
import { AlertTriangle, Bell, Clock, Contact, Navigation2, Phone } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { brand, tw } from "../../theme/tokens";
import AppImage from "../ui/AppImage";
import Text from "../ui/Text";
import { callPhone } from "./mapUtils";
import { alpha, p } from "./palette";

const AVATAR = require("../../../assets/images/delivery_avatar.jpg");

// animate-pulse
function usePulse(active) {
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!active) {
      v.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.5, duration: 1000, easing: Easing.bezier(0.4, 0, 0.6, 1), useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.bezier(0.4, 0, 0.6, 1), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return v;
}

function OnlineToggle({ isOnline, onPress, disabled }) {
  const [x] = useState(() => new Animated.Value(isOnline ? 59 : 0));
  useEffect(() => {
    Animated.spring(x, { toValue: isOnline ? 59 : 0, useNativeDriver: true, bounciness: 6 }).start();
  }, [isOnline, x]);
  const bg = isOnline ? brand.onlineGreen : brand.offlineRed;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: isOnline }}
      style={[styles.toggle, { backgroundColor: bg, boxShadow: `0px 10px 15px -3px ${alpha(bg, 0.32)}` }]}
    >
      <View style={styles.toggleLabels}>
        <Text style={styles.toggleText}>{isOnline ? "Online" : ""}</Text>
        <Text style={styles.toggleText}>{!isOnline ? "Offline" : ""}</Text>
      </View>
      <Animated.View style={[styles.knob, { transform: [{ translateX: x }] }]} />
    </Pressable>
  );
}

function StatCard({ label, value, unit, Icon, iconStyle, borderColor }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.primary, borderColor, boxShadow: `0px 20px 25px -5px ${alpha(colors.primary, 0.35)}` },
      ]}
    >
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statValueRow}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statUnit}>{unit}</Text>
        </View>
      </View>
      <View style={styles.statIcon}>
        <Icon size={16} color={colors.primary} style={iconStyle} />
      </View>
    </View>
  );
}

export default function FeedHeader({
  profileImage,
  isOnline,
  onToggle,
  toggleBusy,
  unreadCount,
  onEmergency,
  onNotifications,
  activeOrder,
  distanceToTarget,
  eta,
  teamLeader,
  cashLimitNotice,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = usePulse(isOnline && !activeOrder);

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.primary, paddingTop: insets.top },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <Pressable onPress={() => router.push("/profile")} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            <AppImage src={profileImage || AVATAR} fallbackSrc={AVATAR} width={40} placeholderType="none" style={styles.avatarImg} />
          </Pressable>
          <OnlineToggle isOnline={isOnline} onPress={onToggle} disabled={toggleBusy} />
        </View>
        <View style={styles.right}>
          <Pressable
            onPress={onEmergency}
            accessibilityLabel="Emergency help"
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: alpha(p.red500, 0.1), borderColor: alpha(p.red500, 0.2) },
              pressed && styles.pressed,
            ]}
          >
            <AlertTriangle size={16} color={p.red500} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/help/id-card")}
            accessibilityLabel="ID card"
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
              pressed && styles.pressed,
            ]}
          >
            <Contact size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={onNotifications}
            accessibilityLabel="Notifications"
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.1)" },
              pressed && styles.pressed,
            ]}
          >
            <Bell size={16} color="#ffffff" />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={styles.strip}>
        {activeOrder ? (
          <View style={styles.cards}>
            <StatCard
              label="Distance"
              value={distanceToTarget && distanceToTarget !== Infinity ? (distanceToTarget / 1000).toFixed(1) : "--"}
              unit="KM"
              Icon={Navigation2}
              iconStyle={{ transform: [{ rotate: "45deg" }] }}
              borderColor={alpha(p.orange400, 0.5)}
            />
            <StatCard label="Arrival" value={eta ? String(eta) : "--"} unit="MIN" Icon={Clock} borderColor={alpha(p.green400, 0.5)} />
          </View>
        ) : (
          <View style={styles.statusCard}>
            <View style={styles.statusLeft}>
              <View style={[styles.statusDotWrap, { backgroundColor: colors.primarySoft }]}>
                <Animated.View
                  style={[styles.statusDot, { backgroundColor: isOnline ? colors.primary : tw.gray500, opacity: pulse }]}
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.statusTitle}>{isOnline ? "System Online" : "System Offline"}</Text>
                <Text style={styles.statusSub}>{isOnline ? "Waiting for order requests" : "Go online to receive orders"}</Text>
              </View>
            </View>
            {teamLeader ? (
              <View style={styles.leader}>
                <Pressable
                  onPress={() => callPhone(String(teamLeader).replace(/\D/g, ""))}
                  accessibilityLabel="Call Team Leader"
                  style={({ pressed }) => [styles.leaderBtn, pressed && styles.pressed]}
                >
                  <Phone size={16} color={p.blue400} />
                </Pressable>
                <Text style={styles.leaderText}>Team Leader</Text>
              </View>
            ) : null}
          </View>
        )}

        {!activeOrder && cashLimitNotice?.blocked ? (
          <View style={styles.cash}>
            <Text style={styles.cashTitle}>Cash Limit Alert</Text>
            <Text style={styles.cashMsg}>{cashLimitNotice?.message || "Please deposit your amount to get orders."}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  left: { flexDirection: "row", alignItems: "center", gap: 16 },
  right: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 9999 },
  pressed: { transform: [{ scale: 0.95 }] },
  toggle: { width: 92, height: 32, borderRadius: 9999, padding: 4, flexDirection: "row", alignItems: "center" },
  toggleLabels: { flex: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 },
  toggleText: { fontSize: 8.5, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.85, color: "#ffffff" },
  knob: {
    position: "absolute",
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#121212",
  },
  badgeText: { fontSize: 9, fontWeight: "900", color: "#ffffff", lineHeight: 11 },
  strip: { paddingHorizontal: 12, marginTop: 4 },
  cards: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  statLabel: { fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: "900", textTransform: "uppercase", letterSpacing: 9 * 0.15, marginBottom: 4 },
  statValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  statValue: { fontSize: 24, lineHeight: 26, fontWeight: "900", color: "#ffffff", letterSpacing: -1.2 },
  statUnit: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "700", marginBottom: 2 },
  statIcon: {
    width: 36,
    height: 36,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)",
  },
  statusCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statusLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 16 },
  statusDotWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  flex1: { flex: 1 },
  statusTitle: { color: "#ffffff", fontWeight: "900", fontSize: 11, lineHeight: 12, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 },
  statusSub: { color: tw.gray400, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: -0.25 },
  leader: { alignItems: "center", justifyContent: "center", marginLeft: 12 },
  leaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: alpha(p.blue500, 0.2),
    borderWidth: 1,
    borderColor: alpha(p.blue500, 0.3),
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)",
  },
  leaderText: { fontSize: 8, fontWeight: "700", color: alpha(p.blue300, 0.8), textTransform: "uppercase", marginTop: 4, letterSpacing: 0.4, textAlign: "center" },
  cash: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: alpha(p.amber300, 0.4),
    backgroundColor: alpha(p.amber500, 0.1),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cashTitle: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4, color: p.amber200 },
  cashMsg: { marginTop: 4, fontSize: 11, fontWeight: "600", color: p.amber100 },
});
