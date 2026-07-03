import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const [routesResponse, deliveriesResponse] = await Promise.all([
    authorization.client.from("routes").select("route_id, delivery_id, origin_name, origin_address, origin_latitude, origin_longitude, destination_name, destination_address, destination_latitude, destination_longitude, estimated_distance_km, estimated_duration_minutes, actual_distance_km, actual_duration_minutes, route_polyline, maps_url, route_provider, route_generated_at, sequence_order, created_at, deliveries:delivery_id (delivery_id, delivery_number, status)").order("created_at", { ascending: false }),
    authorization.client.from("deliveries").select("delivery_id, delivery_number, status").order("delivery_number", { ascending: true }),
  ]);
  const error = routesResponse.error ?? deliveriesResponse.error;
  if (error) return apiError(error.message, 400);
  return Response.json({ routes: routesResponse.data ?? [], deliveries: deliveriesResponse.data ?? [] });
}
