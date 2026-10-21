// Protected area = DeliveryV2 ProtectedRoute: isModuleAuthenticated("delivery") only (no approval,
// onboarding or online-status guard); otherwise /login with `from`. The HomeShell tabs live in the
// (tabs) group; every other protected page (notifications, profile/*, help/*, pocket/*) is a stack
// screen of this group, so screens here need no withProtected().
import { Redirect, Stack, usePathname } from "expo-router";
import { useTheme } from "../../theme/ThemeContext";
import { useAuth } from "../../context/AuthContext";

// A deep link straight into a stack screen still gets the shell underneath it.
export const unstable_settings = { initialRouteName: "(tabs)" };

export default function ProtectedLayout() {
  const { ready, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const pathname = usePathname();

  // The splash screen stays up until auth is ready (root layout).
  if (!ready) return null;
  if (!isAuthenticated) {
    return <Redirect href={{ pathname: "/login", params: { from: pathname } }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
