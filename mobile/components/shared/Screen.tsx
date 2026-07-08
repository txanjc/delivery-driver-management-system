import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme/shared";

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
}>;

export function Screen({ title, subtitle, action, children }: ScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </ScrollView>
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
  content: {
    gap: spacing.gap,
    padding: spacing.screen,
    paddingBottom: 32,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
