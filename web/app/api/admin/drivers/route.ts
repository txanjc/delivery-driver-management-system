import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  const profileId = new URL(request.url).searchParams.get("profileId")?.trim();
  if (profileId) {
    const { data, error } = await authorization.client
      .from("profiles")
      .select("is_active")
      .eq("profile_id", profileId)
      .maybeSingle<{ is_active: boolean | null }>();
    if (error) return apiError(error.message, 400);
    if (!data) return apiError("Driver profile was not found.", 404);
    return Response.json({ isActive: data.is_active === true });
  }

  const [driversResponse, profilesResponse] = await Promise.all([
    authorization.client.from("drivers").select("driver_id, user_id, license_number, license_expiry_date, availability, performance_score, assigned_vehicle_id, created_at, updated_at, profiles:user_id (profile_id, first_name, last_name, email, phone, role, is_active), vehicles:assigned_vehicle_id (vehicle_id, vehicle_number, license_plate, make, model)").order("created_at", { ascending: false }),
    authorization.client.from("profiles").select("profile_id, first_name, last_name, email, phone, role, is_active").eq("role", "driver").order("first_name", { ascending: true }),
  ]);

  const error = driversResponse.error ?? profilesResponse.error;
  if (error) return apiError(error.message, 400);
  return Response.json({ drivers: driversResponse.data ?? [], profiles: profilesResponse.data ?? [] });
}
