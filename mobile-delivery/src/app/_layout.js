// Root (docs/API_MAP.md §3): background tasks first, fonts, providers, the root Stack (auth/public
// screens + the protected (app) group), Android back, push wiring and the toaster.
import "../lib/locationTask"; // FIRST: defines the background location task at module top level
// lib/push defines the background-push task at module top level (imported second, right here).
import {
  addNotificationTapListener,
  configureNotificationHandler,
  registerForPushNotifications,
  subscribePushTokenRefresh,
} from "../lib/push";
import {
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
} from "@expo-google-fonts/nunito-sans";
import { Sora_600SemiBold, Sora_700Bold, useFonts } from "@expo-google-fonts/sora";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "../components/ui/Toast";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { DeliveryProvider } from "../context/DeliveryContext";
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
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
    Sora_600SemiBold,
    Sora_700Bold,
  });
  // The splash stays up until the fonts load (RootStack is not mounted before) and auth is ready.
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <DeliveryProvider>
              <RootStack />
            </DeliveryProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
