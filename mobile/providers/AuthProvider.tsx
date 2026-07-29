import type { PropsWithChildren } from "react";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { signInDriver, signOutDriver } from "@/services/auth.service";
import { getDriverForProfile, getProfileForUser } from "@/services/driver.service";
import { supabase } from "@/lib/supabase";
import type { AuthState } from "@/types/auth";
import type { Driver, Profile } from "@/types/driver";

export const AuthContext = createContext<AuthState | undefined>(undefined);

const SESSION_RESTORE_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), SESSION_RESTORE_TIMEOUT_MS);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

async function loadAuthorizedDriver(userId: string) {
  const profileResponse = await getProfileForUser(userId);

  if (profileResponse.error) {
    throw new Error(profileResponse.error.message);
  }

  const profile = profileResponse.data;

  if (!profile) {
    throw new Error("Your mobile profile was not found.");
  }

  if (profile.is_active !== true) {
    throw new Error("Your account is inactive. Contact dispatch for access.");
  }

  if (profile.role !== "driver") {
    throw new Error("Only active Driver accounts can use the mobile app.");
  }

  const driverResponse = await getDriverForProfile(profile.profile_id);

  if (driverResponse.error) {
    throw new Error(driverResponse.error.message);
  }

  if (!driverResponse.data) {
    throw new Error("Your driver record was not found.");
  }

  return { profile, driver: driverResponse.data };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearDriverState = useCallback(() => {
    setProfile(null);
    setDriver(null);
    setMfaRequired(false);
    setMfaFactorId(null);
  }, []);

  const refreshProfileForSession = useCallback(
    async (currentSession: Session | null) => {
      if (!currentSession) {
        setSession(null);
        setUser(null);
        clearDriverState();
        return { requiresMfa: false };
      }

      setSession(currentSession);
      setUser(currentSession.user);

      try {
        const factorsResponse = await supabase.auth.mfa.listFactors();
        if (factorsResponse.error) {
          throw new Error(factorsResponse.error.message);
        }

        const verifiedTotpFactor = factorsResponse.data.totp.find(
          (factor) => factor.status === "verified",
        );

        if (verifiedTotpFactor) {
          const assuranceResponse =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

          if (assuranceResponse.error) {
            throw new Error(assuranceResponse.error.message);
          }

          if (assuranceResponse.data.currentLevel !== "aal2") {
            clearDriverState();
            setMfaFactorId(verifiedTotpFactor.id);
            setMfaRequired(true);
            setError(null);
            setSession(currentSession);
            setUser(currentSession.user);
            return { requiresMfa: true };
          }
        }

        const authorized = await loadAuthorizedDriver(currentSession.user.id);
        setProfile(authorized.profile);
        setDriver(authorized.driver);
        // Keep the MFA screen mounted until the driver record is ready. Clearing
        // this earlier briefly rendered the sign-in form before dashboard routing.
        setMfaRequired(false);
        setMfaFactorId(null);
        setError(null);
        return { requiresMfa: false };
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unable to authorize this mobile user.";
        setError(message);
        clearDriverState();
        await signOutDriver();
        return { requiresMfa: false };
      }
    },
    [clearDriverState],
  );

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        "Session restoration timed out.",
      );

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      await refreshProfileForSession(data.session);
    } finally {
      setLoading(false);
    }
  }, [refreshProfileForSession]);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const { data, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          "Session restoration timed out.",
        );

        if (!mounted) return;

        if (sessionError) {
          setError(sessionError.message);
          setLoading(false);
          return;
        }

        await refreshProfileForSession(data.session);
      } catch (caught) {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : "Unable to restore session.");
          setSession(null);
          setUser(null);
          clearDriverState();
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void restoreSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void refreshProfileForSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshProfileForSession]);

  useEffect(() => {
    if (!profile?.profile_id) return;

    const channel = supabase
      .channel(`driver-score:${profile.profile_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers", filter: `user_id=eq.${profile.profile_id}` },
        () => {
          void getDriverForProfile(profile.profile_id).then((response) => {
            if (!response.error && response.data) setDriver(response.data);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.profile_id]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    const response = await signInDriver(email.trim(), password);

    if (response.error) {
      setLoading(false);
      throw new Error(response.error.message);
    }

    const result = await refreshProfileForSession(response.data.session);
    setLoading(false);
    return result;
  }, [refreshProfileForSession]);

  const verifyMfa = useCallback(async (code: string) => {
    if (!mfaFactorId) {
      throw new Error("Your MFA challenge has expired. Sign in again.");
    }

    setLoading(true);
    setError(null);

    try {
      const response = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: code.trim(),
      });

      if (response.error) {
        throw new Error("That verification code didn’t work. Try again.");
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        throw new Error("We couldn’t finish signing you in. Please try again.");
      }

      await refreshProfileForSession(data.session);
    } finally {
      setLoading(false);
    }
  }, [mfaFactorId, refreshProfileForSession]);

  const signOut = useCallback(async () => {
    setLoading(true);
    await signOutDriver();
    setSession(null);
    setUser(null);
    clearDriverState();
    setLoading(false);
  }, [clearDriverState]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user,
      profile,
      driver,
      loading,
      mfaRequired,
      error,
      signIn,
      signOut,
      verifyMfa,
      refreshProfile,
    }),
    [driver, error, loading, mfaRequired, profile, refreshProfile, session, signIn, signOut, user, verifyMfa],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
