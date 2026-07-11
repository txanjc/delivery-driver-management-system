import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle, ViewProps } from "react-native";
import { View } from "react-native";

type DashboardGlassSurfaceProps = PropsWithChildren<{
  accessibilityLabel?: string;
  accessible?: boolean;
  fallbackColor?: string;
  glassEffectStyle?: "clear" | "regular";
  pointerEvents?: ViewProps["pointerEvents"];
  style?: StyleProp<ViewStyle>;
  tintColor?: string;
}>;

export function DashboardGlassSurface({ accessibilityLabel, accessible, children, fallbackColor, pointerEvents, style }: DashboardGlassSurfaceProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessible={accessible} pointerEvents={pointerEvents} style={[style, fallbackColor ? { backgroundColor: fallbackColor } : null]}>
      {children}
    </View>
  );
}
