import { StyleSheet, useColorScheme, useWindowDimensions, View } from "react-native";

import {
  dashboardScrollEdge,
  getDashboardColors,
  getScrollEdgeFadeExtension,
} from "@/components/dashboard/dashboardDesignSpec";
import { ScrollEdgeBlur } from "@/components/shared/ScrollEdgeBlur";

type DashboardScrollEdgeProps = {
  topInset: number;
};

export function DashboardScrollEdge({ topInset }: DashboardScrollEdgeProps) {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const fadeExtension = getScrollEdgeFadeExtension(width);
  const overlayHeight = topInset + fadeExtension;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          height: overlayHeight,
          zIndex: dashboardScrollEdge.overlayZIndex,
        },
      ]}
    >
      <ScrollEdgeBlur
        blurIntensity={dashboardScrollEdge.blurIntensity}
        blurTint={colors.scrollEdgeBlurTint}
        maskColors={dashboardScrollEdge.maskColors}
        maskLocations={dashboardScrollEdge.maskLocations}
        tintColors={colors.scrollEdgeTintGradientColors}
        tintLocations={dashboardScrollEdge.tintLocations}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
});
