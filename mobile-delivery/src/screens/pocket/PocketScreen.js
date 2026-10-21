// DeliveryV2/pages/PocketV2 (/pocket tab): sticky primary header, bank-details banner, weekly
// earnings, the live "Earnings Guarantee" offer, pocket balance / cash limit rows with Deposit Cash
// (Razorpay), and the Payout / Limit settlement / Deductions / Pocket statement tiles.
// The web remounts PocketV2 on every tab switch, so data reloads (with the loader) on each focus.
// Not ported: the earnings card's navigate('/food/delivery/earnings') — that route does not exist
// on web (it falls back to the feed), so the card is not pressable here.
import { router, useFocusEffect } from "expo-router";
import dayjs from "dayjs";
import {
  ChevronRight,
  FileText,
  HelpCircle,
  IndianRupee,
  LayoutGrid,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getActiveEarningAddons, getEarnings, getProfile, getWallet } from "../../api";
import Spinner from "../../components/content/Spinner";
import DepositSheet from "../../components/pocket/DepositSheet";
import ProgressRing from "../../components/pocket/ProgressRing";
import { dvCard, twx } from "../../components/pocket/common";
import { payCashDeposit } from "../../components/pocket/depositPayment";
import { Screen, Text, toast } from "../../components/ui";
import { brand, dvColor, light, tw } from "../../theme/tokens";

const INITIAL_WALLET = {
  totalBalance: 0,
  cashInHand: 0,
  availableCashLimit: 0,
  totalCashLimit: 0,
  weeklyEarnings: 0,
  weeklyOrders: 0,
  payoutAmount: 0,
  payoutPeriod: "Current Week",
  bankDetailsFilled: false,
};

const INITIAL_OFFER = {
  targetAmount: 0,
  targetOrders: 0,
  currentOrders: 0,
  currentEarnings: 0,
  validTill: "",
  isLive: false,
};

function formatOfferValidTill(validTill) {
  if (!validTill) return "";
  const parsed = new Date(validTill);
  if (Number.isNaN(parsed.getTime())) return String(validTill);
  return dayjs(parsed).format("dddd");
}

// Sunday-Saturday week, "D MMM - D MMM".
function getCurrentWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatDate = (d) => dayjs(d).format("D MMM");
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function PulseDot() {
  const [anim] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={[styles.liveDot, { opacity: anim }]} />;
}

function ActionRow({ icon: Icon, title, caption, value, onPress, last }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, !last && styles.actionRowBorder, pressed && { backgroundColor: tw.gray50 }]}
    >
      <View style={styles.actionLeft}>
        <View style={styles.actionIcon}>
          <Icon size={24} color={tw.black} />
        </View>
        <View>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionCaption}>{caption}</Text>
        </View>
      </View>
      <View style={styles.actionRight}>
        <Text style={styles.actionValue}>{value}</Text>
        <ChevronRight size={16} color={tw.gray300} />
      </View>
    </Pressable>
  );
}

function Tile({ onPress, iconBg, iconColor, iconBorder, icon: Icon, children, spread }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, dvCard, spread && { justifyContent: "space-between" }, pressed && { backgroundColor: tw.gray50 }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: iconBg, borderColor: iconBorder }]}>
        <Icon size={20} color={iconColor} />
      </View>
      {children}
    </Pressable>
  );
}

export default function PocketScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [walletState, setWalletState] = useState(INITIAL_WALLET);
  const [activeOffer, setActiveOffer] = useState(INITIAL_OFFER);
  const [showDepositPopup, setShowDepositPopup] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, earningsRes, walletRes] = await Promise.all([
        getProfile(),
        getEarnings({ period: "week" }),
        getWallet(),
      ]);
      const profile = profileRes?.data?.profile || {};
      const summary = earningsRes?.data?.summary || {};
      const wallet = walletRes?.data?.wallet || {};
      const activeAddonsRes = await getActiveEarningAddons().catch(() => null);
      const activeOfferPayload = activeAddonsRes?.data?.activeOffer || activeAddonsRes?.activeOffer || null;
      if (!aliveRef.current) return;

      setWalletState({
        totalBalance: Number(wallet?.pocketBalance ?? wallet?.totalBalance ?? 0) || 0,
        cashInHand: Number(wallet?.cashInHand ?? 0) || 0,
        availableCashLimit: Number(wallet?.availableCashLimit ?? 0) || 0,
        totalCashLimit: Number(wallet?.totalCashLimit ?? 0) || 0,
        weeklyEarnings: Number(summary?.totalEarnings ?? 0) || 0,
        weeklyOrders: Number(summary?.totalOrders ?? 0) || 0,
        payoutAmount: Number(wallet?.lastPayout?.amount ?? wallet?.totalWithdrawn ?? 0) || 0,
        payoutPeriod: "Current Week",
        bankDetailsFilled: Boolean(profile?.documents?.bankDetails?.accountNumber),
      });
      setActiveOffer({
        targetAmount: Number(activeOfferPayload?.targetAmount) || 0,
        targetOrders: Number(activeOfferPayload?.targetOrders) || 0,
        currentOrders: Number(activeOfferPayload?.currentOrders) || 0,
        currentEarnings: Number(activeOfferPayload?.currentEarnings) || 0,
        validTill: activeOfferPayload?.validTill || "",
        isLive: Boolean(activeOfferPayload),
      });
    } catch {
      if (aliveRef.current) toast.error("Failed to load wallet data");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const closeDeposit = useCallback(() => setShowDepositPopup(false), []);

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amt) || amt < 1) {
      toast.error("Enter a valid amount (minimum ₹1)");
      return;
    }
    if (amt > walletState.cashInHand) {
      toast.error(`Deposit amount cannot exceed cash in hand (₹${walletState.cashInHand})`);
      return;
    }
    setDepositing(true);
    try {
      const result = await payCashDeposit(amt);
      if (result.status === "invalid") {
        toast.error("Payment initialization failed");
      } else if (result.status === "paid" && result.verify?.success) {
        toast.success("Deposit successful");
        setShowDepositPopup(false);
        setDepositAmount("");
        // web: window.location.reload()
        fetchData();
      }
    } catch (err) {
      toast.error(err?.stage === "verify" ? "Verification failed" : "Deposit failed to start");
    } finally {
      if (aliveRef.current) setDepositing(false);
    }
  };

  const ordersProgress =
    activeOffer.targetOrders > 0 ? Math.min(activeOffer.currentOrders / activeOffer.targetOrders, 1) : 0;
  const earningsProgress =
    activeOffer.targetAmount > 0 ? Math.min(activeOffer.currentEarnings / activeOffer.targetAmount, 1) : 0;
  const hasActiveOffer = activeOffer.isLive && (activeOffer.targetAmount > 0 || activeOffer.targetOrders > 0);

  if (loading) {
    return (
      <Screen edges={["top"]} background={brand.bg}>
        <View style={styles.loading}>
          <Spinner size={40} color={brand.primary} />
          <Text style={styles.loadingText}>Loading Pocket...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]} background={brand.bg} statusBarStyle="light">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <Text style={styles.headerTitle}>POCKET DETAILS</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} style={{ flex: 1 }}>
        {!walletState.bankDetailsFilled && (
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <FileText size={28} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Submit bank details</Text>
              <Text style={styles.bannerText}>PAN & bank details required for payouts</Text>
            </View>
            <Pressable onPress={() => router.push("/profile/details")} style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>Submit</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>EARNINGS: {getCurrentWeekRange().toUpperCase()}</Text>
            <Text style={styles.earningsValue}>₹{Number(walletState.weeklyEarnings || 0).toFixed(0)}</Text>
          </View>

          {hasActiveOffer && (
            <View style={[styles.offerCard, dvCard]}>
              <View style={styles.offerHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerTitle}>Earnings Guarantee</Text>
                  <View style={styles.offerMeta}>
                    <Text style={styles.offerValid}>
                      VALID TILL {formatOfferValidTill(activeOffer.validTill).toUpperCase()}
                    </Text>
                    {activeOffer.isLive && (
                      <View style={styles.liveWrap}>
                        <PulseDot />
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.targetBox}>
                  <Text style={styles.targetAmount}>₹{activeOffer.targetAmount}</Text>
                  <Text style={styles.targetOrders}>{activeOffer.targetOrders} ORDERS</Text>
                </View>
              </View>

              <View style={styles.rings}>
                <View style={styles.ringCol}>
                  <ProgressRing progress={ordersProgress} color="#000">
                    <Text style={styles.ringValue}>{activeOffer.currentOrders}</Text>
                    <Text style={styles.ringOf}>OF {activeOffer.targetOrders}</Text>
                  </ProgressRing>
                  <Text style={styles.ringLabel}>ORDERS DONE</Text>
                </View>
                <View style={styles.ringCol}>
                  <ProgressRing progress={earningsProgress} color="#ff8100">
                    <View style={{ alignItems: "center", paddingHorizontal: 8 }}>
                      <Text style={styles.ringMoney} numberOfLines={1}>
                        ₹{activeOffer.currentEarnings}
                      </Text>
                      <HelpCircle size={10} color={tw.gray300} style={{ marginTop: 4 }} />
                    </View>
                  </ProgressRing>
                  <Text style={styles.ringLabel}>EARNED YET</Text>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.actionsCard, dvCard]}>
            <ActionRow
              icon={Wallet}
              title="Pocket balance"
              caption="WITHDRAWAL HUB"
              value={`₹${Number(walletState.totalBalance || 0).toFixed(2)}`}
              onPress={() => router.push("/pocket/balance")}
            />
            <ActionRow
              icon={ShieldCheck}
              title="Available cash limit"
              caption="SPEND CONTROL"
              value={`₹${Number(walletState.availableCashLimit || 0).toFixed(2)}`}
              onPress={() => router.push("/pocket/cash-limit")}
            />
            <View style={{ padding: 20 }}>
              <Pressable
                onPress={() => setShowDepositPopup(true)}
                style={({ pressed }) => [styles.depositBtn, pressed && { transform: [{ scale: 0.95 }] }]}
              >
                <Text style={styles.depositText}>Deposit Cash</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 16 }}>
            <View style={styles.grid}>
              <Tile
                onPress={() => router.push("/pocket/payout")}
                icon={IndianRupee}
                iconBg={dvColor("bg-blue-50", light)}
                iconColor={dvColor("text-blue-600", light)}
                iconBorder={dvColor("border-blue-100", light)}
              >
                <Text style={styles.tileCaption}>LAST PAYOUT</Text>
                <Text style={styles.tileAmount}>₹{Number(walletState.payoutAmount || 0).toFixed(2)}</Text>
                <Text style={styles.tileSub}>PREV WEEK INFO</Text>
              </Tile>
              <Tile
                spread
                onPress={() => router.push("/pocket/limit-settlement")}
                icon={Receipt}
                iconBg={dvColor("bg-orange-50", light)}
                iconColor={dvColor("text-primary", light)}
                iconBorder={dvColor("border-orange-100", light)}
              >
                <Text style={styles.tileTitle}>Limit Settlement</Text>
              </Tile>
            </View>
            <View style={styles.grid}>
              <Tile
                spread
                onPress={() => router.push("/pocket/deductions")}
                icon={FileText}
                iconBg={tw.red50}
                iconColor={tw.red600}
                iconBorder={tw.red100}
              >
                <Text style={styles.tileTitle}>Deduction List</Text>
              </Tile>
              <Tile
                spread
                onPress={() => router.push("/pocket/details")}
                icon={LayoutGrid}
                iconBg={twx.purple50}
                iconColor={twx.purple600}
                iconBorder={twx.purple100}
              >
                <Text style={styles.tileTitle}>Pocket statement</Text>
              </Tile>
            </View>
          </View>
        </View>
      </ScrollView>

      <DepositSheet
        visible={showDepositPopup}
        onClose={closeDeposit}
        cashInHand={walletState.cashInHand}
        amount={depositAmount}
        onChangeAmount={setDepositAmount}
        depositing={depositing}
        onSubmit={handleDeposit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 12, fontWeight: "600", color: tw.gray500, marginTop: 16 },
  header: { backgroundColor: brand.primary, zIndex: 50, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  headerInner: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 16 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#ffffff", letterSpacing: 0.45 },
  banner: {
    backgroundColor: dvColor("bg-yellow-400", light),
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(240,177,0,0.2)",
  },
  bannerIcon: {
    width: 48,
    height: 48,
    backgroundColor: tw.black,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: tw.black, marginBottom: 2 },
  bannerText: { fontSize: 12, color: "rgba(0,0,0,0.8)", fontWeight: "500" },
  bannerBtn: {
    backgroundColor: dvColor("bg-yellow-300", light),
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  bannerBtnText: { color: tw.black, fontWeight: "700", fontSize: 12 },
  body: { paddingHorizontal: 16, paddingVertical: 24, backgroundColor: tw.gray100 },
  earningsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: tw.gray100,
    alignItems: "center",
    marginBottom: 20,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  earningsLabel: { color: tw.gray500, fontSize: 11, fontWeight: "700", letterSpacing: 1.1, marginBottom: 8 },
  earningsValue: { fontSize: 36, fontWeight: "900", color: tw.black, letterSpacing: -1.8 },
  offerCard: { backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", borderWidth: 1, marginBottom: 24 },
  offerHead: { backgroundColor: tw.black, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  offerTitle: { fontSize: 18, fontWeight: "900", color: "#ffffff", lineHeight: 20, marginBottom: 4 },
  offerMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  offerValid: { fontSize: 10, fontWeight: "700", color: tw.gray400, letterSpacing: 1 },
  liveWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: dvColor("bg-green-500", light) },
  liveText: { fontSize: 10, fontWeight: "700", color: dvColor("text-green-500", light) },
  targetBox: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  targetAmount: { fontSize: 18, fontWeight: "900", color: "#ffffff", lineHeight: 20, marginBottom: 2 },
  targetOrders: { fontSize: 9, fontWeight: "700", color: tw.gray400 },
  rings: { padding: 32, paddingBottom: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-around", gap: 32 },
  ringCol: { alignItems: "center" },
  ringValue: { fontSize: 20, fontWeight: "900", color: tw.black, lineHeight: 22 },
  ringOf: { fontSize: 9, fontWeight: "700", color: tw.gray400, marginTop: 2 },
  ringMoney: { fontSize: 16, fontWeight: "900", color: tw.black, lineHeight: 18 },
  ringLabel: { fontSize: 10, fontWeight: "700", color: tw.gray500, letterSpacing: 1, marginTop: 16 },
  actionsCard: { backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 24 },
  actionRow: { width: "100%", padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionRowBorder: { borderBottomWidth: 1, borderBottomColor: tw.gray50 },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  actionIcon: {
    width: 48,
    height: 48,
    backgroundColor: tw.gray50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tw.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontSize: 14, fontWeight: "700", color: tw.gray800 },
  actionCaption: { fontSize: 10, color: tw.gray400, fontWeight: "700", letterSpacing: -0.25 },
  actionRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionValue: { fontSize: 16, fontWeight: "900", color: tw.black },
  depositBtn: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: brand.primary,
    borderRadius: 14,
    alignItems: "center",
    boxShadow: `0px 10px 15px -3px ${dvColor("shadow-orange-500/20", light)}, 0px 4px 6px -4px ${dvColor("shadow-orange-500/20", light)}`,
  },
  depositText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  grid: { flexDirection: "row", gap: 16 },
  tile: { flex: 1, backgroundColor: "#ffffff", padding: 20, borderRadius: 16, borderWidth: 1 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  tileCaption: { fontSize: 10, fontWeight: "700", color: tw.gray400, letterSpacing: 1, marginBottom: 6 },
  tileAmount: { fontSize: 20, fontWeight: "900", color: tw.black, lineHeight: 22, marginBottom: 4 },
  tileSub: { fontSize: 9, color: tw.gray400, fontWeight: "700", letterSpacing: -0.2 },
  tileTitle: { fontSize: 14, fontWeight: "700", color: tw.gray800, lineHeight: 18 },
});
