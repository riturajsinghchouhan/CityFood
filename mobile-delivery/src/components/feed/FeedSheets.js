// DeliveryHomeV2's two header sheets: "Emergency Help" (5 tel: rows from GET /emergency-help) and
// "Notifications" (server inbox, Clear All, "View Notification History" -> /notifications).
import dayjs from "dayjs";
import { router } from "expo-router";
import { AlertTriangle, Bell, User } from "lucide-react-native";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { toNativePath } from "../../navigation/links";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { ScalePressable } from "../ui/primitives";
import Text from "../ui/Text";
import { toast } from "../ui/Toast";
import BottomPopup from "./BottomPopup";
import { callPhone } from "./mapUtils";
import { p } from "./palette";

export function EmergencySheet({ isOpen, onClose, numbers }) {
  const { colors } = useTheme();
  const options = [
    { title: "Medical Emergency", subtitle: "Call an ambulance", Icon: AlertTriangle, color: p.red600, phone: numbers.medicalEmergency },
    { title: "Accident Helpline", subtitle: "Report an accident", Icon: AlertTriangle, color: colors.primary, phone: numbers.accidentHelpline },
    { title: "Contact Police", subtitle: "Nearest police support", Icon: AlertTriangle, color: colors.primary, phone: numbers.contactPolice },
    { title: "Insurance", subtitle: "Policy & claim help", Icon: AlertTriangle, color: colors.primary, phone: numbers.insurance },
    { title: "Team Leader", subtitle: "Contact your assigned team leader", Icon: User, color: p.purple600, phone: numbers.teamLeader },
  ];
  return (
    <BottomPopup isOpen={isOpen} title="Emergency Help" onClose={onClose}>
      <View style={styles.emergencyList}>
        {options.map((opt) => (
          <ScalePressable
            key={opt.title}
            scaleTo={0.95}
            onPress={() => {
              const num = String(opt.phone || "").replace(/\D/g, "");
              if (num) callPhone(num);
              else toast.error("Number not configured");
            }}
            style={styles.emergencyRow}
          >
            <View style={styles.emergencyIcon}>
              <opt.Icon size={24} color={opt.color} />
            </View>
            <View style={styles.flexShrink}>
              <Text heading style={styles.emergencyTitle}>{opt.title}</Text>
              <Text style={styles.emergencySub}>{opt.subtitle}</Text>
            </View>
          </ScalePressable>
        ))}
      </View>
    </BottomPopup>
  );
}

export function NotificationsSheet({ isOpen, onClose, inbox }) {
  const { colors } = useTheme();
  const { items, markAsRead, dismissAll } = inbox;
  return (
    <BottomPopup isOpen={isOpen} title="Notifications" onClose={onClose}>
      <ScrollView style={{ maxHeight: Dimensions.get("window").height * 0.6, marginTop: -8 }} contentContainerStyle={styles.list}>
        {items.length > 0 ? (
          <>
            <View style={styles.clearRow}>
              <Pressable
                onPress={() => {
                  dismissAll();
                  toast.success("All notifications cleared");
                }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearText}>Clear All</Text>
              </Pressable>
            </View>
            <View style={styles.items}>
              {items.map((item) => (
                <ScalePressable
                  key={item.id}
                  scaleTo={0.98}
                  onPress={() => {
                    markAsRead(item.id);
                    if (item.link) {
                      const path = toNativePath(item.link.startsWith("/") ? item.link : `/${item.link}`);
                      onClose();
                      if (path) router.push(path);
                    }
                  }}
                  style={[
                    styles.item,
                    item.read
                      ? { backgroundColor: tw.gray50, borderColor: tw.gray100 }
                      : { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
                  ]}
                >
                  <View style={styles.itemRow}>
                    <View style={[styles.itemIcon, { backgroundColor: item.read ? tw.gray200 : colors.primary }]}>
                      <Bell size={16} color={item.read ? tw.gray500 : "#ffffff"} />
                    </View>
                    <View style={styles.itemBody}>
                      <View style={styles.itemHead}>
                        <Text heading numberOfLines={1} style={[styles.itemTitle, { color: item.read ? tw.gray600 : tw.gray950 }]}>
                          {item.title}
                        </Text>
                        <Text style={styles.itemTime}>{item.createdAt ? dayjs(item.createdAt).format("hh:mm A") : ""}</Text>
                      </View>
                      <Text
                        numberOfLines={item.read ? 2 : undefined}
                        style={[styles.itemMsg, { color: item.read ? tw.gray500 : tw.gray700 }]}
                      >
                        {item.message}
                      </Text>
                    </View>
                  </View>
                </ScalePressable>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Bell size={28} color={tw.gray300} />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyBody}>System notifications for order requests and updates will appear here.</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.historyWrap}>
        <ScalePressable
          scaleTo={0.95}
          onPress={() => {
            onClose();
            router.push("/notifications");
          }}
          style={styles.historyBtn}
        >
          <Text style={styles.historyText}>View Notification History</Text>
        </ScalePressable>
      </View>
    </BottomPopup>
  );
}

const styles = StyleSheet.create({
  flexShrink: { flexShrink: 1 },
  emergencyList: { gap: 16, paddingVertical: 8 },
  emergencyRow: { flexDirection: "row", alignItems: "center", gap: 20, padding: 16, backgroundColor: tw.gray50, borderRadius: 16 },
  emergencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  emergencyTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  emergencySub: { fontSize: 12, fontWeight: "500", color: tw.gray500 },
  list: { gap: 12, paddingRight: 4 },
  clearRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 },
  clearBtn: { backgroundColor: p.red50, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  clearText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, color: p.red500 },
  items: { gap: 10 },
  item: { padding: 16, borderRadius: 16, borderWidth: 1 },
  itemRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  itemIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemBody: { flex: 1, minWidth: 0 },
  itemHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemTitle: { flexShrink: 1, fontSize: 14, fontWeight: "700" },
  itemTime: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", color: tw.gray400, paddingTop: 2 },
  itemMsg: { fontSize: 12, lineHeight: 19, marginTop: 2 },
  empty: { paddingVertical: 80, alignItems: "center", paddingHorizontal: 40 },
  emptyIcon: {
    width: 64,
    height: 64,
    backgroundColor: tw.gray50,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(243,244,246,0.5)",
  },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: tw.gray900, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 8 },
  emptyBody: { fontSize: 12, fontWeight: "700", color: tw.gray400, textTransform: "uppercase", letterSpacing: -0.3, textAlign: "center", lineHeight: 19 },
  historyWrap: { marginTop: 32, marginBottom: 8 },
  historyBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: tw.gray950,
    alignItems: "center",
    boxShadow: "0px 20px 25px -5px rgba(3,7,18,0.2)",
  },
  historyText: { color: "#ffffff", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2.4 },
});
