import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

function rowName(row: { first_name: string | null; last_name: string | null; email: string | null }) { return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "Not recorded"; }
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const [driversResult, profilesResult, vehiclesResult, deliveriesResult, routesResult, schedulesResult] = await Promise.all([
    authorization.client.from("drivers").select("driver_id, user_id"),
    authorization.client.from("profiles").select("profile_id, first_name, last_name, email"),
    authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate"),
    authorization.client.from("deliveries").select("delivery_id, delivery_number"),
    authorization.client.from("routes").select("route_id, delivery_id"),
    authorization.client.from("schedules").select("shift_name, shift_type"),
  ]);
  const error = driversResult.error ?? profilesResult.error ?? vehiclesResult.error ?? deliveriesResult.error ?? routesResult.error ?? schedulesResult.error;
  if (error) return apiError("Report filters could not be loaded.", 400);
  const profiles = profilesResult.data ?? []; const deliveries = deliveriesResult.data ?? [];
  const profileNames = new Map(profiles.map((row) => [row.profile_id, rowName(row)])); const deliveryNames = new Map(deliveries.map((row) => [row.delivery_id, row.delivery_number ?? "Unnumbered"]));
  return Response.json({
    drivers: (driversResult.data ?? []).map((row) => ({ value: row.driver_id, label: profileNames.get(row.user_id ?? "") ?? "Not recorded" })),
    vehicles: (vehiclesResult.data ?? []).map((row) => ({ value: row.vehicle_id, label: row.vehicle_number || row.license_plate || "Not recorded" })),
    deliveries: deliveries.map((row) => ({ value: row.delivery_id, label: row.delivery_number ?? "Unnumbered" })),
    routes: (routesResult.data ?? []).map((row) => ({ value: row.route_id, label: deliveryNames.get(row.delivery_id ?? "") ?? row.route_id })),
    shifts: [...new Set((schedulesResult.data ?? []).map((row) => row.shift_name || row.shift_type).filter((value): value is string => Boolean(value)))].map((value) => ({ value, label: label(value) })),
    users: profiles.map((row) => ({ value: row.profile_id, label: rowName(row) })),
  });
}
