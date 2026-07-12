import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, useWindowDimensions, View } from "react-native";
import type { DimensionValue, ListRenderItem } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { DashboardScrollEdge } from "@/components/dashboard/DashboardScrollEdge";
import { DeliveryCardStack } from "@/components/deliveries/DeliveryCardStack";
import { DeliveryDetailsSheet } from "@/components/deliveries/DeliveryDetailsSheet";
import { DeliveryWorkflowSheet } from "@/components/deliveries/DeliveryWorkflowSheet";
import { GlassActionButton } from "@/components/shared/GlassActionButton";
import { ProfileButton } from "@/components/shared/ProfileButton";
import {
  dashboardLiquidGlass,
  dashboardMaxFontSizeMultipliers,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getButtonHeight,
  getCardPadding,
  getCardRadius,
  getDashboardColors,
  getSafeAreaTopSpacing,
  getScreenHorizontalPadding,
  getScrollContentBottomPadding,
  getSectionGap,
} from "@/components/dashboard/dashboardDesignSpec";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { getDeliveriesForDriver } from "@/services/delivery.service";
import { getRoutesForDeliveriesForDriver } from "@/services/route.service";
import type { Delivery } from "@/types/delivery";
import type { Route } from "@/types/route";
import { triggerButtonHaptic, triggerRefreshReadyHaptic, triggerRefreshStartHaptic } from "@/utils/haptics";

type DeliveryStatus = "pending" | "assigned" | "in_transit" | "delivered" | "delayed" | "failed" | "returned";
type DeliveryFilter = "all" | "active" | "completed" | "exceptions";

type DeliveryCardProps = {
  colors: ReturnType<typeof getDashboardColors>;
  delivery: Delivery;
  emphasized: boolean;
  onAction: (delivery: Delivery) => void;
  onOpen: (delivery: Delivery) => void;
  route: Route | null;
  width: number;
};

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Delivery>);
const refreshHeaderMaxHeight = 52;
const refreshIndicatorSize = 36;
const refreshStateIdle = 0;
const refreshStatePulling = 1;
const refreshStateReady = 2;
const refreshStateRefreshing = 3;
const refreshStateSettling = 4;
const deliveryFilters: Array<{ label: string; value: DeliveryFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Exceptions", value: "exceptions" },
];

const approvedStatuses = new Set<DeliveryStatus>(["pending", "assigned", "in_transit", "delivered", "delayed", "failed", "returned"]);

function normalizeStatus(status: string | null): DeliveryStatus | null {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  return approvedStatuses.has(normalized as DeliveryStatus) ? (normalized as DeliveryStatus) : null;
}

function formatStatus(status: string | null) {
  const normalized = normalizeStatus(status);
  if (!normalized) return "Status unavailable";

  return normalized
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getDeliveryEmphasisPriority(delivery: Delivery) {
  const normalized = normalizeStatus(delivery.status);
  if (normalized === "in_transit") return 0;
  if (normalized === "delayed") return 1;
  if (normalized === "assigned") return 2;
  return null;
}

function getDeliveryPriorityRank(priority: string | null) {
  const normalized = priority?.trim().toLowerCase() ?? "";
  if (normalized === "high") return 0;
  if (normalized === "normal") return 1;
  if (normalized === "low") return 2;
  return 3;
}

function getStableDeliverySortValue(delivery: Delivery) {
  return delivery.created_at || delivery.delivery_id;
}

function compareDeliveriesForDisplay(left: Delivery, right: Delivery, routesByDeliveryId: Record<string, Route> = {}) {
  const leftStatusPriority = getDeliveryEmphasisPriority(left) ?? 3;
  const rightStatusPriority = getDeliveryEmphasisPriority(right) ?? 3;

  if (leftStatusPriority !== rightStatusPriority) {
    return leftStatusPriority - rightStatusPriority;
  }

  const leftPriorityRank = getDeliveryPriorityRank(left.priority);
  const rightPriorityRank = getDeliveryPriorityRank(right.priority);

  if (leftPriorityRank !== rightPriorityRank) {
    return leftPriorityRank - rightPriorityRank;
  }

  const leftRouteSequence = routesByDeliveryId[left.delivery_id]?.route_id ?? "";
  const rightRouteSequence = routesByDeliveryId[right.delivery_id]?.route_id ?? "";

  if (leftRouteSequence && rightRouteSequence) {
    return leftRouteSequence.localeCompare(rightRouteSequence);
  }

  if (leftRouteSequence) return -1;
  if (rightRouteSequence) return 1;

  return getStableDeliverySortValue(left).localeCompare(getStableDeliverySortValue(right));
}

function getOrderedDeliveries(deliveries: Delivery[], routesByDeliveryId: Record<string, Route> = {}) {
  return [...deliveries].sort((left, right) => compareDeliveriesForDisplay(left, right, routesByDeliveryId));
}

function deliveryMatchesFilter(delivery: Delivery, filter: DeliveryFilter) {
  const normalized = normalizeStatus(delivery.status);

  if (filter === "active") {
    return normalized === "pending" || normalized === "assigned" || normalized === "in_transit" || normalized === "delayed";
  }

  if (filter === "completed") {
    return normalized === "delivered";
  }

  if (filter === "exceptions") {
    return normalized === "delayed" || normalized === "failed" || normalized === "returned";
  }

  return true;
}

function deliveryMatchesSearch(delivery: Delivery, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [delivery.delivery_number, delivery.customer_name, delivery.pickup_address, delivery.delivery_address]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function getFilteredDeliveries(deliveries: Delivery[], filter: DeliveryFilter, query: string) {
  return deliveries.filter((delivery) => deliveryMatchesFilter(delivery, filter) && deliveryMatchesSearch(delivery, query));
}

function getFilteredEmptyCopy(error: boolean, filter: DeliveryFilter, query: string) {
  if (error) {
    return {
      message: "Deliveries could not be loaded. Please try again.",
      title: "Deliveries unavailable",
    };
  }

  if (query.trim()) {
    return {
      message: "No deliveries match your search.",
      title: "No search results",
    };
  }

  if (filter !== "all") {
    return {
      message: "No deliveries match this status.",
      title: "No filtered results",
    };
  }

  return {
    message: "You don't have any deliveries assigned right now.",
    title: "No assigned deliveries",
  };
}

function getStackContextCopy(count: number) {
  if (count <= 0) return "";
  if (count === 1) return "1 Upcoming Delivery";
  if (count <= 6) return `${count} Upcoming Deliveries`;

  return `6 Upcoming Deliveries  +${count - 6} more`;
}

function getProgressInfo(status: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "delivered") {
    return { fillPercent: 100, stateLabel: "Delivered", step: 3 };
  }

  if (normalized === "in_transit") {
    return { fillPercent: 50, stateLabel: "In Transit", step: 2 };
  }

  if (normalized === "delayed") {
    return { fillPercent: 50, stateLabel: "Delayed", step: 2 };
  }

  if (normalized === "failed") {
    return { fillPercent: 100, stateLabel: "Failed", step: 3 };
  }

  if (normalized === "returned") {
    return { fillPercent: 100, stateLabel: "Returned", step: 3 };
  }

  if (normalized === "assigned" || normalized === "pending") {
    return { fillPercent: 12, stateLabel: "Assigned", step: 1 };
  }

  return { fillPercent: 0, stateLabel: "Status unavailable", step: 0 };
}

function AnimatedProgressFill({ fillPercent }: { fillPercent: number }) {
  const reduceMotionEnabled = useReducedMotion();
  const glowProgress = useSharedValue(0);
  const fillWidth = `${fillPercent}%` as DimensionValue;

  useEffect(() => {
    if (reduceMotionEnabled) {
      glowProgress.value = 0.45;
      return;
    }

    glowProgress.value = withRepeat(withTiming(1, { duration: 1350, easing: Easing.inOut(Easing.cubic) }), -1, false);

    return () => {
      cancelAnimation(glowProgress);
      glowProgress.value = 0;
    };
  }, [glowProgress, reduceMotionEnabled]);

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowProgress.value, [0, 0.18, 0.82, 1], [0, 0.75, 0.75, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(glowProgress.value, [0, 1], [-44, 280], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={[styles.progressFill, { width: fillWidth }]}>
      <Animated.View pointerEvents="none" style={[styles.progressGlow, glowAnimatedStyle]} />
    </View>
  );
}

function getStatusTone(status: string | null, colors: ReturnType<typeof getDashboardColors>) {
  const normalized = normalizeStatus(status);

  if (normalized === "delivered") {
    return {
      backgroundColor: "rgba(5, 150, 105, 0.12)",
      borderColor: "rgba(5, 150, 105, 0.22)",
      color: colors.success,
    };
  }

  if (normalized === "delayed" || normalized === "failed" || normalized === "returned") {
    return {
      backgroundColor: "rgba(251, 191, 36, 0.14)",
      borderColor: "rgba(251, 191, 36, 0.26)",
      color: colors.warning,
    };
  }

  if (normalized === "in_transit" || normalized === "assigned") {
    return {
      backgroundColor: "rgba(109, 74, 255, 0.12)",
      borderColor: "rgba(109, 74, 255, 0.22)",
      color: colors.accent,
    };
  }

  return {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.subtleBorder,
    color: colors.textSecondary,
  };
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    b: value & 255,
    g: (value >> 8) & 255,
    r: (value >> 16) & 255,
  };
}

function alpha(hex: string, opacity: number) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function getDeliveryAction(status: string | null) {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case "assigned":
      return { disabled: false, icon: "play.fill" as const, label: "Begin Delivery" };
    case "in_transit":
      return { disabled: false, icon: "location.fill" as const, label: "Continue Delivery" };
    case "delayed":
      return { disabled: false, icon: "clock.fill" as const, label: "Continue Delivery" };
    case "delivered":
      return { disabled: false, icon: "checkmark.circle.fill" as const, label: "View Delivery" };
    case "failed":
      return { disabled: false, icon: "exclamationmark.triangle.fill" as const, label: "Review Failure" };
    case "returned":
      return { disabled: false, icon: "arrow.uturn.left.circle.fill" as const, label: "Review Return" };
    case "pending":
      return { disabled: true, icon: "pause.circle" as const, label: "Await Assignment" };
    default:
      return { disabled: true, icon: "questionmark.circle" as const, label: "Action Unavailable" };
  }
}

function formatEta(durationMinutes: number | null | undefined) {
  if (!durationMinutes || durationMinutes <= 0) return "ETA unavailable";

  const eta = new Date(Date.now() + durationMinutes * 60 * 1000);

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(eta);
}

function formatDuration(durationMinutes: number | null | undefined) {
  if (!durationMinutes || durationMinutes <= 0) return "Time unavailable";

  const roundedMinutes = Math.max(1, Math.round(durationMinutes));
  if (roundedMinutes < 60) return `${roundedMinutes} min`;

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function getProgressStep(status: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "delivered" || normalized === "failed" || normalized === "returned") return 3;
  if (normalized === "in_transit" || normalized === "delayed") return 2;
  if (normalized === "assigned" || normalized === "pending") return 1;
  return 0;
}

const DeliveryCard = memo(function DeliveryCard({ colors, delivery, emphasized, onAction, onOpen, route: _route, width }: DeliveryCardProps) {
  const deliveryLabel = delivery.delivery_number ? `#${delivery.delivery_number}` : "Unnumbered delivery";
  const dropOff = delivery.delivery_address?.trim() || "Delivery address unavailable";
  const pickup = delivery.pickup_address?.trim() || "Pickup unavailable";
  const customerLabel = delivery.customer_name?.trim() || "Customer unavailable";
  const priority = delivery.priority?.trim();
  const radius = getCardRadius(width);
  const statusLabel = formatStatus(delivery.status);
  const statusTone = getStatusTone(delivery.status, colors);
  const cardPadding = getCardPadding(width);
  const progressInfo = getProgressInfo(delivery.status);

  if (!emphasized) {
    const secondaryPadding = Math.max(9, cardPadding - 10);
    const secondaryButtonHeight = 36;

    return (
      <View
        accessibilityLabel={`${deliveryLabel}, ${customerLabel}, ${statusLabel}, ${dropOff}.`}
        style={[
          styles.secondaryDeliveryCard,
          styles.secondaryDeckCard,
          {
            backgroundColor: colors.surfaceElevatedFallback,
            borderColor: colors.subtleBorder,
            borderRadius: radius,
            padding: secondaryPadding,
          },
        ]}
      >
        <View style={styles.secondaryTopRow}>
          <View style={[styles.secondaryIconCircle, { backgroundColor: alpha(colors.accent, 0.11) }]}>
            <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="truck.box" size={17} tintColor={colors.accent} type="hierarchical" />
          </View>
          <View style={styles.secondaryTitleGroup}>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.secondaryDeliveryId, { color: colors.textPrimary }]}>
              {deliveryLabel}
            </Text>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.secondaryCustomer, { color: colors.textSecondary }]}>
              {customerLabel}
            </Text>
          </View>
          <View style={styles.secondaryPillCluster}>
            {priority ? (
              <View style={[styles.secondaryMetaPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.subtleBorder }]}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.secondaryPriorityText, { color: colors.textSecondary }]}>
                  {priority}
                </Text>
              </View>
            ) : null}
            <View style={[styles.secondaryStatusPill, { backgroundColor: statusTone.backgroundColor, borderColor: statusTone.borderColor }]}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.secondaryStatusText, { color: statusTone.color }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.secondaryInfoStack}>
          <View style={styles.secondaryInfoLine}>
            <View style={[styles.secondaryLocationIconCircle, { backgroundColor: colors.surfaceMuted }]}>
              <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="mappin.circle" size={13} tintColor={colors.textTertiary} type="hierarchical" />
            </View>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.secondaryInfoText, { color: colors.textPrimary }]}>
              {pickup}
            </Text>
          </View>
          <View style={styles.secondaryInfoLine}>
            <View style={[styles.secondaryLocationIconCircle, { backgroundColor: colors.surfaceMuted }]}>
              <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="mappin.circle" size={13} tintColor={colors.textTertiary} type="hierarchical" />
            </View>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.secondaryInfoText, { color: colors.textPrimary }]}>
              {dropOff}
            </Text>
          </View>
        </View>

        <GlassActionButton
          accessibilityLabel={`View details for ${deliveryLabel}`}
          capsule
          hitSlop={4}
          iconName="doc.text"
          iconPosition="left"
          iconSize={14}
          label="View Details"
          labelStyle={styles.secondaryActionLabel}
          onPress={() => onOpen(delivery)}
          radius={radius}
          style={[styles.secondaryCardAction, { minHeight: secondaryButtonHeight }]}
          variant="secondaryNeutral"
        />
      </View>
    );
  }

  const action = getDeliveryAction(delivery.status);
  const cardSurface = emphasized
    ? {
        backgroundColor: alpha(colors.accent, 0.16),
        borderColor: alpha(colors.accent, 0.42),
      }
    : {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.subtleBorder,
      };

  return (
    <View
      accessibilityLabel={`${deliveryLabel}, ${statusLabel}, from ${pickup} to ${dropOff}.`}
      style={[
        styles.deliveryCard,
        emphasized ? dashboardShadows.elevatedCard : dashboardShadows.subtleCard,
        {
          backgroundColor: cardSurface.backgroundColor,
          borderColor: cardSurface.borderColor,
          borderRadius: radius,
          padding: cardPadding,
        },
      ]}
    >
      <View style={styles.trackingHeader}>
        <View style={styles.trackingTitleGroup}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.trackingLabel, { color: colors.textSecondary }]}>
            Tracking ID
          </Text>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.pageTitle} style={[styles.trackingId, { color: colors.textPrimary }]}>
            {deliveryLabel}
          </Text>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.featuredCustomer, { color: colors.textSecondary }]}>
            {customerLabel}
          </Text>
        </View>
        {priority ? (
          <View style={styles.featuredPillStack}>
            <View style={[styles.featuredPriorityPill, { backgroundColor: colors.surfaceMuted }]}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.featuredPriorityText, { color: colors.textSecondary }]}>
                {priority}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.dottedDivider, { borderColor: colors.divider }]} />

      <View style={styles.destinationGrid}>
        <View style={styles.destinationCell}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.endpointLabel, { color: colors.textSecondary }]}>
            From
          </Text>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.endpointPrimary, { color: colors.textPrimary }]}>
            {pickup}
          </Text>
        </View>
        <View style={[styles.destinationCell, styles.destinationCellRight]}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.endpointLabel, { color: colors.textSecondary }]}>
            To
          </Text>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.endpointPrimary, styles.endpointValueRight, { color: colors.textPrimary }]}>
            {dropOff}
          </Text>
        </View>
      </View>

      <View
        accessible
        accessibilityLabel={`Delivery progress: ${progressInfo.stateLabel}. Stages are Assigned, In Transit, Delivered.`}
        style={styles.progressSection}
      >
        <View style={styles.progressFooter}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.progressTimestamp, { color: colors.textSecondary }]}>
            Delivery progress
          </Text>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.progressState, { color: colors.textSecondary }]}>
            {progressInfo.stateLabel}
          </Text>
        </View>
        <View style={styles.progressTrackRow}>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
            <AnimatedProgressFill fillPercent={progressInfo.fillPercent} />
          </View>
        </View>
        <View style={styles.progressLabels}>
          {["Assigned", "In Transit", "Delivered"].map((label, index) => {
            const active = progressInfo.step >= index + 1;

            return (
              <Text key={label} maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.progressLabel, { color: active ? colors.textPrimary : colors.textTertiary }]}>
                {label}
              </Text>
            );
          })}
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.divider }]}>
        <GlassActionButton
          accessibilityLabel={`View details for ${deliveryLabel}`}
          capsule
          iconName="doc.text"
          iconPosition="left"
          label="View Details"
          onPress={() => onOpen(delivery)}
          radius={radius}
          style={[styles.cardAction, { minHeight: getButtonHeight(width) }]}
          variant="secondaryNeutral"
        />
        <GlassActionButton
          accessibilityLabel={`${action.label} for ${deliveryLabel}`}
          capsule
          disabled={action.disabled}
          iconName={action.icon}
          iconPosition="left"
          label={action.label}
          onPress={() => onAction(delivery)}
          radius={radius}
          style={[styles.cardAction, { minHeight: getButtonHeight(width) }]}
          variant="primaryAccent"
        />
      </View>
    </View>
  );
});

export default function DeliveriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const { driver, loading: profileLoading } = useDriverProfile();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [routesByDeliveryId, setRoutesByDeliveryId] = useState<Record<string, Route>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [workflowDelivery, setWorkflowDelivery] = useState<Delivery | null>(null);
  const requestInFlightRef = useRef(false);
  const reduceMotionEnabled = useReducedMotion();
  const pullDistance = useSharedValue(0);
  const normalizedPullProgress = useSharedValue(0);
  const arrowOpacity = useSharedValue(0);
  const readyArrowOpacity = useSharedValue(0);
  const spinnerOpacity = useSharedValue(0);
  const spinnerRotation = useSharedValue(0);
  const refreshInteractionState = useSharedValue(refreshStateIdle);
  const refreshReadyHapticTriggered = useSharedValue(false);
  const refreshHeaderHeight = useSharedValue(0);
  const refreshingShared = useSharedValue(false);
  const refreshThreshold = useMemo(() => Math.max(48, Math.min(68, dashboardSpacing.scale.xl + 34)), []);

  const sectionGap = getSectionGap(width);
  const filteredDeliveries = useMemo(() => getFilteredDeliveries(deliveries, deliveryFilter, searchQuery), [deliveries, deliveryFilter, searchQuery]);
  const orderedDeliveries = useMemo(() => getOrderedDeliveries(filteredDeliveries, routesByDeliveryId), [filteredDeliveries, routesByDeliveryId]);
  const featuredDelivery = orderedDeliveries[0] ?? null;
  const secondaryDeliveries = useMemo(() => orderedDeliveries.slice(1), [orderedDeliveries]);
  const showInitialLoading = (loading || profileLoading) && deliveries.length === 0;
  const emptyCopy = getFilteredEmptyCopy(error, deliveryFilter, searchQuery);
  const stackResetKey = `${deliveryFilter}:${searchQuery.trim().toLowerCase()}`;
  const stackContextCopy = getStackContextCopy(secondaryDeliveries.length);

  const loadDeliveries = useCallback(
    async (mode: "initial" | "refresh" | "retry" = "initial") => {
      if (requestInFlightRef.current || profileLoading) return;

      if (!driver) {
        setDeliveries([]);
        setRoutesByDeliveryId({});
        setError(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      requestInFlightRef.current = true;
      if (mode === "refresh") {
        setRefreshing(true);
      } else if (mode === "initial") {
        setLoading(true);
      }

      const response = await getDeliveriesForDriver(driver.driver_id);

      if (response.error) {
        setError(true);
      } else {
        const nextDeliveries = response.data ?? [];
        const routeResponse = await getRoutesForDeliveriesForDriver(
          nextDeliveries.map((delivery) => delivery.delivery_id),
          driver.driver_id,
        );

        setError(false);
        setDeliveries(nextDeliveries);
        setRoutesByDeliveryId(
          routeResponse.error
            ? {}
            : (routeResponse.data ?? []).reduce<Record<string, Route>>((routes, route) => {
                if (route.delivery_id && !routes[route.delivery_id]) {
                  routes[route.delivery_id] = route;
                }
                return routes;
              }, {}),
        );
      }

      requestInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    },
    [driver, profileLoading],
  );

  useEffect(() => {
    void loadDeliveries("initial");
  }, [loadDeliveries]);

  useEffect(() => {
    return () => {
      cancelAnimation(refreshHeaderHeight);
      cancelAnimation(spinnerRotation);
      cancelAnimation(pullDistance);
      cancelAnimation(normalizedPullProgress);
      cancelAnimation(arrowOpacity);
      cancelAnimation(readyArrowOpacity);
      cancelAnimation(spinnerOpacity);
      refreshInteractionState.value = refreshStateIdle;
      refreshReadyHapticTriggered.value = false;
      refreshingShared.value = false;
      refreshHeaderHeight.value = 0;
      spinnerRotation.value = 0;
      pullDistance.value = 0;
      normalizedPullProgress.value = 0;
      arrowOpacity.value = 0;
      readyArrowOpacity.value = 0;
      spinnerOpacity.value = 0;
    };
  }, [
    arrowOpacity,
    normalizedPullProgress,
    pullDistance,
    readyArrowOpacity,
    refreshHeaderHeight,
    refreshInteractionState,
    refreshReadyHapticTriggered,
    refreshingShared,
    spinnerOpacity,
    spinnerRotation,
  ]);

  const handleRefresh = useCallback(() => {
    if (refreshing || requestInFlightRef.current || profileLoading || !driver) {
      refreshingShared.value = false;
      refreshInteractionState.value = refreshStateSettling;
      refreshHeaderHeight.value = withTiming(0, { duration: reduceMotionEnabled ? 80 : 150 }, () => {
        refreshInteractionState.value = refreshStateIdle;
        refreshReadyHapticTriggered.value = false;
      });
      return;
    }

    void loadDeliveries("refresh");
  }, [driver, loadDeliveries, profileLoading, reduceMotionEnabled, refreshHeaderHeight, refreshInteractionState, refreshReadyHapticTriggered, refreshing, refreshingShared]);

  const handleRetry = useCallback(() => {
    void loadDeliveries("retry");
  }, [loadDeliveries]);

  const openDelivery = useCallback(
    (delivery: Delivery) => {
      router.push({ pathname: "/(driver)/delivery/[deliveryId]", params: { deliveryId: delivery.delivery_id } });
    },
    [router],
  );

  const openDeliveryDetailsSheet = useCallback((delivery: Delivery) => {
    setSelectedDelivery(delivery);
  }, []);

  const closeDeliveryDetailsSheet = useCallback(() => {
    setSelectedDelivery(null);
  }, []);

  const openDeliveryWorkflowSheet = useCallback((delivery: Delivery) => {
    setWorkflowDelivery(delivery);
  }, []);

  const closeDeliveryWorkflowSheet = useCallback(() => {
    setWorkflowDelivery(null);
  }, []);

  const renderFeaturedDelivery = useCallback<ListRenderItem<Delivery>>(
    ({ item }) => (
      <View style={styles.featuredCardSection}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.stackContextText, { color: colors.textSecondary }]}>
          Current Delivery
        </Text>
        <DeliveryCard
          colors={colors}
          delivery={item}
          emphasized
          onAction={openDeliveryWorkflowSheet}
          onOpen={openDeliveryDetailsSheet}
          route={routesByDeliveryId[item.delivery_id] ?? null}
          width={width}
        />
      </View>
    ),
    [colors, openDeliveryDetailsSheet, openDeliveryWorkflowSheet, routesByDeliveryId, width],
  );

  const renderSecondaryDelivery = useCallback(
    (item: Delivery) => (
      <DeliveryCard
        colors={colors}
        delivery={item}
        emphasized={false}
        onAction={openDelivery}
        onOpen={openDeliveryDetailsSheet}
        route={routesByDeliveryId[item.delivery_id] ?? null}
        width={width}
      />
    ),
    [colors, openDelivery, openDeliveryDetailsSheet, routesByDeliveryId, width],
  );

  useEffect(() => {
    refreshingShared.value = refreshing;

    if (refreshing) {
      refreshInteractionState.value = refreshStateRefreshing;
      refreshHeaderHeight.value = withSpring(refreshHeaderMaxHeight, {
        damping: reduceMotionEnabled ? 30 : 18,
        stiffness: reduceMotionEnabled ? 220 : 180,
      });
      arrowOpacity.value = withTiming(0, { duration: 120 });
      readyArrowOpacity.value = withTiming(0, { duration: 120 });
      spinnerOpacity.value = withTiming(1, { duration: 160 });
      spinnerRotation.value = withRepeat(withTiming(360, { duration: reduceMotionEnabled ? 1200 : 850, easing: Easing.linear }), -1, false);
      return;
    }

    refreshInteractionState.value = refreshStateSettling;
    refreshReadyHapticTriggered.value = false;
    cancelAnimation(spinnerRotation);
    spinnerRotation.value = 0;
    spinnerOpacity.value = withTiming(0, { duration: 140 });
    refreshHeaderHeight.value = withDelay(
      120,
      withTiming(0, { duration: reduceMotionEnabled ? 120 : 180 }, () => {
        refreshInteractionState.value = refreshStateIdle;
        refreshReadyHapticTriggered.value = false;
      }),
    );
    pullDistance.value = withDelay(120, withTiming(0, { duration: 120 }));
    normalizedPullProgress.value = withDelay(120, withTiming(0, { duration: 120 }));
    arrowOpacity.value = withTiming(0, { duration: 120 });
    readyArrowOpacity.value = withTiming(0, { duration: 120 });
  }, [
    arrowOpacity,
    normalizedPullProgress,
    pullDistance,
    readyArrowOpacity,
    reduceMotionEnabled,
    refreshHeaderHeight,
    refreshInteractionState,
    refreshReadyHapticTriggered,
    refreshing,
    refreshingShared,
    spinnerOpacity,
    spinnerRotation,
  ]);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const distance = Math.max(0, -event.contentOffset.y);
      const progress = Math.min(distance / refreshThreshold, 1);

      pullDistance.value = distance;
      normalizedPullProgress.value = progress;

      if (refreshingShared.value) {
        refreshInteractionState.value = refreshStateRefreshing;
        arrowOpacity.value = 0;
        readyArrowOpacity.value = 0;
        spinnerOpacity.value = 1;
        refreshHeaderHeight.value = refreshHeaderMaxHeight;
        return;
      }

      if (distance <= 0.5) {
        refreshInteractionState.value = refreshStateIdle;
        refreshReadyHapticTriggered.value = false;
        pullDistance.value = 0;
        normalizedPullProgress.value = 0;
        arrowOpacity.value = 0;
        readyArrowOpacity.value = 0;
        spinnerOpacity.value = 0;
        refreshHeaderHeight.value = 0;
        return;
      }

      refreshInteractionState.value = progress >= 1 ? refreshStateReady : refreshStatePulling;
      if (progress >= 1 && !refreshReadyHapticTriggered.value) {
        refreshReadyHapticTriggered.value = true;
        runOnJS(triggerRefreshReadyHaptic)();
      } else if (progress < 0.84) {
        refreshReadyHapticTriggered.value = false;
      }
      arrowOpacity.value = interpolate(progress, [0, 0.25, 0.92], [0, 0.34, 1], Extrapolation.CLAMP);
      readyArrowOpacity.value = interpolate(progress, [0.84, 1], [0, 1], Extrapolation.CLAMP);
      spinnerOpacity.value = 0;
      refreshHeaderHeight.value = interpolate(progress, [0, 1], [0, refreshHeaderMaxHeight], Extrapolation.CLAMP);
    },
    onEndDrag: () => {
      if (refreshingShared.value) return;

      if (normalizedPullProgress.value >= 1) {
        refreshInteractionState.value = refreshStateRefreshing;
        arrowOpacity.value = withTiming(0, { duration: 120 });
        readyArrowOpacity.value = withTiming(0, { duration: 120 });
        spinnerOpacity.value = withTiming(1, { duration: 160 });
        refreshHeaderHeight.value = withSpring(refreshHeaderMaxHeight, {
          damping: reduceMotionEnabled ? 30 : 18,
          stiffness: reduceMotionEnabled ? 220 : 180,
        });
        refreshingShared.value = true;
        refreshReadyHapticTriggered.value = false;
        runOnJS(triggerRefreshStartHaptic)();
        runOnJS(handleRefresh)();
        return;
      }

      refreshInteractionState.value = refreshStateSettling;
      refreshReadyHapticTriggered.value = false;
      pullDistance.value = withTiming(0, { duration: 150 });
      normalizedPullProgress.value = withTiming(0, { duration: 150 });
      arrowOpacity.value = withTiming(0, { duration: 120 });
      readyArrowOpacity.value = withTiming(0, { duration: 120 });
      spinnerOpacity.value = withTiming(0, { duration: 120 });
      refreshHeaderHeight.value = withTiming(0, { duration: reduceMotionEnabled ? 100 : 160 }, () => {
        refreshInteractionState.value = refreshStateIdle;
        refreshReadyHapticTriggered.value = false;
      });
    },
  });

  const refreshHeaderAnimatedStyle = useAnimatedStyle(() => ({
    height: refreshHeaderHeight.value,
    opacity: Math.max(arrowOpacity.value, readyArrowOpacity.value, spinnerOpacity.value),
    transform: [{ translateY: interpolate(refreshHeaderHeight.value, [0, refreshHeaderMaxHeight], [-4, 0], Extrapolation.CLAMP) }],
  }));

  const refreshArrowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value * (1 - readyArrowOpacity.value) * (1 - spinnerOpacity.value),
    transform: [{ scale: interpolate(normalizedPullProgress.value, [0, 1], [0.76, 1.08], Extrapolation.CLAMP) }],
  }));

  const refreshReleaseArrowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: readyArrowOpacity.value * (1 - spinnerOpacity.value),
    transform: [{ scale: interpolate(normalizedPullProgress.value, [0.84, 1], [0.84, 1.14], Extrapolation.CLAMP) }],
  }));

  const spinnerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: spinnerOpacity.value,
    transform: [
      { rotate: `${spinnerRotation.value}deg` },
      { scale: interpolate(spinnerOpacity.value, [0, 1], [0.82, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.dashboardBackground }]}>
      <AnimatedFlatList
        ListEmptyComponent={
          showInitialLoading ? (
            <LoadingSkeleton colors={colors} width={width} />
          ) : (
            <EmptyDeliveriesState colors={colors} copy={emptyCopy} error={error} onRetry={handleRetry} width={width} />
          )
        }
        contentContainerStyle={{
          gap: sectionGap,
          paddingBottom: getScrollContentBottomPadding(width, insets.bottom) + 36,
          paddingHorizontal: getScreenHorizontalPadding(width),
          paddingTop: getSafeAreaTopSpacing(insets.top) + sectionGap,
        }}
        data={showInitialLoading || !featuredDelivery ? [] : [featuredDelivery]}
        keyExtractor={(delivery) => delivery.delivery_id}
        ListHeaderComponent={
          <View style={styles.pageHeaderStack}>
            <DeliveriesHeading colors={colors} width={width} />
            <DeliverySearchFilters
              colors={colors}
              filter={deliveryFilter}
              onFilterChange={setDeliveryFilter}
              onSearchChange={setSearchQuery}
              query={searchQuery}
              width={width}
            />
          </View>
        }
        ListFooterComponent={
          showInitialLoading || secondaryDeliveries.length === 0 ? null : (
            <View style={styles.secondaryStackSection}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.stackContextText, { color: colors.textSecondary }]}>
                {stackContextCopy}
              </Text>
              <DeliveryCardStack
                accessibilityLabel="Secondary deliveries"
                getKey={(delivery) => delivery.delivery_id}
                items={secondaryDeliveries}
                renderCard={renderSecondaryDelivery}
                resetKey={stackResetKey}
                textColor={colors.textSecondary}
              />
            </View>
          )
        }
        onScroll={handleScroll}
        renderItem={renderFeaturedDelivery}
        scrollEventThrottle={16}
        style={[styles.list, { backgroundColor: colors.dashboardBackground }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.refreshHeader,
          {
            top: getSafeAreaTopSpacing(insets.top) + 8,
          },
          refreshHeaderAnimatedStyle,
        ]}
      >
        <View pointerEvents="none" style={styles.refreshIconStack}>
          <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.refreshIconLayer, refreshArrowAnimatedStyle]}>
            <SymbolView fallback={null} name="arrow.down" size={refreshIndicatorSize} tintColor={colors.accent} type="hierarchical" />
          </Animated.View>
          <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.refreshIconLayer, refreshReleaseArrowAnimatedStyle]}>
            <SymbolView fallback={null} name="arrow.up" size={refreshIndicatorSize} tintColor={colors.accent} type="hierarchical" />
          </Animated.View>
          <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.refreshIconLayer, spinnerAnimatedStyle]}>
            <SymbolView fallback={null} name="arrow.clockwise" size={refreshIndicatorSize - 4} tintColor={colors.refreshTint} type="hierarchical" />
          </Animated.View>
        </View>
      </Animated.View>
      <DeliveryDetailsSheet
        coordinatesLoading={loading || profileLoading}
        delivery={selectedDelivery}
        onClose={closeDeliveryDetailsSheet}
        route={selectedDelivery ? (routesByDeliveryId[selectedDelivery.delivery_id] ?? null) : null}
        visible={Boolean(selectedDelivery)}
      />
      <DeliveryWorkflowSheet
        delivery={workflowDelivery}
        onClose={closeDeliveryWorkflowSheet}
        route={workflowDelivery ? (routesByDeliveryId[workflowDelivery.delivery_id] ?? null) : null}
        visible={Boolean(workflowDelivery)}
      />
      <DashboardScrollEdge topInset={insets.top} />
    </View>
  );
}

function DeliveriesHeading({ colors, width }: { colors: ReturnType<typeof getDashboardColors>; width: number }) {
  const colorScheme = useColorScheme();
  const todayPillGlass = colorScheme === "dark" ? dashboardLiquidGlass.passivePurpleGlass.dark : dashboardLiquidGlass.passivePurpleGlass.light;

  return (
    <SafeAreaView edges={[]} style={{ backgroundColor: colors.dashboardBackground }}>
      <View accessibilityRole="header" style={styles.heading}>
        <View style={styles.headingCopy}>
          <View style={[styles.todayPill, { backgroundColor: todayPillGlass.backgroundColor, borderColor: todayPillGlass.borderColor }]}>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.todayPillText, { color: colors.accent }]}>
              Today
            </Text>
          </View>
          <Text
            maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.pageTitle}
            style={[
              styles.headingTitle,
              {
                color: colors.textPrimary,
                fontSize: dashboardTypography.largePageTitle.fontSize,
                fontWeight: dashboardTypography.largePageTitle.fontWeight,
                lineHeight: dashboardTypography.largePageTitle.lineHeight,
              },
            ]}
          >
            Deliveries
          </Text>
        </View>
        <View style={styles.profileButtonSlot}>
          <ProfileButton dashboardIcon />
        </View>
      </View>
    </SafeAreaView>
  );
}

function DeliverySearchFilters({
  colors,
  filter,
  onFilterChange,
  onSearchChange,
  query,
  width,
}: {
  colors: ReturnType<typeof getDashboardColors>;
  filter: DeliveryFilter;
  onFilterChange: (filter: DeliveryFilter) => void;
  onSearchChange: (query: string) => void;
  query: string;
  width: number;
}) {
  const colorScheme = useColorScheme();
  const filterGlass = {
    backgroundColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(118, 118, 128, 0.12)",
    borderColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(118, 118, 128, 0.2)",
  };
  const searchGlass = {
    backgroundColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(118, 118, 128, 0.12)",
    borderColor: colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(118, 118, 128, 0.16)",
  };

  return (
      <View style={styles.filterSurface}>
      <View style={[styles.searchField, { backgroundColor: searchGlass.backgroundColor, borderColor: searchGlass.borderColor, width: Math.max(0, width - 32) }]}>
        <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="magnifyingglass" size={20} tintColor={colors.textTertiary} type="hierarchical" />
        <TextInput
          accessibilityLabel="Search deliveries by ID, customer, pickup address, or delivery address"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary}
          onChangeText={onSearchChange}
          placeholder="Search deliveries"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.textPrimary }]}
          value={query}
        />
      </View>
      <ScrollView
        accessibilityLabel="Delivery filters"
        accessibilityRole="tablist"
        contentContainerStyle={styles.filterRow}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {deliveryFilters.map((item) => {
          const selected = item.value === filter;

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.value}
              onPress={() => {
                triggerButtonHaptic();
                onFilterChange(item.value);
              }}
              style={({ pressed }) => [
                styles.filterPill,
                {
                  backgroundColor: selected ? alpha(colors.accent, colorScheme === "dark" ? 0.26 : 0.18) : filterGlass.backgroundColor,
                  borderColor: selected ? alpha(colors.accent, colorScheme === "dark" ? 0.42 : 0.32) : filterGlass.borderColor,
                  opacity: pressed ? 0.82 : 1,
                  paddingHorizontal: selected ? 11 : 12,
                },
              ]}
            >
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.filterPillText, { color: selected ? colors.accent : colors.textSecondary }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function EmptyDeliveriesState({
  colors,
  copy,
  error,
  onRetry,
  width,
}: {
  colors: ReturnType<typeof getDashboardColors>;
  copy: { message: string; title: string };
  error: boolean;
  onRetry: () => void;
  width: number;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${copy.title}. ${copy.message}`}
      style={[styles.emptyState, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: getCardRadius(width), padding: getCardPadding(width) }]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
        <SymbolView fallback={null} name={error ? "exclamationmark.triangle" : "shippingbox"} size={24} tintColor={colors.accent} type="hierarchical" />
      </View>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {copy.title}
      </Text>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.emptyMessage, { color: colors.textSecondary }]}>
        {copy.message}
      </Text>
      {error ? (
        <Pressable accessibilityRole="button" onPress={onRetry} onPressIn={triggerButtonHaptic} style={({ pressed }) => [styles.retryButton, { backgroundColor: colors.accent, opacity: pressed ? 0.84 : 1 }]}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={styles.retryText}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LoadingSkeleton({ colors, width }: { colors: ReturnType<typeof getDashboardColors>; width: number }) {
  return (
    <View accessibilityLabel="Loading deliveries" accessibilityRole="progressbar" style={styles.loadingStack}>
      {[0, 1, 2].map((item) => (
        <View
          key={item}
          style={[styles.skeletonCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: getCardRadius(width), padding: getCardPadding(width) }]}
        >
          <View style={[styles.skeletonLineShort, { backgroundColor: colors.surfaceMuted }]} />
          <View style={[styles.skeletonLine, { backgroundColor: colors.surfaceMuted }]} />
          <View style={[styles.skeletonLineMedium, { backgroundColor: colors.surfaceMuted }]} />
        </View>
      ))}
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  cardAction: {
    flex: 1,
    paddingHorizontal: 12,
  },
  cardFooter: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingTop: 10,
  },
  cardTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  container: {
    flex: 1,
  },
  customer: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  deliveryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: 13,
    shadowColor: "#6d4aff",
    shadowOffset: { height: 9, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
  },
  deliveryIconCircle: {
    alignItems: "center",
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  deliveryIdentityRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  deliveryTitle: {
    fontSize: dashboardTypography.compactPageTitle.fontSize,
    fontWeight: "800",
    lineHeight: dashboardTypography.compactPageTitle.lineHeight,
  },
  deliveryTitleGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  emptyIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  emptyMessage: {
    fontSize: dashboardTypography.secondary.fontSize,
    lineHeight: dashboardTypography.secondary.lineHeight,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  emptyTitle: {
    fontSize: dashboardTypography.compactPageTitle.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.compactPageTitle.lineHeight,
    textAlign: "center",
  },
  endpointLabel: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  endpointPrimary: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "800",
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  endpointValue: {
    fontSize: dashboardTypography.tertiary.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.tertiary.lineHeight,
  },
  endpointValueRight: {
    textAlign: "right",
  },
  featuredCustomer: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "500",
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  featuredPillStack: {
    alignItems: "flex-end",
    gap: dashboardSpacing.scale.xs,
  },
  featuredCardSection: {
    gap: dashboardSpacing.scale.sm,
  },
  featuredPriorityPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: dashboardSpacing.scale.md,
    paddingVertical: dashboardSpacing.scale.sm,
  },
  featuredPriorityText: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: dashboardTypography.secondary.fontWeight,
    lineHeight: dashboardTypography.secondary.lineHeight,
    textTransform: "capitalize",
  },
  featuredRoutePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  featuredRouteText: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  filterPill: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    height: 28,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: dashboardSpacing.scale.xs,
  },
  filterSurface: {
    gap: dashboardSpacing.scale.md,
  },
  heading: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    columnGap: dashboardSpacing.scale.lg,
    paddingTop: dashboardSpacing.scale.xl,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
    rowGap: dashboardSpacing.scale.xs,
  },
  headingTitle: {
    letterSpacing: 0,
  },
  list: {
    flex: 1,
  },
  loadingStack: {
    gap: 14,
  },
  destinationCell: {
    flex: 1,
    gap: dashboardSpacing.scale.xs,
    minWidth: 0,
  },
  destinationCellRight: {
    alignItems: "flex-end",
  },
  destinationGrid: {
    flexDirection: "row",
    gap: dashboardSpacing.scale.lg,
  },
  dottedDivider: {
    borderStyle: "dotted",
    borderTopWidth: 2,
  },
  locationEndpoint: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  locationEndpointRight: {
    alignItems: "flex-end",
  },
  pillStack: {
    alignItems: "flex-end",
    gap: 6,
  },
  pageHeaderStack: {
    gap: dashboardSpacing.scale.md,
  },
  priorityPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  priorityText: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
    textTransform: "capitalize",
  },
  metaGrid: {
    flexDirection: "row",
    gap: dashboardSpacing.scale.lg,
  },
  metaValue: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "800",
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  progressDash: {
    borderStyle: "dotted",
    borderTopWidth: 2,
    flex: 1,
  },
  progressFill: {
    backgroundColor: "#6d4aff",
    borderRadius: 999,
    bottom: 0,
    elevation: 2,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    shadowColor: "#6d4aff",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.62,
    shadowRadius: 10,
    top: 0,
  },
  progressFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    justifyContent: "space-between",
  },
  progressLabel: {
    flex: 1,
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "500",
    lineHeight: dashboardTypography.caption.lineHeight,
    textAlign: "center",
  },
  progressLabels: {
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
  },
  progressSection: {
    gap: dashboardSpacing.scale.md,
  },
  progressState: {
    fontSize: dashboardTypography.compactPageTitle.fontSize,
    fontWeight: "800",
    lineHeight: dashboardTypography.compactPageTitle.lineHeight,
    textAlign: "right",
  },
  progressTimestamp: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "500",
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  progressTrack: {
    borderRadius: 999,
    flex: 2,
    height: 10,
    overflow: "hidden",
  },
  progressGlow: {
    backgroundColor: "rgba(255, 255, 255, 0.62)",
    borderRadius: 999,
    bottom: 0,
    position: "absolute",
    top: 0,
    width: 42,
  },
  progressTrackRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
  },
  profileButtonSlot: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  refreshHeader: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    position: "absolute",
    width: "100%",
    zIndex: 3,
  },
  refreshIconLayer: {
    alignItems: "center",
    height: refreshIndicatorSize,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 0,
    width: refreshIndicatorSize,
  },
  refreshIconStack: {
    alignItems: "center",
    height: refreshIndicatorSize,
    justifyContent: "center",
    width: refreshIndicatorSize,
  },
  retryButton: {
    alignItems: "center",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  routeConnector: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: "center",
    width: 44,
  },
  routeSummaryRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  searchField: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    height: 40,
    paddingHorizontal: 14,
    width: "100%",
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 22,
    paddingVertical: 0,
  },
  secondaryActionLabel: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  secondaryCardAction: {
    paddingHorizontal: 10,
    width: "100%",
  },
  secondaryCustomer: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  secondaryDeckCard: {
    elevation: 1,
    shadowColor: "#6d4aff",
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
  },
  secondaryDeliveryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: dashboardSpacing.scale.sm,
  },
  secondaryDeliveryId: {
    fontSize: dashboardTypography.compactPageTitle.fontSize,
    fontWeight: "800",
    lineHeight: dashboardTypography.compactPageTitle.lineHeight,
  },
  secondaryIconCircle: {
    alignItems: "center",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  secondaryInfoLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.xs,
  },
  secondaryInfoStack: {
    gap: dashboardSpacing.scale.xs,
  },
  secondaryInfoText: {
    flex: 1,
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "500",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  secondaryLocationIconCircle: {
    alignItems: "center",
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  secondaryMetaPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  secondaryMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: dashboardSpacing.scale.xs,
  },
  secondaryMetaText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
  },
  secondaryPillCluster: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: dashboardSpacing.scale.xs,
    justifyContent: "flex-end",
  },
  secondaryPriorityText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
    textTransform: "capitalize",
  },
  secondaryStatusPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  secondaryStatusText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
  },
  secondaryTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  secondaryTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
  },
  secondaryStackSection: {
    gap: dashboardSpacing.scale.sm * 1.1,
    position: "relative",
  },
  skeletonCard: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  skeletonLine: {
    borderRadius: 999,
    height: 18,
    width: "88%",
  },
  skeletonLineMedium: {
    borderRadius: 999,
    height: 14,
    width: "64%",
  },
  skeletonLineShort: {
    borderRadius: 999,
    height: 14,
    width: "34%",
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  stackContextText: {
    elevation: 3,
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
    paddingHorizontal: dashboardSpacing.scale.xs,
    zIndex: 3,
  },
  todayPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: dashboardSpacing.scale.md,
    paddingVertical: dashboardSpacing.scale.xs,
  },
  todayPillText: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  trackingHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    justifyContent: "space-between",
  },
  trackingId: {
    fontSize: dashboardTypography.largePageTitle.fontSize,
    fontWeight: "800",
    lineHeight: dashboardTypography.largePageTitle.lineHeight,
  },
  trackingLabel: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  trackingTitleGroup: {
    flex: 1,
    gap: dashboardSpacing.scale.xs,
    minWidth: 0,
  },
});
