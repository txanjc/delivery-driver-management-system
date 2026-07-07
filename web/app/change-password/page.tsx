"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { SkeletonButton, SkeletonText } from "@/components/ui/Skeleton";
import { getRoleRedirectPath, type WebUserRole } from "@/lib/role-redirect";
import { supabase } from "@/lib/supabase";

type UserProfile = {
  role: WebUserRole;
  must_change_password: boolean | null;
};

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (userError || !userData.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role, must_change_password")
        .eq("profile_id", userData.user.id)
        .maybeSingle<UserProfile>();

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        setErrorMessage(error?.message ?? "No profile was found.");
        setIsLoading(false);
        return;
      }

      if (data.must_change_password !== true) {
        router.replace(getRoleRedirectPath(data.role));
        return;
      }

      setProfile(data);
      setIsLoading(false);
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!profile) {
      setErrorMessage("Unable to load your account profile.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSaving(true);

    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (passwordError) {
      setErrorMessage(passwordError.message);
      setIsSaving(false);
      return;
    }

    const { error: profileError } = await supabase.rpc(
      "clear_own_must_change_password",
    );

    if (profileError) {
      setErrorMessage(profileError.message);
      setIsSaving(false);
      return;
    }

    setSuccessMessage("Password updated successfully.");
    router.replace(getRoleRedirectPath(profile.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">
            DeliverEaze Logistics
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Change password
          </h1>
        </div>

        {isLoading ? (
          <div aria-busy="true" aria-live="polite" className="space-y-5">
            <span className="sr-only">Loading account information</span>
            <div>
              <SkeletonText lines={1} widths={["w-28"]} />
              <div className="mt-2 h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <SkeletonText lines={1} widths={["w-full"]} />
              </div>
            </div>
            <div>
              <SkeletonText lines={1} widths={["w-36"]} />
              <div className="mt-2 h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <SkeletonText lines={1} widths={["w-full"]} />
              </div>
            </div>
            <SkeletonButton className="h-10 w-full rounded-md" />
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="new-password"
              >
                New password
              </label>
              <input
                className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                disabled={isSaving}
                id="new-password"
                minLength={8}
                name="new-password"
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="confirm-password"
              >
                Confirm new password
              </label>
              <input
                className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                disabled={isSaving}
                id="confirm-password"
                minLength={8}
                name="confirm-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </div>

            {errorMessage ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}

            <button
              className="flex w-full items-center justify-center rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Updating password..." : "Update password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
