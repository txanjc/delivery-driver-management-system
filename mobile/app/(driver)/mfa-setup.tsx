import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, useColorScheme, useWindowDimensions, View } from "react-native";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardSpacing,
  dashboardTypography,
  getCardRadius,
  getDashboardColors,
  getMinimumTouchTarget,
  getScreenHorizontalPadding,
} from "@/components/dashboard/dashboardDesignSpec";
import { LiquidGlassButton } from "@/components/shared/LiquidGlassButton";
import { supabase } from "@/lib/supabase";
import { triggerHaptic } from "@/utils/haptics";

type MfaSetup = {
  factorId: string;
  secret: string;
};

export default function MfaSetupScreen() {
  const colorScheme = useColorScheme();
  const colors = getDashboardColors(colorScheme);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardRadius = getCardRadius(width);
  const touchTarget = getMinimumTouchTarget(width);
  const horizontalPadding = getScreenHorizontalPadding(width);
  const mountedRef = useRef(true);
  const factorIdRef = useRef<string | null>(null);
  const verifiedRef = useRef(false);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const startEnrollment = useCallback(async () => {
    setLoading(true);
    setError(null);

    const factorsResponse = await supabase.auth.mfa.listFactors();
    if (factorsResponse.error) {
      if (mountedRef.current) {
        setError("We couldn’t start MFA setup. Please try again.");
        setLoading(false);
      }
      return;
    }

    const verifiedTotpFactors = factorsResponse.data.totp;
    if (verifiedTotpFactors.length >= 2) {
      if (mountedRef.current) {
        setError("You can have up to two authenticator apps.");
        setLoading(false);
      }
      return;
    }

    const unverifiedTotpFactors = factorsResponse.data.all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");
    await Promise.all(unverifiedTotpFactors.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })));

    const response = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: verifiedTotpFactors.length === 0 ? "DeliverEaze Driver" : "DeliverEaze Driver 2",
    });

    if (response.error || response.data.type !== "totp") {
      if (mountedRef.current) {
        setError("We couldn’t start MFA setup. Please try again.");
        setLoading(false);
      }
      return;
    }

    if (!mountedRef.current) {
      await supabase.auth.mfa.unenroll({ factorId: response.data.id });
      return;
    }

    factorIdRef.current = response.data.id;
    setCode("");
    setSetup({ factorId: response.data.id, secret: response.data.totp.secret });
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void startEnrollment();

    return () => {
      mountedRef.current = false;

      if (!verifiedRef.current && factorIdRef.current) {
        void supabase.auth.mfa.unenroll({ factorId: factorIdRef.current });
      }
    };
  }, [startEnrollment]);

  const close = () => {
    router.back();
  };

  const verify = async () => {
    if (!setup || code.trim().length !== 6 || verifying) return;

    setVerifying(true);
    setError(null);
    const response = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.factorId, code: code.trim() });

    if (response.error) {
      setError("That code didn’t work. Check your authenticator app and try again.");
      setVerifying(false);
      return;
    }

    verifiedRef.current = true;
    factorIdRef.current = null;
    triggerHaptic("success");
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevatedFallback }]}>
      <View
        style={[
          styles.content,
          {
            paddingBottom: dashboardSpacing.scale.md,
            paddingHorizontal: horizontalPadding,
            paddingTop: dashboardSpacing.scale.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.title, { color: colors.textPrimary }]}>Set Up MFA</Text>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.subtitle, { color: colors.textSecondary }]}>Secure your DeliverEaze account with an authenticator app.</Text>
          </View>
          <LiquidGlassButton accessibilityLabel="Close MFA Setup" capsule disabled={verifying} onPress={close} radius={touchTarget / 2} style={{ height: touchTarget, width: touchTarget }}>
            <SymbolView fallback={null} name="xmark" size={18} tintColor={colors.textPrimary} type="hierarchical" />
          </LiquidGlassButton>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.accent} />
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.subtitle, { color: colors.textSecondary }]}>Preparing your authenticator setup…</Text>
          </View>
        ) : setup ? (
          <>
            <View style={[styles.setupKeyCard, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}2E`, borderRadius: cardRadius }]}>
              <View style={styles.setupKeyHeader}>
                <View style={[styles.keyIcon, { backgroundColor: `${colors.accent}16` }]}>
                  <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="key.fill" size={19} tintColor={colors.accent} type="hierarchical" />
                </View>
                <View style={styles.setupKeyCopy}>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.label, { color: colors.textSecondary }]}>Setup Key</Text>
                  <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.keyDescription, { color: colors.textSecondary }]}>Choose manual entry in your authenticator app and enter this key.</Text>
                </View>
              </View>
              <Text selectable maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.secret, { color: colors.textPrimary }]}>{setup.secret}</Text>
            </View>

            <TextInput
              accessibilityLabel="Authenticator Code"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={setCode}
              placeholder="Enter 6-digit code"
              placeholderTextColor={colors.textTertiary}
              style={[styles.codeInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.subtleBorder, color: colors.textPrimary }]}
              textContentType="oneTimeCode"
              value={code}
            />
            {error ? <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            <LiquidGlassButton accessibilityLabel="Verify And Enable Multi-Factor Authentication" capsule disabled={code.trim().length !== 6 || verifying} onPress={() => { void verify(); }} radius={cardRadius} style={[styles.verifyButton, { backgroundColor: colors.accent, borderColor: colors.accent }]} variant="sectionAccent">
              {verifying ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={styles.verifyLabel}>Verify And Enable</Text>}
            </LiquidGlassButton>
          </>
        ) : (
          <View style={styles.errorState}>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.error, { color: colors.danger }]}>{error ?? "We couldn’t prepare MFA setup."}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void startEnrollment(); }} onPressIn={() => { triggerHaptic(); }} style={({ pressed }) => [styles.retryButton, { borderColor: colors.accent, opacity: pressed ? 0.74 : 1 }]}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={[styles.retryLabel, { color: colors.accent }]}>Try Again</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    borderRadius: dashboardSpacing.scale.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: dashboardTypography.control.fontSize,
    fontWeight: "600",
    letterSpacing: dashboardSpacing.scale.xs,
    minHeight: 48,
    paddingHorizontal: dashboardSpacing.scale.md,
    textAlign: "center",
  },
  container: {
  },
  content: {
    gap: dashboardSpacing.scale.xl,
  },
  error: {
    fontSize: dashboardTypography.tertiary.fontSize,
    lineHeight: dashboardTypography.tertiary.lineHeight,
    textAlign: "center",
  },
  errorState: {
    alignItems: "center",
    gap: dashboardSpacing.scale.md,
    justifyContent: "center",
    paddingVertical: dashboardSpacing.scale.xxl,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
  },
  headerCopy: {
    flex: 1,
    gap: dashboardSpacing.scale.xs,
  },
  keyDescription: {
    fontSize: dashboardTypography.tertiary.fontSize,
    lineHeight: dashboardTypography.tertiary.lineHeight,
  },
  keyIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  label: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  loadingState: {
    alignItems: "center",
    gap: dashboardSpacing.scale.md,
    justifyContent: "center",
    paddingVertical: dashboardSpacing.scale.xxl,
  },
  retryButton: {
    alignItems: "center",
    borderRadius: dashboardSpacing.scale.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: dashboardSpacing.scale.xl,
  },
  retryLabel: {
    fontSize: dashboardTypography.control.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.control.lineHeight,
  },
  secret: {
    fontFamily: "Courier",
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "600",
    letterSpacing: 1,
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  setupKeyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: dashboardSpacing.scale.lg,
    padding: dashboardSpacing.scale.xl,
  },
  setupKeyCopy: {
    flex: 1,
    gap: dashboardSpacing.scale.xxs,
  },
  setupKeyHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
  },
  subtitle: {
    fontSize: dashboardTypography.tertiary.fontSize,
    lineHeight: dashboardTypography.tertiary.lineHeight,
  },
  title: {
    fontSize: dashboardTypography.compactPageTitle.fontSize + 2,
    fontWeight: "700",
    lineHeight: dashboardTypography.compactPageTitle.lineHeight + 2,
  },
  verifyButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  verifyLabel: {
    color: "#FFFFFF",
    fontSize: dashboardTypography.control.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.control.lineHeight,
  },
});
