import type { ComponentProps } from "react";
import { useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import type { ListRenderItem } from "react-native";
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

function getNotificationTitle(notification: DriverNotification) {
  return notification.title?.trim() || "Driver alert";
}

function getNotificationMessage(notification: DriverNotification) {
  return notification.message?.trim() || "No additional details were provided.";
}

export default function AlertsScreen() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshUnreadCount } = useUnreadNotificationCount();
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const colors = getDashboardColors(colorScheme);
  const cardPadding = getCardPadding(width);
  const cardRadius = getCardRadius(width);
  const sectionGap = getSectionGap(width);
  const unreadCount = useMemo(() => notifications.filter((notification) => notification.is_read !== true).length, [notifications]);

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

    const response = await getNotificationsForUser(user.id);
    if (response.error) {
      setError(response.error.message);
    } else {
      setNotifications(response.data ?? []);
      setError(null);
    }

    setLoading(false);
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

  const renderNotification = useCallback<ListRenderItem<DriverNotification>>(({ item }) => {
    const unread = item.is_read !== true;
    const updating = updatingIds.has(item.notification_id);

    return (
      <Pressable
        accessibilityHint={unread ? "Marks this alert as read." : undefined}
        accessibilityLabel={`${unread ? "Unread. " : ""}${getNotificationTitle(item)}. ${getNotificationMessage(item)}. ${formatTimestamp(item.created_at)}`}
        accessibilityRole={unread ? "button" : "text"}
        disabled={!unread || updating}
        onPress={() => { void markNotificationRead(item); }}
        onPressIn={unread ? triggerButtonHaptic : undefined}
        style={({ pressed }) => [
          styles.notificationCard,
          dashboardShadows.subtleCard,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: unread ? `${colors.accent}2C` : colors.subtleBorder,
            borderRadius: cardRadius,
            opacity: pressed ? 0.76 : 1,
            padding: cardPadding,
          },
        ]}
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
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.notificationTime, { color: colors.textTertiary }]}>{formatTimestamp(item.created_at)}</Text>
        </View>
        {updating ? <ActivityIndicator color={colors.accent} size="small" /> : unread ? <SymbolView fallback={null} name="checkmark" size={15} tintColor={colors.accent} type="hierarchical" /> : null}
      </Pressable>
    );
  }, [cardPadding, cardRadius, colors, markNotificationRead, updatingIds]);

  const initialEmpty = !loading && notifications.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.dashboardBackground }]}>
      <FlatList
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
        data={notifications}
        keyExtractor={(item) => item.notification_id}
        ListEmptyComponent={
          loading ? <LoadingAlerts colors={colors} /> : <AlertsMessage colors={colors} error={error} onRetry={() => { void loadNotifications(); }} />
        }
        ListHeaderComponent={
          <View style={[styles.headerStack, { gap: sectionGap }]}>
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
                <Pressable
                  accessibilityLabel="Mark all alerts as read"
                  accessibilityRole="button"
                  disabled={markingAll}
                  onPress={() => { void markAllRead(); }}
                  onPressIn={triggerButtonHaptic}
                  style={({ pressed }) => [styles.markAllButton, { backgroundColor: `${colors.accent}14`, opacity: pressed || markingAll ? 0.72 : 1 }]}
                >
                  {markingAll ? <ActivityIndicator color={colors.accent} size="small" /> : <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.markAllText, { color: colors.accent }]}>Mark all read</Text>}
                </Pressable>
              ) : null}
            </View>

            {notifications.length > 0 ? (
              <View style={styles.listHeading}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.listTitle, { color: colors.textPrimary }]}>Notifications</Text>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.listCount, { color: colors.textSecondary }]}>{notifications.length === 1 ? "1 alert" : `${notifications.length} alerts`}</Text>
              </View>
            ) : null}

            {error && notifications.length > 0 ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.refreshError, { color: colors.textSecondary }]}>Alerts could not be refreshed. Showing the last available updates.</Text> : null}
          </View>
        }
        overScrollMode="always"
        refreshControl={<RefreshControl colors={[colors.accent]} onRefresh={() => { void loadNotifications("refresh"); }} refreshing={refreshing} tintColor={colors.accent} />}
        renderItem={renderNotification}
        showsVerticalScrollIndicator={false}
      />
      <DashboardScrollEdge topInset={insets.top} />
    </View>
  );
}

function LoadingAlerts({ colors }: { colors: ReturnType<typeof getDashboardColors> }) {
  return <View accessibilityLabel="Loading alerts" accessibilityRole="progressbar" style={styles.loading}><ActivityIndicator color={colors.accent} size="small" /></View>;
}

function AlertsMessage({ colors, error, onRetry }: { colors: ReturnType<typeof getDashboardColors>; error: string | null; onRetry: () => void }) {
  const unavailable = Boolean(error);
  return (
    <View style={[styles.emptyCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
        <SymbolView fallback={null} name={unavailable ? "exclamationmark.triangle" : "checkmark.circle"} size={24} tintColor={unavailable ? colors.warning : colors.success} type="hierarchical" />
      </View>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.emptyTitle, { color: colors.textPrimary }]}>{unavailable ? "Alerts unavailable" : "You're all caught up"}</Text>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.emptyMessage, { color: colors.textSecondary }]}>{unavailable ? error : "No alerts are waiting for you right now."}</Text>
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
  listCount: { fontSize: dashboardTypography.caption.fontSize, lineHeight: dashboardTypography.caption.lineHeight },
  listHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  listTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: dashboardTypography.compactPageTitle.fontWeight, lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  loading: { alignItems: "center", minHeight: 200, justifyContent: "center" },
  markAllButton: { alignItems: "center", borderRadius: 14, justifyContent: "center", minHeight: 44, paddingHorizontal: 10 },
  markAllText: { fontSize: dashboardTypography.caption.fontSize, fontWeight: "700", lineHeight: dashboardTypography.caption.lineHeight },
  notificationCard: { alignItems: "flex-start", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: dashboardSpacing.scale.md, marginBottom: dashboardSpacing.scale.sm },
  notificationCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  notificationIcon: { alignItems: "center", borderRadius: 999, height: 38, justifyContent: "center", width: 38 },
  notificationMessage: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  notificationTime: { fontSize: dashboardTypography.caption.fontSize, lineHeight: dashboardTypography.caption.lineHeight, marginTop: dashboardSpacing.scale.xs },
  notificationTitle: { flex: 1, fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
  notificationTitleRow: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.sm },
  pageHeader: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.md, justifyContent: "space-between" },
  pageSubtitle: { fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
  pageTitle: { fontSize: dashboardTypography.largePageTitle.fontSize, fontWeight: dashboardTypography.largePageTitle.fontWeight, lineHeight: dashboardTypography.largePageTitle.lineHeight },
  refreshError: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  retryButton: { alignItems: "center", borderRadius: 14, justifyContent: "center", marginTop: dashboardSpacing.scale.sm, minHeight: 44, paddingHorizontal: 16 },
  retryText: { color: "#FFFFFF", fontSize: dashboardTypography.control.fontSize, fontWeight: dashboardTypography.control.fontWeight, lineHeight: dashboardTypography.control.lineHeight },
  summaryCard: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: dashboardSpacing.scale.md },
  summaryCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  summaryIcon: { alignItems: "center", borderRadius: 999, height: 46, justifyContent: "center", width: 46 },
  summaryMessage: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  summaryTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "700", lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  unreadDot: { borderRadius: 999, height: 8, width: 8 },
});
