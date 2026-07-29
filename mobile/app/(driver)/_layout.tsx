import { Redirect, Stack } from "expo-router";
import { useColorScheme } from "react-native";

import { SessionRestoreScreen } from "@/components/auth/SessionRestoreScreen";
import { useAuth } from "@/hooks/useAuth";
import { UnreadNotificationCountProvider } from "@/providers/UnreadNotificationCountProvider";

export default function DriverLayout() {
  const { driver, loading, session } = useAuth();
  const colorScheme = useColorScheme();
  const sheetBackground = colorScheme === "dark" ? "#1C1C1E" : "#FFFFFF";

  if (loading) {
    return <SessionRestoreScreen />;
  }

  if (!session || !driver) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <UnreadNotificationCountProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="mfa-setup" options={{ contentStyle: { backgroundColor: sheetBackground }, headerShown: false, presentation: "formSheet", sheetAllowedDetents: "fitToContents", sheetCornerRadius: 32, sheetExpandsWhenScrolledToEdge: false, sheetGrabberVisible: false, sheetInitialDetentIndex: 0 }} />
        <Stack.Screen name="delivery/[deliveryId]" options={{ title: "Delivery Details" }} />
        <Stack.Screen name="route/[routeId]" options={{ title: "Route Navigation" }} />
        <Stack.Screen name="status-update/[deliveryId]" options={{ contentStyle: { backgroundColor: sheetBackground }, headerShown: false, presentation: "formSheet", sheetAllowedDetents: [0.5], sheetCornerRadius: 32, sheetExpandsWhenScrolledToEdge: false, sheetGrabberVisible: false, sheetInitialDetentIndex: 0 }} />
        <Stack.Screen name="proof-of-delivery/[deliveryId]" options={{ headerShown: false }} />
      </Stack>
    </UnreadNotificationCountProvider>
  );
}
