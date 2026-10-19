const fs = require("fs");
const path = require("path");

// Push needs Firebase's google-services.json for com.cityfood.user. Until it is
// added (see CONVERSION_CHECKLIST.md), the app builds without FCM.
const googleServicesFile = fs.existsSync(path.join(__dirname, "google-services.json"))
  ? "./google-services.json"
  : undefined;

module.exports = {
  expo: {
    name: "CityFood",
    slug: "cityfood-user",
    scheme: "cityfood",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    android: {
      package: "com.cityfood.user",
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
        "android.permission.RECORD_AUDIO",
      ],
      blockedPermissions: ["android.permission.SYSTEM_ALERT_WINDOW"],
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
            "CityFood uses your location to show restaurants and deliver to your address.",
        },
      ],
      [
        "expo-image-picker",
        { photosPermission: "Allow CityFood to choose a profile photo.", cameraPermission: "Allow CityFood to take a profile photo." },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#7e3866",
          defaultChannel: "default",
          sounds: ["./assets/sounds/zomato_sms.mp3"],
        },
      ],
      [
        "expo-speech-recognition",
        { microphonePermission: "Allow CityFood to use the microphone for voice search." },
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
