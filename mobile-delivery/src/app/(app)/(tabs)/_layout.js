// HomeShell (DeliveryHomeV2): Feed (/), Pocket, Orders, Profile in the bottom nav, plus History, a
// shell tab without a nav item (opened from Profile). The order overlays and the verification /
// summary flow sit above the scenes and the bar, like the web's fixed layers.
import { Tabs } from "expo-router";
import { View } from "react-native";
import DeliveryTabBar from "../../../components/shell/DeliveryTabBar";
import ShellOverlays from "../../../components/shell/ShellOverlays";

export default function HomeShellLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <Tabs
        tabBar={(props) => <DeliveryTabBar {...props} />}
        backBehavior="firstRoute"
        screenOptions={{ headerShown: false, animation: "none", sceneStyle: { backgroundColor: "#ffffff" } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="pocket" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="history" options={{ href: null }} />
      </Tabs>
      <ShellOverlays />
    </View>
  );
}
