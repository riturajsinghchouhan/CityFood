// Port of components/user/LocationGuard.jsx. On web it renders its children unchanged and
// only copies {coords, zoneId, address} from the location context into the Redux store.
// The native app has no Redux; every screen reads that state from useAppLocation(), so the
// guard is a pass-through kept where UserLayout puts it (around all user routes).
// The out-of-service UI lives with the screens: the bottom nav hides itself
// (BottomNavigation), and Home shows OutOfZoneScreen below.
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Text from "../ui/Text";

export default function LocationGuard({ children }) {
  return children;
}

const outOfZoneBg = require("../../../assets/images/out-of-zone-bg.png");

/**
 * Home.jsx's full-screen "We are coming soon in your city" state (web L2036-2061),
 * shown when the zone is not loading and isOutOfZone is true.
 */
export function OutOfZoneScreen({ onChangeLocation }) {
  const handlePress = onChangeLocation || (() => router.push("/address-selector"));
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image source={outOfZoneBg} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Out of zone background" />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)", "#1b152d"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
        pointerEvents="none"
      />
      <View style={styles.content}>
        <Text style={styles.title}>We are coming soon in your city</Text>
        <Text style={styles.subtitle}>Please change the location to continue ordering.</Text>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: pressed ? "#b91c1c" : "#dc2626", transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
        >
          <Text style={styles.buttonText}>Change Location</Text>
        </Pressable>
      </View>
    </View>
  );
}

const textShadow = { textShadowColor: "rgba(0,0,0,0.35)", textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 6 };

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#1e1332", overflow: "hidden", justifyContent: "center", zIndex: 100 },
  gradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 80 },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.75,
    lineHeight: 36,
    ...textShadow,
  },
  subtitle: { fontSize: 16, color: "#e5e7eb", marginBottom: 40, maxWidth: 384, textAlign: "center", ...textShadow },
  button: {
    width: "100%",
    maxWidth: 280,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)",
  },
  buttonText: { color: "#ffffff", fontWeight: "700", fontSize: 18 },
});
