// Root: fonts, providers, the root Stack (auth screens + the protected (app) group), Android back,
// push wiring and the toaster.
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
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import BrandSplash from "../components/shell/BrandSplash";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "../components/ui/Toast";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { RestaurantGuardProvider } from "../context/RestaurantGuardContext";
import { RestaurantNotificationsProvider } from "../context/RestaurantNotificationsContext";
import {
  addNotificationTapListener,
  configureNotificationHandler,
  registerForPushNotifications,
  subscribePushTokenRefresh,
} from "../lib/push";
import { HardwareBackBinding } from "../navigation/back";
import { toNativePath } from "../navigation/links";
import { ThemeProvider, useTheme } from "../theme/ThemeContext";

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

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
      />
      <HardwareBackBinding />
      <PushBinding />
      <Toaster />
      <BrandSplash />
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
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <RestaurantGuardProvider>
              <RestaurantNotificationsProvider>
                <RootStack />
              </RestaurantNotificationsProvider>
            </RestaurantGuardProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
