// Feed tab = DeliveryHomeV2 with tab="feed": the coloured top header + status strip, then either the
// live map (online) with its FABs and the "Location unavailable" card, or the offline hero.
// Going online follows the web: GPS fix (else "Please enable your GPS for current location") ->
// "Verify Identity" selfie + address -> PATCH availability (DeliveryContext.goOnline). Native adds the
// explain-then-ask step for background location before tracking starts (user decision A).
// The order panels (offer, pickup, drop, verification, summary) are shell overlays
// (components/shell/ShellOverlays). Not ported: the Play/simulation FAB, the SIM button and the
// "Navigation2" FAB (it only switched the web map to one-finger "greedy" gestures, native default).
import { Minus, Plus, Target } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { getProfile } from "../../api/auth";
import { getEmergencyHelp } from "../../api/profile";
import BackgroundLocationDialog from "../../components/feed/BackgroundLocationDialog";
import FeedHeader from "../../components/feed/FeedHeader";
import { EmergencySheet, NotificationsSheet } from "../../components/feed/FeedSheets";
import LiveMap from "../../components/feed/LiveMap";
import OfflineHero from "../../components/feed/OfflineHero";
import PhotoUploadModal from "../../components/feed/PhotoUploadModal";
import useNotificationInbox from "../../components/feed/useNotificationInbox";
import { setModalMinimized, useShellState } from "../../components/shell/shellStore";
import Screen from "../../components/ui/Screen";
import Text from "../../components/ui/Text";
import { toast } from "../../components/ui/Toast";
import { useDelivery } from "../../context/DeliveryContext";
import { tw } from "../../theme/tokens";

const EMPTY_NUMBERS = { medicalEmergency: "", accidentHelpline: "", contactPolice: "", insurance: "", teamLeader: "" };

export default function FeedScreen() {
  const {
    isOnline,
    goingOnline,
    prepareGoOnline,
    goOnline,
    goOffline,
    refreshLocationPermission,
    requestBackgroundLocation,
    locationError,
    activeOrder,
    visibleOffer,
    distanceToTarget,
    eta,
    cashLimitNotice,
    setActivePolyline,
  } = useDelivery();
  const { showVerification } = useShellState();
  const inbox = useNotificationInbox({ limit: 20 });

  const [profileImage, setProfileImage] = useState(null);
  const [emergencyNumbers, setEmergencyNumbers] = useState(EMPTY_NUMBERS);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [checkingGps, setCheckingGps] = useState(false);
  const [askBackground, setAskBackground] = useState(false);
  const [zoom, setZoom] = useState(14);
  const mapRef = useRef(null);
  const bgResolver = useRef(null);

  // Emergency numbers + profile photo (web "Navbar Data Fetch").
  useEffect(() => {
    let alive = true;
    Promise.all([getEmergencyHelp(), getProfile()])
      .then(([emergencyRes, profileRes]) => {
        if (!alive) return;
        if (emergencyRes?.success && emergencyRes.data) setEmergencyNumbers({ ...EMPTY_NUMBERS, ...emergencyRes.data });
        const profile = profileRes?.data?.profile;
        if (profileRes?.success && profile) setProfileImage(profile.profileImage?.url || profile.documents?.photo || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Resolve a pending background-permission question if the screen goes away.
  useEffect(() => () => bgResolver.current?.(false), []);

  const handleToggle = async () => {
    if (isOnline) {
      goOffline();
      return;
    }
    if (checkingGps) return;
    setCheckingGps(true);
    try {
      await prepareGoOnline();
      setShowPhotoModal(true);
    } catch {
      toast.error("Please enable your GPS for current location");
    } finally {
      setCheckingGps(false);
    }
  };

  const askForBackground = useCallback(
    () =>
      new Promise((resolve) => {
        bgResolver.current = resolve;
        setAskBackground(true);
      }),
    [],
  );

  const answerBackground = async (allow) => {
    setAskBackground(false);
    const resolve = bgResolver.current;
    bgResolver.current = null;
    if (allow) await requestBackgroundLocation().catch(() => false);
    resolve?.(allow);
  };

  const handleUpload = async (base64, address, coords) => {
    try {
      const perms = await refreshLocationPermission();
      if (perms && perms.background !== "granted") await askForBackground();
      await goOnline({ selfieBase64: base64, address, coords });
      setShowPhotoModal(false);
    } catch {
      toast.error("Failed to start shift. Please try again.");
    }
  };

  const handleMapClick = () => {
    if (activeOrder || visibleOffer || showVerification) setModalMinimized(true);
  };

  return (
    <Screen edges={[]} background="#ffffff" statusBarStyle="light">
      <View style={styles.body}>
        {isOnline ? (
          <>
            <LiveMap mapRef={mapRef} onMapClick={handleMapClick} onPolylineReceived={setActivePolyline} zoom={zoom} />

            {locationError ? (
              <View style={styles.locError}>
                <Text style={styles.locErrorTitle}>Location unavailable</Text>
                <Text style={styles.locErrorText}>{locationError}</Text>
              </View>
            ) : null}

            <View style={styles.fabs}>
              <View style={styles.zoomBox}>
                <Pressable
                  onPress={() => setZoom((z) => Math.min(22, z + 1))}
                  style={({ pressed }) => [styles.zoomBtn, styles.zoomDivider, pressed && styles.pressed]}
                  accessibilityLabel="Zoom in"
                >
                  <Plus size={20} color={tw.gray900} strokeWidth={2.75} />
                </Pressable>
                <Pressable
                  onPress={() => setZoom((z) => Math.max(8, z - 1))}
                  style={({ pressed }) => [styles.zoomBtn, pressed && styles.pressed]}
                  accessibilityLabel="Zoom out"
                >
                  <Minus size={20} color={tw.gray900} strokeWidth={2.75} />
                </Pressable>
              </View>
              <Pressable
                onPress={() => mapRef.current?.centerOnRider()}
                style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
                accessibilityLabel="Centre on my location"
              >
                <Target size={28} color={tw.gray900} />
              </Pressable>
            </View>
          </>
        ) : (
          <OfflineHero />
        )}
      </View>

      <FeedHeader
        profileImage={profileImage}
        isOnline={isOnline}
        onToggle={handleToggle}
        toggleBusy={checkingGps || goingOnline}
        unreadCount={inbox.unreadCount}
        onEmergency={() => setShowEmergency(true)}
        onNotifications={() => setShowNotifications(true)}
        activeOrder={activeOrder}
        distanceToTarget={distanceToTarget}
        eta={eta}
        teamLeader={emergencyNumbers.teamLeader}
        cashLimitNotice={cashLimitNotice}
      />

      <PhotoUploadModal isOpen={showPhotoModal} onClose={() => setShowPhotoModal(false)} onUpload={handleUpload} />
      <BackgroundLocationDialog
        visible={askBackground}
        onAllow={() => answerBackground(true)}
        onSkip={() => answerBackground(false)}
      />
      <EmergencySheet isOpen={showEmergency} onClose={() => setShowEmergency(false)} numbers={emergencyNumbers} />
      <NotificationsSheet isOpen={showNotifications} onClose={() => setShowNotifications(false)} inbox={inbox} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...StyleSheet.absoluteFill },
  locError: {
    position: "absolute",
    top: 180,
    left: 16,
    right: 16,
    zIndex: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffc9c9",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: "0px 20px 25px -5px rgba(0,0,0,0.1)",
  },
  locErrorTitle: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, color: "#e7000b" },
  locErrorText: { marginTop: 4, fontSize: 12, fontWeight: "600", color: tw.gray700 },
  fabs: { position: "absolute", right: 16, bottom: 112, gap: 16, zIndex: 120, alignItems: "flex-end" },
  zoomBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tw.gray200,
    overflow: "hidden",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  zoomBtn: { padding: 12 },
  zoomDivider: { borderBottomWidth: 1, borderBottomColor: tw.gray100 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  pressed: { transform: [{ scale: 0.9 }] },
});
