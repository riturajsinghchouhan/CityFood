// Port of components/restaurant/RestaurantBlockGuard.jsx. The polling lives in
// RestaurantGuardContext; this renders the guard's two full-screen states and otherwise children.
import { StatusBar } from "expo-status-bar";
import { Loader2, ShieldX } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useRestaurantGuard } from "../../context/RestaurantGuardContext";
import Text from "../ui/Text";
import { useShellLogout } from "./logout";

const SLATE50 = "#f8fafc";
const SLATE500 = "#62748e";
const SLATE600 = "#45556c";
const SLATE800 = "#1d293d";
const SLATE900 = "#0f172b";

function Spinner() {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }], marginBottom: 16 }}>
      <Loader2 size={32} color="#155dfc" />
    </Animated.View>
  );
}

export function CheckingAccountScreen() {
  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <Spinner />
      <Text style={styles.checking}>Checking account status...</Text>
    </View>
  );
}

export function AccountBlockedScreen() {
  // Web: clearModuleAuth("restaurant") then navigate("/food/restaurant/login", {replace: true}).
  // The (app) layout performs the redirect once the session is cleared.
  const { logout } = useShellLogout();
  return (
    <View style={[styles.page, styles.blockedPage]}>
      <StatusBar style="dark" />
      <View style={styles.shieldCircle}>
        <ShieldX size={48} color="#e7000b" />
      </View>
      <Text style={styles.blockedTitle}>Account Blocked</Text>
      <Text style={styles.blockedText}>You are blocked by Admin. Please contact Admin for further assistance.</Text>
      <Pressable
        onPress={() => logout()}
        style={({ pressed: p }) => [styles.logout, { backgroundColor: p ? SLATE800 : SLATE900 }]}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

export default function RestaurantBlockGuard({ children }) {
  const { checking, blocked } = useRestaurantGuard();
  if (checking) return <CheckingAccountScreen />;
  if (blocked) return <AccountBlockedScreen />;
  return children;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: SLATE50 },
  checking: { color: SLATE500, fontWeight: "500", fontSize: 16 },
  blockedPage: { padding: 24 },
  shieldCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#ffe2e2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  blockedTitle: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: SLATE900, marginBottom: 12, textAlign: "center" },
  blockedText: { color: SLATE600, textAlign: "center", maxWidth: 448, marginBottom: 32, fontSize: 16, lineHeight: 26 },
  logout: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  logoutText: { color: "#ffffff", fontWeight: "500", fontSize: 16 },
});
