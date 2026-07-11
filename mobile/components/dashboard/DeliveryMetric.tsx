import type { ComponentProps } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SymbolView } from "expo-symbols";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
  getIconCircleSize,
  getInlineIconSize,
} from "@/components/dashboard/dashboardDesignSpec";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

type DeliveryMetricProps = {
  accessibilityLabel?: string;
  count: number | null;
  iconBackgroundColor: string;
  iconColor: string;
  iconName: SymbolName;
  label: string;
  labelColor: string;
};

function formatAccessibleCount(count: number | null) {
  return count === null ? "Loading" : String(count);
}

export function DeliveryMetric({ accessibilityLabel, count, iconBackgroundColor, iconColor, iconName, label, labelColor }: DeliveryMetricProps) {
  const { width } = useWindowDimensions();
  const iconCircleSize = getIconCircleSize(width);

  return (
    <View accessible accessibilityLabel={accessibilityLabel ?? `${formatAccessibleCount(count)} ${label.toLowerCase()}`} style={styles.metric}>
      <View style={[styles.iconCircle, { backgroundColor: iconBackgroundColor, height: iconCircleSize, width: iconCircleSize }]}>
        <SymbolView
          fallback={
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.iconFallback, { color: iconColor }]}>
              +
            </Text>
          }
          name={iconName}
          size={getInlineIconSize(width)}
          tintColor={iconColor}
          type="hierarchical"
        />
      </View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.metric}
        style={[
          styles.count,
          {
            color: iconColor,
            fontSize: dashboardTypography.metric.fontSize,
            fontWeight: dashboardTypography.metric.fontWeight,
            lineHeight: dashboardTypography.metric.lineHeight,
          },
        ]}
      >
        {count === null ? "-" : count}
      </Text>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary}
        style={[
          styles.label,
          {
            color: labelColor,
            fontSize: dashboardTypography.secondary.fontSize,
            fontWeight: dashboardTypography.secondary.fontWeight,
            lineHeight: dashboardTypography.secondary.lineHeight,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  count: {
    letterSpacing: 0,
    marginTop: dashboardSpacing.scale.sm,
    textAlign: "center",
  },
  iconCircle: {
    alignItems: "center",
    borderRadius: dashboardRadii.iconCircle,
    justifyContent: "center",
  },
  iconFallback: {
    fontWeight: "700",
  },
  label: {
    letterSpacing: 0,
    marginTop: dashboardSpacing.scale.xs,
    textAlign: "center",
  },
  metric: {
    alignItems: "center",
    flexBasis: 96,
    flexGrow: 1,
    minWidth: 92,
  },
});
