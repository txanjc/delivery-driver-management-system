"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { EyeClosedIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { AppIcons } from "@/config/icons";
import { getRoleRedirectPath, type WebUserRole } from "@/lib/role-redirect";
import { getVerifiedTotpFactors } from "@/lib/mfa";
import { supabase } from "@/lib/supabase";

const SLIDE_INTERVAL_MS = 3500;
const FADE_DURATION_MS = 1000;
type AuthMode = "sign-in" | "forgot-password";

const authSlides = [
  {
    alt: "DeliverEaze truck on a city street in the morning",
    headline: "Start your day with confidence.",
    label: "Morning",
    objectPosition: "58% center",
    src: "/images/auth/delivereaze-morning.webp",
    supportingText: "Everything you need to keep deliveries moving is right here.",
  },
  {
    alt: "DeliverEaze truck passing through a downtown corridor",
    headline: "Keep every delivery on track.",
    label: "Afternoon",
    objectPosition: "52% center",
    src: "/images/auth/delivereaze-afternoon.webp",
    supportingText: "Stay organized and in control throughout the day.",
  },
  {
    alt: "DeliverEaze truck driving through the city at night",
    headline: "End the day with clarity.",
    label: "Night",
    objectPosition: "55% center",
    src: "/images/auth/delivereaze-night.webp",
    supportingText: "See the bigger picture and keep tomorrow in motion.",
  },
] as const;

type UserProfile = {
  profile_id: string;
  role: WebUserRole;
  is_active: boolean | null;
  must_change_password: boolean | null;
};

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    queueMicrotask(() => setPrefersReducedMotion(query.matches));
    const handleChange = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

function DeliverEazeLogo({ centered = false }: { centered?: boolean }) {
  return (
    <div className={`flex ${centered ? "justify-center" : ""}`}>
      <Image
        alt="DeliverEaze Logistics"
        className="h-auto w-[180px] object-contain md:w-[200px] [@media(max-height:700px)]:w-[170px]"
        height={108}
        priority
        src="/images/brand/delivereaze-logo-light.webp"
        width={640}
      />
    </div>
  );
}

function AuthImageSlideshow({ compact = false }: { compact?: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const visibleSlides = useMemo(() => prefersReducedMotion ? authSlides.slice(0, 1) : authSlides, [prefersReducedMotion]);

  useEffect(() => {
    for (const slide of authSlides) {
      const image = new window.Image();
      image.src = slide.src;
    }
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || compact) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setActiveIndex((current) => (current + 1) % authSlides.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeIndex, compact, prefersReducedMotion]);

  return (
    <div className={`relative isolate overflow-hidden ${compact ? "h-full min-h-[190px] rounded-[28px]" : "h-full"}`}>
      {visibleSlides.map((slide, index) => (
        <Image
          alt={compact ? "" : slide.alt}
          aria-hidden={compact}
          className="scale-[1.055] object-cover transition-opacity ease-out"
          fill
          key={slide.src}
          priority={index === 0}
          sizes={compact ? "100vw" : "66vw"}
          src={slide.src}
          style={{
            objectPosition: slide.objectPosition,
            opacity: index === activeIndex ? 1 : 0,
            transitionDuration: `${FADE_DURATION_MS}ms`,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_82%,rgba(109,74,255,0.3),transparent_34%),linear-gradient(115deg,rgba(2,6,23,0.76)_0%,rgba(44,18,82,0.44)_42%,rgba(2,6,23,0.2)_100%)]" />
      {!compact ? (
        <>
          <div className="absolute bottom-[clamp(5.25rem,9vh,7.5rem)] left-10 max-w-[620px] text-white xl:left-16">
            <p className="text-[clamp(2.25rem,4vw,4rem)] font-black leading-[1.02] tracking-[-0.045em] drop-shadow-sm">
              {authSlides[activeIndex].headline}
            </p>
            <p className="mt-4 max-w-md text-[clamp(0.9rem,1.2vw,1.05rem)] leading-7 text-white/84">
              {authSlides[activeIndex].supportingText}
            </p>
          </div>
          <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/12 px-2.5 py-2 ring-1 ring-white/18 backdrop-blur-md">
            {authSlides.map((slide, index) => (
              <button
                aria-label={`Show ${slide.label} image`}
                className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-7 bg-white" : "w-1.5 bg-white/45 hover:bg-white/75"}`}
                key={slide.src}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PasswordField({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const [visible, setVisible] = useState(false);
  const EyeIcon = AppIcons.view;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500" htmlFor="password">
          Password
        </label>
      </div>
      <div className="relative mt-2">
        <input
          autoComplete="current-password"
          className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 pr-11 text-[15px] font-medium text-slate-950 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={disabled}
          id="password"
          name="password"
          onChange={(event) => onChange(event.target.value)}
          required
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-purple-700 disabled:cursor-not-allowed disabled:text-slate-300"
          disabled={disabled}
          type="button"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeClosedIcon aria-hidden size={18} weight="bold" /> : <EyeIcon aria-hidden size={18} weight="bold" />}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setEmailError("");
    setPasswordError("");

    if (authMode === "forgot-password") {
      await handlePasswordReset();
      return;
    }

    let hasValidationError = false;
    if (!email.trim()) {
      setEmailError("Enter your email address.");
      hasValidationError = true;
    }
    if (!password) {
      setPasswordError("Enter your password.");
      hasValidationError = true;
    }
    if (hasValidationError) return;

    setIsLoading(true);

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      setErrorMessage(authError.message);
      setIsLoading(false);
      return;
    }

    if (!authData.user) {
      setErrorMessage("Unable to sign in user.");
      setIsLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("profile_id, role, is_active, must_change_password")
      .eq("profile_id", authData.user.id)
      .maybeSingle<UserProfile>();

    if (profileError) {
      setErrorMessage(profileError.message);
      setIsLoading(false);
      return;
    }

    if (!profile) {
      setErrorMessage("No profile was found for this account.");
      setIsLoading(false);
      return;
    }

    if (profile.is_active !== true) {
      await supabase.auth.signOut({ scope: "local" });
      setErrorMessage("This account is inactive. Contact an administrator.");
      setIsLoading(false);
      return;
    }

    if (profile.must_change_password === true) {
      router.replace("/change-password");
      return;
    }

    if (profile.role === "driver") {
      setErrorMessage("Drivers must use the mobile app.");
      setIsLoading(false);
      return;
    }

    const [factorResult, assuranceResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    const verifiedFactors = factorResult.error ? [] : getVerifiedTotpFactors(factorResult.data);
    if (verifiedFactors.length && assuranceResult.data?.currentLevel === "aal1" && assuranceResult.data.nextLevel === "aal2") {
      router.replace(`/verify-mfa?returnTo=${encodeURIComponent(getRoleRedirectPath(profile.role))}`);
      return;
    }

    router.replace(getRoleRedirectPath(profile.role));
  }

  async function handlePasswordReset() {
    setErrorMessage("");
    setStatusMessage("");
    setEmailError("");
    if (!email.trim()) {
      setEmailError("Enter your email address to request a reset link.");
      return;
    }

    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/change-password`,
    });
    setIsResetting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStatusMessage("Password reset instructions have been sent if the account exists.");
  }

  function switchMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setErrorMessage("");
    setStatusMessage("");
    setEmailError("");
    setPasswordError("");
  }

  return (
    <main className="relative h-dvh min-h-dvh overflow-hidden bg-slate-950 text-slate-950 md:grid md:grid-cols-[minmax(400px,34vw)_1fr]">
      <div className="absolute inset-0 md:hidden">
        <AuthImageSlideshow compact />
        <div className="absolute inset-0 bg-[#faf8ff]/90 backdrop-blur-sm" />
      </div>

      <section className="relative z-10 flex h-dvh min-h-0 flex-col overflow-hidden bg-[#fcfbff]/96 px-6 py-[clamp(1rem,3vh,2rem)] backdrop-blur md:min-w-[400px] md:max-w-[520px] md:bg-[linear-gradient(180deg,#ffffff_0%,#fbfaff_58%,#f7f4ff_100%)] md:px-12 lg:px-16">
        <header className="pt-[10%]">
          <DeliverEazeLogo centered />
        </header>

        <div className="flex min-h-0 flex-1 items-center py-[clamp(1rem,4vh,2.25rem)]">
          <div className="mx-auto w-full max-w-[390px]">
            <div className="md:hidden">
              <div className="mb-5 h-[clamp(6.5rem,18vh,9rem)] overflow-hidden rounded-2xl shadow-xl shadow-purple-950/12">
                <AuthImageSlideshow compact />
              </div>
            </div>

            <div className="mb-[clamp(1.25rem,3vh,2rem)]">
              <p className="text-sm font-bold text-purple-600">{authMode === "forgot-password" ? "Account Recovery" : "Operations Portal"}</p>
              <h1 className="mt-2 text-[clamp(1.7rem,4vh,2rem)] font-black leading-tight tracking-[-0.05em] text-slate-950">
                {authMode === "forgot-password" ? "Reset your password" : "Welcome to DeliverEaze"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {authMode === "forgot-password" ? "Enter your email address and we'll send you a password reset link." : "Sign in to access your deliveries, routes, and daily operations."}
              </p>
            </div>

            <form className="space-y-[clamp(0.9rem,2.2vh,1.25rem)]" onSubmit={handleSubmit}>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500" htmlFor="email">
                  Email
                </label>
                <input
                  autoComplete="email"
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-[15px] font-medium text-slate-950 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  disabled={isLoading || isResetting}
                  id="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
                {emailError ? <p className="mt-1.5 text-xs font-medium text-red-600">{emailError}</p> : null}
              </div>

              {authMode === "sign-in" ? (
                <div>
                  <PasswordField disabled={isLoading} onChange={setPassword} value={password} />
                  {passwordError ? <p className="mt-1.5 text-xs font-medium text-red-600">{passwordError}</p> : null}
                </div>
              ) : null}

              {authMode === "sign-in" ? <div className="flex items-center justify-start">
                <button
                  className="rounded-full py-1 text-sm font-bold text-purple-700 transition hover:text-purple-900 disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={isLoading || isResetting}
                  onClick={() => switchMode("forgot-password")}
                  type="button"
                >
                  Forgot password?
                </button>
              </div> : null}

              <div aria-live="polite" className="min-h-0">
                {errorMessage ? (
                  <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {errorMessage}
                  </p>
                ) : null}
                {statusMessage ? (
                  <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                    {statusMessage}
                  </p>
                ) : null}
              </div>

              <button
                className="flex h-11 w-full items-center justify-center rounded-full bg-[#6d4aff] px-4 text-sm font-bold text-white transition hover:bg-[#5d3ee8] active:translate-y-px disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isLoading || isResetting}
                type="submit"
              >
                {authMode === "forgot-password" ? (isResetting ? "Sending..." : "Send Reset Link") : (isLoading ? "Signing in..." : "Sign In")}
              </button>
              {authMode === "forgot-password" ? (
                <button
                  className="mx-auto block text-sm font-bold text-purple-700 transition hover:text-purple-900"
                  disabled={isResetting}
                  onClick={() => switchMode("sign-in")}
                  type="button"
                >
                  Back to Sign In
                </button>
              ) : null}
            </form>
          </div>
        </div>

        <footer className="shrink-0 pb-1 text-center text-xs text-slate-400">
          <span>Copyright 2026 DeliverEaze Logistics.</span>
        </footer>
      </section>

      <aside className="relative hidden h-dvh min-h-0 overflow-hidden md:block">
        <AuthImageSlideshow />
      </aside>
    </main>
  );
}
