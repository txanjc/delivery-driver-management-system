import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";
import { findRelevantAssignment, isVehicleOperational } from "@/lib/operations";
import { notificationPaths, notifyOperationalEvent } from "@/lib/server/notification-service";

const statuses = ["pending", "assigned", "in_transit", "delivered", "delayed", "failed", "returned"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;

type DeliveryStatus = (typeof statuses)[number];
type DeliveryPriority = (typeof priorities)[number];
type DeliveryInput = {
  delivery_number: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_address: string;
  pickup_place_id: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  delivery_address: string;
  delivery_place_id: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
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

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

function validLatitude(value: number | null) {
  return value === null || (value >= -90 && value <= 90);
}

function validLongitude(value: number | null) {
  return value === null || (value >= -180 && value <= 180);
}

function hasCoordinateMismatch(latitude: number | null, longitude: number | null) {
  return (latitude === null) !== (longitude === null);
}

function mappedLocationChanged(existing: Record<string, unknown>, input: DeliveryInput) {
  const sameNumber = (left: unknown, right: number | null) => {
    if (left === null && right === null) return true;
    return typeof left === "number" && right !== null && Math.abs(left - right) < 0.000001;
  };
  return existing.pickup_address !== input.pickup_address
    || existing.pickup_place_id !== input.pickup_place_id
    || !sameNumber(existing.pickup_latitude, input.pickup_latitude)
    || !sameNumber(existing.pickup_longitude, input.pickup_longitude)
    || existing.delivery_address !== input.delivery_address
    || existing.delivery_place_id !== input.delivery_place_id
    || !sameNumber(existing.delivery_latitude, input.delivery_latitude)
    || !sameNumber(existing.delivery_longitude, input.delivery_longitude);
}

function parseDelivery(value: unknown): DeliveryInput | null {
  if (!isRecord(value)) return null;
  const deliveryNumber = typeof value.delivery_number === "string" ? value.delivery_number.trim() : "";
  const customerName = typeof value.customer_name === "string" ? value.customer_name.trim() : "";
  const pickupAddress = typeof value.pickup_address === "string" ? value.pickup_address.trim() : "";
  const deliveryAddress = typeof value.delivery_address === "string" ? value.delivery_address.trim() : "";
  const customerPhone = nullableText(value.customer_phone);
  const pickupPlaceId = nullableText(value.pickup_place_id);
  const pickupLatitude = nullableNumber(value.pickup_latitude);
  const pickupLongitude = nullableNumber(value.pickup_longitude);
  const deliveryPlaceId = nullableText(value.delivery_place_id);
  const deliveryLatitude = nullableNumber(value.delivery_latitude);
  const deliveryLongitude = nullableNumber(value.delivery_longitude);
  const driverId = nullableText(value.assigned_driver_id);
  const vehicleId = nullableText(value.assigned_vehicle_id);
  const notes = nullableText(value.notes);
  if (!deliveryNumber || !customerName || !pickupAddress || !deliveryAddress || customerPhone === undefined || pickupPlaceId === undefined || pickupLatitude === undefined || pickupLongitude === undefined || deliveryPlaceId === undefined || deliveryLatitude === undefined || deliveryLongitude === undefined || driverId === undefined || vehicleId === undefined || notes === undefined || !statuses.includes(value.status as DeliveryStatus) || !priorities.includes(value.priority as DeliveryPriority)) return null;
  if (!validLatitude(pickupLatitude) || !validLongitude(pickupLongitude) || !validLatitude(deliveryLatitude) || !validLongitude(deliveryLongitude)) return null;
  if (hasCoordinateMismatch(pickupLatitude, pickupLongitude) || hasCoordinateMismatch(deliveryLatitude, deliveryLongitude)) return null;
  return { delivery_number: deliveryNumber, customer_name: customerName, customer_phone: customerPhone, pickup_address: pickupAddress, pickup_place_id: pickupPlaceId, pickup_latitude: pickupLatitude, pickup_longitude: pickupLongitude, delivery_address: deliveryAddress, delivery_place_id: deliveryPlaceId, delivery_latitude: deliveryLatitude, delivery_longitude: deliveryLongitude, assigned_driver_id: driverId, assigned_vehicle_id: vehicleId, status: value.status as DeliveryStatus, priority: value.priority as DeliveryPriority, notes };
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

  if (driverId) {
    const { data: schedules, error } = await client.from("schedules").select("schedule_id, driver_id, vehicle_id, start_time, end_time, status").eq("driver_id", driverId).neq("status", "cancelled").gt("end_time", now).not("vehicle_id", "is", null).order("start_time", { ascending: true });
    if (error) return { error: error.message, input, scheduleId };
    const relevantSchedule = findRelevantAssignment(schedules ?? []);
    if (!relevantSchedule?.vehicle_id) {
      return { error: "The assigned driver must have an active or upcoming vehicle schedule.", input, scheduleId };
    }
    if (vehicleId && vehicleId !== relevantSchedule.vehicle_id) {
      return { error: "The assigned vehicle must match the driver's schedule.", input, scheduleId };
    }
    driverId = relevantSchedule.driver_id;
    vehicleId = relevantSchedule.vehicle_id;
    scheduleId = relevantSchedule.schedule_id ?? null;
  } else if (vehicleId) {
    return { error: "Select a scheduled driver so the vehicle can be derived from the schedule.", input, scheduleId };
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
    if (!vehicle || !isVehicleOperational(vehicle.status)) return { error: "The assigned vehicle must be available for operations.", input, scheduleId };
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
    authorization.client.from("deliveries").select("delivery_id, delivery_number, customer_name, customer_phone, pickup_address, pickup_place_id, pickup_latitude, pickup_longitude, delivery_address, delivery_place_id, delivery_latitude, delivery_longitude, assigned_driver_id, assigned_vehicle_id, status, priority, notes, created_by, created_at, updated_at").order("created_at", { ascending: false }),
    authorization.client.from("drivers").select("driver_id, user_id, assigned_vehicle_id, availability").order("created_at", { ascending: false }),
    authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, status").order("vehicle_number", { ascending: true }),
    authorization.client.from("schedules").select("schedule_id, driver_id, vehicle_id, shift_name, shift_type, start_time, end_time, status").neq("status", "cancelled").order("start_time", { ascending: true }),
    authorization.client.from("routes").select("route_id, delivery_id, origin, destination, origin_name, origin_address, destination_name, destination_address, estimated_distance_km, estimated_duration_minutes, actual_distance_km, actual_duration_minutes, maps_url, route_provider, sequence_order, created_at"),
    authorization.client.from("delivery_status_history").select("*").order("created_at", { ascending: false }),
  ]);
  const error = deliveriesResponse.error ?? driversResponse.error ?? vehiclesResponse.error ?? schedulesResponse.error ?? routesResponse.error;
  if (error) return apiError(error.message, 400);
  const drivers = driversResponse.data ?? [];
  const creatorIds = (deliveriesResponse.data ?? []).map((delivery) => delivery.created_by).filter((id): id is string => Boolean(id));
  const userIds = Array.from(new Set([...drivers.map((driver) => driver.user_id).filter((id): id is string => Boolean(id)), ...creatorIds]));
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
  if (resolved.input.assigned_driver_id) await notifyOperationalEvent(authorization.client, {
    type: "delivery_assignment", key: `delivery-assignment:${data.delivery_id}:${resolved.input.assigned_driver_id}:${resolved.input.assigned_vehicle_id ?? "none"}`, title: `Delivery ${resolved.input.delivery_number} assigned to you`, message: "A dispatcher assigned a delivery to your schedule.", tone: "blue", badge: "Delivery assignment", module: "deliveries", relatedId: data.delivery_id, actionPath: notificationPaths.delivery(data.delivery_id), driverActionPath: `/delivery/${data.delivery_id}`, actionLabel: "View assigned delivery", driverIds: [resolved.input.assigned_driver_id], recipientRoles: ["driver"], details: [{ label: "Delivery", value: resolved.input.delivery_number }, { label: "Scheduled", value: resolved.scheduleId ? "Active shift" : null }, { label: "Pickup", value: resolved.input.pickup_address }, { label: "Destination", value: resolved.input.delivery_address }, { label: "Priority", value: resolved.input.priority }, { label: "Notes", value: resolved.input.notes }],
  });
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
  const { data: existing, error: existingError } = await authorization.client.from("deliveries").select("delivery_id, delivery_number, status, priority, notes, assigned_driver_id, assigned_vehicle_id, pickup_address, pickup_place_id, pickup_latitude, pickup_longitude, delivery_address, delivery_place_id, delivery_latitude, delivery_longitude").eq("delivery_id", deliveryId).maybeSingle();
  if (existingError || !existing) return apiError(existingError?.message ?? "Delivery not found.", 404);
  const resolved = await resolveAssignment(authorization.client, parsed);
  if (resolved.error) return apiError(resolved.error, 400);
  const { error } = await authorization.client.from("deliveries").update({ ...resolved.input, updated_at: new Date().toISOString() }).eq("delivery_id", deliveryId);
  if (error) return apiError(error.code === "23505" ? "That delivery number already exists." : error.message, error.code === "23505" ? 409 : 400);
  if (mappedLocationChanged(existing, resolved.input)) {
    await authorization.client.from("routes").update({ origin: resolved.input.pickup_address, destination: resolved.input.delivery_address, origin_address: resolved.input.pickup_address, origin_latitude: resolved.input.pickup_latitude, origin_longitude: resolved.input.pickup_longitude, destination_address: resolved.input.delivery_address, destination_latitude: resolved.input.delivery_latitude, destination_longitude: resolved.input.delivery_longitude, estimated_distance_km: null, estimated_duration_minutes: null, route_polyline: null, maps_url: null, route_provider: "stale_delivery_address", route_generated_at: null }).eq("delivery_id", deliveryId);
  }
  if (existing.status !== resolved.input.status) await recordStatusHistory(authorization.client, deliveryId, resolved.input.status, changedBy);
  const assignmentChanged = existing.assigned_driver_id !== resolved.input.assigned_driver_id || existing.assigned_vehicle_id !== resolved.input.assigned_vehicle_id;
  if (assignmentChanged && resolved.input.assigned_driver_id) await notifyOperationalEvent(authorization.client, {
    type: "delivery_assignment", key: `delivery-assignment:${deliveryId}:${resolved.input.assigned_driver_id}:${resolved.input.assigned_vehicle_id ?? "none"}`, title: `Delivery ${resolved.input.delivery_number} assigned to you`, message: "Your delivery assignment was created or updated.", tone: "blue", badge: "Delivery assignment", module: "deliveries", relatedId: deliveryId, actionPath: notificationPaths.delivery(deliveryId), driverActionPath: `/delivery/${deliveryId}`, actionLabel: "View assigned delivery", driverIds: [resolved.input.assigned_driver_id], recipientRoles: ["driver"], details: [{ label: "Delivery", value: resolved.input.delivery_number }, { label: "Pickup", value: resolved.input.pickup_address }, { label: "Destination", value: resolved.input.delivery_address }, { label: "Priority", value: resolved.input.priority }, { label: "Notes", value: resolved.input.notes }],
  });
  if (existing.status !== resolved.input.status && ["delayed", "failed", "returned", "delivered"].includes(resolved.input.status)) {
    const status = resolved.input.status;
    const isDelay = status === "delayed";
    const isCompleted = status === "delivered";
    const recipientRoles = isCompleted ? ["dispatcher"] as const : isDelay && !["high", "urgent"].includes(resolved.input.priority) ? ["dispatcher"] as const : ["dispatcher", "administrator"] as const;
    const signatureResponse = isCompleted ? await authorization.client.from("delivery_signatures").select("*").eq("delivery_id", deliveryId).limit(1) : null;
    const proofOfDelivery = signatureResponse?.error ? null : isCompleted ? signatureResponse?.data?.length ? "Signature captured" : "No signature captured" : null;
    await notifyOperationalEvent(authorization.client, {
      type: status === "delayed" ? "delivery_delayed" : status === "failed" ? "delivery_failed" : status === "returned" ? "delivery_returned" : "delivery_completed", key: `delivery-status:${deliveryId}:${status}:${new Date().toISOString()}`, title: `Delivery ${resolved.input.delivery_number} ${status}`, message: isCompleted ? "The delivery was marked complete." : `The delivery status changed to ${status}.`, tone: isCompleted ? "green" : isDelay ? "orange" : "red", badge: isCompleted ? "Completed" : status === "failed" ? "Required action" : status === "returned" ? "Returned" : "Delay", module: "deliveries", relatedId: deliveryId, actionPath: notificationPaths.delivery(deliveryId), actionLabel: isCompleted ? "View delivery" : status === "failed" ? "Review or reassign delivery" : "Review delivery", recipientRoles: [...recipientRoles], priority: resolved.input.priority, critical: !isDelay || ["high", "urgent"].includes(resolved.input.priority), details: [{ label: "Delivery", value: resolved.input.delivery_number }, { label: "Driver", value: resolved.input.assigned_driver_id ? "Assigned driver" : null }, { label: "Vehicle", value: resolved.input.assigned_vehicle_id ? "Assigned vehicle" : null }, { label: "Pickup", value: resolved.input.pickup_address }, { label: "Destination", value: resolved.input.delivery_address }, { label: status === "delivered" ? "Proof of delivery" : "Reason or notes", value: status === "delivered" ? proofOfDelivery : resolved.input.notes }, { label: "Updated", value: new Date().toLocaleString("en-US") }],
    });
  }
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
