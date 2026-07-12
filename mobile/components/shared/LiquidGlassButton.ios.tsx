import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { AccessibilityInfo, StyleSheet, useColorScheme, View } from "react-native";
import type { AccessibilityRole, AccessibilityState, LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

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

const ease = Easing.bezier(0.25, 0.1, 0.25, 1).factory();
const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1).factory();
const wideButtonThreshold = 300;
const compactTouchScale = 1.045;
const wideTouchScale = 1.012;

function easeOutElastic(bounciness: number) {
  "worklet";
  return (x: number) => {
    "worklet";
    const c4 = (2 * Math.PI) / (4 / bounciness);
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  };
}

const BEGIN_ANIMATION_CONFIG = {
  duration: 220,
  easing: ease,
} as const;

const END_ANIMATION_CONFIG = {
  duration: 650,
  easing: easeOutElastic(0.82),
} as const;

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

function splitStyles(style: StyleProp<ViewStyle>, radius: number) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const {
    bottom,
    flex,
    left,
    margin,
    marginBottom,
    marginEnd,
    marginHorizontal,
    marginLeft,
    marginRight,
    marginStart,
    marginTop,
    marginVertical,
    opacity: _opacity,
    position,
    right,
    top,
    transform: _transform,
    zIndex,
    ...innerStyle
  } = flattened;

  return {
    innerStyle: {
      ...innerStyle,
      borderRadius: flattened.borderRadius ?? radius,
      opacity: undefined,
    } satisfies ViewStyle,
    outerStyle: {
      borderRadius: flattened.borderRadius ?? radius,
      bottom,
      flex,
      left,
      margin,
      marginBottom,
      marginEnd,
      marginHorizontal,
      marginLeft,
      marginRight,
      marginStart,
      marginTop,
      marginVertical,
      overflow: flattened.overflow ?? "visible",
      position,
      right,
      top,
      zIndex,
    } satisfies ViewStyle,
  };
}

function getVariantStyles(variant: LiquidGlassButtonVariant, accentColor: string, disabled: boolean, dark: boolean) {
  if (variant === "primaryAccent") {
    return {
      blurTint: "systemMaterial" as const,
      borderColor: disabled ? alpha(accentColor, 0.32) : alpha(accentColor, 0.86),
      fallbackColor: disabled ? alpha(accentColor, 0.26) : alpha(accentColor, 0.85),
      fillColor: disabled ? alpha(accentColor, 0.26) : alpha(accentColor, 0.85),
      highlightColor: dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.16)",
      iconColor: "#ffffff",
      textColor: "#ffffff",
      tintColor: disabled ? alpha(accentColor, 0.2) : alpha(accentColor, 0.85),
    };
  }

  if (variant === "sectionAccent") {
    const fillOpacity = dashboardLiquidGlass.secondaryAccent.fillOpacity;

    return {
      blurTint: "systemMaterial" as const,
      borderColor: disabled ? alpha(accentColor, 0.24) : alpha(accentColor, 0.56),
      fallbackColor: disabled ? alpha(accentColor, 0.18) : alpha(accentColor, fillOpacity),
      fillColor: disabled ? alpha(accentColor, 0.18) : alpha(accentColor, fillOpacity),
      highlightColor: dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.18)",
      iconColor: "#ffffff",
      textColor: "#ffffff",
      tintColor: disabled ? alpha(accentColor, 0.14) : alpha(accentColor, 0.5),
    };
  }

  return {
    blurTint: dark ? ("systemMaterialDark" as const) : ("systemMaterialLight" as const),
    borderColor: dark ? "rgba(255, 255, 255, 0.32)" : alpha(accentColor, 0.34),
    fallbackColor: dark ? "rgba(255, 255, 255, 0.2)" : alpha(accentColor, 0.12),
    fillColor: dark ? "rgba(255, 255, 255, 0.2)" : alpha(accentColor, 0.12),
    highlightColor: dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.14)",
    iconColor: dark ? "#F5F5F7" : colors.text,
    textColor: dark ? "#F5F5F7" : colors.text,
    tintColor: dark ? "rgba(255, 255, 255, 0.22)" : alpha(accentColor, 0.18),
  };
}

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

export const LiquidGlassButton = forwardRef<View, LiquidGlassButtonProps>(
  (
    {
      accessibilityLabel,
      accessibilityRole = "button",
      accessibilityState,
      accentColor = colors.primary,
      capsule = false,
      children,
      disabled = false,
      disableHighlightEffect = false,
      disableScaleAnimation = false,
      glassEffectStyle = "regular",
      hitSlop,
      onPress,
      radius,
      style,
      variant = "secondaryNeutral",
    },
    ref,
  ) => {
    const dark = useColorScheme() === "dark";
    const isDisabled = Boolean(disabled);
    const reduceTransparencyEnabled = useReduceTransparencyEnabled();
    const [buttonSize, setButtonSize] = useState<{ height: number; width: number } | null>(null);
    const scale = useSharedValue(1);
    const scaleX = useSharedValue(1);
    const scaleY = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const highlightOpacity = useSharedValue(0);
    const zIndex = useSharedValue(0);
    const variantStyles = getVariantStyles(variant, accentColor, isDisabled, dark);
    const canRenderGlass = reduceTransparencyEnabled === false && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
    const shouldRenderBlur = reduceTransparencyEnabled === false && !canRenderGlass;
    const wideButton = (buttonSize?.width ?? 0) > wideButtonThreshold;
    const panDeformationLimit = wideButton ? 0.018 : 0.052;
    const panTranslationLimit = wideButton ? 2.25 : 4;
    const visualRadius = capsule && buttonSize ? getCapsuleRadiusFromHeight(buttonSize.height) : radius;

    const { innerStyle, outerStyle } = useMemo(() => splitStyles(style, visualRadius), [style, visualRadius]);

    const handleLayout = (event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;
      setButtonSize((current) => {
        if (current && Math.abs(current.height - height) < 0.5 && Math.abs(current.width - width) < 0.5) {
          return current;
        }

        return { height, width };
      });
    };

    const resetPressValues = useCallback(() => {
      "worklet";
      scale.value = withTiming(1, END_ANIMATION_CONFIG);
      scaleX.value = withTiming(1, END_ANIMATION_CONFIG);
      scaleY.value = withTiming(1, END_ANIMATION_CONFIG);
      translateX.value = withTiming(0, END_ANIMATION_CONFIG);
      translateY.value = withTiming(0, END_ANIMATION_CONFIG);
      if (!disableHighlightEffect) {
        highlightOpacity.value = withTiming(0, {
          duration: END_ANIMATION_CONFIG.duration / 1.5,
          easing: easeOutExpo,
        });
      }
      zIndex.value = withDelay(END_ANIMATION_CONFIG.duration, withTiming(0, { duration: 0 }));
    }, [disableHighlightEffect, highlightOpacity, scale, scaleX, scaleY, translateX, translateY, zIndex]);

    const animatedContainerStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { scaleX: scaleX.value },
        { scaleY: scaleY.value },
      ],
      zIndex: (outerStyle.zIndex ?? 0) + zIndex.value,
    }));

    const animatedHighlightStyle = useAnimatedStyle(() => ({
      opacity: highlightOpacity.value,
    }));

    const panGesture = useMemo(
      () =>
        Gesture.Pan()
          .enabled(!isDisabled)
          .activeOffsetY([-6, 6])
          .activeOffsetX([-6, 6])
          .minDistance(3)
          .maxPointers(1)
          .onBegin(() => {
            "worklet";
            zIndex.value = 999;
            if (!disableHighlightEffect) {
              highlightOpacity.value = withTiming(1, BEGIN_ANIMATION_CONFIG);
            }
          })
          .onUpdate((event) => {
            "worklet";
            const dragX = event.translationX;
            const dragY = event.translationY;
            const rawFactorY = Math.abs(dragY) / 80;
            const rawFactorX = Math.abs(dragX) / 80;
            const dragFactorY = Math.log(1 + rawFactorY * 2) / Math.log(3);
            const dragFactorX = Math.log(1 + rawFactorX * 2) / Math.log(3);
            const scaleYFromVertical = disableScaleAnimation ? 0 : dragFactorY * panDeformationLimit;
            const scaleXFromVertical = disableScaleAnimation ? 0 : -dragFactorY * panDeformationLimit;
            const scaleXFromHorizontal = disableScaleAnimation ? 0 : dragFactorX * panDeformationLimit;
            const scaleYFromHorizontal = disableScaleAnimation ? 0 : -dragFactorX * panDeformationLimit;

            scaleY.value = 1 + scaleYFromVertical + scaleYFromHorizontal;
            scaleX.value = 1 + scaleXFromVertical + scaleXFromHorizontal;
            translateX.value = Math.sign(dragX) * Math.log(1 + Math.abs(dragX) / 20) * panTranslationLimit;
            translateY.value = Math.sign(dragY) * Math.log(1 + Math.abs(dragY) / 20) * panTranslationLimit;
          })
          .onEnd(resetPressValues)
          .onFinalize(resetPressValues),
      [disableHighlightEffect, disableScaleAnimation, highlightOpacity, isDisabled, panDeformationLimit, panTranslationLimit, resetPressValues, zIndex],
    );

    const tapGesture = useMemo(
      () =>
        Gesture.Tap()
          .enabled(!isDisabled)
          .maxDuration(1000)
          .maxDeltaX(8)
          .maxDeltaY(8)
          .hitSlop(hitSlop ?? 8)
          .onTouchesDown(() => {
            "worklet";
            if (!disableScaleAnimation) {
              scale.value = withTiming(wideButton ? wideTouchScale : compactTouchScale, BEGIN_ANIMATION_CONFIG);
            }

            if (!disableHighlightEffect) {
              highlightOpacity.value = withTiming(1, BEGIN_ANIMATION_CONFIG);
            }

            zIndex.value = 999;
          })
          .onTouchesCancelled(resetPressValues)
          .onEnd((event) => {
            "worklet";
            resetPressValues();

            if (onPress) {
              runOnJS(triggerButtonHaptic)();
              runOnJS(onPress)();
            }
          }),
      [disableHighlightEffect, disableScaleAnimation, hitSlop, isDisabled, onPress, resetPressValues, wideButton],
    );

    const composedGesture = useMemo(() => Gesture.Exclusive(tapGesture, panGesture), [panGesture, tapGesture]);
    const materialStyle = [styles.material, innerStyle, { backgroundColor: variantStyles.fillColor, borderColor: variantStyles.borderColor, borderRadius: visualRadius }];
    const highlightStyle = [styles.highlight, { backgroundColor: variantStyles.highlightColor, borderRadius: visualRadius }, animatedHighlightStyle];

    return (
      <Animated.View
        ref={ref}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState ?? (isDisabled ? { disabled: true } : undefined)}
        onLayout={handleLayout}
        style={[outerStyle, animatedContainerStyle]}
      >
        <GestureDetector gesture={composedGesture}>
          {canRenderGlass ? (
            <GlassView colorScheme="auto" glassEffectStyle={glassEffectStyle} isInteractive={!isDisabled} style={materialStyle} tintColor={variantStyles.tintColor}>
              {children}
              <Animated.View pointerEvents="none" style={highlightStyle} />
            </GlassView>
          ) : shouldRenderBlur ? (
            <BlurView intensity={58} style={materialStyle} tint={variantStyles.blurTint}>
              {children}
              <Animated.View pointerEvents="none" style={highlightStyle} />
            </BlurView>
          ) : (
            <View style={[materialStyle, { backgroundColor: variantStyles.fallbackColor }]}>
              {children}
              <Animated.View pointerEvents="none" style={highlightStyle} />
            </View>
          )}
        </GestureDetector>
      </Animated.View>
    );
  },
);

LiquidGlassButton.displayName = "LiquidGlassButton";

const styles = StyleSheet.create({
  highlight: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  material: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
    width: "100%",
  },
});
