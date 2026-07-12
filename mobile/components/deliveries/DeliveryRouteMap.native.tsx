import * as Location from "expo-location";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { MapViewProps } from "react-native-maps";

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

const defaultLatitudeDelta = 0.055;
const defaultLongitudeDelta = 0.055;
const routeBlue = "#1769E8";

function isCoordinate(coordinate: RouteCoordinate | null): coordinate is RouteCoordinate {
  return (
    coordinate !== null &&
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

function storedCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): RouteCoordinate | null {
  return isCoordinate({ latitude: latitude ?? Number.NaN, longitude: longitude ?? Number.NaN }) ? { latitude: latitude as number, longitude: longitude as number } : null;
}

function decodeGooglePolyline(value: string | null | undefined): RouteCoordinate[] {
  const polyline = value?.trim();
  if (!polyline) return [];

  const coordinates: RouteCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  try {
    while (index < polyline.length) {
      let result = 0;
      let shift = 0;
      let byte = 0;

      do {
        byte = polyline.charCodeAt(index) - 63;
        index += 1;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      latitude += result & 1 ? ~(result >> 1) : result >> 1;
      result = 0;
      shift = 0;

      do {
        byte = polyline.charCodeAt(index) - 63;
        index += 1;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      longitude += result & 1 ? ~(result >> 1) : result >> 1;

      const coordinate = { latitude: latitude / 100000, longitude: longitude / 100000 };
      if (isCoordinate(coordinate)) {
        coordinates.push(coordinate);
      }
    }
  } catch {
    if (__DEV__) {
      console.warn("Unable to decode saved route polyline.");
    }
    return [];
  }

  return coordinates;
}

function getInitialRegion(coordinates: RouteCoordinate[]): MapViewProps["initialRegion"] {
  const first = coordinates[0];
  if (!first) {
    return {
      latitude: 0,
      latitudeDelta: defaultLatitudeDelta,
      longitude: 0,
      longitudeDelta: defaultLongitudeDelta,
    };
  }

  if (coordinates.length === 1) {
    return {
      ...first,
      latitudeDelta: defaultLatitudeDelta,
      longitudeDelta: defaultLongitudeDelta,
    };
  }

  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.55, defaultLatitudeDelta),
    longitude: (minLongitude + maxLongitude) / 2,
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.55, defaultLongitudeDelta),
  };
}

export function DeliveryRouteMap({
  delivery,
  onDriverLocationChange,
  onLocationPermissionChange,
  panelHeight,
  route,
  routeActive,
  visible,
}: DeliveryRouteMapProps) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [driverCoordinate, setDriverCoordinate] = useState<RouteCoordinate | null>(null);
  const routeCoordinates = useMemo(() => decodeGooglePolyline(route?.route_polyline), [route?.route_polyline]);
  const pickupCoordinate = useMemo(
    () => storedCoordinate(delivery.pickup_latitude, delivery.pickup_longitude) ?? storedCoordinate(route?.origin_latitude, route?.origin_longitude),
    [delivery.pickup_latitude, delivery.pickup_longitude, route?.origin_latitude, route?.origin_longitude],
  );
  const dropoffCoordinate = useMemo(
    () => storedCoordinate(delivery.delivery_latitude, delivery.delivery_longitude) ?? storedCoordinate(route?.destination_latitude, route?.destination_longitude),
    [delivery.delivery_latitude, delivery.delivery_longitude, route?.destination_latitude, route?.destination_longitude],
  );
  const endpointCoordinates = useMemo(() => [pickupCoordinate, dropoffCoordinate].filter(isCoordinate), [dropoffCoordinate, pickupCoordinate]);
  const fitCoordinates = routeCoordinates.length > 0 ? routeCoordinates : endpointCoordinates;
  const initialRegion = useMemo(() => getInitialRegion(fitCoordinates), [fitCoordinates]);

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      if (!visible || Platform.OS === "web") return;
      onLocationPermissionChange("loading");

      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setDriverCoordinate(null);
        onDriverLocationChange(null);
        onLocationPermissionChange("denied");
        return;
      }

      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const coordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setDriverCoordinate(coordinate);
        onDriverLocationChange(coordinate);
        onLocationPermissionChange("granted");
      } catch {
        if (cancelled) return;
        setDriverCoordinate(null);
        onDriverLocationChange(null);
        onLocationPermissionChange("unavailable");
      }
    }

    void loadLocation();

    return () => {
      cancelled = true;
    };
  }, [onDriverLocationChange, onLocationPermissionChange, visible]);

  useEffect(() => {
    if (!mapReady || fitCoordinates.length === 0) return;

    mapRef.current?.fitToCoordinates(fitCoordinates, {
      animated: false,
      edgePadding: { bottom: panelHeight + 44, left: 48, right: 48, top: 110 },
    });
  }, [fitCoordinates, mapReady, panelHeight]);

  return (
    <MapView
      accessibilityLabel={routeCoordinates.length > 0 ? "Delivery route map with saved route line." : "Delivery route map with available delivery markers."}
      initialRegion={initialRegion}
      loadingEnabled
      onMapReady={() => setMapReady(true)}
      ref={mapRef}
      showsCompass={false}
      showsMyLocationButton={false}
      style={StyleSheet.absoluteFill}
      toolbarEnabled={false}
    >
      {routeCoordinates.length > 0 ? (
        <Polyline coordinates={routeCoordinates} strokeColor={routeBlue} strokeWidth={6} tappable={false} />
      ) : null}
      {pickupCoordinate ? (
        <RouteMarker accessibilityLabel="Pickup location" coordinate={pickupCoordinate} iconName="building.2.fill" tone="pickup" title="Pickup" />
      ) : null}
      {dropoffCoordinate ? (
        <RouteMarker accessibilityLabel="Next delivery stop" coordinate={dropoffCoordinate} iconName="truck.box.fill" tone="next" title="Next stop" />
      ) : null}
      {driverCoordinate ? (
        <RouteMarker accessibilityLabel="Current driver location" coordinate={driverCoordinate} iconName={routeActive ? "location.north.fill" : "location.fill"} tone="driver" title="Driver" />
      ) : null}
    </MapView>
  );
}

function RouteMarker({
  accessibilityLabel,
  coordinate,
  iconName,
  title,
  tone,
}: {
  accessibilityLabel: string;
  coordinate: RouteCoordinate;
  iconName: "building.2.fill" | "location.fill" | "location.north.fill" | "truck.box.fill";
  title: string;
  tone: "driver" | "next" | "pickup";
}) {
  const markerStyle = tone === "pickup" ? styles.pickupMarker : styles.blueMarker;

  return (
    <Marker accessibilityLabel={accessibilityLabel} accessibilityRole="image" coordinate={coordinate} title={title}>
      <View style={[styles.marker, markerStyle]}>
        <SymbolView fallback={<Text style={styles.markerFallback}>+</Text>} name={iconName} size={20} tintColor="#FFFFFF" type="hierarchical" />
      </View>
    </Marker>
  );
}

export function hasSavedRouteLine(route: Route | null) {
  return decodeGooglePolyline(route?.route_polyline).length > 1;
}

const styles = StyleSheet.create({
  blueMarker: {
    backgroundColor: routeBlue,
  },
  marker: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 999,
    borderWidth: 3,
    elevation: 4,
    height: 44,
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    width: 44,
  },
  markerFallback: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  pickupMarker: {
    backgroundColor: "#2FB178",
  },
});
