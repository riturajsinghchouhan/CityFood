// Web modals are mostly bottom sheets (fixed inset-0 bg-black/50 + rounded-t-3xl panel)
// or centered Radix dialogs. Both are RN Modals with the same look; Android back closes them.
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadow } from "../../theme/tokens";

function useModalAnimation(visible) {
  const [mounted, setMounted] = useState(visible);
  const [anim] = useState(() => new Animated.Value(0));
  // Mount as soon as it becomes visible; unmount after the close animation finishes.
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    if (visible) {
      Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, anim]);
  return { mounted, anim };
}

// In-window sheets (BottomSheet `inWindow`) are drawn by SheetHost, mounted once above the root Stack.
const hostListeners = new Set();
let hostSheets = new Map();

function setHostSheet(key, node) {
  const next = new Map(hostSheets);
  if (node) next.set(key, node);
  else next.delete(key);
  hostSheets = next;
  hostListeners.forEach((fn) => fn());
}

function subscribeHost(fn) {
  hostListeners.add(fn);
  return () => hostListeners.delete(fn);
}

export function SheetHost() {
  const sheets = useSyncExternalStore(subscribeHost, () => hostSheets);
  return [...sheets.entries()].map(([key, node]) => (
    <View key={key} style={styles.hostLayer} pointerEvents="box-none">
      {node}
    </View>
  ));
}

// `inWindow` draws the sheet in the activity window (via SheetHost) instead of a Modal. Use it for
// sheets with a TextInput: a Modal is its own Android window that takes the keyboard focus, and on
// some phones the activity never hears about the keyboard, so keyboardDidShow never fires and the
// keyboard covers the sheet. The activity window always gets those events.
export function BottomSheet({ visible, onClose, children, style, dismissable = true, maxHeight = "90%", inWindow = false }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, anim } = useModalAnimation(visible);
  const keyboardHeight = useKeyboardHeight(mounted);
  const height = Dimensions.get("window").height;
  const key = useId();
  const close = () => dismissable && onClose?.();

  // The sheet sits on top of the keyboard and gives up the space it takes, so its own content can
  // scroll. keyboardDidShow's height leaves out the navigation bar, which the edge-to-edge window
  // still draws under, so the lift adds it back.
  const keyboardLift = keyboardHeight > 0 ? keyboardHeight + insets.bottom : 0;
  const liftedMaxHeight = keyboardLift > 0 ? Math.max(220, height - keyboardLift - insets.top - 8) : maxHeight;
  const content = mounted ? (
    <View style={styles.fill}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={styles.fill} onPress={close} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            bottom: keyboardLift,
            paddingBottom: keyboardLift > 0 ? 0 : insets.bottom,
            maxHeight: liftedMaxHeight,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  ) : null;

  useEffect(() => {
    if (inWindow) setHostSheet(key, content);
  });
  useEffect(() => (inWindow ? () => setHostSheet(key, null) : undefined), [inWindow, key]);

  // A Modal gets Android back through onRequestClose; an in-window sheet listens itself (registered
  // after the app-wide HardwareBackBinding, so it runs first).
  useEffect(() => {
    if (!inWindow || !visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (dismissable) onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [inWindow, visible, dismissable, onClose]);

  if (!mounted || inWindow) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      {content}
    </Modal>
  );
}

// ui/dialog.tsx: centered, rounded-lg border p-6 shadow-lg, max-w-lg.
export function Dialog({ visible, onClose, children, style, dismissable = true }) {
  const { colors } = useTheme();
  const { mounted, anim } = useModalAnimation(visible);
  const keyboardHeight = useKeyboardHeight(mounted);
  if (!mounted) return null;
  // A plain full-screen container: KeyboardAvoidingView inside a translucent Modal
  // mis-measured on Android and left the dialog pinned off-center with no backdrop.
  // A centered dialog moves up by half the keyboard height to stay centered above it.
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={() => dismissable && onClose?.()}>
      <View style={[styles.fill, styles.center]}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <Pressable style={styles.fill} onPress={() => dismissable && onClose?.()} />
        </Animated.View>
        <Animated.View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: anim,
              transform: [
                { translateY: -keyboardHeight / 2 },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
              ],
            },
            style,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function useKeyboardHeight(active) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const show = Keyboard.addListener("keyboardDidShow", (e) => setHeight(e.endCoordinates?.height || 0));
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [active]);
  return height;
}

export function SheetHandle() {
  const { colors } = useTheme();
  return (
    <View style={styles.handleWrap}>
      <View style={[styles.handle, { backgroundColor: colors.dark ? "#364153" : "#d1d5dc" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Above the native Stack screens (Android draws by elevation), below the Toaster (9999).
  hostLayer: { ...StyleSheet.absoluteFill, zIndex: 9000, elevation: 9000 },
  center: { alignItems: "center", justifyContent: "center", padding: 16 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    overflow: "hidden",
    ...shadow["2xl"],
  },
  dialog: {
    width: "100%",
    maxWidth: 512,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 24,
    ...shadow.lg,
  },
  handleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  handle: { width: 48, height: 6, borderRadius: 999 },
});
