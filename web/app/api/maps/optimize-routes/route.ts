import { createClient } from "@supabase/supabase-js";

import { isAdministrator } from "@/lib/roles";
import { apiError } from "@/lib/server/administrator-api";

type Coordinates = { latitude: number; longitude: number };
type Stop = Coordinates & { id: string; serviceDurationSeconds?: number };
type OptimizationRequest = { startLocation?: Coordinates; endLocation?: Coordinates; departureTime?: string; shiftEndTime?: string; stops?: Stop[] };
type GoogleResponse = { routes?: Array<{ visits?: Array<{ shipmentIndex?: number; startTime?: string }>; transitions?: Array<{ travelDuration?: string; travelDistanceMeters?: number }>; routePolyline?: { points?: string; encodedPolyline?: string }; metrics?: { travelDuration?: string; travelDistanceMeters?: number; performedShipmentCount?: number } }>; skippedShipments?: number[]; error?: { code?: number; message?: string; status?: string } };

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function coordinate(value: unknown): Coordinates | null { if (!record(value) || typeof value.latitude !== "number" || typeof value.longitude !== "number" || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || value.latitude < -90 || value.latitude > 90 || value.longitude < -180 || value.longitude > 180) return null; return { latitude: value.latitude, longitude: value.longitude }; }
function seconds(value: string | undefined) { const parsed = Number((value ?? "").replace(/s$/, "")); return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0; }
function duration(value: number) { return `${Math.max(0, Math.round(value))}s`; }
function safeProviderMessage(status: number) { if (status === 401 || status === 403) return "Google Route Optimization authentication was rejected."; if (status === 429) return "Google Route Optimization quota is currently unavailable."; if (status === 400) return "Google Route Optimization rejected the route request."; return "Google Route Optimization could not complete the request."; }

async function authorize(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!url || !key || !token) return apiError("Authentication is required.", 401);
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user } = await client.auth.getUser(token);
  if (!user.user) return apiError("Authentication is required.", 401);
  const { data: profile } = await client.from("profiles").select("role, is_active").eq("profile_id", user.user.id).maybeSingle<{ role: string | null; is_active: boolean | null }>();
  if (!profile?.is_active || (!isAdministrator(profile.role) && profile.role !== "dispatcher")) return apiError("Administrator or Dispatcher access is required.", 403);
  return null;
}

export async function POST(request: Request) {
  const authorizationError = await authorize(request); if (authorizationError) return authorizationError;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID; const apiKey = process.env.GOOGLE_ROUTE_OPTIMIZATION_API_KEY;
  if (!projectId || !apiKey) return apiError("Google Route Optimization is not configured.", 500);
  let body: unknown; try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const input = record(body) ? body as OptimizationRequest : {}; const start = coordinate(input.startLocation); const end = input.endLocation === undefined ? null : coordinate(input.endLocation);
  const departure = typeof input.departureTime === "string" ? new Date(input.departureTime) : null; const shiftEnd = typeof input.shiftEndTime === "string" ? new Date(input.shiftEndTime) : null;
  const stops = Array.isArray(input.stops) ? input.stops.map((stop) => { const location = coordinate(stop); return location && record(stop) && typeof stop.id === "string" && stop.id.trim() ? { ...location, id: stop.id.trim(), serviceDurationSeconds: typeof stop.serviceDurationSeconds === "number" && Number.isFinite(stop.serviceDurationSeconds) && stop.serviceDurationSeconds >= 0 ? Math.round(stop.serviceDurationSeconds) : 600 } : null; }) : [];
  if (!start || (input.endLocation !== undefined && !end)) return apiError("A valid starting and optional ending location are required.", 400);
  if (stops.length < 2 || stops.some((stop) => !stop)) return apiError("Select at least two deliveries with valid mapped coordinates.", 400);
  if (!departure || !shiftEnd || Number.isNaN(departure.getTime()) || Number.isNaN(shiftEnd.getTime()) || shiftEnd <= departure) return apiError("Shift end time must be later than departure time.", 400);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`https://routeoptimization.googleapis.com/v1/projects/${encodeURIComponent(projectId)}:optimizeTours?key=${encodeURIComponent(apiKey)}`, { method: "POST", cache: "no-store", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ populatePolylines: true, populateTransitionPolylines: true, considerRoadTraffic: true, model: { globalStartTime: departure.toISOString(), globalEndTime: shiftEnd.toISOString(), shipments: stops.map((stop) => ({ label: stop!.id, deliveries: [{ arrivalLocation: { latLng: { latitude: stop!.latitude, longitude: stop!.longitude } }, duration: duration(stop!.serviceDurationSeconds) }] })), vehicles: [{ startLocation: { latLng: start }, ...(end ? { endLocation: { latLng: end } } : {}), startTimeWindows: [{ startTime: departure.toISOString(), endTime: departure.toISOString() }], endTimeWindows: [{ startTime: shiftEnd.toISOString(), endTime: shiftEnd.toISOString() }], costPerHour: 1 }] } }) });
    const google = await response.json().catch(() => ({})) as GoogleResponse;
    if (!response.ok) return apiError(safeProviderMessage(response.status), response.status === 400 ? 400 : 502);
    const route = google.routes?.[0]; if (!route?.visits?.length) return apiError("No optimized visits were returned for this route.", 422);
    const optimizedStops = route.visits.flatMap((visit, index) => { const shipmentIndex = visit.shipmentIndex; const stop = typeof shipmentIndex === "number" ? stops[shipmentIndex] : null; return stop ? [{ deliveryId: stop.id, sequence: index + 1, estimatedArrivalTime: visit.startTime ?? null, serviceDurationSeconds: stop.serviceDurationSeconds }] : []; });
    const skipped = (google.skippedShipments ?? []).flatMap((index) => stops[index] ? [stops[index].id] : []);
    const totalDurationSeconds = seconds(route.metrics?.travelDuration) || route.transitions?.reduce((sum, transition) => sum + seconds(transition.travelDuration), 0) || 0;
    const totalDistanceMeters = route.metrics?.travelDistanceMeters ?? route.transitions?.reduce((sum, transition) => sum + (transition.travelDistanceMeters ?? 0), 0) ?? 0;
    return Response.json({ optimizedStops, route: { encodedPolyline: route.routePolyline?.encodedPolyline ?? route.routePolyline?.points ?? "" }, skippedShipments: skipped, metrics: { totalDistanceMeters, totalDurationSeconds, estimatedCompletionTime: new Date(departure.getTime() + totalDurationSeconds * 1000).toISOString() } });
  } catch (error) { return apiError(error instanceof Error && error.name === "AbortError" ? "Route optimization timed out. Please try again." : "Route optimization could not be completed.", 502); } finally { clearTimeout(timeout); }
}
