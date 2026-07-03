import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  const [schedulesResponse, driversResponse, vehiclesResponse] = await Promise.all([
    authorization.client.from("schedules").select("schedule_id, driver_id, vehicle_id, shift_date, shift_type, shift_name, start_time, end_time, status, assigned_by, notes").order("start_time", { ascending: true }),
    authorization.client.from("drivers").select("driver_id, user_id, assigned_vehicle_id, availability").order("created_at", { ascending: false }),
    authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, status").order("license_plate", { ascending: true }),
  ]);
  const listError = schedulesResponse.error ?? driversResponse.error ?? vehiclesResponse.error;
  if (listError) return apiError(listError.message, 400);

  const drivers = driversResponse.data ?? [];
  const userIds = Array.from(new Set(drivers.map((driver) => driver.user_id).filter((id): id is string => Boolean(id))));
  const profilesResponse = userIds.length
    ? await authorization.client.from("profiles").select("profile_id, first_name, last_name, email, is_active").in("profile_id", userIds)
    : { data: [], error: null };
  if (profilesResponse.error) return apiError(profilesResponse.error.message, 400);

  return Response.json({
    schedules: schedulesResponse.data ?? [],
    drivers,
    profiles: profilesResponse.data ?? [],
    vehicles: vehiclesResponse.data ?? [],
  });
}
