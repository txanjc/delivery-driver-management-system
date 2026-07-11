import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SymbolView } from "expo-symbols";

import { AlertRow } from "@/components/dashboard/AlertRow";
import type { DashboardAlert } from "@/components/dashboard/AlertRow";
import {
  dashboardMaxFontSizeMultipliers,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getCardPadding,
  getCardRadius,
  getDashboardColors,
  getSectionGap,
} from "@/components/dashboard/dashboardDesignSpec";
import { triggerButtonHaptic } from "@/utils/haptics";

type RecentAlertsSectionProps = {
  alerts: DashboardAlert[];
  loading: boolean;
  notificationUnavailable: boolean;
  onViewAll: () => void;
};

const sleepZs = [
  { endX: 8, endY: -5, fontSize: 14, scale: 0.65, startX: 36, startY: 31 },
  { endX: 13, endY: -10, fontSize: 14, scale: 0.8, startX: 40, startY: 26 },
  { endX: 18, endY: -16, fontSize: 14, scale: 0.95, startX: 46, startY: 20 },
  { endX: 24, endY: -22, fontSize: 14, scale: 1.1, startX: 52, startY: 14 },
] as const;

const sleepCycleDuration = 3900;

function RecentAlertsSectionComponent({ alerts, loading, notificationUnavailable, onViewAll }: RecentAlertsSectionProps) {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const cardPadding = getCardPadding(width);
  const sectionGap = getSectionGap(width);
  const hasAlerts = alerts.length > 0;
  const showLoading = loading && !hasAlerts;
  const showUnavailable = notificationUnavailable && !hasAlerts;
  const showCachedUnavailable = notificationUnavailable && hasAlerts;
  const showEmpty = !showLoading && !showUnavailable && !hasAlerts;

  return (
    <View
      style={[
        styles.card,
        dashboardShadows.subtleCard,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.subtleBorder,
          borderRadius: getCardRadius(width),
          padding: cardPadding,
          rowGap: sectionGap,
        },
      ]}
    >
      <View style={styles.header}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.title, { color: colors.textPrimary, fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: dashboardTypography.compactPageTitle.fontWeight, lineHeight: dashboardTypography.compactPageTitle.lineHeight }]}>
          Recent Alerts
        </Text>
        <Pressable
          accessibilityLabel="Open all alerts"
          accessibilityRole="button"
          hitSlop={{ bottom: 10, left: 8, right: 8, top: 10 }}
          onPressIn={triggerButtonHaptic}
          onPress={onViewAll}
          style={({ pressed }) => [
            styles.viewAll,
            {
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.viewAllText, { color: colors.accent, fontSize: dashboardTypography.secondary.fontSize, fontWeight: "600", lineHeight: dashboardTypography.secondary.lineHeight }]}>
            View All
          </Text>
          <SymbolView fallback={null} name="chevron.right" size={14} tintColor={colors.accent} type="hierarchical" />
        </Pressable>
      </View>

      {showLoading ? <SectionMessage message="Checking your latest alerts." title="Loading alerts..." /> : null}
      {showUnavailable ? <SectionMessage message="Your recent alerts could not be refreshed." title="Alerts unavailable" /> : null}
      {showEmpty ? <EmptyAlertsState /> : null}

      {hasAlerts ? (
        <View>
          {alerts.map((alert, index) => (
            <AlertRow alert={alert} key={alert.id} showSeparator={index > 0} />
          ))}
        </View>
      ) : null}

      {showCachedUnavailable ? (
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.cachedError, { color: colors.textSecondary, fontSize: dashboardTypography.tertiary.fontSize, fontWeight: dashboardTypography.tertiary.fontWeight, lineHeight: dashboardTypography.tertiary.lineHeight }]}>
          Alerts could not be refreshed.
        </Text>
      ) : null}
    </View>
  );
}

export const RecentAlertsSection = memo(RecentAlertsSectionComponent);

function SectionMessage({ message, title }: { message: string; title: string }) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);

  return (
    <View style={styles.messageBlock}>
      <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.messageIcon, { backgroundColor: colors.surfaceMuted }]}>
        <SymbolView fallback={null} name={title === "No recent alerts" ? "checkmark.circle" : "bell"} size={17} tintColor={colors.textSecondary} type="hierarchical" />
      </View>
      <View style={styles.messageCopy}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.messageTitle, { color: colors.textPrimary, fontSize: dashboardTypography.secondary.fontSize, fontWeight: "600", lineHeight: dashboardTypography.secondary.lineHeight }]}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.messageBody, { color: colors.textSecondary, fontSize: dashboardTypography.tertiary.fontSize, fontWeight: dashboardTypography.tertiary.fontWeight, lineHeight: dashboardTypography.tertiary.lineHeight }]}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const EmptyAlertsState = memo(function EmptyAlertsState() {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const reduceMotionEnabled = useReducedMotion();
  const sleepProgress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(sleepProgress);
    sleepProgress.value = 0;

    if (reduceMotionEnabled) {
      return () => {
        cancelAnimation(sleepProgress);
        sleepProgress.value = 0;
      };
    }

    sleepProgress.value = withRepeat(
      withTiming(1, { duration: sleepCycleDuration, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(sleepProgress);
      sleepProgress.value = 0;
    };
  }, [reduceMotionEnabled, sleepProgress]);

  const bellStyle = useAnimatedStyle(() => {
    const motion = interpolate(sleepProgress.value, [0, 0.14, 0.28, 1], [0, 1, 0, 0], Extrapolation.CLAMP);

    return {
      transform: [
        { rotate: `${interpolate(motion, [0, 0.5, 1], [-1.5, 1.5, -1.5])}deg` },
        { translateY: interpolate(motion, [0, 0.5, 1], [0, -1, 0]) },
      ],
    };
  });

  return (
    <View accessible accessibilityLabel="You're All Caught Up! No new notifications. We'll let you know when something needs your attention" style={styles.emptyState}>
      <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
        <Animated.View style={bellStyle}>
          <SymbolView fallback={null} name="bell" size={28} tintColor={colors.accent} type="hierarchical" />
        </Animated.View>
        {sleepZs.map((z, index) => (
          <SleepingZ color={colors.accent} index={index} key={index} progress={sleepProgress} z={z} />
        ))}
      </View>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.emptyTitle, { color: colors.textPrimary, fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "700", lineHeight: dashboardTypography.compactPageTitle.lineHeight }]}>
        You're All Caught Up!
      </Text>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.emptyBody, { color: colors.textSecondary, fontSize: dashboardTypography.secondary.fontSize, fontWeight: dashboardTypography.secondary.fontWeight, lineHeight: dashboardTypography.secondary.lineHeight }]}>
        No new notifications. We'll let you know when something needs your attention
      </Text>
    </View>
  );
});

const SleepingZ = memo(function SleepingZ({ color, index, progress, z }: { color: string; index: number; progress: SharedValue<number>; z: (typeof sleepZs)[number] }) {
  const animatedStyle = useAnimatedStyle(() => {
    const delay = 0.1 + index * 0.07;
    const travel = 0.29;
    const local = Math.max(0, Math.min(1, (progress.value - delay) / travel));
    const opacity = interpolate(local, [0, 0.14, 0.72, 1], [0, 1, 1, 0], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [
        { translateX: interpolate(local, [0, 1], [0, z.endX], Extrapolation.CLAMP) },
        { translateY: interpolate(local, [0, 1], [0, z.endY], Extrapolation.CLAMP) },
        { scale: z.scale * interpolate(local, [0, 1], [0.94, 1.06], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.Text style={[styles.sleepMark, { color, fontSize: z.fontSize, left: z.startX, top: z.startY }, animatedStyle]}>
      Z
    </Animated.Text>
  );
});

const styles = StyleSheet.create({
  cachedError: {
    letterSpacing: 0,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyBody: {
    letterSpacing: 0,
    maxWidth: 300,
    textAlign: "center",
  },
  emptyIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 64,
    justifyContent: "center",
    overflow: "visible",
    width: 64,
  },
  emptyState: {
    alignItems: "center",
    paddingBottom: dashboardSpacing.scale.lg,
    paddingHorizontal: dashboardSpacing.scale.md,
    paddingTop: dashboardSpacing.scale.md,
    rowGap: dashboardSpacing.scale.md,
  },
  emptyTitle: {
    letterSpacing: 0,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: dashboardSpacing.scale.sm,
    justifyContent: "space-between",
  },
  messageBlock: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.xs,
    paddingVertical: dashboardSpacing.scale.xs,
  },
  messageBody: {
    letterSpacing: 0,
  },
  messageCopy: {
    flex: 1,
    gap: dashboardSpacing.scale.xs,
    minWidth: 0,
  },
  messageIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  messageTitle: {
    letterSpacing: 0,
  },
  sleepMark: {
    fontWeight: "800",
    letterSpacing: 0,
    position: "absolute",
  },
  title: {
    flexShrink: 1,
    letterSpacing: 0,
  },
  viewAll: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.xs,
    justifyContent: "center",
    paddingLeft: dashboardSpacing.scale.md,
  },
  viewAllText: {
    letterSpacing: 0,
  },
});
