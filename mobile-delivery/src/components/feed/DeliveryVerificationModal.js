// Port of DeliveryV2/components/modals/DeliveryVerificationModal.jsx (a full-screen layer, black/60
// scrim closes it):
//   step "otp"     — Handover Code: delivery instruction, 4 OTP boxes (ONE hidden input drives them),
//                    "Customer didn't get OTP? Resend" (30 s cooldown, re-sends reached-drop) and
//                    "Slide to Verify OTP". Skipped for "Mark as Delivered" (skipOtp) or when already
//                    verified.
//   step "payment" — Collect Payment / Payment Verified: "Cash Collected", or "Show Payment QR"
//                    (Razorpay UPI QR, polled every 4 s while shown) and "Slide to Complete Order".
// API state (verify, resend cooldown, QR + polling, complete) lives in DeliveryContext.
import { LinearGradient } from "expo-linear-gradient";
import { DollarSign, Package, QrCode, RefreshCw, ShieldCheck, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDelivery } from "../../context/DeliveryContext";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";
import ActionSlider from "./ActionSlider";
import { GRADIENT_TO_RIGHT, p } from "./palette";
import useKeyboardHeight from "./useKeyboardHeight";

const OTP_SLOTS = [0, 1, 2, 3];

function DeliveryInstructionsPanel({ note }) {
  const { colors, dvGradient } = useTheme();
  const text = String(note || "").trim();
  if (!text) return null;
  return (
    <View style={[styles.instr, { borderColor: colors.primaryBorder }]}>
      <LinearGradient colors={dvGradient()} {...GRADIENT_TO_RIGHT} style={styles.instrHead}>
        <View style={styles.instrIcon}>
          <Package size={20} color="#ffffff" />
        </View>
        <View>
          <Text style={styles.instrTitle}>Delivery instruction</Text>
          <Text style={styles.instrSub}>Read before handover</Text>
        </View>
      </LinearGradient>
      <View style={[styles.instrBody, { backgroundColor: colors.primarySoft }]}>
        <Text style={styles.instrText}>“{text}”</Text>
      </View>
    </View>
  );
}

function SheetFrame({ children, onClose }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  return (
    <View style={styles.layer}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            marginBottom: keyboard,
            maxHeight: Dimensions.get("window").height * 0.88 - keyboard,
          },
        ]}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(32, keyboard ? 16 : insets.bottom + 8) }}
        >
          <View style={styles.grabber} />
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

function SheetHeader({ icon: Icon, iconBg, iconColor, title, subtitle, onClose }) {
  return (
    <View style={styles.head}>
      <View style={styles.headLeft}>
        <View style={[styles.headIcon, { backgroundColor: iconBg }]}>
          <Icon size={28} color={iconColor} />
        </View>
        <View>
          <Text heading style={styles.headTitle}>{title}</Text>
          <Text style={styles.headSub}>{subtitle}</Text>
        </View>
      </View>
      <Pressable onPress={onClose} style={styles.close} hitSlop={6} accessibilityLabel="Close">
        <X size={20} color={tw.gray400} />
      </Pressable>
    </View>
  );
}

function OtpStep({ order, onVerified, onClose }) {
  const { colors } = useTheme();
  const { verifyDropOtp, resendDropOtp, dropOtpResendAt, actionInFlight } = useDelivery();
  const savedCode = order?.deliveryVerification?.dropOtp?.code;
  const [otp, setOtp] = useState(() => (savedCode && String(savedCode).length === 4 ? String(savedCode) : ""));
  const [focused, setFocused] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef(null);
  const verifiedTimer = useRef(null);
  const isAlreadyVerified = Boolean(order?.deliveryVerification?.dropOtp?.verified);
  const isVerifyingOtp = actionInFlight === "verifyDropOtp";
  const isResendingOtp = actionInFlight === "resendDropOtp";
  const resendCooldown = Math.max(0, Math.ceil((dropOtpResendAt - now) / 1000));

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 500);
    return () => {
      clearTimeout(t);
      clearTimeout(verifiedTimer.current);
    };
  }, []);

  // Tick the resend cooldown.
  useEffect(() => {
    if (dropOtpResendAt <= Date.now()) return undefined;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= dropOtpResendAt) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [dropOtpResendAt]);

  const handleResend = async () => {
    if (isResendingOtp || resendCooldown > 0 || isOtpVerified || isAlreadyVerified) return;
    await resendDropOtp();
    setNow(Date.now());
  };

  const verifyOtp = async () => {
    if (otp.length < 4) return;
    const ok = await verifyDropOtp(otp); // throws on a wrong code (toast in the context) -> slider resets
    if (!ok) return;
    setIsOtpVerified(true);
    verifiedTimer.current = setTimeout(() => onVerified(otp), 600);
  };

  const resendDisabled = isResendingOtp || resendCooldown > 0 || isOtpVerified || isAlreadyVerified;
  const resendStyle =
    isOtpVerified || isAlreadyVerified
      ? { backgroundColor: tw.gray100, opacity: 0.4, borderColor: "transparent" }
      : resendCooldown > 0
        ? { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }
        : isResendingOtp
          ? { backgroundColor: tw.gray100, borderColor: "transparent" }
          : { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder };
  const resendColor =
    isOtpVerified || isAlreadyVerified ? tw.gray400 : resendCooldown > 0 ? colors.primary : isResendingOtp ? tw.gray500 : p.orange700;

  return (
    <SheetFrame onClose={onClose}>
      <SheetHeader
        icon={ShieldCheck}
        iconBg={isOtpVerified ? p.green100 : tw.gray100}
        iconColor={isOtpVerified ? colors.primary : tw.gray500}
        title="Handover Code"
        subtitle="Step 1 of Verification"
        onClose={onClose}
      />
      <DeliveryInstructionsPanel note={order?.note} />

      <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
        {OTP_SLOTS.map((i) => {
          const active = focused && !isOtpVerified && i === Math.min(otp.length, 3);
          return (
            <View
              key={i}
              style={[
                styles.otpBox,
                isOtpVerified
                  ? { borderColor: p.green500, backgroundColor: colors.primarySoft }
                  : active
                    ? { borderColor: p.green600 }
                    : null,
              ]}
            >
              <Text style={[styles.otpDigit, { color: isOtpVerified ? p.green700 : tw.gray700 }]}>{otp[i] || ""}</Text>
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 4))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!isOtpVerified}
          keyboardType="number-pad"
          maxLength={4}
          caretHidden
          style={styles.hiddenInput}
        />
      </Pressable>

      <View style={styles.resendRow}>
        <Pressable onPress={handleResend} disabled={resendDisabled} style={[styles.resendBtn, resendStyle]}>
          {isResendingOtp ? (
            <>
              <ActivityIndicator size="small" color={tw.gray500} />
              <Text style={[styles.resendText, { color: resendColor }]}>Resending OTP...</Text>
            </>
          ) : resendCooldown > 0 ? (
            <>
              <RefreshCw size={14} color={colors.primary} />
              <Text style={[styles.resendText, { color: resendColor }]}>
                Resend OTP in <Text style={[styles.resendText, styles.bold, { color: resendColor }]}>{resendCooldown}s</Text>
              </Text>
            </>
          ) : (
            <>
              <RefreshCw size={14} color={isOtpVerified || isAlreadyVerified ? tw.gray400 : colors.primary} />
              <Text style={[styles.resendText, { color: resendColor }]}>Customer didn&apos;t get OTP? Resend</Text>
            </>
          )}
        </Pressable>
      </View>

      <ActionSlider
        key="action-otp"
        label={isVerifyingOtp ? "Verifying..." : isAlreadyVerified ? "Code already verified ✓" : "Slide to Verify OTP"}
        successLabel="Verified!"
        disabled={otp.length < 4 || isVerifyingOtp || isOtpVerified || isAlreadyVerified}
        onConfirm={verifyOtp}
        color={tw.gray900}
      />
    </SheetFrame>
  );
}

function orderPaymentFlags(order) {
  const method = String(
    order.paymentMethod || order.payment?.method || order.transaction?.payment?.method || order.transaction?.paymentMethod || "",
  ).toLowerCase();
  const isCod = ["cash", "cod", "cash_on_delivery", "razorpay_qr"].includes(method);
  return { isCod };
}

function PaymentStep({ order, otpString, onCompleted, onClose }) {
  const { colors } = useTheme();
  const { payment, resetPayment, startCollectQr, stopQrPolling, completeDelivery, collectCash } = useDelivery();
  const [showQrModal, setShowQrModal] = useState(false);
  const [collectQr, setCollectQr] = useState(null);
  const [isCompletingCash, setIsCompletingCash] = useState(false);
  const { isCod } = orderPaymentFlags(order);
  const paymentStatus = payment.status;
  const isPaid = paymentStatus === "paid";
  const isGeneratingQr = payment.loading;
  const totalBill = Number(order.pricing?.total || order.amountToCollect || 0);
  const amountToCollect = isPaid ? totalBill : isCod ? totalBill : 0;
  const qrFlowStarted = Boolean(collectQr) || paymentStatus === "pending";

  // Initial payment state for this order; stop QR polling when the flow closes.
  useEffect(() => {
    resetPayment(order);
    return () => stopQrPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paid -> close the QR (web checkPaymentSync).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isPaid) setShowQrModal(false);
  }, [isPaid]);

  const generateQr = async () => {
    const qr = await startCollectQr();
    if (qr) {
      setCollectQr(qr);
      setShowQrModal(true);
    }
  };

  const closeQr = () => {
    setShowQrModal(false);
    stopQrPolling(); // web polls only while the QR is shown
  };

  const confirmCashCollected = async () => {
    if (isCompletingCash) return;
    setIsCompletingCash(true);
    try {
      await collectCash(otpString);
      onCompleted();
    } catch {
      // the context already showed the server error
    } finally {
      setIsCompletingCash(false);
    }
  };

  const complete = async () => {
    await completeDelivery(otpString, isCod ? (isPaid ? "online" : "cash") : "online", order);
    onCompleted();
  };

  return (
    <>
      <SheetFrame onClose={onClose}>
        <SheetHeader
          icon={DollarSign}
          iconBg={isPaid ? p.green100 : p.amber100}
          iconColor={isPaid ? colors.primary : p.amber600}
          title={isPaid ? "Payment Verified" : "Collect Payment"}
          subtitle={isPaid ? "Ready to Complete" : "Payment Settlement"}
          onClose={onClose}
        />
        <DeliveryInstructionsPanel note={order?.note} />

        <View style={styles.amountBox}>
          <View style={styles.amountTop}>
            <View>
              <Text style={styles.amountLabel}>{isPaid ? "Amount Paid Online" : "Amount to Collect"}</Text>
              <Text style={styles.amount}>₹{amountToCollect.toFixed(2)}</Text>
            </View>
            {isPaid ? (
              <View style={[styles.paidPill, { backgroundColor: colors.primary }]}>
                <Text style={styles.paidText}>PAID ✓</Text>
              </View>
            ) : null}
          </View>

          {!isPaid ? (
            <View style={styles.payActions}>
              <Pressable
                onPress={confirmCashCollected}
                disabled={isCompletingCash || isGeneratingQr}
                style={[styles.cashBtn, { backgroundColor: colors.primary }, (isCompletingCash || isGeneratingQr) && styles.half]}
              >
                {isCompletingCash ? <ActivityIndicator size="small" color="#ffffff" /> : <DollarSign size={20} color="#ffffff" />}
                <Text style={styles.cashText}>{isCompletingCash ? "Recording Cash…" : "Cash Collected"}</Text>
              </Pressable>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>

              <Pressable
                onPress={generateQr}
                disabled={isGeneratingQr || isCompletingCash}
                style={[
                  styles.qrBtn,
                  paymentStatus === "pending"
                    ? { backgroundColor: p.amber100, borderColor: p.amber400 }
                    : { backgroundColor: "#ffffff", borderColor: p.amber200 },
                ]}
              >
                {isGeneratingQr ? (
                  <ActivityIndicator size="small" color={p.amber800} />
                ) : (
                  <QrCode size={20} color={paymentStatus === "pending" ? p.amber900 : p.amber800} />
                )}
                <Text style={[styles.qrText, { color: paymentStatus === "pending" ? p.amber900 : p.amber800 }]}>
                  {paymentStatus === "pending" ? "QR Active - Show Again" : "Show Payment QR"}
                </Text>
              </Pressable>

              {["expired", "failed"].includes(paymentStatus) ? (
                <Text style={[styles.payNote, { color: p.red600 }]}>
                  The previous QR is no longer payable. Create a new QR to continue.
                </Text>
              ) : null}
              {qrFlowStarted ? (
                <Text style={[styles.payNote, { color: p.amber700 }]}>
                  QR collection is active. Cash collection is disabled to prevent duplicate payment.
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <ActionSlider
          key="action-payment"
          label={isPaid ? "Slide to Complete Order" : "Waiting for verified payment"}
          successLabel="Delivered! ✓"
          disabled={!isPaid}
          onConfirm={complete}
          color={colors.primary}
        />
      </SheetFrame>

      {showQrModal ? (
        <Pressable style={styles.qrLayer} onPress={closeQr}>
          <Pressable style={styles.qrCard} onPress={() => {}}>
            <Text heading style={styles.qrTitle}>Scan to Pay</Text>
            <Text style={styles.qrSub}>Order Total: ₹{amountToCollect.toFixed(2)}</Text>
            <View style={styles.qrBox}>
              <View style={styles.qrFrame}>
                <Image
                  source={{ uri: collectQr?.imageUrl || payment.qr?.imageUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                  accessibilityLabel="Razorpay UPI payment QR"
                />
              </View>
              <Text style={[styles.qrStatus, { color: paymentStatus === "pending" ? p.amber700 : p.red600 }]}>
                {paymentStatus === "pending" ? "Waiting for server-verified payment…" : "This QR has expired or failed."}
              </Text>
            </View>
            <Pressable onPress={closeQr} style={styles.qrClose}>
              <Text style={styles.qrCloseText}>Close QR</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </>
  );
}

/** onClose: dismiss without completing; onCompleted: delivery completed (verification closes). */
export default function DeliveryVerificationModal({ order, skipOtp = false, onClose, onCompleted }) {
  const alreadyVerified = Boolean(order?.deliveryVerification?.dropOtp?.verified);
  const shouldSkipOtp = Boolean(skipOtp || alreadyVerified);
  const [step, setStep] = useState(shouldSkipOtp ? "payment" : "otp");
  const [verifiedOtp, setVerifiedOtp] = useState(
    order?.deliveryVerification?.dropOtp?.code || (shouldSkipOtp ? "BYPASS" : ""),
  );
  if (!order) return null;
  if (step === "otp") {
    return (
      <OtpStep
        order={order}
        onClose={onClose}
        onVerified={(code) => {
          setVerifiedOtp(code);
          setStep("payment");
        }}
      />
    );
  }
  return <PaymentStep order={order} otpString={verifiedOtp || "BYPASS"} onClose={onClose} onCompleted={onCompleted} />;
}

const QR_SIZE = 176;

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, justifyContent: "flex-end", zIndex: 500 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: "0px -20px 60px rgba(0,0,0,0.4)",
  },
  grabber: { width: 48, height: 6, borderRadius: 9999, backgroundColor: tw.gray200, alignSelf: "center", marginBottom: 24 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  headTitle: { fontSize: 20, fontWeight: "700", color: tw.gray900 },
  headSub: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: tw.gray400 },
  close: { padding: 8, backgroundColor: tw.gray50, borderRadius: 9999 },
  instr: { width: "100%", borderRadius: 24, marginBottom: 24, overflow: "hidden", borderWidth: 1, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  instrHead: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  instrIcon: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  instrTitle: { fontSize: 10, fontWeight: "900", color: "#ffffff", textTransform: "uppercase", letterSpacing: 2 },
  instrSub: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
  instrBody: { paddingHorizontal: 20, paddingVertical: 16 },
  instrText: { fontSize: 14, fontWeight: "700", color: tw.gray950, lineHeight: 22 },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 16 },
  otpBox: {
    width: 48,
    height: 64,
    backgroundColor: tw.gray50,
    borderWidth: 2,
    borderColor: tw.gray200,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigit: { fontSize: 24, fontWeight: "700" },
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0, color: "transparent" },
  resendRow: { alignItems: "center", marginBottom: 24 },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  resendText: { fontSize: 12, fontWeight: "600" },
  bold: { fontWeight: "700" },
  amountBox: {
    backgroundColor: p.amber50,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: p.amber100,
    marginBottom: 24,
  },
  amountTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  amountLabel: { color: p.amber700, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  amount: { color: p.amber950, fontSize: 30, fontWeight: "700" },
  paidPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999 },
  paidText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  payActions: { gap: 12 },
  cashBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  half: { opacity: 0.5 },
  cashText: { color: "#ffffff", fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8 },
  orLine: { height: 1, flex: 1, backgroundColor: p.amber200 },
  orText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, color: p.amber600 },
  qrBtn: {
    width: "100%",
    paddingVertical: 14,
    borderWidth: 2,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  qrText: { fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1 },
  payNote: { fontSize: 12, fontWeight: "600" },
  qrLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  qrCard: {
    width: "100%",
    maxWidth: 384,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  qrTitle: { color: tw.gray950, fontWeight: "700", fontSize: 20, marginBottom: 8 },
  qrSub: { color: tw.gray500, fontSize: 14, fontWeight: "500", marginBottom: 32 },
  qrBox: {
    alignItems: "center",
    gap: 16,
    backgroundColor: tw.gray50,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: tw.gray100,
    padding: 24,
    marginBottom: 32,
    width: "100%",
  },
  qrFrame: { width: QR_SIZE, height: QR_SIZE, overflow: "hidden", backgroundColor: "#ffffff" },
  // The Razorpay image is a whole card; the web scales it 3.35x (shifted up 4.5 %) to show only the QR.
  qrImage: { width: QR_SIZE, height: QR_SIZE, transform: [{ scale: 3.35 }, { translateY: -QR_SIZE * 0.045 }] },
  qrStatus: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  qrClose: { width: "100%", paddingVertical: 16, backgroundColor: tw.gray100, borderRadius: 16, alignItems: "center" },
  qrCloseText: { color: tw.gray500, fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2 },
});
