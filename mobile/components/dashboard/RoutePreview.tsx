import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { SymbolView } from "expo-symbols";

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

function hasRouteCoordinates(route: Route | null) {
  return (
    route?.origin_latitude !== null &&
    route?.origin_longitude !== null &&
    route?.destination_latitude !== null &&
    route?.destination_longitude !== null &&
    route?.origin_latitude !== undefined &&
    route?.origin_longitude !== undefined &&
    route?.destination_latitude !== undefined &&
    route?.destination_longitude !== undefined
  );
}

export function RoutePreview({ deliveryLabel, route }: RoutePreviewProps) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const hasCoordinates = hasRouteCoordinates(route);
  const title = route ? "Route available" : "Route preview unavailable";
  const message = hasCoordinates ? "Pickup and destination mapped" : route ? "Open route for details" : "A route has not been generated yet";

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
      {hasCoordinates ? (
        <View style={styles.routeLayer} importantForAccessibility="no">
          <View style={[styles.marker, styles.pickupMarker, { backgroundColor: colors.accent }]} />
          <View style={[styles.routeLine, { backgroundColor: colors.divider }]} />
          <View style={[styles.marker, styles.destinationMarker, { borderColor: colors.success }]}>
            <SymbolView fallback={<Text style={{ color: colors.success }}>+</Text>} name="mappin" size={15} tintColor={colors.success} type="hierarchical" />
          </View>
        </View>
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
  destinationMarker: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 2,
    justifyContent: "center",
    right: "13%",
    top: "45%",
  },
  marker: {
    borderRadius: dashboardRadii.iconCircle,
    height: 26,
    position: "absolute",
    width: 26,
  },
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
  pickupMarker: {
    left: "14%",
    top: "26%",
  },
  routeLine: {
    borderRadius: 999,
    height: 4,
    left: "20%",
    position: "absolute",
    right: "20%",
    top: "49%",
    transform: [{ rotate: "-12deg" }],
  },
  routeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
