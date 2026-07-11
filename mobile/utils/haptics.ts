import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

type HapticKind = "selection" | "light" | "medium" | "success";

function canUseHaptics() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function triggerHaptic(kind: HapticKind = "selection") {
  if (!canUseHaptics()) return;

  if (kind === "success") {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    return;
  }

  if (kind === "medium") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    return;
  }

  if (kind === "light") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    return;
  }

  void Haptics.selectionAsync().catch(() => undefined);
}

export function triggerButtonHaptic() {
  triggerHaptic("selection");
}

export function triggerRefreshReadyHaptic() {
  triggerHaptic("light");
}

export function triggerRefreshStartHaptic() {
  triggerHaptic("medium");
}
