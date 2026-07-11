import { StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { RoutePreview } from "@/components/dashboard/RoutePreview";
import { GlassActionButton } from "@/components/shared/GlassActionButton";
import {
  dashboardMaxFontSizeMultipliers,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getButtonHeight,
  getButtonRadius,
  getCardPadding,
  getCardRadius,
  getDashboardColors,
  getDashboardBreakpoint,
  getSectionGap,
} from "@/components/dashboard/dashboardDesignSpec";
import type { Delivery } from "@/types/delivery";
import type { Route } from "@/types/route";

type ActiveDeliveryCardProps = {
  delivery: Delivery | null;
  deliveryUnavailable: boolean;
  loading: boolean;
  onOpenRoute: (() => void) | null;
  onViewDetails: (() => void) | null;
  route: Route | null;
  routeUnavailable: boolean;
};

type ChipTone = "accent" | "neutral" | "warning" | "danger" | "success";

function formatStatus(status: string | null) {
  if (!status) return "Status unavailable";

  return status
    .replace(/[_-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function getDeliveryLabel(delivery: Delivery) {
  return delivery.delivery_number ? `#${delivery.delivery_number}` : delivery.delivery_id;
}

function getDurationText(route: Route | null) {
  return route?.estimated_duration_minutes ? `${route.estimated_duration_minutes} min route` : null;
}

function getDistanceText(route: Route | null) {
  if (!route?.estimated_distance_km) return null;

  return `${route.estimated_distance_km.toFixed(route.estimated_distance_km >= 10 ? 0 : 1)} km`;
}

function getStatusTone(status: string | null): ChipTone {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";

  if (normalized === "failed") return "danger";
  if (normalized === "returned" || normalized === "delayed") return "warning";
  if (normalized === "delivered") return "success";
  if (normalized === "in_transit") return "accent";
  return "neutral";
}

export function ActiveDeliveryCard({ delivery, deliveryUnavailable, loading, onOpenRoute, onViewDetails, route, routeUnavailable }: ActiveDeliveryCardProps) {
  const colorScheme = useColorScheme();
  const { fontScale, width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const cardPadding = getCardPadding(width);
  const sectionGap = getSectionGap(width);
  const compact = getDashboardBreakpoint(width) === "compact" || fontScale > 1.12;
  const buttonStacked = compact || fontScale > 1.18;

  if (loading) {
    return (
      <View style={[styles.card, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: getCardRadius(width), padding: cardPadding, rowGap: sectionGap }]}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.title, { color: colors.textPrimary, fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: dashboardTypography.compactPageTitle.fontWeight, lineHeight: dashboardTypography.compactPageTitle.lineHeight }]}>
          Active Delivery
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.body, { color: colors.textSecondary, fontSize: dashboardTypography.secondary.fontSize, fontWeight: dashboardTypography.secondary.fontWeight, lineHeight: dashboardTypography.secondary.lineHeight }]}>
          Loading active delivery...
        </Text>
      </View>
    );
  }

  if (deliveryUnavailable) {
    return (
      <View style={[styles.card, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: getCardRadius(width), padding: cardPadding, rowGap: sectionGap }]}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.title, { color: colors.textPrimary, fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: dashboardTypography.compactPageTitle.fontWeight, lineHeight: dashboardTypography.compactPageTitle.lineHeight }]}>
          Active Delivery
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.body, { color: colors.textSecondary, fontSize: dashboardTypography.secondary.fontSize, fontWeight: dashboardTypography.secondary.fontWeight, lineHeight: dashboardTypography.secondary.lineHeight }]}>
          Active delivery could not be refreshed.
        </Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={[styles.card, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: getCardRadius(width), padding: cardPadding, rowGap: dashboardSpacing.scale.sm }]}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.title, { color: colors.textPrimary, fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: dashboardTypography.compactPageTitle.fontWeight, lineHeight: dashboardTypography.compactPageTitle.lineHeight }]}>
          No active delivery
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.body, { color: colors.textSecondary, fontSize: dashboardTypography.secondary.fontSize, fontWeight: dashboardTypography.secondary.fontWeight, lineHeight: dashboardTypography.secondary.lineHeight }]}>
          Your assigned delivery will appear here when it becomes active.
        </Text>
      </View>
    );
  }

  const deliveryLabel = getDeliveryLabel(delivery);
  const durationText = getDurationText(route);
  const distanceText = getDistanceText(route);
  const statusText = formatStatus(delivery.status);
  const chips = [
    { label: statusText, tone: getStatusTone(delivery.status) },
    ...(distanceText ? [{ label: distanceText, tone: "neutral" as ChipTone }] : []),
    ...(durationText ? [{ label: durationText, tone: "neutral" as ChipTone }] : []),
    ...(routeUnavailable ? [{ label: "Route unavailable", tone: "warning" as ChipTone }] : []),
  ];

  return (
    <View style={[styles.card, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: getCardRadius(width) }]}>
      <RoutePreview deliveryLabel={deliveryLabel} route={route} />
      <View style={[styles.content, { padding: cardPadding, rowGap: sectionGap }]}>
        <View style={[styles.chips, { gap: dashboardSpacing.scale.sm }]}>
          {chips.map((chip) => (
            <StatusChip key={chip.label} label={chip.label} tone={chip.tone} />
          ))}
        </View>

        <View style={styles.identity}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.statusLabel, { color: colors.accent, fontSize: dashboardTypography.tertiary.fontSize, fontWeight: "600", lineHeight: dashboardTypography.tertiary.lineHeight }]}>
            Active Delivery
          </Text>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.deliveryId, { color: colors.textPrimary, fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: dashboardTypography.compactPageTitle.fontWeight, lineHeight: dashboardTypography.compactPageTitle.lineHeight }]}>
            {deliveryLabel}
          </Text>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.body} style={[styles.customer, { color: colors.textPrimary, fontSize: dashboardTypography.body.fontSize, fontWeight: "600", lineHeight: dashboardTypography.body.lineHeight }]}>
            {delivery.customer_name ?? "Customer unavailable"}
          </Text>
        </View>

        <View style={styles.addressList}>
          <AddressRow iconName="shippingbox" label="Pickup" value={delivery.pickup_address ?? "Pickup address unavailable"} />
          <AddressRow iconName="mappin" label="Delivery" value={delivery.delivery_address ?? "Delivery address unavailable"} />
        </View>

        <View style={[styles.actions, buttonStacked ? styles.actionsStacked : null, { gap: dashboardSpacing.scale.sm }]}>
          <DashboardActionButton label="Open Route" onPress={onOpenRoute} tone="primary" />
          <DashboardActionButton label="View Details" onPress={onViewDetails} tone="secondary" />
        </View>
      </View>
    </View>
  );
}

function StatusChip({ label, tone }: { label: string; tone: ChipTone }) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const toneColor = tone === "accent" ? colors.accent : tone === "warning" ? colors.warning : tone === "danger" ? colors.danger : tone === "success" ? colors.success : colors.textSecondary;

  return (
    <View style={[styles.chip, { backgroundColor: colors.surfaceMuted, borderColor: colors.subtleBorder }]}>
      <View style={[styles.chipDot, { backgroundColor: toneColor }]} />
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.chipText, { color: colors.textPrimary, fontSize: dashboardTypography.caption.fontSize, fontWeight: dashboardTypography.caption.fontWeight, lineHeight: dashboardTypography.caption.lineHeight }]}>
        {label}
      </Text>
    </View>
  );
}

function AddressRow({ iconName, label, value }: { iconName: "mappin" | "shippingbox"; label: string; value: string }) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);

  return (
    <View style={styles.addressRow}>
      <View style={[styles.addressIcon, { backgroundColor: colors.surfaceMuted }]}>
        <SymbolView fallback={<Text style={{ color: colors.textSecondary }}>+</Text>} name={iconName} size={15} tintColor={colors.textSecondary} type="hierarchical" />
      </View>
      <View style={styles.addressCopy}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.addressLabel, { color: colors.textSecondary, fontSize: dashboardTypography.tertiary.fontSize, fontWeight: dashboardTypography.tertiary.fontWeight, lineHeight: dashboardTypography.tertiary.lineHeight }]}>
          {label}
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.address, { color: colors.textPrimary, fontSize: dashboardTypography.secondary.fontSize, fontWeight: dashboardTypography.secondary.fontWeight, lineHeight: dashboardTypography.secondary.lineHeight }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function DashboardActionButton({ label, onPress, tone }: { label: string; onPress: (() => void) | null; tone: "primary" | "secondary" }) {
  const { width } = useWindowDimensions();
  const disabled = !onPress;
  const primary = tone === "primary";

  return (
    <GlassActionButton
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={disabled ? { disabled: true } : undefined}
      capsule
      disabled={disabled}
      iconName={primary ? "arrow.turn.up.right" : "doc.text"}
      iconPosition="left"
      label={label}
      labelStyle={styles.actionText}
      onPress={onPress ?? undefined}
      radius={getButtonRadius(width)}
      style={[
        styles.action,
        {
          minHeight: getButtonHeight(width),
        },
      ]}
      variant={primary ? "primaryAccent" : "secondaryNeutral"}
    />
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
    justifyContent: "center",
    paddingHorizontal: dashboardSpacing.scale.md,
  },
  actionText: {
    letterSpacing: 0,
    fontSize: dashboardTypography.control.fontSize,
    fontWeight: dashboardTypography.control.fontWeight,
    lineHeight: dashboardTypography.control.lineHeight,
  },
  actions: {
    flexDirection: "row",
  },
  addressCopy: {
    flex: 1,
    gap: dashboardSpacing.scale.xs,
    minWidth: 0,
  },
  addressIcon: {
    alignItems: "center",
    borderRadius: dashboardRadii.iconCircle,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  addressLabel: {
    letterSpacing: 0,
  },
  addressList: {
    gap: dashboardSpacing.scale.md,
  },
  addressRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
  },
  actionsStacked: {
    flexDirection: "column",
  },
  address: {
    letterSpacing: 0,
  },
  body: {
    letterSpacing: 0,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  chip: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
    paddingHorizontal: dashboardSpacing.scale.md,
    paddingVertical: dashboardSpacing.scale.xs,
  },
  chipDot: {
    borderRadius: dashboardRadii.iconCircle,
    height: 7,
    width: 7,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chipText: {
    letterSpacing: 0,
  },
  content: {
    width: "100%",
  },
  customer: {
    letterSpacing: 0,
  },
  deliveryId: {
    letterSpacing: 0,
  },
  identity: {
    gap: dashboardSpacing.scale.xs,
  },
  statusLabel: {
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    letterSpacing: 0,
  },
});
