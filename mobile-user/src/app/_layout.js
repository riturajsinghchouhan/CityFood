import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppIntroSplashHost } from "../components/shell/AppIntroSplash";
import LocationGuard from "../components/shell/LocationGuard";
import { SearchOverlayHost } from "../components/shell/SearchOverlay";
import { toast, Toaster } from "../components/ui/Toast";
import { AppProviders } from "../context/AppProviders";
import { useAuth } from "../context/AuthContext";
import { useUserNotifications } from "../context/UserNotificationContext";
import {
  addNotificationTapListener,
  configureNotificationHandler,
  registerForPushNotifications,
  subscribePushTokenRefresh,
} from "../lib/push";
import { HardwareBackBinding } from "../navigation/back";
import { toNativePath } from "../navigation/links";
import { useTheme } from "../theme/ThemeContext";

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

// Routes outside the web's UserLayout (no LocationGuard, no intro splash).
const OUTSIDE_USER_LAYOUT = new Set(["login", "support"]);
const OUTSIDE_USER_PATHS = new Set(["/login", "/support"]);

// Web UserLayout wraps every user route in LocationGuard.
function userLayout({ route, children }) {
  if (OUTSIDE_USER_LAYOUT.has(route.name)) return children;
  return <LocationGuard>{children}</LocationGuard>;
}

// useUserNotifications.js on web shows socket events as sonner toast.message();
// status and OTP toasts reuse a fixed id so a new one replaces the previous one.
const BANNER_TOAST_IDS = { order_status: "order-status-toast", drop_otp: "delivery-drop-otp-toast" };

function NotificationToastBinding() {
  const { banner } = useUserNotifications();
  useEffect(() => {
    if (!banner) return;
    const id = BANNER_TOAST_IDS[banner.kind];
    if (id) toast.dismiss(id);
    toast(banner.title, { id, description: banner.message, duration: banner.duration });
  }, [banner]);
  return null;
}

function PushBinding() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    return addNotificationTapListener((webPath) => {
      const path = toNativePath(webPath);
      if (path) router.push(path);
    });
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    registerForPushNotifications();
    return subscribePushTokenRefresh();
  }, [isAuthenticated]);
  return null;
}

function RootStack() {
  const { colors } = useTheme();
  const { ready } = useAuth();
  const pathname = usePathname();
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
        screenLayout={userLayout}
      />
      <HardwareBackBinding />
      <PushBinding />
      <NotificationToastBinding />
      <SearchOverlayHost />
      <AppIntroSplashHost enabled={!OUTSIDE_USER_PATHS.has(pathname)} />
      <Toaster />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <RootStack />
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
