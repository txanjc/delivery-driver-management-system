import { Redirect, Stack } from "expo-router";

import { SessionRestoreScreen } from "@/components/auth/SessionRestoreScreen";
import { useAuth } from "@/hooks/useAuth";

export default function AuthLayout() {
  const { driver, loading, session } = useAuth();

  // Hold the auth stack until session restoration completes so Splash is never
  // shown during a returning driver's authenticated launch.
  if (loading) {
    return <SessionRestoreScreen />;
  }

  if (session && driver) {
    return <Redirect href="/(driver)/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: "#26065A" }, headerShown: false }}>
      <Stack.Screen name="splash" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
