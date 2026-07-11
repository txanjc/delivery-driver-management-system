import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DriverHeader } from "@/components/shared/DriverHeader";
import { colors, spacing } from "@/theme/shared";

type ScreenProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  showProfileButton?: boolean;
}>;

const NATIVE_TAB_BAR_HEIGHT = 88;
const TAB_BAR_CONTENT_SPACING = 84;

export function Screen({ title, subtitle, action, children, eyebrow, showProfileButton = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { fontScale, width } = useWindowDimensions();
  const compact = width < 390 || fontScale > 1.08;
  const bottomContentInset = insets.bottom + NATIVE_TAB_BAR_HEIGHT + TAB_BAR_CONTENT_SPACING;

  return (
    <View style={styles.container}>
      <DriverHeader action={action} eyebrow={eyebrow} showProfileButton={showProfileButton} subtitle={subtitle} title={title} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset, paddingHorizontal: compact ? 18 : 20 }]} style={styles.scroller}>
        {children}
      </ScrollView>
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </Card>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export const textStyles = StyleSheet.create({
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroller: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.gap,
    paddingHorizontal: spacing.screen,
    paddingBottom: 32,
    paddingTop: spacing.gap,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  loading: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
});
