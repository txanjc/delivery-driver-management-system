import { SymbolView } from "expo-symbols";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";

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

export function DeliveryDetailsMap({ deliveryLabel, dropoff, loading, pickup }: DeliveryDetailsMapProps) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const hasCoordinates = Boolean(pickup || dropoff);
  const title = loading ? "Loading map coordinates" : hasCoordinates ? "Map preview available on mobile" : "Map unavailable";
  const message = loading
    ? "Checking stored pickup and drop-off coordinates."
    : hasCoordinates
      ? `Delivery ${deliveryLabel} has stored coordinates. Open the native app to view the map.`
      : "This delivery does not have stored pickup or drop-off coordinates yet.";

  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${message}`}
      style={[styles.fallback, { backgroundColor: colors.surfaceMuted, borderColor: colors.subtleBorder }]}
    >
      <View style={[styles.fallbackIcon, { backgroundColor: colors.surfaceElevated }]}>
        <SymbolView fallback={<Text style={{ color: colors.textSecondary }}>Map</Text>} name={hasCoordinates ? "map" : "mappin.slash"} size={24} tintColor={colors.textSecondary} type="hierarchical" />
      </View>
      <View style={styles.fallbackCopy}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.fallbackTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.fallbackMessage, { color: colors.textSecondary }]}>
          {message}
        </Text>
      </View>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
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
});
