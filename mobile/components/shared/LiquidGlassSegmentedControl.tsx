import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import { dashboardMaxFontSizeMultipliers, dashboardTypography } from "@/components/dashboard/dashboardDesignSpec";
import { DashboardGlassSurface } from "@/components/dashboard/DashboardGlassSurface";
import { triggerButtonHaptic } from "@/utils/haptics";

export type LiquidGlassSegment<Value extends string> = {
  label: string;
  value: Value;
};

type LiquidGlassSegmentedControlProps<Value extends string> = {
  accessibilityLabel: string;
  borderColor: string;
  fallbackColor: string;
  inactiveTextColor: string;
  onValueChange: (value: Value) => void;
  options: readonly LiquidGlassSegment<Value>[];
  progress: SharedValue<number>;
  selectedColor: string;
  textColor: string;
  tintColor: string;
  value: Value;
};

type SegmentLabelProps = {
  index: number;
  inactiveTextColor: string;
  label: string;
  progress: SharedValue<number>;
  textColor: string;
};

function SegmentLabel({ index, inactiveTextColor, label, progress, textColor }: SegmentLabelProps) {
  const animatedTextStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);

    return {
      color: interpolateColor(distance, [0, 1], [textColor, inactiveTextColor]),
      opacity: interpolate(distance, [0, 1], [1, 0.78], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [0, 1], [1.02, 1], Extrapolation.CLAMP) }],
    };
  }, [inactiveTextColor, index, textColor]);

  return (
    <Animated.Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={[styles.label, animatedTextStyle]}>
      {label}
    </Animated.Text>
  );
}

export function LiquidGlassSegmentedControl<Value extends string>({
  accessibilityLabel,
  borderColor,
  fallbackColor,
  inactiveTextColor,
  onValueChange,
  options,
  progress,
  selectedColor,
  textColor,
  tintColor,
  value,
}: LiquidGlassSegmentedControlProps<Value>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const segmentWidth = trackWidth / Math.max(options.length, 1);

  const selectionAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      Math.sin((progress.value % 1) * Math.PI),
      [0, 1],
      ["rgba(255, 255, 255, 0.14)", "rgba(255, 255, 255, 0.25)"],
    ),
    borderRadius: interpolate(Math.sin((progress.value % 1) * Math.PI), [0, 1], [999, 26]),
    transform: [
      { translateX: progress.value * segmentWidth },
      { scaleX: interpolate(Math.sin((progress.value % 1) * Math.PI), [0, 1], [1, 1.08]) },
      { scaleY: interpolate(Math.sin((progress.value % 1) * Math.PI), [0, 1], [1, 0.94]) },
    ],
  }));
  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setTrackWidth((current) => (Math.abs(current - nextWidth) < 0.5 ? current : nextWidth));
  };

  return (
    <DashboardGlassSurface
      accessibilityLabel={accessibilityLabel}
      fallbackColor={fallbackColor}
      glassEffectStyle="clear"
      style={[styles.track, { borderColor }]}
      tintColor={tintColor}
    >
      <View onLayout={handleLayout} style={styles.segments}>
          {segmentWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.selection,
                selectionAnimatedStyle,
                {
                  backgroundColor: selectedColor,
                  width: segmentWidth,
                },
              ]}
            >
              <DashboardGlassSurface
                fallbackColor={selectedColor}
                glassEffectStyle="regular"
                style={styles.selectionGlass}
                tintColor="rgba(255, 255, 255, 0.4)"
              />
            </Animated.View>
          ) : null}
          {options.map((option, index) => {
            const selected = option.value === value;

            return (
              <Pressable
                key={option.value}
                accessibilityLabel={option.label}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                hitSlop={2}
                onPress={() => {
                  if (selected) return;
                  triggerButtonHaptic();
                  onValueChange(option.value);
                }}
                style={({ pressed }) => [styles.segment, { opacity: pressed ? 0.72 : 1 }]}
              >
                <SegmentLabel index={index} inactiveTextColor={inactiveTextColor} label={option.label} progress={progress} textColor={textColor} />
              </Pressable>
            );
          })}
      </View>
    </DashboardGlassSurface>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: Math.round(dashboardTypography.control.fontSize * 0.85 * 10) / 10,
    fontWeight: "600",
    lineHeight: Math.round(dashboardTypography.control.lineHeight * 0.85),
  },
  segment: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    zIndex: 1,
  },
  segments: {
    flex: 1,
    flexDirection: "row",
    position: "relative",
    width: "100%",
  },
  selection: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    elevation: 2,
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    top: 0,
    overflow: "hidden",
  },
  selectionGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  track: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    overflow: "hidden",
    padding: 2,
  },
});
