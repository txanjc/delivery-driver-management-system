import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, findNodeHandle, Modal, Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
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
import { DashboardGlassSurface } from "@/components/dashboard/DashboardGlassSurface";
import { DeliveryRouteMap, hasSavedRouteLine } from "@/components/deliveries/DeliveryRouteMap";
import type { LocationPermissionState, RouteCoordinate } from "@/components/deliveries/DeliveryRouteMap";
import { LiquidGlassButton } from "@/components/shared/LiquidGlassButton";
import { useAuth } from "@/hooks/useAuth";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { updateDeliveryStatusForDriver } from "@/services/delivery.service";
import { getDriverNavigation } from "@/services/navigation.service";
import type { Delivery } from "@/types/delivery";
import type { DriverNavigation, NavigationTarget } from "@/types/navigation";
import type { Route } from "@/types/route";
import { triggerHaptic } from "@/utils/haptics";

type DeliveryWorkflowSheetProps = {
  delivery: Delivery | null;
  onClose: () => void;
  onDeliveryUpdated?: (delivery: Delivery) => void;
  route: Route | null;
  visible: boolean;
};

const dismissThreshold = 110;
const routeBlue = "#6D4AFF";
const metersPerMile = 1609.344;
const arrivalDistanceMeters = 80;

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
  target,
}: {
  driverLocation: RouteCoordinate | null;
  hasRoute: boolean;
  routeActive: boolean;
  status: string | null;
  stopCoordinate: RouteCoordinate | null;
  target: NavigationTarget;
}) {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "delivered") return "Completed";
  if (normalized === "delayed") return "Delayed";
  if (!hasRoute && !stopCoordinate) return "Route Unavailable";
  if (!routeActive) return "Not Started";

  const destination = target === "pickup" ? "Pickup" : "Delivery";
  const distance = distanceMeters(driverLocation, stopCoordinate);
  if (distance === null) return `Driving To ${destination}`;
  if (distance <= 0.05 * metersPerMile) return `At ${destination}`;
  if (distance <= 0.25 * metersPerMile) return `Approaching ${destination}`;
  return `Driving To ${destination}`;
}

function getBadgeTone(label: string, dark: boolean) {
  if (label.startsWith("Approaching")) {
    return { backgroundColor: "#FED766", color: "#5D3B00" };
  }
  if (label.startsWith("At ") || label === "Completed") {
    return { backgroundColor: dark ? "rgba(74, 222, 128, 0.2)" : "rgba(22, 163, 74, 0.12)", color: dark ? "#86EFAC" : "#166534" };
  }
  if (label === "Delayed" || label === "Route Unavailable") {
    return { backgroundColor: dark ? "rgba(251, 191, 36, 0.2)" : "rgba(251, 191, 36, 0.18)", color: dark ? "#FDE68A" : "#92400E" };
  }
  return { backgroundColor: dark ? "rgba(96, 165, 250, 0.18)" : "rgba(23, 105, 232, 0.1)", color: dark ? "#93C5FD" : routeBlue };
}

export function DeliveryWorkflowSheet({ delivery, onClose, onDeliveryUpdated, route, visible }: DeliveryWorkflowSheetProps) {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  const reduceMotionEnabled = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const { driver, loading: profileLoading } = useDriverProfile();
  const colors = getDashboardColors(colorScheme);
  const sheetRef = useRef<View>(null);
  const hiddenOffset = height + Math.max(insets.bottom, dashboardSpacing.scale.md);
  const translateY = useSharedValue(hiddenOffset);
  const backdropOpacity = useSharedValue(0);
  const sheetRadius = Math.max(28, getCardRadius(width) + 10);
  const horizontalPadding = getScreenHorizontalPadding(width);
  const [navigationPanelCollapsed, setNavigationPanelCollapsed] = useState(false);
  const [navigationPanelHeight, setNavigationPanelHeight] = useState(0);
  const [mapFocusRequest, setMapFocusRequest] = useState(0);
  const [mapZoomDelta, setMapZoomDelta] = useState(1);
  const [mapZoomRequest, setMapZoomRequest] = useState(0);
  const sheetHeight = Math.max(0, height - insets.top);
  const panelMinHeight = navigationPanelCollapsed ? 206 : Math.max(236, height * 0.3);
  const mapPanelHeight = Math.max(panelMinHeight, navigationPanelHeight);
  const panelBackground = dark ? "rgba(48, 49, 54, 0.94)" : "rgba(255, 255, 255, 0.9)";
  const panelBorder = dark ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.08)";
  const [driverLocation, setDriverLocation] = useState<RouteCoordinate | null>(null);
  const [locationPermission, setLocationPermission] = useState<LocationPermissionState>("idle");
  const [routeActive, setRouteActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [navigation, setNavigation] = useState<DriverNavigation | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const navigationRequestRef = useRef<{ deliveryId: string; location: RouteCoordinate; requestedAt: number } | null>(null);
  const arrivalNoticeRef = useRef<NavigationTarget | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget>("pickup");
  const currentStatus = delivery?.status?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  const deliveryInTransit = currentStatus === "in_transit";
  const pickupCoordinate = delivery
    ? getCoordinate(delivery.pickup_latitude, delivery.pickup_longitude) ?? getCoordinate(route?.origin_latitude, route?.origin_longitude)
    : null;
  const dropoffCoordinate = delivery
    ? getCoordinate(delivery.delivery_latitude, delivery.delivery_longitude) ?? getCoordinate(route?.destination_latitude, route?.destination_longitude)
    : null;
  const stopCoordinate = navigationTarget === "pickup" ? pickupCoordinate : dropoffCoordinate;
  const stageAddress = navigationTarget === "pickup"
    ? splitAddress(route?.origin_address ?? delivery?.pickup_address)
    : splitAddress(route?.destination_address ?? delivery?.delivery_address);
  const address = splitAddress(route?.destination_address ?? delivery?.delivery_address);
  const hasUsableRoute = hasSavedRouteLine(route);
  const statusLabel = getRouteState({
    driverLocation,
    hasRoute: hasUsableRoute,
    routeActive: routeActive || deliveryInTransit,
    status: delivery?.status ?? null,
    stopCoordinate,
    target: navigationTarget,
  });
  const badgeTone = getBadgeTone(statusLabel, dark);
  const durationText = formatDuration(navigation?.durationSeconds ? navigation.durationSeconds / 60 : route?.estimated_duration_minutes);
  const distanceText = formatDistanceMiles(navigation?.distanceMeters ? navigation.distanceMeters / 1000 : route?.estimated_distance_km);
  const arrivalText = formatArrivalTime(navigation?.durationSeconds ? navigation.durationSeconds / 60 : route?.estimated_duration_minutes);
  const secondaryMetric = distanceText && arrivalText ? `${distanceText} • ${arrivalText}` : "Route details unavailable";
  const routeMessage = !hasUsableRoute && route ? "Saved route line unavailable. Showing stored stops only." : !route ? "No confirmed route is connected to this delivery yet." : null;
  const locationMessage =
    locationPermission === "denied"
      ? "Location permission denied. Route stops are still visible."
      : locationPermission === "unavailable"
        ? "Current location unavailable. Route stops are still visible."
        : null;
  const arrivedAtTarget = Boolean(driverLocation && stopCoordinate && (distanceMeters(driverLocation, stopCoordinate) ?? Number.POSITIVE_INFINITY) <= arrivalDistanceMeters);

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

  const startRoute = useCallback(async () => {
    if (!delivery || starting || routeActive) return;

    if (deliveryInTransit) {
      setActionError(null);
      setRouteActive(true);
      return;
    }

    if (!driver || !user || profileLoading) {
      setActionError("We couldn’t start this delivery. Please try again.");
      return;
    }

    setStarting(true);
    setActionError(null);
    const response = await updateDeliveryStatusForDriver({
      deliveryId: delivery.delivery_id,
      driverId: driver.driver_id,
      previousStatus: delivery.status,
      status: "in_transit",
      userId: user.id,
    });

    if (!response.data || response.error) {
      console.error("Failed to start delivery", response.error);
      setActionError("We couldn’t start this delivery. Please try again.");
      setStarting(false);
      return;
    }

    onDeliveryUpdated?.(response.data);
    triggerHaptic("success");
    setRouteActive(true);
    setStarting(false);
  }, [delivery, deliveryInTransit, driver, onDeliveryUpdated, profileLoading, routeActive, starting, user]);

  const completeDelivery = useCallback(() => {
    if (!delivery || starting) return;

    closeSheet();
    setTimeout(() => {
      router.push({ pathname: "/(driver)/status-update/[deliveryId]", params: { deliveryId: delivery.delivery_id } });
    }, reduceMotionEnabled ? 120 : 220);
  }, [closeSheet, delivery, reduceMotionEnabled, router, starting]);

  const confirmPickup = useCallback(() => {
    setNavigationTarget("dropoff");
    setNavigation(null);
    setNavigationError(null);
    navigationRequestRef.current = null;
    arrivalNoticeRef.current = null;
  }, []);

  const actionLabel = routeActive
    ? arrivedAtTarget
      ? navigationTarget === "pickup" ? "Confirm Pickup" : "Complete Delivery"
      : "Navigating"
    : deliveryInTransit ? "Resume Route" : "Start Delivery";
  const actionPress = routeActive
    ? navigationTarget === "pickup" ? confirmPickup : completeDelivery
    : startRoute;
  const actionDisabled = starting || (profileLoading && !deliveryInTransit) || (routeActive && !arrivedAtTarget);

  useEffect(() => {
    if (!visible) {
      setRouteActive(false);
      setStarting(false);
      setActionError(null);
      setNavigation(null);
      setNavigationError(null);
      navigationRequestRef.current = null;
      arrivalNoticeRef.current = null;
      setNavigationTarget("pickup");
      setNavigationPanelCollapsed(false);
      setNavigationPanelHeight(0);
      setDriverLocation(null);
      setLocationPermission("idle");
    }
  }, [visible]);

  useEffect(() => {
    if (!routeActive || !delivery || !driverLocation) return;

    const activeDelivery: Delivery = delivery;
    const currentLocation: RouteCoordinate = driverLocation;
    const previousRequest = navigationRequestRef.current;
    const locationChanged = previousRequest ? (distanceMeters(previousRequest.location, currentLocation) ?? 0) > 250 : true;
    const requestExpired = previousRequest ? Date.now() - previousRequest.requestedAt >= 60_000 : true;
    if (previousRequest?.deliveryId === activeDelivery.delivery_id && !locationChanged && !requestExpired) return;

    let cancelled = false;
    navigationRequestRef.current = { deliveryId: activeDelivery.delivery_id, location: currentLocation, requestedAt: Date.now() };
    setNavigationError(null);
    void getDriverNavigation(activeDelivery.delivery_id, currentLocation, navigationTarget).then((response) => {
      if (cancelled) return;
      if (response.data) {
        setNavigation(response.data);
        return;
      }
      console.error("Unable to load in-app navigation", response.error);
      setNavigationError("Live directions are unavailable. Following the saved route.");
    });

    return () => {
      cancelled = true;
    };
  }, [delivery, driverLocation, navigationTarget, routeActive]);

  useEffect(() => {
    if (!routeActive || !arrivedAtTarget || arrivalNoticeRef.current === navigationTarget) return;

    arrivalNoticeRef.current = navigationTarget;
    triggerHaptic("success");
    Alert.alert(
      navigationTarget === "pickup" ? "Arrived At Pickup" : "Arrived At Delivery",
      navigationTarget === "pickup"
        ? "Confirm pickup when the package is in your possession."
        : "You have arrived at the delivery destination. Complete delivery when proof is ready.",
    );
  }, [arrivedAtTarget, navigationTarget, routeActive]);

  const nextInstruction = useMemo(() => {
    if (!navigation?.steps.length) return null;
    const currentLocation = driverLocation;
    if (!currentLocation) return navigation.steps[0] ?? null;

    return navigation.steps.find((step) => !step.end || (distanceMeters(currentLocation, step.end) ?? Number.POSITIVE_INFINITY) > 35) ?? navigation.steps.at(-1) ?? null;
  }, [driverLocation, navigation]);

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
          ref={sheetRef}
          style={[
            styles.sheet,
            dashboardShadows.elevatedCard,
            {
              backgroundColor: "transparent",
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
            focusRequest={mapFocusRequest}
            zoomDelta={mapZoomDelta}
            zoomRequest={mapZoomRequest}
            onDriverLocationChange={setDriverLocation}
            onLocationPermissionChange={setLocationPermission}
            panelHeight={mapPanelHeight + Math.max(insets.bottom, dashboardSpacing.scale.md)}
            routePolyline={navigation?.encodedPolyline}
            route={route}
            routeActive={routeActive}
            visible={visible}
          />
          <LiquidGlassButton
            accessibilityLabel="Close delivery route"
            accentColor={routeBlue}
            borderless
            capsule
            emphasized
            glassEffectStyle="clear"
            onPress={closeSheet}
            radius={999}
            style={[
              styles.backButton,
              {
                left: horizontalPadding,
                top: dashboardSpacing.scale.lg,
              },
            ]}
            variant="secondaryNeutral"
          >
            <SymbolView fallback={<Text style={styles.backFallback}>{"<"}</Text>} name="chevron.left" size={28} tintColor={routeBlue} type="hierarchical" />
          </LiquidGlassButton>
          <LiquidGlassButton
            accessibilityLabel="Recenter route map"
            accentColor={routeBlue}
            borderless
            capsule
            emphasized
            glassEffectStyle="clear"
            onPress={() => {
              setMapFocusRequest((value) => value + 1);
            }}
            radius={999}
            style={[
              styles.mapControl,
              {
                right: horizontalPadding,
                top: dashboardSpacing.scale.lg,
              },
            ]}
            variant="secondaryNeutral"
          >
            <SymbolView fallback={<Text style={styles.mapControlFallback}>◎</Text>} name="location.north.fill" size={21} tintColor={routeBlue} type="hierarchical" />
          </LiquidGlassButton>
          <View style={[styles.mapZoomControls, { bottom: mapPanelHeight + 16, right: horizontalPadding }]}>
            <DashboardGlassSurface
              fallbackColor={panelBackground}
              glassEffectStyle="clear"
              pointerEvents="none"
              style={styles.mapZoomGlass}
              tintColor={dark ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.5)"}
            />
            <View pointerEvents="none" style={[styles.mapZoomVeil, { backgroundColor: dark ? "rgba(32, 33, 38, 0.26)" : "rgba(255,255,255,0.24)" }]} />
            <Pressable
              accessibilityLabel="Zoom in on route map"
              accessibilityRole="button"
              disabled={!routeActive}
              onPress={() => {
                triggerHaptic("selection");
                setMapZoomDelta(1);
                setMapZoomRequest((value) => value + 1);
              }}
              style={({ pressed }) => [styles.mapZoomButton, { opacity: !routeActive ? 0.45 : pressed ? 0.72 : 1 }]}
            >
              <SymbolView fallback={<Text style={styles.mapControlFallback}>+</Text>} name="plus" size={20} tintColor={routeBlue} type="hierarchical" />
            </Pressable>
            <View style={styles.mapZoomDivider} />
            <Pressable
              accessibilityLabel="Zoom out on route map"
              accessibilityRole="button"
              disabled={!routeActive}
              onPress={() => {
                triggerHaptic("selection");
                setMapZoomDelta(-1);
                setMapZoomRequest((value) => value + 1);
              }}
              style={({ pressed }) => [styles.mapZoomButton, { opacity: !routeActive ? 0.45 : pressed ? 0.72 : 1 }]}
            >
              <SymbolView fallback={<Text style={styles.mapControlFallback}>−</Text>} name="minus" size={20} tintColor={routeBlue} type="hierarchical" />
            </Pressable>
          </View>
          <GestureDetector gesture={panGesture}>
            <View
              accessible
              onLayout={(event) => {
                const nextHeight = event.nativeEvent.layout.height;
                setNavigationPanelHeight((currentHeight) => Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight);
              }}
              accessibilityLabel={`Next stop. ${address.primary}. ${address.secondary}. ${statusLabel}.`}
              style={[
                styles.infoPanel,
                navigationPanelCollapsed && styles.collapsedInfoPanel,
                {
                  backgroundColor: "transparent",
                  borderColor: panelBorder,
                  minHeight: panelMinHeight,
                  paddingBottom: Math.max(insets.bottom + dashboardSpacing.scale.md, dashboardSpacing.scale.xl),
                  paddingHorizontal: horizontalPadding,
                },
              ]}
            >
              <DashboardGlassSurface
                fallbackColor={panelBackground}
                pointerEvents="none"
                style={styles.panelGlass}
                tintColor={dark ? "rgba(135, 137, 148, 0.19)" : "rgba(255,255,255,0.34)"}
              />
              <View pointerEvents="none" style={[styles.panelGlassVeil, { backgroundColor: dark ? "rgba(32, 33, 38, 0.14)" : "rgba(255,255,255,0.16)" }]} />
              <View style={[styles.addressBlock, navigationPanelCollapsed && styles.collapsedAddressBlock]}>
                <Text maxFontSizeMultiplier={1.25} style={[styles.nextStopLabel, { color: dark ? "rgba(235, 235, 245, 0.62)" : "#6B7280" }]}>
                  {routeActive ? "Next turn" : navigationTarget === "pickup" ? "Pickup location" : "Delivery destination"}
                </Text>
                <Text maxFontSizeMultiplier={1.18} numberOfLines={navigationPanelCollapsed ? 1 : undefined} style={[styles.primaryAddress, navigationPanelCollapsed && styles.collapsedPrimaryAddress, { color: dark ? "#FFFFFF" : "#080A0F" }]}>
                  {routeActive ? (nextInstruction?.instruction ?? "Follow the highlighted route") : stageAddress.primary}
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={[styles.secondaryAddress, navigationPanelCollapsed && styles.collapsedHidden, { color: dark ? "rgba(235, 235, 245, 0.78)" : "#242936" }]}>
                  {routeActive && nextInstruction?.distanceMeters ? `${Math.max(1, Math.round(nextInstruction.distanceMeters))} m â€¢ ${stageAddress.primary}` : stageAddress.secondary}
                </Text>
                <View style={[styles.statusBadge, navigationPanelCollapsed && styles.collapsedStatusBadge, { backgroundColor: badgeTone.backgroundColor }]}>
                  <Text maxFontSizeMultiplier={1.15} style={[styles.statusBadgeText, { color: badgeTone.color }]}>
                    {statusLabel}
                  </Text>
                </View>
                {routeMessage ? (
                  <Text maxFontSizeMultiplier={1.15} style={[styles.noticeText, navigationPanelCollapsed && styles.collapsedHidden, { color: colors.textSecondary }]}>
                    {routeMessage}
                  </Text>
                ) : null}
                {locationMessage ? (
                  <Text maxFontSizeMultiplier={1.15} style={[styles.noticeText, navigationPanelCollapsed && styles.collapsedHidden, { color: colors.textSecondary }]}>
                    {locationMessage}
                  </Text>
                ) : null}
                {actionError ? (
                  <Text maxFontSizeMultiplier={1.15} style={[styles.errorText, navigationPanelCollapsed && styles.collapsedHidden, { color: colors.danger }]}>
                    {actionError}
                  </Text>
                ) : null}
                {navigationError ? (
                  <Text maxFontSizeMultiplier={1.15} style={[styles.noticeText, navigationPanelCollapsed && styles.collapsedHidden, { color: colors.textSecondary }]}>
                    {navigationError}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.divider, navigationPanelCollapsed && styles.collapsedDivider, { backgroundColor: dark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)" }]} />
              <View style={styles.metricsRow}>
                <View style={[styles.metricsCopy, navigationPanelCollapsed && styles.collapsedMetricsCopy]}>
                  <Text maxFontSizeMultiplier={1.2} style={[styles.durationText, { color: dark ? "#FFFFFF" : "#101828" }]}>
                    {durationText ?? "Route unavailable"}
                  </Text>
                  <Text maxFontSizeMultiplier={1.18} style={[styles.distanceText, { color: dark ? "rgba(235, 235, 245, 0.62)" : "#8A8F9E" }]}>
                    {secondaryMetric}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={actionLabel}
                  accessibilityRole="button"
                  accessibilityState={{ busy: starting, disabled: actionDisabled }}
                  disabled={actionDisabled}
                  onPress={() => { void actionPress(); }}
                  style={({ pressed }) => [
                    styles.startButton,
                    {
                      opacity: pressed ? 0.86 : actionDisabled ? 0.72 : 1,
                    },
                  ]}
                >
                  {starting ? <ActivityIndicator color="#FFFFFF" /> : <Text maxFontSizeMultiplier={1.15} style={styles.startButtonText}>{actionLabel}</Text>}
                </Pressable>
              </View>
              <Pressable
                accessibilityLabel={navigationPanelCollapsed ? "Expand navigation details" : "Collapse navigation details"}
                accessibilityRole="button"
                onPress={() => {
                  triggerHaptic("selection");
                  setNavigationPanelCollapsed((collapsed) => !collapsed);
                }}
                style={({ pressed }) => [
                  styles.collapseButton,
                  { opacity: pressed ? 0.74 : 1 },
                ]}
              >
                <Text maxFontSizeMultiplier={1.1} style={[styles.collapseButtonText, { color: dark ? "rgba(235,235,245,0.78)" : "#667085" }]}>
                  {navigationPanelCollapsed ? "Show Details" : "Hide Details"}
                </Text>
                <SymbolView fallback={<Text style={styles.collapseFallback}>{navigationPanelCollapsed ? "⌃" : "⌄"}</Text>} name={navigationPanelCollapsed ? "chevron.up" : "chevron.down"} size={14} tintColor={dark ? "rgba(235,235,245,0.78)" : "#667085"} type="hierarchical" />
              </Pressable>
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
    gap: 4,
    paddingRight: 108,
  },
  backButton: {
    alignItems: "center",
    borderRadius: 999,
    elevation: 5,
    height: 48,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    width: 48,
    zIndex: 10,
  },
  mapControl: {
    alignItems: "center",
    borderRadius: 999,
    elevation: 5,
    height: 48,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    width: 48,
    zIndex: 10,
  },
  mapZoomControls: {
    alignItems: "center",
    borderRadius: 18,
    elevation: 5,
    overflow: "hidden",
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    width: 44,
    zIndex: 10,
  },
  mapZoomGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  mapZoomVeil: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  mapZoomButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 44,
  },
  mapZoomDivider: {
    backgroundColor: "rgba(15, 23, 42, 0.1)",
    height: StyleSheet.hairlineWidth,
    width: 28,
  },
  mapControlFallback: {
    color: routeBlue,
    fontSize: 23,
    fontWeight: "700",
  },
  backFallback: {
    color: routeBlue,
    fontSize: 26,
    fontWeight: "700",
  },
  distanceText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: dashboardSpacing.scale.md,
    width: "100%",
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 28,
  },
  infoPanel: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    gap: 12,
    left: 0,
    overflow: "hidden",
    paddingTop: 22,
    position: "absolute",
    right: 0,
    zIndex: 8,
  },
  collapsedInfoPanel: {
    gap: 8,
    paddingTop: 16,
  },
  panelGlass: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  panelGlassVeil: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  collapsedAddressBlock: {
    gap: 2,
  },
  collapsedPrimaryAddress: {
    fontSize: 21,
    lineHeight: 26,
  },
  collapsedStatusBadge: {
    marginTop: 0,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  collapsedHidden: {
    display: "none",
  },
  collapsedDivider: {
    marginTop: 2,
  },
  metricsCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  collapsedMetricsCopy: {
    gap: 0,
  },
  metricsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
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
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 20,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  primaryAddress: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 31,
  },
  secondaryAddress: {
    fontSize: 17,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 22,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: routeBlue,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 126,
    paddingHorizontal: 20,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 20,
  },
  collapseButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.56)",
    borderColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 10,
    position: "absolute",
    right: 16,
    top: 14,
    zIndex: 2,
  },
  collapseButtonText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  collapseFallback: {
    fontSize: 16,
    fontWeight: "700",
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 17,
  },
});
