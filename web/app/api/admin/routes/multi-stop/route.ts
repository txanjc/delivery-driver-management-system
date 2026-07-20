import { apiError, authorizeOperationsRequest } from "@/lib/server/administrator-api";

type StopInput = { deliveryId: string; sequence: number; originalSequence: number; estimatedArrivalTime: string | null; serviceDurationSeconds: number };
type Coordinates = { latitude: number; longitude: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isoTime(value: unknown) {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function coordinates(value: unknown): Coordinates | null {
  if (!isRecord(value) || typeof value.latitude !== "number" || typeof value.longitude !== "number") return null;
  if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || value.latitude < -90 || value.latitude > 90 || value.longitude < -180 || value.longitude > 180) return null;
  return { latitude: value.latitude, longitude: value.longitude };
}

function parseStop(value: unknown): StopInput | null {
  if (!isRecord(value)) return null;
  const deliveryId = text(value.deliveryId);
  const sequence = value.sequence;
  const originalSequence = value.originalSequence;
  const estimatedArrivalTime = value.estimatedArrivalTime === null ? null : isoTime(value.estimatedArrivalTime);
  const serviceDurationSeconds = value.serviceDurationSeconds;
  if (!deliveryId || typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 1 || typeof originalSequence !== "number" || !Number.isInteger(originalSequence) || originalSequence < 1 || typeof serviceDurationSeconds !== "number" || !Number.isFinite(serviceDurationSeconds) || serviceDurationSeconds < 0) return null;
  return { deliveryId, sequence, originalSequence, estimatedArrivalTime, serviceDurationSeconds: Math.round(serviceDurationSeconds) };
}

function safeErrorMessage(message: string) {
  const safe = new Set([
    "The optimized route details are incomplete.",
    "The optimized route timing or starting location is invalid.",
    "This optimized preview has already been saved.",
    "Active operational access is required.",
    "The selected driver is no longer operationally eligible.",
    "The selected vehicle is no longer operationally eligible.",
    "The selected schedule no longer matches this route setup.",
    "At least one optimized stop is required.",
    "Optimized stop data is invalid.",
    "One or more deliveries are no longer eligible for this route.",
  ]);
  return safe.has(message) ? message : "The optimized route could not be saved. Please refresh the route setup and try again.";
}

export async function POST(request: Request) {
  const authorization = await authorizeOperationsRequest(request);
  if (!authorization.client || !authorization.userId) return authorization.response ?? apiError("Authentication is required.", 401);

  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  if (!isRecord(body)) return apiError("Invalid optimized route request.", 400);

  const previewId = text(body.previewId);
  const routeDate = text(body.routeDate);
  const driverId = text(body.driverId);
  const vehicleId = text(body.vehicleId);
  const scheduleId = text(body.scheduleId);
  const startLocation = isRecord(body.startLocation) ? body.startLocation : null;
  const startCoordinates = coordinates(startLocation);
  const startAddress = startLocation ? text(startLocation.address) : "";
  const startName = startLocation ? text(startLocation.name) : "";
  const startPlaceId = startLocation ? text(startLocation.placeId) : "";
  const returnToDepot = typeof body.returnToDepot === "boolean" ? body.returnToDepot : null;
  const departureTime = isoTime(body.departureTime);
  const shiftEndTime = isoTime(body.shiftEndTime);
  const estimatedCompletionTime = isoTime(body.estimatedCompletionTime);
  const totalDistanceMeters = body.totalDistanceMeters;
  const totalDurationSeconds = body.totalDurationSeconds;
  const encodedPolyline = text(body.encodedPolyline);
  const stops = Array.isArray(body.stops) ? body.stops.map(parseStop) : [];
  const skippedDeliveryIds = Array.isArray(body.skippedDeliveryIds) && body.skippedDeliveryIds.every((id) => typeof id === "string" && id.trim()) ? body.skippedDeliveryIds.map((id) => id.trim()) : null;
  const selectedDeliveryIds = Array.isArray(body.selectedDeliveryIds) && body.selectedDeliveryIds.every((id) => typeof id === "string" && id.trim()) ? body.selectedDeliveryIds.map((id) => id.trim()) : null;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previewId) || !/^\d{4}-\d{2}-\d{2}$/.test(routeDate) || !driverId || !vehicleId || !scheduleId || !startCoordinates || !startAddress || returnToDepot === null || !departureTime || !shiftEndTime || !estimatedCompletionTime || typeof totalDistanceMeters !== "number" || !Number.isFinite(totalDistanceMeters) || totalDistanceMeters < 0 || typeof totalDurationSeconds !== "number" || !Number.isFinite(totalDurationSeconds) || totalDurationSeconds < 0 || !encodedPolyline || !skippedDeliveryIds || !selectedDeliveryIds || !stops.length || stops.some((stop) => stop === null)) return apiError("Invalid optimized route request.", 400);

  const validStops = stops.filter((stop): stop is StopInput => stop !== null);
  const stopIds = validStops.map((stop) => stop.deliveryId);
  const uniqueStopIds = new Set(stopIds);
  const uniqueStopSequences = new Set(validStops.map((stop) => stop.sequence));
  const skippedIds = new Set(skippedDeliveryIds);
  const selectedIds = new Set(selectedDeliveryIds);
  const allSubmittedIds = new Set([...stopIds, ...skippedDeliveryIds]);
  if (uniqueStopIds.size !== stopIds.length || uniqueStopSequences.size !== validStops.length || skippedIds.size !== skippedDeliveryIds.length || stopIds.some((id) => skippedIds.has(id)) || allSubmittedIds.size !== selectedIds.size || [...allSubmittedIds].some((id) => !selectedIds.has(id))) return apiError("The optimized delivery selection is inconsistent. Optimize the route again before saving.", 409);

  const { data, error } = await authorization.client.rpc("save_optimized_multi_stop_route", {
    p_preview_id: previewId,
    p_created_by: authorization.userId,
    p_route_date: routeDate,
    p_driver_id: driverId,
    p_vehicle_id: vehicleId,
    p_schedule_id: scheduleId,
    p_start_location_name: startName || null,
    p_start_address: startAddress,
    p_start_place_id: startPlaceId || null,
    p_start_latitude: startCoordinates.latitude,
    p_start_longitude: startCoordinates.longitude,
    p_return_to_depot: returnToDepot,
    p_departure_time: departureTime,
    p_shift_end_time: shiftEndTime,
    p_estimated_completion_time: estimatedCompletionTime,
    p_total_distance_meters: Math.round(totalDistanceMeters),
    p_total_duration_seconds: Math.round(totalDurationSeconds),
    p_encoded_polyline: encodedPolyline,
    p_stops: validStops.map((stop) => ({ delivery_id: stop.deliveryId, stop_sequence: stop.sequence, original_sequence: stop.originalSequence, estimated_arrival_time: stop.estimatedArrivalTime, service_duration_seconds: stop.serviceDurationSeconds })),
    p_skipped_delivery_ids: skippedDeliveryIds,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    const conflictMessages = new Set([
      "This optimized preview has already been saved.",
      "One or more deliveries are no longer eligible for this route.",
    ]);
    return apiError(safeErrorMessage(error?.message ?? ""), conflictMessages.has(error?.message ?? "") ? 409 : 400);
  }

  const saved = data[0] as { route_id?: string; route_number?: string; route_status?: string; stop_count?: number; saved_at?: string };
  if (!saved.route_id || !saved.route_number || typeof saved.stop_count !== "number") return apiError("The optimized route could not be saved. Please refresh the route setup and try again.", 500);
  const savedAt = saved.saved_at ?? new Date().toISOString();
  return Response.json({
    routeId: saved.route_id,
    routeNumber: saved.route_number,
    status: saved.route_status ?? "planned",
    routeDate,
    driver: { id: driverId },
    vehicle: { id: vehicleId },
    schedule: { id: scheduleId },
    stopCount: saved.stop_count,
    stops: validStops
      .sort((left, right) => left.sequence - right.sequence)
      .map((stop) => ({
        deliveryId: stop.deliveryId,
        sequence: stop.sequence,
        originalSequence: stop.originalSequence,
        estimatedArrivalTime: stop.estimatedArrivalTime,
        serviceDurationSeconds: stop.serviceDurationSeconds,
      })),
    startLocation: {
      name: startName || startAddress,
      address: startAddress,
      placeId: startPlaceId || null,
      latitude: startCoordinates.latitude,
      longitude: startCoordinates.longitude,
    },
    endBehavior: returnToDepot ? "return_to_depot" : "final_stop",
    encodedPolyline,
    metrics: {
      totalDistanceMeters: Math.round(totalDistanceMeters),
      totalDurationSeconds: Math.round(totalDurationSeconds),
      estimatedCompletionTime,
    },
    createdAt: savedAt,
    updatedAt: savedAt,
  }, { status: 201 });
}
