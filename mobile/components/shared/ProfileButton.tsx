import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { getProfileInitials } from "@/components/shared/profileButtonHelpers";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/shared";
import { triggerButtonHaptic } from "@/utils/haptics";

type ProfileButtonProps = {
  dashboardIcon?: boolean;
};

export function ProfileButton({ dashboardIcon = false }: ProfileButtonProps) {
  const { profile } = useAuth();
  const label = getProfileInitials(profile) || "D";
  const touchSize = dashboardIcon ? 58 : 48;
  const buttonSize = dashboardIcon ? 50 : 40;

  return (
    <Link asChild href="/(driver)/profile">
      <Pressable accessibilityLabel="Open Driver Profile" accessibilityRole="button" onPressIn={triggerButtonHaptic} style={[styles.touchTarget, { height: touchSize, width: touchSize }]}>
        <View style={[styles.button, { borderRadius: buttonSize / 2, height: buttonSize, width: buttonSize }]}>
          {dashboardIcon ? (
            <SymbolView fallback={null} name="person.crop.circle" size={26} tintColor={colors.primary} type="hierarchical" />
          ) : (
            <Text style={styles.text}>{label}</Text>
          )}
        </View>
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderColor: "rgba(148, 163, 184, 0.36)",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  text: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
});
