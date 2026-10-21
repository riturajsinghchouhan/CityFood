// ProfileDetailsV2's fullscreen document viewer (fixed inset-0 bg-black/95, fade in/out): the
// document name, a close button and the image (object-contain, rounded-3xl).
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveMediaUrl } from "../ui/AppImage";
import Text from "../ui/Text";

export default function DocumentViewer({ document, visible, onClose }) {
  const insets = useSafeAreaInsets();
  const open = Boolean(visible && document);
  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={1}>
            {document?.name}
          </Text>
          <Pressable onPress={onClose} style={styles.close} hitSlop={6} accessibilityLabel="Close">
            <X size={24} color="#ffffff" />
          </Pressable>
        </View>
        <View style={styles.body}>
          {document?.url ? (
            <Image
              source={{ uri: resolveMediaUrl(document.url) }}
              style={styles.image}
              contentFit="contain"
              transition={150}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", paddingHorizontal: 24, alignItems: "center" },
  head: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 40 },
  title: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  close: { backgroundColor: "rgba(255,255,255,0.1)", padding: 12, borderRadius: 16 },
  body: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%", borderRadius: 24 },
});
