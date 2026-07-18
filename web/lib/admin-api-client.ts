import { supabase } from "@/lib/supabase";
import { getVerifiedTotpFactors } from "@/lib/mfa";

function readError(body: unknown) {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : "The server could not complete this request.";
}

export async function fetchAdministratorJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("You must be signed in as an Administrator.");
  }

  const response = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${data.session.access_token}` },
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("The server returned an unexpected response.");
  }

  const body: unknown = await response.json();
  if (!response.ok && typeof body === "object" && body !== null && "code" in body && body.code === "MFA_REQUIRED") {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    if (!getVerifiedTotpFactors(factors).length) {
      const isFinancialAction = path.startsWith("/api/admin/finance") || path.startsWith("/api/admin/reports");
      const setupParams = new URLSearchParams({ mfa: "setup", section: "security" });
      if (isFinancialAction) setupParams.set("reason", "financial");
      window.location.assign(`/admin/settings?${setupParams.toString()}`);
      throw new Error(isFinancialAction ? "Set up an authenticator before performing this financial action." : "Set up an authenticator before performing this action.");
    }
    window.location.assign(`/verify-mfa?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
    throw new Error("Verify your identity to continue.");
  }
  if (!response.ok) throw new Error(readError(body));
  return body as T;
}
