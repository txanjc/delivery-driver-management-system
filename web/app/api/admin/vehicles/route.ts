import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function parseVehicle(value: unknown) {
  if (!isRecord(value) || typeof value.license_plate !== "string" || !value.license_plate.trim() || !["available", "assigned", "maintenance_due", "out_of_service"].includes(String(value.status))) return null;
  const nullableText = (field: unknown) => typeof field === "string" ? field.trim() || null : null;
  const nullableNumber = (field: unknown) => field === null || (typeof field === "number" && Number.isFinite(field)) ? field : null;
  return { vehicle_number: nullableText(value.vehicle_number), license_plate: value.license_plate.trim(), make: nullableText(value.make), model: nullableText(value.model), year: nullableNumber(value.year), vehicle_type: nullableText(value.vehicle_type), mileage: nullableNumber(value.mileage), insurance_policy_number: nullableText(value.insurance_policy_number), insurance_expiry_date: nullableText(value.insurance_expiry_date), registration_number: nullableText(value.registration_number), registration_expiry_date: nullableText(value.registration_expiry_date), status: value.status, updated_at: new Date().toISOString() };
}

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
    .gt("end_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1);
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

export async function POST(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown; try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const vehicle = parseVehicle(body); if (!vehicle) return apiError("Invalid vehicle request.", 400);
  const { error } = await authorization.client.from("vehicles").insert(vehicle); if (error) return apiError(error.message, 400);
  return Response.json({ message: "Vehicle created successfully." }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown; try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  if (!isRecord(body) || typeof body.vehicle_id !== "string") return apiError("A vehicle ID is required.", 400);
  const vehicle = parseVehicle(body.vehicle); if (!vehicle) return apiError("Invalid vehicle update request.", 400);
  const { error } = await authorization.client.from("vehicles").update(vehicle).eq("vehicle_id", body.vehicle_id.trim()); if (error) return apiError(error.message, 400);
  return Response.json({ message: "Vehicle updated successfully." });
}
