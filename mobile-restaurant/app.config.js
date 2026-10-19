const fs = require("fs");
const path = require("path");

// Push needs Firebase's google-services.json for com.cityfood.user. Until it is
// added (see CONVERSION_CHECKLIST.md), the app builds without FCM.
const googleServicesFile = fs.existsSync(path.join(__dirname, "google-services.json"))
  ? "./google-services.json"
  : undefined;

module.exports = {
  expo: {
    name: "CityFood Restaurant",
    slug: "cityfood-restaurant",
    scheme: "cityfood-restaurant",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    android: {
      package: "com.cityfood.restaurant",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        backgroundColor: "#ffffff",
      },
      googleServicesFile,
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.VIBRATE",
      ],
      blockedPermissions: ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.RECORD_AUDIO"],
    },
    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            // The SDK 58 template turns R8 on for release builds. R8 strips Room's generated
            // WorkDatabase_Impl (WorkManager, used by Firebase/expo-notifications) and the app
            // crashes at launch; Razorpay and other reflection-based SDKs need keep rules too.
            enableMinifyInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false,
          },
        },
      ],
      "expo-router",
      "expo-status-bar",
      "expo-secure-store",
      "expo-font",
      "expo-image",
      "expo-sharing",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      [
        "react-native-maps",
        { androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "CityFood Restaurant uses your location to set your outlet on the map.",
        },
      ],
      [
        "expo-image-picker",
        { photosPermission: "Allow CityFood Restaurant to choose photos for your menu and documents.", cameraPermission: "Allow CityFood Restaurant to take photos of your menu and documents." },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#B80B3D",
          defaultChannel: "default",
          sounds: ["./assets/sounds/restaurant_order_ring.wav"],
        },
      ],
      "@react-native-community/datetimepicker",
      ["expo-audio", { microphonePermission: false }],
      "expo-video",
    ],
    experiments: {
      typedRoutes: false,
    },
  },
};
