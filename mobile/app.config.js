module.exports = ({ config }) => ({
  ...config,
  name: "DeliverEaze Driver",
  slug: "delivereaze-driver",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "delivereaze",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
    bundleIdentifier: "com.quantumpathsolutions.delivereaze.driver",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "DeliverEaze Driver uses your location while you are actively completing an assigned route.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.quantumpathsolutions.delivereaze.driver",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#208AEF",
        android: {
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      },
    ],
    "expo-secure-store",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "DeliverEaze Driver uses your location while you are actively completing an assigned route.",
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "24444db3-c392-436d-b907-ab1925cf836e",
    },
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: "https://u.expo.dev/24444db3-c392-436d-b907-ab1925cf836e",
  },
});
