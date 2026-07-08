"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  Skeleton,
  SkeletonButton,
  SkeletonKpiGrid,
  SkeletonPageHeader,
} from "@/components/ui/Skeleton";
import { supabase } from "@/lib/supabase";
import { isAdministrator } from "@/lib/roles";
import { RoutesGuardLoadingState } from "../routes/routes-loading-state";

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
  const pathname = usePathname();
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
    if (pathname === "/admin/routes") {
      return <RoutesGuardLoadingState />;
    }

    return <AdminShellLoadingSkeleton />;
  }

  return children;
}

function AdminShellLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-slate-100 text-[#17232b]">
      <div aria-busy="true" aria-live="polite" className="flex min-h-screen">
        <span className="sr-only">Loading your workspace</span>
        <aside className="hidden w-20 shrink-0 border-r border-slate-200 bg-white px-3 py-5 shadow-xl shadow-slate-900/5 lg:block">
          <Skeleton className="mx-auto h-10 w-10" rounded="rounded-xl" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton className="mx-auto h-12 w-12" key={index} rounded="rounded-xl" />
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-xl lg:px-8">
            <div className="flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_minmax(18rem,24rem)_1fr]">
              <div className="hidden items-center gap-2 lg:flex">
                <SkeletonButton className="w-32" />
                <SkeletonButton className="w-36" />
              </div>
              <Skeleton className="hidden h-10 w-full lg:block" rounded="rounded-full" />
              <div className="flex items-center justify-end gap-3">
                <Skeleton className="h-10 w-10" rounded="rounded-full" />
                <Skeleton className="h-10 w-36" rounded="rounded-full" />
              </div>
            </div>
          </header>
          <section className="space-y-4 px-5 py-6 lg:px-8">
            <SkeletonPageHeader />
            <SkeletonKpiGrid />
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Skeleton className="h-64 w-full" rounded="rounded-[18px]" />
              <Skeleton className="h-64 w-full" rounded="rounded-[18px]" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
