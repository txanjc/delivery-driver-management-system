import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useColorScheme, useWindowDimensions, View } from "react-native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActiveDeliveryCard } from "@/components/dashboard/ActiveDeliveryCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardScrollEdge } from "@/components/dashboard/DashboardScrollEdge";
import { DeliverySummaryCard } from "@/components/dashboard/DeliverySummaryCard";
import type { DeliverySummaryCounts } from "@/components/dashboard/DeliverySummaryCard";
import { RecentAlertsSection } from "@/components/dashboard/RecentAlertsSection";
import { ScheduleOverviewCard } from "@/components/dashboard/ScheduleOverviewCard";
import type { DashboardAlert } from "@/components/dashboard/AlertRow";
import type { ScheduleContext, ScheduleOverviewDetails, ScheduleStatus } from "@/components/dashboard/ScheduleOverviewCard";
import {
  getContentMaxWidth,
  getContentTopSpacing,
  getDashboardColors,
  getSafeAreaTopSpacing,
  getScreenHorizontalPadding,
  getSectionGap,
  getScrollContentBottomPadding,
} from "@/components/dashboard/dashboardDesignSpec";
import { useAuth } from "@/hooks/useAuth";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { getDeliveriesForDriver } from "@/services/delivery.service";
import { getRecentNotificationsForUser } from "@/services/notification.service";
import { getRouteForDeliveryForDriver } from "@/services/route.service";
import { getDashboardSchedulesForDriver, getVehicle } from "@/services/schedule.service";
import type { Delivery } from "@/types/delivery";
import type { DriverNotification } from "@/types/notification";
import type { Route } from "@/types/route";
import type { Schedule, VehicleSummary } from "@/types/schedule";
import { triggerRefreshReadyHaptic, triggerRefreshStartHaptic } from "@/utils/haptics";

type DashboardState = {
  activeRoute: Route | null;
  deliveries: Delivery[];
  deliveryUnavailable: boolean;
  notifications: DriverNotification[];
  notificationUnavailable: boolean;
  routeUnavailable: boolean;
  schedule: Schedule | null;
  scheduleUnavailable: boolean;
  vehicle: VehicleSummary | null;
  vehicleUnavailable: boolean;
};

const refreshHeaderMaxHeight = 52;
const refreshIndicatorSize = 36;
const refreshStateIdle = 0;
const refreshStatePulling = 1;
const refreshStateReady = 2;
const refreshStateRefreshing = 3;
const refreshStateSettling = 4;

type CanonicalDeliveryStatus = "pending" | "assigned" | "in_transit" | "delivered" | "delayed" | "failed" | "returned";
type ActiveDeliveryStatus = "in_transit" | "delayed" | "assigned";
type CanonicalScheduleStatus = "scheduled" | "completed" | "cancelled" | "conflict";

const activeDeliveryStatusPriority: Record<ActiveDeliveryStatus, number> = {
  in_transit: 0,
  delayed: 1,
  assigned: 2,
};

function getCanonicalStatus(status: string | null): CanonicalDeliveryStatus | null {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";

  if (
    normalized === "pending" ||
    normalized === "assigned" ||
    normalized === "in_transit" ||
    normalized === "delivered" ||
    normalized === "delayed" ||
    normalized === "failed" ||
    normalized === "returned"
  ) {
    return normalized;
  }

  return null;
}

function hasStatus(delivery: Delivery, status: CanonicalDeliveryStatus) {
  return getCanonicalStatus(delivery.status) === status;
}

function getActiveDeliveryPriority(delivery: Delivery) {
  const status = getCanonicalStatus(delivery.status);

  if (status === "in_transit" || status === "delayed" || status === "assigned") {
    return activeDeliveryStatusPriority[status];
  }

  return null;
}

function getCreatedAtTime(delivery: Delivery) {
  if (!delivery.created_at) return Number.POSITIVE_INFINITY;

  const time = new Date(delivery.created_at).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

// Active Delivery comparison follows approved priority, then oldest created_at,
// then delivery_id. Route sequence is not available in current Dashboard data.
function compareActiveDeliveries(left: Delivery, right: Delivery) {
  const leftPriority = getActiveDeliveryPriority(left);
  const rightPriority = getActiveDeliveryPriority(right);

  if (leftPriority === null && rightPriority === null) return 0;
  if (leftPriority === null) return 1;
  if (rightPriority === null) return -1;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  const createdAtDifference = getCreatedAtTime(left) - getCreatedAtTime(right);
  if (createdAtDifference !== 0) return createdAtDifference;

  return left.delivery_id.localeCompare(right.delivery_id);
}

function getActiveDelivery(deliveries: Delivery[]) {
  return deliveries
    .filter((delivery) => getActiveDeliveryPriority(delivery) !== null)
    .sort(compareActiveDeliveries)[0] ?? null;
}

function getLocalDateParts(value: Date) {
  return {
    day: value.getDate(),
    month: value.getMonth(),
    year: value.getFullYear(),
  };
}

function parseLocalDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function parseScheduleDate(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseLocalDateOnly(value);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameLocalDay(left: Date, right: Date) {
  const leftParts = getLocalDateParts(left);
  const rightParts = getLocalDateParts(right);
  return leftParts.year === rightParts.year && leftParts.month === rightParts.month && leftParts.day === rightParts.day;
}

function isScheduleToday(schedule: Schedule, today = new Date()) {
  const shiftDate = parseScheduleDate(schedule.shift_date);
  if (shiftDate && isSameLocalDay(shiftDate, today)) return true;

  const startDate = parseScheduleDate(schedule.start_time);
  return startDate ? isSameLocalDay(startDate, today) : false;
}

function getScheduleStatus(status: string | null): CanonicalScheduleStatus {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (normalized === "completed" || normalized === "cancelled" || normalized === "conflict") return normalized;
  return "scheduled";
}

function getScheduleStartTime(schedule: Schedule) {
  const start = parseScheduleDate(schedule.start_time);
  return start ? start.getTime() : Number.POSITIVE_INFINITY;
}

function compareSchedulesByStartTime(left: Schedule, right: Schedule) {
  const timeDifference = getScheduleStartTime(left) - getScheduleStartTime(right);
  if (timeDifference !== 0) return timeDifference;
  return left.schedule_id.localeCompare(right.schedule_id);
}

function isActiveScheduledShift(schedule: Schedule, now: Date) {
  if (getScheduleStatus(schedule.status) !== "scheduled") return false;

  const start = parseScheduleDate(schedule.start_time);
  const end = parseScheduleDate(schedule.end_time);
  if (!start || !end) return false;

  return start <= now && now < end;
}

function getRelevantSchedule(schedules: Schedule[]) {
  const now = new Date();
  const sortedSchedules = [...schedules].sort(compareSchedulesByStartTime);
  const todaySchedules = sortedSchedules.filter((schedule) => isScheduleToday(schedule, now));

  const active = sortedSchedules.find((schedule) => isActiveScheduledShift(schedule, now));
  if (active) return active;

  const todayUpcoming = todaySchedules.find((schedule) => getScheduleStatus(schedule.status) === "scheduled" && getScheduleStartTime(schedule) > now.getTime());
  if (todayUpcoming) return todayUpcoming;

  const relevantSchedules = sortedSchedules.filter((schedule) => isScheduleToday(schedule, now) || getScheduleStartTime(schedule) > now.getTime());
  const nearestRelevant = relevantSchedules[0] ?? null;
  if (nearestRelevant && getScheduleStatus(nearestRelevant.status) === "conflict") return nearestRelevant;

  const futureScheduled = sortedSchedules.find((schedule) => getScheduleStatus(schedule.status) === "scheduled" && getScheduleStartTime(schedule) > now.getTime());
  if (futureScheduled) return futureScheduled;

  const todayCompleted = [...todaySchedules].reverse().find((schedule) => getScheduleStatus(schedule.status) === "completed");
  if (todayCompleted) return todayCompleted;

  const todayCancelled = todaySchedules.find((schedule) => getScheduleStatus(schedule.status) === "cancelled");
  if (todayCancelled) return todayCancelled;

  return null;
}

function formatTime(value: string) {
  const date = parseScheduleDate(value);
  return date ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date) : "Time unavailable";
}

function formatScheduleRange(schedule: Schedule | null) {
  if (!schedule?.start_time || !schedule.end_time) {
    return "Shift time unavailable";
  }

  return `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`;
}

function formatDateLabel(schedule: Schedule) {
  const date = parseScheduleDate(schedule.shift_date) ?? parseScheduleDate(schedule.start_time);
  if (!date) return null;
  if (isSameLocalDay(date, new Date())) return "Today";

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", weekday: "short" }).format(date);
}

function parseNotificationDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatNotificationTimestamp(value: string | null) {
  const date = parseNotificationDate(value);
  if (!date) return "Time unavailable";

  const now = new Date();
  if (isSameLocalDay(date, now)) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }

  const ageMs = now.getTime() - date.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  if (ageMs >= 0 && ageMs < sevenDaysMs) {
    return new Intl.DateTimeFormat(undefined, { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
}

function getDashboardAlerts(notifications: DriverNotification[]): DashboardAlert[] {
  return notifications.slice(0, 3).map((notification) => ({
    iconName: "bell",
    id: notification.notification_id,
    isUnread: notification.is_read !== true,
    message: notification.message?.trim() || null,
    onPress: null,
    timestampLabel: formatNotificationTimestamp(notification.created_at),
    title: notification.title?.trim() || "Driver alert",
  }));
}

function formatShiftType(value: string | null) {
  if (!value) return null;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function getScheduleContext(schedule: Schedule): ScheduleContext {
  const status = getScheduleStatus(schedule.status);
  if (status === "conflict") return "conflict";
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";

  const now = new Date();
  if (isActiveScheduledShift(schedule, now)) return "active";
  if (getScheduleStartTime(schedule) > now.getTime()) return "upcoming";
  if (isScheduleToday(schedule, now)) return "today";
  return "upcoming";
}

function getScheduleTitle(schedule: Schedule) {
  return schedule.shift_name?.trim() || formatShiftType(schedule.shift_type) || "Scheduled Shift";
}

function getVehiclePrimary(vehicle: VehicleSummary | null, schedule: Schedule | null) {
  if (!schedule?.vehicle_id) return "No vehicle assigned";
  if (!vehicle) return "Vehicle unavailable";
  return vehicle.vehicle_number ? `Vehicle ${vehicle.vehicle_number}` : vehicle.license_plate || "Assigned vehicle";
}

function getVehicleSecondary(vehicle: VehicleSummary | null) {
  if (!vehicle) return null;
  return [vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.license_plate || null;
}

function getScheduleOverviewDetails(schedule: Schedule | null, vehicle: VehicleSummary | null): ScheduleOverviewDetails | null {
  if (!schedule) return null;

  return {
    context: getScheduleContext(schedule),
    dateLabel: formatDateLabel(schedule),
    endTimeLabel: schedule.end_time ? formatTime(schedule.end_time) : null,
    notes: schedule.notes && schedule.notes.length <= 80 ? schedule.notes : null,
    shiftTitle: getScheduleTitle(schedule),
    startTimeLabel: schedule.start_time ? formatTime(schedule.start_time) : null,
    status: getScheduleStatus(schedule.status) satisfies ScheduleStatus,
    vehiclePrimary: getVehiclePrimary(vehicle, schedule),
    vehicleSecondary: getVehicleSecondary(vehicle),
  };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatRoleLabel(role: string | null | undefined) {
  if (!role) return "Driver";

  return role
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reduceMotionEnabled = useReducedMotion();
  const colors = getDashboardColors(colorScheme);
  const { user } = useAuth();
  const { driver, loading: profileLoading, profile } = useDriverProfile();
  const { refreshUnreadCount } = useUnreadNotificationCount();
  const mountedRef = useRef(true);
  const didLoadRef = useRef(false);
  const requestInFlightRef = useRef(false);
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
  const refreshThreshold = useMemo(() => Math.max(48, Math.min(68, getContentTopSpacing(width) + 34)), [width]);
  const [state, setState] = useState<DashboardState>({
    activeRoute: null,
    deliveries: [],
    deliveryUnavailable: false,
    notifications: [],
    notificationUnavailable: false,
    routeUnavailable: false,
    schedule: null,
    scheduleUnavailable: false,
    vehicle: null,
    vehicleUnavailable: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
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

  const loadDashboard = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      if (profileLoading || requestInFlightRef.current) return;

      if (!driver) {
        setLoading(false);
        setRefreshing(false);
        setUnavailable(true);
        return;
      }

      requestInFlightRef.current = true;
      const shouldShowInitialLoading = !background || !didLoadRef.current;

      if (shouldShowInitialLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setUnavailable(false);

      try {
        const [scheduleResponse, deliveryResponse, notificationResponse] = await Promise.all([
          getDashboardSchedulesForDriver(driver.driver_id),
          getDeliveriesForDriver(driver.driver_id),
          user ? getRecentNotificationsForUser(user.id) : Promise.resolve({ data: [], error: null }),
        ]);

        if (!mountedRef.current) return;

        const schedules = scheduleResponse.data ?? [];
        const deliveries = deliveryResponse.data ?? [];
        const schedule = getRelevantSchedule(schedules);
        const activeDelivery = getActiveDelivery(deliveries);

        const [routeResponse, vehicleResponse] = await Promise.all([
          activeDelivery ? getRouteForDeliveryForDriver(activeDelivery.delivery_id, driver.driver_id) : Promise.resolve({ data: null, error: null }),
          schedule?.vehicle_id ? getVehicle(schedule.vehicle_id) : Promise.resolve({ data: null, error: null }),
        ]);

        if (!mountedRef.current) return;

        setState((currentState) => ({
          activeRoute: deliveryResponse.error
            ? currentState.activeRoute
            : routeResponse.error && currentState.activeRoute?.delivery_id === activeDelivery?.delivery_id
              ? currentState.activeRoute
              : (routeResponse.data ?? null),
          deliveries: deliveryResponse.error ? currentState.deliveries : deliveries,
          deliveryUnavailable: Boolean(deliveryResponse.error),
          notifications: notificationResponse.error ? currentState.notifications : (notificationResponse.data ?? []),
          notificationUnavailable: Boolean(notificationResponse.error),
          routeUnavailable: Boolean(routeResponse.error),
          schedule: scheduleResponse.error ? currentState.schedule : schedule,
          scheduleUnavailable: Boolean(scheduleResponse.error),
          vehicle: vehicleResponse.error && currentState.vehicle?.vehicle_id === schedule?.vehicle_id ? currentState.vehicle : (vehicleResponse.data ?? null),
          vehicleUnavailable: Boolean(schedule?.vehicle_id && vehicleResponse.error),
        }));
        setUnavailable(Boolean(scheduleResponse.error || deliveryResponse.error));
        void refreshUnreadCount();
        didLoadRef.current = true;
      } finally {
        requestInFlightRef.current = false;

        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [driver, profileLoading, refreshUnreadCount, user],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const driverName = useMemo(() => {
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
    return fullName || profile?.email || "Driver";
  }, [profile]);

  const roleLabel = useMemo(() => formatRoleLabel(profile?.role), [profile?.role]);

  const counts = useMemo(() => {
    const assigned = state.deliveries.filter((delivery) => hasStatus(delivery, "assigned")).length;
    const inProgress = state.deliveries.filter((delivery) => hasStatus(delivery, "in_transit") || hasStatus(delivery, "delayed")).length;
    const completed = state.deliveries.filter((delivery) => hasStatus(delivery, "delivered")).length;

    return {
      assigned,
      completed,
      inProgress,
    };
  }, [state.deliveries]);

  const summaryCounts = useMemo<DeliverySummaryCounts>(() => {
    if (loading || profileLoading || state.deliveryUnavailable) {
      return {
        assigned: null,
        completed: null,
        inProgress: null,
      };
    }

    return counts;
  }, [counts, loading, profileLoading, state.deliveryUnavailable]);

  const activeDelivery = useMemo(
    () => getActiveDelivery(state.deliveries),
    [state.deliveries],
  );

  const scheduleDetails = useMemo(
    () => getScheduleOverviewDetails(state.schedule, state.vehicle),
    [state.schedule, state.vehicle],
  );

  const dashboardAlerts = useMemo(
    () => getDashboardAlerts(state.notifications),
    [state.notifications],
  );

  const viewDetails = useMemo(() => {
    if (!activeDelivery) return null;

    return () => {
      router.push({ pathname: "/(driver)/delivery/[deliveryId]", params: { deliveryId: activeDelivery.delivery_id } });
    };
  }, [activeDelivery, router]);

  const openRoute = useMemo(() => {
    const route = state.activeRoute;
    if (!route) return null;

    return () => {
      router.push({ pathname: "/(driver)/route/[routeId]", params: { routeId: route.route_id } });
    };
  }, [router, state.activeRoute]);

  const openSchedule = useCallback(() => {
    router.push("/(driver)/(tabs)/schedule");
  }, [router]);

  const openAlerts = useCallback(() => {
    router.push("/(driver)/(tabs)/alerts");
  }, [router]);

  const resetRefreshVisuals = useCallback(() => {
    refreshingShared.value = false;
    refreshInteractionState.value = refreshStateSettling;
    refreshReadyHapticTriggered.value = false;
    cancelAnimation(spinnerRotation);
    spinnerRotation.value = 0;
    pullDistance.value = withTiming(0, { duration: 120 });
    normalizedPullProgress.value = withTiming(0, { duration: 120 });
    arrowOpacity.value = withTiming(0, { duration: 100 });
    readyArrowOpacity.value = withTiming(0, { duration: 100 });
    spinnerOpacity.value = withTiming(0, { duration: 120 });
    refreshHeaderHeight.value = withTiming(0, { duration: reduceMotionEnabled ? 80 : 150 }, () => {
      refreshInteractionState.value = refreshStateIdle;
      refreshReadyHapticTriggered.value = false;
    });
  }, [
    arrowOpacity,
    normalizedPullProgress,
    pullDistance,
    readyArrowOpacity,
    reduceMotionEnabled,
    refreshHeaderHeight,
    refreshInteractionState,
    refreshReadyHapticTriggered,
    refreshingShared,
    spinnerOpacity,
    spinnerRotation,
  ]);

  const refreshDashboard = useCallback(() => {
    if (refreshing || requestInFlightRef.current || profileLoading || !driver) {
      resetRefreshVisuals();
      return;
    }

    void loadDashboard({ background: true });
  }, [driver, loadDashboard, profileLoading, refreshing, resetRefreshVisuals]);

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
      spinnerRotation.value = withRepeat(
        withTiming(360, { duration: reduceMotionEnabled ? 1200 : 850, easing: Easing.linear }),
        -1,
        false,
      );
      return;
    }

    refreshInteractionState.value = refreshStateSettling;
    refreshReadyHapticTriggered.value = false;
    cancelAnimation(spinnerRotation);
    spinnerRotation.value = 0;
    spinnerOpacity.value = withTiming(0, { duration: 140 });
    refreshHeaderHeight.value = withDelay(120, withTiming(0, { duration: reduceMotionEnabled ? 120 : 180 }, () => {
      refreshInteractionState.value = refreshStateIdle;
      refreshReadyHapticTriggered.value = false;
    }));
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
        runOnJS(refreshDashboard)();
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
    transform: [
      { scale: interpolate(normalizedPullProgress.value, [0, 1], [0.76, 1.08], Extrapolation.CLAMP) },
    ],
  }));

  const refreshReleaseArrowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: readyArrowOpacity.value * (1 - spinnerOpacity.value),
    transform: [
      { scale: interpolate(normalizedPullProgress.value, [0.84, 1], [0.84, 1.14], Extrapolation.CLAMP) },
    ],
  }));

  const spinnerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: spinnerOpacity.value,
    transform: [
      { rotate: `${spinnerRotation.value}deg` },
      { scale: interpolate(spinnerOpacity.value, [0, 1], [0.82, 1], Extrapolation.CLAMP) },
    ],
  }));

  const preservedDashboardState = {
    activeDelivery,
    activeRoute: state.activeRoute,
    counts,
    driverName,
    formatScheduleRange,
    getGreeting,
    loading,
    refreshing,
    dashboardAlerts,
    notificationUnavailable: state.notificationUnavailable,
    notifications: state.notifications,
    routeUnavailable: state.routeUnavailable,
    schedule: state.schedule,
    scheduleDetails,
    scheduleUnavailable: state.scheduleUnavailable,
    unavailable,
    vehicle: state.vehicle,
    vehicleUnavailable: state.vehicleUnavailable,
  };

  void preservedDashboardState;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.background} style={colorScheme === "dark" ? "light" : "dark"} translucent />
      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            alignSelf: getContentMaxWidth(width) ? "center" : "stretch",
            maxWidth: getContentMaxWidth(width),
            gap: getSectionGap(width),
            paddingBottom: getScrollContentBottomPadding(width, insets.bottom),
            paddingHorizontal: getScreenHorizontalPadding(width),
            paddingTop: getSafeAreaTopSpacing(insets.top) + getContentTopSpacing(width),
          },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={[styles.scroller, { backgroundColor: colors.background }]}
      >
        <DashboardHeader driverName={driverName} greeting={getGreeting()} roleLabel={roleLabel} />
        <DeliverySummaryCard counts={summaryCounts} selectedDayLabel="My Deliveries" />
        <ActiveDeliveryCard
          delivery={activeDelivery}
          deliveryUnavailable={state.deliveryUnavailable}
          loading={loading || profileLoading}
          onOpenRoute={openRoute}
          onViewDetails={viewDetails}
          route={state.activeRoute}
          routeUnavailable={state.routeUnavailable}
        />
        <ScheduleOverviewCard
          details={scheduleDetails}
          loading={loading || profileLoading}
          onViewSchedule={openSchedule}
          scheduleUnavailable={state.scheduleUnavailable}
          vehicleUnavailable={state.vehicleUnavailable}
        />
        <RecentAlertsSection
          alerts={dashboardAlerts}
          loading={loading || profileLoading}
          notificationUnavailable={state.notificationUnavailable}
          onViewAll={openAlerts}
        />
      </Animated.ScrollView>
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
      <DashboardScrollEdge topInset={insets.top} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: "100%",
  },
  scroller: {
    flex: 1,
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
});
