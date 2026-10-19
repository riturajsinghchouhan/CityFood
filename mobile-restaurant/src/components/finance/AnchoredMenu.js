// A web `absolute top-full mt-2` dropdown under a trigger. Android does not deliver touches to
// children drawn outside their parent, so the panel is drawn in a transparent Modal at the
// trigger's measured window position. A tap outside closes it.
import { useEffect, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, useWindowDimensions } from "react-native";

export default function AnchoredMenu({ open, onClose, anchorRef, align = "stretch", minWidth, style, children }) {
  const { width: screenW } = useWindowDimensions();
  const [rect, setRect] = useState(null);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!open) {
      anim.setValue(0);
      return;
    }
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      setRect({ x, y, w, h });
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }, [open, anchorRef, anim]);

  if (!open || !rect) return null;
  const position =
    align === "right"
      ? { top: rect.y + rect.h + 8, right: Math.max(0, screenW - (rect.x + rect.w)), minWidth }
      : { top: rect.y + rect.h + 8, left: rect.x, width: rect.w };

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[
          styles.panel,
          position,
          {
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { position: "absolute", backgroundColor: "#ffffff" },
});
