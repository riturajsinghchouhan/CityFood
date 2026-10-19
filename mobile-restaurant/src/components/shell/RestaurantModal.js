// Port of components/restaurant/RestaurantModal.jsx: a centred, content-sized dialog
// (variant "sheet" sits at the bottom but stays inset). At phone width every size resolves to
// min(100vw - 2rem, size max), i.e. the full width minus the 16 px gutters for sm and larger.
// Android back and a backdrop tap call onClose (backdrop only when closeOnBackdrop).
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";

const SIZE_MAX = { xs: 320, sm: 384, md: 448, lg: 512, xl: 576, auto: 640 };

function useOpenAnimation(open) {
  const [mounted, setMounted] = useState(open);
  const [anim] = useState(() => new Animated.Value(0));
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) {
      // framer spring stiffness 380 / damping 32
      Animated.spring(anim, { toValue: 1, stiffness: 380, damping: 32, mass: 1, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, anim]);
  return { mounted, anim };
}

/**
 * Props as on web: open, onClose, title, description, size ("xs"|"sm"|"md"|"lg"|"xl"|"auto"),
 * variant ("center"|"sheet"), showClose, closeOnBackdrop, noPadding, bottomOffset (keeps clear of
 * the bottom nav), panelStyle, contentStyle, children.
 */
export default function RestaurantModal({
  open,
  onClose,
  children,
  title,
  description,
  size = "md",
  variant = "center",
  showClose = true,
  closeOnBackdrop = true,
  noPadding = false,
  bottomOffset = false,
  panelStyle,
  contentStyle,
}) {
  const insets = useSafeAreaInsets();
  const { mounted, anim } = useOpenAnimation(open);
  if (!mounted) return null;
  const isSheet = variant === "sheet";
  const hasHeader = Boolean(title || (showClose && !noPadding));
  const from = isSheet ? { y: 40, scale: 0.96 } : { y: 8, scale: 0.92 };

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={() => onClose?.()}>
      <View
        style={[
          styles.root,
          isSheet ? styles.end : styles.center,
          {
            paddingTop: 16 + insets.top,
            paddingBottom: (bottomOffset ? 88 : 16) + insets.bottom,
          },
        ]}
      >
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <Pressable style={styles.fill} onPress={closeOnBackdrop ? () => onClose?.() : undefined} />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            { maxWidth: SIZE_MAX[size] ?? SIZE_MAX.md },
            isSheet ? styles.sheetRadius : null,
            {
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [from.y, 0] }) },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [from.scale, 1] }) },
              ],
            },
            panelStyle,
          ]}
        >
          {hasHeader ? (
            <View style={styles.header}>
              <View style={styles.headerText}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {description ? <Text style={styles.description}>{description}</Text> : null}
              </View>
              {showClose ? (
                <Pressable onPress={() => onClose?.()} style={styles.close} hitSlop={4} accessibilityLabel="Close">
                  <X size={20} color={tw.gray500} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={[!noPadding && (hasHeader ? styles.bodyAfterHeader : styles.body), contentStyle]}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  center: { justifyContent: "center", alignItems: "center" },
  end: { justifyContent: "flex-end", alignItems: "center" },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
  panel: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  // rounded-t-3xl only (bottom corners square at phone width)
  sheetRadius: { borderRadius: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "700", color: tw.gray900, lineHeight: 22 },
  description: { marginTop: 4, fontSize: 14, color: tw.gray500 },
  close: { borderRadius: 9999, padding: 8 },
  body: { padding: 20 },
  bodyAfterHeader: { paddingHorizontal: 20, paddingBottom: 20 },
});
