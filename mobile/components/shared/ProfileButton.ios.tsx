import { Link } from "expo-router";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";

import {
  dashboardMaxFontSizeMultipliers,
  getAvatarSize,
  getMinimumTouchTarget,
} from "@/components/dashboard/dashboardDesignSpec";
import { getProfileInitials } from "@/components/shared/profileButtonHelpers";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/shared";
import { triggerButtonHaptic } from "@/utils/haptics";

type ProfileButtonProps = {
  dashboardIcon?: boolean;
};

export function ProfileButton({ dashboardIcon = false }: ProfileButtonProps) {
  const { profile } = useAuth();
  const colorScheme = useColorScheme();
  const { fontScale, width } = useWindowDimensions();
  const label = getProfileInitials(profile) || "D";
  const glassAvailable = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const buttonSize = getAvatarSize(width) + (dashboardIcon ? 10 : 0);
  const touchSize = Math.max(getMinimumTouchTarget(width), buttonSize);
  const initialsFontSize = fontScale > 1.08 ? 15 : 16;
  const tintColor = colorScheme === "dark" ? "rgba(109, 74, 255, 0.16)" : "rgba(109, 74, 255, 0.2)";
  const fallbackColor = colorScheme === "dark" ? "rgba(109, 74, 255, 0.24)" : "rgba(109, 74, 255, 0.14)";
  const borderColor = colorScheme === "dark" ? "rgba(167, 139, 250, 0.3)" : "rgba(109, 74, 255, 0.22)";
  const iconColor = colorScheme === "dark" ? "#a78bfa" : colors.primary;
  const textColor = dashboardIcon ? iconColor : colorScheme === "dark" ? "#f8fafc" : colors.primary;

  return (
    <Link asChild href="/(driver)/profile">
      <Pressable accessibilityLabel="Open Driver Profile" accessibilityRole="button" onPressIn={triggerButtonHaptic} style={[styles.touchTarget, { height: touchSize, width: touchSize }]}>
        {glassAvailable ? (
          <GlassView colorScheme="auto" glassEffectStyle="regular" style={[styles.button, { borderColor, borderRadius: buttonSize / 2, height: buttonSize, width: buttonSize }]} tintColor={tintColor}>
            {dashboardIcon ? (
              <SymbolView fallback={null} name="person.fill" size={buttonSize * 0.48} tintColor={textColor} type="hierarchical" />
            ) : (
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} numberOfLines={1} style={[styles.text, { color: textColor, fontSize: initialsFontSize }]}>{label}</Text>
            )}
          </GlassView>
        ) : (
          <View style={[styles.button, styles.fallback, { backgroundColor: fallbackColor, borderColor, borderRadius: buttonSize / 2, height: buttonSize, width: buttonSize }]}>
            {dashboardIcon ? (
              <SymbolView fallback={null} name="person.fill" size={buttonSize * 0.48} tintColor={textColor} type="hierarchical" />
            ) : (
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} numberOfLines={1} style={[styles.text, { color: textColor, fontSize: initialsFontSize }]}>{label}</Text>
            )}
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  fallback: {
    shadowOpacity: 0.05,
  },
  text: {
    fontWeight: "800",
  },
});
