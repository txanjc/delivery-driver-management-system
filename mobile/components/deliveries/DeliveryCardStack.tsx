import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { dashboardTypography } from "@/components/dashboard/dashboardDesignSpec";
import { GlassActionButton } from "@/components/shared/GlassActionButton";
import { triggerButtonHaptic } from "@/utils/haptics";

type StackState = "collapsed" | "expanded";

type DeliveryCardStackProps<TItem> = {
  accessibilityLabel: string;
  collapsedHint?: string;
  expandedHint?: string;
  getKey: (item: TItem) => string;
  items: TItem[];
  renderCard: (item: TItem, index: number) => React.ReactNode;
  resetKey?: string;
  textColor: string;
};

const maxCollapsedLayers = 6;
const secondaryStackCardHeight = 168;
const collapsedLayerPeek = 13;
const collapsedScales = [1, 0.998, 0.996, 0.994, 0.992, 0.99] as const;
const expandedCardGap = 10;
const stackControlGap = 12;
const stackControlPillHeight = 26;
const stackControlPillWidth = 132;
const swipeThreshold = 92;
const swipeExitDistance = 420;
const lightRearLayerSurfaces = ["#ffffff", "#fbfaff", "#f7f4ff", "#f2eeff", "#eee8ff"] as const;
const darkRearLayerSurfaces = ["rgba(31, 31, 36, 0.98)", "rgba(28, 28, 33, 0.98)", "rgba(25, 25, 30, 0.98)", "rgba(22, 22, 27, 0.98)", "rgba(19, 19, 24, 0.98)"] as const;

function getRearLayerSurfaceStyle(dark: boolean, index: number): ViewStyle {
  const surfaces = dark ? darkRearLayerSurfaces : lightRearLayerSurfaces;
  const surfaceIndex = Math.max(0, Math.min(index - 1, surfaces.length - 1));

  return {
    backgroundColor: surfaces[surfaceIndex],
  };
}

function runStackSpring(progress: SharedValue<number>, expanded: boolean, reduceMotionEnabled: boolean) {
  if (reduceMotionEnabled) {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: expanded ? 180 : 140,
      easing: Easing.out(Easing.cubic),
    });
    return;
  }

  progress.value = withSpring(expanded ? 1 : 0, expanded ? {
    damping: 15,
    energyThreshold: 0.001,
    mass: 0.7,
    overshootClamping: false,
    stiffness: 225,
  } : {
    damping: 19,
    energyThreshold: 0.001,
    mass: 0.62,
    overshootClamping: true,
    stiffness: 270,
  });
}

function AnimatedStackCard<TItem>({
  accessibilityEnabled,
  collapsedScale,
  collapsedTopInset,
  dark,
  dragX,
  index,
  item,
  itemKey,
  onCardLayout,
  panGesture,
  progress,
  renderCard,
  swipeHintEnabled,
  swipeHintPulse,
  totalCards,
  expandedOffset,
}: {
  accessibilityEnabled: boolean;
  collapsedScale: number;
  collapsedTopInset: number;
  dark: boolean;
  dragX: SharedValue<number>;
  expandedOffset: number;
  index: number;
  item: TItem;
  itemKey: string;
  onCardLayout: (key: string, height: number) => void;
  panGesture?: ReturnType<typeof Gesture.Pan>;
  progress: SharedValue<number>;
  renderCard: (item: TItem, index: number) => React.ReactNode;
  swipeHintEnabled: boolean;
  swipeHintPulse: SharedValue<number>;
  totalCards: number;
}) {
  const rearLayerSurfaceStyle = getRearLayerSurfaceStyle(dark, index);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight > 0) {
        onCardLayout(itemKey, nextHeight);
      }
    },
    [itemKey, onCardLayout],
  );

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const stagger = Math.min(index * 0.026, 0.16);
    const cardProgress = interpolate(progress.value, [stagger, Math.min(1, 0.82 + stagger)], [0, 1], Extrapolation.CLAMP);
    const collapsedIndex = Math.min(index, maxCollapsedLayers - 1);
    const collapsedY = collapsedTopInset - collapsedIndex * collapsedLayerPeek;
    const dragDistance = Math.abs(dragX.value);
    const dragProgress = Math.min(dragDistance / swipeThreshold, 1);
    const rearLift = index > 0 ? -dragProgress * collapsedLayerPeek : 0;
    const hintNudge = index === 0 && swipeHintEnabled ? interpolate(swipeHintPulse.value, [0, 1], [-2, 2], Extrapolation.CLAMP) : 0;
    const hintRotate = index === 0 && swipeHintEnabled ? interpolate(swipeHintPulse.value, [0, 1], [-0.7, 0.7], Extrapolation.CLAMP) : 0;
    const dragRotate = index === 0 ? interpolate(dragX.value, [-swipeExitDistance, 0, swipeExitDistance], [-9, 0, 9]) : 0;
    const translateX = index === 0 ? dragX.value + hintNudge : 0;
    const rotate = `${dragRotate + hintRotate}deg`;
    const collapsedVisibility = index < maxCollapsedLayers ? 1 : 0;

    return {
      opacity: interpolate(progress.value, [0, 0.18], [collapsedVisibility, 1], Extrapolation.CLAMP),
      transform: [
        { translateX },
        {
          translateY: interpolate(cardProgress, [0, 1], [collapsedY + rearLift, expandedOffset], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(cardProgress, [0, 1], [collapsedScale + (index > 0 ? dragProgress * (1 - collapsedScale) : 0), 1], Extrapolation.CLAMP),
        },
        { rotate },
      ],
      zIndex: totalCards - index,
    };
  }, [collapsedScale, collapsedTopInset, expandedOffset, index, swipeHintEnabled, totalCards]);

  const rearContentAnimatedStyle = useAnimatedStyle(() => {
    if (index === 0) {
      return { opacity: 1 };
    }

    const dragProgress = Math.min(Math.abs(dragX.value) / swipeThreshold, 1);
    const swipeReveal = index === 1 ? dragProgress : 0;
    const expandReveal = interpolate(progress.value, [0.16, 0.64], [0, 1], Extrapolation.CLAMP);

    return {
      opacity: Math.max(swipeReveal, expandReveal),
    };
  }, [index]);

  const rearBackingAnimatedStyle = useAnimatedStyle(() => {
    if (index === 0) {
      return { opacity: 0 };
    }

    const expandReveal = interpolate(progress.value, [0.12, 0.72], [0, 1], Extrapolation.CLAMP);

    return {
      opacity: 1 - expandReveal,
    };
  }, [index]);

  const overlayAnimatedStyle = useAnimatedStyle(() => {
    if (index === 0) {
      return { opacity: 0 };
    }

    const dragProgress = Math.min(Math.abs(dragX.value) / swipeThreshold, 1);
    const swipeReveal = index === 1 ? dragProgress : 0;
    const expandReveal = interpolate(progress.value, [0.1, 0.7], [0, 1], Extrapolation.CLAMP);
    const reveal = Math.max(swipeReveal, expandReveal);

    return {
      opacity: 1 - reveal,
    };
  }, [index]);

  const card = (
    <Animated.View
      collapsable={false}
      accessibilityElementsHidden={!accessibilityEnabled}
      importantForAccessibility={accessibilityEnabled ? "auto" : "no-hide-descendants"}
      onLayout={handleLayout}
      pointerEvents={accessibilityEnabled ? "box-none" : "none"}
      style={[styles.cardLayer, cardAnimatedStyle]}
    >
      {index === 0 ? (
        renderCard(item, index)
      ) : (
        <>
          <Animated.View pointerEvents="none" style={[styles.rearLayerBacking, rearLayerSurfaceStyle, rearBackingAnimatedStyle]} />
          <Animated.View pointerEvents={accessibilityEnabled ? "box-none" : "none"} style={rearContentAnimatedStyle}>
            {renderCard(item, index)}
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.rearLayerFrost, rearLayerSurfaceStyle, overlayAnimatedStyle]} />
        </>
      )}
    </Animated.View>
  );

  return panGesture ? <GestureDetector gesture={panGesture}>{card}</GestureDetector> : card;
}

export function DeliveryCardStack<TItem>({
  accessibilityLabel,
  collapsedHint: _collapsedHint = "Expand delivery stack",
  expandedHint: _expandedHint = "Collapse delivery stack",
  getKey,
  items,
  renderCard,
  resetKey = "",
  textColor: _textColor,
}: DeliveryCardStackProps<TItem>) {
  const dark = useColorScheme() === "dark";
  const reduceMotionEnabled = useReducedMotion();
  const [stackState, setStackState] = useState<StackState>("collapsed");
  const [rotationOffset, setRotationOffset] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [measuredCardHeights, setMeasuredCardHeights] = useState<Record<string, number>>({});
  const dragX = useSharedValue(0);
  const swipeHintPulse = useSharedValue(0);
  const stackProgress = useSharedValue(0);
  const itemKeys = useMemo(() => `${resetKey}:${items.map(getKey).join("|")}`, [getKey, items, resetKey]);
  const isExpanded = stackState === "expanded";
  const rotatedItems = useMemo(() => {
    if (items.length <= 1) return items;

    const safeOffset = rotationOffset % items.length;
    return [...items.slice(safeOffset), ...items.slice(0, safeOffset)];
  }, [items, rotationOffset]);
  const collapsedVisibleCount = Math.min(rotatedItems.length, maxCollapsedLayers);
  const collapsedTopInset = Math.max(0, collapsedVisibleCount - 1) * collapsedLayerPeek;
  const expandedLayouts = useMemo(() => {
    let nextOffset = 0;
    const offsets: Record<string, number> = {};

    rotatedItems.forEach((item, index) => {
      const key = getKey(item);
      const height = measuredCardHeights[key] ?? secondaryStackCardHeight;
      offsets[key] = nextOffset;
      nextOffset += height + (index < rotatedItems.length - 1 ? expandedCardGap : 0);
    });

    return {
      height: nextOffset,
      offsets,
    };
  }, [getKey, measuredCardHeights, rotatedItems]);
  const frontCardHeight = rotatedItems[0] ? measuredCardHeights[getKey(rotatedItems[0])] ?? secondaryStackCardHeight : secondaryStackCardHeight;
  const collapsedHeight = collapsedTopInset + frontCardHeight;
  const expandedHeight = expandedLayouts.height;

  const handleCardLayout = useCallback((key: string, height: number) => {
    setMeasuredCardHeights((current) => {
      if (Math.abs((current[key] ?? 0) - height) <= 1) {
        return current;
      }

      return {
        ...current,
        [key]: height,
      };
    });
  }, []);

  const stackHeightStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(stackProgress.value, [0, 1], [collapsedHeight, expandedHeight], Extrapolation.CLAMP),
    };
  }, [collapsedHeight, expandedHeight]);

  const animateTo = useCallback(
    (nextExpanded: boolean) => {
      if (items.length <= 1) return;

      cancelAnimation(dragX);
      cancelAnimation(stackProgress);
      dragX.value = 0;
      setShowSwipeHint(false);
      setStackState(nextExpanded ? "expanded" : "collapsed");
      runStackSpring(stackProgress, nextExpanded, reduceMotionEnabled);
    },
    [dragX, items.length, reduceMotionEnabled, stackProgress],
  );

  const toggleStack = useCallback(() => {
    animateTo(!isExpanded);
  }, [animateTo, isExpanded]);

  const cycleFrontCard = useCallback(() => {
    setShowSwipeHint(false);
    setRotationOffset((current) => (items.length <= 1 ? 0 : (current + 1) % items.length));
    triggerButtonHaptic();
  }, [items.length]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(items.length > 1 && !isExpanded)
        .activeOffsetX([-4, 4])
        .failOffsetY([-30, 30])
        .onUpdate((event) => {
          dragX.value = event.translationX;
        })
        .onFinalize((event) => {
          const shouldCycle = Math.abs(event.translationX) >= swipeThreshold || Math.abs(event.velocityX) >= 900;

          if (shouldCycle) {
            const exitDirection = event.translationX >= 0 ? 1 : -1;
            dragX.value = withTiming(exitDirection * swipeExitDistance, { duration: reduceMotionEnabled ? 90 : 170, easing: Easing.out(Easing.cubic) }, (finished) => {
              if (finished) {
                runOnJS(cycleFrontCard)();
                dragX.value = 0;
              }
            });
            return;
          }

          dragX.value = reduceMotionEnabled ? withTiming(0, { duration: 90 }) : withSpring(0, { damping: 20, stiffness: 220 });
        }),
    [cycleFrontCard, dragX, isExpanded, items.length, reduceMotionEnabled],
  );

  useEffect(() => {
    cancelAnimation(dragX);
    cancelAnimation(stackProgress);
    dragX.value = 0;
    stackProgress.value = 0;
    setStackState("collapsed");
    setRotationOffset(0);
    setShowSwipeHint(true);
  }, [dragX, itemKeys, stackProgress]);

  useEffect(() => {
    return () => {
      cancelAnimation(dragX);
      cancelAnimation(stackProgress);
      cancelAnimation(swipeHintPulse);
      dragX.value = 0;
      stackProgress.value = 0;
      swipeHintPulse.value = 0;
    };
  }, [dragX, stackProgress, swipeHintPulse]);

  useEffect(() => {
    cancelAnimation(swipeHintPulse);

    if (!showSwipeHint || isExpanded || items.length <= 1) {
      swipeHintPulse.value = 0;
      return;
    }

    swipeHintPulse.value = reduceMotionEnabled ? 0.7 : withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }), -1, true);

    return () => {
      cancelAnimation(swipeHintPulse);
      swipeHintPulse.value = 0;
    };
  }, [isExpanded, items.length, reduceMotionEnabled, showSwipeHint, swipeHintPulse]);

  if (items.length === 0) return null;

  if (items.length === 1) {
    return <View>{renderCard(items[0], 0)}</View>;
  }

  return (
    <View style={styles.stackWrapper}>
      <Animated.View style={[styles.stackContainer, stackHeightStyle]}>
        {rotatedItems.map((item, index) => {
          const itemKey = getKey(item);
          const isFront = index === 0;

          return (
            <AnimatedStackCard
              accessibilityEnabled={isExpanded || isFront}
              collapsedScale={collapsedScales[index] ?? collapsedScales[collapsedScales.length - 1]}
              collapsedTopInset={collapsedTopInset}
              dark={dark}
              dragX={dragX}
              expandedOffset={expandedLayouts.offsets[itemKey] ?? index * (secondaryStackCardHeight + expandedCardGap)}
              index={index}
              item={item}
              key={itemKey}
              itemKey={itemKey}
              onCardLayout={handleCardLayout}
              panGesture={isFront ? panGesture : undefined}
              progress={stackProgress}
              renderCard={renderCard}
              swipeHintEnabled={showSwipeHint && !isExpanded && isFront}
              swipeHintPulse={swipeHintPulse}
              totalCards={rotatedItems.length}
            />
          );
        })}
      </Animated.View>
      <View style={styles.stackControlRow}>
        <GlassActionButton
          accessibilityLabel={isExpanded ? `Collapse ${accessibilityLabel}` : `${accessibilityLabel}. Expand delivery stack.`}
          capsule
          hitSlop={10}
          label={isExpanded ? "Collapse Stack" : "Expand Stack"}
          labelStyle={styles.stackControlText}
          onPress={toggleStack}
          radius={999}
          style={styles.stackControlPill}
          variant="sectionAccent"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardLayer: {
    left: 0,
    overflow: "visible",
    position: "absolute",
    right: 0,
    top: 0,
  },
  rearLayerBacking: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  rearLayerFrost: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    position: "absolute",
  },
  stackContainer: {
    overflow: "visible",
    position: "relative",
    width: "100%",
  },
  stackControlRow: {
    alignItems: "center",
    marginTop: stackControlGap,
    width: "100%",
  },
  stackControlPill: {
    height: stackControlPillHeight,
    paddingHorizontal: 9,
    paddingVertical: 0,
    shadowColor: "#6d4aff",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    width: stackControlPillWidth,
  },
  stackControlText: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
    textAlign: "center",
  },
  stackWrapper: {
    overflow: "visible",
    position: "relative",
    width: "100%",
    zIndex: 0,
  },
});
