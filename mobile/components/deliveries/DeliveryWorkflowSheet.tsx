import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Modal, Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
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
  dashboardShadows,
  dashboardSpacing,
  getCardRadius,
  getDashboardColors,
  getScreenHorizontalPadding,
} from "@/components/dashboard/dashboardDesignSpec";
import { DeliveryRouteMap, hasSavedRouteLine } from "@/components/deliveries/DeliveryRouteMap";
import type { LocationPermissionState, RouteCoordinate } from "@/components/deliveries/DeliveryRouteMap";
import type { Delivery } from "@/types/delivery";
import type { Route } from "@/types/route";

type DeliveryWorkflowSheetProps = {
  delivery: Delivery | null;
  onClose: () => void;
  route: Route | null;
  visible: boolean;
};

const dismissThreshold = 110;
const routeBlue = "#1769E8";
const metersPerMile = 1609.344;

function stopPropagation(event: GestureResponderEvent) {
  event.stopPropagation();
}

function getCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): RouteCoordinate | null {
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

function splitAddress(value: string | null | undefined) {
  const address = value?.trim();
  if (!address) {
    return { primary: "Destination unavailable", secondary: "Address details unavailable" };
  }

  const [primary, ...rest] = address.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    primary: primary || address,
    secondary: rest.join(", ") || "Address details unavailable",
  };
}

function formatDuration(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return null;
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return remaining > 0 ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function formatDistanceMiles(kilometers: number | null | undefined) {
  if (!kilometers || kilometers <= 0) return null;
  const miles = kilometers * 0.621371;
  return `${miles.toFixed(miles >= 10 ? 1 : 1)} mi`;
}

function formatArrivalTime(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return null;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(Date.now() + minutes * 60 * 1000));
}

function distanceMeters(left: RouteCoordinate | null, right: RouteCoordinate | null) {
  if (!left || !right) return null;
  const latitudeDelta = ((right.latitude - left.latitude) * Math.PI) / 180;
  const longitudeDelta = ((right.longitude - left.longitude) * Math.PI) / 180;
  const leftLatitude = (left.latitude * Math.PI) / 180;
  const rightLatitude = (right.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);

  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getRouteState({
  driverLocation,
  hasRoute,
  routeActive,
  status,
  stopCoordinate,
}: {
  driverLocation: RouteCoordinate | null;
  hasRoute: boolean;
  routeActive: boolean;
  status: string | null;
  stopCoordinate: RouteCoordinate | null;
}) {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "delivered") return "Completed";
  if (normalized === "delayed") return "Delayed";
  if (!hasRoute && !stopCoordinate) return "Route Unavailable";
  if (!routeActive) return "Not Started";

  const distance = distanceMeters(driverLocation, stopCoordinate);
  if (distance === null) return "En Route";
  if (distance <= 0.05 * metersPerMile) return "Arrived";
  if (distance <= 0.25 * metersPerMile) return "Near Location";
  return "En Route";
}

function getBadgeTone(label: string, dark: boolean) {
  if (label === "Near Location") {
    return { backgroundColor: "#FED766", color: "#5D3B00" };
  }
  if (label === "Arrived" || label === "Completed") {
    return { backgroundColor: dark ? "rgba(74, 222, 128, 0.2)" : "rgba(22, 163, 74, 0.12)", color: dark ? "#86EFAC" : "#166534" };
  }
  if (label === "Delayed" || label === "Route Unavailable") {
    return { backgroundColor: dark ? "rgba(251, 191, 36, 0.2)" : "rgba(251, 191, 36, 0.18)", color: dark ? "#FDE68A" : "#92400E" };
  }
  return { backgroundColor: dark ? "rgba(96, 165, 250, 0.18)" : "rgba(23, 105, 232, 0.1)", color: dark ? "#93C5FD" : routeBlue };
}

export function DeliveryWorkflowSheet({ delivery, onClose, route, visible }: DeliveryWorkflowSheetProps) {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  const reduceMotionEnabled = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const sheetRef = useRef<View>(null);
  const hiddenOffset = height + Math.max(insets.bottom, dashboardSpacing.scale.md);
  const translateY = useSharedValue(hiddenOffset);
  const backdropOpacity = useSharedValue(0);
  const sheetRadius = Math.max(28, getCardRadius(width) + 10);
  const horizontalPadding = getScreenHorizontalPadding(width);
  const sheetHeight = Math.max(0, height - insets.top);
  const panelMinHeight = Math.max(236, height * 0.3);
  const panelBackground = dark ? "#000000" : "#FFFFFF";
  const panelBorder = dark ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.08)";
  const [driverLocation, setDriverLocation] = useState<RouteCoordinate | null>(null);
  const [locationPermission, setLocationPermission] = useState<LocationPermissionState>("idle");
  const [routeActive, setRouteActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const stopCoordinate = delivery
    ? getCoordinate(delivery.delivery_latitude, delivery.delivery_longitude) ?? getCoordinate(route?.destination_latitude, route?.destination_longitude)
    : null;
  const address = splitAddress(route?.destination_address ?? delivery?.delivery_address);
  const hasUsableRoute = hasSavedRouteLine(route);
  const statusLabel = getRouteState({
    driverLocation,
    hasRoute: hasUsableRoute,
    routeActive,
    status: delivery?.status ?? null,
    stopCoordinate,
  });
  const badgeTone = getBadgeTone(statusLabel, dark);
  const durationText = formatDuration(route?.estimated_duration_minutes);
  const distanceText = formatDistanceMiles(route?.estimated_distance_km);
  const arrivalText = formatArrivalTime(route?.estimated_duration_minutes);
  const secondaryMetric = distanceText && arrivalText ? `${distanceText} • ${arrivalText}` : "Route details unavailable";
  const routeMessage = !hasUsableRoute && route ? "Saved route line unavailable. Showing stored stops only." : !route ? "No confirmed route is connected to this delivery yet." : null;
  const locationMessage =
    locationPermission === "denied"
      ? "Location permission denied. Route stops are still visible."
      : locationPermission === "unavailable"
        ? "Current location unavailable. Route stops are still visible."
        : null;

  const closeSheet = useCallback(() => {
    translateY.value = withTiming(hiddenOffset, { duration: reduceMotionEnabled ? 120 : 220, easing: Easing.out(Easing.cubic) });
    backdropOpacity.value = withTiming(0, { duration: reduceMotionEnabled ? 100 : 180, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [backdropOpacity, hiddenOffset, onClose, reduceMotionEnabled, translateY]);

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

    const focusTimer = setTimeout(() => {
      const node = sheetRef.current ? findNodeHandle(sheetRef.current) : null;
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, reduceMotionEnabled ? 140 : 260);

    return () => clearTimeout(focusTimer);
  }, [backdropOpacity, hiddenOffset, reduceMotionEnabled, translateY, visible]);

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

  const startRoute = useCallback(() => {
    if (starting || routeActive) return;
    setStarting(true);
    setTimeout(() => {
      setRouteActive(true);
      setStarting(false);
    }, reduceMotionEnabled ? 80 : 180);
  }, [reduceMotionEnabled, routeActive, starting]);

  useEffect(() => {
    if (!visible) {
      setRouteActive(false);
      setStarting(false);
      setDriverLocation(null);
      setLocationPermission("idle");
    }
  }, [visible]);

  if (!delivery) return null;

  return (
    <Modal animationType="none" onRequestClose={closeSheet} statusBarTranslucent transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Animated.View pointerEvents={visible ? "auto" : "none"} style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable accessibilityLabel="Close delivery workflow" accessibilityRole="button" onPress={closeSheet} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          accessibilityLabel="Delivery route"
          accessibilityRole="summary"
          accessible
          onStartShouldSetResponder={() => true}
          onResponderRelease={stopPropagation}
          ref={sheetRef}
          style={[
            styles.sheet,
            dashboardShadows.elevatedCard,
            {
              backgroundColor: dark ? "#000000" : "#F8FAFC",
              borderColor: panelBorder,
              borderTopLeftRadius: sheetRadius,
              borderTopRightRadius: sheetRadius,
              height: sheetHeight,
            },
            sheetAnimatedStyle,
          ]}
        >
          <DeliveryRouteMap
            delivery={delivery}
            onDriverLocationChange={setDriverLocation}
            onLocationPermissionChange={setLocationPermission}
            panelHeight={panelMinHeight + Math.max(insets.bottom, dashboardSpacing.scale.md)}
            route={route}
            routeActive={routeActive}
            visible={visible}
          />
          <Pressable
            accessibilityLabel="Close delivery route"
            accessibilityRole="button"
            onPress={closeSheet}
            style={[
              styles.backButton,
              {
                left: horizontalPadding,
                top: dashboardSpacing.scale.lg,
              },
            ]}
          >
            <SymbolView fallback={<Text style={styles.backFallback}>{"<"}</Text>} name="chevron.left" size={28} tintColor={routeBlue} type="hierarchical" />
          </Pressable>
          <GestureDetector gesture={panGesture}>
            <View
              accessible
              accessibilityLabel={`Next stop. ${address.primary}. ${address.secondary}. ${statusLabel}.`}
              style={[
                styles.infoPanel,
                {
                  backgroundColor: panelBackground,
                  borderColor: panelBorder,
                  minHeight: panelMinHeight,
                  paddingBottom: Math.max(insets.bottom + dashboardSpacing.scale.md, dashboardSpacing.scale.xl),
                  paddingHorizontal: horizontalPadding,
                },
              ]}
            >
              <View style={styles.addressBlock}>
                <Text maxFontSizeMultiplier={1.25} style={[styles.nextStopLabel, { color: dark ? "rgba(235, 235, 245, 0.62)" : "#6B7280" }]}>
                  Next stop
                </Text>
                <Text maxFontSizeMultiplier={1.18} style={[styles.primaryAddress, { color: dark ? "#FFFFFF" : "#080A0F" }]}>
                  {address.primary}
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={[styles.secondaryAddress, { color: dark ? "rgba(235, 235, 245, 0.78)" : "#242936" }]}>
                  {address.secondary}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: badgeTone.backgroundColor }]}>
                  <Text maxFontSizeMultiplier={1.15} style={[styles.statusBadgeText, { color: badgeTone.color }]}>
                    {statusLabel}
                  </Text>
                </View>
                {routeMessage ? (
                  <Text maxFontSizeMultiplier={1.15} style={[styles.noticeText, { color: colors.textSecondary }]}>
                    {routeMessage}
                  </Text>
                ) : null}
                {locationMessage ? (
                  <Text maxFontSizeMultiplier={1.15} style={[styles.noticeText, { color: colors.textSecondary }]}>
                    {locationMessage}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.divider, { backgroundColor: dark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)" }]} />
              <View style={styles.metricsRow}>
                <View style={styles.metricsCopy}>
                  <Text maxFontSizeMultiplier={1.2} style={styles.durationText}>
                    {durationText ?? "Route unavailable"}
                  </Text>
                  <Text maxFontSizeMultiplier={1.18} style={[styles.distanceText, { color: dark ? "rgba(235, 235, 245, 0.62)" : "#8A8F9E" }]}>
                    {secondaryMetric}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Start delivery route"
                  accessibilityRole="button"
                  accessibilityState={{ busy: starting, disabled: starting || routeActive }}
                  disabled={starting || routeActive}
                  onPress={startRoute}
                  style={({ pressed }) => [
                    styles.startButton,
                    {
                      opacity: pressed ? 0.86 : starting || routeActive ? 0.72 : 1,
                    },
                  ]}
                >
                  {starting ? <ActivityIndicator color="#FFFFFF" /> : <Text maxFontSizeMultiplier={1.15} style={styles.startButtonText}>Start</Text>}
                </Pressable>
              </View>
            </View>
          </GestureDetector>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
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
  addressBlock: {
    gap: 6,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    elevation: 5,
    height: 52,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    width: 52,
    zIndex: 10,
  },
  backFallback: {
    color: routeBlue,
    fontSize: 26,
    fontWeight: "700",
  },
  distanceText: {
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 28,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: dashboardSpacing.scale.md,
    width: "100%",
  },
  durationText: {
    color: routeBlue,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 37,
  },
  infoPanel: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    gap: dashboardSpacing.scale.md,
    left: 0,
    paddingTop: 28,
    position: "absolute",
    right: 0,
    zIndex: 8,
  },
  metricsCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  metricsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.lg,
    justifyContent: "space-between",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  nextStopLabel: {
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 24,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  primaryAddress: {
    fontSize: 33,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 39,
  },
  secondaryAddress: {
    fontSize: 26,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 32,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#11131D",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 68,
    minWidth: 150,
    paddingHorizontal: 34,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 31,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    marginTop: dashboardSpacing.scale.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusBadgeText: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 22,
  },
});
