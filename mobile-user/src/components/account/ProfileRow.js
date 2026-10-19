// Profile.jsx menu card: white rounded-xl shadow-sm card, round icon chip, label, right accessory, chevron.
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";

export function ProfileCard({ onPress, style, children, disabled }) {
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", opacity: pressed ? 0.9 : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function IconChip({ Icon, background, color }) {
  const { isDark } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: background || (isDark ? tw.gray800 : tw.gray100) }]}>
      <Icon size={20} color={color || (isDark ? tw.gray300 : tw.gray700)} />
    </View>
  );
}

export function Chevron({ color }) {
  const { isDark } = useTheme();
  return <ChevronRight size={20} color={color || (isDark ? tw.gray500 : tw.gray400)} />;
}

export function rowLabelColor(isDark) {
  return isDark ? "#ffffff" : tw.gray900;
}

/**
 * Standard row. `right` renders before the chevron; `subtitle` adds a truncated second line.
 */
export default function ProfileRow({
  Icon,
  iconBackground,
  iconColor,
  label,
  labelColor,
  subtitle,
  right,
  chevronColor,
  onPress,
  disabled,
}) {
  const { isDark } = useTheme();
  return (
    <ProfileCard onPress={onPress} disabled={disabled}>
      <View style={styles.row}>
        <View style={[styles.left, subtitle ? styles.shrink : null]}>
          <IconChip Icon={Icon} background={iconBackground} color={iconColor} />
          <View style={styles.shrink}>
            <Text style={[styles.label, { color: labelColor || rowLabelColor(isDark) }]}>{label}</Text>
            {subtitle ? (
              <Text numberOfLines={1} style={[styles.subtitle, { color: isDark ? tw.gray400 : tw.gray500 }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.right}>
          {right}
          <Chevron color={chevronColor} />
        </View>
      </View>
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 16, ...shadow.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  shrink: { flexShrink: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
  chip: { borderRadius: 999, padding: 8 },
  label: { fontSize: 16, fontWeight: "500" },
  subtitle: { fontSize: 12 },
});
