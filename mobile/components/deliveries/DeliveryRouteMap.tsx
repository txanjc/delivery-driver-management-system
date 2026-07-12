import { StyleSheet, View } from "react-native";

import type { Delivery } from "@/types/delivery";
import type { Route } from "@/types/route";

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type LocationPermissionState = "idle" | "loading" | "granted" | "denied" | "unavailable";

type DeliveryRouteMapProps = {
  delivery: Delivery;
  onDriverLocationChange: (coordinate: RouteCoordinate | null) => void;
  onLocationPermissionChange: (state: LocationPermissionState) => void;
  panelHeight: number;
  route: Route | null;
  routeActive: boolean;
  visible: boolean;
};

export function DeliveryRouteMap(_props: DeliveryRouteMapProps) {
  return <View style={StyleSheet.absoluteFill} />;
}

export function hasSavedRouteLine(route: Route | null) {
  return Boolean(route?.route_polyline?.trim());
}
