// DeliveryHomeV2's fixed layers, mounted once over the HomeShell tabs (src/app/(app)/(tabs)/_layout.js):
//   - Feed only (web: currentTab === 'feed' && !isModalMinimized), inside a layer ending ~11 px above
//     the bottom nav (web bottom-[92px]): NewOrderModal (offer, hidden at capacity), PickupActionModal
//     (PICKING_UP / REACHED_PICKUP), the drop card (PICKED_UP) or "VERIFY & COMPLETE" (REACHED_DROP).
//   - Any shell tab: the minimised "Order Action Pending" bar, DeliveryVerificationModal,
//     OrderSummaryModal (COMPLETED) and the auto-killed-order reason prompt (web window.prompt).
// The panel restores itself whenever the trip phase, the verification state or the offer changes.
import { router, usePathname } from "expo-router";
import { Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useDelivery } from "../../context/DeliveryContext";
import { getOrderAcceptId, getOrderMongoId, TRIP_STATUS } from "../../lib/delivery/orders";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import DeliveryVerificationModal from "../feed/DeliveryVerificationModal";
import { DropCard, VerifyCompleteButton } from "../feed/DropCard";
import NewOrderModal from "../feed/NewOrderModal";
import OrderSummaryModal from "../feed/OrderSummaryModal";
import PickupActionModal from "../feed/PickupActionModal";
import Button from "../ui/Button";
import { Dialog } from "../ui/Sheet";
import Text, { useScopedFont } from "../ui/Text";
import { toast } from "../ui/Toast";
import { useTabBarHeight } from "./DeliveryTabBar";
import { closeVerification, openVerification, setModalMinimized, useShellState } from "./shellStore";
import useShellActions from "./useShellActions";

const NAV_GAP = 11; // web overlays end at bottom-[92px]; the nav is ~81 px tall

function AutoKillReasonDialog() {
  const { autoKilledOrder, submitAutoKillReason } = useDelivery();
  const [reason, setReason] = useState("");
  const inputFont = useScopedFont("500");
  const finish = (value) => {
    const text = String(value || "").trim();
    if (!text) toast.error("You must provide a reason for the delayed delivery.");
    submitAutoKillReason(text);
    setReason("");
  };
  return (
    <Dialog visible={Boolean(autoKilledOrder)} onClose={() => finish("")}>
      <Text style={styles.promptText}>
        Your order exceeded the 1 hour limit and was cancelled by the system. Please provide a reason for the
        failure/delay:
      </Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        autoFocus
        style={[styles.promptInput, inputFont]}
        placeholderTextColor={tw.gray400}
      />
      <View style={styles.promptRow}>
        <Button variant="outline" onPress={() => finish("")}>
          Cancel
        </Button>
        <Button onPress={() => finish(reason)}>OK</Button>
      </View>
    </Dialog>
  );
}

export default function ShellOverlays() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const isFeed = pathname === "/";
  const tabBarHeight = useTabBarHeight();
  const { isModalMinimized, showVerification, bypassOtp } = useShellState();
  const { markDelivered } = useShellActions();
  const {
    visibleOffer,
    incomingOrders,
    selectIncomingOrder,
    offerTimeLeft,
    riderLocation,
    acceptOffer,
    passOffer,
    activeOrder,
    tripStatus,
    isWithinRange,
    distanceToTarget,
    eta,
    reachPickup,
    pickUpOrder,
    reachDrop,
    resetTrip,
  } = useDelivery();
  const incomingOrder = visibleOffer; // already hidden while orderCapacity.canAcceptMore === false
  const offerKey = incomingOrder ? getOrderMongoId(incomingOrder) || getOrderAcceptId(incomingOrder) : "";

  // Auto-restore the panel when the phase, the verification state or the offer changes.
  useEffect(() => {
    setModalMinimized(false);
  }, [tripStatus, showVerification, offerKey]);

  const verificationOpen = showVerification && tripStatus !== TRIP_STATUS.COMPLETED && Boolean(activeOrder);

  // Android back closes the verification flow first (its backdrop tap does the same on web).
  useEffect(() => {
    if (!verificationOpen) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeVerification();
      return true;
    });
    return () => sub.remove();
  }, [verificationOpen]);

  const minimize = () => setModalMinimized(true);
  const showPanel = isFeed && !isModalMinimized;
  const pickupPhase = tripStatus === TRIP_STATUS.PICKING_UP || tripStatus === TRIP_STATUS.REACHED_PICKUP;
  const dropPhase = tripStatus === TRIP_STATUS.PICKED_UP || tripStatus === TRIP_STATUS.REACHED_DROP;
  const panelBottom = tabBarHeight + NAV_GAP;

  return (
    <>
      {showPanel && pickupPhase && activeOrder ? (
        <PickupActionModal
          order={activeOrder}
          status={tripStatus}
          isWithinRange={isWithinRange}
          distanceToTarget={distanceToTarget}
          eta={eta}
          onReachedPickup={reachPickup}
          onPickedUp={(otp) => pickUpOrder(otp)}
          onMarkDelivered={markDelivered}
          onMinimize={minimize}
        />
      ) : null}

      {showPanel && dropPhase && !showVerification ? (
        <View pointerEvents="box-none" style={[styles.dropLayer, { bottom: panelBottom + 16 }]}>
          {tripStatus === TRIP_STATUS.PICKED_UP ? (
            <DropCard
              order={activeOrder}
              isWithinRange={isWithinRange}
              distanceToTarget={distanceToTarget}
              eta={eta}
              onArrive={reachDrop}
              onMarkDelivered={markDelivered}
              onMinimize={minimize}
            />
          ) : (
            <VerifyCompleteButton onPress={() => openVerification({ bypassOtp: false })} />
          )}
        </View>
      ) : null}

      {showPanel && incomingOrder ? (
        <NewOrderModal
          key={offerKey}
          order={incomingOrder}
          queuedOrders={incomingOrders}
          timeLeft={offerTimeLeft}
          riderLocation={riderLocation}
          onSelectOrder={selectIncomingOrder}
          onAccept={(order) => acceptOffer(order)}
          onReject={() => passOffer(incomingOrder)}
          onMinimize={minimize}
        />
      ) : null}

      {isModalMinimized && (activeOrder || incomingOrder || showVerification) ? (
        <View pointerEvents="box-none" style={[styles.minLayer, { bottom: tabBarHeight + 19 }]}>
          <Pressable
            onPress={() => {
              setModalMinimized(false);
              if (!isFeed) router.navigate("/");
            }}
            style={styles.minBar}
          >
            <View style={styles.minTexts}>
              <Text style={styles.minTop}>
                {incomingOrders.length > 1 ? `${incomingOrders.length} orders waiting` : "Order Action Pending"}
              </Text>
              <Text style={styles.minBottom}>
                {incomingOrders.length > 1 ? "Tap to choose and accept" : "Tap to open delivery panel"}
              </Text>
            </View>
            <View style={[styles.minPlus, { backgroundColor: colors.primary }]}>
              <Plus size={20} color="#ffffff" />
            </View>
          </Pressable>
        </View>
      ) : null}

      {verificationOpen ? (
        <DeliveryVerificationModal
          key={`${getOrderMongoId(activeOrder) || getOrderAcceptId(activeOrder)}:${bypassOtp ? "skip" : "otp"}`}
          order={activeOrder}
          skipOtp={bypassOtp}
          onClose={closeVerification}
          onCompleted={closeVerification}
        />
      ) : null}

      {tripStatus === TRIP_STATUS.COMPLETED && activeOrder ? (
        <OrderSummaryModal order={activeOrder} onDone={resetTrip} />
      ) : null}

      <AutoKillReasonDialog />
    </>
  );
}

const styles = StyleSheet.create({
  dropLayer: { position: "absolute", left: 0, right: 0, paddingHorizontal: 16, zIndex: 300 },
  minLayer: { position: "absolute", left: 0, right: 0, paddingHorizontal: 24, zIndex: 300 },
  minBar: {
    width: "100%",
    backgroundColor: "rgba(16,24,40,0.9)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  minTexts: { alignItems: "flex-start", gap: 2 },
  minTop: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: tw.gray400 },
  minBottom: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, color: "#ffffff" },
  minPlus: { padding: 8, borderRadius: 12 },
  promptText: { fontSize: 14, color: tw.gray900, marginBottom: 12 },
  promptInput: {
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tw.gray900,
    marginBottom: 16,
  },
  promptRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
