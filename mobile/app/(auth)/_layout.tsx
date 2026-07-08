import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/components/shared/Screen";
import { useAuth } from "@/hooks/useAuth";

export default function AuthLayout() {
  const { driver, loading, session } = useAuth();

  if (loading) {
    return <LoadingState label="Checking access..." />;
  }

  if (session && driver) {
    return <Redirect href="/(driver)/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
