"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "@/lib/supabase";

type AdminProfile = {
  role: string | null;
  is_active: boolean | null;
};

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorizedPathname, setAuthorizedPathname] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminAccess() {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (userError || !userData.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", userData.user.id)
        .maybeSingle<AdminProfile>();

      if (!isMounted) {
        return;
      }

      if (
        profileError ||
        !profile ||
        profile.role !== "admin" ||
        profile.is_active !== true
      ) {
        router.replace("/unauthorized");
        return;
      }

      setAuthorizedPathname(pathname);
    }

    void verifyAdminAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuthorizedPathname(null);
        router.replace("/login");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

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
