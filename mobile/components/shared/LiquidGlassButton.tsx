import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { AccessibilityRole, AccessibilityState, GestureResponderEvent, StyleProp, ViewStyle } from "react-native";

import { dashboardLiquidGlass, getCapsuleRadiusFromHeight } from "@/components/dashboard/dashboardDesignSpec";
import { colors } from "@/theme/shared";
import { triggerButtonHaptic } from "@/utils/haptics";

export type LiquidGlassButtonVariant = "primaryAccent" | "secondaryNeutral" | "sectionAccent";

export type LiquidGlassButtonProps = {
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accentColor?: string;
  capsule?: boolean;
  children?: React.ReactNode;
  disabled?: boolean | null;
  disableHighlightEffect?: boolean;
  disableScaleAnimation?: boolean;
  glassEffectStyle?: "clear" | "regular";
  hitSlop?: number;
  onPress?: () => void;
  radius: number;
  style?: StyleProp<ViewStyle>;
  variant?: LiquidGlassButtonVariant;
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

function getVariantStyles(variant: LiquidGlassButtonVariant, accentColor: string, disabled: boolean) {
  if (variant === "primaryAccent") {
    return {
      backgroundColor: disabled ? alpha(accentColor, 0.14) : alpha(accentColor, 0.24),
      borderColor: disabled ? alpha(accentColor, 0.2) : alpha(accentColor, 0.46),
      pressedBackgroundColor: alpha(colors.primaryDark, 0.3),
      pressedBorderColor: alpha(colors.primaryDark, 0.58),
    };
  }

  if (variant === "sectionAccent") {
    const fillOpacity = dashboardLiquidGlass.secondaryAccent.fillOpacity;

    return {
      backgroundColor: disabled ? alpha(accentColor, 0.18) : alpha(accentColor, fillOpacity),
      borderColor: disabled ? alpha(accentColor, 0.24) : alpha(accentColor, 0.56),
      pressedBackgroundColor: alpha(colors.primaryDark, 0.46),
      pressedBorderColor: alpha(colors.primaryDark, 0.58),
    };
  }

  return {
    backgroundColor: "rgba(255, 255, 255, 0.38)",
    borderColor: "rgba(148, 163, 184, 0.42)",
    pressedBackgroundColor: alpha(accentColor, 0.08),
    pressedBorderColor: alpha(accentColor, 0.24),
  };
}

export function LiquidGlassButton({
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  accentColor = colors.primary,
  capsule = false,
  children,
  disabled = false,
  hitSlop,
  onPress,
  radius,
  style,
  variant = "secondaryNeutral",
}: LiquidGlassButtonProps) {
  const isDisabled = Boolean(disabled);
  const variantStyles = getVariantStyles(variant, accentColor, isDisabled);
  const [height, setHeight] = useState<number | null>(null);
  const visualRadius = capsule && height ? getCapsuleRadiusFromHeight(height) : radius;

  const handlePress = (_event: GestureResponderEvent) => {
    if (!isDisabled) {
      triggerButtonHaptic();
      onPress?.();
    }
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState ?? (isDisabled ? { disabled: true } : undefined)}
      disabled={isDisabled}
      hitSlop={hitSlop}
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
        },
      ]}
    >
      <View pointerEvents="none">{children}</View>
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
});
