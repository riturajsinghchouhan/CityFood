// BottomNavOrders tabs: Orders (/), Inventory, Feedback, Explore. The bar floats over the scenes
// (web: fixed, with main padded by useShellBottomInset()). Tab switches are instant, as on web.
import { Tabs } from "expo-router";
import { OrdersTabBar } from "../../../components/shell/BottomNavOrders";
import { tw } from "../../../theme/tokens";

export default function OrdersTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <OrdersTabBar {...props} />}
      backBehavior="firstRoute"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: tw.gray100 } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="inventory" />
      <Tabs.Screen name="feedback" />
      <Tabs.Screen name="explore" />
    </Tabs>
  );
}
