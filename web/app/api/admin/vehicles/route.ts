import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const vehicleId = new URL(request.url).searchParams.get("vehicleId")?.trim();
  if (!vehicleId) {
    const { data, error } = await authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, year, vehicle_type, mileage, insurance_policy_number, insurance_expiry_date, registration_number, registration_expiry_date, status, created_at, updated_at").order("created_at", { ascending: false });
    if (error) return apiError(error.message, 400);
    return Response.json({ vehicles: data ?? [] });
  }

  const { data: schedules, error: scheduleError } = await authorization.client
    .from("schedules")
    .select("schedule_id, vehicle_id, driver_id, shift_date, shift_type, shift_name, start_time, end_time, status")
    .eq("vehicle_id", vehicleId)
    .neq("status", "cancelled")
    .order("shift_date", { ascending: false });
  if (scheduleError) return apiError(scheduleError.message, 400);
  const schedule = schedules?.[0];
  if (!schedule?.driver_id) return Response.json({ assignment: null });

  const { data: driver, error: driverError } = await authorization.client
    .from("drivers")
    .select("driver_id, user_id")
    .eq("driver_id", schedule.driver_id)
    .maybeSingle();
  if (driverError) return apiError(driverError.message, 400);
  if (!driver?.user_id) return Response.json({ assignment: null });

  const { data: profile, error: profileError } = await authorization.client
    .from("profiles")
    .select("profile_id, first_name, last_name, email")
    .eq("profile_id", driver.user_id)
    .maybeSingle();
  if (profileError) return apiError(profileError.message, 400);

  return Response.json({ assignment: {
    vehicle_id: vehicleId,
    driver_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null,
    driver_email: profile?.email ?? null,
    schedule,
  } });
}
