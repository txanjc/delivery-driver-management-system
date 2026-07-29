import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardSpacing,
  dashboardTypography,
  getButtonRadius,
  getDashboardColors,
  getScreenHorizontalPadding,
} from "@/components/dashboard/dashboardDesignSpec";
import { LiquidGlassButton } from "@/components/shared/LiquidGlassButton";
import { useAuth } from "@/hooks/useAuth";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { getDeliveryForDriver, updateDeliveryStatusForDriver } from "@/services/delivery.service";
import type { Delivery } from "@/types/delivery";
import { triggerButtonHaptic } from "@/utils/haptics";

type DeliveryStatus = "delivered" | "delayed" | "failed" | "returned";
type StatusOption = {
  description: string;
  icon: "arrow.uturn.left.circle.fill" | "checkmark.circle.fill" | "clock.badge.exclamationmark" | "exclamationmark.triangle.fill";
  label: string;
  status: DeliveryStatus;
};

const statusOptions: StatusOption[] = [
  { status: "delivered", label: "Delivered", description: "Open proof of delivery after updating dispatch.", icon: "checkmark.circle.fill" },
  { status: "delayed", label: "Delayed", description: "Notify dispatch that this delivery is delayed.", icon: "clock.badge.exclamationmark" },
  { status: "failed", label: "Failed", description: "Record that this delivery could not be completed.", icon: "exclamationmark.triangle.fill" },
  { status: "returned", label: "Returned", description: "Record that the package is being returned.", icon: "arrow.uturn.left.circle.fill" },
];

function formatDeliveryLabel(delivery: Delivery) {
  return delivery.delivery_number ? `#${delivery.delivery_number}` : "Assigned delivery";
}

function getStatusOptionColor(status: DeliveryStatus, colors: ReturnType<typeof getDashboardColors>) {
  if (status === "delayed") return colors.warning;
  if (status === "failed") return colors.danger;
  if (status === "returned") return colors.success;
  return colors.accent;
}

export default function StatusUpdateSheet() {
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { driver, loading: profileLoading } = useDriverProfile();
  const colors = getDashboardColors(colorScheme);
  const sheetBackground = colorScheme === "dark" ? "#1C1C1E" : colors.dashboardBackground;
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<DeliveryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDelivery = useCallback(async () => {
    if (profileLoading) return;
    if (!driver || !deliveryId) {
      setDelivery(null);
      setError("This delivery is unavailable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const response = await getDeliveryForDriver(deliveryId, driver.driver_id);
    if (response.error || !response.data) {
      setDelivery(null);
      setError("This delivery is unavailable or is no longer assigned to you.");
    } else {
      setDelivery(response.data);
      setError(null);
    }
    setLoading(false);
  }, [deliveryId, driver, profileLoading]);

  useEffect(() => {
    void loadDelivery();
  }, [loadDelivery]);

  const selectStatus = useCallback(async (status: DeliveryStatus) => {
    if (!delivery || !driver || !user || updating) return;

    setUpdating(status);
    setError(null);
    const response = await updateDeliveryStatusForDriver({
      deliveryId: delivery.delivery_id,
      driverId: driver.driver_id,
      previousStatus: delivery.status,
      status,
      userId: user.id,
    });

    if (!response.data) {
      console.error("Failed to update delivery status", response.error);
      setError("We couldn’t update this delivery. Please try again.");
      setUpdating(null);
      return;
    }

    if (response.error) {
      console.error("Delivery status history could not be saved", response.error);
      setError("The delivery was updated, but its history could not be saved. Please refresh Status.");
      setUpdating(null);
      return;
    }

    if (status === "delivered") {
      router.replace({ pathname: "/(driver)/proof-of-delivery/[deliveryId]", params: { deliveryId: delivery.delivery_id } });
      return;
    }

    router.back();
  }, [delivery, driver, router, updating, user]);

  return (
    <View style={[styles.container, { backgroundColor: sheetBackground, paddingBottom: Math.max(insets.bottom, dashboardSpacing.scale.lg), paddingHorizontal: getScreenHorizontalPadding(width), paddingTop: dashboardSpacing.scale.lg }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.title, { color: colors.textPrimary }]}>Update Delivery</Text>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.subtitle, { color: colors.textSecondary }]}>{delivery ? formatDeliveryLabel(delivery) : "Choose the delivery outcome."}</Text>
        </View>
        <LiquidGlassButton
          accessibilityLabel="Close delivery status options"
          capsule
          onPress={() => { router.back(); }}
          radius={999}
          style={styles.closeButton}
          variant="secondaryNeutral"
        >
          <SymbolView fallback={<Text style={[styles.closeFallback, { color: colors.textPrimary }]}>×</Text>} name="xmark" size={20} tintColor={colors.textPrimary} type="hierarchical" />
        </LiquidGlassButton>
      </View>

      {loading || profileLoading ? (
        <View accessibilityLabel="Loading delivery status options" accessibilityRole="progressbar" style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error && !delivery ? (
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : (
        <>
          <View style={[styles.options, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder }]}>
            {statusOptions.map((option, index) => {
              const saving = updating === option.status;
              const optionColor = getStatusOptionColor(option.status, colors);
              return (
                <Pressable
                  accessibilityLabel={`Mark delivery as ${option.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ busy: saving, disabled: Boolean(updating) }}
                  disabled={Boolean(updating)}
                  key={option.status}
                  onPress={() => { void selectStatus(option.status); }}
                  onPressIn={triggerButtonHaptic}
                  style={({ pressed }) => [styles.option, index < statusOptions.length - 1 ? { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth } : null, { opacity: pressed || updating ? 0.7 : 1 }]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: `${optionColor}16` }]}>
                    {saving ? <ActivityIndicator color={optionColor} size="small" /> : <SymbolView fallback={null} name={option.icon} size={20} tintColor={optionColor} type="hierarchical" />}
                  </View>
                  <View style={styles.optionCopy}>
                    <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.optionLabel, { color: colors.textPrimary }]}>{option.label}</Text>
                    <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.optionDescription, { color: colors.textSecondary }]}>{option.description}</Text>
                  </View>
                  <SymbolView fallback={null} name="chevron.right" size={15} tintColor={colors.textTertiary} type="hierarchical" />
                </Pressable>
              );
            })}
          </View>
          {error ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  closeFallback: { fontSize: 24, fontWeight: "500", lineHeight: 24 },
  container: { flex: 1, gap: dashboardSpacing.scale.lg },
  error: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  header: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.md, justifyContent: "space-between" },
  headerCopy: { flex: 1, gap: dashboardSpacing.scale.xs, minWidth: 0 },
  loading: { alignItems: "center", justifyContent: "center", minHeight: 160 },
  option: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.md, minHeight: 70, paddingHorizontal: dashboardSpacing.scale.md, paddingVertical: dashboardSpacing.scale.sm },
  optionCopy: { flex: 1, gap: dashboardSpacing.scale.xxs, minWidth: 0 },
  optionDescription: { fontSize: dashboardTypography.tertiary.fontSize, lineHeight: dashboardTypography.tertiary.lineHeight },
  optionIcon: { alignItems: "center", borderRadius: 999, height: 40, justifyContent: "center", width: 40 },
  optionLabel: { fontSize: dashboardTypography.secondary.fontSize, fontWeight: "700", lineHeight: dashboardTypography.secondary.lineHeight },
  options: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
    subtitle: { fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
    title: {
      fontSize: dashboardTypography.compactPageTitle.fontSize + 2,
      fontWeight: "700",
      lineHeight: dashboardTypography.compactPageTitle.lineHeight + 2,
    },
});
