// Small pieces shared by the trip sheets.
import { CheckCircle2, ChevronDown } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { ScalePressable } from "../ui/primitives";
import Text from "../ui/Text";
import { p } from "./palette";

// Handle / minimise: ChevronDown w-6 text-gray-400 stroke-3 in a p-1 round button.
export function MinimizeHandle({ onPress, style }) {
  return (
    <View style={[styles.handleRow, style]}>
      <Pressable onPress={onPress} hitSlop={10} style={styles.handleBtn} accessibilityLabel="Minimise">
        <ChevronDown size={24} color={tw.gray400} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

// "Mark as Delivered": border-emerald-300 bg-emerald-50 (soft) text-emerald-800, icon emerald-600 (primary).
export function MarkDeliveredButton({ onPress }) {
  const { colors } = useTheme();
  return (
    <ScalePressable
      scaleTo={0.95}
      onPress={onPress}
      style={[styles.markBtn, { backgroundColor: colors.primarySoft }]}
    >
      <CheckCircle2 size={16} color={colors.primary} />
      <Text style={styles.markText}>Mark as Delivered</Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  handleRow: { width: "100%", alignItems: "center" },
  handleBtn: { padding: 4, borderRadius: 9999 },
  markBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.emerald300,
    boxShadow: "0px 1px 1px rgba(0,0,0,0.05)",
  },
  markText: {
    color: p.emerald800,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 12 * 0.05,
  },
});
