// Port of components/user/home/HomeHeader.jsx: Home's location row with the notifications
// bell popover, and the search pill + VEG MODE toggle row (sticky on web).
// The two rows are also exported separately so Home can make the search row a sticky
// header (stickyHeaderIndices) the way the web uses `position: sticky`.
import { router } from "expo-router";
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronDown,
  Gift,
  MapPin,
  Mic,
  Search,
  Tag,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useUserNotifications } from "../../context/UserNotificationContext";
import { useTheme } from "../../theme/ThemeContext";
import { ScalePressable } from "../ui/primitives";
import Text from "../ui/Text";

const ICON_MAP = { CheckCircle2, Tag, Gift, AlertCircle };

// Home.jsx's rotating search placeholders (changed every 2 s).
export const HOME_SEARCH_PLACEHOLDERS = [
  'Search "burger"',
  'Search "biryani"',
  'Search "pizza"',
  'Search "desserts"',
  'Search "chinese"',
  'Search "thali"',
  'Search "momos"',
  'Search "dosa"',
];

// Home.jsx's placeholder cycling: returns the index, advancing every `intervalMs`.
export function useRotatingPlaceholder(count = HOME_SEARCH_PLACEHOLDERS.length, intervalMs = 2000) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (count <= 1) return undefined;
    const interval = setInterval(() => setIndex((prev) => (prev + 1) % count), intervalMs);
    return () => clearInterval(interval);
  }, [count, intervalMs]);
  return index;
}

function areaLabel(location) {
  const area = location?.area || location?.subLocality || location?.mainTitle || location?.neighborhood;
  const city = (location?.city || "").toLowerCase();
  const state = (location?.state || "").toLowerCase();
  if (area && !/^-?\d+(\.\d+)?$/.test(area.trim())) {
    const areaLower = area.toLowerCase();
    if (areaLower !== city && areaLower !== state) return area;
  }
  if (location?.address && location.address !== "Select location") {
    const parts = location.address.split(",").map((p) => p.trim());
    for (const part of parts) {
      const partLower = part.toLowerCase();
      if (partLower && partLower !== city && partLower !== state && !/^-?\d/.test(part) && part.length > 2) {
        return part;
      }
    }
  }
  return location?.area || location?.city || "Select Location";
}

function addressLabel(location) {
  const addr = location?.formattedAddress || location?.address || "";
  if (addr && addr.length > 5 && addr !== "Select location") return addr;
  const state = location?.state || "";
  const pincode = location?.pincode || "";
  if (state && pincode) return `${state}, ${pincode}`;
  if (state) return state;
  if (pincode) return pincode;
  return "Pinpoint location";
}

function formatInboxTime(createdAt) {
  if (!createdAt) return "Just now";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "Just now";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

function PulseDot({ borderColor }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.unreadDot, { borderColor, opacity }]} pointerEvents="none" />;
}

function NotificationsBell({ vegMode }) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { items, localNotifications, totalUnreadCount } = useUserNotifications();
  const bellRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  const merged = useMemo(() => {
    const localItems = Array.isArray(localNotifications)
      ? localNotifications.map((item) => ({ ...item, source: "local" }))
      : [];
    const broadcastItems = (items || []).map((item) => ({
      ...item,
      source: "broadcast",
      time: formatInboxTime(item.createdAt),
      type: "broadcast",
      icon: "Bell",
    }));
    return [...broadcastItems, ...localItems].sort(
      (a, b) => new Date(b.createdAt || b.timestamp || 0).getTime() - new Date(a.createdAt || a.timestamp || 0).getTime(),
    );
  }, [items, localNotifications]);

  const open = () => {
    bellRef.current?.measureInWindow((x, y, w, h) => setAnchor({ top: y + h + 8, right: windowWidth - (x + w) }));
  };
  const close = () => setAnchor(null);

  const cardBg = isDark ? "#111827" : "#ffffff";
  const softBg = isDark ? "rgba(31,41,55,0.5)" : "rgba(249,250,251,0.5)";
  const border = isDark ? "#1f2937" : "#f3f4f6";

  return (
    <>
      <ScalePressable scaleTo={0.9} onPress={open} accessibilityLabel="Notifications">
        <View ref={bellRef} collapsable={false} style={styles.bell}>
          <Bell size={16} color="#ffffff" />
          {totalUnreadCount > 0 ? <PulseDot borderColor={vegMode ? "#00b09b" : colors.primary} /> : null}
        </View>
      </ScalePressable>
      <Modal visible={Boolean(anchor)} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        {anchor ? (
          <View
            style={[
              styles.popover,
              { top: anchor.top, right: Math.max(8, anchor.right), width: Math.min(320, windowWidth - 16), backgroundColor: cardBg },
            ]}
          >
            <View style={[styles.popHeader, { borderBottomColor: border, backgroundColor: softBg }]}>
              <Text style={[styles.popTitle, { color: isDark ? "#ffffff" : "#111827" }]}>Notifications</Text>
              {totalUnreadCount > 0 ? (
                <View style={styles.newBadge}>
                  <Text style={[styles.newBadgeText, { color: colors.primary }]}>{totalUnreadCount} New</Text>
                </View>
              ) : null}
            </View>
            <ScrollView style={styles.popList} nestedScrollEnabled>
              {merged.length > 0 ? (
                merged.slice(0, 5).map((notif) => {
                  const Icon = ICON_MAP[notif.icon] || Bell;
                  return (
                    <View key={`${notif.source}-${notif.id}`} style={[styles.popItem, { borderBottomColor: isDark ? "#1f2937" : "#f9fafb" }]}>
                      <View style={styles.popIcon}>
                        <Icon size={16} color={colors.primary} />
                      </View>
                      <View style={styles.flex1}>
                        <Text numberOfLines={1} style={[styles.popItemTitle, { color: isDark ? "#ffffff" : "#111827" }]}>
                          {notif.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.popItemMsg}>
                          {notif.message}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.popEmpty}>
                  <BellOff size={40} color="#e5e7eb" />
                  <Text style={styles.popEmptyText}>All caught up!</Text>
                </View>
              )}
            </ScrollView>
            <Pressable
              onPress={() => {
                close();
                router.push("/notifications");
              }}
              style={[styles.popFooter, { backgroundColor: isDark ? "rgba(31,41,55,0.5)" : "#f9fafb" }]}
            >
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

/** Row 1: location (opens the address selector) and the notifications bell. White text, for the dark hero. */
export function HomeHeaderLocationRow({ location, handleLocationClick, vegMode = false, style }) {
  const onLocation = handleLocationClick || (() => router.push("/address-selector"));
  return (
    <View style={[styles.locRow, style]}>
      <View style={styles.locInner}>
        <Pressable onPress={onLocation} style={styles.locPress}>
          <MapPin size={26} color="#e11d48" strokeWidth={2.5} />
          <View style={styles.locText}>
            <View style={styles.areaRow}>
              <Text numberOfLines={1} style={styles.area}>
                {areaLabel(location)}
              </Text>
              <ChevronDown size={16} color="#ffffff" strokeWidth={2.5} />
            </View>
            <Text numberOfLines={1} style={styles.address}>
              {addressLabel(location).toUpperCase()}
            </Text>
          </View>
        </Pressable>
        <View style={styles.rightActions}>
          <NotificationsBell vegMode={vegMode} />
        </View>
      </View>
    </View>
  );
}

function AnimatedPlaceholder({ text }) {
  const [shown, setShown] = useState(text);
  const [y] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (text === shown) return undefined;
    const exit = Animated.parallel([
      Animated.timing(y, { toValue: -8, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    exit.start(({ finished }) => {
      if (!finished) return;
      setShown(text);
      y.setValue(8);
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
    return () => exit.stop();
  }, [text, shown, y, opacity]);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY: y }] }}>
      <Text numberOfLines={1} style={styles.placeholder}>
        {shown}
      </Text>
    </Animated.View>
  );
}

/** Row 2: search pill (rotating placeholder, mic) and the VEG MODE switch. */
export function HomeHeaderSearchRow({
  handleSearchFocus,
  handleVoiceSearchClick,
  placeholderIndex = 0,
  placeholders = HOME_SEARCH_PLACEHOLDERS,
  vegMode = false,
  handleVegModeChange,
  isCategoryStuck = false,
  pushSearchDown = false,
  style,
}) {
  const { colors, isDark } = useTheme();
  const onSearch = handleSearchFocus || (() => router.push("/search"));
  const onVoice = handleVoiceSearchClick || (() => router.push({ pathname: "/search", params: { voice: "true" } }));
  const [knob] = useState(() => new Animated.Value(vegMode ? 15 : 1));
  useEffect(() => {
    Animated.timing(knob, { toValue: vegMode ? 15 : 1, duration: 300, useNativeDriver: true }).start();
  }, [vegMode, knob]);

  return (
    <View
      style={[
        styles.searchRow,
        { marginTop: pushSearchDown ? 252 : 8 },
        isCategoryStuck && { backgroundColor: isDark ? "rgba(10,10,10,0.95)" : "rgba(255,255,255,0.95)" },
        style,
      ]}
    >
      <View style={styles.searchInner}>
        <View style={styles.flex1}>
          <ScalePressable scaleTo={0.98} onPress={onSearch} style={styles.searchPill}>
          <Search size={18} color={colors.primary} strokeWidth={2.5} style={styles.searchIcon} />
          <View style={styles.placeholderBox}>
            <AnimatedPlaceholder text={placeholders?.[placeholderIndex] || "Search"} />
          </View>
          <View style={styles.micArea}>
            <View style={styles.micDivider} />
            <Pressable onPress={onVoice} hitSlop={8} accessibilityLabel="Voice search">
              <Mic size={20} color={colors.primary} />
            </Pressable>
          </View>
          </ScalePressable>
        </View>

        <ScalePressable scaleTo={0.95} onPress={() => handleVegModeChange?.(!vegMode)} style={styles.vegToggle}>
          <Text style={styles.vegText}>{"VEG\nMODE"}</Text>
          <View style={[styles.vegTrack, { backgroundColor: vegMode ? "#16a34a" : "rgba(188,192,197,0.5)" }]}>
            <Animated.View style={[styles.vegKnob, { transform: [{ translateX: knob }] }]} />
          </View>
        </ScalePressable>
      </View>
    </View>
  );
}

/**
 * Both rows, as the web renders them. Props are the web's (Home passes its handlers);
 * native defaults: location → /address-selector, search → /search, mic → /search?voice=true.
 */
export default function HomeHeader({
  location,
  handleLocationClick,
  handleSearchFocus,
  placeholderIndex,
  placeholders,
  vegMode = false,
  handleVegModeChange,
  isCategoryStuck = false,
  handleVoiceSearchClick,
  pushSearchDown = false,
}) {
  return (
    <>
      <HomeHeaderLocationRow location={location} handleLocationClick={handleLocationClick} vegMode={vegMode} />
      <HomeHeaderSearchRow
        handleSearchFocus={handleSearchFocus}
        handleVoiceSearchClick={handleVoiceSearchClick}
        placeholderIndex={placeholderIndex}
        placeholders={placeholders}
        vegMode={vegMode}
        handleVegModeChange={handleVegModeChange}
        isCategoryStuck={isCategoryStuck}
        pushSearchDown={pushSearchDown}
      />
    </>
  );
}

const cardShadow = { boxShadow: "0px 8px 24px rgba(0,0,0,0.12)" };

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  locRow: { paddingTop: 8, paddingHorizontal: 16, overflow: "hidden" },
  locInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  locPress: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  locText: { flexShrink: 1, minWidth: 0 },
  areaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  area: { fontSize: 15, fontWeight: "700", color: "#ffffff", letterSpacing: -0.375, flexShrink: 1 },
  address: { fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.8)", lineHeight: 14, marginTop: 2 },
  rightActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  bell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    backgroundColor: "#fb923c",
  },
  popover: {
    position: "absolute",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  popHeader: { padding: 16, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  popTitle: { fontWeight: "700", fontSize: 16 },
  newBadge: { backgroundColor: "#ffedd5", borderRadius: 6, height: 16, paddingHorizontal: 8, justifyContent: "center" },
  newBadgeText: { fontSize: 10, fontWeight: "500", lineHeight: 14 },
  popList: { maxHeight: 384 },
  popItem: { padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12, borderBottomWidth: 1 },
  popIcon: { marginTop: 4, padding: 8, borderRadius: 9999, backgroundColor: "#f3f4f6" },
  popItemTitle: { fontSize: 14, fontWeight: "700" },
  popItemMsg: { fontSize: 12, color: "#6b7280" },
  popEmpty: { padding: 32, alignItems: "center", gap: 8 },
  popEmptyText: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },
  popFooter: { padding: 12, alignItems: "center" },
  viewAll: { fontSize: 12, fontWeight: "700", color: "#9ca3af" },
  searchRow: { paddingHorizontal: 4, paddingBottom: 8, paddingTop: 8 },
  searchInner: { flexDirection: "row", alignItems: "center", gap: 10, width: "96%", alignSelf: "center" },
  searchPill: {
    height: 44,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    ...cardShadow,
  },
  searchIcon: { marginRight: 8 },
  placeholderBox: { flex: 1, height: 20, overflow: "hidden", justifyContent: "center" },
  placeholder: { fontSize: 13, fontWeight: "700", color: "#6b7280", lineHeight: 20 },
  micArea: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 8 },
  micDivider: { width: 1, height: 20, backgroundColor: "#e5e7eb" },
  vegToggle: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff",
    ...cardShadow,
  },
  vegText: { fontSize: 9, fontWeight: "900", lineHeight: 11, color: "#374151", letterSpacing: 0.45, textAlign: "center" },
  vegTrack: { marginTop: 2, width: 30, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "#f3f4f6" },
  vegKnob: {
    position: "absolute",
    top: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
});
