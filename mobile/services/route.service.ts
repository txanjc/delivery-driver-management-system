import { supabase } from "@/lib/supabase";
import type { Route } from "@/types/route";

const routeSelect =
  "route_id, delivery_id, origin_name, origin_address, origin_latitude, origin_longitude, destination_name, destination_address, destination_latitude, destination_longitude, estimated_distance_km, estimated_duration_minutes, route_polyline, maps_url, route_provider, route_generated_at, sequence_order, created_at, updated_at";
const routeWithDeliverySelect = `${routeSelect}, deliveries!inner(assigned_driver_id)`;

type RouteWithDelivery = Route & {
  deliveries: { assigned_driver_id: string | null } | null;
};

function stripDeliveryOwnership(route: RouteWithDelivery): Route {
  const { deliveries: _deliveryOwnership, ...routeData } = route;
  return routeData;
}

function routeTimestampValue(value: string | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareRoutesForDisplay(left: Route, right: Route) {
  const leftHasPolyline = left.route_polyline?.trim() ? 1 : 0;
  const rightHasPolyline = right.route_polyline?.trim() ? 1 : 0;
  if (leftHasPolyline !== rightHasPolyline) return rightHasPolyline - leftHasPolyline;

  const generatedDifference = routeTimestampValue(right.route_generated_at) - routeTimestampValue(left.route_generated_at);
  if (generatedDifference !== 0) return generatedDifference;

  const updatedDifference = routeTimestampValue(right.updated_at) - routeTimestampValue(left.updated_at);
  if (updatedDifference !== 0) return updatedDifference;

  const createdDifference = routeTimestampValue(right.created_at) - routeTimestampValue(left.created_at);
  if (createdDifference !== 0) return createdDifference;

  return left.route_id.localeCompare(right.route_id);
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

export async function getRoutesForDeliveryForDriver(deliveryId: string, driverId: string) {
  const response = await supabase
    .from("routes")
    .select(routeWithDeliverySelect)
    .eq("delivery_id", deliveryId)
    .eq("deliveries.assigned_driver_id", driverId)
    .returns<RouteWithDelivery[]>();

  if (response.error) {
    return { data: [], error: response.error };
  }

  return { data: (response.data ?? []).map(stripDeliveryOwnership).sort(compareRoutesForDisplay), error: null };
}

export async function getRoutesForDeliveriesForDriver(deliveryIds: string[], driverId: string) {
  if (deliveryIds.length === 0) {
    return { data: [], error: null };
  }

  const response = await supabase
    .from("routes")
    .select(routeWithDeliverySelect)
    .in("delivery_id", deliveryIds)
    .eq("deliveries.assigned_driver_id", driverId)
    .returns<RouteWithDelivery[]>();

  if (response.error) {
    return { data: [], error: response.error };
  }

  return { data: (response.data ?? []).map(stripDeliveryOwnership).sort(compareRoutesForDisplay), error: null };
}
