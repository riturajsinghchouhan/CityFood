// DeliveryV2/pages/ProfileV2 (/profile tab): sticky primary header, the name / partner ID / avatar
// block (-> profile/details), "Trips history" (-> /history), the current shift selfie card, Share &
// Earn referral, Support tickets, Test Notification, Delete Account (2-step) and Log out (confirm).
// The web remounts ProfileV2 on every tab switch, so the profile reloads (with the loader) on focus.
// Push registration on mount is handled app-wide by the root PushBinding. Logout goes through
// AuthContext.logout(), which also stops tracking and sets the rider offline (the web did not).
import { router, useFocusEffect } from "expo-router";
import dayjs from "dayjs";
import {
  ArrowRight,
  Bell,
  Bike,
  Briefcase,
  ChevronRight,
  LogOut,
  Ticket,
  Trash2,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deleteAccount, getProfile, getReferralStats, sendTestNotification } from "../../api";
import Spinner from "../../components/content/Spinner";
import { DeleteAccountDialog, LogoutDialog } from "../../components/profile/ProfileDialogs";
import { serverMessage, twp } from "../../components/profile/common";
import { AppImage, Screen, Text, toast } from "../../components/ui";
import { ASSET_ORIGIN } from "../../config";
import { useAuth } from "../../context/AuthContext";
import { brand, dvColor, light, shadow, tw } from "../../theme/tokens";

const TRACK_WIDEST = 1.2; // tracking-widest at 12px
const LABEL_TRACK = 2; // tracking-[0.2em] at 10px

function SectionLabel({ children, style }) {
  return (
    <Text heading style={[styles.sectionLabel, style]}>
      {children}
    </Text>
  );
}

function LinkRow({ icon: Icon, iconColor, label, labelColor = tw.gray900, arrowColor, borderColor, onPress, iconStyle }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        borderColor ? { borderWidth: 1, borderColor } : null,
        pressed && { backgroundColor: tw.gray50 },
      ]}
    >
      <View style={styles.linkLeft}>
        <Animated.View style={iconStyle}>
          <Icon size={20} color={iconColor} />
        </Animated.View>
        <Text style={[styles.linkText, { color: labelColor }]}>{label}</Text>
      </View>
      <ArrowRight size={20} color={arrowColor} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [referralReward, setReferralReward] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteCaptcha, setDeleteCaptcha] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [pulse] = useState(() => new Animated.Value(1));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      getProfile()
        .then((res) => {
          if (alive && res?.success && res?.data?.profile) setProfile(res.data.profile);
        })
        .catch(() => {
          if (alive) toast.error("Failed to load profile data");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      getReferralStats()
        .then((res) => {
          if (alive) setReferralReward(Number(res?.data?.stats?.rewardAmount) || 0);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  // animate-pulse on the bell while the test is sending
  useEffect(() => {
    if (!isTestingNotification) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isTestingNotification, pulse]);

  const refId = profile?._id || profile?.id || profile?.referralCode || "";
  const referralLink = refId ? `${ASSET_ORIGIN}/food/delivery/signup?ref=${encodeURIComponent(String(refId))}` : "";

  const handleShareReferral = async () => {
    if (!referralLink) return;
    const rewardText = referralReward > 0 ? `₹${referralReward}` : "rewards";
    const shareText = `Join as a delivery partner and earn ${rewardText}.`;
    try {
      await Share.share({ title: "Delivery referral", message: `${shareText} ${referralLink}` });
    } catch {
      // dismissed
    }
  };

  const handleLogout = async () => {
    if (logoutSubmitting) return;
    setShowLogoutConfirm(false);
    setLogoutSubmitting(true);
    try {
      await logout();
    } catch {
      // logout never blocks on API failures
    }
    toast.success("Logged out successfully");
    router.replace("/login");
    if (mounted.current) setLogoutSubmitting(false);
  };

  const handleTestNotification = async () => {
    if (isTestingNotification) return;
    setIsTestingNotification(true);
    try {
      const response = await sendTestNotification("mobile");
      const details = response?.data || {};
      const successCount = details?.successCount || 0;
      const failureCount = details?.failureCount || 0;
      if (successCount > 0) {
        toast.success(`Test sent! Delivered: ${successCount}, Failed: ${failureCount}`);
      } else {
        toast.error(`Test failed to deliver. Delivered: 0, Failed: ${failureCount}`);
      }
    } catch (err) {
      toast.error(serverMessage(err, "Failed to send test notification"));
    } finally {
      if (mounted.current) setIsTestingNotification(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteAccount();
      toast.success("Account deleted successfully");
      setDeleteAccountOpen(false);
      // clearModuleAuth("delivery"): the account is gone, so the logout API calls just fail quietly;
      // this also stops background tracking.
      await logout().catch(() => {});
      router.replace("/login");
    } catch (err) {
      toast.error(serverMessage(err, "Failed to delete account"));
    } finally {
      if (mounted.current) setIsDeleting(false);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerInner}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen edges={[]} background={tw.gray100}>
        <View style={styles.loading}>
          <View style={styles.loadingRow}>
            <Spinner size={20} color={tw.gray700} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </View>
      </Screen>
    );
  }

  const shiftTime = profile?.shiftStartTime ? dayjs(profile.shiftStartTime) : null;

  return (
    <Screen edges={[]} background={tw.gray100} statusBarStyle="light">
      {header}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Pressable onPress={() => router.push("/profile/details")} style={styles.heroRow}>
            <View style={styles.flex1}>
              <View style={styles.nameRow}>
                <Text heading style={styles.name}>
                  {profile?.name || ""}
                </Text>
                <ChevronRight size={20} color={tw.gray400} />
              </View>
              <Text style={styles.deliveryId}>{profile?.deliveryId || ""}</Text>
            </View>
            <View style={styles.avatarWrap}>
              {profile?.profileImage?.url ? (
                <AppImage src={profile.profileImage.url} width={80} placeholderType="none" style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <User size={40} color={tw.gray400} />
                </View>
              )}
              <View style={styles.badge}>
                <Briefcase size={16} color={tw.gray600} />
              </View>
            </View>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Pressable
            onPress={() => router.push("/history")}
            style={({ pressed }) => [styles.tripsBtn, pressed && { backgroundColor: tw.gray50 }]}
          >
            <View style={styles.tripsIcon}>
              <Bike size={24} color={tw.gray700} />
            </View>
            <Text style={styles.tripsText}>Trips history</Text>
          </Pressable>

          <View style={styles.sections}>
            {profile?.shiftStartPic ? (
              <View style={styles.shiftCard}>
                <SectionLabel style={{ marginBottom: 0 }}>Current Shift Verification</SectionLabel>
                <View style={styles.shiftRow}>
                  <View style={styles.shiftPic}>
                    <AppImage src={profile.shiftStartPic} width={80} placeholderType="none" style={styles.fill} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.shiftTime}>
                      Started at {shiftTime && shiftTime.isValid() ? shiftTime.format("hh:mm a") : "Invalid Date"}
                    </Text>
                    {profile.shiftStartAddress ? (
                      <Text style={styles.shiftAddress} numberOfLines={2}>
                        {profile.shiftStartAddress}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.shareCard}>
              <View style={styles.flexShrink}>
                <Text heading style={styles.shareTitle}>
                  Share & Earn{referralReward > 0 ? ` ₹${referralReward}` : ""}
                </Text>
                <Text style={styles.shareSub}>Invite friends to join the delivery partner fleet.</Text>
              </View>
              <Pressable onPress={handleShareReferral} style={styles.shareBtn}>
                <Text style={styles.shareBtnText}>Share</Text>
              </Pressable>
            </View>

            <View>
              <SectionLabel style={styles.supportLabel}>Support</SectionLabel>
              <LinkRow
                icon={Ticket}
                iconColor={tw.gray700}
                label="Support tickets"
                arrowColor={tw.gray300}
                onPress={() => router.push("/help/tickets")}
              />
            </View>

            <LinkRow
              icon={Bell}
              iconColor={dvColor("text-blue-500", light)}
              iconStyle={{ opacity: pulse }}
              label={isTestingNotification ? "Sending test..." : "Test Notification"}
              arrowColor={twp.blue200}
              borderColor={twp.blue50}
              onPress={handleTestNotification}
            />

            <LinkRow
              icon={Trash2}
              iconColor={tw.red500}
              label="Delete Account"
              labelColor={tw.red500}
              arrowColor={twp.red200}
              borderColor={tw.red100}
              onPress={() => {
                setDeleteStep(1);
                setDeleteCaptcha("");
                setDeleteAccountOpen(true);
              }}
            />

            <View style={styles.logoutWrap}>
              <LinkRow
                icon={LogOut}
                iconColor={tw.red600}
                label="Log out"
                labelColor={tw.red600}
                arrowColor={twp.red100}
                borderColor={tw.red50}
                onPress={() => setShowLogoutConfirm(true)}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <LogoutDialog
        visible={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        submitting={logoutSubmitting}
      />
      <DeleteAccountDialog
        visible={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        step={deleteStep}
        setStep={setDeleteStep}
        captcha={deleteCaptcha}
        setCaptcha={setDeleteCaptcha}
        deleting={isDeleting}
        onDelete={handleDelete}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  fill: { width: "100%", height: "100%" },
  header: { backgroundColor: brand.primary, zIndex: 50, ...shadow.sm },
  headerInner: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 16 },
  headerTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 18 * 0.05,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: tw.gray700 },
  scroll: { paddingBottom: 24 },
  hero: { backgroundColor: "#ffffff", padding: 16, ...shadow.sm },
  heroRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  name: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: tw.gray900, flexShrink: 1 },
  deliveryId: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: tw.gray600, marginBottom: 12 },
  avatarWrap: { marginLeft: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: tw.gray200, overflow: "hidden" },
  avatarEmpty: { backgroundColor: tw.gray100, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    borderRadius: 9999,
    padding: 8,
    borderWidth: 2,
    borderColor: "#ffffff",
    ...shadow.md,
  },
  body: { paddingHorizontal: 16, paddingVertical: 24 },
  tripsBtn: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  tripsIcon: { borderRadius: 9999, backgroundColor: tw.gray50, padding: 12 },
  tripsText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: tw.gray900 },
  sections: { gap: 16 },
  sectionLabel: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: LABEL_TRACK,
  },
  supportLabel: { marginBottom: 12, paddingHorizontal: 4 },
  shiftCard: { backgroundColor: "#ffffff", borderRadius: 14, padding: 16, gap: 12 },
  shiftRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  shiftPic: {
    width: 80,
    height: 80,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: tw.green500,
    overflow: "hidden",
    ...shadow.sm,
  },
  shiftTime: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: tw.gray900, marginBottom: 4 },
  shiftAddress: { fontSize: 12, lineHeight: 16, fontWeight: "500", color: tw.gray500 },
  shareCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  shareTitle: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: tw.gray900, marginBottom: 4 },
  shareSub: { fontSize: 12, lineHeight: 16, fontWeight: "500", color: tw.gray500 },
  shareBtn: {
    flexShrink: 0,
    backgroundColor: "#000000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    ...shadow.md,
  },
  shareBtnText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: TRACK_WIDEST,
  },
  linkRow: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  linkText: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  logoutWrap: { paddingTop: 8 },
});
