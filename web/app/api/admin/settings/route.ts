import {
  apiError,
  authorizeAdministratorRequest,
  requireAdministratorAal2,
} from "@/lib/server/administrator-api";

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const { data, error } = await authorization.client.from("profiles").select("profile_id, role, is_active, updated_at, created_at");
  if (error) { if (process.env.NODE_ENV === "development") console.error("Settings profile query failed", error); return apiError("Settings could not be loaded.", 400); }
  const profiles = data ?? [];
  const lastDataUpdate = profiles.map((profile) => profile.updated_at ?? profile.created_at).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const mapsConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID);
  return Response.json({
    system: {
      name: "DeliverEaze DDMS",
      version: "v0.1.0",
      environment: process.env.NODE_ENV === "production" ? "Production" : "Development",
      lastDataUpdate,
      timeZone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "Not available",
      database: "operational",
      authentication: "operational",
      maps: mapsConfigured ? "operational" : "configuration_required",
    },
    roles: {
      administrator: profiles.filter((profile) => ["administrator", "admin"].includes(profile.role ?? "") && profile.is_active === true).length,
      dispatcher: profiles.filter((profile) => profile.role === "dispatcher" && profile.is_active === true).length,
      driver: profiles.filter((profile) => profile.role === "driver" && profile.is_active === true).length,
    },
    capabilities: { globalSettings: false, notificationPreferences: false, securityPolicy: false, granularPermissions: false, sms: false, mandatoryMfa: false, ipRestriction: false, passwordExpiration: false, loginLockout: false },
  });
}

export async function PATCH(request: Request) {
  const authorization = await requireAdministratorAal2(request);
  if (!authorization.client) return authorization.response;
  try { await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  console.info("[DeliverEaze security]", JSON.stringify({
    event: "settings_mutation_rejected_as_unsupported_at_aal2",
    userId: authorization.userId,
  }));
  return apiError("This setting is not available because persistent settings storage is not configured.", 409);
}
