import type { ComponentProps } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AccessibilityRole, AccessibilityState, StyleProp, TextStyle, ViewStyle } from "react-native";
import { SymbolView } from "expo-symbols";

import { dashboardLiquidGlass, dashboardMaxFontSizeMultipliers } from "@/components/dashboard/dashboardDesignSpec";
import { colors } from "@/theme/shared";
import { triggerButtonHaptic } from "@/utils/haptics";

export type GlassActionButtonVariant = "primaryAccent" | "secondaryNeutral" | "sectionAccent";

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

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    b: value & 255,
    g: (value >> 8) & 255,
    r: (value >> 16) & 255,
  };
}

function alpha(hex: string, opacity: number) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function getVariantStyles(variant: GlassActionButtonVariant, disabled: boolean) {
  if (variant === "primaryAccent") {
    return {
      backgroundColor: disabled ? alpha(colors.primary, 0.26) : alpha(colors.primary, 0.85),
      borderColor: disabled ? alpha(colors.primary, 0.32) : alpha(colors.primary, 0.86),
      iconColor: "#ffffff",
      pressedBackgroundColor: alpha(colors.primaryDark, 0.3),
      pressedBorderColor: alpha(colors.primaryDark, 0.58),
      textColor: "#ffffff",
    };
  }

  if (variant === "sectionAccent") {
    const fillOpacity = dashboardLiquidGlass.secondaryAccent.fillOpacity;

    return {
      backgroundColor: disabled ? alpha(colors.primary, 0.18) : alpha(colors.primary, fillOpacity),
      borderColor: disabled ? alpha(colors.primary, 0.24) : alpha(colors.primary, 0.56),
      iconColor: "#ffffff",
      pressedBackgroundColor: alpha(colors.primaryDark, 0.46),
      pressedBorderColor: alpha(colors.primaryDark, 0.58),
      textColor: "#ffffff",
    };
  }

  return {
    backgroundColor: alpha(colors.primary, 0.12),
    borderColor: alpha(colors.primary, 0.34),
    iconColor: colors.primaryDark,
    pressedBackgroundColor: alpha(colors.primary, 0.08),
    pressedBorderColor: alpha(colors.primary, 0.24),
    textColor: colors.primaryDark,
  };
}

export function GlassActionButton({ accessibilityLabel, capsule = false, contentStyle, disabled = false, iconName, iconPosition = "right", iconSize = 16, label, labelStyle, onPress, radius, style, trailingIconName, trailingIconSize = 14, variant = "secondaryNeutral" }: GlassActionButtonProps) {
  const isDisabled = Boolean(disabled);
  const variantStyles = getVariantStyles(variant, isDisabled);
  const [height, setHeight] = useState<number | null>(null);
  const visualRadius = capsule && height ? height * dashboardLiquidGlass.capsuleRadiusFromHeight : radius;
  const handlePress = isDisabled
    ? undefined
    : () => {
        triggerButtonHaptic();
        onPress?.();
      };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={isDisabled ? { disabled: true } : undefined}
      disabled={isDisabled}
      onLayout={(event) => {
        const nextHeight = event.nativeEvent.layout.height;
        setHeight((current) => (current && Math.abs(current - nextHeight) < 0.5 ? current : nextHeight));
      }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        style,
        {
          backgroundColor: pressed && !isDisabled ? variantStyles.pressedBackgroundColor : variantStyles.backgroundColor,
          borderColor: pressed && !isDisabled ? variantStyles.pressedBorderColor : variantStyles.borderColor,
          borderRadius: visualRadius,
          opacity: isDisabled ? 0.62 : 1,
        },
      ]}
    >
      <View style={[styles.content, trailingIconName ? styles.contentWithTrailing : null, contentStyle]}>
        <View style={styles.labelGroup}>
          {iconName && iconPosition === "left" ? <SymbolView fallback={null} name={iconName} size={iconSize} tintColor={variantStyles.iconColor} type="hierarchical" /> : null}
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={[styles.label, { color: variantStyles.textColor }, labelStyle]}>
            {label}
          </Text>
          {iconName && iconPosition === "right" ? <SymbolView fallback={null} name={iconName} size={iconSize} tintColor={variantStyles.iconColor} type="hierarchical" /> : null}
        </View>
        {trailingIconName ? <SymbolView fallback={null} name={trailingIconName} size={trailingIconSize} tintColor={variantStyles.iconColor} type="hierarchical" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
  },
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
