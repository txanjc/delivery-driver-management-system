"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "@/lib/supabase";

type AdminProfile = {
  role: string | null;
  is_active: boolean | null;
};

type SupabaseSingleResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

const adminVerificationTimeoutMs = 5000;

function redirectToLogin() {
  window.location.replace("/login");
}

function redirectToUnauthorized() {
  window.location.replace("/unauthorized");
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("Admin verification timed out."));
      }, timeoutMs);
    }),
  ]);
}

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authorizedPathname, setAuthorizedPathname] = useState<string | null>(
    null,
  );

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
              .select("role, is_active")
              .eq("profile_id", userData.user.id)
              .maybeSingle<AdminProfile>(),
          ),
          adminVerificationTimeoutMs,
        );
        const { data: profile, error: profileError } = profileResponse;

        if (!isMounted) {
          return;
        }

        if (
          profileError ||
          !profile ||
          profile.role !== "admin" ||
          profile.is_active !== true
        ) {
          redirectToUnauthorized();
          return;
        }

        setAuthorizedPathname(pathname);
      } catch (error) {
        console.error("Unable to verify admin access:", error);
        redirectToLogin();
      }
    }

    void verifyAdminAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuthorizedPathname(null);
        redirectToLogin();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [pathname]);

  if (authorizedPathname !== pathname) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111111] px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="mt-4 text-sm text-zinc-400">Verifying admin access...</p>
        </div>
      </main>
    );
  }

  return children;
}
