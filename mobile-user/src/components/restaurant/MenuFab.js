// Floating "MENU" pill of RestaurantDetails.jsx: occupies the cart slot while the cart is
// empty, then moves above the view-cart pill.
import { Utensils } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../ui";

const ORANGE = "#f97316";

function useSpring(target) {
  const [value] = useState(() => new Animated.Value(target));
  useEffect(() => {
    Animated.spring(value, { toValue: target, stiffness: 400, damping: 30, mass: 0.8, useNativeDriver: false }).start();
  }, [target, value]);
  return value;
}

export function MenuFab({ itemCount, onPress }) {
  const insets = useSafeAreaInsets();
  const bottom = useSpring((itemCount > 0 ? 138 : 80) + insets.bottom);
  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, stiffness: 400, damping: 30, useNativeDriver: false }).start();
  }, [enter]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.fabWrap,
        {
          bottom,
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        },
      ]}
    >
      <Pressable onPress={onPress} accessibilityLabel="Open menu categories" style={({ pressed }) => [styles.fab, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
        <Utensils size={16} color="#ffffff" />
        <Text style={styles.fabText}>MENU</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 16, zIndex: 50, elevation: 12 },
  fab: {
    minWidth: 110,
    backgroundColor: ORANGE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    boxShadow: "0px 4px 15px rgba(255,102,0,0.4)",
  },
  fabText: { color: "#ffffff", fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
});
