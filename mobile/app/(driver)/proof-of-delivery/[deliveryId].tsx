import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import type { GestureResponderEvent, LayoutChangeEvent, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getButtonRadius,
  getCardRadius,
  getDashboardColors,
  getScreenHorizontalPadding,
} from "@/components/dashboard/dashboardDesignSpec";
import { LiquidGlassButton } from "@/components/shared/LiquidGlassButton";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { getDeliveryForDriver } from "@/services/delivery.service";
import { getDeliveryProofForDriver, submitDeliveryProof } from "@/services/proof-of-delivery.service";
import type { Delivery } from "@/types/delivery";
import type { DeliveryProof, SignaturePoint, SignatureStroke } from "@/types/proofOfDelivery";
import { triggerHaptic } from "@/utils/haptics";

const signatureHeight = 178;

function formatDeliveryNumber(delivery: Delivery) {
  return delivery.delivery_number ? "#" + delivery.delivery_number : "Assigned Delivery";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function distanceBetween(first: SignaturePoint, second: SignaturePoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function getSegmentStyle(first: SignaturePoint, second: SignaturePoint): ViewStyle {
  const length = distanceBetween(first, second);
  const angle = Math.atan2(second.y - first.y, second.x - first.x) * (180 / Math.PI);

  return {
    left: first.x,
    top: first.y - 1.5,
    transform: [{ rotate: String(angle) + "deg" }],
    width: Math.max(length, 2),
  };
}

function SignaturePreview({ color, strokes }: { color: string; strokes: SignatureStroke[] }) {
  return (
    <>
      {strokes.map((stroke, strokeIndex) => (
        <View key={"stroke-" + strokeIndex} pointerEvents="none" style={StyleSheet.absoluteFill}>
          {stroke.map((point, pointIndex) => (
            <View
              key={"point-" + strokeIndex + "-" + pointIndex}
              style={[styles.signaturePoint, { backgroundColor: color, left: point.x - 2.5, top: point.y - 2.5 }]}
            />
          ))}
          {stroke.slice(1).map((point, pointIndex) => (
            <View
              key={"segment-" + strokeIndex + "-" + pointIndex}
              style={[styles.signatureSegment, { backgroundColor: color }, getSegmentStyle(stroke[pointIndex], point)]}
            />
          ))}
        </View>
      ))}
    </>
  );
}

export default function ProofOfDeliveryScreen() {
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const colors = getDashboardColors(colorScheme);
  const { driver, loading: profileLoading } = useDriverProfile();
  const canvasSizeRef = useRef({ height: signatureHeight, width: 1 });
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [existingProof, setExistingProof] = useState<DeliveryProof | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProof = useCallback(async () => {
    if (!driver || !deliveryId) return null;
    const response = await getDeliveryProofForDriver(deliveryId);

    if (response.error) {
      console.error("Unable to load delivery proof", response.error);
      return null;
    }

    setExistingProof(response.data);
    return response.data;
  }, [deliveryId, driver]);

  const loadDelivery = useCallback(async () => {
    if (profileLoading) return;
    if (!driver || !deliveryId) {
      setError("This delivery is unavailable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const response = await getDeliveryForDriver(deliveryId, driver.driver_id);

    if (response.error || !response.data) {
      console.error("Unable to load delivery for proof", response.error);
      setDelivery(null);
      setError("This delivery is unavailable or is no longer assigned to you.");
      setLoading(false);
      return;
    }

    setDelivery(response.data);
    await loadProof();
    setLoading(false);
  }, [deliveryId, driver, loadProof, profileLoading]);

  useEffect(() => {
    void loadDelivery();
  }, [loadDelivery]);

  const startStroke = useCallback((event: GestureResponderEvent) => {
    const point = {
      x: Math.max(0, Math.min(event.nativeEvent.locationX, canvasSizeRef.current.width)),
      y: Math.max(0, Math.min(event.nativeEvent.locationY, canvasSizeRef.current.height)),
    };
    setStrokes((current) => [...current, [point]]);
  }, []);

  const addPoint = useCallback((event: GestureResponderEvent) => {
    const point = {
      x: Math.max(0, Math.min(event.nativeEvent.locationX, canvasSizeRef.current.width)),
      y: Math.max(0, Math.min(event.nativeEvent.locationY, canvasSizeRef.current.height)),
    };

    setStrokes((current) => {
      if (!current.length) return current;
      const latestStroke = current[current.length - 1];
      const latestPoint = latestStroke[latestStroke.length - 1];
      if (latestPoint && distanceBetween(latestPoint, point) < 1.5) return current;
      return [...current.slice(0, -1), [...latestStroke, point]];
    });
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: startStroke,
    onPanResponderMove: addPoint,
  }), [addPoint, startStroke]);

  const onCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    canvasSizeRef.current = {
      height: event.nativeEvent.layout.height,
      width: event.nativeEvent.layout.width,
    };
  }, []);

  const clearSignature = useCallback(() => {
    setStrokes([]);
    triggerHaptic("light");
  }, []);

  const signatureIsPresent = strokes.some((stroke) => stroke.length > 0);
  const deliveryIsCompleted = delivery?.status === "delivered";
  const canSubmit = Boolean(deliveryIsCompleted && recipientName.trim().length >= 2 && signatureIsPresent && !submitting);

  const submitProof = useCallback(async () => {
    if (!delivery || !driver || !canSubmit) return;

    setSubmitting(true);
    setError(null);
    const signedAt = new Date().toISOString();
    const response = await submitDeliveryProof({
      deliveryId: delivery.delivery_id,
      recipientName: recipientName.trim(),
      signatureData: { strokes, version: 1 },
      signedAt,
    });

    if (response.error || !response.data) {
      console.error("Unable to submit delivery proof", response.error);
      if (response.error?.code === "23505") {
        const proof = await loadProof();
        if (proof) {
          triggerHaptic("success");
          setSubmitting(false);
          return;
        }
      }
      setError("We couldn’t submit this proof of delivery. Please try again.");
      setSubmitting(false);
      return;
    }

    setExistingProof(response.data);
    triggerHaptic("success");
    setSubmitting(false);
  }, [canSubmit, delivery, driver, loadProof, recipientName, strokes]);

  const horizontalPadding = getScreenHorizontalPadding(width);
  const cardRadius = getCardRadius(width);
  const buttonRadius = getButtonRadius(width);
  const proofCompleted = Boolean(existingProof);

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", default: undefined })} style={[styles.flex, { backgroundColor: colors.dashboardBackground }]}>
      <View style={[styles.header, { backgroundColor: colors.dashboardBackground, paddingHorizontal: horizontalPadding, paddingTop: insets.top + dashboardSpacing.scale.sm }]}>
        <LiquidGlassButton accessibilityLabel="Go back" capsule onPress={() => router.back()} radius={999} style={styles.backButton} variant="secondaryNeutral">
          <SymbolView fallback={<Text style={[styles.backFallback, { color: colors.textPrimary }]}>‹</Text>} name="chevron.left" size={18} tintColor={colors.textPrimary} type="hierarchical" />
        </LiquidGlassButton>
        <View style={styles.headerCopy}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.headerTitle, { color: colors.textPrimary }]}>Proof Of Delivery</Text>
          {delivery ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{formatDeliveryNumber(delivery)}</Text> : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading || profileLoading ? (
        <View accessibilityLabel="Loading proof of delivery" accessibilityRole="progressbar" style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error && !delivery ? (
        <View style={[styles.messageWrap, { paddingHorizontal: horizontalPadding }]}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.error, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : delivery ? (
        <View style={[styles.content, { paddingBottom: insets.bottom + 32, paddingHorizontal: horizontalPadding }]}>
          <View style={[styles.deliveryCard, dashboardShadows.subtleCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius }]}>
            <View style={[styles.deliveryIcon, { backgroundColor: colors.accent + "18" }]}>
              <SymbolView fallback={null} name="shippingbox.fill" size={21} tintColor={colors.accent} type="hierarchical" />
            </View>
            <View style={styles.deliveryCopy}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.eyebrow, { color: colors.textSecondary }]}>Deliver To</Text>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.customerName, { color: colors.textPrimary }]}>{delivery.customer_name}</Text>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.address, { color: colors.textSecondary }]}>{delivery.delivery_address}</Text>
            </View>
          </View>

          {proofCompleted ? (
            <View style={[styles.confirmationCard, dashboardShadows.subtleCard, { backgroundColor: colorScheme === "dark" ? "rgba(124, 58, 237, 0.15)" : "rgba(124, 58, 237, 0.08)", borderColor: colors.accent + "38", borderRadius: cardRadius }]}>
              <View style={[styles.confirmationIcon, { backgroundColor: colors.accent }]}>
                <SymbolView fallback={null} name="checkmark" size={19} tintColor="#FFFFFF" type="hierarchical" />
              </View>
              <View style={styles.confirmationCopy}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={[styles.confirmationTitle, { color: colors.textPrimary }]}>Delivery Confirmed</Text>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.confirmationBody, { color: colors.textSecondary }]}>Signed by {existingProof?.signed_by_name} on {formatTimestamp(existingProof?.signed_at)}.</Text>
              </View>
              <LiquidGlassButton capsule onPress={() => router.replace("/(driver)/(tabs)/status")} radius={buttonRadius} style={styles.doneButton} variant="primaryAccent">
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={styles.doneButtonText}>Done</Text>
              </LiquidGlassButton>
            </View>
          ) : !deliveryIsCompleted ? (
            <View style={[styles.stateCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.subtleBorder, borderRadius: cardRadius }]}>
              <SymbolView fallback={null} name="exclamationmark.circle" size={22} tintColor={colors.warning} type="hierarchical" />
              <View style={styles.stateCopy}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={[styles.stateTitle, { color: colors.textPrimary }]}>Delivery Still In Progress</Text>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.stateBody, { color: colors.textSecondary }]}>Mark the delivery as delivered before collecting a confirmation.</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recipient Confirmation</Text>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.sectionDescription, { color: colors.textSecondary }]}>Confirm who received the package, then collect their signature.</Text>
              </View>

              <View style={[styles.inputCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius }]}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.inputLabel, { color: colors.textSecondary }]}>Recipient Name</Text>
                <TextInput
                  accessibilityLabel="Recipient name"
                  autoCapitalize="words"
                  editable={!submitting}
                  maxLength={160}
                  onChangeText={setRecipientName}
                  placeholder="Enter the recipient’s name"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={recipientName}
                />
              </View>

              <View style={styles.signatureHeader}>
                <View>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Customer Signature</Text>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.signatureHint, { color: colors.textSecondary }]}>Sign in the area below.</Text>
                </View>
                <Pressable accessibilityLabel="Clear signature" disabled={!signatureIsPresent || submitting} onPress={clearSignature} style={({ pressed }) => [styles.clearButton, { opacity: !signatureIsPresent || submitting ? 0.4 : pressed ? 0.62 : 1 }]}>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.clearButtonText, { color: colors.accent }]}>Clear</Text>
                </Pressable>
              </View>
              <View
                {...panResponder.panHandlers}
                accessible
                accessibilityHint="Use one finger to write the customer signature"
                accessibilityLabel="Signature capture area"
                accessibilityRole="imagebutton"
                onLayout={onCanvasLayout}
                style={[styles.signatureCanvas, { backgroundColor: colorScheme === "dark" ? "rgba(255,255,255,0.05)" : "#FFFFFF", borderColor: colors.subtleBorder, borderRadius: cardRadius }]}
              >
                <SignaturePreview color={colors.accent} strokes={strokes} />
                {!signatureIsPresent ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} pointerEvents="none" style={[styles.signaturePlaceholder, { color: colors.textTertiary }]}>Customer signature</Text> : null}
              </View>

              {error ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              <LiquidGlassButton accessibilityLabel="Complete delivery and submit proof" capsule disabled={!canSubmit} onPress={() => { void submitProof(); }} radius={buttonRadius} style={styles.submitButton} variant="primaryAccent">
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <><SymbolView fallback={null} name="signature" size={18} tintColor="#FFFFFF" type="hierarchical" /><Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={styles.submitButtonText}>Complete Delivery</Text></>}
              </LiquidGlassButton>
            </>
          )}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  address: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  backButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  backFallback: { fontSize: 34, lineHeight: 34 },
  clearButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: dashboardSpacing.scale.sm },
  clearButtonText: { fontSize: dashboardTypography.caption.fontSize, fontWeight: "700", lineHeight: dashboardTypography.caption.lineHeight },
  confirmationCard: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: dashboardSpacing.scale.md, padding: dashboardSpacing.scale.md },
  confirmationCopy: { flex: 1, gap: dashboardSpacing.scale.xxs },
  confirmationBody: { fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
  confirmationIcon: { alignItems: "center", borderRadius: 999, height: 38, justifyContent: "center", width: 38 },
  confirmationTitle: { fontSize: dashboardTypography.control.fontSize, fontWeight: "700", lineHeight: dashboardTypography.control.lineHeight },
  content: { gap: dashboardSpacing.scale.lg, paddingTop: dashboardSpacing.scale.lg },
  customerName: { fontSize: dashboardTypography.secondary.fontSize, fontWeight: "700", lineHeight: dashboardTypography.secondary.lineHeight },
  deliveryCard: { alignItems: "flex-start", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: dashboardSpacing.scale.md, padding: dashboardSpacing.scale.md },
  deliveryCopy: { flex: 1, gap: dashboardSpacing.scale.xxs },
  deliveryIcon: { alignItems: "center", borderRadius: 999, height: 42, justifyContent: "center", width: 42 },
  doneButton: { alignItems: "center", height: 36, justifyContent: "center", minWidth: 62, paddingHorizontal: dashboardSpacing.scale.md },
  doneButtonText: { color: "#FFFFFF", fontSize: dashboardTypography.caption.fontSize, fontWeight: "700", lineHeight: dashboardTypography.caption.lineHeight },
  eyebrow: { fontSize: dashboardTypography.caption.fontSize, fontWeight: "700", letterSpacing: 0.55, lineHeight: dashboardTypography.caption.lineHeight, textTransform: "uppercase" },
  error: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  flex: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: dashboardSpacing.scale.md },
  headerCopy: { alignItems: "center", flex: 1, gap: dashboardSpacing.scale.xxs },
  headerSpacer: { width: 44 },
  headerSubtitle: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  headerTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "700", lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  input: { fontSize: dashboardTypography.body.fontSize, lineHeight: dashboardTypography.body.lineHeight, minHeight: 46, paddingHorizontal: dashboardSpacing.scale.md, paddingVertical: dashboardSpacing.scale.sm },
  inputCard: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  inputLabel: { fontSize: dashboardTypography.caption.fontSize, fontWeight: "700", letterSpacing: 0.4, lineHeight: dashboardTypography.caption.lineHeight, paddingHorizontal: dashboardSpacing.scale.md, paddingTop: dashboardSpacing.scale.md, textTransform: "uppercase" },
  loading: { alignItems: "center", flex: 1, justifyContent: "center" },
  messageWrap: { paddingTop: dashboardSpacing.scale.xl },
  sectionDescription: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  sectionHeader: { gap: dashboardSpacing.scale.xs },
  sectionTitle: { fontSize: dashboardTypography.control.fontSize, fontWeight: "700", lineHeight: dashboardTypography.control.lineHeight },
  signatureCanvas: { borderWidth: StyleSheet.hairlineWidth, height: signatureHeight, overflow: "hidden", position: "relative" },
  signatureHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  signatureHint: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight, marginTop: dashboardSpacing.scale.xxs },
  signaturePlaceholder: { fontSize: dashboardTypography.secondary.fontSize, left: 0, position: "absolute", right: 0, textAlign: "center", top: signatureHeight / 2 - 10 },
  signaturePoint: { borderRadius: 999, height: 5, position: "absolute", width: 5 },
  signatureSegment: { borderRadius: 999, height: 3, position: "absolute", transformOrigin: "left center" },
  stateCard: { alignItems: "flex-start", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: dashboardSpacing.scale.md, padding: dashboardSpacing.scale.md },
  stateBody: { fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
  stateCopy: { flex: 1, gap: dashboardSpacing.scale.xxs },
  stateTitle: { fontSize: dashboardTypography.control.fontSize, fontWeight: "700", lineHeight: dashboardTypography.control.lineHeight },
  submitButton: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.sm, height: 50, justifyContent: "center", marginTop: dashboardSpacing.scale.xs },
  submitButtonText: { color: "#FFFFFF", fontSize: dashboardTypography.control.fontSize, fontWeight: "700", lineHeight: dashboardTypography.control.lineHeight },
});
