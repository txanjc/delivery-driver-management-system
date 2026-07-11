import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import type { StyleProp, ViewStyle, ViewProps } from "react-native";
import { AccessibilityInfo, View } from "react-native";

type DashboardGlassSurfaceProps = PropsWithChildren<{
  accessibilityLabel?: string;
  accessible?: boolean;
  fallbackColor?: string;
  glassEffectStyle?: "clear" | "regular";
  pointerEvents?: ViewProps["pointerEvents"];
  style?: StyleProp<ViewStyle>;
  tintColor?: string;
}>;

function useReduceTransparencyEnabled() {
  const [reduceTransparencyEnabled, setReduceTransparencyEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (mounted) {
        setReduceTransparencyEnabled(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparencyEnabled);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceTransparencyEnabled;
}

export function DashboardGlassSurface({ accessibilityLabel, accessible, children, fallbackColor, glassEffectStyle = "regular", pointerEvents, style, tintColor = "rgba(255,255,255,0.24)" }: DashboardGlassSurfaceProps) {
  const reduceTransparencyEnabled = useReduceTransparencyEnabled();
  const canRenderGlass = reduceTransparencyEnabled === false && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const shouldRenderBlur = reduceTransparencyEnabled === false && !canRenderGlass;

  if (canRenderGlass) {
    return (
      <GlassView accessibilityLabel={accessibilityLabel} accessible={accessible} colorScheme="auto" glassEffectStyle={glassEffectStyle} pointerEvents={pointerEvents} style={style} tintColor={tintColor}>
        {children}
      </GlassView>
    );
  }

  if (shouldRenderBlur) {
    return (
      <BlurView accessibilityLabel={accessibilityLabel} accessible={accessible} intensity={42} pointerEvents={pointerEvents} style={style} tint="systemMaterial">
        {children}
      </BlurView>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} accessible={accessible} pointerEvents={pointerEvents} style={[style, fallbackColor ? { backgroundColor: fallbackColor } : null]}>
      {children}
    </View>
  );
}
