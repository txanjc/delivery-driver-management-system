import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";
import type { SupabaseClient } from "@supabase/supabase-js";

type ScheduleInput = {
  driver_id: string;
  vehicle_id: string | null;
  shift_date: string;
  shift_type: "morning" | "evening" | "custom";
  shift_name: string;
  start_time: string;
  end_time: string;
  status: "scheduled";
  notes: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSchedule(value: unknown): ScheduleInput | null {
  if (!isRecord(value)) return null;
  const driverId = typeof value.driver_id === "string" ? value.driver_id.trim() : "";
  const vehicleId = value.vehicle_id === null ? null : typeof value.vehicle_id === "string" ? value.vehicle_id.trim() || null : undefined;
  const shiftDate = typeof value.shift_date === "string" ? value.shift_date : "";
  const shiftType = value.shift_type;
  const shiftName = typeof value.shift_name === "string" ? value.shift_name.trim() : "";
  const startTime = typeof value.start_time === "string" ? value.start_time : "";
  const endTime = typeof value.end_time === "string" ? value.end_time : "";
  const notes = value.notes === null ? null : typeof value.notes === "string" ? value.notes.trim() || null : undefined;
  if (!driverId || vehicleId === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(shiftDate) || !["morning", "evening", "custom"].includes(String(shiftType)) || !shiftName || !startTime || !endTime || Number.isNaN(Date.parse(startTime)) || Number.isNaN(Date.parse(endTime)) || new Date(startTime) >= new Date(endTime) || value.status !== "scheduled" || notes === undefined) return null;
  return { driver_id: driverId, vehicle_id: vehicleId, shift_date: shiftDate, shift_type: shiftType as ScheduleInput["shift_type"], shift_name: shiftName, start_time: startTime, end_time: endTime, status: "scheduled", notes };
}

function overlaps(left: ScheduleInput, right: { driver_id: string | null; vehicle_id: string | null; start_time: string | null; end_time: string | null }) {
  if (!right.start_time || !right.end_time) return false;
  const sharesResource = left.driver_id === right.driver_id || Boolean(left.vehicle_id && left.vehicle_id === right.vehicle_id);
  return sharesResource && new Date(left.start_time) < new Date(right.end_time) && new Date(right.start_time) < new Date(left.end_time);
}

async function synchronizeAssignments(client: SupabaseClient, driverIds: string[], vehicleIds: string[]) {
  const now = new Date().toISOString();
  for (const driverId of Array.from(new Set(driverIds.filter(Boolean)))) {
    const { data: activeSchedules, error } = await client.from("schedules").select("vehicle_id, start_time").eq("driver_id", driverId).neq("status", "cancelled").gt("end_time", now).not("vehicle_id", "is", null).order("start_time", { ascending: true }).limit(1);
    if (error) return error;
    const { error: updateError } = await client.from("drivers").update({ assigned_vehicle_id: activeSchedules?.[0]?.vehicle_id ?? null, updated_at: now }).eq("driver_id", driverId);
    if (updateError) return updateError;
  }
  for (const vehicleId of Array.from(new Set(vehicleIds.filter(Boolean)))) {
    const { count, error } = await client.from("schedules").select("schedule_id", { count: "exact", head: true }).eq("vehicle_id", vehicleId).neq("status", "cancelled").gt("end_time", now);
    if (error) return error;
    const { error: updateError } = await client.from("vehicles").update({ status: count && count > 0 ? "assigned" : "available", updated_at: now }).eq("vehicle_id", vehicleId);
    if (updateError) return updateError;
  }
  return null;
}

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

export async function POST(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  const authorizationHeader = request.headers.get("authorization") ?? "";
  const accessToken = authorizationHeader.split(" ")[1] ?? "";
  const { data: requesterData, error: requesterError } = await authorization.client.auth.getUser(accessToken);
  if (requesterError || !requesterData.user) return apiError("Authentication is required.", 401);

  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  if (!isRecord(body) || !Array.isArray(body.schedules) || body.schedules.length < 1 || body.schedules.length > 7) return apiError("Create between one and seven schedules at a time.", 400);
  const schedules = body.schedules.map(parseSchedule);
  if (schedules.some((schedule) => schedule === null)) return apiError("Invalid schedule creation request.", 400);
  const validSchedules = schedules.filter((schedule): schedule is ScheduleInput => schedule !== null);

  const driverIds = Array.from(new Set(validSchedules.map((schedule) => schedule.driver_id)));
  const { data: driverRows, error: driverError } = await authorization.client.from("drivers").select("driver_id, user_id, availability").in("driver_id", driverIds);
  if (driverError) return apiError(driverError.message, 400);
  const userIds = (driverRows ?? []).map((driver) => driver.user_id).filter((id): id is string => Boolean(id));
  const { data: profiles, error: profileError } = await authorization.client.from("profiles").select("profile_id, role, is_active").in("profile_id", userIds);
  if (profileError) return apiError(profileError.message, 400);
  for (const driverId of driverIds) { const driver = (driverRows ?? []).find((row) => row.driver_id === driverId); const profile = (profiles ?? []).find((row) => row.profile_id === driver?.user_id); if (!driver || driver.availability === "unavailable" || profile?.role !== "driver" || profile.is_active !== true) return apiError("Every selected driver must be active and available.", 400); }

  const vehicleIds = Array.from(new Set(validSchedules.map((schedule) => schedule.vehicle_id).filter((id): id is string => Boolean(id))));
  if (vehicleIds.length) { const { data: vehicleRows, error: vehicleError } = await authorization.client.from("vehicles").select("vehicle_id, status").in("vehicle_id", vehicleIds); if (vehicleError) return apiError(vehicleError.message, 400); for (const vehicleId of vehicleIds) { const vehicle = (vehicleRows ?? []).find((row) => row.vehicle_id === vehicleId); if (!vehicle || ["out_of_service", "maintenance_due"].includes(vehicle.status ?? "")) return apiError("Every selected vehicle must be available for scheduling.", 400); } }

  const { data: existing, error: existingError } = await authorization.client.from("schedules").select("driver_id, vehicle_id, start_time, end_time, status").neq("status", "cancelled");
  if (existingError) return apiError(existingError.message, 400);
  for (let index = 0; index < validSchedules.length; index += 1) { const schedule = validSchedules[index]; if ((existing ?? []).some((row) => overlaps(schedule, row)) || validSchedules.slice(0, index).some((row) => overlaps(schedule, row))) return apiError(`Schedule conflict detected for ${schedule.shift_date}.`, 409); }

  const { data: created, error: insertError } = await authorization.client.from("schedules").insert(validSchedules.map((schedule) => ({ ...schedule, assigned_by: requesterData.user.id, updated_at: new Date().toISOString() }))).select("schedule_id");
  if (insertError) return apiError(insertError.message, 400);
  const syncError = await synchronizeAssignments(authorization.client, driverIds, vehicleIds);
  if (syncError) return apiError(`Schedules were created, but assignment synchronization failed: ${syncError.message}`, 500);
  return Response.json({ message: "Schedules created successfully.", scheduleIds: (created ?? []).map((schedule) => schedule.schedule_id) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  if (!isRecord(body) || typeof body.schedule_id !== "string") return apiError("A schedule ID is required.", 400);
  const scheduleId = body.schedule_id.trim();
  const input = parseSchedule(body.schedule);
  const status = isRecord(body.schedule) && body.schedule.status === "cancelled" ? "cancelled" : input?.status;
  if (!scheduleId || (!input && status !== "cancelled")) return apiError("Invalid schedule update request.", 400);
  const { data: existing, error: existingError } = await authorization.client.from("schedules").select("driver_id, vehicle_id").eq("schedule_id", scheduleId).maybeSingle();
  if (existingError || !existing) return apiError(existingError?.message ?? "Schedule was not found.", 404);
  const scheduleBody = body.schedule as Record<string, unknown>;
  const updatePayload = input ? { ...input, status } : { status: "cancelled" as const };
  const { error: updateError } = await authorization.client.from("schedules").update({ ...updatePayload, notes: typeof scheduleBody.notes === "string" ? scheduleBody.notes.trim() || null : null, updated_at: new Date().toISOString() }).eq("schedule_id", scheduleId);
  if (updateError) return apiError(updateError.message, 400);
  const newDriverId = input?.driver_id ?? existing.driver_id;
  const newVehicleId = input?.vehicle_id ?? existing.vehicle_id;
  const syncError = await synchronizeAssignments(authorization.client, [existing.driver_id, newDriverId].filter((id): id is string => Boolean(id)), [existing.vehicle_id, newVehicleId].filter((id): id is string => Boolean(id)));
  if (syncError) return apiError(syncError.message, 500);
  return Response.json({ message: "Schedule updated successfully." });
}
