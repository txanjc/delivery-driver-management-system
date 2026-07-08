import { supabase } from "@/lib/supabase";
import type { Route } from "@/types/route";

export async function getRoute(routeId: string) {
  return supabase
    .from("routes")
    .select("route_id, delivery_id, origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude, estimated_distance_km, estimated_duration_minutes, maps_url")
    .eq("route_id", routeId)
    .maybeSingle<Route>();
}

export async function getRouteForDelivery(deliveryId: string) {
  return supabase
    .from("routes")
    .select("route_id, delivery_id, origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude, estimated_distance_km, estimated_duration_minutes, maps_url")
    .eq("delivery_id", deliveryId)
    .maybeSingle<Route>();
}
