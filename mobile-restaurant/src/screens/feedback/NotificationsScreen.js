// Port of pages/restaurant/Notifications.jsx (/notifications): admin broadcasts from the inbox
// (polled every 5 min, as on web) merged with status rows built from the latest 30 orders.
// Order rows are hidden locally (restaurant_dismissed_notifications); broadcasts are dismissed
// on the backend.
import dayjs from "dayjs";
import { ArrowLeft, Bell, RefreshCw, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { getOrders } from "../../api";
import useNotificationInbox from "../../components/feedback/useNotificationInbox";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { Text } from "../../components/ui";
import { withProtected } from "../../navigation/Protected";
import { useAppBack } from "../../navigation/back";
import { store } from "../../storage";
import { tw } from "../../theme/tokens";

const DISMISSED_KEY = "restaurant_dismissed_notifications";

const getStatusLabel = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "confirmed") return "New order received";
  if (normalized === "preparing") return "Order is preparing";
  if (normalized === "ready") return "Order is ready for pickup";
  if (normalized === "out_for_delivery") return "Order out for delivery";
  if (normalized === "delivered") return "Order delivered";
  if (normalized === "cancelled") return "Order cancelled";
  if (normalized === "rejected") return "Order rejected";
  return "Order update";
};

// toLocaleString("en-IN", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", hour12:true})
const formatTime = (value) => {
  const d = dayjs(value);
  return `${d.format("DD MMM")}, ${d.format("hh:mm a")}`;
};

function NotificationsScreen() {
  const goBack = useAppBack();
  const bottomInset = useShellBottomInset();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);
  const dismissedLoaded = useRef(false);
  const {
    items: broadcastNotifications,
    loading: broadcastLoading,
    markAsRead: markBroadcastAsRead,
    dismiss: dismissBroadcastNotification,
    dismissAll: dismissAllBroadcastNotifications,
    refresh: refreshBroadcastNotifications,
  } = useNotificationInbox({ limit: 100, pollMs: 5 * 60 * 1000 });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getOrders({ page: 1, limit: 30 });
      setOrders(response?.data?.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    let alive = true;
    store.get(DISMISSED_KEY, []).then((saved) => {
      if (!alive) return;
      dismissedLoaded.current = true;
      if (Array.isArray(saved) && saved.length) setDismissedIds((prev) => [...new Set([...saved, ...prev])]);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (dismissedLoaded.current) store.set(DISMISSED_KEY, dismissedIds);
  }, [dismissedIds]);

  const notifications = useMemo(() => {
    const orderNotifications = (orders || [])
      .map((order) => {
        const id = order._id || order.orderId;
        const timestamp = order.updatedAt || order.createdAt;
        return {
          id,
          orderId: order.orderId || "N/A",
          message: getStatusLabel(order.orderStatus || order.status),
          timeValue: timestamp ? new Date(timestamp).getTime() : 0,
          time: timestamp ? formatTime(timestamp) : "N/A",
        };
      })
      .filter((item) => item.id && !dismissedIds.includes(item.id));
    const broadcastRows = (broadcastNotifications || []).map((item) => ({
      id: item.id,
      message: item.title || "Broadcast notification",
      detail: item.message || "",
      source: "broadcast",
      read: item.read,
      timeValue: item.createdAt ? new Date(item.createdAt).getTime() : 0,
      time: item.createdAt ? formatTime(item.createdAt) : "N/A",
    }));
    return [...broadcastRows, ...orderNotifications].sort((a, b) => b.timeValue - a.timeValue);
  }, [broadcastNotifications, dismissedIds, orders]);

  const removeNotification = (id, source = "order") => {
    if (source === "broadcast") {
      dismissBroadcastNotification(id);
      return;
    }
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const clearAll = () => {
    dismissAllBroadcastNotifications();
    const ids = notifications
      .filter((item) => item.source !== "broadcast")
      .map((n) => n.id)
      .filter(Boolean);
    setDismissedIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const handleRefresh = async () => {
    await Promise.all([fetchNotifications(), refreshBroadcastNotifications()]);
  };

  const isLoading = loading || broadcastLoading;

  const renderItem = ({ item }) => {
    const unreadBroadcast = item.source === "broadcast" && !item.read;
    return (
      <Pressable
        onPress={item.source === "broadcast" ? () => markBroadcastAsRead(item.id) : undefined}
        style={[styles.row, unreadBroadcast ? styles.rowUnread : null]}
      >
        <View style={styles.rowBody}>
          <View style={styles.rowTitle}>
            {item.source === "broadcast" ? <Bell size={16} color={tw.blue600} /> : null}
            <Text style={styles.message}>{item.message}</Text>
          </View>
          {item.source === "broadcast" ? (
            <Text style={styles.detail}>{item.detail || "Admin notification"}</Text>
          ) : (
            <Text style={styles.detail}>Order: {item.orderId}</Text>
          )}
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Pressable
          onPress={() => removeNotification(item.id, item.source)}
          style={({ pressed }) => [styles.removeBtn, pressed && { backgroundColor: tw.gray100 }]}
          accessibilityLabel="Remove notification"
          hitSlop={4}
        >
          <X size={16} color={tw.gray600} />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: tw.gray100 }]}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={tw.gray900} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <Pressable
          onPress={handleRefresh}
          style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: tw.gray100 }]}
          accessibilityLabel="Refresh"
        >
          <RefreshCw size={16} color={tw.gray700} />
        </Pressable>
      </View>

      <FlatList
        data={isLoading ? [] : notifications}
        keyExtractor={(item) => `${item.source || "order"}-${item.id}`}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[styles.content, { paddingBottom: 112 + bottomInset }]}
        ListHeaderComponent={
          !loading && notifications.length > 0 ? (
            <View style={styles.clearRow}>
              <Pressable onPress={clearAll} hitSlop={6}>
                {({ pressed }) => <Text style={[styles.clearText, pressed && { color: tw.red700 }]}>Clear all</Text>}
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>{isLoading ? "Loading notifications..." : "No notifications"}</Text>
        }
      />
    </View>
  );
}

function Separator() {
  return <View style={{ height: 8 }} />;
}

export default withProtected(NotificationsScreen);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
  },
  iconBtn: { padding: 8, borderRadius: 9999 },
  title: { flex: 1, fontSize: 16, fontWeight: "600", color: tw.gray900 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  clearRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  clearText: { fontSize: 12, fontWeight: "500", color: tw.red600 },
  emptyText: { textAlign: "center", fontSize: 14, color: tw.gray600, paddingVertical: 48 },
  row: {
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  rowUnread: { borderColor: "#bedbff", backgroundColor: "rgba(239,246,255,0.4)" },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  message: { flexShrink: 1, fontSize: 14, fontWeight: "500", color: tw.gray900 },
  detail: { fontSize: 12, color: tw.gray600, marginTop: 2 },
  time: { fontSize: 12, color: tw.gray500, marginTop: 4 },
  removeBtn: { padding: 6, borderRadius: 9999 },
});
