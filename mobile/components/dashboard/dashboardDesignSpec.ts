import { StyleSheet } from "react-native";
import type { ColorSchemeName, ViewStyle } from "react-native";

import { colors as sharedColors, spacing as sharedSpacing } from "@/theme/shared";

export type DashboardBreakpoint = "compact" | "standard" | "large";

export const dashboardBreakpoints = {
  compactMaxExclusive: 390,
  standardMinInclusive: 390,
  standardMaxExclusive: 430,
  largeMinInclusive: 430,
} as const;

export function getDashboardBreakpoint(width: number): DashboardBreakpoint {
  if (width < dashboardBreakpoints.compactMaxExclusive) {
    return "compact";
  }

  if (width < dashboardBreakpoints.standardMaxExclusive) {
    return "standard";
  }

  return "large";
}

export function getResponsiveValue<T>(width: number, values: Record<DashboardBreakpoint, T>): T {
  return values[getDashboardBreakpoint(width)];
}

export const dashboardSpacing = {
  scale: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: sharedSpacing.gap,
    xl: sharedSpacing.screen,
    xxl: 24,
    xxxl: 32,
  },
  contentMaxWidth: 560,
} as const;

export const dashboardTypography = {
  largePageTitle: { fontSize: 34, fontWeight: "700", lineHeight: 41 },
  compactPageTitle: { fontSize: 17, fontWeight: "600", lineHeight: 22 },
  body: { fontSize: 17, fontWeight: "400", lineHeight: 24 },
  listTitle: { fontSize: 17, fontWeight: "500", lineHeight: 23 },
  control: { fontSize: 17, fontWeight: "600", lineHeight: 22 },
  secondary: { fontSize: 15, fontWeight: "400", lineHeight: 21 },
  tertiary: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  caption: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
  tabLabel: { fontSize: 11, fontWeight: "500", lineHeight: 13 },
  metric: { fontSize: 28, fontWeight: "700", lineHeight: 34 },
} as const;

export const dashboardMaxFontSizeMultipliers = {
  pageTitle: 1.3,
  compactTitle: 1.25,
  body: 1.35,
  secondary: 1.3,
  tertiary: 1.25,
  caption: 1.2,
  control: 1.2,
  metric: 1.15,
  tabLabel: 1.1,
} as const;

export const dashboardRadii = {
  card: {
    compact: 18,
    standard: 20,
    large: 22,
  },
  compactCard: {
    compact: 12,
    standard: 14,
    large: 16,
  },
  button: {
    compact: 14,
    standard: 16,
    large: 18,
  },
  iconCircle: 999,
  avatar: 999,
} as const;

export const dashboardSizes = {
  routePreviewAspectRatio: 2.45,
  touchTarget: {
    compact: 44,
    standard: 44,
    large: 48,
  },
  buttonHeight: {
    compact: 44,
    standard: 48,
    large: 50,
  },
  icon: {
    inline: {
      compact: 16,
      standard: 18,
      large: 20,
    },
    circle: {
      compact: 36,
      standard: 40,
      large: 44,
    },
  },
  avatar: {
    compact: 44,
    standard: 46,
    large: 48,
  },
} as const;

export const dashboardColors = {
  light: {
    background: sharedColors.background,
    dashboardBackground: sharedColors.background,
    groupedBackground: "#F2F4F8",
    surface: sharedColors.surface,
    surfaceElevated: "#FFFFFF",
    surfaceElevatedFallback: "#FFFFFF",
    surfaceHighlight: "rgba(255, 255, 255, 0.72)",
    surfaceMuted: "#F8FAFC",
    textPrimary: sharedColors.text,
    textSecondary: sharedColors.muted,
    textTertiary: "#8A96A8",
    divider: sharedColors.border,
    subtleBorder: "rgba(15, 23, 42, 0.1)",
    accent: sharedColors.primary,
    accentPressed: sharedColors.primaryDark,
    success: sharedColors.success,
    warning: "#B7791F",
    danger: sharedColors.danger,
    glassFallback: "rgba(255, 255, 255, 0.78)",
    scrollEdgeBlurTint: "light",
    scrollEdgeTintGradientColors: [
      "rgba(248, 250, 252, 0.92)",
      "rgba(248, 250, 252, 0.76)",
      "rgba(248, 250, 252, 0.34)",
      "rgba(248, 250, 252, 0)",
    ],
    refreshBackground: sharedColors.surface,
    refreshTint: sharedColors.primary,
  },
  dark: {
    background: "#000000",
    dashboardBackground: "#000000",
    groupedBackground: "#000000",
    surface: "rgba(18, 18, 20, 0.72)",
    surfaceElevated: "rgba(28, 28, 30, 0.54)",
    surfaceElevatedFallback: "#1C1C1E",
    surfaceHighlight: "rgba(255, 255, 255, 0.08)",
    surfaceMuted: "rgba(255, 255, 255, 0.06)",
    textPrimary: "#F5F5F7",
    textSecondary: "rgba(235, 235, 245, 0.72)",
    textTertiary: "rgba(235, 235, 245, 0.52)",
    divider: "rgba(255, 255, 255, 0.08)",
    subtleBorder: "rgba(255, 255, 255, 0.09)",
    accent: sharedColors.primary,
    accentPressed: sharedColors.primaryDark,
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#F87171",
    glassFallback: "rgba(28, 28, 30, 0.72)",
    scrollEdgeBlurTint: "dark",
    scrollEdgeTintGradientColors: [
      "rgba(0, 0, 0, 0.94)",
      "rgba(0, 0, 0, 0.78)",
      "rgba(0, 0, 0, 0.36)",
      "rgba(0, 0, 0, 0)",
    ],
    refreshBackground: "rgba(28, 28, 30, 0.96)",
    refreshTint: sharedColors.primary,
  },
} as const;

export const dashboardMutedStatusColors = {
  pending: "#64748B",
  assigned: "#64748B",
  inProgress: "#475569",
  completed: "#4B7F67",
  delayed: "#9A6A1F",
  cancelled: "#8A5A5A",
  unavailable: "#7C8798",
} as const;

export const dashboardShadows = {
  elevatedCard: {
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  } satisfies ViewStyle,
  subtleCard: {
    elevation: 1,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  } satisfies ViewStyle,
  none: {
    elevation: 0,
    shadowOpacity: 0,
  } satisfies ViewStyle,
} as const;

export const dashboardElevation = {
  contentCard: 1,
  floatingControl: 3,
  modalControl: 4,
} as const;

export const dashboardAnimation = {
  fast: 120,
  standard: 180,
  slow: 240,
} as const;

export const dashboardScrollEdge = {
  blurIntensity: 34,
  fadeExtension: {
    compact: 24,
    standard: 26,
    large: 28,
  },
  maskColors: [
    "rgba(0,0,0,1)",
    "rgba(0,0,0,1)",
    "rgba(0,0,0,0.65)",
    "rgba(0,0,0,0)",
  ],
  maskLocations: [0, 0.42, 0.72, 1],
  overlayZIndex: 2,
  tintLocations: [0, 0.44, 0.76, 1],
} as const;

export const dashboardLiquidGlass = {
  accent: sharedColors.primary,
  capsuleRadiusFromHeight: 0.5,
  iconLabelGap: dashboardSpacing.scale.sm,
  primaryAccent: {
    fillOpacity: 0.85,
  },
  secondaryAccent: {
    fillOpacity: 0.52,
  },
  neutralAccent: {
    fillOpacity: 0.12,
  },
  passivePurpleGlass: {
    light: {
      backgroundColor: "rgba(109, 74, 255, 0.08)",
      borderColor: "rgba(109, 74, 255, 0.24)",
      highlightColor: "rgba(255, 255, 255, 0.34)",
      labelColor: "#6B6680",
      textColor: sharedColors.text,
      tintColor: "rgba(109, 74, 255, 0.16)",
    },
    dark: {
      backgroundColor: "rgba(109, 74, 255, 0.14)",
      borderColor: "rgba(167, 139, 250, 0.3)",
      highlightColor: "rgba(255, 255, 255, 0.1)",
      labelColor: "rgba(235, 235, 245, 0.68)",
      textColor: "#F5F5F7",
      tintColor: "rgba(109, 74, 255, 0.2)",
    },
  },
} as const;

export function getCapsuleRadiusFromHeight(height: number): number {
  return height * dashboardLiquidGlass.capsuleRadiusFromHeight;
}

export function getScreenHorizontalPadding(width: number): number {
  return getResponsiveValue(width, {
    compact: 16,
    standard: sharedSpacing.screen,
    large: 24,
  });
}

export function getSectionGap(width: number): number {
  return getResponsiveValue(width, {
    compact: 14,
    standard: 16,
    large: 20,
  });
}

export function getContentTopSpacing(width: number): number {
  return getResponsiveValue(width, {
    compact: 18,
    standard: 22,
    large: 26,
  });
}

export function getCardPadding(width: number): number {
  return getResponsiveValue(width, {
    compact: 14,
    standard: 16,
    large: 18,
  });
}

export function getCompactCardPadding(width: number): number {
  return getResponsiveValue(width, {
    compact: 10,
    standard: 12,
    large: 14,
  });
}

export function getCardRadius(width: number): number {
  return getResponsiveValue(width, dashboardRadii.card);
}

export function getCompactCardRadius(width: number): number {
  return getResponsiveValue(width, dashboardRadii.compactCard);
}

export function getButtonRadius(width: number): number {
  return getResponsiveValue(width, dashboardRadii.button);
}

export function getInlineIconSize(width: number): number {
  return getResponsiveValue(width, dashboardSizes.icon.inline);
}

export function getIconCircleSize(width: number): number {
  return getResponsiveValue(width, dashboardSizes.icon.circle);
}

export function getAvatarSize(width: number): number {
  return getResponsiveValue(width, dashboardSizes.avatar);
}

export function getButtonHeight(width: number): number {
  return getResponsiveValue(width, dashboardSizes.buttonHeight);
}

export function getMinimumTouchTarget(width: number): number {
  return getResponsiveValue(width, dashboardSizes.touchTarget);
}

export function getContentMaxWidth(width: number): number | undefined {
  return width >= dashboardSpacing.contentMaxWidth ? dashboardSpacing.contentMaxWidth : undefined;
}

export function getSafeAreaTopSpacing(topInset: number): number {
  return topInset;
}

export function getFloatingTabBarClearance(width: number): number {
  return getResponsiveValue(width, {
    compact: 60,
    standard: 62,
    large: 65,
  });
}

export function getScrollContentBottomPadding(width: number, bottomInset: number): number {
  return bottomInset + getFloatingTabBarClearance(width);
}

export function getScrollEdgeFadeExtension(width: number): number {
  return getResponsiveValue(width, dashboardScrollEdge.fadeExtension);
}

export function getDashboardColors(colorScheme: ColorSchemeName) {
  return colorScheme === "dark" ? dashboardColors.dark : dashboardColors.light;
}

export const dashboardDesignSpec = {
  animation: dashboardAnimation,
  breakpoints: dashboardBreakpoints,
  colors: dashboardColors,
  elevation: dashboardElevation,
  maxFontSizeMultipliers: dashboardMaxFontSizeMultipliers,
  liquidGlass: dashboardLiquidGlass,
  mutedStatusColors: dashboardMutedStatusColors,
  radii: dashboardRadii,
  shadows: dashboardShadows,
  sizes: dashboardSizes,
  spacing: dashboardSpacing,
  scrollEdge: dashboardScrollEdge,
  surfaces: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  typography: dashboardTypography,
} as const;
