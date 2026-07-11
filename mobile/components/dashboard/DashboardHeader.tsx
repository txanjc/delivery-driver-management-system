import { StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";

import {
  dashboardLiquidGlass,
  dashboardMaxFontSizeMultipliers,
  dashboardSpacing,
  dashboardTypography,
  getDashboardColors,
  getSectionGap,
} from "@/components/dashboard/dashboardDesignSpec";
import { ProfileButton } from "@/components/shared/ProfileButton";

type DashboardHeaderProps = {
  driverName: string;
  greeting: string;
  roleLabel: string;
};

export function DashboardHeader({ driverName, greeting, roleLabel }: DashboardHeaderProps) {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const sectionGap = getSectionGap(width);
  const formattedGreeting = greeting.endsWith(",") ? greeting : `${greeting},`;
  const rolePillGlass = colorScheme === "dark" ? dashboardLiquidGlass.passivePurpleGlass.dark : dashboardLiquidGlass.passivePurpleGlass.light;

  return (
    <View accessibilityRole="header" style={[styles.container, { columnGap: sectionGap }]}>
      <View style={styles.copy}>
        <Text
          maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary}
          style={[
            styles.greeting,
            {
              color: colors.textSecondary,
              fontSize: dashboardTypography.secondary.fontSize,
              fontWeight: dashboardTypography.secondary.fontWeight,
              lineHeight: dashboardTypography.secondary.lineHeight,
            },
          ]}
        >
          {formattedGreeting}
        </Text>
        <Text
          maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.pageTitle}
          style={[
            styles.name,
            {
              color: colors.textPrimary,
              fontSize: dashboardTypography.largePageTitle.fontSize,
              fontWeight: dashboardTypography.largePageTitle.fontWeight,
              lineHeight: dashboardTypography.largePageTitle.lineHeight,
            },
          ]}
        >
          {driverName}
        </Text>
        <View style={[styles.rolePill, { backgroundColor: rolePillGlass.backgroundColor, borderColor: rolePillGlass.borderColor }]}>
          <Text
            maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption}
            style={[
              styles.role,
              {
                color: colors.accent,
                fontSize: dashboardTypography.caption.fontSize,
                fontWeight: "700",
                lineHeight: dashboardTypography.caption.lineHeight,
              },
            ]}
          >
            {roleLabel}
          </Text>
        </View>
      </View>
      <View style={styles.profileButtonSlot}>
        <ProfileButton dashboardIcon />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 0,
    rowGap: dashboardSpacing.scale.xxs,
  },
  greeting: {
    letterSpacing: 0,
  },
  name: {
    letterSpacing: 0,
  },
  profileButtonSlot: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  role: {
    letterSpacing: 0,
  },
  rolePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: dashboardSpacing.scale.xs,
    paddingHorizontal: dashboardSpacing.scale.md,
    paddingVertical: dashboardSpacing.scale.xs,
  },
});
