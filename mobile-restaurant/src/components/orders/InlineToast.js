// The dark bottom toast AllOrdersPage and OrderDetails render themselves (fixed bottom-24,
// bg-gray-900, green check or a spinner while the receipt is generated).
import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";

export default function InlineToast({ visible, message, loading = false }) {
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: true }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim]);

  if (!mounted) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: 96 + insets.bottom }]}>
      <Animated.View
        style={[
          styles.toast,
          { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] },
        ]}
      >
        {loading ? <ActivityIndicator size={20} color="#fff" /> : <Check size={20} color="#05df72" />}
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 384,
    backgroundColor: tw.gray900,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  text: { flexShrink: 1, fontSize: 14, fontWeight: "500", color: "#fff" },
});
