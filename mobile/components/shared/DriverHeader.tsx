import type { ReactNode } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProfileButton } from "@/components/shared/ProfileButton";
import { colors, spacing } from "@/theme/shared";

type DriverHeaderProps = {
  action?: ReactNode;
  eyebrow?: string;
  showProfileButton?: boolean;
  subtitle?: string;
  title: string;
};

export function DriverHeader({ action, eyebrow, showProfileButton = false, subtitle, title }: DriverHeaderProps) {
  const { fontScale, width } = useWindowDimensions();
  const compact = width < 390 || fontScale > 1.08;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={[styles.header, { paddingHorizontal: compact ? 18 : 20, paddingTop: compact ? 10 : 12 }]}>
        <View style={styles.headerText}>
          {eyebrow ? (
            <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={[styles.eyebrow, { fontSize: compact ? 15 : 16, lineHeight: compact ? 20 : 21 }]}>
              {eyebrow}
            </Text>
          ) : null}
          <Text adjustsFontSizeToFit maxFontSizeMultiplier={1.25} minimumFontScale={0.82} numberOfLines={1} style={[styles.title, { fontSize: compact ? 29 : 31, lineHeight: compact ? 33 : 35 }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={[styles.subtitle, { fontSize: compact ? 15 : 16, lineHeight: compact ? 20 : 21 }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {showProfileButton ? (
          <View style={styles.actions}>
            <ProfileButton />
          </View>
        ) : (
          action
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
  },
  eyebrow: {
    color: colors.muted,
  },
  title: {
    color: colors.text,
    fontWeight: "800",
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.primary,
    marginTop: 1,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 1,
  },
});
