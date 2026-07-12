import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardRadii,
  dashboardSizes,
  dashboardSpacing,
  dashboardTypography,
  getDashboardColors,
} from "@/components/dashboard/dashboardDesignSpec";
import type { Route } from "@/types/route";

type RoutePreviewProps = {
  deliveryLabel: string;
  route: Route | null;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

const routeBlue = "#1769E8";
const defaultLatitudeDelta = 0.045;
const defaultLongitudeDelta = 0.045;

function getCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): Coordinate | null {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function hasRouteCoordinates(route: Route | null) {
  return Boolean(getCoordinate(route?.origin_latitude, route?.origin_longitude) && getCoordinate(route?.destination_latitude, route?.destination_longitude));
}

function decodeGooglePolyline(value: string | null | undefined): Coordinate[] {
  const polyline = value?.trim();
  if (!polyline) return [];

  const coordinates: Coordinate[] = [];
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
      if (getCoordinate(coordinate.latitude, coordinate.longitude)) {
        coordinates.push(coordinate);
      }
    }
  } catch {
    if (__DEV__) {
      console.warn("Unable to decode dashboard route polyline.");
    }
    return [];
  }

  return coordinates;
}

function getInitialRegion(coordinates: Coordinate[]) {
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
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.6, defaultLatitudeDelta),
    longitude: (minLongitude + maxLongitude) / 2,
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.6, defaultLongitudeDelta),
  };
}

export function RoutePreview({ deliveryLabel, route }: RoutePreviewProps) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const origin = getCoordinate(route?.origin_latitude, route?.origin_longitude);
  const destination = getCoordinate(route?.destination_latitude, route?.destination_longitude);
  const routeCoordinates = useMemo(() => decodeGooglePolyline(route?.route_polyline), [route?.route_polyline]);
  const endpointCoordinates = useMemo(() => [origin, destination].filter((coordinate): coordinate is Coordinate => Boolean(coordinate)), [destination, origin]);
  const fitCoordinates = routeCoordinates.length > 1 ? routeCoordinates : endpointCoordinates;
  const hasCoordinates = hasRouteCoordinates(route);
  const title = route ? "Route available" : "Route preview unavailable";
  const message = hasCoordinates ? "Pickup and destination mapped" : route ? "Open route for details" : "A route has not been generated yet";

  useEffect(() => {
    if (!mapReady || fitCoordinates.length === 0) return;

    mapRef.current?.fitToCoordinates(fitCoordinates, {
      animated: false,
      edgePadding: { bottom: 26, left: 26, right: 26, top: 26 },
    });
  }, [fitCoordinates, mapReady]);

  return (
    <View
      accessibilityLabel={`Route preview for delivery ${deliveryLabel}. ${message}.`}
      accessibilityRole="image"
      style={[
        styles.preview,
        {
          backgroundColor: colors.surfaceMuted,
        },
      ]}
    >
      {fitCoordinates.length > 0 ? (
        <MapView
          initialRegion={getInitialRegion(fitCoordinates)}
          onMapReady={() => setMapReady(true)}
          pitchEnabled={false}
          ref={mapRef}
          rotateEnabled={false}
          scrollEnabled={false}
          showsCompass={false}
          showsMyLocationButton={false}
          style={StyleSheet.absoluteFill}
          toolbarEnabled={false}
          zoomEnabled={false}
        >
          {routeCoordinates.length > 1 ? <Polyline coordinates={routeCoordinates} strokeColor={routeBlue} strokeWidth={4} tappable={false} /> : null}
          {origin ? <Marker accessibilityLabel="Pickup marker" coordinate={origin} title="Pickup" /> : null}
          {destination ? <Marker accessibilityLabel="Delivery marker" coordinate={destination} title="Delivery" /> : null}
        </MapView>
      ) : (
        <View style={styles.fallbackLayer} importantForAccessibility="no">
          <View style={[styles.fallbackIcon, { backgroundColor: colors.surfaceElevated }]}>
            <SymbolView fallback={<Text style={{ color: colors.textSecondary }}>+</Text>} name="map" size={24} tintColor={colors.textSecondary} type="hierarchical" />
          </View>
        </View>
      )}
      <View style={[styles.previewText, { backgroundColor: colors.glassFallback }]}>
        <Text
          maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary}
          style={[
            styles.previewTitle,
            {
              color: colors.textPrimary,
              fontSize: dashboardTypography.secondary.fontSize,
              fontWeight: "600",
              lineHeight: dashboardTypography.secondary.lineHeight,
            },
          ]}
        >
          {title}
        </Text>
        <Text
          maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary}
          style={[
            styles.previewMessage,
            {
              color: colors.textSecondary,
              fontSize: dashboardTypography.tertiary.fontSize,
              fontWeight: dashboardTypography.tertiary.fontWeight,
              lineHeight: dashboardTypography.tertiary.lineHeight,
            },
          ]}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackIcon: {
    alignItems: "center",
    borderRadius: dashboardRadii.iconCircle,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  fallbackLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    padding: dashboardSpacing.scale.md,
  },
  preview: {
    aspectRatio: dashboardSizes.routePreviewAspectRatio,
    overflow: "hidden",
    width: "100%",
  },
  previewMessage: {
    letterSpacing: 0,
  },
  previewText: {
    borderRadius: dashboardRadii.compactCard.compact,
    bottom: dashboardSpacing.scale.md,
    gap: dashboardSpacing.scale.xs,
    left: dashboardSpacing.scale.md,
    maxWidth: "70%",
    paddingHorizontal: dashboardSpacing.scale.md,
    paddingVertical: dashboardSpacing.scale.sm,
    position: "absolute",
  },
  previewTitle: {
    letterSpacing: 0,
  },
});
