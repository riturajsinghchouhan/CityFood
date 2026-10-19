// Port of Frontend/src/modules/Food/pages/user/profile/ReferEarn.jsx.
import { ArrowLeft, CircleCheck, CircleX, Clock3, Share2, Users, Wallet } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { getReferralDetails } from "../../api";
import { buildReferralLink, referralShareText, shareReferral } from "../../components/account/referral";
import { Screen, Text, toast } from "../../components/ui";
import { useCompanyName } from "../../context/AppSettingsContext";
import { useProfile } from "../../context/ProfileContext";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";

const STATUS_META = {
  credited: {
    label: "Credited",
    Icon: CircleCheck,
    light: { bg: tw.green100, fg: tw.green700 },
    dark: { bg: "rgba(20,83,45,0.2)", fg: "#86efac" },
  },
  pending: {
    label: "Pending",
    Icon: Clock3,
    light: { bg: "#fef3c7", fg: "#b45309" },
    dark: { bg: "rgba(120,53,15,0.2)", fg: "#fcd34d" },
  },
  rejected: {
    label: "Rejected",
    Icon: CircleX,
    light: { bg: tw.red100, fg: "#b91c1c" },
    dark: { bg: "rgba(127,29,29,0.2)", fg: "#fca5a5" },
  },
};

const EMPTY_STATS = {
  referralCount: 0,
  totalReferralEarnings: 0,
  rewardAmount: 0,
  totalInvited: 0,
  creditedCount: 0,
  pendingCount: 0,
  rejectedCount: 0,
};

export default function ReferEarnScreen() {
  const { colors, isDark } = useTheme();
  const { userProfile } = useProfile();
  const companyName = useCompanyName();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [invitedFriends, setInvitedFriends] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getReferralDetails();
        const next = res?.data?.stats || {};
        const invited = res?.data?.invitedFriends || [];
        if (!cancelled) {
          setStats({
            referralCount: Number(next.referralCount) || 0,
            totalReferralEarnings: Number(next.totalReferralEarnings) || 0,
            rewardAmount: Number(next.rewardAmount) || 0,
            totalInvited: Number(next.totalInvited) || 0,
            creditedCount: Number(next.creditedCount) || 0,
            pendingCount: Number(next.pendingCount) || 0,
            rejectedCount: Number(next.rejectedCount) || 0,
          });
          setInvitedFriends(Array.isArray(invited) ? invited : []);
        }
      } catch {
        if (!cancelled) {
          setInvitedFriends([]);
          toast.error("Failed to load referral details");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const referralLink = buildReferralLink(userProfile);
  const shareText = useMemo(
    () => referralShareText(companyName, stats.rewardAmount),
    [companyName, stats.rewardAmount],
  );

  const handleShare = async () => {
    if (!referralLink) {
      toast.error("Referral link unavailable");
      return;
    }
    try {
      await shareReferral({
        companyName,
        text: shareText,
        link: referralLink,
        copyFallback: true,
        onCopied: () => toast.success("Referral link copied"),
      });
    } catch {
      toast.error("Unable to share right now");
    }
  };

  const cardBg = isDark ? "#1a1a1a" : "#ffffff";
  const strong = isDark ? "#ffffff" : tw.gray900;
  const muted = isDark ? tw.gray400 : tw.gray500;
  const tileBg = isDark ? "rgba(31,41,55,0.5)" : tw.gray50;

  const statTile = (Icon, label, value) => (
    <View style={[styles.statCard, { backgroundColor: cardBg }]}>
      <View style={styles.statHead}>
        <Icon size={14} color={muted} />
        <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: strong }]}>{value}</Text>
    </View>
  );

  const header = (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => goTo("/profile")} style={styles.backBtn} hitSlop={6}>
          <ArrowLeft size={20} color={isDark ? "#ffffff" : "#000000"} />
        </Pressable>
        <Text style={[styles.h1, { color: isDark ? "#ffffff" : "#000000" }]}>Refer & Earn</Text>
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.intro, { color: isDark ? tw.gray300 : tw.gray600 }]}>
          Invite friends and earn when they sign up.
        </Text>
        <View style={styles.twoCol}>
          <View style={[styles.tile, { backgroundColor: tileBg }]}>
            <Text style={[styles.tileLabel, { color: muted }]}>Reward per invite</Text>
            <Text style={[styles.tileValue, { color: colors.primary }]}>
              {"₹"}
              {stats.rewardAmount}
            </Text>
          </View>
          <View style={[styles.tile, { backgroundColor: tileBg }]}>
            <Text style={[styles.tileLabel, { color: muted }]}>Referral earnings</Text>
            <Text style={[styles.tileValue, { color: isDark ? "#4ade80" : tw.green600 }]}>
              {"₹"}
              {stats.totalReferralEarnings}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleShare}
          disabled={!referralLink}
          style={[styles.shareBtn, { backgroundColor: colors.primary }, !referralLink && styles.disabled]}
        >
          <Share2 size={16} color="#ffffff" />
          <Text style={styles.shareText}>Share Invite</Text>
        </Pressable>
      </View>

      <View style={styles.threeCol}>
        {statTile(Users, "Invited", stats.totalInvited)}
        {statTile(CircleCheck, "Credited", stats.creditedCount)}
        {statTile(Wallet, "Total", `₹${stats.totalReferralEarnings}`)}
      </View>

      <View
        style={[
          styles.listTop,
          { backgroundColor: cardBg },
          (loading || invitedFriends.length === 0) && styles.listClosed,
        ]}
      >
        <Text style={[styles.listTitle, { color: strong }]}>Invited Friends Status</Text>
        {loading ? (
          <Text style={[styles.listNote, { color: muted }]}>Loading referrals...</Text>
        ) : invitedFriends.length === 0 ? (
          <Text style={[styles.listNote, { color: muted }]}>
            No invited friends yet. Share your referral to start earning.
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderItem = ({ item, index }) => {
    const meta = STATUS_META[item?.status] || STATUS_META.pending;
    const tone = isDark ? meta.dark : meta.light;
    const invitedDate = item?.invitedAt ? new Date(item.invitedAt) : null;
    const dateText = invitedDate && !Number.isNaN(invitedDate.getTime()) ? invitedDate.toLocaleDateString() : "-";
    const last = index === invitedFriends.length - 1;
    return (
      <View style={[styles.itemWrap, { backgroundColor: cardBg }, last && styles.itemLast]}>
        <View style={[styles.friend, { borderColor: isDark ? tw.gray800 : tw.gray200 }]}>
          <View style={styles.friendInfo}>
            <Text numberOfLines={1} style={[styles.friendName, { color: strong }]}>
              {item?.name || "Friend"}
            </Text>
            <Text style={[styles.friendPhone, { color: muted }]}>{item?.phone || "Phone hidden"}</Text>
            <Text style={[styles.friendDate, { color: muted }]}>Invited on {dateText}</Text>
          </View>
          <View style={styles.friendRight}>
            <View style={[styles.status, { backgroundColor: tone.bg }]}>
              <meta.Icon size={12} color={tone.fg} />
              <Text style={[styles.statusText, { color: tone.fg }]}>{meta.label}</Text>
            </View>
            <Text style={[styles.earned, { color: isDark ? tw.gray300 : tw.gray700 }]}>
              Earned: {"₹"}
              {Number(item?.earnedAmount) || 0}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Screen background={isDark ? "#0a0a0a" : "#f5f5f5"}>
      <FlatList
        data={loading ? [] : invitedFriends}
        keyExtractor={(item, index) => String(item?.id || item?.refereeId || index)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 96 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  h1: { fontSize: 20, fontWeight: "700" },
  card: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 40, marginBottom: 12, ...shadow.sm },
  intro: { fontSize: 14 },
  twoCol: { flexDirection: "row", gap: 8, marginTop: 12 },
  tile: { flex: 1, borderRadius: 12, padding: 12 },
  tileLabel: { fontSize: 11 },
  tileValue: { fontSize: 18, fontWeight: "700" },
  shareBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareText: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
  disabled: { opacity: 0.5 },
  threeCol: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 36, ...shadow.sm },
  statHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  listTop: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 12,
  },
  listClosed: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingBottom: 40, ...shadow.sm },
  listTitle: { fontSize: 14, fontWeight: "600" },
  listNote: { fontSize: 14, marginTop: 12 },
  itemWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  itemLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingBottom: 40 },
  friend: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  friendInfo: { flex: 1, minWidth: 0 },
  friendName: { fontSize: 14, fontWeight: "600" },
  friendPhone: { fontSize: 12, marginTop: 2 },
  friendDate: { fontSize: 11, marginTop: 4 },
  friendRight: { alignItems: "flex-end" },
  status: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "500" },
  earned: { fontSize: 12, marginTop: 8 },
});
