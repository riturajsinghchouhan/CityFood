// DeliveryV2/pages/NotificationsV2 (/notifications): the rider's server inbox (limit 100) with an
// unread badge, "Clear all" and tap-to-mark-read. The web also merges legacy local notifications
// (utils/deliveryNotifications), which are always empty now (audit §8), so only the inbox is shown.
// Back goes to /profile (web navigate("/food/delivery/profile")).
import dayjs from "dayjs";
import { ArrowLeft, Bell, Clock, Trash2 } from "lucide-react-native";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import useNotificationInboxPage from "../../components/profile/useNotificationInboxPage";
import { Screen, Text } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, dvColor, light, tw } from "../../theme/tokens";

const UNREAD_BG = "rgba(255,247,237,0.4)"; // bg-orange-50/40 (not remapped)

// toLocaleString("en-IN", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", hour12:true})
function toTimeLabel(value) {
  const d = value ? dayjs(value) : null;
  if (!d || !d.isValid()) return "Just now";
  return d.format("DD MMM, hh:mm a");
}

function NotificationItem({ item, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.item,
        item.read ? styles.itemRead : { borderColor: dvColor("border-orange-200", light), backgroundColor: UNREAD_BG },
      ]}
    >
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemMessage}>{item.message || "Delivery notification"}</Text>
        <View style={styles.timeRow}>
          <Clock size={14} color={tw.gray500} />
          <Text style={styles.time}>{toTimeLabel(item.createdAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const goBack = useAppBack();
  const { items, unreadCount, loading, markAsRead, dismissAll } = useNotificationInboxPage({ limit: 100 });

  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );

  return (
    <Screen background="#ffffff">
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.back} hitSlop={6} accessibilityLabel="Back">
          <ArrowLeft size={20} color={tw.gray900} />
        </Pressable>
        <View style={styles.titleRow}>
          <Bell size={20} color={brand.primary} />
          <Text heading style={styles.title}>
            Notifications
          </Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        {sorted.length > 0 ? (
          <Pressable
            onPress={dismissAll}
            style={({ pressed }) => [styles.clear, pressed && { backgroundColor: tw.red50 }]}
            accessibilityLabel="Clear all"
          >
            <Trash2 size={16} color={tw.red600} />
            <Text style={styles.clearText}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <Text style={styles.state}>Loading notifications...</Text>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationItem item={item} onPress={() => markAsRead(item.id)} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={<Text style={[styles.state, styles.stateInList]}>No notifications</Text>}
        />
      )}
    </Screen>
  );
}

function Separator() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
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
  back: { padding: 8, borderRadius: 9999 },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: "600", color: tw.gray900 },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 9999,
    backgroundColor: brand.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, lineHeight: 14, fontWeight: "600", color: "#ffffff" },
  clear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearText: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: tw.red600 },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 112 },
  sep: { height: 8 },
  state: { textAlign: "center", fontSize: 14, lineHeight: 20, color: tw.gray600, paddingVertical: 48, paddingTop: 64 },
  stateInList: { paddingTop: 48 },
  item: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  itemRead: { borderColor: tw.gray200 },
  itemBody: { minWidth: 0, flexShrink: 1 },
  itemTitle: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: tw.gray900 },
  itemMessage: { fontSize: 14, lineHeight: 20, color: tw.gray700, marginTop: 2 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  time: { fontSize: 12, lineHeight: 16, color: tw.gray500 },
});
