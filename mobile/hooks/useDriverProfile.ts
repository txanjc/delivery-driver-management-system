import { useAuth } from "@/hooks/useAuth";

export function useDriverProfile() {
  const { profile, driver, loading, refreshProfile } = useAuth();

  return {
    profile,
    driver,
    loading,
    refreshProfile,
  };
}
