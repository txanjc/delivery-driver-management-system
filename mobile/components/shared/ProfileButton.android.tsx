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
  const buttonSize = dashboardIcon ? 52 : 42;

  return (
    <Link asChild href="/(driver)/profile">
      <Pressable accessibilityLabel="Open Driver Profile" accessibilityRole="button" onPressIn={triggerButtonHaptic} style={[styles.touchTarget, { height: touchSize, width: touchSize }]}>
        <View style={[styles.button, { borderRadius: buttonSize / 2, height: buttonSize, width: buttonSize }]}>
          {dashboardIcon ? (
            <SymbolView fallback={null} name="person.crop.circle" size={27} tintColor={colors.primary} type="hierarchical" />
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
    backgroundColor: "rgba(109, 74, 255, 0.14)",
    elevation: 2,
    justifyContent: "center",
  },
  text: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
});
