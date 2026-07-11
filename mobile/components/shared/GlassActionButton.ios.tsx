import type { ComponentProps } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import type { AccessibilityRole, AccessibilityState, StyleProp, TextStyle, ViewStyle } from "react-native";
import { SymbolView } from "expo-symbols";

import { dashboardLiquidGlass, dashboardMaxFontSizeMultipliers } from "@/components/dashboard/dashboardDesignSpec";
import { LiquidGlassButton } from "@/components/shared/LiquidGlassButton";
import type { LiquidGlassButtonVariant } from "@/components/shared/LiquidGlassButton";
import { colors } from "@/theme/shared";

export type GlassActionButtonVariant = LiquidGlassButtonVariant;

export type GlassActionButtonProps = {
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  capsule?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  disabled?: boolean | null;
  iconName?: ComponentProps<typeof SymbolView>["name"];
  iconPosition?: "left" | "right";
  iconSize?: number;
  label: string;
  labelStyle?: StyleProp<TextStyle>;
  onPress?: () => void;
  radius: number;
  style?: StyleProp<ViewStyle>;
  trailingIconName?: ComponentProps<typeof SymbolView>["name"];
  trailingIconSize?: number;
  variant?: GlassActionButtonVariant;
};

function getContentColors(variant: GlassActionButtonVariant, dark: boolean) {
  if (variant === "primaryAccent") {
    return {
      iconColor: "#ffffff",
      textColor: "#ffffff",
    };
  }

  if (variant === "sectionAccent") {
    return {
      iconColor: "#ffffff",
      textColor: "#ffffff",
    };
  }

  return {
    iconColor: dark ? "#F5F5F7" : colors.primaryDark,
    textColor: dark ? "#F5F5F7" : colors.primaryDark,
  };
}

export function GlassActionButton({
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  capsule = false,
  contentStyle,
  disabled = false,
  iconName,
  iconPosition = "right",
  iconSize = 16,
  label,
  labelStyle,
  onPress,
  radius,
  style,
  trailingIconName,
  trailingIconSize = 14,
  variant = "secondaryNeutral",
}: GlassActionButtonProps) {
  const dark = useColorScheme() === "dark";
  const isDisabled = Boolean(disabled);
  const contentColors = getContentColors(variant, dark);

  return (
    <LiquidGlassButton
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState ?? (isDisabled ? { disabled: true } : undefined)}
      accentColor={colors.primary}
      capsule={capsule}
      disabled={isDisabled}
      onPress={isDisabled ? undefined : onPress}
      radius={radius}
      style={style}
      variant={variant}
    >
      <View pointerEvents="none" style={[styles.content, trailingIconName ? styles.contentWithTrailing : null, contentStyle]}>
        <View style={styles.labelGroup}>
          {iconName && iconPosition === "left" ? <SymbolView fallback={null} name={iconName} size={iconSize} tintColor={contentColors.iconColor} type="hierarchical" /> : null}
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={[styles.label, { color: contentColors.textColor }, labelStyle]}>
            {label}
          </Text>
          {iconName && iconPosition === "right" ? <SymbolView fallback={null} name={iconName} size={iconSize} tintColor={contentColors.iconColor} type="hierarchical" /> : null}
        </View>
        {trailingIconName ? <SymbolView fallback={null} name={trailingIconName} size={trailingIconSize} tintColor={contentColors.iconColor} type="hierarchical" /> : null}
      </View>
    </LiquidGlassButton>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  contentWithTrailing: {
    justifyContent: "space-between",
    width: "100%",
  },
  labelGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardLiquidGlass.iconLabelGap,
    minWidth: 0,
  },
  label: {
    letterSpacing: 0,
  },
});
