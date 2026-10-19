// Port of Frontend/src/modules/Food/pages/user/Notifications.jsx: server inbox + device-local list.
// The web's hard-coded DEFAULT_NOTIFICATIONS were mock data and are not ported.
import { ArrowLeft, Bell, CircleAlert, CircleCheck, Clock, Gift, Tag, Trash2, X } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Screen, Text } from "../../components/ui";
import { useNotificationEvent, useUserNotifications } from "../../context/UserNotificationContext";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";

const ICON_MAP = { CheckCircle2: CircleCheck, Tag, Gift, AlertCircle: CircleAlert };

function iconColorFor(token, colors) {
  if (token === "text-primary") return colors.primary;
  if (token === "text-red-600") return tw.red600;
  if (token === "text-blue-600") return tw.blue600;
  return colors.foreground;
}

function iconBackground(type, isDark) {
  if (type === "order") return isDark ? "rgba(20,83,45,0.4)" : tw.green100;
  if (type === "offer") return isDark ? "rgba(127,29,29,0.4)" : tw.red100;
  if (type === "promotion") return isDark ? "rgba(30,58,138,0.4)" : "#dbeafe";
  return isDark ? "rgba(124,45,18,0.4)" : tw.orange100;
}

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const {
    items: broadcastNotifications,
    unreadCount: broadcastUnreadCount,
    refreshInbox,
    markAsRead: markBroadcastAsRead,
    dismiss: dismissBroadcastNotification,
    dismissAll: dismissAllBroadcastNotifications,
    localNotifications,
    setLocalNotifications,
  } = useUserNotifications();

  // useNotificationInbox("user", { limit: 100 }) fetches once on mount.
  useEffect(() => {
    refreshInbox(100);
  }, [refreshInbox]);

  useNotificationEvent("orderStatusNotification", (detail = {}) => {
    const { orderId, status, message, title } = detail;
    const isCancelled = String(status || "").toLowerCase().includes("cancel");
    setLocalNotifications((prev) => [
      {
        id: `order-${Date.now()}`,
        type: isCancelled ? "alert" : "order",
        title: title || `Order #${orderId} ${status}`,
        message: message || `Your order status is now ${status}`,
        time: "Just now",
        timestamp: Date.now(),
        read: false,
        icon: isCancelled ? "AlertCircle" : "CheckCircle2",
        iconColor: isCancelled ? "text-red-600" : "text-primary",
      },
      ...prev,
    ]);
  });

  useNotificationEvent("deliveryDropOtp", (detail = {}) => {
    const { orderId, otp, message } = detail;
    setLocalNotifications((prev) => [
      {
        id: `otp-${Date.now()}`,
        type: "alert",
        title: "Delivery OTP Received",
        message: message || `Your OTP for order #${orderId} is ${otp}`,
        time: "Just now",
        timestamp: Date.now(),
        read: false,
        icon: "AlertCircle",
        iconColor: "text-#55254b",
      },
      ...prev,
    ]);
  });

  const mergedNotifications = useMemo(() => {
    const localItems = (localNotifications || []).map((item) => ({ ...item, source: "local" }));
    const broadcastItems = (broadcastNotifications || []).map((item) => ({
      ...item,
      source: "broadcast",
      type: "broadcast",
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "Just now",
      // The context always fills createdAt (falls back to the fetch time).
      timestamp: item.createdAt,
      icon: "Bell",
      iconColor: "text-blue-600",
    }));
    return [...broadcastItems, ...localItems].sort(
      (a, b) =>
        new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime(),
    );
  }, [broadcastNotifications, localNotifications]);

  const unreadCount = (localNotifications || []).filter((n) => !n.read).length + broadcastUnreadCount;

  const handleMarkAsRead = (id, source) => {
    if (source === "broadcast") {
      markBroadcastAsRead(id);
      return;
    }
    setLocalNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleClearAll = () => {
    setLocalNotifications([]);
    dismissAllBroadcastNotifications();
  };

  const handleDeleteOne = (id, source) => {
    if (source === "broadcast") {
      dismissBroadcastNotification(id);
      return;
    }
    setLocalNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const renderItem = ({ item }) => {
    const Icon = ICON_MAP[item.icon] || Bell;
    const unread = !item.read;
    return (
      <Pressable
        onPress={() => handleMarkAsRead(item.id, item.source)}
        style={[
          styles.card,
          unread
            ? {
                backgroundColor: isDark ? "rgba(127,29,29,0.2)" : "rgba(254,242,242,0.5)",
                borderColor: isDark ? "#9f0712" : "#ffc9c9",
              }
            : { backgroundColor: isDark ? tw.gray800 : "#ffffff", borderColor: isDark ? tw.gray700 : tw.gray200 },
        ]}
      >
        {unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
        <View style={styles.cardRow}>
          <View style={[styles.iconCircle, { backgroundColor: iconBackground(item.type, isDark) }]}>
            <Icon size={20} color={iconColorFor(item.iconColor, colors)} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  { color: unread ? (isDark ? "#ffffff" : tw.gray900) : isDark ? tw.gray300 : tw.gray700 },
                ]}
              >
                {item.title}
              </Text>
              <Pressable
                accessibilityLabel="Delete notification"
                onPress={() => handleDeleteOne(item.id, item.source)}
                style={styles.deleteBtn}
                hitSlop={6}
              >
                <X size={16} color={tw.gray400} />
              </Pressable>
            </View>
            <Text numberOfLines={2} style={[styles.message, { color: isDark ? tw.gray400 : tw.gray600 }]}>
              {item.message}
            </Text>
            <View style={styles.timeRow}>
              <Clock size={12} color={isDark ? tw.gray400 : tw.gray500} />
              <Text style={[styles.time, { color: isDark ? tw.gray400 : tw.gray500 }]}>{item.time}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"}>
      <View style={styles.header}>
        <Pressable onPress={() => goTo("/")} style={styles.backBtn} hitSlop={6}>
          <ArrowLeft size={16} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Bell size={20} color={colors.primary} fill={colors.primary} />
          <Text style={[styles.h1, { color: isDark ? "#ffffff" : tw.gray800 }]}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        {mergedNotifications.length > 0 ? (
          <Pressable onPress={handleClearAll} style={styles.clearBtn} hitSlop={6}>
            <Trash2 size={16} color={tw.gray500} />
            <Text style={styles.clearText}>Clear All</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={mergedNotifications}
        keyExtractor={(item) => `${item.source}-${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell size={64} color={isDark ? tw.gray600 : tw.gray300} />
            <Text style={[styles.emptyTitle, { color: isDark ? tw.gray300 : tw.gray700 }]}>No notifications</Text>
            <Text style={[styles.emptyText, { color: isDark ? tw.gray400 : tw.gray500 }]}>{"You're all caught up!"}</Text>
          </View>
        }
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 16,
    marginBottom: 16,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  h1: { fontSize: 18, fontWeight: "700" },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#ffffff", fontSize: 12, fontWeight: "500" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, height: 32 },
  clearText: { fontSize: 12, fontWeight: "500", color: tw.gray500 },
  list: { paddingHorizontal: 12, paddingBottom: 16 },
  separator: { height: 12 },
  card: { borderRadius: 12, borderWidth: 1, paddingVertical: 4, ...shadow.sm },
  dot: { position: "absolute", top: 8, right: 8, width: 10, height: 10, borderRadius: 5 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  deleteBtn: { borderRadius: 999, padding: 4 },
  message: { fontSize: 12, marginBottom: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  time: { fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14 },
});
