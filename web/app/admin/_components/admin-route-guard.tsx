"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppInitializingLoader } from "@/components/ui/AppInitializingLoader";
import { supabase } from "@/lib/supabase";
import { isAdministrator } from "@/lib/roles";
import { getVerifiedTotpFactors } from "@/lib/mfa";

type AdminProfile = {
  role: string | null;
  is_active: boolean | null;
  must_change_password: boolean | null;
};

type SupabaseSingleResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type VerificationState = "checking" | "authorized";

const adminVerificationTimeoutMs = 5000;

function redirectToLogin() {
  window.location.replace("/login");
}

function redirectToUnauthorized() {
  window.location.replace("/unauthorized");
}

function redirectToChangePassword() {
  window.location.replace("/change-password");
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("Administrator verification timed out."));
      }, timeoutMs);
    }),
  ]);
}

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const [verificationState, setVerificationState] =
    useState<VerificationState>("checking");

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminAccess() {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (sessionError || !sessionData.session) {
          redirectToLogin();
          return;
        }

        const { data: userData, error: userError } = await withTimeout(
          supabase.auth.getUser(),
          adminVerificationTimeoutMs,
        );

        if (!isMounted) {
          return;
        }

        if (userError || !userData.user) {
          redirectToLogin();
          return;
        }

        const profileResponse = await withTimeout<
          SupabaseSingleResponse<AdminProfile>
        >(
          Promise.resolve(
            supabase
              .from("profiles")
              .select("role, is_active, must_change_password")
              .eq("profile_id", userData.user.id)
              .maybeSingle<AdminProfile>(),
          ),
          adminVerificationTimeoutMs,
        );
        const { data: profile, error: profileError } = profileResponse;

        if (!isMounted) {
          return;
        }

        if (profileError || !profile) {
          redirectToUnauthorized();
          return;
        }

        if (profile.must_change_password === true) {
          redirectToChangePassword();
          return;
        }

        if (!isAdministrator(profile.role) || profile.is_active !== true) {
          redirectToUnauthorized();
          return;
        }

        const [factorResult, assuranceResult] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        if (!isMounted) return;
        const verifiedFactors = factorResult.error ? [] : getVerifiedTotpFactors(factorResult.data);
        if (verifiedFactors.length && assuranceResult.data?.currentLevel === "aal1" && assuranceResult.data.nextLevel === "aal2") {
          const returnTo = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/verify-mfa?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        setVerificationState("authorized");
      } catch (error) {
        console.error("Unable to verify Administrator access:", error);
        redirectToLogin();
      }
    }

    void verifyAdminAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setVerificationState("checking");
        redirectToLogin();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (verificationState === "checking") {
    return <AppInitializingLoader />;
  }

  return children;
}
