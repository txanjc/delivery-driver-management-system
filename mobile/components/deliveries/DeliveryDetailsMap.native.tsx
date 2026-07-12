import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { MapMarkerProps, MapViewProps } from "react-native-maps";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardSpacing,
  dashboardTypography,
  getDashboardColors,
} from "@/components/dashboard/dashboardDesignSpec";

export type DeliveryMapCoordinate = {
  latitude: number;
  longitude: number;
};

type DeliveryDetailsMapProps = {
  deliveryLabel: string;
  dropoff: DeliveryMapCoordinate | null;
  loading: boolean;
  pickup: DeliveryMapCoordinate | null;
};

const defaultLatitudeDelta = 0.045;
const defaultLongitudeDelta = 0.045;

function isUsableCoordinate(coordinate: DeliveryMapCoordinate | null): coordinate is DeliveryMapCoordinate {
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

function getInitialRegion(pickup: DeliveryMapCoordinate | null, dropoff: DeliveryMapCoordinate | null): MapViewProps["initialRegion"] {
  const coordinates = [pickup, dropoff].filter(isUsableCoordinate);
  const firstCoordinate = coordinates[0];

  if (!firstCoordinate) {
    return {
      latitude: 0,
      latitudeDelta: defaultLatitudeDelta,
      longitude: 0,
      longitudeDelta: defaultLongitudeDelta,
    };
  }

  if (coordinates.length === 1) {
    return {
      ...firstCoordinate,
      latitudeDelta: defaultLatitudeDelta,
      longitudeDelta: defaultLongitudeDelta,
    };
  }

  const [first, second] = coordinates;
  const latitudeDelta = Math.max(Math.abs(first.latitude - second.latitude) * 1.8, defaultLatitudeDelta);
  const longitudeDelta = Math.max(Math.abs(first.longitude - second.longitude) * 1.8, defaultLongitudeDelta);

  return {
    latitude: (first.latitude + second.latitude) / 2,
    latitudeDelta,
    longitude: (first.longitude + second.longitude) / 2,
    longitudeDelta,
  };
}

export function DeliveryDetailsMap({ deliveryLabel, dropoff, loading, pickup }: DeliveryDetailsMapProps) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const pickupCoordinate = isUsableCoordinate(pickup) ? pickup : null;
  const dropoffCoordinate = isUsableCoordinate(dropoff) ? dropoff : null;
  const coordinates = useMemo(
    () => [pickupCoordinate, dropoffCoordinate].filter(isUsableCoordinate),
    [dropoffCoordinate, pickupCoordinate],
  );
  const initialRegion = useMemo(() => getInitialRegion(pickupCoordinate, dropoffCoordinate), [dropoffCoordinate, pickupCoordinate]);

  useEffect(() => {
    if (!mapReady || coordinates.length === 0) return;

    if (coordinates.length >= 2) {
      mapRef.current?.fitToCoordinates(coordinates, {
        animated: false,
        edgePadding: { bottom: 34, left: 34, right: 34, top: 34 },
      });
      return;
    }

    mapRef.current?.setCamera({
      center: coordinates[0],
      heading: 0,
      pitch: 0,
      zoom: 14,
    });
  }, [coordinates, mapReady]);

  if (loading) {
    return (
      <MapFallback
        colors={colors}
        iconName="map"
        message="Checking stored pickup and drop-off coordinates."
        title="Loading map coordinates"
      >
        <ActivityIndicator color={colors.accent} />
      </MapFallback>
    );
  }

  if (coordinates.length === 0) {
    return (
      <MapFallback
        colors={colors}
        iconName="mappin.slash"
        message="This delivery does not have stored pickup or drop-off coordinates yet."
        title="Map unavailable"
      />
    );
  }

  return (
    <View
      accessibilityLabel={`Map for delivery ${deliveryLabel}. ${pickupCoordinate ? "Pickup marker available." : "Pickup marker unavailable."} ${
        dropoffCoordinate ? "Drop-off marker available." : "Drop-off marker unavailable."
      }`}
      accessibilityRole="image"
      style={[styles.mapFrame, { borderColor: colors.subtleBorder }]}
    >
      <MapView
        initialRegion={initialRegion}
        onMapReady={() => setMapReady(true)}
        pitchEnabled={false}
        ref={mapRef}
        rotateEnabled={false}
        showsCompass={false}
        showsMyLocationButton={false}
        style={styles.map}
        toolbarEnabled={false}
      >
        {pickupCoordinate ? <AccessibleMarker coordinate={pickupCoordinate} description="Stored pickup location" title="Pickup" /> : null}
        {dropoffCoordinate ? <AccessibleMarker coordinate={dropoffCoordinate} description="Stored drop-off location" title="Drop-off" /> : null}
      </MapView>
    </View>
  );
}

function AccessibleMarker({ coordinate, description, title }: Pick<MapMarkerProps, "coordinate" | "description" | "title">) {
  return (
    <Marker
      accessibilityLabel={`${title} marker`}
      accessibilityRole="image"
      coordinate={coordinate}
      description={description}
      title={title}
    />
  );
}

function MapFallback({
  children,
  colors,
  iconName,
  message,
  title,
}: {
  children?: ReactNode;
  colors: ReturnType<typeof getDashboardColors>;
  iconName: "map" | "mappin.slash";
  message: string;
  title: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${message}`}
      style={[styles.fallback, { backgroundColor: colors.surfaceMuted, borderColor: colors.subtleBorder }]}
    >
      <View style={[styles.fallbackIcon, { backgroundColor: colors.surfaceElevated }]}>
        <SymbolView fallback={<Text style={{ color: colors.textSecondary }}>Map</Text>} name={iconName} size={24} tintColor={colors.textSecondary} type="hierarchical" />
      </View>
      <View style={styles.fallbackCopy}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.fallbackTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.fallbackMessage, { color: colors.textSecondary }]}>
          {message}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: dashboardSpacing.scale.sm,
    minHeight: 168,
    overflow: "hidden",
    padding: dashboardSpacing.scale.lg,
  },
  fallbackCopy: {
    alignItems: "center",
    gap: dashboardSpacing.scale.xs,
  },
  fallbackIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  fallbackMessage: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: dashboardTypography.caption.fontWeight,
    lineHeight: dashboardTypography.caption.lineHeight,
    textAlign: "center",
  },
  fallbackTitle: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.secondary.lineHeight,
    textAlign: "center",
  },
  map: {
    flex: 1,
  },
  mapFrame: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    height: 190,
    overflow: "hidden",
  },
});
