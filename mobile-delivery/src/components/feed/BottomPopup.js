// DeliveryHomeV2's minimal BottomPopup (fixed bottom sheet, bg-black/40, rounded-t-3xl, p-6) with a
// font-black uppercase title and a round close button. The web's close icon is an AlertTriangle
// (copied as is). Android back closes it.
import { AlertTriangle } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { tw } from "../../theme/tokens";
import { BottomSheet } from "../ui/Sheet";
import Text from "../ui/Text";

export default function BottomPopup({ isOpen, onClose, title, children }) {
  return (
    <BottomSheet visible={isOpen} onClose={onClose} style={styles.sheet}>
      <View style={styles.inner}>
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} style={styles.close} hitSlop={6} accessibilityLabel="Close">
            <AlertTriangle size={16} color={tw.gray500} />
          </Pressable>
        </View>
        {children}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: "#ffffff" },
  inner: { padding: 24 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  title: { fontSize: 20, fontWeight: "900", color: tw.gray900, textTransform: "uppercase", letterSpacing: -0.5 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: tw.gray100, alignItems: "center", justifyContent: "center" },
});
