import { Canvas, Circle, Group, RadialGradient, Rect } from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";
import { AppState, StyleSheet, useColorScheme, useWindowDimensions, View } from "react-native";
import { useEffect, useState } from "react";
import {
  cancelAnimation,
  Easing,
  interpolate,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type AmbientGlowMode = "idle" | "refreshing" | "active" | "success";

type DeliverEazeAmbientGlowProps = {
  mode: AmbientGlowMode;
};

const breathingDuration = 18_000;
const modeTransitionDuration = 520;

function getModeValue(mode: AmbientGlowMode) {
  if (mode === "refreshing") return 1;
  if (mode === "active") return 2;
  if (mode === "success") return 3;
  return 0;
}

export function DeliverEazeAmbientGlow({ mode }: DeliverEazeAmbientGlowProps) {
  const colorScheme = useColorScheme();
  const { height, width } = useWindowDimensions();
  const reduceMotionEnabled = useReducedMotion();
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === "active");
  const darkMode = colorScheme === "dark";
  const breath = useSharedValue(0);
  const modeValue = useSharedValue(getModeValue(mode));
  const successPulse = useSharedValue(0);
  const glowRadius = Math.max(width * 1.16, height * 0.76);
  const upperGlowRadius = Math.max(width * 0.88, height * 0.45);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppIsActive(nextState === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    modeValue.value = withTiming(getModeValue(mode), { duration: reduceMotionEnabled ? 0 : modeTransitionDuration, easing: Easing.out(Easing.cubic) });

    if (mode === "success" && appIsActive && !reduceMotionEnabled) {
      successPulse.value = 0;
      successPulse.value = withSequence(
        withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 820, easing: Easing.inOut(Easing.cubic) }),
      );
      return;
    }

    successPulse.value = withTiming(0, { duration: reduceMotionEnabled ? 0 : 180 });
  }, [appIsActive, mode, modeValue, reduceMotionEnabled, successPulse]);

  useEffect(() => {
    cancelAnimation(breath);

    if (reduceMotionEnabled || !appIsActive) {
      breath.value = 0;
      return () => cancelAnimation(breath);
    }

    breath.value = withRepeat(
      withTiming(1, { duration: breathingDuration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    return () => cancelAnimation(breath);
  }, [appIsActive, breath, reduceMotionEnabled]);

  const bottomCenter = useDerivedValue(() => ({
    x: width * interpolate(breath.value, [0, 1], [0.43, 0.57]),
    y: height * interpolate(breath.value, [0, 1], [1.2, 1.13]),
  }));
  const upperCenter = useDerivedValue(() => ({
    x: width * interpolate(breath.value, [0, 1], [1.08, 0.84]),
    y: height * interpolate(breath.value, [0, 1], [-0.12, 0.06]),
  }));
  const bottomOpacity = useDerivedValue(() => {
    const modeBoost = interpolate(modeValue.value, [0, 1, 2, 3], [0, 0.08, 0.05, 0.12]);
    return (darkMode ? 0.36 : 0.12) + modeBoost + interpolate(breath.value, [0, 1], [0, 0.045]);
  });
  const upperOpacity = useDerivedValue(() => {
    const modeBoost = interpolate(modeValue.value, [0, 1, 2, 3], [0, 0.24, 0.035, 0.08]);
    return (darkMode ? 0.035 : 0.012) + modeBoost;
  });
  const pulseOpacity = useDerivedValue(() => successPulse.value * (darkMode ? 0.3 : 0.1));
  const pulseRadius = useDerivedValue(() => glowRadius * interpolate(successPulse.value, [0, 1], [0.72, 1.06]));

  const palette = darkMode
    ? {
      base: "#09090B",
      bottomColors: ["rgba(124, 58, 237, 0.84)", "rgba(109, 74, 255, 0.32)", "rgba(9, 9, 11, 0)"],
      fallback: ["#09090B", "#140F2C", "#09090B"] as [string, string, string],
      pulseColors: ["rgba(196, 181, 253, 0.88)", "rgba(124, 58, 237, 0.22)", "rgba(9, 9, 11, 0)"],
      upperColors: ["rgba(139, 92, 246, 0.68)", "rgba(79, 70, 229, 0.2)", "rgba(9, 9, 11, 0)"],
    }
    : {
      base: "#FAFAFC",
      bottomColors: ["rgba(196, 181, 253, 0.52)", "rgba(221, 214, 254, 0.18)", "rgba(250, 250, 252, 0)"],
      fallback: ["#FAFAFC", "#F7F4FF", "#FAFAFC"] as [string, string, string],
      pulseColors: ["rgba(221, 214, 254, 0.68)", "rgba(196, 181, 253, 0.16)", "rgba(250, 250, 252, 0)"],
      upperColors: ["rgba(167, 139, 250, 0.34)", "rgba(221, 214, 254, 0.12)", "rgba(250, 250, 252, 0)"],
    };

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.base, overflow: "hidden" }]}>
      <LinearGradient colors={palette.fallback} end={{ x: 0.5, y: 1 }} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Rect color={palette.base} height={height} width={width} x={0} y={0} />
        <Group opacity={bottomOpacity}>
          <Circle c={bottomCenter} r={glowRadius}>
            <RadialGradient c={bottomCenter} colors={palette.bottomColors} positions={[0, 0.48, 1]} r={glowRadius} />
          </Circle>
        </Group>
        <Group opacity={upperOpacity}>
          <Circle c={upperCenter} r={upperGlowRadius}>
            <RadialGradient c={upperCenter} colors={palette.upperColors} positions={[0, 0.5, 1]} r={upperGlowRadius} />
          </Circle>
        </Group>
        <Group opacity={pulseOpacity}>
          <Circle c={bottomCenter} r={pulseRadius}>
            <RadialGradient c={bottomCenter} colors={palette.pulseColors} positions={[0, 0.42, 1]} r={pulseRadius} />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
}
