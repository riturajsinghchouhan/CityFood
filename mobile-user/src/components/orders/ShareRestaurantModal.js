// "Share restaurant" fallback sheet from Orders.jsx (shown when the system share sheet fails).
import * as Clipboard from "expo-clipboard";
import { Copy, Link2, Mail, MessageCircle, MessagesSquare, Send, Share2, X } from "lucide-react-native";
import { Linking, Modal, Pressable, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";
import { Text, toast } from "../ui";

function buildShareLink(target, payload) {
  const text = payload.text || "";
  const url = payload.url;
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  switch (target) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    case "telegram":
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent(payload.title || "Check this out")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
    case "sms":
      return `sms:?body=${encodeURIComponent(`${text} ${url}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "x":
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} ${url}`)}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    default:
      return "";
  }
}

// navigator.share replacement; resolves true when the sheet opened.
export async function systemShare(payload) {
  try {
    await Share.share({ title: payload.title, message: [payload.text, payload.url].filter(Boolean).join("\n") });
    return true;
  } catch {
    return false;
  }
}

export default function ShareRestaurantModal({ visible, payload, onClose }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  if (!visible || !payload) return null;

  const openTarget = (target) => {
    if (!payload?.url) return;
    const link = buildShareLink(target, payload);
    if (link) {
      Linking.openURL(link).catch(() => {});
      onClose();
    }
  };

  const copyLink = async () => {
    if (!payload?.url) return;
    try {
      await Clipboard.setStringAsync(payload.url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
    onClose();
  };

  const shareViaApps = async () => {
    const shared = await systemShare(payload);
    if (shared) {
      onClose();
      toast.success("Shared successfully");
    }
  };

  const border = isDark ? "#1f2937" : "#e5e7eb";
  const labelColor = isDark ? "#e5e7eb" : "#374151";
  const targets = [
    { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle, color: "#16a34a" },
    { key: "telegram", label: "Telegram", Icon: Send, color: "#0ea5e9" },
    { key: "email", label: "Email", Icon: Mail, color: "#f43f5e" },
    { key: "sms", label: "SMS", Icon: MessagesSquare, color: "#8b5cf6" },
    { key: "facebook", label: "Facebook", Icon: Share2, color: "#2563eb" },
    { key: "x", label: "X", Icon: Link2, color: isDark ? "#f3f4f6" : "#111827" },
    { key: "linkedin", label: "LinkedIn", Icon: Share2, color: "#1d4ed8" },
  ].map((t) => ({ ...t, onPress: () => openTarget(t.key) }));
  targets.push({ key: "copy", label: "Copy link", Icon: Copy, color: isDark ? "#9ca3af" : "#4b5563", onPress: copyLink });
  // grid-cols-3
  const rows = [];
  for (let i = 0; i < targets.length; i += 3) {
    const row = targets.slice(i, i + 3);
    while (row.length < 3) row.push(null);
    rows.push(row);
  }

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: 16 + insets.bottom }]}>
        <View style={[styles.card, { backgroundColor: isDark ? "#121212" : "#ffffff", borderColor: isDark ? "#1f2937" : "transparent" }]}>
          <View style={[styles.head, { borderBottomColor: isDark ? "#1f2937" : "#f3f4f6" }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: isDark ? "#f3f4f6" : "#111827" }}>Share restaurant</Text>
              <Text style={{ fontSize: 12, marginTop: 2, color: isDark ? "#9ca3af" : "#6b7280" }}>
                Choose an app to share this restaurant
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close share modal" hitSlop={8} style={styles.close}>
              <X size={16} color="#6b7280" />
            </Pressable>
          </View>
          <View style={styles.body}>
            <Pressable onPress={shareViaApps} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
              <Share2 size={16} color="#ffffff" />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ffffff" }}>Share via apps</Text>
            </Pressable>
            {rows.map((row, i) => (
              <View key={i} style={styles.row}>
                {row.map((t, j) =>
                  t ? (
                    <Pressable key={t.key} onPress={t.onPress} style={[styles.tile, { borderColor: border }]}>
                      <t.Icon size={20} color={t.color} />
                      <Text style={[styles.tileLabel, { color: labelColor }]}>{t.label}</Text>
                    </Pressable>
                  ) : (
                    <View key={`empty-${j}`} style={styles.tileSpacer} />
                  ),
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  card: { width: "100%", maxWidth: 384, borderRadius: 24, overflow: "hidden", borderWidth: 1, ...shadow["2xl"] },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  close: { borderRadius: 999, padding: 8 },
  body: { paddingHorizontal: 20, paddingVertical: 20, gap: 12 },
  primaryBtn: {
    width: "100%",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  row: { flexDirection: "row", gap: 12 },
  tileSpacer: { flex: 1 },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  tileLabel: { fontSize: 12, fontWeight: "500" },
});
