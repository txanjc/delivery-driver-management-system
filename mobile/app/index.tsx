import { Redirect } from "expo-router";

import { LoadingState } from "@/components/shared/Screen";
import { useAuth } from "@/hooks/useAuth";

export default function IndexRoute() {
  const { driver, loading, session } = useAuth();

  if (loading) {
    return <LoadingState label="Restoring session..." />;
  }

  if (session && driver) {
    return <Redirect href="/(driver)/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
