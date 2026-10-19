// Food ui/dialog.tsx look: centered card, rounded-2xl, shadow-2xl, top-right X close button,
// header centered at phone width (sm:text-left only applies from 640px).
import { X } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Dialog, Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";

export function DialogCloseButton({ onPress, color, disabled, style }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.close, { opacity: disabled ? 0.5 : 0.7 }, style]}
    >
      <X size={20} color={color || colors.text} />
    </Pressable>
  );
}

/**
 * visible / onClose: open state. maxWidth defaults to max-w-sm (384).
 * showCloseButton mirrors DialogContent's prop (true by default).
 */
export default function AccountDialog({
  visible,
  onClose,
  children,
  style,
  maxWidth = 384,
  showCloseButton = true,
  dismissable = true,
  closeColor,
}) {
  const { colors } = useTheme();
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      dismissable={dismissable}
      style={[
        styles.dialog,
        { maxWidth, backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
      {showCloseButton ? <DialogCloseButton onPress={onClose} color={closeColor} /> : null}
    </Dialog>
  );
}

// DialogHeader className="p-5 pb-3" with DialogTitle (text-lg font-bold) and DialogDescription (text-sm).
export function DialogHeaderBlock({ title, description, titleColor, descriptionColor, style }) {
  return (
    <View style={[styles.header, style]}>
      <Text style={[styles.title, { color: titleColor || tw.gray900 }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: descriptionColor || tw.gray500 }]}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: {
    padding: 0,
    borderRadius: 16,
    overflow: "hidden",
    ...shadow["2xl"],
  },
  close: {
    position: "absolute",
    right: 16,
    top: 16,
    padding: 8,
    borderRadius: 999,
  },
  header: { padding: 20, paddingBottom: 12, gap: 8, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center", lineHeight: 22 },
  description: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
