import { supabase } from "@/lib/supabase";
import type { Route } from "@/types/route";

const routeSelect = "route_id, delivery_id, origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude, estimated_distance_km, estimated_duration_minutes, maps_url";
const routeWithDeliverySelect = `${routeSelect}, deliveries!inner(assigned_driver_id)`;

type RouteWithDelivery = Route & {
  deliveries: { assigned_driver_id: string | null } | null;
};

function stripDeliveryOwnership(route: RouteWithDelivery): Route {
  const { deliveries: _deliveryOwnership, ...routeData } = route;
  return routeData;
}

export async function getRoute(routeId: string) {
  return supabase
    .from("routes")
    .select(routeSelect)
    .eq("route_id", routeId)
    .maybeSingle<Route>();
}

export async function getRouteForDelivery(deliveryId: string) {
  return supabase
    .from("routes")
    .select(routeSelect)
    .eq("delivery_id", deliveryId)
    .maybeSingle<Route>();
}

export async function getRouteForDriver(routeId: string, driverId: string) {
  const response = await supabase
    .from("routes")
    .select(routeWithDeliverySelect)
    .eq("route_id", routeId)
    .eq("deliveries.assigned_driver_id", driverId)
    .maybeSingle<RouteWithDelivery>();

  if (response.error || !response.data) {
    return { data: null, error: response.error };
  }

  return { data: stripDeliveryOwnership(response.data), error: null };
}

export async function getRouteForDeliveryForDriver(deliveryId: string, driverId: string) {
  const response = await supabase
    .from("routes")
    .select(routeWithDeliverySelect)
    .eq("delivery_id", deliveryId)
    .eq("deliveries.assigned_driver_id", driverId)
    .maybeSingle<RouteWithDelivery>();

  if (response.error || !response.data) {
    return { data: null, error: response.error };
  }

  return { data: stripDeliveryOwnership(response.data), error: null };
}
