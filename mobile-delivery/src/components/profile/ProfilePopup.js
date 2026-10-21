// DeliveryV2/components/BottomPopup (the shared one ProfileDetailsV2 uses): white rounded-t-3xl sheet
// over bg-black/50, optional ChevronDown + bar handle, a header with a text-lg font-semibold title and
// a ChevronDown close button (px-4 pb-3 border-b gray-100, pt-5 without the handle), and scrollable
// content (px-3 py-3 at phone width). Backdrop tap, the close button and Android back close it.
// The web's swipe-down-to-close gesture on the top 80px is not reproduced.
import { ChevronDown } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { tw } from "../../theme/tokens";
import { BottomSheet } from "../ui/Sheet";
import Text from "../ui/Text";

export default function ProfilePopup({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  showHandle = true,
  maxHeight = "86%",
}) {
  return (
    <BottomSheet visible={isOpen} onClose={onClose} maxHeight={maxHeight} style={styles.sheet}>
      {showHandle ? (
        <View style={styles.handleWrap}>
          <ChevronDown size={24} color={tw.gray400} style={styles.handleIcon} />
          <View style={styles.handleBar} />
        </View>
      ) : null}
      {title || showCloseButton ? (
        <View style={[styles.header, !showHandle && styles.headerNoHandle]}>
          {title ? (
            <Text heading style={styles.title}>
              {title}
            </Text>
          ) : null}
          {showCloseButton ? (
            <Pressable onPress={onClose} style={styles.close} hitSlop={6} accessibilityLabel="Close">
              <ChevronDown size={24} color={tw.gray600} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: "#ffffff" },
  handleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 8 },
  handleIcon: { marginBottom: 4 },
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
  headerNoHandle: { paddingTop: 20 },
  title: { fontSize: 18, lineHeight: 28, fontWeight: "600", color: tw.gray900 },
  close: { marginLeft: "auto", padding: 8, borderRadius: 9999 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: 12, paddingVertical: 12 },
});
