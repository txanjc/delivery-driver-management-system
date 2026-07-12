import { SymbolView } from "expo-symbols";
import { BlurView } from "expo-blur";
import { useCallback, useEffect, useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import type { GestureResponderEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getCardRadius,
  getDashboardColors,
  getScreenHorizontalPadding,
} from "@/components/dashboard/dashboardDesignSpec";
import { DeliveryDetailsMap } from "@/components/deliveries/DeliveryDetailsMap";
import type { DeliveryMapCoordinate } from "@/components/deliveries/DeliveryDetailsMap";
import type { Delivery } from "@/types/delivery";
import type { Route } from "@/types/route";

type DeliveryDetailsSheetProps = {
  coordinatesLoading?: boolean;
  delivery: Delivery | null;
  onClose: () => void;
  route: Route | null;
  visible: boolean;
};

type DetailRow = {
  label: string;
  value: string | null;
};

const hiddenOffset = 720;
const dismissThreshold = 110;

function getStoredCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): DeliveryMapCoordinate | null {
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

function formatStatus(value: string | null) {
  if (!value) return "Status unavailable";

  return value
    .replace(/[_-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function formatPriority(value: string | null) {
  if (!value) return "Priority unavailable";
  const normalized = value.trim();
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}` : "Priority unavailable";
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDistance(route: Route | null) {
  if (!route?.estimated_distance_km) return null;
  return `${route.estimated_distance_km.toFixed(route.estimated_distance_km >= 10 ? 0 : 1)} km`;
}

function formatDuration(route: Route | null) {
  if (!route?.estimated_duration_minutes) return null;
  const minutes = Math.max(1, Math.round(route.estimated_duration_minutes));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function getDeliveryLabel(delivery: Delivery) {
  return delivery.delivery_number ? `#${delivery.delivery_number}` : delivery.delivery_id;
}

function stopPropagation(event: GestureResponderEvent) {
  event.stopPropagation();
}

export function DeliveryDetailsSheet({ coordinatesLoading = false, delivery, onClose, route, visible }: DeliveryDetailsSheetProps) {
  const colorScheme = useColorScheme();
  const reduceMotionEnabled = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const translateY = useSharedValue(hiddenOffset);
  const backdropOpacity = useSharedValue(0);
  const sheetRadius = Math.max(28, getCardRadius(width) + 10);
  const horizontalPadding = getScreenHorizontalPadding(width);
  const sheetMaxHeight = Math.max(420, height * 0.82);
  const sheetBackground = colorScheme === "dark" ? "rgba(31, 31, 36, 0.96)" : "rgba(246, 246, 248, 0.96)";
  const blurTint = colorScheme === "dark" ? "dark" : "light";
  const sectionBackground = colorScheme === "dark" ? "rgba(255, 255, 255, 0.07)" : "rgba(255, 255, 255, 0.72)";
  const sectionBorder = colorScheme === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(118, 118, 128, 0.18)";
  const statusText = delivery ? formatStatus(delivery.status) : "";
  const priorityText = delivery ? formatPriority(delivery.priority) : "";
  const distanceText = formatDistance(route);
  const durationText = formatDuration(route);
  const pickupCoordinate = delivery
    ? getStoredCoordinate(delivery.pickup_latitude, delivery.pickup_longitude) ?? getStoredCoordinate(route?.origin_latitude, route?.origin_longitude)
    : null;
  const dropoffCoordinate = delivery
    ? getStoredCoordinate(delivery.delivery_latitude, delivery.delivery_longitude) ?? getStoredCoordinate(route?.destination_latitude, route?.destination_longitude)
    : null;

  const overviewRows = useMemo<DetailRow[]>(
    () => [
      { label: "Status", value: statusText },
      { label: "Priority", value: priorityText },
      { label: "Travel Time", value: durationText },
      { label: "Distance", value: distanceText },
      { label: "Route", value: route ? "Confirmed route available" : null },
    ],
    [distanceText, durationText, priorityText, route, statusText],
  );

  const deliveryRows = useMemo<DetailRow[]>(
    () =>
      delivery
        ? [
            { label: "Customer", value: delivery.customer_name },
            { label: "Phone", value: delivery.customer_phone ?? "No phone number" },
            { label: "Pickup", value: delivery.pickup_address },
            { label: "Drop-off", value: delivery.delivery_address },
            { label: "Created", value: formatDate(delivery.created_at) },
            { label: "Updated", value: formatDate(delivery.updated_at) },
          ]
        : [],
    [delivery],
  );

  const assignmentRows = useMemo<DetailRow[]>(
    () =>
      delivery
        ? [
            { label: "Assigned Vehicle", value: delivery.assigned_vehicle_id ? `Vehicle ${delivery.assigned_vehicle_id}` : "No vehicle assigned" },
            { label: "Route ID", value: route?.route_id ?? null },
            { label: "Origin", value: route?.origin_address ?? null },
            { label: "Destination", value: route?.destination_address ?? null },
          ]
        : [],
    [delivery, route],
  );

  const closeSheet = useCallback(() => {
    translateY.value = withTiming(hiddenOffset, { duration: reduceMotionEnabled ? 120 : 220, easing: Easing.out(Easing.cubic) });
    backdropOpacity.value = withTiming(0, { duration: reduceMotionEnabled ? 100 : 180, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [backdropOpacity, onClose, reduceMotionEnabled, translateY]);

  useEffect(() => {
    if (!visible) {
      translateY.value = hiddenOffset;
      backdropOpacity.value = 0;
      return;
    }

    translateY.value = reduceMotionEnabled
      ? withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) })
      : withSpring(0, { damping: 24, mass: 0.9, stiffness: 220 });
    backdropOpacity.value = withTiming(1, { duration: reduceMotionEnabled ? 100 : 220, easing: Easing.out(Easing.cubic) });
  }, [backdropOpacity, reduceMotionEnabled, translateY, visible]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(visible)
        .activeOffsetY([-6, 6])
        .failOffsetX([-28, 28])
        .onUpdate((event) => {
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          const shouldDismiss = event.translationY > dismissThreshold || event.velocityY > 900;

          if (shouldDismiss) {
            runOnJS(closeSheet)();
            return;
          }

          translateY.value = reduceMotionEnabled
            ? withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) })
            : withSpring(0, { damping: 24, mass: 0.9, stiffness: 220 });
        }),
    [closeSheet, reduceMotionEnabled, translateY, visible],
  );

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(backdropOpacity.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!delivery) return null;

  return (
    <Modal animationType="none" onRequestClose={closeSheet} statusBarTranslucent transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Animated.View pointerEvents={visible ? "auto" : "none"} style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable accessibilityLabel="Close delivery details" accessibilityRole="button" onPress={closeSheet} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          accessibilityLabel={`Delivery details for ${getDeliveryLabel(delivery)}`}
          accessibilityRole="summary"
          onStartShouldSetResponder={() => true}
          onResponderRelease={stopPropagation}
          style={[
            styles.sheet,
            dashboardShadows.elevatedCard,
            {
              backgroundColor: sheetBackground,
              borderColor: sectionBorder,
              borderTopLeftRadius: sheetRadius,
              borderTopRightRadius: sheetRadius,
              maxHeight: sheetMaxHeight,
              paddingBottom: Math.max(insets.bottom, dashboardSpacing.scale.md),
              paddingHorizontal: horizontalPadding,
            },
            sheetAnimatedStyle,
          ]}
        >
          <BlurView intensity={42} pointerEvents="none" style={StyleSheet.absoluteFill} tint={blurTint} />
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
            </View>
          </GestureDetector>
          <ScrollView
            bounces
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.scroll}
          >
              <View style={styles.header}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.pageTitle} style={[styles.title, { color: colors.textPrimary }]}>
                  {getDeliveryLabel(delivery)}
                </Text>
                {delivery.customer_name ? (
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {delivery.customer_name}
                  </Text>
                ) : null}
                <View style={styles.chipRow}>
                  <DetailChip color={colors.accent} label={statusText} />
                  <DetailChip color={colors.textSecondary} label={priorityText} />
                </View>
              </View>

              <DeliveryDetailsMap
                deliveryLabel={getDeliveryLabel(delivery)}
                dropoff={dropoffCoordinate}
                loading={coordinatesLoading}
                pickup={pickupCoordinate}
              />

              <DetailSection borderColor={sectionBorder} rows={overviewRows} surfaceColor={sectionBackground} title="Delivery Overview" />
              <DetailSection borderColor={sectionBorder} rows={deliveryRows} surfaceColor={sectionBackground} title="Delivery Information" />
              <DetailSection borderColor={sectionBorder} rows={assignmentRows} surfaceColor={sectionBackground} title="Assignment Information" />
              {delivery.notes ? (
                <View style={[styles.section, { backgroundColor: sectionBackground, borderColor: sectionBorder }]}>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    Notes / Instructions
                  </Text>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.notes, { color: colors.textPrimary }]}>
                    {delivery.notes}
                  </Text>
                </View>
              ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DetailChip({ color, label }: { color: string; label: string }) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);

  return (
    <View style={[styles.chip, { backgroundColor: colors.surfaceMuted, borderColor: colors.subtleBorder }]}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.chipText, { color: colors.textPrimary }]}>
        {label}
      </Text>
    </View>
  );
}

function DetailSection({ borderColor, rows, surfaceColor, title }: { borderColor: string; rows: DetailRow[]; surfaceColor: string; title: string }) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const visibleRows = rows.filter((row) => row.value);

  if (visibleRows.length === 0) return null;

  return (
    <View style={[styles.section, { backgroundColor: surfaceColor, borderColor }]}>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {title}
      </Text>
      <View style={styles.rowStack}>
        {visibleRows.map((row) => (
          <View key={`${title}-${row.label}`} style={styles.detailRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceMuted }]}>
              <SymbolView fallback={null} name="info.circle" size={14} tintColor={colors.textSecondary} type="hierarchical" />
            </View>
            <View style={styles.rowCopy}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.rowLabel, { color: colors.textSecondary }]}>
                {row.label}
              </Text>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.rowValue, { color: colors.textPrimary }]}>
                {row.value}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  chip: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: dashboardSpacing.scale.xs,
    paddingHorizontal: dashboardSpacing.scale.md,
    paddingVertical: dashboardSpacing.scale.xs,
  },
  chipDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: dashboardSpacing.scale.sm,
  },
  chipText: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  content: {
    gap: dashboardSpacing.scale.md,
    paddingBottom: dashboardSpacing.scale.lg,
  },
  detailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
  },
  handle: {
    borderRadius: 999,
    height: 5,
    opacity: 0.6,
    width: 54,
  },
  handleWrap: {
    alignItems: "center",
    paddingBottom: dashboardSpacing.scale.sm,
    paddingTop: dashboardSpacing.scale.sm,
  },
  header: {
    gap: dashboardSpacing.scale.sm,
    paddingTop: dashboardSpacing.scale.xs,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  notes: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: dashboardTypography.secondary.fontWeight,
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    marginTop: 1,
    width: 26,
  },
  rowLabel: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  rowStack: {
    gap: dashboardSpacing.scale.md,
  },
  rowValue: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  scroll: {
    flexGrow: 0,
  },
  section: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: dashboardSpacing.scale.md,
    overflow: "hidden",
    padding: dashboardSpacing.scale.md,
  },
  sectionTitle: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: dashboardTypography.caption.lineHeight,
    textTransform: "uppercase",
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  subtitle: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: dashboardTypography.secondary.fontWeight,
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  title: {
    fontSize: dashboardTypography.largePageTitle.fontSize,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: dashboardTypography.largePageTitle.lineHeight,
  },
});
