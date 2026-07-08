import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/providers/AuthProvider";
import { colors } from "@/theme/shared";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(driver)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
