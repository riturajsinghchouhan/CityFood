// Port of the delivery module's components/BottomPopup.jsx as RatingsReviews uses it: a
// rounded-t-3xl sheet with the chevron + bar handle (tap toggles collapse), a header row with the
// chevron close button, and the content area. Swipe-down-to-close becomes the backdrop tap and
// Android back.
import { ChevronDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheet, Text } from "../ui";
import { tw } from "../../theme/tokens";

export default function BottomPopup({ isOpen, onClose, children, title, showCloseButton = true, showHandle = true }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!isOpen) setCollapsed(false);
  }, [isOpen]);

  return (
    <BottomSheet visible={isOpen} onClose={onClose} maxHeight="86%" style={styles.sheet}>
      {showHandle ? (
        <Pressable onPress={() => setCollapsed((v) => !v)} style={styles.handle}>
          <ChevronDown size={24} color={tw.gray400} style={{ marginBottom: 4 }} />
          <View style={styles.handleBar} />
        </Pressable>
      ) : null}
      {title || showCloseButton ? (
        <View style={[styles.header, !showHandle && { paddingTop: 20 }]}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {showCloseButton ? (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && { backgroundColor: tw.gray100 }]}
              accessibilityLabel="Close"
            >
              <ChevronDown size={24} color={tw.gray600} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!collapsed ? <View style={styles.content}>{children}</View> : <View style={styles.collapsed} />}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "#ffffff" },
  handle: { alignItems: "center", paddingTop: 12, paddingBottom: 8 },
  handleBar: { width: 48, height: 6, borderRadius: 9999, backgroundColor: tw.gray300 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
  },
  title: { fontSize: 18, fontWeight: "600", color: tw.gray900 },
  closeBtn: { marginLeft: "auto", padding: 8, borderRadius: 9999 },
  content: { paddingHorizontal: 12, paddingVertical: 12 },
  collapsed: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20 },
});
