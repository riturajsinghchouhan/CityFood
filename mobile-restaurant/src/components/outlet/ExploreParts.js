// ExploreMore.jsx pieces: the section data, the bento tile grid, the full-screen feature search
// (slides down from the top) and the "My profile" panel (restaurant-modal-sheet = centred dialog).
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronRight,
  Clock,
  Edit,
  FileText,
  IndianRupee,
  Info,
  LifeBuoy,
  LogOut,
  MapPin,
  MessageSquare,
  Receipt,
  Search,
  Settings,
  Star,
  Ticket,
  Truck,
  User,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { CenterSheet } from "../menu/common";
import { mixHex } from "../menu/palette";
import { AppImage, ScalePressable, Text, inputFont } from "../ui";
import { extra } from "./common";

// Web routes without /food/restaurant ("Share-Feedback" is case-insensitive on web).
export const EXPLORE_SECTIONS = [
  {
    key: "manage-outlet",
    title: "Manage outlet",
    items: [
      { id: 1, label: "Outlet info", icon: Info, route: "/outlet-info" },
      { id: 2, label: "Outlet timings", icon: Clock, route: "/outlet-timings" },
      { id: 4, label: "Menu categories", icon: Settings, route: "/menu-categories" },
      { id: 6, label: "Promo Codes", icon: Ticket, route: "/promocodes" },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    items: [
      { id: 3, label: "Delivery settings", icon: Truck, route: "/delivery-settings" },
      { id: 4, label: "Zone Setup", icon: MapPin, route: "/zone-setup" },
    ],
  },
  {
    key: "orders",
    title: "Orders",
    items: [
      { id: 1, label: "Order history", icon: FileText, route: "/orders/all" },
      { id: 2, label: "Complaints", icon: Star, route: "/feedback?tab=complaints" },
      { id: 3, label: "Reviews", icon: MessageSquare, route: "/feedback" },
    ],
  },
  {
    key: "help",
    title: "Help",
    items: [
      { id: 1, label: "Support", icon: LifeBuoy, route: "/help-centre/support" },
      { id: 2, label: "Share your feedback", icon: Edit, route: "/share-feedback" },
    ],
  },
  {
    key: "accounting",
    title: "Finance",
    items: [
      { id: 1, label: "Payout", icon: IndianRupee, route: "/hub-finance" },
      { id: 2, label: "Invoices", icon: Receipt, route: "/hub-finance?tab=invoices" },
      { id: 3, label: "Bank details", icon: Building2, route: "/update-bank-details" },
    ],
  },
];

export function filterSections(query) {
  if (!query.trim()) return EXPLORE_SECTIONS;
  const q = query.toLowerCase();
  return EXPLORE_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => i.label.toLowerCase().includes(q)) })).filter(
    (s) => s.items.length > 0,
  );
}

// Staggered fade-up like the web's motion.div (opacity 0, y 8 -> 1, 0).
export function FadeUp({ delay = 0, distance = 8, duration = 300, style, children }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const t = Animated.timing(anim, { toValue: 1, duration, delay: delay * 1000, useNativeDriver: true });
    t.start();
    return () => t.stop();
  }, [anim, delay, duration]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// restaurant-bento-grid--explore: 2 columns, gap 16; restaurant-bento-card tiles.
export function ExploreSection({ section, delay, onOpen }) {
  const { colors } = useTheme();
  const cardBorder = mixHex(colors.rtBorder, "#ffffff", 0.65);
  const rows = [];
  for (let i = 0; i < section.items.length; i += 2) rows.push(section.items.slice(i, i + 2));
  return (
    <FadeUp delay={delay} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.grid}>
        {rows.map((row, r) => (
          <View key={`${section.key}-${r}`} style={styles.gridRow}>
            {row.map((item, index) => {
              const Icon = item.icon;
              return (
                <FadeUp
                  key={`${section.key}-${item.id}`}
                  delay={delay + 0.1 + (r * 2 + index) * 0.02}
                  distance={4}
                  duration={250}
                  style={styles.cell}
                >
                  <ScalePressable
                    scaleTo={0.98}
                    onPress={() => onOpen(item)}
                    style={[styles.tile, { borderColor: cardBorder }]}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <Icon size={32} color={tw.gray900} strokeWidth={1.5} />
                  </ScalePressable>
                  <Text style={styles.tileLabel}>{item.label}</Text>
                </FadeUp>
              );
            })}
            {row.length === 1 ? <View style={styles.cell} /> : null}
          </View>
        ))}
      </View>
    </FadeUp>
  );
}

function SearchEmpty({ title, subtitle, titleStyle }) {
  return (
    <View style={styles.empty}>
      <Search size={64} color={tw.gray300} />
      <Text style={[styles.emptyTitle, titleStyle]}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </View>
  );
}

export function NoResults() {
  return <SearchEmpty title="No results found" subtitle="Try searching with different keywords" />;
}

// The full-height search panel (motion y: -100% -> 0, spring damping 30 / stiffness 300).
export function ExploreSearch({ open, query, onChangeQuery, onClose, onOpen }) {
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    const a = open
      ? Animated.spring(anim, { toValue: 1, damping: 30, stiffness: 300, mass: 1, useNativeDriver: true })
      : Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true });
    a.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, anim]);
  if (!mounted) return null;
  const height = Dimensions.get("window").height;
  const results = filterSections(query);

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={styles.fill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.searchPanel,
          { paddingTop: insets.top, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-height, 0] }) }] },
        ]}
      >
        <View style={styles.searchHeader}>
          <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={6} accessibilityLabel="Close search">
            <ArrowLeft size={24} color={tw.gray900} />
          </Pressable>
          <View style={styles.searchInputWrap}>
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Search features..."
              placeholderTextColor={tw.gray500}
              autoFocus
              style={[styles.searchInput, inputFont]}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => onChangeQuery("")} style={styles.clearBtn} hitSlop={6} accessibilityLabel="Clear search">
                <X size={16} color={tw.gray600} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView style={{ maxHeight: height * 0.7 }} keyboardShouldPersistTaps="handled">
          {query.trim() ? (
            results.length > 0 ? (
              <View style={styles.resultsPad}>
                {results.map((section, si) => (
                  <View key={section.key} style={si < results.length - 1 ? styles.resultSection : null}>
                    <Text style={styles.resultSectionTitle}>{section.title.toUpperCase()}</Text>
                    <View style={styles.resultList}>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Pressable
                            key={`${section.key}-${item.id}`}
                            onPress={() => onOpen(item)}
                            style={({ pressed }) => [styles.resultRow, pressed && { backgroundColor: tw.gray50 }]}
                          >
                            <View style={styles.resultIcon}>
                              <Icon size={20} color={tw.gray900} />
                            </View>
                            <Text style={styles.resultLabel}>{item.label}</Text>
                            <ChevronRight size={20} color={tw.gray400} />
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <NoResults />
            )
          ) : (
            <SearchEmpty
              title="Search for features"
              subtitle="Type to search for outlet settings, orders, and more"
              titleStyle={styles.emptyTitleIdle}
            />
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/**
 * "My profile": owner card (-> edit-owner), Test FCM (+ Test VOIP outside production), Logout and
 * Delete Restaurant.
 */
export function ProfileSheet({
  open,
  onClose,
  userData,
  loading,
  onEditOwner,
  onTest,
  activeTest,
  showVoip,
  onLogout,
  isLoggingOut,
  onDelete,
}) {
  const { colors } = useTheme();
  const header = (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>My profile</Text>
      <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={6} accessibilityLabel="Close">
        <X size={20} color={tw.gray900} />
      </Pressable>
    </View>
  );
  const imageUrl = userData.profileImage?.url;
  return (
    <CenterSheet open={open} onClose={onClose} header={header} maxHeight="90%">
      <View style={styles.userBlock}>
        <Pressable
          onPress={onEditOwner}
          style={({ pressed }) => [styles.userBtn, pressed && { backgroundColor: tw.gray50 }]}
        >
          <View style={[styles.avatar, { borderColor: colors.primary + "1A" }]}>
            {imageUrl ? (
              <AppImage src={imageUrl} width={64} style={StyleSheet.absoluteFill} placeholderType="none" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.avatarFallback, { backgroundColor: colors.primary + "1A" }]}>
                <User size={32} color={colors.primary} />
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {loading ? "Loading..." : userData.name}
            </Text>
            {userData.phone ? <Text style={styles.userLine}>{userData.phone}</Text> : null}
            {userData.email ? <Text style={styles.userLine}>{userData.email}</Text> : null}
            <View style={[styles.roleChip, { backgroundColor: colors.primarySoft, borderColor: colors.primary + "1A" }]}>
              <Text style={[styles.roleText, { color: colors.primary }]}>{userData.role}</Text>
            </View>
          </View>
        </Pressable>
      </View>

      <View style={styles.testBlock}>
        <ScalePressable
          scaleTo={0.98}
          onPress={() => onTest("fcm")}
          disabled={Boolean(activeTest)}
          style={[styles.testBtn, styles.testFcm, Boolean(activeTest) && styles.disabled]}
        >
          <View style={styles.testLeft}>
            <View style={styles.testIcon}>
              <Bell size={20} color={extra.blue500} />
            </View>
            <Text style={[styles.testText, { color: tw.blue600 }]}>
              {activeTest === "fcm" ? "Sending FCM..." : "Test FCM Notification"}
            </Text>
          </View>
          <ChevronRight size={20} color={extra.blue300} />
        </ScalePressable>
        {showVoip ? (
          <ScalePressable
            scaleTo={0.98}
            onPress={() => onTest("voip")}
            disabled={Boolean(activeTest)}
            style={[styles.testBtn, styles.testVoip, Boolean(activeTest) && styles.disabled]}
          >
            <View style={styles.testLeft}>
              <View style={styles.testIcon}>
                <Bell size={20} color={extra.emerald500} />
              </View>
              <Text style={[styles.testText, { color: extra.emerald600 }]}>
                {activeTest === "voip" ? "Sending VOIP..." : "Test VOIP Call"}
              </Text>
            </View>
            <ChevronRight size={20} color={extra.emerald300} />
          </ScalePressable>
        ) : null}
      </View>

      <View style={styles.actionsBlock}>
        <ScalePressable
          scaleTo={0.98}
          onPress={onLogout}
          disabled={isLoggingOut}
          style={[
            styles.logoutBtn,
            { backgroundColor: colors.primarySoft, borderColor: colors.primary + "33" },
            isLoggingOut && styles.disabled,
          ]}
        >
          <LogOut size={20} color={colors.primary} />
          <Text style={[styles.logoutText, { color: colors.primary }]}>{isLoggingOut ? "Logging out..." : "Logout"}</Text>
        </ScalePressable>

        <ScalePressable scaleTo={0.99} onPress={onDelete} style={styles.deleteBtn}>
          <View style={styles.deleteLeft}>
            <View style={styles.deleteIcon}>
              <X size={20} color={tw.red600} />
            </View>
            <View style={styles.flexShrink}>
              <Text style={styles.deleteTitle}>Delete Restaurant</Text>
              <Text style={styles.deleteSub}>Permanently delete your account</Text>
            </View>
          </View>
          <ChevronRight size={20} color={tw.red600 + "66"} />
        </ScalePressable>
      </View>
    </CenterSheet>
  );
}

// The "restaurant-modal-inline max-w-md rounded-3xl p-5" delete confirmation.
export function DeleteRestaurantDialog({ open, onClose, onConfirm, isDeleting }) {
  return (
    <CenterSheet
      open={open}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      scroll={false}
      contentStyle={styles.confirmPad}
    >
      <View style={styles.confirmTop}>
        <View style={styles.confirmIcon}>
          <X size={20} color={tw.red600} />
        </View>
        <Text style={styles.confirmTitle}>Delete Restaurant?</Text>
        <Text style={styles.confirmText}>
          Are you sure you want to permanently delete your restaurant account? This action cannot be undone.
        </Text>
      </View>
      <View style={styles.confirmRow}>
        <Pressable
          onPress={onClose}
          disabled={isDeleting}
          style={({ pressed }) => [styles.confirmNo, pressed && { backgroundColor: tw.gray50 }, isDeleting && styles.disabled]}
        >
          <Text style={styles.confirmNoText}>No</Text>
        </Pressable>
        <ScalePressable
          scaleTo={0.95}
          onPress={onConfirm}
          disabled={isDeleting}
          style={[styles.confirmYes, isDeleting && styles.disabled]}
        >
          <Text style={styles.confirmYesText}>{isDeleting ? "Deleting..." : "Yes, Delete"}</Text>
        </ScalePressable>
      </View>
    </CenterSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  disabled: { opacity: 0.5 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900, marginBottom: 16 },
  grid: { gap: 16 },
  gridRow: { flexDirection: "row", gap: 16 },
  cell: { flex: 1, alignItems: "stretch" },
  tile: {
    flex: 1,
    minHeight: 110,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderRadius: 20,
    boxShadow: "0px 1px 2px rgba(15,23,42,0.04), 0px 8px 24px -10px rgba(15,23,42,0.08)",
  },
  tileLabel: { marginTop: 12, fontSize: 14, lineHeight: 18, color: tw.gray700, textAlign: "center" },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 16 },
  emptyTitle: { marginTop: 16, marginBottom: 8, fontSize: 18, fontWeight: "600", color: tw.gray900, textAlign: "center" },
  emptyTitleIdle: { fontSize: 16, fontWeight: "500", marginBottom: 4 },
  emptySub: { fontSize: 14, color: tw.gray500, textAlign: "center" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
  searchPanel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1)",
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  searchInputWrap: { flex: 1, justifyContent: "center" },
  searchInput: {
    backgroundColor: tw.gray100,
    borderRadius: 8,
    paddingLeft: 16,
    paddingRight: 40,
    paddingVertical: 8,
    fontSize: 16,
    color: tw.gray900,
  },
  clearBtn: { position: "absolute", right: 8, padding: 4, borderRadius: 9999 },
  resultsPad: { paddingHorizontal: 16, paddingVertical: 16 },
  resultSection: { marginBottom: 24 },
  resultSectionTitle: { fontSize: 14, fontWeight: "600", color: tw.gray500, marginBottom: 12, letterSpacing: 0.35 },
  resultList: { gap: 8 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  resultIcon: { padding: 8, backgroundColor: tw.gray100, borderRadius: 8 },
  resultLabel: { flex: 1, fontSize: 16, color: tw.gray900 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
    backgroundColor: "#ffffff",
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  userBlock: { paddingHorizontal: 24, paddingVertical: 24 },
  userBtn: { flexDirection: "row", alignItems: "flex-start", gap: 16, padding: 8, margin: -8, borderRadius: 12 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: tw.gray100,
    overflow: "hidden",
    borderWidth: 4,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 16, fontWeight: "700", color: tw.gray900, marginBottom: 4 },
  userLine: { fontSize: 14, color: tw.gray600, marginBottom: 4 },
  roleChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  roleText: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  testBlock: { paddingHorizontal: 24, paddingBottom: 16, gap: 12 },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  testFcm: { backgroundColor: tw.blue50, borderColor: extra.blue100 },
  testVoip: { backgroundColor: extra.emerald50, borderColor: extra.emerald100 },
  testLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  testIcon: {
    backgroundColor: "#ffffff",
    padding: 8,
    borderRadius: 12,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)",
  },
  testText: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  actionsBlock: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: { fontSize: 16, fontWeight: "700" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tw.red600 + "33",
    backgroundColor: tw.red600 + "0D",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  deleteLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1, minWidth: 0 },
  deleteIcon: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: tw.red600 + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteTitle: { fontSize: 16, fontWeight: "600", color: tw.red600 },
  deleteSub: { fontSize: 14, fontWeight: "500", color: tw.red600 + "99" },
  confirmPad: { padding: 20 },
  confirmTop: { alignItems: "center" },
  confirmIcon: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: tw.red100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900, textAlign: "center" },
  confirmText: { marginTop: 4, fontSize: 14, color: tw.gray500, textAlign: "center" },
  confirmRow: { marginTop: 20, flexDirection: "row", gap: 12 },
  confirmNo: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tw.gray200,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmNoText: { fontSize: 14, fontWeight: "600", color: tw.gray700 },
  confirmYes: { flex: 1, borderRadius: 16, backgroundColor: tw.red600, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  confirmYesText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
});
