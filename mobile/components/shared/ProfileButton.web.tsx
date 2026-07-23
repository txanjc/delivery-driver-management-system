import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getProfileInitials } from "@/components/shared/profileButtonHelpers";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/shared";
import { triggerButtonHaptic } from "@/utils/haptics";

type ProfileButtonProps = {
  surface?: "default" | "onPurple";
};

export function ProfileButton({ surface = "default" }: ProfileButtonProps) {
  const { profile } = useAuth();
  const label = getProfileInitials(profile) || "D";
  const onPurple = surface === "onPurple";

  return (
    <Link asChild href="/(driver)/profile">
      <Pressable accessibilityLabel="Open Driver Profile" accessibilityRole="button" onPressIn={triggerButtonHaptic} style={styles.touchTarget}>
        <View style={[styles.button, onPurple ? styles.onPurpleButton : null]}>
          <Text style={[styles.text, onPurple ? styles.onPurpleText : null]}>{label}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  button: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  onPurpleButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderColor: "rgba(255, 255, 255, 0.42)",
  },
  text: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  onPurpleText: {
    color: "#FFFFFF",
  },
});
