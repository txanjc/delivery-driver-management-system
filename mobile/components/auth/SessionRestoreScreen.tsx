import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";

export function SessionRestoreScreen() {
  const isDark = useColorScheme() === "dark";
  const accent = isDark ? "#B7A2FF" : "#6D4AFF";

  return (
    <LinearGradient
      colors={isDark ? ["#111014", "#1A1721", "#111014"] : ["#FAF9FD", "#F2F0F8", "#FAF9FD"]}
      end={{ x: 0.82, y: 1 }}
      start={{ x: 0.18, y: 0 }}
      style={styles.screen}
    >
      <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.content}>
        <ActivityIndicator color={accent} size="large" />
        <Text style={[styles.label, { color: accent }]}>Loading...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", gap: 14 },
  label: { color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: "600" },
  screen: { alignItems: "center", flex: 1, justifyContent: "center" },
});
