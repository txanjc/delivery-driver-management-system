import { getRoleRedirectPath, type WebUserRole } from "@/lib/role-redirect";

export type VerifiedTotpFactor = { id: string; friendly_name?: string };

export function sanitizeInternalReturnPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://delivereaze.invalid");
    if (url.origin !== "https://delivereaze.invalid" || url.pathname === "/verify-mfa" || url.searchParams.has("returnTo")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

export function getRoleDashboardPath(role: WebUserRole) { return getRoleRedirectPath(role); }

export function getVerifiedTotpFactors(data: { totp?: Array<{ id: string; status: string; friendly_name?: string }> } | null) {
  return (data?.totp ?? []).filter((factor) => factor.status === "verified").map((factor) => ({ id: factor.id, friendly_name: factor.friendly_name }));
}
