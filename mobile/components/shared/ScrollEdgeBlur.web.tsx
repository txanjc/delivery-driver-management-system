import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import type { ColorValue } from "react-native";

type GradientStops = readonly [ColorValue, ColorValue, ColorValue, ColorValue];
type GradientLocations = readonly [number, number, number, number];

type ScrollEdgeBlurProps = {
  blurIntensity: number;
  blurTint: "light" | "dark";
  maskColors: GradientStops;
  maskLocations: GradientLocations;
  tintColors: GradientStops;
  tintLocations: GradientLocations;
};

export function ScrollEdgeBlur({ tintColors, tintLocations }: ScrollEdgeBlurProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={tintColors} locations={tintLocations} style={StyleSheet.absoluteFill} />
    </View>
  );
}
