import { StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";

import { DeliveryMetric } from "@/components/dashboard/DeliveryMetric";
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

export type DeliverySummaryCounts = {
  assigned: number | null;
  completed: number | null;
  inProgress: number | null;
};

type DeliverySummaryCardProps = {
  counts: DeliverySummaryCounts;
  selectedDayLabel: string;
};

export function DeliverySummaryCard({ counts, selectedDayLabel }: DeliverySummaryCardProps) {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const cardPadding = getCardPadding(width);
  const sectionGap = getSectionGap(width);
  const assignedIconBackground = colorScheme === "dark" ? "rgba(110, 168, 255, 0.16)" : "rgba(37, 99, 235, 0.1)";
  const pendingIconBackground = colorScheme === "dark" ? "rgba(251, 191, 36, 0.16)" : "rgba(183, 121, 31, 0.11)";
  const completedIconBackground = colorScheme === "dark" ? "rgba(74, 222, 128, 0.16)" : "rgba(5, 150, 105, 0.1)";

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
        <Text
          maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle}
          style={[
            styles.title,
            {
              color: colors.textPrimary,
              fontSize: dashboardTypography.compactPageTitle.fontSize,
              fontWeight: dashboardTypography.compactPageTitle.fontWeight,
              lineHeight: dashboardTypography.compactPageTitle.lineHeight,
            },
          ]}
        >
          Delivery Summary
        </Text>
        <View style={[styles.todayPill, { backgroundColor: colors.surfaceMuted }]}>
          <Text
            maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary}
            style={[
              styles.todayText,
              {
                color: colors.textSecondary,
                fontSize: dashboardTypography.secondary.fontSize,
                fontWeight: dashboardTypography.secondary.fontWeight,
                lineHeight: dashboardTypography.secondary.lineHeight,
              },
            ]}
          >
            {selectedDayLabel}
          </Text>
        </View>
      </View>
      <View style={[styles.metrics, { columnGap: sectionGap, rowGap: sectionGap }]}>
        <DeliveryMetric accessibilityLabel={counts.assigned === null ? "Loading assigned deliveries" : `${counts.assigned} assigned deliveries`} count={counts.assigned} iconBackgroundColor={assignedIconBackground} iconColor={colors.accent} iconName="shippingbox" label="Assigned Deliveries" labelColor={colors.textSecondary} />
        <DeliveryMetric accessibilityLabel={counts.inProgress === null ? "Loading deliveries in progress" : `${counts.inProgress} deliveries in progress`} count={counts.inProgress} iconBackgroundColor={pendingIconBackground} iconColor={colors.warning} iconName="clock" label="In Progress" labelColor={colors.textSecondary} />
        <DeliveryMetric accessibilityLabel={counts.completed === null ? "Loading completed deliveries" : `${counts.completed} completed deliveries`} count={counts.completed} iconBackgroundColor={completedIconBackground} iconColor={colors.success} iconName="checkmark.circle" label="Completed Deliveries" labelColor={colors.textSecondary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  title: {
    flexShrink: 1,
    letterSpacing: 0,
  },
  todayPill: {
    borderRadius: 999,
    paddingHorizontal: dashboardSpacing.scale.md,
    paddingVertical: dashboardSpacing.scale.sm,
  },
  todayText: {
    letterSpacing: 0,
  },
});
