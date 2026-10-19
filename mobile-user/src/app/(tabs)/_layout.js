// UserLayout shell for the bottom-nav screens (Home, Dining, Under250, Orders, Profile).
import { Tabs } from "expo-router";
import BottomNavigation from "../../components/shell/BottomNavigation";
import { useTheme } from "../../theme/ThemeContext";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <BottomNavigation {...props} />}
      backBehavior="firstRoute"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="under-250" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="dining" options={{ href: null }} />
    </Tabs>
  );
}
