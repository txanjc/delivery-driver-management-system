import { Redirect } from "expo-router";

import { SessionRestoreScreen } from "@/components/auth/SessionRestoreScreen";
import { useAuth } from "@/hooks/useAuth";

export default function IndexRoute() {
  const { driver, loading, session } = useAuth();

  // Do not route to Splash while the persisted Supabase session is restoring.
  // This prevents a returning signed-in driver from briefly seeing onboarding.
  if (loading) {
    return <SessionRestoreScreen />;
  }

  if (session && driver) {
    return <Redirect href="/(driver)/(tabs)" />;
  }

  return <Redirect href="/(auth)/splash" />;
}
