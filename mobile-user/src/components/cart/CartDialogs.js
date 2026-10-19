// GST breakdown dialog and the cart Share dialog (Cart.jsx portals).
import { Copy, Mail, MessageCircle, Send, Share2, X } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Dialog, Text } from "../ui";
import { radius, tw } from "../../theme/tokens";
import { RUPEE } from "../../screens/cart/cartUtils";
import { useCartPalette } from "./palette";

function GstRow({ label, value, p }) {
  return (
    <View style={styles.gstRow}>
      <Text style={[styles.gstText, { color: p.t800, flex: 1 }]}>{label}</Text>
      <Text style={[styles.gstText, { color: p.t900, fontWeight: "500" }]}>
        {RUPEE}
        {value.toFixed(2)}
      </Text>
    </View>
  );
}

export function GstDialog({ visible, onClose, companyName, itemGst, packagingGst, deliveryGst, platformGst, total }) {
  const p = useCartPalette();
  return (
    <Dialog visible={visible} onClose={onClose} style={[styles.gstDialog, { backgroundColor: p.card }]}>
      <View style={{ padding: 20 }}>
        <Text style={[styles.gstIntro, { color: p.t600 }]}>{companyName} has no role to play in taxes levied by the govt.</Text>
        <View style={{ gap: 12 }}>
          <GstRow label="GST on item total" value={itemGst} p={p} />
          {packagingGst > 0 ? <GstRow label="GST on restaurant packaging charges" value={packagingGst} p={p} /> : null}
          {deliveryGst > 0 ? <GstRow label="GST on delivery partner fee" value={deliveryGst} p={p} /> : null}
          {platformGst > 0 ? <GstRow label="GST on platform fee" value={platformGst} p={p} /> : null}
          <View style={[styles.gstRow, styles.gstTotal, { borderColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
            <Text style={[styles.gstTotalText, { color: p.white900 }]}>Total</Text>
            <Text style={[styles.gstTotalText, { color: p.white900 }]}>
              {RUPEE}
              {total.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
      <Pressable onPress={onClose} style={[styles.okay, { borderColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
        <Text style={[styles.okayText, { color: p.primary }]}>OKAY</Text>
      </Pressable>
    </Dialog>
  );
}

export function ShareDialog({ visible, onClose, onSystemShare, onTarget, onCopy }) {
  const p = useCartPalette();
  const items = [
    { key: "system", label: "Share via system apps", Icon: Share2, onPress: onSystemShare },
    { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle, onPress: () => onTarget("whatsapp") },
    { key: "telegram", label: "Telegram", Icon: Send, onPress: () => onTarget("telegram") },
    { key: "email", label: "Email", Icon: Mail, onPress: () => onTarget("email") },
    { key: "copy", label: "Copy link", Icon: Copy, onPress: onCopy },
  ];
  return (
    <Dialog visible={visible} onClose={onClose} style={[styles.shareDialog, { backgroundColor: p.card }]}>
      <View style={[styles.shareHeader, { borderColor: p.isDark ? tw.gray800 : tw.gray200 }]}>
        <Text numberOfLines={1} style={[styles.shareTitle, { color: p.white900 }]}>
          Share
        </Text>
        <Pressable accessibilityLabel="Close share modal" onPress={onClose} style={styles.shareClose}>
          <X size={16} color={p.isDark ? tw.gray300 : tw.gray600} />
        </Pressable>
      </View>
      <View style={styles.shareBody}>
        {items.map(({ key, label, Icon, onPress }) => (
          <Pressable
            key={key}
            onPress={onPress}
            style={({ pressed }) => [
              styles.shareItem,
              { borderColor: p.border },
              pressed && { backgroundColor: p.isDark ? tw.gray800 : tw.gray50 },
            ]}
          >
            <Icon size={20} color={p.isDark ? tw.gray300 : tw.gray700} />
            <Text style={[styles.shareLabel, { color: p.white900 }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  gstDialog: { padding: 0, maxWidth: 320, width: "90%", borderRadius: radius.xl, borderWidth: 0, overflow: "hidden" },
  gstIntro: { fontSize: 13, lineHeight: 21, marginBottom: 16 },
  gstRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  gstText: { fontSize: 13 },
  gstTotal: { paddingTop: 12, marginTop: 4, borderTopWidth: 1 },
  gstTotalText: { fontSize: 14, fontWeight: "700" },
  okay: { paddingVertical: 12, alignItems: "center", borderTopWidth: 1 },
  okayText: { fontSize: 14, fontWeight: "600" },
  shareDialog: { padding: 0, width: "92%", maxWidth: 448, borderRadius: radius["2xl"], borderWidth: 0 },
  shareHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  shareTitle: { fontSize: 18, fontWeight: "600" },
  shareClose: { padding: 4, borderRadius: 6 },
  shareBody: { paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
  shareItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  shareLabel: { fontSize: 14, fontWeight: "500" },
});
