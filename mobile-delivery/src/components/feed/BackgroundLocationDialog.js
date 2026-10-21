// Native-only step (user decision A: location keeps running in the background while online). Before
// tracking starts, explain why "Allow all the time" is needed, then ask; "Not now" still goes online
// (updates then run only while the app is open). Android 11+ opens the app's location settings.
import { MapPin } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import Button from "../ui/Button";
import { Dialog } from "../ui/Sheet";
import Text from "../ui/Text";

export default function BackgroundLocationDialog({ visible, onAllow, onSkip }) {
  const { colors } = useTheme();
  return (
    <Dialog visible={visible} onClose={onSkip}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <MapPin size={24} color={colors.primary} />
      </View>
      <Text heading style={styles.title}>
        Allow location all the time
      </Text>
      <Text style={styles.body}>
        While you are online, CityFood Delivery shares your location so you keep getting nearby orders and customers
        can track their delivery, even when the app is in the background or the screen is off.
      </Text>
      <Text style={styles.body}>
        On the next screen, choose &quot;Allow all the time&quot;. You will see a &quot;You&apos;re online&quot;
        notification while location is shared, and it stops when you go offline.
      </Text>
      <View style={styles.row}>
        <Button variant="outline" onPress={onSkip}>
          Not now
        </Button>
        <Button onPress={onAllow}>Continue</Button>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 18, color: tw.gray900, marginBottom: 8 },
  body: { fontSize: 14, color: tw.gray600, lineHeight: 20, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 6 },
});
