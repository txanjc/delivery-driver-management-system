import { SymbolView } from "expo-symbols";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardScrollEdge,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getCardPadding,
  getCardRadius,
  getDashboardColors,
  getScrollEdgeFadeExtension,
  getMinimumTouchTarget,
  getResponsiveValue,
  getScreenHorizontalPadding,
} from "@/components/dashboard/dashboardDesignSpec";
import { LiquidGlassButton } from "@/components/shared/LiquidGlassButton";
import { ScrollEdgeBlur } from "@/components/shared/ScrollEdgeBlur";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { triggerButtonHaptic } from "@/utils/haptics";

function displayName(firstName: string | null | undefined, lastName: string | null | undefined, email: string | null | undefined) {
  return [firstName, lastName].filter(Boolean).join(" ") || email || "Driver";
}

function profileInitials(firstName: string | null | undefined, lastName: string | null | undefined, email: string | null | undefined) {
  const initials = [firstName, lastName]
    .filter(Boolean)
    .map((part) => part?.trim().charAt(0).toUpperCase())
    .join("");

  return initials || email?.trim().charAt(0).toUpperCase() || "D";
}

function formatAvailability(availability: string | null | undefined) {
  if (!availability) return "Not Set";

  return availability
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLicenseExpiry(expiryDate: string | null | undefined) {
  if (!expiryDate) return "Not Available";

  const parsedDate = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return expiryDate;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function getPerformanceScore(score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;

  return Math.min(100, Math.max(0, score));
}

type ProfileInfoRowProps = {
  colors: ReturnType<typeof getDashboardColors>;
  icon: "calendar" | "doc.text.fill" | "envelope.fill" | "phone.fill";
  label: string;
  value: string;
};

function ProfileInfoRow({ colors, icon, label, value }: ProfileInfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: `${colors.accent}14` }]}>
        <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name={icon} size={16} tintColor={colors.accent} type="hierarchical" />
      </View>
      <View style={styles.infoCopy}>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}

type PreferenceRowProps = {
  colors: ReturnType<typeof getDashboardColors>;
  icon: "clock.fill" | "globe" | "paintbrush.fill";
  label: string;
};

function PreferenceRow({ colors, icon, label }: PreferenceRowProps) {
  return (
    <View style={styles.preferenceRow}>
      <View style={[styles.infoIcon, { backgroundColor: `${colors.accent}14` }]}>
        <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name={icon} size={16} tintColor={colors.accent} type="hierarchical" />
      </View>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.preferenceLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.preferenceValue, { color: colors.textSecondary }]}>System Default</Text>
    </View>
  );
}

type AuthenticatorFactor = {
  created_at: string;
  factor_type: "totp";
  friendly_name?: string;
  id: string;
  status: "verified";
  updated_at: string;
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = getDashboardColors(colorScheme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { driver, profile, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const cardPadding = getCardPadding(width);
  const cardRadius = getCardRadius(width);
  const horizontalPadding = getScreenHorizontalPadding(width);
  const touchTarget = getMinimumTouchTarget(width);
  const avatarSize = getResponsiveValue(width, { compact: 88, standard: 96, large: 104 });
  const profileCardShadow = isDark
    ? {
        elevation: 16,
        shadowColor: "#8B5CF6",
        shadowOffset: { width: 0, height: 11 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
      }
    : {
        elevation: 7,
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.13,
        shadowRadius: 16,
      };
  const profileAvatarShadow = isDark
    ? {
        elevation: 12,
        shadowColor: "#8B5CF6",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.34,
        shadowRadius: 18,
      }
    : {
        elevation: 6,
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
      };
  const fullName = displayName(profile?.first_name, profile?.last_name, profile?.email);
  const performanceScore = getPerformanceScore(driver?.performance_score);
  const [authenticatorFactors, setAuthenticatorFactors] = useState<AuthenticatorFactor[]>([]);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaStatusLoading, setMfaStatusLoading] = useState(true);
  const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);
  const [headerElevated, setHeaderElevated] = useState(false);
  const mfaEnabled = authenticatorFactors.length > 0;
  const canAddAuthenticator = authenticatorFactors.length < 2;

  const loadMfaStatus = useCallback(async () => {
    setMfaStatusLoading(true);
    const response = await supabase.auth.mfa.listFactors();
    if (response.error) {
      setAuthenticatorFactors([]);
      setMfaError("We couldn’t load your authenticators. Pull down to try again.");
    } else {
      setAuthenticatorFactors(response.data.totp);
      setMfaError(null);
    }
    setMfaStatusLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMfaStatus();
    }, [loadMfaStatus]),
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(driver)/(tabs)");
  };

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const shouldElevate = event.nativeEvent.contentOffset.y > dashboardSpacing.scale.xs;
    setHeaderElevated((current) => (current === shouldElevate ? current : shouldElevate));
  }, []);

  const removeAuthenticator = useCallback(async (factorId: string) => {
    if (removingFactorId) return;

    setRemovingFactorId(factorId);
    setMfaError(null);
    const response = await supabase.auth.mfa.unenroll({ factorId });

    if (response.error) {
      setMfaError("We couldn’t remove that authenticator. Please try again.");
    } else {
      await loadMfaStatus();
    }

    setRemovingFactorId(null);
  }, [loadMfaStatus, removingFactorId]);

  const confirmAuthenticatorRemoval = useCallback((factor: AuthenticatorFactor) => {
    Alert.alert(
      "Remove authenticator?",
      authenticatorFactors.length === 1
        ? "Removing this authenticator turns off multi-factor authentication for your account."
        : "You’ll still have another authenticator available to sign in.",
      [
        { style: "cancel", text: "Cancel" },
        { onPress: () => { void removeAuthenticator(factor.id); }, style: "destructive", text: "Remove" },
      ],
    );
  }, [authenticatorFactors.length, removeAuthenticator]);

  const scrollEdgeHeight =
    insets.top +
    dashboardSpacing.scale.xs +
    touchTarget +
    dashboardSpacing.scale.md +
    getScrollEdgeFadeExtension(width) +
    dashboardSpacing.scale.xxxl;

  return (
    <View style={[styles.container, { backgroundColor: colors.dashboardBackground }]}>
      <View style={[styles.staticHeader, { backgroundColor: colors.dashboardBackground, paddingTop: insets.top + dashboardSpacing.scale.xs }]}>
        <View style={[styles.navigationRow, { maxWidth: dashboardSpacing.contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
          <LiquidGlassButton accessibilityLabel="Go Back" capsule onPress={goBack} radius={touchTarget / 2} style={[styles.backButton, { height: touchTarget, width: touchTarget }]}>
            <SymbolView fallback={<Text style={[styles.backFallback, { color: colors.textPrimary }]}>‹</Text>} name="chevron.left" size={18} tintColor={colors.textPrimary} type="hierarchical" />
          </LiquidGlassButton>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.navigationTitle, { color: colors.textPrimary }]}>Profile</Text>
          <View style={{ height: touchTarget, width: touchTarget }} />
        </View>
        {headerElevated ? (
          <View
            pointerEvents="none"
            style={[styles.headerScrollEdge, { height: scrollEdgeHeight, zIndex: 0 }]}
          >
            <ScrollEdgeBlur
              blurIntensity={dashboardScrollEdge.blurIntensity}
              blurTint={colors.scrollEdgeBlurTint}
              maskColors={dashboardScrollEdge.maskColors}
              maskLocations={dashboardScrollEdge.maskLocations}
              tintColors={colors.scrollEdgeTintGradientColors}
              tintLocations={dashboardScrollEdge.tintLocations}
            />
          </View>
        ) : null}
      </View>

      <ScrollView
        alwaysBounceVertical
        bounces
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: dashboardSpacing.contentMaxWidth,
            paddingBottom: insets.bottom + dashboardSpacing.scale.xxxl,
            paddingHorizontal: horizontalPadding,
            paddingTop: dashboardSpacing.scale.xl,
          },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
      >
        <View style={styles.hero}>
          <View accessibilityLabel={`${fullName} Profile Initials`} style={[styles.avatar, profileAvatarShadow, { backgroundColor: `${colors.accent}1F`, height: avatarSize, width: avatarSize }]}>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.metric} style={[styles.avatarInitials, { color: colors.accent }]}>{profileInitials(profile?.first_name, profile?.last_name, profile?.email)}</Text>
          </View>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.pageTitle} style={[styles.name, { color: colors.textPrimary }]}>{fullName}</Text>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.role, { color: colors.textSecondary }]}>DeliverEaze Driver</Text>
          <View style={[styles.accountPill, { backgroundColor: `${colors.accent}12`, borderColor: `${colors.accent}2E` }]}>
            <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="checkmark.circle.fill" size={14} tintColor={colors.accent} type="hierarchical" />
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.accountPillText, { color: colors.accent }]}>{profile?.is_active ? "Active Account" : "Account Status Unavailable"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contact</Text>
          <View style={[styles.detailsCard, dashboardShadows.subtleCard, profileCardShadow, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
            <ProfileInfoRow colors={colors} icon="envelope.fill" label="Email" value={profile?.email ?? "Email Unavailable"} />
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <ProfileInfoRow colors={colors} icon="phone.fill" label="Phone" value={profile?.phone ?? "Phone Unavailable"} />
          </View>
        </View>

        <View style={styles.section}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Work Status</Text>
          <View style={[styles.availabilityCard, dashboardShadows.subtleCard, profileCardShadow, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
            <View style={[styles.infoIcon, { backgroundColor: `${colors.accent}14` }]}>
              <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="person.badge.clock.fill" size={17} tintColor={colors.accent} type="hierarchical" />
            </View>
            <View style={styles.infoCopy}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.infoLabel, { color: colors.textSecondary }]}>Availability</Text>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.infoValue, { color: colors.textPrimary }]}>{formatAvailability(driver?.availability)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Driver Credentials</Text>
          <View style={[styles.detailsCard, dashboardShadows.subtleCard, profileCardShadow, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
            <ProfileInfoRow colors={colors} icon="doc.text.fill" label="License Number" value={driver?.license_number ?? "Not Available"} />
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <ProfileInfoRow colors={colors} icon="calendar" label="License Expiry" value={formatLicenseExpiry(driver?.license_expiry_date)} />
          </View>
        </View>

        <View style={styles.section}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Performance</Text>
          <View style={[styles.performanceCard, dashboardShadows.subtleCard, profileCardShadow, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
            <View style={styles.performanceHeader}>
              <View style={styles.performanceCopy}>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.infoLabel, { color: colors.textSecondary }]}>Driver Score</Text>
                <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.performanceDescription, { color: colors.textSecondary }]}>Current score recorded by DeliverEaze.</Text>
              </View>
              <Text accessibilityLabel={performanceScore === null ? "Performance Score Unavailable" : `Performance Score ${Math.round(performanceScore)} Percent`} maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.metric} style={[styles.performanceValue, { color: colors.accent }]}>{performanceScore === null ? "—" : `${Math.round(performanceScore)}%`}</Text>
            </View>
            <View accessibilityLabel={performanceScore === null ? "Performance Score Unavailable" : `Performance Score ${Math.round(performanceScore)} Out Of 100`} accessibilityRole="progressbar" accessibilityValue={performanceScore === null ? undefined : { max: 100, min: 0, now: performanceScore }} style={[styles.performanceTrack, { backgroundColor: `${colors.accent}16` }]}>
              <View style={[styles.performanceFill, { backgroundColor: colors.accent, width: `${performanceScore ?? 0}%` }]} />
            </View>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.performanceCaption, { color: colors.textTertiary }]}>Score out of 100</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Security</Text>
          <View style={[styles.securityCard, dashboardShadows.subtleCard, profileCardShadow, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, paddingHorizontal: cardPadding, paddingVertical: cardPadding }]}>
            <View style={styles.securityRow}>
            <View style={styles.infoCopy}>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.infoValue, { color: colors.textPrimary }]}>Multi-Factor Authentication</Text>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.performanceDescription, { color: colors.textSecondary }]}>{mfaEnabled ? `${authenticatorFactors.length} authenticator${authenticatorFactors.length === 1 ? "" : "s"} enrolled.` : "Protect your account with an authenticator app."}</Text>
            </View>
            {mfaStatusLoading ? <ActivityIndicator color={colors.accent} size="small" /> : mfaEnabled ? <View style={[styles.mfaStatePill, { backgroundColor: `${colors.accent}12`, borderColor: `${colors.accent}2E` }]}><Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.mfaStateText, { color: colors.accent }]}>Enabled</Text></View> : null}
            </View>

            {mfaStatusLoading ? null : authenticatorFactors.map((factor, index) => (
              <View key={factor.id}>
                <View style={[styles.divider, { backgroundColor: colors.divider, marginLeft: 0 }]} />
                <View style={styles.authenticatorRow}>
                  <View style={[styles.infoIcon, { backgroundColor: `${colors.accent}14` }]}>
                    <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="key.fill" size={16} tintColor={colors.accent} type="hierarchical" />
                  </View>
                  <View style={styles.infoCopy}>
                    <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.infoValue, { color: colors.textPrimary }]}>{factor.friendly_name?.trim() || `Authenticator ${index + 1}`}</Text>
                    <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.performanceDescription, { color: colors.textSecondary }]}>Authenticator app</Text>
                  </View>
                  <LiquidGlassButton
                    accentColor={colors.danger}
                    accessibilityLabel={`Remove ${factor.friendly_name?.trim() || `Authenticator ${index + 1}`}`}
                    accessibilityRole="button"
                    accessibilityState={{ busy: removingFactorId === factor.id, disabled: removingFactorId !== null }}
                    capsule
                    disabled={removingFactorId !== null}
                    hitSlop={8}
                    onPress={() => { confirmAuthenticatorRemoval(factor); }}
                    radius={999}
                    style={styles.removeAuthenticatorButton}
                    variant="primaryAccent"
                  >
                    {removingFactorId === factor.id ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.removeAuthenticatorLabel, { color: "#FFFFFF" }]}>Remove</Text>}
                  </LiquidGlassButton>
                </View>
              </View>
            ))}

            {mfaStatusLoading ? null : canAddAuthenticator ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.divider, marginLeft: 0 }]} />
                <Pressable
                  accessibilityHint={mfaEnabled ? "Set up a second authenticator app." : "Set up an authenticator app for multi-factor authentication."}
                  accessibilityLabel={mfaEnabled ? "Add a Second Authenticator" : "Set Up Multi-Factor Authentication"}
                  accessibilityRole="button"
                  onPress={() => { router.push("/(driver)/mfa-setup"); }}
                  onPressIn={triggerButtonHaptic}
                  style={({ pressed }) => [styles.addAuthenticatorRow, { opacity: pressed ? 0.72 : 1 }]}
                >
                  <View style={[styles.infoIcon, { backgroundColor: `${colors.accent}14` }]}>
                    <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="plus" size={16} tintColor={colors.accent} type="hierarchical" />
                  </View>
                  <View style={styles.infoCopy}>
                    <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.infoValue, { color: colors.accent }]}>{mfaEnabled ? "Add a Second Authenticator" : "Set Up Authenticator"}</Text>
                    <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.performanceDescription, { color: colors.textSecondary }]}>{mfaEnabled ? "Use a second app as a secure backup." : "Use an authenticator app to protect your account."}</Text>
                  </View>
                  <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="chevron.right" size={15} tintColor={colors.textTertiary} type="hierarchical" />
                </Pressable>
              </>
            ) : null}

            {mfaError ? <Text accessibilityRole="alert" maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.tertiary} style={[styles.mfaError, { color: colors.danger }]}>{mfaError}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: colors.textPrimary }]}>Preferences</Text>
          <View style={[styles.detailsCard, dashboardShadows.subtleCard, profileCardShadow, { backgroundColor: colors.surfaceElevated, borderColor: colors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
            <PreferenceRow colors={colors} icon="globe" label="Language" />
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <PreferenceRow colors={colors} icon="paintbrush.fill" label="Theme" />
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <PreferenceRow colors={colors} icon="clock.fill" label="Time Zone" />
          </View>
        </View>

        <Pressable
          accessibilityLabel="Sign Out"
          accessibilityRole="button"
          onPress={() => { void signOut(); }}
          onPressIn={triggerButtonHaptic}
          style={({ pressed }) => [styles.signOutButton, { backgroundColor: colors.danger, borderColor: colors.danger, borderRadius: cardRadius, minHeight: touchTarget, opacity: pressed ? 0.8 : 1 }]}
        >
          <SymbolView accessibilityElementsHidden fallback={null} importantForAccessibility="no" name="rectangle.portrait.and.arrow.right" size={17} tintColor="#FFFFFF" type="hierarchical" />
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.control} style={styles.signOutLabel}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  accountPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: dashboardSpacing.scale.xs,
    paddingHorizontal: dashboardSpacing.scale.sm,
    paddingVertical: dashboardSpacing.scale.xs,
  },
  accountPillText: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  avatar: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: dashboardTypography.metric.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.metric.lineHeight,
  },
  availabilityCard: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
  },
  addAuthenticatorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    minHeight: 64,
  },
  authenticatorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    minHeight: 64,
  },
  backButton: {
    alignSelf: "flex-start",
  },
  backFallback: {
    fontSize: dashboardTypography.control.fontSize + 4,
    lineHeight: dashboardTypography.control.lineHeight,
  },
  container: {
    flex: 1,
  },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    gap: dashboardSpacing.scale.xl,
    width: "100%",
  },
  detailsCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: dashboardSpacing.scale.xl + dashboardSpacing.scale.md,
    marginVertical: dashboardSpacing.scale.xs,
  },
  hero: {
    alignItems: "center",
    gap: dashboardSpacing.scale.sm,
  },
  headerScrollEdge: {
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  infoCopy: {
    flex: 1,
    gap: dashboardSpacing.scale.xxs,
  },
  infoIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  infoLabel: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    minHeight: 56,
  },
  infoValue: {
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "500",
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  mfaStatePill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: dashboardSpacing.scale.sm,
    paddingVertical: dashboardSpacing.scale.xs,
  },
  mfaStateText: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  mfaError: {
    fontSize: dashboardTypography.tertiary.fontSize,
    lineHeight: dashboardTypography.tertiary.lineHeight,
    paddingTop: dashboardSpacing.scale.sm,
  },
  name: {
    fontSize: dashboardTypography.metric.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.metric.lineHeight,
    textAlign: "center",
  },
  navigationRow: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: dashboardSpacing.scale.md,
    width: "100%",
    zIndex: 1,
  },
  navigationTitle: {
    fontSize: dashboardTypography.compactPageTitle.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.compactPageTitle.lineHeight,
  },
  performanceCaption: {
    fontSize: dashboardTypography.caption.fontSize,
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  performanceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: dashboardSpacing.scale.sm,
  },
  performanceCopy: {
    flex: 1,
    gap: dashboardSpacing.scale.xxs,
  },
  performanceDescription: {
    fontSize: dashboardTypography.tertiary.fontSize,
    lineHeight: dashboardTypography.tertiary.lineHeight,
  },
  performanceFill: {
    borderRadius: 999,
    height: "100%",
  },
  performanceHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    justifyContent: "space-between",
  },
  performanceTrack: {
    borderRadius: 999,
    height: dashboardSpacing.scale.sm,
    overflow: "hidden",
  },
  performanceValue: {
    fontSize: dashboardTypography.metric.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.metric.lineHeight,
  },
  preferenceLabel: {
    flex: 1,
    fontSize: dashboardTypography.secondary.fontSize,
    fontWeight: "500",
    lineHeight: dashboardTypography.secondary.lineHeight,
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    minHeight: 56,
  },
  preferenceValue: {
    fontSize: dashboardTypography.tertiary.fontSize,
    lineHeight: dashboardTypography.tertiary.lineHeight,
    textAlign: "right",
  },
  role: {
    fontSize: dashboardTypography.secondary.fontSize,
    lineHeight: dashboardTypography.secondary.lineHeight,
    textAlign: "center",
  },
  removeAuthenticatorButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    minWidth: 60,
    paddingHorizontal: dashboardSpacing.scale.sm,
  },
  removeAuthenticatorLabel: {
    fontSize: dashboardTypography.caption.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.caption.lineHeight,
  },
  section: {
    gap: dashboardSpacing.scale.md,
  },
  sectionTitle: {
    fontSize: dashboardTypography.compactPageTitle.fontSize,
    fontWeight: "700",
    lineHeight: dashboardTypography.compactPageTitle.lineHeight,
  },
  securityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.scale.md,
    minHeight: 64,
  },
  securityCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  signOutButton: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: dashboardSpacing.scale.sm,
    justifyContent: "center",
  },
  signOutLabel: {
    color: "#FFFFFF",
    fontSize: dashboardTypography.control.fontSize,
    fontWeight: "600",
    lineHeight: dashboardTypography.control.lineHeight,
  },
  staticHeader: {
    zIndex: 2,
  },
});
