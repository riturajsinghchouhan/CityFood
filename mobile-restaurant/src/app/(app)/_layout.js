// Protected area: ProtectedRoute requiredRole="restaurant" -> RestaurantBlockGuard ->
// RestaurantLayout (navbar, drawer, bottom nav, new-order popup) around a Stack of every protected
// screen. The four bottom-nav screens live in the (tabs) group; the rest are stack screens here.
// GlobalPickupOtpModal is mounted outside the guard, as the web's RestaurantRouter does.
import { Redirect, Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import GlobalPickupOtpModal from "../../components/shell/GlobalPickupOtpModal";
import { clearShellLogout, shellLogoutTarget } from "../../components/shell/logout";
import RestaurantBlockGuard from "../../components/shell/RestaurantBlockGuard";
import RestaurantLayout from "../../components/shell/RestaurantLayout";
import { useAuth } from "../../context/AuthContext";
import { tw } from "../../theme/tokens";

// A deep link straight into a stack screen still gets the tabs underneath it.
export const unstable_settings = { initialRouteName: "(tabs)" };

export default function ProtectedLayout() {
  const { ready, isAuthenticated } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isAuthenticated) clearShellLogout();
  }, [isAuthenticated]);

  // The splash screen stays up until auth is ready (root layout).
  if (!ready) return null;
  if (!isAuthenticated) {
    // Deliberate logout -> its target; otherwise ProtectedRoute's redirect with state.from.
    const target = shellLogoutTarget();
    return <Redirect href={target || { pathname: "/login", params: { from: pathname } }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <RestaurantBlockGuard>
        <RestaurantLayout>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: tw.gray100 },
            }}
          >
            <Stack.Screen name="(tabs)" />
          </Stack>
        </RestaurantLayout>
      </RestaurantBlockGuard>
      <GlobalPickupOtpModal />
    </View>
  );
}
