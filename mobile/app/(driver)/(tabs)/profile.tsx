import { Pressable, StyleSheet, Text } from "react-native";

import { Card, Screen, textStyles } from "@/components/shared/Screen";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/shared";

function displayName(firstName: string | null | undefined, lastName: string | null | undefined, email: string | null | undefined) {
  return [firstName, lastName].filter(Boolean).join(" ") || email || "Driver";
}

export default function ProfileScreen() {
  const { driver, profile, signOut } = useAuth();

  return (
    <Screen title="Profile" subtitle="Driver account and vehicle assignment status.">
      <Card>
        <Text style={textStyles.label}>Driver</Text>
        <Text style={textStyles.value}>{displayName(profile?.first_name, profile?.last_name, profile?.email)}</Text>
        <Text style={textStyles.body}>{profile?.email ?? "Email unavailable"}</Text>
      </Card>
      <Card>
        <Text style={textStyles.label}>Driver Record</Text>
        <Text style={textStyles.value}>{driver?.availability ?? "Availability unavailable"}</Text>
        <Text style={textStyles.body}>{driver?.assigned_vehicle_id ? `Assigned vehicle: ${driver.assigned_vehicle_id}` : "No vehicle assigned"}</Text>
      </Card>
      <Pressable onPress={() => void signOut()} style={styles.button}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.text,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
