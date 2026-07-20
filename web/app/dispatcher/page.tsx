"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getVerifiedTotpFactors } from "@/lib/mfa";
import { supabase } from "@/lib/supabase";
import { AppInitializingLoader } from "@/components/ui/AppInitializingLoader";

export default function DispatcherPage() {
  const router = useRouter(); const [ready, setReady] = useState(false);
  useEffect(() => { let active = true; async function check() { const { data: session } = await supabase.auth.getSession(); if (!session.session) { router.replace("/login"); return; } const [factors, assurance] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]); if (!active) return; if (!factors.error && getVerifiedTotpFactors(factors.data).length && assurance.data?.currentLevel === "aal1" && assurance.data.nextLevel === "aal2") { router.replace("/verify-mfa?returnTo=%2Fdispatcher"); return; } setReady(true); } void check(); return () => { active = false; }; }, [router]);
  if (!ready) return <AppInitializingLoader />;
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12"><h1 className="text-2xl font-semibold text-slate-950">Dispatcher Dashboard</h1></main>;
}
