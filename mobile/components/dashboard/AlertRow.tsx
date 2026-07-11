import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SymbolView } from "expo-symbols";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
  getDashboardColors,
} from "@/components/dashboard/dashboardDesignSpec";
import { triggerButtonHaptic } from "@/utils/haptics";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

export type DashboardAlert = {
  iconName: SymbolName;
  id: string;
  isUnread: boolean;
  message: string | null;
  onPress: (() => void) | null;
  timestampLabel: string;
  title: string;
};

type AlertRowProps = {
  alert: DashboardAlert;
  showSeparator: boolean;
};

function getAccessibilityLabel(alert: DashboardAlert) {
  return [
    alert.isUnread ? "Unread alert." : null,
    alert.title,
    alert.message,
    alert.timestampLabel,
  ]
    .filter(Boolean)
    .join(" ");
}

export function AlertRow({ alert, showSeparator }: AlertRowProps) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const interactive = Boolean(alert.onPress);
  const rowStyle = [
    styles.row,
    showSeparator ? { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth } : null,
  ];
  const content = <AlertRowContent alert={alert} interactive={interactive} />;

  if (interactive) {
    return (
      <Pressable
        accessibilityLabel={getAccessibilityLabel(alert)}
        accessibilityRole="button"
        onPressIn={triggerButtonHaptic}
        onPress={alert.onPress ?? undefined}
        style={({ pressed }) => [...rowStyle, pressed ? { opacity: 0.72 } : null]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={getAccessibilityLabel(alert)} accessible style={rowStyle}>
      {content}
    </View>
  );
}

function AlertRowContent({ alert, interactive }: { alert: DashboardAlert; interactive: boolean }) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);

  return (
    <>
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted }]}>
        <SymbolView fallback={null} name={alert.iconName} size={16} tintColor={alert.isUnread ? colors.accent : colors.textSecondary} type="hierarchical" />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          {alert.isUnread ? <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
          <Text
            maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary}
            style={[
              styles.title,
              {
                color: colors.textPrimary,
                fontSize: dashboardTypography.secondary.fontSize,
                fontWeight: alert.isUnread ? "600" : "500",
                lineHeight: dashboardTypography.secondary.lineHeight,
              },
            ]}
          >
            {alert.title}
          </Text>
        </View>
        {alert.message ? (
          <Text
            maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary}
            style={[
              styles.message,
              {
                color: colors.textSecondary,
                fontSize: dashboardTypography.tertiary.fontSize,
                fontWeight: dashboardTypography.tertiary.fontWeight,
                lineHeight: dashboardTypography.tertiary.lineHeight,
              },
            ]}
          >
            {alert.message}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <Text
          maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption}
          style={[
            styles.timestamp,
            {
              color: colors.textTertiary,
              fontSize: dashboardTypography.caption.fontSize,
              fontWeight: dashboardTypography.caption.fontWeight,
              lineHeight: dashboardTypography.caption.lineHeight,
            },
          ]}
        >
          {alert.timestampLabel}
        </Text>
        {interactive ? <SymbolView fallback={null} name="chevron.right" size={14} tintColor={colors.textTertiary} type="hierarchical" /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: dashboardSpacing.scale.xs,
    minWidth: 0,
  },
  iconCircle: {
    alignItems: "center",
    borderRadius: dashboardRadii.iconCircle,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  message: {
    letterSpacing: 0,
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    minHeight: 44,
    paddingVertical: dashboardSpacing.scale.sm,
  },
  timestamp: {
    letterSpacing: 0,
    textAlign: "right",
  },
  title: {
    flex: 1,
    letterSpacing: 0,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
    minWidth: 0,
  },
  trailing: {
    alignItems: "flex-end",
    gap: dashboardSpacing.scale.xs,
    minWidth: 54,
  },
  unreadDot: {
    borderRadius: dashboardRadii.iconCircle,
    height: 8,
    width: 8,
  },
});
