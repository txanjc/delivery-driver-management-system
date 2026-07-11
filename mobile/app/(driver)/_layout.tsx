import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/components/shared/Screen";
import { useAuth } from "@/hooks/useAuth";
import { UnreadNotificationCountProvider } from "@/providers/UnreadNotificationCountProvider";

export default function DriverLayout() {
  const { driver, loading, session } = useAuth();

  if (loading) {
    return <LoadingState label="Loading driver workspace..." />;
  }

  if (!session || !driver) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <UnreadNotificationCountProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen name="delivery/[deliveryId]" options={{ title: "Delivery Details" }} />
        <Stack.Screen name="route/[routeId]" options={{ title: "Route Navigation" }} />
        <Stack.Screen name="proof-of-delivery/[deliveryId]" options={{ title: "Proof of Delivery" }} />
      </Stack>
    </UnreadNotificationCountProvider>
  );
}
