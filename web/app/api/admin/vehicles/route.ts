import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";
import { deriveVehicleStatus, findRelevantAssignment } from "@/lib/operations";
import { notificationPaths, notifyOperationalEvent } from "@/lib/server/notification-service";

type VehicleInput = {
  vehicle_number: string | null; license_plate: string; make: string | null; model: string | null; year: number | null; vehicle_type: string | null; mileage: number | null; insurance_policy_number: string | null; insurance_expiry_date: string | null; registration_number: string | null; registration_expiry_date: string | null; status: "available" | "assigned" | "maintenance_due" | "out_of_service"; updated_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function parseVehicle(value: unknown): VehicleInput | null {
  if (!isRecord(value) || typeof value.license_plate !== "string" || !value.license_plate.trim() || !["available", "assigned", "maintenance_due", "out_of_service"].includes(String(value.status))) return null;
  const nullableText = (field: unknown) => typeof field === "string" ? field.trim() || null : null;
  const nullableNumber = (field: unknown) => field === null || (typeof field === "number" && Number.isFinite(field)) ? field : null;
  return { vehicle_number: nullableText(value.vehicle_number), license_plate: value.license_plate.trim(), make: nullableText(value.make), model: nullableText(value.model), year: nullableNumber(value.year), vehicle_type: nullableText(value.vehicle_type), mileage: nullableNumber(value.mileage), insurance_policy_number: nullableText(value.insurance_policy_number), insurance_expiry_date: nullableText(value.insurance_expiry_date), registration_number: nullableText(value.registration_number), registration_expiry_date: nullableText(value.registration_expiry_date), status: value.status as VehicleInput["status"], updated_at: new Date().toISOString() };
}

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const vehicleId = new URL(request.url).searchParams.get("vehicleId")?.trim();
  if (!vehicleId) {
    const [vehiclesResponse, schedulesResponse] = await Promise.all([
      authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, year, vehicle_type, mileage, insurance_policy_number, insurance_expiry_date, registration_number, registration_expiry_date, status, created_at, updated_at").order("created_at", { ascending: false }),
      authorization.client.from("schedules").select("driver_id, vehicle_id, start_time, end_time, status").neq("status", "cancelled").gt("end_time", new Date().toISOString()),
    ]);
    const error = vehiclesResponse.error ?? schedulesResponse.error;
    if (error) return apiError(error.message, 400);
    const schedules = schedulesResponse.data ?? [];
    const vehicles = (vehiclesResponse.data ?? []).map((vehicle) => ({
      ...vehicle,
      status: deriveVehicleStatus(vehicle.status, schedules.filter((schedule) => schedule.vehicle_id === vehicle.vehicle_id)),
    }));
    return Response.json({ vehicles });
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
  const schedule = findRelevantAssignment(schedules ?? []);
  const maintenanceResponse = await authorization.client
    .from("vehicle_maintenance")
    .select("maintenance_id, maintenance_type, cost, maintenance_date, created_at")
    .eq("vehicle_id", vehicleId)
    .order("maintenance_date", { ascending: false })
    .limit(1);
  if (maintenanceResponse.error) return apiError(maintenanceResponse.error.message, 400);
  const maintenance = maintenanceResponse.data?.[0] ?? null;
  if (!schedule?.driver_id) return Response.json({ assignment: null, maintenance });

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
  }, maintenance });
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
  const vehicleId = body.vehicle_id.trim();
  const { data: current, error: currentError } = await authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, status").eq("vehicle_id", vehicleId).maybeSingle();
  if (currentError || !current) return apiError(currentError?.message ?? "Vehicle was not found.", 404);
  const { error } = await authorization.client.from("vehicles").update(vehicle).eq("vehicle_id", vehicleId); if (error) return apiError(error.message, 400);
  const unavailable = ["maintenance_due", "out_of_service"].includes(vehicle.status);
  if (unavailable && current.status !== vehicle.status) {
    const { data: schedules } = await authorization.client.from("schedules").select("schedule_id, driver_id, shift_name, start_time").eq("vehicle_id", vehicleId).neq("status", "cancelled").gt("end_time", new Date().toISOString());
    const affectedDriverIds = [...new Set((schedules ?? []).map((schedule) => schedule.driver_id).filter((id): id is string => Boolean(id)))];
    const { data: affectedDeliveries } = await authorization.client.from("deliveries").select("delivery_id, delivery_number, assigned_driver_id, status").eq("assigned_vehicle_id", vehicleId).in("status", ["pending", "assigned", "in_transit", "delayed"]);
    const vehicleLabel = current.vehicle_number ?? current.license_plate ?? "Vehicle";
    void notifyOperationalEvent(authorization.client, { type: "vehicle_unavailable", key: `vehicle:${vehicleId}:${vehicle.status}`, title: `${vehicleLabel} requires attention`, message: `This vehicle is now ${vehicle.status.replaceAll("_", " ")} and may affect planned operations.`, tone: vehicle.status === "out_of_service" ? "red" : "orange", badge: "Vehicle warning", module: "vehicles", relatedId: vehicleId, actionPath: notificationPaths.vehicle(vehicleId), actionLabel: "Review vehicle", recipientRoles: ["administrator", "dispatcher"], critical: vehicle.status === "out_of_service", details: [{ label: "Vehicle", value: vehicleLabel }, { label: "Status", value: vehicle.status.replaceAll("_", " ") }, { label: "Maintenance issue", value: vehicle.status === "maintenance_due" ? "Maintenance required" : "Vehicle unavailable" }, { label: "Affected schedules", value: schedules?.length ? String(schedules.length) : null }, { label: "Affected drivers", value: affectedDriverIds.length ? String(affectedDriverIds.length) : null }, { label: "Affected deliveries", value: affectedDeliveries?.length ? String(affectedDeliveries.length) : null }, { label: "Unavailable from", value: new Date().toLocaleString("en-US") }] });
    (affectedDeliveries ?? []).forEach((delivery) => void notifyOperationalEvent(authorization.client!, { type: "vehicle_unavailable", key: `delivery-reassignment:${delivery.delivery_id}:${vehicle.status}`, title: `Delivery ${delivery.delivery_number ?? delivery.delivery_id.slice(0, 8)} requires reassignment`, message: `The assigned vehicle ${vehicleLabel} is ${vehicle.status.replaceAll("_", " ")}.`, tone: "red", badge: "Required action", module: "deliveries", relatedId: delivery.delivery_id, actionPath: notificationPaths.delivery(delivery.delivery_id), actionLabel: "Reassign delivery", recipientRoles: ["dispatcher"], critical: true, details: [{ label: "Delivery", value: delivery.delivery_number }, { label: "Original driver", value: delivery.assigned_driver_id ? "Assigned driver" : null }, { label: "Original vehicle", value: vehicleLabel }, { label: "Current status", value: delivery.status }] }));
  }
  return Response.json({ message: "Vehicle updated successfully." });
}
