import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

const statuses = ["pending", "assigned", "in_transit", "delivered", "delayed", "failed", "returned"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;

type DeliveryStatus = (typeof statuses)[number];
type DeliveryPriority = (typeof priorities)[number];
type DeliveryInput = {
  delivery_number: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_address: string;
  delivery_address: string;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  status: DeliveryStatus;
  priority: DeliveryPriority;
  notes: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableText(value: unknown) {
  return value === null || value === undefined ? null : typeof value === "string" ? value.trim() || null : undefined;
}

function parseDelivery(value: unknown): DeliveryInput | null {
  if (!isRecord(value)) return null;
  const deliveryNumber = typeof value.delivery_number === "string" ? value.delivery_number.trim() : "";
  const customerName = typeof value.customer_name === "string" ? value.customer_name.trim() : "";
  const pickupAddress = typeof value.pickup_address === "string" ? value.pickup_address.trim() : "";
  const deliveryAddress = typeof value.delivery_address === "string" ? value.delivery_address.trim() : "";
  const customerPhone = nullableText(value.customer_phone);
  const driverId = nullableText(value.assigned_driver_id);
  const vehicleId = nullableText(value.assigned_vehicle_id);
  const notes = nullableText(value.notes);
  if (!deliveryNumber || !customerName || !pickupAddress || !deliveryAddress || customerPhone === undefined || driverId === undefined || vehicleId === undefined || notes === undefined || !statuses.includes(value.status as DeliveryStatus) || !priorities.includes(value.priority as DeliveryPriority)) return null;
  return { delivery_number: deliveryNumber, customer_name: customerName, customer_phone: customerPhone, pickup_address: pickupAddress, delivery_address: deliveryAddress, assigned_driver_id: driverId, assigned_vehicle_id: vehicleId, status: value.status as DeliveryStatus, priority: value.priority as DeliveryPriority, notes };
}

async function requesterId(client: SupabaseClient, request: Request) {
  const token = (request.headers.get("authorization") ?? "").split(" ")[1] ?? "";
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

async function resolveAssignment(client: SupabaseClient, input: DeliveryInput) {
  const now = new Date().toISOString();
  let driverId = input.assigned_driver_id;
  let vehicleId = input.assigned_vehicle_id;
  let scheduleId: string | null = null;

  if (driverId || vehicleId) {
    let query = client.from("schedules").select("schedule_id, driver_id, vehicle_id, start_time, end_time").eq("status", "scheduled").lte("start_time", now).gt("end_time", now).order("start_time", { ascending: false }).limit(1);
    query = driverId ? query.eq("driver_id", driverId) : query.eq("vehicle_id", vehicleId);
    const { data: schedules, error } = await query;
    if (error) return { error: error.message, input, scheduleId };
    const activeSchedule = schedules?.[0];
    if (activeSchedule) {
      driverId = activeSchedule.driver_id;
      vehicleId = activeSchedule.vehicle_id;
      scheduleId = activeSchedule.schedule_id;
    }
  }

  if (driverId) {
    const { data: driver, error } = await client.from("drivers").select("driver_id, user_id, availability").eq("driver_id", driverId).maybeSingle();
    if (error) return { error: error.message, input, scheduleId };
    if (!driver?.user_id || driver.availability === "unavailable") return { error: "The assigned driver must exist and be available.", input, scheduleId };
    const { data: profile, error: profileError } = await client.from("profiles").select("profile_id, role, is_active").eq("profile_id", driver.user_id).maybeSingle();
    if (profileError) return { error: profileError.message, input, scheduleId };
    if (profile?.role !== "driver" || profile.is_active !== true) return { error: "The assigned driver must have an active driver profile.", input, scheduleId };
  }

  if (vehicleId) {
    const { data: vehicle, error } = await client.from("vehicles").select("vehicle_id, status").eq("vehicle_id", vehicleId).maybeSingle();
    if (error) return { error: error.message, input, scheduleId };
    if (!vehicle || ["maintenance_due", "out_of_service"].includes(vehicle.status ?? "")) return { error: "The assigned vehicle must be available for operations.", input, scheduleId };
  }

  return { error: null, input: { ...input, assigned_driver_id: driverId, assigned_vehicle_id: vehicleId }, scheduleId };
}

async function recordStatusHistory(client: SupabaseClient, deliveryId: string, status: DeliveryStatus, changedBy: string) {
  const { error: tableError } = await client.from("delivery_status_history").select("*").limit(1);
  if (tableError) return;
  await client.from("delivery_status_history").insert({ delivery_id: deliveryId, status, changed_by: changedBy });
}

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const [deliveriesResponse, driversResponse, vehiclesResponse, schedulesResponse, routesResponse, historyResponse] = await Promise.all([
    authorization.client.from("deliveries").select("delivery_id, delivery_number, customer_name, customer_phone, pickup_address, delivery_address, assigned_driver_id, assigned_vehicle_id, status, priority, notes, created_by, created_at, updated_at").order("created_at", { ascending: false }),
    authorization.client.from("drivers").select("driver_id, user_id, assigned_vehicle_id, availability").order("created_at", { ascending: false }),
    authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, status").order("vehicle_number", { ascending: true }),
    authorization.client.from("schedules").select("schedule_id, driver_id, vehicle_id, shift_name, shift_type, start_time, end_time, status").neq("status", "cancelled").order("start_time", { ascending: true }),
    authorization.client.from("routes").select("route_id, delivery_id, origin_name, origin_address, destination_name, destination_address, estimated_distance_km, estimated_duration_minutes, actual_distance_km, actual_duration_minutes, maps_url, route_provider, sequence_order, created_at"),
    authorization.client.from("delivery_status_history").select("*").order("created_at", { ascending: false }),
  ]);
  const error = deliveriesResponse.error ?? driversResponse.error ?? vehiclesResponse.error ?? schedulesResponse.error ?? routesResponse.error;
  if (error) return apiError(error.message, 400);
  const drivers = driversResponse.data ?? [];
  const userIds = Array.from(new Set(drivers.map((driver) => driver.user_id).filter((id): id is string => Boolean(id))));
  const profilesResponse = userIds.length ? await authorization.client.from("profiles").select("profile_id, first_name, last_name, email, phone, role, is_active").in("profile_id", userIds) : { data: [], error: null };
  if (profilesResponse.error) return apiError(profilesResponse.error.message, 400);
  return Response.json({ deliveries: deliveriesResponse.data ?? [], drivers, profiles: profilesResponse.data ?? [], vehicles: vehiclesResponse.data ?? [], schedules: schedulesResponse.data ?? [], routes: routesResponse.data ?? [], history: historyResponse.error ? [] : historyResponse.data ?? [] });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const createdBy = await requesterId(authorization.client, request);
  if (!createdBy) return apiError("Authentication is required.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const parsed = parseDelivery(isRecord(body) ? body.delivery : null);
  if (!parsed) return apiError("Invalid delivery details.", 400);
  const resolved = await resolveAssignment(authorization.client, parsed);
  if (resolved.error) return apiError(resolved.error, 400);
  const now = new Date().toISOString();
  const { data, error } = await authorization.client.from("deliveries").insert({ ...resolved.input, created_by: createdBy, updated_at: now }).select("delivery_id").single();
  if (error) return apiError(error.code === "23505" ? "That delivery number already exists." : error.message, error.code === "23505" ? 409 : 400);
  await recordStatusHistory(authorization.client, data.delivery_id, resolved.input.status, createdBy);
  return Response.json({ deliveryId: data.delivery_id, scheduleId: resolved.scheduleId }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const changedBy = await requesterId(authorization.client, request);
  if (!changedBy) return apiError("Authentication is required.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const deliveryId = isRecord(body) && typeof body.delivery_id === "string" ? body.delivery_id.trim() : "";
  const parsed = parseDelivery(isRecord(body) ? body.delivery : null);
  if (!deliveryId || !parsed) return apiError("Invalid delivery update request.", 400);
  const { data: existing, error: existingError } = await authorization.client.from("deliveries").select("delivery_id, status").eq("delivery_id", deliveryId).maybeSingle();
  if (existingError || !existing) return apiError(existingError?.message ?? "Delivery not found.", 404);
  const resolved = await resolveAssignment(authorization.client, parsed);
  if (resolved.error) return apiError(resolved.error, 400);
  const { error } = await authorization.client.from("deliveries").update({ ...resolved.input, updated_at: new Date().toISOString() }).eq("delivery_id", deliveryId);
  if (error) return apiError(error.code === "23505" ? "That delivery number already exists." : error.message, error.code === "23505" ? 409 : 400);
  if (existing.status !== resolved.input.status) await recordStatusHistory(authorization.client, deliveryId, resolved.input.status, changedBy);
  return Response.json({ message: "Delivery updated successfully.", scheduleId: resolved.scheduleId });
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const deliveryId = new URL(request.url).searchParams.get("deliveryId")?.trim();
  if (!deliveryId) return apiError("A delivery ID is required.", 400);
  const { error } = await authorization.client.from("deliveries").delete().eq("delivery_id", deliveryId);
  if (error) return apiError(error.message, 400);
  return Response.json({ message: "Delivery deleted successfully." });
}
