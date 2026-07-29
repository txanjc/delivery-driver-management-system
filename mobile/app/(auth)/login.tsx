import { SymbolView } from "expo-symbols";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/hooks/useAuth";
import { triggerButtonHaptic } from "@/utils/haptics";

function AuthActionButton({ disabled, label, onLayout, onPress }: { disabled: boolean; label: string; onLayout?: (event: LayoutChangeEvent) => void; onPress: () => void }) {
  return (
    <View onLayout={onLayout} style={styles.authButtonFrame}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        onPressIn={triggerButtonHaptic}
        style={({ pressed }) => [styles.authPrimaryButton, disabled && styles.authPrimaryButtonDisabled, pressed && !disabled && styles.authPrimaryButtonPressed]}
      >
        <Text style={styles.authPrimaryButtonText}>{label}</Text>
      </Pressable>
    </View>
  );
}

function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("invalid login") || message.includes("credentials")) {
    return "Check your email and password and try again.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "We couldn’t reach DeliverEaze. Check your connection and try again.";
  }

  if (message.includes("verification")) {
    return "That verification code didn’t work. Try again.";
  }

  return "We couldn’t sign you in. Please try again.";
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { error: authError, loading, mfaRequired, signIn, signOut, verifyMfa } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginCardTop, setLoginCardTop] = useState(0);
  const [loginActionBottom, setLoginActionBottom] = useState(0);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const mfaBackgroundDrift = useRef(new Animated.Value(0)).current;
  const lockPulse = useRef(new Animated.Value(1)).current;
  const otpBoxScales = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const mfaInputRef = useRef<TextInput>(null);

  useEffect(() => {
    Keyboard.dismiss();
    if (!mfaRequired) setMfaCode("");
  }, [mfaRequired]);

  useEffect(() => {
    if (!mfaRequired) {
      mfaBackgroundDrift.stopAnimation();
      lockPulse.stopAnimation();
      mfaBackgroundDrift.setValue(0);
      lockPulse.setValue(1);
      return;
    }

    const backgroundAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(mfaBackgroundDrift, { duration: 14000, toValue: 1, useNativeDriver: true }),
        Animated.timing(mfaBackgroundDrift, { duration: 14000, toValue: 0, useNativeDriver: true }),
      ]),
    );
    const lockAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(lockPulse, { duration: 1600, toValue: 1.045, useNativeDriver: true }),
        Animated.timing(lockPulse, { duration: 1600, toValue: 1, useNativeDriver: true }),
      ]),
    );

    backgroundAnimation.start();
    lockAnimation.start();

    return () => {
      backgroundAnimation.stop();
      lockAnimation.stop();
    };
  }, [lockPulse, mfaBackgroundDrift, mfaRequired]);

  useEffect(() => {
    const enteredIndex = mfaCode.length - 1;
    if (enteredIndex < 0 || enteredIndex >= otpBoxScales.length) return;

    otpBoxScales[enteredIndex].setValue(0.88);
    Animated.spring(otpBoxScales[enteredIndex], {
      damping: 11,
      mass: 0.48,
      stiffness: 300,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [mfaCode, otpBoxScales]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const synchronizeLayout = (event: Parameters<typeof Keyboard.scheduleLayoutAnimation>[0]) => {
      Keyboard.scheduleLayoutAnimation(event);
    };
    const showSubscription = Keyboard.addListener("keyboardWillShow", synchronizeLayout);
    const hideSubscription = Keyboard.addListener("keyboardWillHide", synchronizeLayout);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (mfaRequired) return;

    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const availableHeight = Math.min(scrollViewportHeight, event.endCoordinates.screenY);
        const targetOffset = Math.max(0, loginCardTop + loginActionBottom - availableHeight + 70);
        scrollViewRef.current?.scrollTo({ animated: true, y: targetOffset });
      }, 50);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      scrollViewRef.current?.scrollTo({ animated: true, y: 0 });
    });

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [loginActionBottom, loginCardTop, mfaRequired, scrollViewportHeight]);

  const submitPassword = async () => {
    setHasSubmitted(true);
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your driver email and password.");
      return;
    }

    Keyboard.dismiss();
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(getFriendlyError(caught));
    }
  };

  const submitMfa = async () => {
    setHasSubmitted(true);
    setError(null);
    if (mfaCode.trim().length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    Keyboard.dismiss();
    try {
      await verifyMfa(mfaCode);
    } catch (caught) {
      setError(getFriendlyError(caught));
    }
  };

  const primaryText = "#17151F";
  const secondaryText = "#717080";
  const cardBackground = "rgba(255,255,255,0.90)";
  const fieldBackground = "rgba(246,246,250,0.92)";
  const fieldBorder = "rgba(25,22,35,0.06)";
  const mfaBackgroundTranslateY = mfaBackgroundDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  return (
    <View style={styles.screen}>
      {mfaRequired ? (
        <Animated.View style={[styles.mfaBackgroundLayer, { transform: [{ translateY: mfaBackgroundTranslateY }] }]}>
          <ImageBackground imageStyle={styles.mfaBackgroundImage} source={require("../../assets/images/mfa-driver.png")} style={StyleSheet.absoluteFill} resizeMode="cover">
            <LinearGradient colors={["rgba(38,8,67,0.28)", "rgba(29,7,58,0.48)", "rgba(18,3,46,0.88)"]} end={{ x: 0.5, y: 1 }} locations={[0, 0.42, 1]} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
          </ImageBackground>
        </Animated.View>
      ) : (
        <ImageBackground imageStyle={styles.backgroundImage} source={require("../../assets/images/login-driver.png")} style={StyleSheet.absoluteFill} resizeMode="cover">
          <LinearGradient colors={["rgba(31,11,70,0.20)", "rgba(31,11,70,0.36)", "rgba(22,5,54,0.84)"]} end={{ x: 0.5, y: 1 }} locations={[0, 0.42, 1]} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
        </ImageBackground>
      )}
      <BlurView intensity={18} pointerEvents="none" style={styles.bottomBackgroundBlur} tint="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardArea}>
      <ScrollView automaticallyAdjustKeyboardInsets={false} bounces={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + (mfaRequired ? 24 : 34), paddingTop: insets.top + 24 }]} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onLayout={(event) => setScrollViewportHeight(event.nativeEvent.layout.height)} ref={scrollViewRef}>
        <View style={styles.flexSpacer} />
        <View
          onLayout={(event) => {
            if (!mfaRequired) {
              setLoginCardTop(event.nativeEvent.layout.y);
            }
          }}
          style={styles.cardMotion}
        >
        <BlurView intensity={75} tint="light" style={[styles.card, styles.signInCard, mfaRequired && styles.mfaCard, { backgroundColor: cardBackground, borderColor: "rgba(255,255,255,0.65)" }]}>
          {mfaRequired ? (
            <>
              <Animated.View style={[styles.mfaIcon, { transform: [{ scale: lockPulse }] }]}>
                <Image accessibilityLabel="DeliverEaze Logistics" resizeMode="contain" source={require("../../assets/images/delivereaze-card-logo.png")} style={styles.cardLogo} />
              </Animated.View>
              <Text style={[styles.title, { color: primaryText }]}>Verify It’s You</Text>
              <Text style={[styles.subtitle, { color: secondaryText }]}>Enter the 6-digit code from your authenticator app to finish signing in.</Text>
              <View style={styles.otpInputArea}>
                {Array.from({ length: 6 }, (_, index) => (
                  <Animated.View key={index} style={[styles.otpBox, { backgroundColor: fieldBackground, borderColor: mfaCode[index] ? "rgba(108,67,255,0.68)" : fieldBorder, transform: [{ scale: otpBoxScales[index] }] }]}>
                    <Text style={[styles.otpDigit, { color: primaryText }]}>{mfaCode[index] ?? ""}</Text>
                  </Animated.View>
                ))}
                <TextInput
                  ref={mfaInputRef}
                  accessibilityLabel="Multi-factor authentication code"
                  autoComplete="one-time-code"
                  caretHidden
                  contextMenuHidden={false}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => setMfaCode(value.replace(/\D/g, "").slice(0, 6))}
                  selectTextOnFocus={false}
                  style={styles.hiddenOtpInput}
                  textContentType="oneTimeCode"
                  value={mfaCode}
                />
              </View>
              <AuthActionButton disabled={loading || mfaCode.trim().length !== 6} label={loading ? "Verifying…" : "Verify"} onPress={() => { void submitMfa(); }} />
              <Pressable accessibilityRole="button" disabled={loading} onPress={() => { void signOut(); }} onPressIn={triggerButtonHaptic} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Use a different account</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Image accessibilityLabel="DeliverEaze Logistics" resizeMode="contain" source={require("../../assets/images/delivereaze-card-logo.png")} style={styles.cardLogo} />
              <Text style={[styles.title, { color: primaryText }]}>Welcome</Text>
              <Text style={[styles.subtitle, { color: secondaryText }]}>Sign in to continue to DeliverEaze Driver.</Text>
              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: secondaryText }]}>Email</Text>
                  <TextInput ref={emailInputRef} accessibilityLabel="Driver email" autoCapitalize="none" autoComplete="email" editable={!loading} keyboardType="email-address" onChangeText={setEmail} placeholder="driver@delivereaze.com" placeholderTextColor="#A4A1AF" returnKeyType="next" style={[styles.input, { backgroundColor: fieldBackground, borderColor: fieldBorder, color: primaryText }]} textContentType="emailAddress" value={email} />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: secondaryText }]}>Password</Text>
                  <View style={[styles.passwordField, { backgroundColor: fieldBackground, borderColor: fieldBorder }]}>
                    <TextInput accessibilityLabel="Password" autoComplete="password" editable={!loading} onChangeText={setPassword} onSubmitEditing={() => { void submitPassword(); }} placeholder="Enter your password" placeholderTextColor="#A4A1AF" returnKeyType="go" secureTextEntry={!passwordVisible} style={[styles.passwordInput, { color: primaryText }]} textContentType="password" value={password} />
                    <Pressable accessibilityLabel={passwordVisible ? "Hide password" : "Show password"} accessibilityRole="button" hitSlop={12} onPress={() => setPasswordVisible((value) => !value)} style={styles.showPassword}>
                      <SymbolView fallback={null} name={passwordVisible ? "eye.slash" : "eye"} size={20} tintColor="#6D4AFF" type="hierarchical" />
                    </Pressable>
                  </View>
                </View>
              </View>
              <AuthActionButton disabled={loading} label={loading ? "Signing In…" : "Sign In"} onLayout={(event) => setLoginActionBottom(event.nativeEvent.layout.y + event.nativeEvent.layout.height)} onPress={() => { void submitPassword(); }} />
            </>
          )}
          {hasSubmitted && (error || authError) ? (
            <View style={styles.errorRow}>
              <SymbolView fallback={null} name="exclamationmark.circle.fill" size={16} tintColor="#D92D55" type="hierarchical" />
              <Text style={styles.error}>{error ?? authError}</Text>
            </View>
          ) : null}
        </BlurView>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { transform: [{ scale: 1.04 }, { translateY: -18 }] },
  bottomBackgroundBlur: { bottom: 0, left: 0, position: "absolute", right: 0, top: "50%" },
  card: { alignItems: "center", borderRadius: 32, borderWidth: StyleSheet.hairlineWidth, gap: 14, justifyContent: "center", overflow: "hidden", padding: 20, shadowColor: "#17121F", shadowOffset: { height: 12, width: 0 }, shadowOpacity: 0.16, shadowRadius: 26, width: "100%" },
  cardMotion: { width: "100%" },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  error: { color: "#B42345", flex: 1, fontSize: 14, lineHeight: 19 },
  errorRow: { alignItems: "flex-start", backgroundColor: "rgba(217,45,85,0.10)", borderRadius: 12, flexDirection: "row", gap: 8, padding: 10, width: "100%" },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 15, fontWeight: "600" },
  flexSpacer: { flex: 1 },
  form: { gap: 14, width: "100%" },
  cardLogo: { height: 50, width: 152 },
  hiddenOtpInput: { ...StyleSheet.absoluteFillObject, color: "transparent", opacity: 0.02, zIndex: 1 },
  input: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, fontSize: 17, height: 56, paddingHorizontal: 16, width: "100%" },
  keyboardArea: { flex: 1 },
  mfaBackgroundImage: { transform: [{ scale: 1.1 }, { translateY: -46 }] },
  mfaBackgroundLayer: { bottom: -18, left: -12, position: "absolute", right: -12, top: -18 },
  mfaCard: { gap: 12, paddingVertical: 18 },
  mfaIcon: { marginBottom: 3 },
  otpBox: { alignItems: "center", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flex: 1, height: 54, justifyContent: "center" },
  otpDigit: { fontSize: 24, fontWeight: "700", lineHeight: 28 },
  otpInputArea: { flexDirection: "row", gap: 7, marginBottom: 6, position: "relative", width: "100%" },
  passwordField: { alignItems: "center", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", height: 56, width: "100%" },
  passwordInput: { flex: 1, fontSize: 17, height: 56, paddingHorizontal: 16 },
  authButtonFrame: { alignSelf: "stretch", marginTop: 2, width: "100%" },
  authPrimaryButton: { alignItems: "center", backgroundColor: "#7C3AED", borderColor: "#7C3AED", borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center", minHeight: 56, shadowColor: "#6C43FF", shadowOffset: { height: 6, width: 0 }, shadowOpacity: 0.24, shadowRadius: 12, width: "100%" },
  authPrimaryButtonDisabled: { opacity: 0.48 },
  authPrimaryButtonPressed: { backgroundColor: "#6D4AFF", transform: [{ scale: 0.99 }] },
  authPrimaryButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  screen: { flex: 1 },
  secondaryAction: { alignItems: "center", justifyContent: "center", minHeight: 28, paddingHorizontal: 14 },
  secondaryActionText: { color: "#5F45C9", fontSize: 14, fontWeight: "600" },
  showPassword: { alignItems: "center", height: 44, justifyContent: "center", marginRight: 6, width: 44 },
  signInCard: { marginTop: 24 },
  subtitle: { fontSize: 17, fontWeight: "400", lineHeight: 24, textAlign: "center" },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.6, lineHeight: 36, textAlign: "center" },
});
