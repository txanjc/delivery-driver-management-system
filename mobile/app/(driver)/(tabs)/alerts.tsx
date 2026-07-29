import type { ComponentProps, ReactElement } from "react";
import { useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import type { ListRenderItem } from "react-native";
import { useEvent, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getCardPadding,
  getCardRadius,
  getDashboardColors,
  getScreenHorizontalPadding,
  getScrollContentBottomPadding,
  getSectionGap,
} from "@/components/dashboard/dashboardDesignSpec";
import { DashboardScrollEdge } from "@/components/dashboard/DashboardScrollEdge";
import { LiquidGlassButton } from "@/components/shared/LiquidGlassButton";
import { LiquidGlassSegmentedControl } from "@/components/shared/LiquidGlassSegmentedControl";
import { DriverAlertsPager, type DriverAlertsPagerHandle, type DriverAlertsPagerOnPageScrollEvent, type DriverAlertsPagerOnPageSelectedEvent } from "@/components/shared/DriverAlertsPager";
import { ProfileButton } from "@/components/shared/ProfileButton";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import {
  getNotificationsForUser,
  markAllNotificationsAsReadForUser,
  markNotificationAsReadForUser,
} from "@/services/notification.service";
import type { DriverNotification } from "@/types/notification";
import { triggerButtonHaptic } from "@/utils/haptics";

type NotificationIcon = ComponentProps<typeof SymbolView>["name"];
type AlertFilter = "all" | "unread";

const alertFilterOptions = [
  { label: "All Alerts", value: "all" },
  { label: "Unread", value: "unread" },
] as const;

function formatTimestamp(value: string | null) {
  if (!value) return "Recently";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Recently";

  const elapsedMinutes = Math.max(0, Math.round((Date.now() - timestamp.getTime()) / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  if (elapsedMinutes < 24 * 60) return `${Math.floor(elapsedMinutes / 60)}h ago`;
  if (elapsedMinutes < 48 * 60) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(timestamp);
}

function getNotificationIcon(notification: DriverNotification): NotificationIcon {
  const content = `${notification.title ?? ""} ${notification.message ?? ""}`.toLowerCase();
  if (content.includes("schedule") || content.includes("shift")) return "calendar";
  if (content.includes("delivery") || content.includes("assignment")) return "shippingbox";
  if (content.includes("route")) return "map";
  if (content.includes("delay") || content.includes("failed") || content.includes("urgent")) return "exclamationmark.triangle";
  return "bell";
}

function getNotificationCategory(notification: DriverNotification) {
  const content = `${notification.title ?? ""} ${notification.message ?? ""}`.toLowerCase();
  if (content.includes("schedule") || content.includes("shift")) return "Schedule";
  if (content.includes("delivery") || content.includes("assignment")) return "Delivery";
  if (content.includes("route")) return "Route";
  if (content.includes("delay") || content.includes("failed") || content.includes("urgent")) return "Priority";
  return "Update";
}

function getNotificationTitle(notification: DriverNotification) {
  return notification.title?.trim() || "Driver alert";
}

function getNotificationMessage(notification: DriverNotification) {
  return notification.message?.trim() || "No additional details were provided.";
}

function getNotificationContext(notification: DriverNotification) {
  const type = notification.notification_type?.replace(/^email:/, "").replaceAll("_", " ").trim();
  const status = notification.status?.replaceAll("_", " ").trim();
  const parts = [
    type ? type.replace(/\b\w/g, (letter) => letter.toUpperCase()) : null,
    notification.delivery_id ? `Delivery ${notification.delivery_id.slice(0, 8)}` : null,
    status ? status.replace(/\b\w/g, (letter) => letter.toUpperCase()) : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

export default function AlertsScreen() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReducedMotion();
  const { user } = useAuth();
  const { refreshUnreadCount } = useUnreadNotificationCount();
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const pagerRef = useRef<DriverAlertsPagerHandle>(null);
  const filterProgress = useSharedValue(0);
  const colors = getDashboardColors(colorScheme);
  const cardPadding = getCardPadding(width);
  const cardRadius = getCardRadius(width);
  const sectionGap = getSectionGap(width);
  const unreadCount = useMemo(() => notifications.filter((notification) => notification.is_read !== true).length, [notifications]);
  const unreadNotifications = useMemo(() => notifications.filter((notification) => notification.is_read !== true), [notifications]);

  const loadNotifications = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (!user) {
      setNotifications([]);
      setError("Your session is unavailable. Please sign in again.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    const refreshStartedAt = mode === "refresh" ? Date.now() : null;

    const response = await getNotificationsForUser(user.id);
    if (response.error) {
      setError(response.error.message);
    } else {
      setNotifications(response.data ?? []);
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
    await refreshUnreadCount();
  }, [refreshUnreadCount, user]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const markNotificationRead = useCallback(async (notification: DriverNotification) => {
    if (!user || notification.is_read === true || updatingIds.has(notification.notification_id)) return;

    setUpdatingIds((current) => new Set(current).add(notification.notification_id));
    const response = await markNotificationAsReadForUser(notification.notification_id, user.id);
    if (response.error || response.data?.is_read !== true) {
      setError("This alert could not be marked as read. Please try again.");
    } else {
      setNotifications((current) => current.map((item) => (item.notification_id === notification.notification_id ? { ...item, is_read: true } : item)));
      await refreshUnreadCount();
    }
    setUpdatingIds((current) => {
      const next = new Set(current);
      next.delete(notification.notification_id);
      return next;
    });
  }, [refreshUnreadCount, updatingIds, user]);

  const markAllRead = useCallback(async () => {
    if (!user || unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    const response = await markAllNotificationsAsReadForUser(user.id);
    const updatedNotificationIds = new Set((response.data ?? []).filter((notification) => notification.is_read === true).map((notification) => notification.notification_id));
    if (response.error || updatedNotificationIds.size === 0) {
      setError("Alerts could not be marked as read. Please try again.");
    } else {
      setNotifications((current) => current.map((notification) => (updatedNotificationIds.has(notification.notification_id) ? { ...notification, is_read: true } : notification)));
      await refreshUnreadCount();
    }
    setMarkingAll(false);
  }, [markingAll, refreshUnreadCount, unreadCount, user]);

  const selectAlertFilter = useCallback((filter: AlertFilter) => {
    const index = filter === "all" ? 0 : 1;
    if (reduceMotionEnabled) {
      filterProgress.value = withTiming(index, { duration: 0 });
      setAlertFilter(filter);
      pagerRef.current?.setPageWithoutAnimation(index);
      return;
    }

    // PagerView owns the transition. Its native scroll progress drives the
    // indicator directly, preventing a competing spring when a tab is tapped.
    pagerRef.current?.setPage(index);
  }, [filterProgress, reduceMotionEnabled]);

  const handlePageScroll = useEvent<DriverAlertsPagerOnPageScrollEvent>(
    (event) => {
      "worklet";
      filterProgress.value = event.position + event.offset;
    },
    ["onPageScroll"],
  );

  const handlePageSelected = useCallback((event: DriverAlertsPagerOnPageSelectedEvent) => {
    setAlertFilter(event.nativeEvent.position === 0 ? "all" : "unread");
  }, []);

  const renderNotification = useCallback<ListRenderItem<DriverNotification>>(({ item }) => {
    const unread = item.is_read !== true;
    const updating = updatingIds.has(item.notification_id);
    const category = getNotificationCategory(item);
    const context = getNotificationContext(item);

    return (
      <View
        accessibilityLabel={`${unread ? "Unread. " : "Read. "}${category} alert. ${getNotificationTitle(item)}. ${getNotificationMessage(item)}. Received ${formatTimestamp(item.created_at)}.`}
        style={[
          styles.notificationCard,
          dashboardShadows.subtleCard,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: unread ? `${colors.accent}2C` : colors.subtleBorder,
            borderRadius: Math.max(cardRadius, 24),
            padding: cardPadding,
          },
        ]}
      >
        <Pressable
          accessibilityHint={unread ? "Marks this alert as read." : undefined}
          accessibilityLabel={`${unread ? "Mark as read. " : "Read. "}${getNotificationTitle(item)}`}
          accessibilityRole={unread ? "button" : "text"}
          disabled={!unread || updating}
          onPress={() => { void markNotificationRead(item); }}
          onPressIn={unread ? triggerButtonHaptic : undefined}
          style={({ pressed }) => [styles.notificationMain, { opacity: pressed ? 0.76 : 1 }]}
        >
          <View style={[styles.notificationIcon, { backgroundColor: unread ? `${colors.accent}18` : colors.surfaceMuted }]}>
            <SymbolView fallback={null} name={getNotificationIcon(item)} size={19} tintColor={unread ? colors.accent : colors.textSecondary} type="hierarchical" />
          </View>
          <View style={styles.notificationCopy}>
            <View style={styles.notificationTitleRow}>
              {unread ? <View accessibilityElementsHidden style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.notificationTitle, { color: colors.textPrimary, fontWeight: unread ? "700" : "600" }]}>{getNotificationTitle(item)}</Text>
            </View>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.notificationMessage, { color: colors.textSecondary }]}>{getNotificationMessage(item)}</Text>
            {context ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.notificationContext, { color: colors.textTertiary }]}>{context}</Text> : null}
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.notificationTime, { color: colors.textTertiary }]}>{`${unread ? "Needs attention" : "Read"} · Received ${formatTimestamp(item.created_at)}`}</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityHint={unread ? "Marks this alert as read." : undefined}
          accessibilityLabel={unread ? "Mark alert as read" : "Alert read"}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !unread, disabled: !unread || updating }}
          disabled={!unread || updating}
          onPress={() => { void markNotificationRead(item); }}
          onPressIn={unread ? triggerButtonHaptic : undefined}
          style={styles.readCheckboxTouchTarget}
        >
          <View
            style={[
              styles.readCheckbox,
              {
                backgroundColor: unread ? "transparent" : colors.accent,
                borderColor: unread ? colors.textTertiary : colors.accent,
              },
            ]}
          >
            {updating ? <ActivityIndicator color={colors.accent} size="small" /> : !unread ? <SymbolView fallback={null} name="checkmark" size={14} tintColor="#FFFFFF" type="hierarchical" /> : null}
          </View>
        </Pressable>
      </View>
    );
  }, [cardPadding, cardRadius, colors, markNotificationRead, updatingIds]);

  return (
    <View style={[styles.container, { backgroundColor: colors.dashboardBackground }]}>
      <View style={[styles.headerStack, { gap: sectionGap, paddingHorizontal: getScreenHorizontalPadding(width), paddingTop: insets.top + dashboardSpacing.scale.md }]}>
        <View style={styles.pageHeader}>
          <View style={styles.headingCopy}>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.pageTitle} style={[styles.pageTitle, { color: colors.textPrimary }]}>Alerts</Text>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.pageSubtitle, { color: colors.textSecondary }]}>Operational updates from dispatch</Text>
          </View>
          <ProfileButton dashboardIcon />
        </View>

        <View style={[styles.summaryCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
          <View style={[styles.summaryIcon, { backgroundColor: unreadCount > 0 ? `${colors.accent}18` : colors.surfaceMuted }]}>
            <SymbolView fallback={null} name={unreadCount > 0 ? "bell.badge" : "checkmark.circle"} size={22} tintColor={unreadCount > 0 ? colors.accent : colors.success} type="hierarchical" />
          </View>
          <View style={styles.summaryCopy}>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.summaryTitle, { color: colors.textPrimary }]}>{unreadCount > 0 ? `${unreadCount} unread ${unreadCount === 1 ? "alert" : "alerts"}` : "You're all caught up"}</Text>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.summaryMessage, { color: colors.textSecondary }]}>{unreadCount > 0 ? "Tap an unread alert to mark it as read." : "New operational updates will appear here."}</Text>
          </View>
          {unreadCount > 0 ? (
            <LiquidGlassButton
              accentColor={colors.accent}
              accessibilityLabel="Mark all alerts as read"
              capsule
              disabled={markingAll}
              onPress={() => { void markAllRead(); }}
              radius={14}
              style={styles.markAllButton}
              variant={colorScheme === "dark" ? "sectionAccent" : "secondaryNeutral"}
            >
              {markingAll ? <ActivityIndicator color={colorScheme === "dark" ? "#FFFFFF" : colors.accent} size="small" /> : <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.markAllText, { color: colorScheme === "dark" ? "#FFFFFF" : colors.accent }]}>Mark All Read</Text>}
            </LiquidGlassButton>
          ) : null}
        </View>

        <LiquidGlassSegmentedControl
          accessibilityLabel="Alert filter"
          borderColor={colors.subtleBorder}
          fallbackColor={colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(242, 244, 248, 0.72)"}
          inactiveTextColor={colors.textSecondary}
          onValueChange={selectAlertFilter}
          options={alertFilterOptions}
          progress={filterProgress}
          selectedColor={colorScheme === "dark" ? "rgba(109, 74, 255, 0.78)" : "rgba(109, 74, 255, 0.88)"}
          textColor="#FFFFFF"
          tintColor={colorScheme === "dark" ? "rgba(109, 74, 255, 0.24)" : "rgba(255, 255, 255, 0.66)"}
          value={alertFilter}
        />
      </View>

      <DriverAlertsPager ref={pagerRef} initialPage={0} onPageScroll={handlePageScroll} onPageSelected={handlePageSelected} overdrag style={styles.pager}>
        <View key="all-alerts" style={styles.pagerPage}>
          <AlertsListPage
            alerts={notifications}
            colors={colors}
            contentPaddingBottom={getScrollContentBottomPadding(width, insets.bottom)}
            contentPaddingHorizontal={getScreenHorizontalPadding(width)}
            empty={loading ? <LoadingAlerts colors={colors} /> : <AlertsMessage colors={colors} error={error} filteredUnread={false} onRetry={() => { void loadNotifications(); }} />}
            error={error}
            onRefresh={() => { void loadNotifications("refresh"); }}
            refreshProgressOffset={insets.top + 8}
            refreshing={refreshing}
            renderNotification={renderNotification}
          />
        </View>
        <View key="unread-alerts" style={styles.pagerPage}>
          <AlertsListPage
            alerts={unreadNotifications}
            colors={colors}
            contentPaddingBottom={getScrollContentBottomPadding(width, insets.bottom)}
            contentPaddingHorizontal={getScreenHorizontalPadding(width)}
            empty={loading ? <LoadingAlerts colors={colors} /> : <AlertsMessage colors={colors} error={null} filteredUnread={notifications.length > 0} onRetry={() => { void loadNotifications(); }} />}
            error={null}
            onRefresh={() => { void loadNotifications("refresh"); }}
            refreshProgressOffset={insets.top + 8}
            refreshing={refreshing}
            renderNotification={renderNotification}
          />
        </View>
      </DriverAlertsPager>
      {!refreshing ? <DashboardScrollEdge topInset={insets.top} /> : null}
    </View>
  );
}

type AlertsListPageProps = {
  alerts: DriverNotification[];
  colors: ReturnType<typeof getDashboardColors>;
  contentPaddingBottom: number;
  contentPaddingHorizontal: number;
  empty: ReactElement;
  error: string | null;
  onRefresh: () => void;
  refreshProgressOffset: number;
  refreshing: boolean;
  renderNotification: ListRenderItem<DriverNotification>;
};

function AlertsListPage({ alerts, colors, contentPaddingBottom, contentPaddingHorizontal, empty, error, onRefresh, refreshProgressOffset, refreshing, renderNotification }: AlertsListPageProps) {
  return (
    <FlatList
      alwaysBounceVertical
      bounces
      contentContainerStyle={[styles.pageContent, { paddingBottom: contentPaddingBottom, paddingHorizontal: contentPaddingHorizontal }]}
      data={alerts}
      keyExtractor={(item) => item.notification_id}
      ListEmptyComponent={empty}
      ListHeaderComponent={
        alerts.length > 0 ? (
          <View style={styles.pageListHeader}>
            <View style={styles.listHeading}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.listTitle, { color: colors.textPrimary }]}>Notifications</Text>
              <View style={[styles.alertCountPill, { backgroundColor: `${colors.accent}18`, borderColor: `${colors.accent}30` }]}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.alertCountText, { color: colors.accent }]}>{alerts.length === 1 ? "1 alert" : `${alerts.length} alerts`}</Text>
              </View>
            </View>
            {error ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.refreshError, { color: colors.textSecondary }]}>Alerts could not be refreshed. Showing the last available updates.</Text> : null}
          </View>
        ) : null
      }
      overScrollMode="always"
      refreshControl={
        <RefreshControl
          colors={[colors.accent]}
          onRefresh={onRefresh}
          progressViewOffset={refreshProgressOffset}
          refreshing={refreshing}
          tintColor={colors.accent}
        />
      }
      renderItem={renderNotification}
      showsVerticalScrollIndicator
    />
  );
}

function LoadingAlerts({ colors }: { colors: ReturnType<typeof getDashboardColors> }) {
  return <View accessibilityLabel="Loading alerts" accessibilityRole="progressbar" style={styles.loading}><ActivityIndicator color={colors.accent} size="small" /></View>;
}

function AlertsMessage({ colors, error, filteredUnread, onRetry }: { colors: ReturnType<typeof getDashboardColors>; error: string | null; filteredUnread: boolean; onRetry: () => void }) {
  const unavailable = Boolean(error);
  return (
    <View style={[styles.emptyCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
        <SymbolView fallback={null} name={unavailable ? "exclamationmark.triangle" : "checkmark.circle"} size={24} tintColor={unavailable ? colors.warning : colors.success} type="hierarchical" />
      </View>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.emptyTitle, { color: colors.textPrimary }]}>{unavailable ? "Alerts unavailable" : filteredUnread ? "No unread alerts" : "You're all caught up"}</Text>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.emptyMessage, { color: colors.textSecondary }]}>{unavailable ? error : filteredUnread ? "All alerts have been marked as read." : "No alerts are waiting for you right now."}</Text>
      {unavailable ? (
        <Pressable accessibilityLabel="Retry loading alerts" accessibilityRole="button" onPress={onRetry} onPressIn={triggerButtonHaptic} style={[styles.retryButton, { backgroundColor: colors.accent }]}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, width: "100%" },
  emptyCard: { alignItems: "center", borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, gap: dashboardSpacing.scale.sm, padding: 24 },
  emptyIcon: { alignItems: "center", borderRadius: 999, height: 56, justifyContent: "center", width: 56 },
  emptyMessage: { maxWidth: 280, textAlign: "center" },
  emptyTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "700", lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  headerStack: { width: "100%" },
  headingCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  alertCountPill: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: dashboardSpacing.scale.sm, paddingVertical: dashboardSpacing.scale.xs },
  alertCountText: { fontSize: 11, fontWeight: "700", lineHeight: 13 },
  listHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  listTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: dashboardTypography.compactPageTitle.fontWeight, lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  loading: { alignItems: "center", minHeight: 200, justifyContent: "center" },
  markAllButton: { minHeight: 40, paddingHorizontal: 9 },
  markAllText: { fontSize: 11, fontWeight: "700", lineHeight: 13 },
  notificationCard: { alignItems: "flex-start", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: dashboardSpacing.scale.sm, marginBottom: dashboardSpacing.scale.md },
  notificationCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  notificationContext: { fontSize: dashboardTypography.caption.fontSize, fontWeight: "600", lineHeight: dashboardTypography.caption.lineHeight },
  notificationIcon: { alignItems: "center", borderRadius: 999, height: 38, justifyContent: "center", width: 38 },
  notificationMain: { alignItems: "flex-start", flex: 1, flexDirection: "row", gap: dashboardSpacing.scale.md, minWidth: 0 },
  notificationMessage: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  notificationTime: { fontSize: dashboardTypography.caption.fontSize, lineHeight: dashboardTypography.caption.lineHeight, marginTop: dashboardSpacing.scale.xs },
  notificationTitle: { flex: 1, fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
  notificationTitleRow: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.sm },
  pageHeader: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.md, justifyContent: "space-between" },
  pageContent: { flexGrow: 1, paddingTop: dashboardSpacing.scale.md, width: "100%" },
  pageListHeader: { gap: dashboardSpacing.scale.sm, marginBottom: dashboardSpacing.scale.md },
  pager: { flex: 1, marginTop: dashboardSpacing.scale.md },
  pagerPage: { flex: 1 },
  pageSubtitle: { fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
  pageTitle: { fontSize: dashboardTypography.largePageTitle.fontSize, fontWeight: dashboardTypography.largePageTitle.fontWeight, lineHeight: dashboardTypography.largePageTitle.lineHeight },
  refreshError: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  retryButton: { alignItems: "center", borderRadius: 14, justifyContent: "center", marginTop: dashboardSpacing.scale.sm, minHeight: 44, paddingHorizontal: 16 },
  retryText: { color: "#FFFFFF", fontSize: dashboardTypography.control.fontSize, fontWeight: dashboardTypography.control.fontWeight, lineHeight: dashboardTypography.control.lineHeight },
  readCheckbox: { alignItems: "center", borderRadius: 999, borderWidth: 1.5, height: 24, justifyContent: "center", width: 24 },
  readCheckboxTouchTarget: { alignItems: "center", height: 44, justifyContent: "center", marginTop: -3, width: 44 },
  summaryCard: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: dashboardSpacing.scale.md },
  summaryCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  summaryIcon: { alignItems: "center", borderRadius: 999, height: 46, justifyContent: "center", width: 46 },
  summaryMessage: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  summaryTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "700", lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  unreadDot: { borderRadius: 999, height: 8, width: 8 },
});
