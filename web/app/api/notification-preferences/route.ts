import { createClient } from "@supabase/supabase-js";

const preferenceKeys = ["new_delivery_assigned", "delivery_status_updates", "schedule_changes", "system_alerts", "maintenance_reminders", "security_alerts"] as const;
type PreferenceKey = (typeof preferenceKeys)[number];
const defaults: Record<PreferenceKey, boolean> = Object.fromEntries(preferenceKeys.map((key) => [key, true])) as Record<PreferenceKey, boolean>;

function error(message: string, status: number) { return Response.json({ error: message }, { status }); }

async function requester(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return { response: error("Server configuration is unavailable.", 500) };
  if (!token) return { response: error("Authentication is required.", 401) };
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error: userError } = await client.auth.getUser(token);
  if (userError || !data.user) return { response: error("Authentication is required.", 401) };
  return { client, profileId: data.user.id };
}

export async function GET(request: Request) {
  const access = await requester(request);
  if (!access.client || !access.profileId) return access.response;
  const { data, error: queryError } = await access.client.from("notification_email_preferences").select("preference_key, enabled").eq("profile_id", access.profileId);
  if (queryError) return error("Email preferences could not be loaded.", 500);
  const preferences = { ...defaults };
  for (const row of data ?? []) if (preferenceKeys.includes(row.preference_key as PreferenceKey)) preferences[row.preference_key as PreferenceKey] = row.enabled === true;
  preferences.security_alerts = true;
  return Response.json({ preferences });
}

export async function PUT(request: Request) {
  const access = await requester(request);
  if (!access.client || !access.profileId) return access.response;
  const body: unknown = await request.json().catch(() => null);
  const key = typeof body === "object" && body !== null && "key" in body ? body.key : null;
  const enabled = typeof body === "object" && body !== null && "enabled" in body ? body.enabled : null;
  if (typeof key !== "string" || !preferenceKeys.includes(key as PreferenceKey) || typeof enabled !== "boolean") return error("Email preference request is invalid.", 400);
  if (key === "security_alerts" && !enabled) return error("Security alert emails cannot be disabled.", 400);
  const { error: saveError } = await access.client.from("notification_email_preferences").upsert({ profile_id: access.profileId, preference_key: key, enabled, updated_at: new Date().toISOString() }, { onConflict: "profile_id,preference_key" });
  if (saveError) return error("Email preference could not be saved.", 500);
  return Response.json({ key, enabled });
}
