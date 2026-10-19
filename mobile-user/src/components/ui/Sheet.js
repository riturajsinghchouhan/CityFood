// Web modals are mostly bottom sheets (fixed inset-0 bg-black/50 + rounded-t-3xl panel)
// or centered Radix dialogs. Both are RN Modals with the same look; Android back closes them.
import { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
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

export function BottomSheet({ visible, onClose, children, style, dismissable = true, maxHeight = "90%" }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, anim } = useModalAnimation(visible);
  const height = Dimensions.get("window").height;
  if (!mounted) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={() => dismissable && onClose?.()}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <Pressable style={styles.fill} onPress={() => dismissable && onClose?.()} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom,
              maxHeight,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
            },
            style,
          ]}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ui/dialog.tsx: centered, rounded-lg border p-6 shadow-lg, max-w-lg.
export function Dialog({ visible, onClose, children, style, dismissable = true }) {
  const { colors } = useTheme();
  const { mounted, anim } = useModalAnimation(visible);
  if (!mounted) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={() => dismissable && onClose?.()}>
      <KeyboardAvoidingView behavior="padding" style={[styles.fill, styles.center]}>
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
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
            },
            style,
          ]}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
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
  center: { alignItems: "center", justifyContent: "center", padding: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
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
