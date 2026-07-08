import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/components/shared/Screen";
import { useAuth } from "@/hooks/useAuth";

export default function DriverLayout() {
  const { driver, loading, session } = useAuth();

  if (loading) {
    return <LoadingState label="Loading driver workspace..." />;
  }

  if (!session || !driver) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="delivery/[deliveryId]" options={{ title: "Delivery Details" }} />
      <Stack.Screen name="route/[routeId]" options={{ title: "Route Map" }} />
    </Stack>
  );
}
