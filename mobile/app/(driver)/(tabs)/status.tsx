import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import type { DimensionValue } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getButtonHeight,
  getButtonRadius,
  getCardPadding,
  getCardRadius,
  getDashboardColors,
  getScreenHorizontalPadding,
  getScrollContentBottomPadding,
  getSectionGap,
} from "@/components/dashboard/dashboardDesignSpec";
import { DashboardScrollEdge } from "@/components/dashboard/DashboardScrollEdge";
import { GlassActionButton } from "@/components/shared/GlassActionButton";
import { ProfileButton } from "@/components/shared/ProfileButton";
import { PullToRefreshIndicator, usePullToRefreshCue } from "@/components/shared/PullToRefreshIndicator";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import {
  getDeliveriesForDriver,
  getDeliveryStatusHistoryForDriver,
} from "@/services/delivery.service";
import type { Delivery, DeliveryStatusHistory } from "@/types/delivery";
import { triggerButtonHaptic } from "@/utils/haptics";

type DeliveryStatus = "pending" | "assigned" | "in_transit" | "delivered" | "delayed" | "failed" | "returned";

const activeStatuses = new Set<DeliveryStatus>(["pending", "assigned", "in_transit", "delayed"]);
const terminalStatuses = new Set<DeliveryStatus>(["delivered", "failed", "returned"]);

function normalizeStatus(status: string | null): DeliveryStatus | null {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  return ["pending", "assigned", "in_transit", "delivered", "delayed", "failed", "returned"].includes(normalized)
    ? normalized as DeliveryStatus
    : null;
}

function formatStatus(status: string | null) {
  const normalized = normalizeStatus(status);
  if (!normalized) return "Status unavailable";

  return normalized
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatDeliveryLabel(delivery: Delivery) {
  return delivery.delivery_number ? `#${delivery.delivery_number}` : "Assigned delivery";
}

function formatLabel(value: string) {
  return value
    .trim()
    .replace(/[_-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return "Recently";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatHistoryTitle(entry: DeliveryStatusHistory) {
  const nextStatus = entry.new_status ?? entry.status;

  if (entry.previous_status && nextStatus && normalizeStatus(entry.previous_status) !== normalizeStatus(nextStatus)) {
    return `${formatStatus(entry.previous_status)} → ${formatStatus(nextStatus)}`;
  }

  return `Marked ${formatStatus(nextStatus)}`;
}

function formatHistoryDetail(entry: DeliveryStatusHistory) {
  return [entry.notes, entry.location].filter((detail): detail is string => Boolean(detail?.trim())).join(" • ");
}

function getProgressStep(status: string | null) {
  const normalized = normalizeStatus(status);
  if (terminalStatuses.has(normalized ?? "pending")) return 3;
  if (normalized === "in_transit" || normalized === "delayed") return 2;
  if (normalized === "assigned" || normalized === "pending") return 1;
  return 0;
}

function getActiveDelivery(deliveries: Delivery[]) {
  return deliveries.find((delivery) => normalizeStatus(delivery.status) === "in_transit")
    ?? deliveries.find((delivery) => normalizeStatus(delivery.status) === "delayed")
    ?? deliveries.find((delivery) => normalizeStatus(delivery.status) === "assigned")
    ?? deliveries.find((delivery) => normalizeStatus(delivery.status) === "pending")
    ?? null;
}

export default function StatusScreen() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { driver, loading: profileLoading } = useDriverProfile();
  const colors = getDashboardColors(colorScheme);
  const cardPadding = getCardPadding(width);
  const cardRadius = getCardRadius(width);
  const sectionGap = getSectionGap(width);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [history, setHistory] = useState<DeliveryStatusHistory[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDeliveries = useMemo(
    () => deliveries.filter((delivery) => activeStatuses.has(normalizeStatus(delivery.status) ?? "pending")),
    [deliveries],
  );
  const selectedDelivery = useMemo(
    () => deliveries.find((delivery) => delivery.delivery_id === selectedDeliveryId) ?? getActiveDelivery(activeDeliveries),
    [activeDeliveries, deliveries, selectedDeliveryId],
  );
  const customerPhone = selectedDelivery?.customer_phone?.trim() || null;

  const loadHistory = useCallback(async (deliveryId: string) => {
    const response = await getDeliveryStatusHistoryForDriver(deliveryId);
    setHistory(response.error ? [] : response.data ?? []);
  }, []);

  const loadStatus = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (profileLoading) return;
    if (!driver) {
      setDeliveries([]);
      setHistory([]);
      setError("Your driver record is unavailable. Please sign in again.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    const refreshStartedAt = mode === "refresh" ? Date.now() : null;

    const response = await getDeliveriesForDriver(driver.driver_id);
    if (response.error) {
      setError("Delivery status could not be refreshed. Please try again.");
    } else {
      const nextDeliveries = response.data ?? [];
      const preferredDelivery = getActiveDelivery(nextDeliveries);
      setDeliveries(nextDeliveries);
      setSelectedDeliveryId((current) => nextDeliveries.some((delivery) => delivery.delivery_id === current) ? current : preferredDelivery?.delivery_id ?? null);
      setError(null);
    }

    setLoading(false);
    if (refreshStartedAt !== null) {
      const remainingSpinnerTime = Math.max(0, 450 - (Date.now() - refreshStartedAt));
      if (remainingSpinnerTime > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remainingSpinnerTime));
      }
    }
    setRefreshing(false);
  }, [driver, profileLoading]);

  const handleNativeRefresh = useCallback(() => {
    if (refreshing || profileLoading || !driver) return;

    setRefreshing(true);
    void loadStatus("refresh");
  }, [driver, loadStatus, profileLoading, refreshing]);

  const {
    onScroll: handleNativeRefreshScroll,
    onScrollEndDrag: handleNativeRefreshEndDrag,
    showPullHint,
  } = usePullToRefreshCue(refreshing, handleNativeRefresh);

  useFocusEffect(
    useCallback(() => {
      void loadStatus();
    }, [loadStatus]),
  );

  useEffect(() => {
    if (selectedDelivery) {
      void loadHistory(selectedDelivery.delivery_id);
    } else {
      setHistory([]);
    }
  }, [loadHistory, selectedDelivery]);

  const callCustomer = useCallback(async () => {
    if (!customerPhone) return;

    try {
      await Linking.openURL(`tel:${customerPhone}`);
    } catch {
      setError("Calling is unavailable on this device. Please try again later.");
    }
  }, [customerPhone]);

  const timeline = useMemo(() => {
    if (!selectedDelivery) return [];

    const initialStatus = normalizeStatus(selectedDelivery.status) === "pending" ? "pending" : "assigned";
    const orderedHistory = [...history].sort((left, right) => {
      const leftTimestamp = new Date(left.created_at ?? 0).getTime();
      const rightTimestamp = new Date(right.created_at ?? 0).getTime();
      return leftTimestamp - rightTimestamp;
    });
    const hasInitialEntry = orderedHistory.some((entry) => {
      const entryStatus = normalizeStatus(entry.new_status ?? entry.status);
      return entryStatus === "pending" || entryStatus === "assigned";
    });
    const hasCurrentEntry = orderedHistory.some(
      (entry) => normalizeStatus(entry.new_status ?? entry.status) === normalizeStatus(selectedDelivery.status),
    );
    const timelineEntries = [...orderedHistory];

    if (!hasInitialEntry) {
      timelineEntries.unshift({
        status_history_id: `initial-${selectedDelivery.delivery_id}`,
        delivery_id: selectedDelivery.delivery_id,
        status: initialStatus,
        updated_by: null,
        notes: null,
        created_at: selectedDelivery.created_at,
        previous_status: null,
        new_status: initialStatus,
        location: null,
        updated_at: selectedDelivery.created_at,
      });
    }

    if (!hasCurrentEntry && normalizeStatus(selectedDelivery.status) !== initialStatus) {
      timelineEntries.push({
        status_history_id: `current-${selectedDelivery.delivery_id}`,
        delivery_id: selectedDelivery.delivery_id,
        status: selectedDelivery.status,
        updated_by: null,
        notes: null,
        created_at: selectedDelivery.updated_at,
        previous_status: null,
        new_status: selectedDelivery.status,
        location: null,
        updated_at: selectedDelivery.updated_at,
      });
    }

    return timelineEntries;
  }, [history, selectedDelivery]);

  return (
    <View style={[styles.container, { backgroundColor: colors.dashboardBackground }]}>
      <ScrollView
        alwaysBounceVertical
        bounces
        contentContainerStyle={[
          styles.content,
          {
            gap: sectionGap,
            paddingBottom: getScrollContentBottomPadding(width, insets.bottom),
            paddingHorizontal: getScreenHorizontalPadding(width),
            paddingTop: insets.top + dashboardSpacing.scale.md,
          },
        ]}
        overScrollMode="always"
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={handleNativeRefresh}
            progressViewOffset={insets.top + 8}
            refreshing={refreshing}
            tintColor={colors.accent}
          />
        }
        onScroll={handleNativeRefreshScroll}
        onScrollEndDrag={handleNativeRefreshEndDrag}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.pageTitle} style={[styles.pageTitle, { color: colors.textPrimary }]}>Status</Text>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.pageSubtitle, { color: colors.textSecondary }]}>Keep dispatch updated as you work.</Text>
          </View>
          <ProfileButton dashboardIcon />
        </View>

        {loading || profileLoading ? (
          <LoadingCard cardPadding={cardPadding} cardRadius={cardRadius} colors={colors} />
        ) : !selectedDelivery ? (
          <EmptyStatusCard cardPadding={cardPadding} cardRadius={cardRadius} colors={colors} error={error} onRetry={() => { void loadStatus(); }} />
        ) : (
          <>
            {activeDeliveries.length > 0 ? (
              <View style={styles.deliveryPickerSection}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionLabel, { color: colors.textSecondary }]}>Assigned Deliveries</Text>
                <ScrollView contentContainerStyle={styles.deliveryPickerRow} horizontal showsHorizontalScrollIndicator={false}>
                  {activeDeliveries.map((delivery) => {
                    const selected = delivery.delivery_id === selectedDelivery.delivery_id;
                    return (
                      <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        key={delivery.delivery_id}
                        onPress={() => {
                          if (selected) return;
                          triggerButtonHaptic();
                          setSelectedDeliveryId(delivery.delivery_id);
                        }}
                        style={({ pressed }) => [styles.deliveryPickerPill, { backgroundColor: selected ? `${colors.accent}18` : colors.surfaceElevated, borderColor: selected ? `${colors.accent}42` : colors.subtleBorder, opacity: pressed ? 0.76 : 1 }]}
                      >
                        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.deliveryPickerText, { color: selected ? colors.accent : colors.textSecondary }]}>{formatDeliveryLabel(delivery)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={[styles.deliveryCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
              <View style={styles.deliveryCardHeader}>
                <View style={styles.deliveryIdentity}>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionLabel, { color: colors.textSecondary }]}>Delivery</Text>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.deliveryNumber, { color: colors.textPrimary }]}>{formatDeliveryLabel(selectedDelivery)}</Text>
                </View>
                <View style={[styles.priorityPill, { backgroundColor: `${colors.accent}16`, borderColor: `${colors.accent}32` }]}>
                  <SymbolView fallback={null} name="tag.fill" size={13} tintColor={colors.accent} type="hierarchical" />
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.priorityPillText, { color: colors.accent }]}>{selectedDelivery.priority ? formatLabel(selectedDelivery.priority) : "Normal"}</Text>
                </View>
              </View>

              <View style={styles.customerRow}>
                <View style={[styles.customerIcon, { backgroundColor: `${colors.accent}16` }]}>
                  <SymbolView fallback={null} name="shippingbox" size={18} tintColor={colors.accent} type="hierarchical" />
                </View>
                <View style={styles.customerCopy}>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.customerLabel, { color: colors.textSecondary }]}>DELIVER TO</Text>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.customerName, { color: colors.textPrimary }]}>{selectedDelivery.customer_name ?? "Customer unavailable"}</Text>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.destination, { color: colors.textSecondary }]}>{selectedDelivery.delivery_address ?? "Delivery address unavailable"}</Text>
                </View>
              </View>

              <StatusProgress colors={colors} status={selectedDelivery.status} />
            </View>

            <View style={[styles.callCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionCopy}>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Call Customer</Text>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.sectionDescription, { color: colors.textSecondary }]}>{customerPhone ?? "No phone number is available for this delivery."}</Text>
                </View>
                <SymbolView fallback={null} name="person.fill" size={20} tintColor={colors.accent} type="hierarchical" />
              </View>
              <GlassActionButton
                accessibilityLabel={customerPhone ? `Call ${selectedDelivery.customer_name ?? "customer"}` : "Customer phone number unavailable"}
                capsule
                disabled={!customerPhone}
                iconName="phone.fill"
                iconPosition="left"
                label={customerPhone ? "Call Customer" : "Phone Unavailable"}
                labelStyle={styles.actionButtonLabel}
                onPress={callCustomer}
                radius={getButtonRadius(width)}
                style={[styles.callCustomerButton, { minHeight: getButtonHeight(width) - 4 }]}
                variant="primaryAccent"
              />
            </View>

            <View style={[styles.actionCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionCopy}>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Update Delivery</Text>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.sectionDescription, { color: colors.textSecondary }]}>Choose the current outcome for this delivery.</Text>
                </View>
                <SymbolView fallback={null} name="arrow.triangle.2.circlepath" size={20} tintColor={colors.accent} type="hierarchical" />
              </View>

              {error ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              {!terminalStatuses.has(normalizeStatus(selectedDelivery.status) ?? "pending") ? (
                <GlassActionButton
                  accessibilityLabel="Update delivery status"
                  capsule
                  iconName="arrow.up.arrow.down"
                  iconPosition="left"
                  label="Update Delivery"
                  labelStyle={styles.actionButtonLabel}
                  onPress={() => { router.push({ pathname: "/(driver)/status-update/[deliveryId]", params: { deliveryId: selectedDelivery.delivery_id } }); }}
                  radius={getButtonRadius(width)}
                  style={[styles.updateDeliveryButton, { minHeight: getButtonHeight(width) - 4 }]}
                  variant="primaryAccent"
                />
              ) : (
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.completedCopy, { color: colors.textSecondary }]}>This delivery is complete. There are no further status updates to send.</Text>
              )}
            </View>

            <View style={[styles.historyCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
              <View style={styles.sectionHeader}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Status History</Text>
                <SymbolView fallback={null} name="clock.arrow.circlepath" size={20} tintColor={colors.accent} type="monochrome" />
              </View>
              <View style={styles.timeline}>
                {timeline.map((entry, index) => (
                  <View key={`${entry.status ?? "unknown"}-${entry.created_at ?? index}`} style={styles.timelineEntry}>
                    <View style={styles.timelineRail}>
                      <View style={[styles.timelineDot, { backgroundColor: index === timeline.length - 1 ? colors.accent : colors.textTertiary }]} />
                      {index < timeline.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: colors.divider }]} /> : null}
                    </View>
                    <View style={styles.timelineCopy}>
                      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.timelineTitle, { color: colors.textPrimary }]}>{formatHistoryTitle(entry)}</Text>
                      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.timelineTime, { color: colors.textSecondary }]}>{`Updated ${formatTimestamp(entry.created_at)}`}</Text>
                      {formatHistoryDetail(entry) ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.timelineDetail, { color: colors.textSecondary }]}>{formatHistoryDetail(entry)}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <PullToRefreshIndicator color={colors.accent} showPullHint={showPullHint} topInset={insets.top} visible={refreshing} />
      {!refreshing ? <DashboardScrollEdge topInset={insets.top} /> : null}
    </View>
  );
}

function StatusProgress({ colors, status }: { colors: ReturnType<typeof getDashboardColors>; status: string | null }) {
  const currentStep = getProgressStep(status);
  const fillPercent = currentStep === 3 ? 100 : currentStep === 2 ? 50 : currentStep === 1 ? 12 : 0;
  const steps = ["Assigned", "In Transit", "Complete"];

  return (
    <View accessibilityLabel={`Delivery Progress: ${formatStatus(status)}. Stages are Assigned, In Transit, Complete.`} style={styles.progress}>
      <View style={styles.progressFooter}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.progressCaption, { color: colors.textSecondary }]}>Delivery Progress</Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.progressState, { color: colors.textSecondary }]}>{formatStatus(status)}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
        <AnimatedProgressFill fillPercent={fillPercent} />
      </View>
      <View style={styles.progressLabels}>
        {steps.map((label, index) => (
          <Text key={label} maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.progressLabel, { color: currentStep >= index + 1 ? colors.textPrimary : colors.textTertiary }]}>{label}</Text>
        ))}
      </View>
    </View>
  );
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

function LoadingCard({ cardPadding, cardRadius, colors }: { cardPadding: number; cardRadius: number; colors: ReturnType<typeof getDashboardColors> }) {
  return (
    <View accessibilityLabel="Loading delivery status" accessibilityRole="progressbar" style={[styles.loadingCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
      <ActivityIndicator color={colors.accent} />
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your delivery status...</Text>
    </View>
  );
}

function EmptyStatusCard({ cardPadding, cardRadius, colors, error, onRetry }: { cardPadding: number; cardRadius: number; colors: ReturnType<typeof getDashboardColors>; error: string | null; onRetry: () => void }) {
  return (
    <View style={[styles.emptyCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
        <SymbolView fallback={null} name={error ? "exclamationmark.triangle" : "checkmark.circle"} size={25} tintColor={error ? colors.warning : colors.accent} type="hierarchical" />
      </View>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.emptyTitle, { color: colors.textPrimary }]}>{error ? "Status unavailable" : "No active delivery"}</Text>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.emptyMessage, { color: colors.textSecondary }]}>{error ?? "Your current delivery will appear here when it is assigned."}</Text>
      {error ? <GlassActionButton capsule label="Try Again" onPress={onRetry} radius={cardRadius} style={styles.retryButton} variant="primaryAccent" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionCard: { borderWidth: StyleSheet.hairlineWidth, gap: dashboardSpacing.scale.md },
  actionButtonLabel: { fontWeight: "600" },
  callCard: { borderWidth: StyleSheet.hairlineWidth, gap: dashboardSpacing.scale.md },
  callCustomerButton: { paddingHorizontal: dashboardSpacing.scale.md, width: "100%" },
  completedCopy: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  container: { flex: 1 },
  content: { flexGrow: 1 },
  customerCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  customerIcon: { alignItems: "center", borderRadius: 999, height: 40, justifyContent: "center", width: 40 },
  customerLabel: { fontSize: dashboardTypography.caption.fontSize, fontWeight: "700", lineHeight: dashboardTypography.caption.lineHeight },
  customerName: { fontSize: dashboardTypography.secondary.fontSize, fontWeight: "700", lineHeight: dashboardTypography.secondary.lineHeight },
  customerRow: { alignItems: "flex-start", flexDirection: "row", gap: dashboardSpacing.scale.md },
  deliveryCard: { borderWidth: StyleSheet.hairlineWidth, gap: dashboardSpacing.scale.lg },
  deliveryCardHeader: { alignItems: "flex-start", flexDirection: "row", gap: dashboardSpacing.scale.md, justifyContent: "space-between" },
  deliveryIdentity: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  deliveryNumber: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "800", lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  deliveryPickerPill: { alignItems: "center", borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center", minHeight: 36, paddingHorizontal: dashboardSpacing.scale.md },
  deliveryPickerRow: { flexDirection: "row", gap: dashboardSpacing.scale.sm, paddingRight: dashboardSpacing.scale.md },
  deliveryPickerSection: { gap: dashboardSpacing.scale.sm },
  deliveryPickerText: { fontSize: dashboardTypography.caption.fontSize, fontWeight: "700", lineHeight: dashboardTypography.caption.lineHeight },
  destination: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  emptyCard: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, gap: dashboardSpacing.scale.md },
  emptyIcon: { alignItems: "center", borderRadius: 999, height: 50, justifyContent: "center", width: 50 },
  emptyMessage: { fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight, textAlign: "center" },
  emptyTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "700", lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  error: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  header: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.md, justifyContent: "space-between" },
  headerCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  historyCard: { borderWidth: StyleSheet.hairlineWidth, gap: dashboardSpacing.scale.md },
  loadingCard: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, gap: dashboardSpacing.scale.md, minHeight: 180, justifyContent: "center" },
  loadingText: { fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
  closeFallback: { fontSize: 24, fontWeight: "500", lineHeight: 24 },
  closeSheetButton: { alignItems: "center", borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, height: 44, justifyContent: "center", width: 44 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0, 0, 0, 0.42)" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  notice: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight, padding: dashboardSpacing.scale.sm },
  pageSubtitle: { fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
  pageTitle: { fontSize: dashboardTypography.largePageTitle.fontSize, fontWeight: dashboardTypography.largePageTitle.fontWeight, lineHeight: dashboardTypography.largePageTitle.lineHeight },
  pickerDescription: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  pickerHeader: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.md, justifyContent: "space-between" },
  pickerHeaderCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  pickerOptions: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", width: "100%" },
  pickerTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "700", lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  progress: { gap: dashboardSpacing.scale.md },
  progressCaption: { fontSize: dashboardTypography.secondary.fontSize, fontWeight: "500", lineHeight: dashboardTypography.secondary.lineHeight },
  progressFill: { backgroundColor: "#6D4AFF", borderRadius: 999, bottom: 0, elevation: 2, left: 0, overflow: "hidden", position: "absolute", shadowColor: "#6D4AFF", shadowOffset: { height: 0, width: 0 }, shadowOpacity: 0.62, shadowRadius: 10, top: 0 },
  progressFooter: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.md, justifyContent: "space-between" },
  progressGlow: { backgroundColor: "rgba(255, 255, 255, 0.62)", borderRadius: 999, bottom: 0, position: "absolute", top: 0, width: 42 },
  progressLabel: { flex: 1, fontSize: dashboardTypography.caption.fontSize, fontWeight: "500", lineHeight: dashboardTypography.caption.lineHeight, textAlign: "center" },
  progressLabels: { flexDirection: "row", gap: dashboardSpacing.scale.sm },
  progressState: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "800", lineHeight: dashboardTypography.compactPageTitle.lineHeight, textAlign: "right" },
  progressTrack: { borderRadius: 999, height: 10, overflow: "hidden", width: "100%" },
  priorityPill: { alignItems: "center", borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: dashboardSpacing.scale.xs, paddingHorizontal: dashboardSpacing.scale.sm, paddingVertical: dashboardSpacing.scale.xs },
  priorityPillText: { fontSize: 12, fontWeight: "700", lineHeight: 15 },
  retryButton: { minHeight: 42, paddingHorizontal: dashboardSpacing.scale.lg },
  sectionCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  sectionDescription: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  sectionHeader: { alignItems: "flex-start", flexDirection: "row", gap: dashboardSpacing.scale.md, justifyContent: "space-between" },
  sectionLabel: { fontSize: dashboardTypography.caption.fontSize, fontWeight: "700", lineHeight: dashboardTypography.caption.lineHeight, letterSpacing: 0.5 },
  sectionTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "700", lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  statusAction: { gap: dashboardSpacing.scale.sm },
  statusActionButton: { alignSelf: "flex-start", minWidth: 160, paddingHorizontal: dashboardSpacing.scale.md },
  statusActionCopy: { gap: dashboardSpacing.scale.xs },
  statusActionDescription: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  statusActionTitle: { fontSize: dashboardTypography.secondary.fontSize, fontWeight: "700", lineHeight: dashboardTypography.secondary.lineHeight },
  statusPicker: { borderTopWidth: StyleSheet.hairlineWidth, gap: dashboardSpacing.scale.lg },
  statusPickerCopy: { flex: 1, gap: dashboardSpacing.scale.xxs, minWidth: 0 },
  statusPickerIcon: { alignItems: "center", borderRadius: 999, height: 40, justifyContent: "center", width: 40 },
  statusPickerLabel: { fontSize: dashboardTypography.secondary.fontSize, fontWeight: "700", lineHeight: dashboardTypography.secondary.lineHeight },
  statusPickerRow: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.md, minHeight: 70, paddingHorizontal: dashboardSpacing.scale.md, paddingVertical: dashboardSpacing.scale.sm },
  statusPickerRowDescription: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  timeline: { gap: dashboardSpacing.scale.sm },
  timelineCopy: { flex: 1, gap: dashboardSpacing.scale.xxs, minWidth: 0, paddingBottom: dashboardSpacing.scale.sm },
  timelineDetail: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  timelineDot: { borderRadius: 999, height: 10, width: 10 },
  timelineEntry: { flexDirection: "row", gap: dashboardSpacing.scale.md },
  timelineLine: { flex: 1, marginVertical: dashboardSpacing.scale.xs, width: StyleSheet.hairlineWidth },
  timelineRail: { alignItems: "center", width: 12 },
  timelineTime: { fontSize: dashboardTypography.caption.fontSize, lineHeight: dashboardTypography.caption.lineHeight },
  timelineTitle: { fontSize: dashboardTypography.secondary.fontSize, fontWeight: "700", lineHeight: dashboardTypography.secondary.lineHeight },
  updateDeliveryButton: { paddingHorizontal: dashboardSpacing.scale.md, width: "100%" },
});
