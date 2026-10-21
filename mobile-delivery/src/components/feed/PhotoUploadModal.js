// Port of DeliveryV2/components/modals/PhotoUploadModal.jsx ("Verify Identity", the shift-start
// selfie that is required to go online). Native: the capture button opens the system FRONT camera
// (expo-image-picker) instead of the web's in-page <video> with FaceDetector (Chrome-only, faked
// elsewhere), so there is no live preview or "Scanning Face..." state. After the shot: preview with
// "Retake Photo", the current location (GPS fix -> address) and "Go Online".
// onUpload(base64, address, coords) does the go-online call.
import { AlertTriangle, Camera, MapPin, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { useDelivery } from "../../context/DeliveryContext";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { BottomSheet } from "../ui/Sheet";
import Text from "../ui/Text";
import { p } from "./palette";

export default function PhotoUploadModal({ isOpen, onClose, onUpload }) {
  const { colors } = useTheme();
  const { captureShiftSelfie, prepareGoOnline, resolveShiftAddress } = useDelivery();
  const [photo, setPhoto] = useState(null); // {uri, base64}
  const [locationState, setLocationState] = useState({ loading: false, address: null, coords: null, error: null });
  const [cameraError, setCameraError] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setPhoto(null);
    setCameraError(null);
    setLocationState({ loading: false, address: null, coords: null, error: null });
  }, []);

  // Fresh state each time the sheet opens (web: camera restarts on open).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) reset();
  }, [isOpen, reset]);

  const fetchLocation = async () => {
    setLocationState({ loading: true, address: null, coords: null, error: null });
    try {
      const coords = await prepareGoOnline();
      const address = await resolveShiftAddress(coords.lat, coords.lng);
      if (alive.current) setLocationState({ loading: false, address, coords, error: null });
    } catch {
      if (alive.current) setLocationState({ loading: false, address: null, coords: null, error: "Location permission denied" });
    }
  };

  const capturePhoto = async () => {
    if (capturing) return;
    setCapturing(true);
    setCameraError(null);
    try {
      const shot = await captureShiftSelfie();
      if (!alive.current || !shot) return;
      setPhoto(shot);
      fetchLocation();
    } catch {
      if (alive.current) setCameraError("Camera access denied or unavailable.");
    } finally {
      if (alive.current) setCapturing(false);
    }
  };

  const handleSubmit = async () => {
    if (!photo?.base64) return;
    setIsSubmitting(true);
    try {
      await onUpload(photo.base64, locationState.address, locationState.coords);
    } finally {
      if (alive.current) setIsSubmitting(false);
    }
  };

  const close = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <BottomSheet visible={isOpen} onClose={close}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Verify Identity</Text>
          <Text style={styles.subtitle}>Please verify your face & location</Text>
        </View>
        <Pressable onPress={close} style={styles.close} accessibilityLabel="Close">
          <X size={20} color={tw.gray500} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {!photo ? (
          <View style={styles.center}>
            {cameraError ? (
              <View style={styles.errorBox}>
                <AlertTriangle size={32} color={p.red500} style={styles.mb8} />
                <Text style={styles.errorText}>{cameraError}</Text>
                <Pressable onPress={capturePhoto} style={styles.retryBtn}>
                  <Text style={styles.retryText}>Try Again</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.cameraCircle}>
                <Camera size={56} color="rgba(255,255,255,0.35)" />
                <View style={[styles.guide, { borderColor: p.green500 }]} />
              </View>
            )}

            <View style={styles.hint}>
              <Text heading style={styles.hintTitle}>Align your face in the circle</Text>
              <Text style={styles.hintSub}>Make sure you are in a well-lit area</Text>
            </View>

            <Pressable
              onPress={capturePhoto}
              disabled={capturing}
              accessibilityLabel="Take selfie"
              style={({ pressed }) => [styles.captureBtn, { backgroundColor: colors.primary }, pressed && styles.pressed]}
            >
              {capturing ? <ActivityIndicator color="#ffffff" /> : <Camera size={28} color="#ffffff" />}
            </Pressable>
          </View>
        ) : (
          <View style={styles.previewCol}>
            <View style={[styles.preview, { borderColor: p.green500 }]}>
              <Image source={{ uri: photo.uri }} style={styles.previewImg} resizeMode="cover" />
              <Pressable onPress={capturePhoto} style={styles.retake}>
                <Text style={styles.retakeText}>Retake Photo</Text>
              </Pressable>
            </View>

            <View style={styles.locBox}>
              <View style={styles.locRow}>
                <View style={[styles.locIcon, { backgroundColor: locationState.error ? "#ffe2e2" : "#dbeafe" }]}>
                  {locationState.error ? (
                    <AlertTriangle size={20} color={p.red600} />
                  ) : (
                    <MapPin size={20} color={colors.primary} />
                  )}
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.locLabel}>Current Location</Text>
                  {locationState.loading ? (
                    <View style={styles.locLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.locLoadingText}>Fetching location...</Text>
                    </View>
                  ) : locationState.error ? (
                    <Text style={styles.locError}>{locationState.error}</Text>
                  ) : locationState.address ? (
                    <Text numberOfLines={2} style={styles.locAddr}>
                      {locationState.address}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {photo ? (
        <View style={styles.footer}>
          <Pressable
            onPress={handleSubmit}
            disabled={!photo.base64 || locationState.loading || isSubmitting}
            style={[
              styles.submit,
              { backgroundColor: colors.primary, boxShadow: `0px 10px 15px -3px ${colors.primary}59` },
              (!photo.base64 || locationState.loading || isSubmitting) && styles.half,
            ]}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator color="#ffffff" />
                <Text style={styles.submitText}>Turning Online...</Text>
              </>
            ) : (
              <Text style={styles.submitText}>Go Online</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(249,250,251,0.5)",
  },
  title: { fontSize: 18, fontWeight: "900", color: tw.gray900, textTransform: "uppercase", letterSpacing: -0.45 },
  subtitle: { fontSize: 12, color: tw.gray500, fontWeight: "500" },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  body: { padding: 24, alignItems: "center" },
  center: { width: "100%", alignItems: "center" },
  errorBox: {
    width: "100%",
    height: 256,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ffa2a2",
    borderRadius: 16,
    backgroundColor: p.red50,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  mb8: { marginBottom: 8 },
  errorText: { fontSize: 14, fontWeight: "600", color: "#c10007", textAlign: "center" },
  retryBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#ffe2e2", borderRadius: 8 },
  retryText: { color: "#c10007", fontSize: 14, fontWeight: "700" },
  cameraCircle: {
    width: 256,
    height: 256,
    borderRadius: 128,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: tw.gray100,
    backgroundColor: tw.gray900,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  guide: { ...StyleSheet.absoluteFill, borderWidth: 6, borderRadius: 128 },
  hint: { marginTop: 24, alignItems: "center" },
  hintTitle: { fontWeight: "700", color: tw.gray900 },
  hintSub: { fontSize: 12, color: tw.gray500, marginTop: 4 },
  captureBtn: {
    marginTop: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)",
  },
  pressed: { transform: [{ scale: 0.95 }] },
  previewCol: { width: "100%", alignItems: "center", gap: 16 },
  preview: { width: 192, height: 192, borderRadius: 96, borderWidth: 4, overflow: "hidden", boxShadow: "0px 20px 25px -5px rgba(0,0,0,0.1)" },
  previewImg: { width: "100%", height: "100%" },
  retake: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  retakeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  locBox: { width: "100%", backgroundColor: tw.gray50, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: tw.gray100, marginTop: 8 },
  locRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  locIcon: { padding: 8, borderRadius: 8 },
  flex1: { flex: 1, minWidth: 0 },
  locLabel: { fontSize: 12, fontWeight: "700", color: tw.gray500, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  locLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
  locLoadingText: { fontSize: 14, fontWeight: "500", color: tw.gray700 },
  locError: { fontSize: 14, fontWeight: "600", color: p.red600 },
  locAddr: { fontSize: 14, fontWeight: "600", color: tw.gray900 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: tw.gray100, backgroundColor: "#ffffff" },
  submit: { width: "100%", height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  half: { opacity: 0.5 },
  submitText: { color: "#ffffff", fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4, fontSize: 16 },
});
