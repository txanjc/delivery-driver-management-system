import { SymbolView } from "expo-symbols";
import { BlurView } from "expo-blur";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getCardRadius,
  getDashboardColors,
  getScreenHorizontalPadding,
} from "@/components/dashboard/dashboardDesignSpec";
import { getDeliveryProofForDriver } from "@/services/proof-of-delivery.service";
import type { Delivery } from "@/types/delivery";
import type { DeliveryProof, SignaturePoint, SignatureStroke } from "@/types/proofOfDelivery";
import type { Route } from "@/types/route";

type DeliveryDetailsSheetProps = {
  delivery: Delivery | null;
  onClose: () => void;
  route: Route | null;
  visible: boolean;
};

type DetailRow = {
  icon: ComponentProps<typeof SymbolView>["name"];
  label: string;
  value: string | null;
};

const hiddenOffset = 720;
const dismissThreshold = 110;
const signaturePreviewHeight = 104;

function formatStatus(value: string | null) {
  if (!value) return "Status unavailable";

  return value
    .replace(/[_-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function formatPriority(value: string | null) {
  if (!value) return "Priority unavailable";
  const normalized = value.trim();
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}` : "Priority unavailable";
}

function formatDistance(route: Route | null) {
  if (!route?.estimated_distance_km) return null;
  return `${route.estimated_distance_km.toFixed(route.estimated_distance_km >= 10 ? 0 : 1)} km`;
}

function formatDuration(route: Route | null) {
  if (!route?.estimated_duration_minutes) return null;
  const minutes = Math.max(1, Math.round(route.estimated_duration_minutes));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function getDeliveryLabel(delivery: Delivery) {
  return delivery.delivery_number ? `#${delivery.delivery_number}` : delivery.delivery_id;
}

function formatSignedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getSegmentStyle(first: SignaturePoint, second: SignaturePoint, scale: number, offsetX: number, offsetY: number): ViewStyle {
  const x = (first.x * scale) + offsetX;
  const y = (first.y * scale) + offsetY;
  const length = Math.hypot(second.x - first.x, second.y - first.y) * scale;
  const angle = Math.atan2(second.y - first.y, second.x - first.x) * (180 / Math.PI);

  return {
    left: x,
    top: y - 1.25,
    transform: [{ rotate: String(angle) + "deg" }],
    width: Math.max(length, 2),
  };
}

function CapturedSignaturePreview({ signatureData, tintColor }: { signatureData: DeliveryProof["signature_data"]; tintColor: string }) {
  const [width, setWidth] = useState(0);
  const strokes = signatureData?.strokes ?? [];
  const bounds = useMemo(() => {
    const points = strokes.flat();
    return {
      height: Math.max(1, ...points.map((point) => point.y)),
      width: Math.max(1, ...points.map((point) => point.x)),
    };
  }, [strokes]);
  const availableWidth = Math.max(1, width - 28);
  const scale = Math.min(availableWidth / bounds.width, (signaturePreviewHeight - 28) / bounds.height, 1);
  const offsetX = (width - (bounds.width * scale)) / 2;
  const offsetY = (signaturePreviewHeight - (bounds.height * scale)) / 2;

  return (
    <View
      accessibilityLabel="Captured customer signature"
      accessibilityRole="image"
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={styles.signaturePreview}
    >
      {strokes.map((stroke: SignatureStroke, strokeIndex: number) => (
        <View key={"signature-stroke-" + strokeIndex} pointerEvents="none" style={StyleSheet.absoluteFill}>
          {stroke.map((point, pointIndex) => (
            <View
              key={"signature-point-" + strokeIndex + "-" + pointIndex}
              style={[styles.signaturePoint, { backgroundColor: tintColor, left: (point.x * scale) + offsetX - 2, top: (point.y * scale) + offsetY - 2 }]}
            />
          ))}
          {stroke.slice(1).map((point, pointIndex) => (
            <View
              key={"signature-segment-" + strokeIndex + "-" + pointIndex}
              style={[styles.signatureSegment, { backgroundColor: tintColor }, getSegmentStyle(stroke[pointIndex], point, scale, offsetX, offsetY)]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function DeliveryDetailsSheet({ delivery, onClose, route, visible }: DeliveryDetailsSheetProps) {
  const colorScheme = useColorScheme();
  const reduceMotionEnabled = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const translateY = useSharedValue(hiddenOffset);
  const backdropOpacity = useSharedValue(0);
  const [proof, setProof] = useState<DeliveryProof | null>(null);
  const sheetRadius = Math.max(28, getCardRadius(width) + 10);
  const horizontalPadding = getScreenHorizontalPadding(width);
  const sheetMaxHeight = Math.max(420, height * 0.82);
  const sheetBackground = colorScheme === "dark" ? "rgba(31, 31, 36, 0.96)" : "rgba(246, 246, 248, 0.96)";
  const blurTint = colorScheme === "dark" ? "dark" : "light";
  const sectionBackground = colorScheme === "dark" ? "rgba(255, 255, 255, 0.07)" : "rgba(255, 255, 255, 0.72)";
  const sectionBorder = colorScheme === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(118, 118, 128, 0.18)";
  const statusText = delivery ? formatStatus(delivery.status) : "";
  const priorityText = delivery ? formatPriority(delivery.priority) : "";
  const distanceText = formatDistance(route);
  const durationText = formatDuration(route);
  const isCompletedDelivery = delivery?.status?.trim().toLowerCase() === "delivered";

  const overviewRows = useMemo<DetailRow[]>(
    () => [
      { icon: "arrow.triangle.2.circlepath", label: "Status", value: statusText },
      { icon: "exclamationmark.circle", label: "Priority", value: priorityText },
      { icon: "clock", label: "Travel Time", value: durationText },
      { icon: "location", label: "Distance", value: distanceText },
    ],
    [distanceText, durationText, priorityText, statusText],
  );

  const contactRows = useMemo<DetailRow[]>(
    () =>
      delivery
        ? [
            { icon: "person", label: "Customer", value: delivery.customer_name },
            { icon: "phone", label: "Phone", value: delivery.customer_phone ?? "No phone number" },
          ]
        : [],
    [delivery],
  );

  const locationRows = useMemo<DetailRow[]>(
    () =>
      delivery
        ? [
            { icon: "shippingbox", label: "Pickup", value: delivery.pickup_address },
            { icon: "mappin.and.ellipse", label: "Deliver To", value: delivery.delivery_address },
          ]
        : [],
    [delivery],
  );

  const closeSheet = useCallback(() => {
    translateY.value = withTiming(hiddenOffset, { duration: reduceMotionEnabled ? 120 : 220, easing: Easing.out(Easing.cubic) });
    backdropOpacity.value = withTiming(0, { duration: reduceMotionEnabled ? 100 : 180, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [backdropOpacity, onClose, reduceMotionEnabled, translateY]);

  useEffect(() => {
    if (!visible) {
      translateY.value = hiddenOffset;
      backdropOpacity.value = 0;
      return;
    }

    translateY.value = reduceMotionEnabled
      ? withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) })
      : withSpring(0, { damping: 24, mass: 0.9, stiffness: 220 });
    backdropOpacity.value = withTiming(1, { duration: reduceMotionEnabled ? 100 : 220, easing: Easing.out(Easing.cubic) });
  }, [backdropOpacity, reduceMotionEnabled, translateY, visible]);

  useEffect(() => {
    let active = true;

    if (!visible || !delivery || !isCompletedDelivery) {
      setProof(null);
      return () => { active = false; };
    }

    void getDeliveryProofForDriver(delivery.delivery_id).then((response) => {
      if (!active) return;
      if (response.error) {
        console.error("Unable to load delivery signature", response.error);
        setProof(null);
        return;
      }
      setProof(response.data);
    });

    return () => { active = false; };
  }, [delivery, isCompletedDelivery, visible]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(visible)
        .activeOffsetY([-6, 6])
        .failOffsetX([-28, 28])
        .onUpdate((event) => {
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          const shouldDismiss = event.translationY > dismissThreshold || event.velocityY > 900;

          if (shouldDismiss) {
            runOnJS(closeSheet)();
            return;
          }

          translateY.value = reduceMotionEnabled
            ? withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) })
            : withSpring(0, { damping: 24, mass: 0.9, stiffness: 220 });
        }),
    [closeSheet, reduceMotionEnabled, translateY, visible],
  );

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(backdropOpacity.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!delivery) return null;

  return (
    <Modal animationType="none" onRequestClose={closeSheet} statusBarTranslucent transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Animated.View pointerEvents={visible ? "auto" : "none"} style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable accessibilityLabel="Close delivery details" accessibilityRole="button" onPress={closeSheet} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          accessibilityLabel={`Delivery details for ${getDeliveryLabel(delivery)}`}
          accessibilityRole="summary"
          style={[
            styles.sheet,
            dashboardShadows.elevatedCard,
            {
              backgroundColor: sheetBackground,
              borderColor: sectionBorder,
              borderTopLeftRadius: sheetRadius,
              borderTopRightRadius: sheetRadius,
              maxHeight: sheetMaxHeight,
              paddingBottom: Math.max(insets.bottom, dashboardSpacing.scale.md),
            },
            sheetAnimatedStyle,
          ]}
        >
          <BlurView intensity={42} pointerEvents="none" style={StyleSheet.absoluteFill} tint={blurTint} />
          <GestureDetector gesture={panGesture}>
            <View style={[styles.handleWrap, { paddingHorizontal: horizontalPadding }]}>
              <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
            </View>
          </GestureDetector>
          <ScrollView
            alwaysBounceVertical
            bounces
            contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
            style={styles.scroll}
          >
              <View style={styles.header}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.pageTitle} style={[styles.title, { color: colors.textPrimary }]}>
                  {getDeliveryLabel(delivery)}
                </Text>
                {delivery.customer_name ? (
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {delivery.customer_name}
                  </Text>
                ) : null}
              </View>

              <DetailSection borderColor={sectionBorder} rows={overviewRows} surfaceColor={sectionBackground} title="Delivery Overview" />
              <DetailSection borderColor={sectionBorder} rows={contactRows} surfaceColor={sectionBackground} title="Customer" />
              <DetailSection borderColor={sectionBorder} rows={locationRows} surfaceColor={sectionBackground} title="Locations" />
              {delivery.notes ? (
                <View style={[styles.section, { backgroundColor: sectionBackground, borderColor: sectionBorder }]}>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    Notes / Instructions
                  </Text>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.notes, { color: colors.textPrimary }]}>
                    {delivery.notes}
                  </Text>
                </View>
              ) : null}
              {proof ? (
                <View style={[styles.section, { backgroundColor: sectionBackground, borderColor: sectionBorder }]}>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    Signature Captured
                  </Text>
                  <View style={styles.proofMeta}>
                    <View style={[styles.rowIcon, { backgroundColor: colorScheme === "dark" ? "rgba(124, 58, 237, 0.2)" : "rgba(124, 58, 237, 0.11)" }]}>
                      <SymbolView fallback={null} name="signature" size={16} tintColor={colors.accent} type="hierarchical" />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.rowLabel, { color: colors.textSecondary }]}>
                        Signed By
                      </Text>
                      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.rowValue, { color: colors.textPrimary }]}>
                        {proof.signed_by_name}
                      </Text>
                      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.signatureTimestamp, { color: colors.textSecondary }]}>
                        {formatSignedAt(proof.signed_at)}
                      </Text>
                    </View>
                  </View>
                  <CapturedSignaturePreview signatureData={proof.signature_data} tintColor={colors.accent} />
                </View>
              ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DetailSection({ borderColor, rows, surfaceColor, title }: { borderColor: string; rows: DetailRow[]; surfaceColor: string; title: string }) {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const visibleRows = rows.filter((row) => row.value);
  const iconSurface = colorScheme === "dark" ? "rgba(124, 58, 237, 0.2)" : "rgba(124, 58, 237, 0.11)";

  if (visibleRows.length === 0) return null;

  return (
    <View style={[styles.section, { backgroundColor: surfaceColor, borderColor }]}>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {title}
      </Text>
      <View style={styles.rowStack}>
        {visibleRows.map((row) => (
          <View key={`${title}-${row.label}`} style={styles.detailRow}>
            <View style={[styles.rowIcon, { backgroundColor: iconSurface }]}>
              <SymbolView fallback={null} name={row.icon} size={16} tintColor={colors.accent} type="hierarchical" />
            </View>
            <View style={styles.rowCopy}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.rowLabel, { color: colors.textSecondary }]}>
                {row.label}
              </Text>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.rowValue, { color: colors.textPrimary }]}>
                {row.value}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  content: {
    gap: dashboardSpacing.scale.md,
    paddingBottom: dashboardSpacing.scale.lg,
  },
  detailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
  },
  handle: {
    borderRadius: 999,
    height: 5,
    opacity: 0.6,
    width: 54,
  },
  handleWrap: {
    alignItems: "center",
    paddingBottom: dashboardSpacing.scale.sm,
    paddingTop: dashboardSpacing.scale.sm,
  },
  header: {
    gap: dashboardSpacing.scale.sm,
    paddingTop: dashboardSpacing.scale.xs,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  notes: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: dashboardTypography.secondary.fontWeight,
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  proofMeta: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    marginTop: 1,
    width: 26,
  },
  rowLabel: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  rowStack: {
    gap: dashboardSpacing.scale.md,
  },
  rowValue: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  section: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: dashboardSpacing.scale.md,
    overflow: "hidden",
    padding: dashboardSpacing.scale.md,
  },
  sectionTitle: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: dashboardTypography.caption.lineHeight,
    textTransform: "uppercase",
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
    overflow: "hidden",
  },
  signaturePoint: {
    borderRadius: 999,
    height: 4,
    position: "absolute",
    width: 4,
  },
  signaturePreview: {
    backgroundColor: "rgba(124, 58, 237, 0.06)",
    borderColor: "rgba(124, 58, 237, 0.14)",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    height: signaturePreviewHeight,
    overflow: "hidden",
    position: "relative",
  },
  signatureSegment: {
    borderRadius: 999,
    height: 2.5,
    position: "absolute",
    transformOrigin: "left center",
  },
  signatureTimestamp: {
    fontSize: dashboardTypography.tertiary.fontSize,
    lineHeight: dashboardTypography.tertiary.lineHeight,
  },
  subtitle: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: dashboardTypography.secondary.fontWeight,
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  title: {
    fontSize: dashboardTypography.largePageTitle.fontSize,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: dashboardTypography.largePageTitle.lineHeight,
  },
});
