import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";
import type { SupabaseClient } from "@supabase/supabase-js";

type RouteInput = {
  delivery_id: string;
  origin_name: string | null;
  origin_address: string;
  origin_latitude: number | null;
  origin_longitude: number | null;
  destination_name: string | null;
  destination_address: string;
  destination_latitude: number | null;
  destination_longitude: number | null;
  estimated_distance_km: number | null;
  estimated_duration_minutes: number | null;
  route_polyline: string | null;
  sequence_order: number | null;
  maps_url: string | null;
  route_provider: string | null;
};

type MappedDelivery = {
  delivery_id: string;
  pickup_address: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
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
  return undefined;
}

function coordinatesMatch(left: number | null, right: number | null) {
  return left !== null && right !== null && Math.abs(left - right) < 0.000001;
}

function parseRoute(value: unknown): RouteInput | null {
  if (!isRecord(value)) return null;
  const deliveryId = typeof value.delivery_id === "string" ? value.delivery_id.trim() : "";
  const originAddress = typeof value.origin_address === "string" ? value.origin_address.trim() : "";
  const destinationAddress = typeof value.destination_address === "string" ? value.destination_address.trim() : "";
  const originName = nullableText(value.origin_name); const destinationName = nullableText(value.destination_name); const mapsUrl = nullableText(value.maps_url); const provider = nullableText(value.route_provider); const polyline = nullableText(value.route_polyline);
  const originLatitude = nullableNumber(value.origin_latitude); const originLongitude = nullableNumber(value.origin_longitude); const destinationLatitude = nullableNumber(value.destination_latitude); const destinationLongitude = nullableNumber(value.destination_longitude); const distance = nullableNumber(value.estimated_distance_km); const duration = nullableNumber(value.estimated_duration_minutes); const sequence = nullableNumber(value.sequence_order);
  if (!deliveryId || !originAddress || !destinationAddress || originName === undefined || destinationName === undefined || mapsUrl === undefined || provider === undefined || polyline === undefined || originLatitude === undefined || originLongitude === undefined || destinationLatitude === undefined || destinationLongitude === undefined || distance === undefined || duration === undefined || sequence === undefined) return null;
  if (mapsUrl) { try { const url = new URL(mapsUrl); if (!["http:", "https:"].includes(url.protocol)) return null; } catch { return null; } }
  if ([distance, duration, sequence].some((item) => item !== null && item < 0)) return null;
  if (originLatitude === null || originLongitude === null || destinationLatitude === null || destinationLongitude === null || distance === null || duration === null || !mapsUrl || !polyline) return null;
  if (originLatitude < -90 || originLatitude > 90 || destinationLatitude < -90 || destinationLatitude > 90 || originLongitude < -180 || originLongitude > 180 || destinationLongitude < -180 || destinationLongitude > 180) return null;
  return { delivery_id: deliveryId, origin_name: originName, origin_address: originAddress, origin_latitude: originLatitude, origin_longitude: originLongitude, destination_name: destinationName, destination_address: destinationAddress, destination_latitude: destinationLatitude, destination_longitude: destinationLongitude, estimated_distance_km: distance, estimated_duration_minutes: duration === null ? null : Math.round(duration), route_polyline: polyline, sequence_order: sequence === null ? null : Math.round(sequence), maps_url: mapsUrl, route_provider: provider };
}

async function validateDelivery(client: SupabaseClient, deliveryId: string, routeId?: string) {
  const { data: delivery, error } = await client.from("deliveries").select("delivery_id, pickup_address, pickup_latitude, pickup_longitude, delivery_address, delivery_latitude, delivery_longitude, assigned_driver_id, assigned_vehicle_id").eq("delivery_id", deliveryId).maybeSingle<MappedDelivery>();
  if (error || !delivery) return { delivery: null, error: error?.message ?? "The selected delivery does not exist." };
  if (!delivery.pickup_address || !delivery.delivery_address) return { delivery: null, error: "The selected delivery must have pickup and delivery addresses before a route can be created." };
  if (delivery.pickup_latitude === null || delivery.pickup_longitude === null || delivery.delivery_latitude === null || delivery.delivery_longitude === null) return { delivery: null, error: "This delivery was created before mapped address data was stored. Edit the delivery and reselect its pickup and delivery addresses from Google Places." };
  let duplicateQuery = client.from("routes").select("route_id").eq("delivery_id", deliveryId).limit(1);
  if (routeId) duplicateQuery = duplicateQuery.neq("route_id", routeId);
  const { data: duplicate, error: duplicateError } = await duplicateQuery;
  if (duplicateError) return { delivery: null, error: duplicateError.message };
  if (duplicate?.length) return { delivery: null, error: "A route already exists for this delivery." };
  return { delivery, error: null };
}

function routeMatchesDelivery(route: RouteInput, delivery: MappedDelivery) {
  return route.origin_address === delivery.pickup_address
    && route.destination_address === delivery.delivery_address
    && coordinatesMatch(route.origin_latitude, delivery.pickup_latitude)
    && coordinatesMatch(route.origin_longitude, delivery.pickup_longitude)
    && coordinatesMatch(route.destination_latitude, delivery.delivery_latitude)
    && coordinatesMatch(route.destination_longitude, delivery.delivery_longitude);
}

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const [routesResponse, deliveriesResponse, driversResponse, vehiclesResponse, schedulesResponse] = await Promise.all([
    authorization.client.from("routes").select("route_id, delivery_id, origin_name, origin_address, origin_latitude, origin_longitude, destination_name, destination_address, destination_latitude, destination_longitude, estimated_distance_km, estimated_duration_minutes, actual_distance_km, actual_duration_minutes, route_polyline, maps_url, route_provider, route_generated_at, sequence_order, created_at").order("created_at", { ascending: false }),
    authorization.client.from("deliveries").select("delivery_id, delivery_number, customer_name, pickup_address, pickup_place_id, pickup_latitude, pickup_longitude, delivery_address, delivery_place_id, delivery_latitude, delivery_longitude, assigned_driver_id, assigned_vehicle_id, status, priority, updated_at").order("delivery_number", { ascending: true }),
    authorization.client.from("drivers").select("driver_id, user_id, availability"),
    authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, status"),
    authorization.client.from("schedules").select("schedule_id, driver_id, vehicle_id, shift_name, start_time, end_time, status").neq("status", "cancelled"),
  ]);
  const error = routesResponse.error ?? deliveriesResponse.error ?? driversResponse.error ?? vehiclesResponse.error ?? schedulesResponse.error;
  if (error) return apiError(error.message, 400);
  const drivers = driversResponse.data ?? [];
  const profileIds = drivers.map((driver) => driver.user_id).filter((id): id is string => Boolean(id));
  const profilesResponse = profileIds.length ? await authorization.client.from("profiles").select("profile_id, first_name, last_name, email, phone, is_active").in("profile_id", profileIds) : { data: [], error: null };
  if (profilesResponse.error) return apiError(profilesResponse.error.message, 400);
  return Response.json({ routes: routesResponse.data ?? [], deliveries: deliveriesResponse.data ?? [], drivers, profiles: profilesResponse.data ?? [], vehicles: vehiclesResponse.data ?? [], schedules: schedulesResponse.data ?? [] });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const route = parseRoute(isRecord(body) ? body.route : null);
  if (!route) return apiError("Invalid route details.", 400);
  const validation = await validateDelivery(authorization.client, route.delivery_id);
  if (validation.error || !validation.delivery) return apiError(validation.error ?? "Delivery not found.", 400);
  if (!routeMatchesDelivery(route, validation.delivery)) return apiError("Route details must match the selected delivery's mapped address data.", 400);
  const { data, error } = await authorization.client.from("routes").insert({ ...route, route_provider: route.route_provider ?? "manual", route_generated_at: new Date().toISOString() }).select("route_id").single();
  if (error) return apiError(error.message, 400);
  return Response.json({ routeId: data.route_id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const routeId = isRecord(body) && typeof body.route_id === "string" ? body.route_id.trim() : "";
  const route = parseRoute(isRecord(body) ? body.route : null);
  if (!routeId || !route) return apiError("Invalid route update request.", 400);
  const { data: existing, error: existingError } = await authorization.client.from("routes").select("route_id").eq("route_id", routeId).maybeSingle();
  if (existingError || !existing) return apiError(existingError?.message ?? "Route not found.", 404);
  const validation = await validateDelivery(authorization.client, route.delivery_id, routeId);
  if (validation.error) return apiError(validation.error, 400);
  if (validation.delivery && !routeMatchesDelivery(route, validation.delivery)) return apiError("Route details must match the selected delivery's mapped address data.", 400);
  const { error } = await authorization.client.from("routes").update({ ...route, route_generated_at: new Date().toISOString() }).eq("route_id", routeId);
  if (error) return apiError(error.message, 400);
  return Response.json({ message: "Route updated successfully." });
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const routeId = new URL(request.url).searchParams.get("routeId")?.trim();
  if (!routeId) return apiError("A route ID is required.", 400);
  const { error } = await authorization.client.from("routes").delete().eq("route_id", routeId);
  if (error) return apiError(error.message, 400);
  return Response.json({ message: "Route deleted successfully." });
}
