// Port of DeliveryV2/components/ui/ActionSlider.jsx: "swipe to confirm" pill. Drag the white handle
// past 80 % (or 150 px) to confirm; a rejected onConfirm resets it so the rider can retry. The lock
// ref stops a double fire. `color` is the fill colour (the web's bg-* class, already remapped).
import { ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";

const HANDLE = 56; // w-14
const PAD = 6; // p-1.5

// Gesture handlers read the latest props through `liveRef` (set from effects, never during render).
function createResponder(x, liveRef) {
  const live = liveRef.current;
  const maxX = () => Math.max(1, live.width - HANDLE - PAD * 2);
  const blocked = () => live.disabled || live.isSuccess || live.lock;
  const reset = () => Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => !blocked(),
    onMoveShouldSetPanResponder: (_, g) => !blocked() && Math.abs(g.dx) > 2,
    onMoveShouldSetPanResponderCapture: (_, g) => !blocked() && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      if (blocked()) return;
      x.setValue(Math.min(maxX(), Math.max(0, g.dx)));
    },
    onPanResponderRelease: async (_, g) => {
      if (blocked()) return;
      const progress = Math.min(maxX(), Math.max(0, g.dx)) / maxX();
      if (progress > 0.8 || g.dx > 150) {
        live.lock = true;
        live.isSuccess = true;
        live.setIsSuccess?.(true);
        Animated.timing(x, { toValue: maxX(), duration: 150, useNativeDriver: false }).start();
        if (live.onConfirm) {
          try {
            await live.onConfirm();
          } catch {
            live.lock = false;
            live.isSuccess = false;
            live.setIsSuccess?.(false);
            reset();
          }
        }
      } else {
        reset();
      }
    },
    onPanResponderTerminate: () => {
      if (!live.lock) reset();
    },
  });
  return responder;
}

export default function ActionSlider({
  label = "Slide to Confirm",
  onConfirm,
  disabled = false,
  color,
  successLabel = "Confirmed ✓",
}) {
  const { colors } = useTheme();
  const fill = color || colors.primary;
  const [width, setWidth] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [x] = useState(() => new Animated.Value(0));
  const liveRef = useRef({ width: 0, disabled, isSuccess: false, onConfirm, setIsSuccess: null, lock: false });
  const [responder, setResponder] = useState(null);

  useEffect(() => {
    setResponder(createResponder(x, liveRef));
  }, [x]);

  useEffect(() => {
    Object.assign(liveRef.current, { width, disabled, isSuccess, onConfirm, setIsSuccess });
  }, [disabled, isSuccess, onConfirm, width]);

  // Reset when the slider becomes disabled (e.g. the parent locked it).
  useEffect(() => {
    if (!disabled) return;
    liveRef.current.lock = false;
    x.setValue(0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSuccess(false);
  }, [disabled, x]);

  const travel = Math.max(1, width - HANDLE - PAD * 2);
  const fillWidth = isSuccess
    ? "100%"
    : x.interpolate({ inputRange: [0, travel], outputRange: [0, width || 1], extrapolate: "clamp" });

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.labelBox} pointerEvents="none">
        <Text
          numberOfLines={1}
          style={[styles.label, { color: disabled ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.88)", opacity: isSuccess ? 0 : 1 }]}
        >
          {disabled ? "Action Locked" : label}
        </Text>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: fill, width: fillWidth, opacity: disabled ? 0 : 1 }]}
      />
      {isSuccess ? (
        <View style={[styles.labelBox, styles.successBox]} pointerEvents="none">
          <Text numberOfLines={1} style={styles.success}>
            {successLabel}
          </Text>
        </View>
      ) : null}
      <Animated.View
        {...(responder?.panHandlers || {})}
        style={[
          styles.handle,
          { backgroundColor: disabled ? tw.gray200 : "#ffffff", transform: [{ translateX: x }] },
        ]}
      >
        <ChevronRight
          size={32}
          color={disabled ? tw.gray400 : isSuccess ? colors.primary : tw.gray950}
          style={isSuccess ? { transform: [{ scale: 1.1 }] } : null}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 68,
    borderRadius: 9999,
    padding: PAD,
    overflow: "hidden",
    backgroundColor: tw.gray950,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
    justifyContent: "center",
  },
  labelBox: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 76,
    right: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 11 * 0.14, textAlign: "center" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 9999 },
  successBox: { zIndex: 30 },
  success: { color: "#ffffff", fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 14 * 0.14 },
  handle: {
    width: HANDLE,
    height: HANDLE,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    boxShadow: "0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)",
  },
});
