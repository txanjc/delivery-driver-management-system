import { StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { DashboardGlassSurface } from "@/components/dashboard/DashboardGlassSurface";
import { GlassActionButton } from "@/components/shared/GlassActionButton";
import {
  dashboardLiquidGlass,
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
  getSectionGap,
} from "@/components/dashboard/dashboardDesignSpec";

export type ScheduleContext = "active" | "upcoming" | "today" | "conflict" | "completed" | "cancelled" | "empty" | "unavailable";
export type ScheduleStatus = "scheduled" | "completed" | "cancelled" | "conflict" | "unavailable";

export type ScheduleOverviewDetails = {
  context: ScheduleContext;
  dateLabel: string | null;
  endTimeLabel: string | null;
  notes: string | null;
  shiftTitle: string;
  startTimeLabel: string | null;
  status: ScheduleStatus;
  vehiclePrimary: string;
  vehicleSecondary: string | null;
};

type ScheduleOverviewCardProps = {
  details: ScheduleOverviewDetails | null;
  loading: boolean;
  onViewSchedule: () => void;
  scheduleUnavailable: boolean;
  vehicleUnavailable: boolean;
};

type BadgeTone = "accent" | "neutral" | "warning" | "danger" | "success";

function getContextLabel(context: ScheduleContext) {
  switch (context) {
    case "active":
      return "Active Shift";
    case "upcoming":
      return "Upcoming Shift";
    case "today":
      return "Today's Shift";
    case "conflict":
      return "Conflict";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "unavailable":
      return "Schedule unavailable";
    case "empty":
      return "No upcoming shift";
  }
}

function getStatusLabel(status: ScheduleStatus) {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "conflict":
      return "Conflict";
    case "unavailable":
      return "Unavailable";
  }
}

function getToneForContext(context: ScheduleContext): BadgeTone {
  if (context === "active" || context === "upcoming" || context === "today") return "accent";
  if (context === "conflict") return "warning";
  if (context === "cancelled" || context === "unavailable") return "danger";
  if (context === "completed") return "success";
  return "neutral";
}

function getToneColor(tone: BadgeTone, colors: ReturnType<typeof getDashboardColors>) {
  if (tone === "accent") return colors.accent;
  if (tone === "warning") return colors.warning;
  if (tone === "danger") return colors.danger;
  if (tone === "success") return colors.success;
  return colors.textSecondary;
}

function getAccessibilitySummary(details: ScheduleOverviewDetails | null, loading: boolean, scheduleUnavailable: boolean) {
  if (loading && !details) return "Schedule Overview, loading schedule.";
  if (scheduleUnavailable) return "Schedule Overview, schedule unavailable.";
  if (!details) return "Schedule Overview, no upcoming shift. Your next assigned shift will appear here.";

  const context = getContextLabel(details.context);
  const status = getStatusLabel(details.status);
  const time = details.startTimeLabel && details.endTimeLabel ? `${details.startTimeLabel} to ${details.endTimeLabel}` : "shift time unavailable";
  const date = details.dateLabel ? `, ${details.dateLabel}` : "";
  const vehicle = details.vehiclePrimary ? `, ${details.vehiclePrimary}` : "";

  return `Schedule Overview, ${context}, ${details.shiftTitle}${date}, ${time}${vehicle}, ${status}.`;
}

export function ScheduleOverviewCard({ details, loading, onViewSchedule, scheduleUnavailable, vehicleUnavailable }: ScheduleOverviewCardProps) {
  const colorScheme = useColorScheme();
  const { fontScale, width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const cardPadding = getCardPadding(width);
  const sectionGap = getSectionGap(width);
  const buttonStacked = width < 390 || fontScale > 1.18;
  const showUnavailable = scheduleUnavailable && !details;
  const context = showUnavailable ? "unavailable" : details?.context ?? "empty";
  const contextLabel = getContextLabel(context);
  const tone = getToneForContext(context);
  const toneColor = getToneColor(tone, colors);
  const title = showUnavailable ? "Schedule unavailable" : details?.shiftTitle ?? "No upcoming shift";
  const message = showUnavailable ? "Your schedule could not be refreshed." : details ? details.dateLabel : "Your next assigned shift will appear here.";
  const statusLabel = details ? getStatusLabel(details.status) : showUnavailable ? "Unavailable" : null;
  const timeGlass = colorScheme === "dark" ? dashboardLiquidGlass.passivePurpleGlass.dark : dashboardLiquidGlass.passivePurpleGlass.light;

  return (
    <View
      accessible
      accessibilityLabel={getAccessibilitySummary(details, loading, showUnavailable)}
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
          Schedule Overview
        </Text>
        <StatusBadge color={toneColor} label={contextLabel} />
      </View>

      <View style={styles.identity}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.body} style={[styles.shiftTitle, { color: colors.textPrimary, fontSize: dashboardTypography.body.fontSize, fontWeight: "600", lineHeight: dashboardTypography.body.lineHeight }]}>
          {loading && !details ? "Loading schedule..." : title}
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.secondary, { color: colors.textSecondary, fontSize: dashboardTypography.secondary.fontSize, fontWeight: dashboardTypography.secondary.fontWeight, lineHeight: dashboardTypography.secondary.lineHeight }]}>
          {loading && !details ? "Checking your assigned shift." : message}
        </Text>
      </View>

      {details?.startTimeLabel && details.endTimeLabel ? (
        <DashboardGlassSurface
          accessibilityLabel={`Shift time, starts ${details.startTimeLabel}, ends ${details.endTimeLabel}`}
          fallbackColor={timeGlass.backgroundColor}
          glassEffectStyle="regular"
          style={[styles.timeRow, buttonStacked ? styles.timeRowStacked : null, { backgroundColor: timeGlass.backgroundColor, borderColor: timeGlass.borderColor }]}
          tintColor={timeGlass.tintColor}
        >
          <View pointerEvents="none" style={[styles.timeRowHighlight, { backgroundColor: timeGlass.highlightColor }]} />
          <TimeBlock iconName="play.circle" label="Start" value={details.startTimeLabel} />
          <View style={[styles.timeDivider, buttonStacked ? styles.timeDividerStacked : null, { backgroundColor: timeGlass.borderColor }]} />
          <TimeBlock iconName="stop.circle" label="End" value={details.endTimeLabel} />
        </DashboardGlassSurface>
      ) : null}

      {details ? (
        <View style={styles.infoList}>
          <InfoRow iconName="car" label="Vehicle" primary={vehicleUnavailable ? "Vehicle unavailable" : details.vehiclePrimary} secondary={vehicleUnavailable ? null : details.vehicleSecondary} />
          <InfoRow iconName="checkmark.circle" label="Status" primary={statusLabel ?? "Status unavailable"} secondary={details.notes} />
        </View>
      ) : null}

      <GlassActionButton
        accessibilityLabel="Open full schedule"
        accessibilityRole="button"
        capsule
        iconName="calendar"
        iconPosition="left"
        label="View Schedule"
        labelStyle={styles.actionText}
        onPress={onViewSchedule}
        radius={getButtonRadius(width)}
        style={[
          styles.action,
          {
            minHeight: getButtonHeight(width),
          },
        ]}
        variant="primaryAccent"
      />
    </View>
  );
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);

  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceMuted, borderColor: colors.subtleBorder }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.badgeText, { color: colors.textPrimary, fontSize: dashboardTypography.caption.fontSize, fontWeight: dashboardTypography.caption.fontWeight, lineHeight: dashboardTypography.caption.lineHeight }]}>
        {label}
      </Text>
    </View>
  );
}

function TimeBlock({ iconName, label, value }: { iconName: "play.circle" | "stop.circle"; label: string; value: string }) {
  const colorScheme = useColorScheme();
  const timeGlass = colorScheme === "dark" ? dashboardLiquidGlass.passivePurpleGlass.dark : dashboardLiquidGlass.passivePurpleGlass.light;

  return (
    <View style={styles.timeBlock}>
      <SymbolView fallback={<Text style={{ color: timeGlass.labelColor }}>+</Text>} name={iconName} size={dashboardTypography.compactPageTitle.lineHeight} tintColor={timeGlass.labelColor} type="hierarchical" />
      <View style={styles.timeCopy}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.timeLabel, { color: timeGlass.labelColor, fontSize: dashboardTypography.tertiary.fontSize, fontWeight: "600", lineHeight: dashboardTypography.tertiary.lineHeight }]}>
          {label}
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.timeValue, { color: timeGlass.textColor, fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: dashboardTypography.compactPageTitle.fontWeight, lineHeight: dashboardTypography.compactPageTitle.lineHeight }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function InfoRow({ iconName, label, primary, secondary }: { iconName: "car" | "checkmark.circle"; label: string; primary: string; secondary: string | null }) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);

  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.surfaceMuted }]}>
        <SymbolView fallback={<Text style={{ color: colors.textSecondary }}>+</Text>} name={iconName} size={15} tintColor={colors.textSecondary} type="hierarchical" />
      </View>
      <View style={styles.infoCopy}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.infoLabel, { color: colors.textSecondary, fontSize: dashboardTypography.tertiary.fontSize, fontWeight: dashboardTypography.tertiary.fontWeight, lineHeight: dashboardTypography.tertiary.lineHeight }]}>
          {label}
        </Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.infoPrimary, { color: colors.textPrimary, fontSize: dashboardTypography.secondary.fontSize, fontWeight: "600", lineHeight: dashboardTypography.secondary.lineHeight }]}>
          {primary}
        </Text>
        {secondary ? (
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.infoSecondary, { color: colors.textSecondary, fontSize: dashboardTypography.tertiary.fontSize, fontWeight: dashboardTypography.tertiary.fontWeight, lineHeight: dashboardTypography.tertiary.lineHeight }]}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
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
  actionContent: {
    justifyContent: "space-between",
    width: "100%",
  },
  badge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
    paddingHorizontal: dashboardSpacing.scale.md,
    paddingVertical: dashboardSpacing.scale.xs,
  },
  badgeDot: {
    borderRadius: dashboardRadii.iconCircle,
    height: 7,
    width: 7,
  },
  badgeText: {
    letterSpacing: 0,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: dashboardSpacing.scale.sm,
    justifyContent: "space-between",
  },
  identity: {
    gap: dashboardSpacing.scale.xs,
  },
  infoCopy: {
    flex: 1,
    gap: dashboardSpacing.scale.xs,
    minWidth: 0,
  },
  infoIcon: {
    alignItems: "center",
    borderRadius: dashboardRadii.iconCircle,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  infoLabel: {
    letterSpacing: 0,
  },
  infoList: {
    gap: dashboardSpacing.scale.md,
  },
  infoPrimary: {
    letterSpacing: 0,
  },
  infoRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
  },
  infoSecondary: {
    letterSpacing: 0,
  },
  secondary: {
    letterSpacing: 0,
  },
  shiftTitle: {
    letterSpacing: 0,
  },
  timeBlock: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
    minWidth: 0,
  },
  timeCopy: {
    flex: 1,
    gap: dashboardSpacing.scale.xs,
    minWidth: 0,
  },
  timeDivider: {
    alignSelf: "stretch",
    width: StyleSheet.hairlineWidth,
  },
  timeDividerStacked: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  timeLabel: {
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  timeRow: {
    borderRadius: dashboardRadii.compactCard.standard,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    overflow: "hidden",
    padding: dashboardSpacing.scale.md,
  },
  timeRowHighlight: {
    height: StyleSheet.hairlineWidth,
    left: dashboardSpacing.scale.md,
    position: "absolute",
    right: dashboardSpacing.scale.md,
    top: 0,
  },
  timeRowStacked: {
    flexDirection: "column",
  },
  timeValue: {
    letterSpacing: 0,
  },
  title: {
    flexShrink: 1,
    letterSpacing: 0,
  },
});
