import { LinearGradient } from "expo-linear-gradient";
import { AppState, StyleSheet, useColorScheme, useWindowDimensions, View } from "react-native";
import { useEffect, useState } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
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

const breathingDuration = 7_200;
const swayDuration = 9_400;
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
  const sway = useSharedValue(0);
  const modeValue = useSharedValue(getModeValue(mode));
  const successPulse = useSharedValue(0);
  const bottomGlowWidth = Math.max(width * 2.45, 760);
  const bottomGlowHeight = Math.max(height * 0.72, 560);
  const secondaryGlowWidth = Math.max(width * 2.1, 660);
  const secondaryGlowHeight = Math.max(height * 0.46, 390);
  const topGlowSize = Math.max(width * 1.48, 540);

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
    cancelAnimation(sway);

    if (reduceMotionEnabled || !appIsActive) {
      breath.value = 0;
      sway.value = 0;
      return () => {
        cancelAnimation(breath);
        cancelAnimation(sway);
      };
    }

    breath.value = withRepeat(
      withTiming(1, { duration: breathingDuration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sway.value = withRepeat(
      withTiming(1, { duration: swayDuration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(breath);
      cancelAnimation(sway);
    };
  }, [appIsActive, breath, reduceMotionEnabled, sway]);

  const bottomGlowStyle = useAnimatedStyle(() => {
    const modeBoost = interpolate(modeValue.value, [0, 1, 2, 3], [0, 0.09, 0.055, 0.12]);
    return {
      opacity: (darkMode ? 0.62 : 0.26) + modeBoost + interpolate(breath.value, [0, 1], [0, 0.09]),
      transform: [
        { translateX: interpolate(breath.value, [0, 1], [-48, 44]) },
        { translateY: interpolate(breath.value, [0, 1], [28, -34]) },
        { scale: interpolate(breath.value, [0, 1], [0.96, 1.1]) },
      ],
    };
  }, [darkMode]);
  const secondaryGlowStyle = useAnimatedStyle(() => {
    const modeBoost = interpolate(modeValue.value, [0, 1, 2, 3], [0, 0.055, 0.035, 0.075]);
    return {
      opacity: (darkMode ? 0.42 : 0.17) + modeBoost,
      transform: [
        { translateX: interpolate(sway.value, [0, 1], [-72, 66]) },
        { translateY: interpolate(sway.value, [0, 1], [22, -18]) },
        { scale: interpolate(sway.value, [0, 1], [1, 1.16]) },
      ],
    };
  }, [darkMode]);
  const topGlowStyle = useAnimatedStyle(() => {
    const modeOpacity = interpolate(modeValue.value, [0, 1, 2, 3], [0, 0.28, 0.035, 0.075]);
    return {
      opacity: (darkMode ? 1 : 0.48) * modeOpacity,
      transform: [
        { translateX: interpolate(breath.value, [0, 1], [30, -42]) },
        { translateY: interpolate(breath.value, [0, 1], [-26, 16]) },
        { rotate: `${interpolate(breath.value, [0, 1], [8, -6])}deg` },
        { scale: interpolate(breath.value, [0, 1], [0.98, 1.06]) },
      ],
    };
  }, [darkMode]);
  const successGlowStyle = useAnimatedStyle(() => ({
    opacity: successPulse.value * (darkMode ? 0.24 : 0.08),
    transform: [{ scale: interpolate(successPulse.value, [0, 1], [0.86, 1.08]) }],
  }));

  const palette = darkMode
    ? {
      base: "#09090B",
      bottom: ["rgba(9, 9, 11, 0)", "rgba(124, 58, 237, 0.96)", "rgba(109, 74, 255, 0.52)", "rgba(9, 9, 11, 0)"] as [string, string, string, string],
      secondary: ["rgba(9, 9, 11, 0)", "rgba(109, 74, 255, 0.76)", "rgba(124, 58, 237, 0.32)", "rgba(9, 9, 11, 0)"] as [string, string, string, string],
      fallback: ["#09090B", "#17102F", "#09090B"] as [string, string, string],
      pulse: ["rgba(196, 181, 253, 0)", "rgba(196, 181, 253, 0.86)", "rgba(124, 58, 237, 0)"] as [string, string, string],
      top: ["rgba(139, 92, 246, 0.48)", "rgba(124, 58, 237, 0.18)", "rgba(9, 9, 11, 0)"] as [string, string, string],
    }
    : {
      base: "#FAFAFC",
      bottom: ["rgba(250, 250, 252, 0)", "rgba(167, 139, 250, 0.74)", "rgba(196, 181, 253, 0.3)", "rgba(250, 250, 252, 0)"] as [string, string, string, string],
      secondary: ["rgba(250, 250, 252, 0)", "rgba(196, 181, 253, 0.56)", "rgba(221, 214, 254, 0.18)", "rgba(250, 250, 252, 0)"] as [string, string, string, string],
      fallback: ["#FAFAFC", "#F1ECFF", "#FAFAFC"] as [string, string, string],
      pulse: ["rgba(250, 250, 252, 0)", "rgba(221, 214, 254, 0.64)", "rgba(250, 250, 252, 0)"] as [string, string, string],
      top: ["rgba(167, 139, 250, 0.32)", "rgba(221, 214, 254, 0.1)", "rgba(250, 250, 252, 0)"] as [string, string, string],
    };

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.base, overflow: "hidden" }]}>
      <LinearGradient colors={palette.fallback} end={{ x: 0.5, y: 1 }} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.bottomGlow, bottomGlowStyle, { bottom: -bottomGlowHeight * 0.64, height: bottomGlowHeight, left: (width - bottomGlowWidth) / 2, width: bottomGlowWidth }]}>
        <LinearGradient colors={palette.bottom} end={{ x: 0.5, y: 1 }} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["transparent", darkMode ? "rgba(167, 139, 250, 0.26)" : "rgba(196, 181, 253, 0.16)", "transparent"]} end={{ x: 1, y: 0.5 }} start={{ x: 0, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.bottomGlow, secondaryGlowStyle, { bottom: -secondaryGlowHeight * 0.25, height: secondaryGlowHeight, left: (width - secondaryGlowWidth) / 2, width: secondaryGlowWidth }]}>
        <LinearGradient colors={palette.secondary} end={{ x: 0.5, y: 1 }} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["transparent", darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(196, 181, 253, 0.12)", "transparent"]} end={{ x: 1, y: 0.7 }} start={{ x: 0, y: 0.7 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.topGlow, topGlowStyle, { height: topGlowSize, right: -topGlowSize * 0.56, top: -topGlowSize * 0.64, width: topGlowSize }]}>
        <LinearGradient colors={palette.top} end={{ x: 0.92, y: 0.9 }} start={{ x: 0.08, y: 0.08 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.bottomGlow, successGlowStyle, { bottom: -bottomGlowHeight * 0.58, height: bottomGlowHeight * 0.86, left: (width - bottomGlowWidth * 0.84) / 2, width: bottomGlowWidth * 0.84 }]}>
        <LinearGradient colors={palette.pulse} end={{ x: 0.5, y: 1 }} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomGlow: {
    borderRadius: 9999,
    overflow: "hidden",
    position: "absolute",
  },
  topGlow: {
    borderRadius: 9999,
    overflow: "hidden",
    position: "absolute",
  },
});
