// Port of components/restaurant/RestaurantNavbar.jsx at phone width: the red gradient header with
// the hamburger, logo, restaurant name, address and company, the display-only Online/Offline
// pill, search (Orders and Inventory only) and the notifications bell. The gradient runs under the
// status bar. The web's "New Table Request" dining popup is not ported: the backend never emits
// new_dining_booking and the data layer exposes no reservation state.
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Bell, MapPin, Menu, Search, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getOrders } from "../../api/orders";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { resolveMediaUrl } from "../ui/AppImage";
import Text, { useScopedFont } from "../ui/Text";
import { setRestaurantSearch, useBusinessSettings, useInboxUnreadCount, useStoredOnlineStatus } from "./stores";

const COORDS = /^-?\d+\.\d+,\s*-?\d+\.\d+$/;
const usable = (v) => typeof v === "string" && v.trim() !== "";

// RestaurantNavbar formatAddress (stored data only).
function formatAddress(location) {
  if (!location) return "";
  if (usable(location.formattedAddress) && location.formattedAddress !== "Select location") {
    if (!COORDS.test(location.formattedAddress.trim())) return location.formattedAddress.trim();
  }
  if (usable(location.address)) return location.address.trim();
  const parts = [];
  if (usable(location.addressLine1)) parts.push(location.addressLine1.trim());
  else if (usable(location.street)) parts.push(location.street.trim());
  if (usable(location.addressLine2)) parts.push(location.addressLine2.trim());
  if (usable(location.area)) parts.push(location.area.trim());
  if (usable(location.landmark)) parts.push(location.landmark.trim());
  if (usable(location.city)) {
    const city = location.city.trim();
    if (!parts.some((p) => p.toLowerCase().includes(city.toLowerCase()))) parts.push(city);
  }
  if (usable(location.state)) {
    const state = location.state.trim();
    if (!parts.some((p) => p.toLowerCase().includes(state.toLowerCase()))) parts.push(state);
  }
  const zip = location.zipCode || location.pincode || location.postalCode;
  if (usable(zip)) parts.push(zip.trim());
  return parts.length ? parts.join(", ") : "";
}

function restaurantAddress(r) {
  if (!r) return "";
  let loc = "";
  if (r.location) {
    const f = r.location.formattedAddress;
    if (usable(f) && f !== "Select location" && !COORDS.test(f.trim())) loc = f.trim();
    if (!loc) loc = formatAddress(r.location).trim();
    if (!loc && usable(r.location.address)) loc = r.location.address.trim();
  }
  if (!loc && usable(r.address)) loc = r.address.trim();
  return loc;
}

function PulseDot() {
  const [anim] = useState(() => new Animated.Value(1));
  useEffect(() => {
    // animate-pulse: opacity 1 -> 0.5 -> 1 over 2 s
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View pointerEvents="none" style={[styles.bellDot, { opacity: anim }]} />;
}

/**
 * Props (all optional, as on web): restaurantName, location, showSearch, showOfflineOnlineTag,
 * showNotifications, onMobileMenuOpen.
 */
export default function RestaurantNavbar({
  restaurantName: propRestaurantName,
  location: propLocation,
  showSearch = true,
  showOfflineOnlineTag = true,
  showNotifications = true,
  onMobileMenuOpen,
}) {
  const insets = useSafeAreaInsets();
  const { headerGradient } = useTheme();
  const { restaurant } = useAuth();
  const { companyName, logoUrl } = useBusinessSettings();
  const unreadCount = useInboxUnreadCount();
  const storedOnline = useStoredOnlineStatus();
  const inputFont = useScopedFont("500");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchSeq = useRef(0);

  // The guard and AuthContext keep `restaurant` fresh (/current every 30 s); web fetched it here.
  const loading = !restaurant;
  const restaurantName = propRestaurantName || restaurant?.name || "Restaurant";
  const location = useMemo(
    () => (usable(propLocation) ? propLocation.trim() : restaurantAddress(restaurant)),
    [propLocation, restaurant],
  );
  const isOnline = storedOnline !== null ? storedOnline : Boolean(restaurant?.isAcceptingOrders);

  // Global search: debounced getOrders({search}) published to useRestaurantSearch().
  useEffect(() => {
    const seq = ++searchSeq.current;
    const q = searchValue;
    if (q.trim() === "") {
      setRestaurantSearch({ query: "", results: [], isLoading: false });
      return undefined;
    }
    setRestaurantSearch({ query: q, results: [], isLoading: true });
    const t = setTimeout(async () => {
      try {
        const res = await getOrders({ page: 1, limit: 100, search: q });
        if (seq === searchSeq.current && res?.success) {
          setRestaurantSearch({ query: q, results: res?.data?.orders || [], isLoading: false });
        }
      } catch (error) {
        if (seq === searchSeq.current) setRestaurantSearch({ query: q, results: [], isLoading: false, error });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [searchValue]);

  const closeSearch = () => {
    setIsSearchActive(false);
    setSearchValue("");
  };

  useEffect(() => {
    if (!isSearchActive) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setIsSearchActive(false);
      setSearchValue("");
      return true;
    });
    return () => sub.remove();
  }, [isSearchActive]);

  const logo = resolveMediaUrl(logoUrl);

  return (
    <View style={styles.headerWrap}>
      <StatusBar style="light" />
      <LinearGradient
        colors={headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bar, { paddingTop: 16 + insets.top }]}
      >
        <View style={styles.left}>
          {onMobileMenuOpen ? (
            <Pressable
              onPress={onMobileMenuOpen}
              style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
              accessibilityLabel="Open menu"
            >
              <Menu size={20} color="#ffffff" />
            </Pressable>
          ) : null}
          {logo ? <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" accessibilityLabel="Logo" /> : null}
          <View style={styles.titleCol}>
            <Text numberOfLines={1} style={styles.name}>
              {loading ? "Loading..." : restaurantName || "Restaurant"}
            </Text>
            {!loading ? (
              <View style={styles.subRow}>
                {location ? <MapPin size={12} color="rgba(255,255,255,0.8)" /> : null}
                <Text numberOfLines={1} style={styles.sub}>
                  {location || ""}
                  {location && companyName ? " • " : ""}
                  {companyName ? <Text style={styles.company}>{companyName.toUpperCase()}</Text> : ""}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.right}>
          {showOfflineOnlineTag ? (
            <View style={[styles.pill, isOnline ? styles.pillOnline : styles.pillOffline]}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? "#00e676" : tw.gray400 }]} />
              <Text style={styles.pillText}>{isOnline ? "Online" : "Offline"}</Text>
            </View>
          ) : null}
          {showSearch ? (
            <Pressable
              onPress={() => setIsSearchActive(true)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              accessibilityLabel="Search"
            >
              <Search size={20} color="#ffffff" />
            </Pressable>
          ) : null}
          {showNotifications ? (
            <Pressable
              onPress={() => router.push("/notifications")}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              accessibilityLabel="Notifications"
            >
              <Bell size={20} color="#ffffff" />
              {unreadCount > 0 ? <PulseDot /> : null}
            </Pressable>
          ) : null}
        </View>

        {isSearchActive ? (
          <View style={[styles.searchOverlay, { top: insets.top }]}>
            <View style={styles.searchField}>
              <Search size={20} color={tw.gray400} style={styles.searchIcon} />
              <TextInput
                value={searchValue}
                onChangeText={setSearchValue}
                placeholder="Search by order ID or dish name"
                placeholderTextColor={tw.gray500}
                autoFocus
                returnKeyType="search"
                style={[styles.searchInput, inputFont]}
              />
            </View>
            <Pressable onPress={closeSearch} style={styles.searchClose} accessibilityLabel="Close search">
              <X size={20} color={tw.gray700} />
            </Pressable>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  // <header class="bg-white shadow-sm border-b border-gray-100">: white shows behind the
  // navbar's rounded bottom corners.
  headerWrap: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
    zIndex: 10,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  left: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 4 },
  menuBtn: { borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", padding: 8 },
  menuBtnPressed: { backgroundColor: "rgba(255,255,255,0.25)" },
  logo: { width: 36, height: 36, borderRadius: 10 },
  titleCol: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, lineHeight: 19, fontWeight: "900", color: "#ffffff" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, opacity: 0.9, minWidth: 0 },
  sub: { flexShrink: 1, fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "500" },
  company: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "700", letterSpacing: 0.55 },
  right: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  pillOnline: { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.2)" },
  pillOffline: { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.1)" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: "700", color: "#ffffff", letterSpacing: 0.275 },
  iconBtn: { padding: 8, marginLeft: 4, borderRadius: 9999 },
  iconBtnPressed: { backgroundColor: "rgba(255,255,255,0.1)" },
  bellDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fb2c36",
    borderWidth: 1,
    borderColor: "#ffffff",
    boxShadow: "0px 0px 8px rgba(239,68,68,0.4)",
  },
  searchOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  searchField: { flex: 1, justifyContent: "center" },
  searchIcon: { position: "absolute", left: 0 },
  searchInput: { paddingLeft: 32, paddingRight: 16, paddingVertical: 8, fontSize: 16, color: tw.gray900 },
  searchClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tw.gray100,
  },
});
