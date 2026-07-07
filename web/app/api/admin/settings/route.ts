import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  const { data, error } = await authorization.client
    .from("profiles")
    .select("profile_id, role, is_active, updated_at, created_at");
  if (error) return apiError(error.message, 400);

  const profiles = data ?? [];
  const lastUpdated = profiles
    .map((profile) => profile.updated_at ?? profile.created_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? new Date().toISOString();

  return Response.json({
    system: {
      name: "DeliverEaze DDMS",
      version: "v0.1.0",
      environment: process.env.NODE_ENV === "production" ? "Production" : "Development",
      lastUpdated,
      timeZone: "(UTC-04:00) Atlantic Time (ET)",
    },
    roles: {
      administrator: profiles.filter((profile) => ["administrator", "admin"].includes(profile.role ?? "") && profile.is_active === true).length,
      dispatcher: profiles.filter((profile) => profile.role === "dispatcher" && profile.is_active === true).length,
      driver: profiles.filter((profile) => profile.role === "driver" && profile.is_active === true).length,
    },
  });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return apiError("Invalid settings request.", 400);
  }

  return Response.json({
    message:
      "Settings validated. Persistent global settings require an existing settings table, which is not present in the finalized schema.",
  });
}
