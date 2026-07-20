"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  getRoleDashboardPath,
  getVerifiedTotpFactors,
  sanitizeInternalReturnPath,
  type VerifiedTotpFactor,
} from "@/lib/mfa";
import type { WebUserRole } from "@/lib/role-redirect";
import { supabase } from "@/lib/supabase";

type Profile = { role: WebUserRole; is_active: boolean | null };

function VerifyMfaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [factors, setFactors] = useState<VerifiedTotpFactor[]>([]);
  const [selected, setSelected] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [role, setRole] = useState<WebUserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const code = digits.join("");
  const destination = role
    ? sanitizeInternalReturnPath(searchParams.get("returnTo"), getRoleDashboardPath(role))
    : "/login";

  function focusInput(index: number) {
    window.requestAnimationFrame(() => inputRefs.current[index]?.focus());
  }

  function applyDigits(value: string, startIndex = 0) {
    const incoming = value.replace(/\D/g, "");
    if (!incoming) return;
    const firstIndex = incoming.length >= 6 ? 0 : startIndex;
    const values = incoming.slice(0, 6 - firstIndex).split("");
    setDigits((current) => {
      const next = [...current];
      values.forEach((digit, offset) => {
        next[firstIndex + offset] = digit;
      });
      return next;
    });
    focusInput(Math.min(firstIndex + values.length, 5));
  }

  function handleDigitChange(index: number, value: string) {
    const numericValue = value.replace(/\D/g, "");
    if (value && !numericValue) return;
    if (numericValue.length > 1) {
      applyDigits(numericValue, index);
      return;
    }
    setDigits((current) => {
      const next = [...current];
      next[index] = numericValue;
      return next;
    });
    if (numericValue && index < 5) focusInput(index + 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Backspace") return;
    event.preventDefault();
    if (digits[index]) {
      setDigits((current) => {
        const next = [...current];
        next[index] = "";
        return next;
      });
      return;
    }
    if (index > 0) {
      setDigits((current) => {
        const next = [...current];
        next[index - 1] = "";
        return next;
      });
      focusInput(index - 1);
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.replace("/login");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("profile_id", userData.user.id)
        .maybeSingle<Profile>();
      if (
        !profile ||
        profile.is_active !== true ||
        (profile.role !== "admin" &&
          profile.role !== "administrator" &&
          profile.role !== "dispatcher")
      ) {
        router.replace("/login");
        return;
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factorData, error: factorError } =
        await supabase.auth.mfa.listFactors();
      if (!active) return;

      setRole(profile.role);
      if (aal?.currentLevel === "aal2") {
        router.replace(
          sanitizeInternalReturnPath(
            searchParams.get("returnTo"),
            getRoleDashboardPath(profile.role),
          ),
        );
        return;
      }

      const verified = factorError ? [] : getVerifiedTotpFactors(factorData);
      if (!verified.length || aal?.nextLevel !== "aal2") {
        setError("No verified authenticator is available for this session.");
      } else {
        setFactors(verified);
        setSelected(verified[0].id);
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  async function verify() {
    if (!selected || !/^\d{6}$/.test(code) || busy) {
      setError("Enter a six-digit authenticator code.");
      return;
    }

    setBusy(true);
    setError("");
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: selected });
    if (challengeError || !challenge) {
      setError("Authenticator verification could not be started. Try again.");
      setBusy(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: selected,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setDigits(["", "", "", "", "", ""]);
      focusInput(0);
      setError("The authenticator code could not be verified. Try again.");
      setBusy(false);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      setError("Authenticator verification could not be confirmed. Try again.");
      setBusy(false);
      return;
    }

    router.replace(destination);
  }

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="relative flex h-dvh min-h-svh items-center justify-center overflow-hidden px-4 py-4 text-slate-950 sm:px-6">
      <Image
        alt=""
        className="object-cover"
        fill
        priority
        sizes="100vw"
        src="/images/auth/delivereaze-mfa-delivery-driver.webp"
      />
      <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(7,12,29,0.88)_0%,rgba(28,14,63,0.72)_48%,rgba(109,74,255,0.42)_100%)]" />
      <div className="relative z-10 w-full max-w-[448px]">
        <section className="rounded-[26px] border border-white/70 bg-white/90 px-5 py-5 shadow-[0_24px_64px_rgba(7,12,29,0.36)] backdrop-blur-xl sm:px-7 sm:py-6">
          <div className="mx-auto flex w-fit items-center justify-center">
            <Image
              alt="DeliverEaze Logistics"
              className="h-auto w-36 sm:w-40"
              height={108}
              priority
              src="/images/brand/delivereaze-logo-transparent.png"
              width={640}
            />
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-700">
              Operations portal
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-[2rem]">
              Verify your identity
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
              Enter the 6-digit code from your authenticator app to continue.
            </p>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm font-medium text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
              Loading authenticators...
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {factors.length > 1 ? (
                <label className="block text-sm font-semibold text-slate-700">
                  Use another authenticator
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                    onChange={(event) => setSelected(event.target.value)}
                    value={selected}
                  >
                    {factors.map((factor, index) => (
                      <option key={factor.id} value={factor.id}>
                        {factor.friendly_name || `Authenticator ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div>
                <p className="text-sm font-semibold text-slate-700">Verification code</p>
                <div className="mt-3 flex justify-between gap-2 sm:gap-3">
                  {digits.map((digit, index) => (
                    <input
                      aria-label={`Verification code digit ${index + 1} of 6`}
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white text-center text-xl font-bold text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition placeholder:text-transparent focus:border-purple-600 focus:ring-4 focus:ring-purple-100 sm:h-[52px] sm:text-2xl"
                      inputMode="numeric"
                      key={index}
                      maxLength={1}
                      onChange={(event) => handleDigitChange(index, event.target.value)}
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => handleKeyDown(index, event)}
                      onPaste={(event) => {
                        event.preventDefault();
                        applyDigits(event.clipboardData.getData("text"), index);
                      }}
                      ref={(element) => {
                        inputRefs.current[index] = element;
                      }}
                      type="text"
                      value={digit}
                    />
                  ))}
                </div>
              </div>

              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-center text-sm font-medium text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                className="h-11 w-full rounded-xl bg-[#6d4aff] text-sm font-semibold text-white shadow-sm transition hover:bg-[#5b38eb] focus:outline-none focus:ring-4 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-purple-300"
                disabled={busy || !factors.length || code.length !== 6}
                onClick={() => void verify()}
                type="button"
              >
                {busy ? "Verifying..." : "Verify code"}
              </button>
            </div>
          )}

          <button
            className="mx-auto mt-4 block text-sm font-semibold text-slate-500 transition hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 disabled:text-slate-300"
            disabled={busy}
            onClick={() => void signOut()}
            type="button"
          >
            Sign out
          </button>
        </section>
      </div>
    </main>
  );
}

export default function VerifyMfaPage() {
  return (
    <Suspense fallback={<main className="h-dvh min-h-svh overflow-hidden bg-slate-950" />}>
      <VerifyMfaPageContent />
    </Suspense>
  );
}
