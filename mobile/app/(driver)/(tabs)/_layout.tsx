import { Tabs } from "expo-router";

import { colors } from "@/theme/shared";

export default function DriverTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarLabel: "Today" }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule", tabBarLabel: "Schedule" }} />
      <Tabs.Screen name="deliveries" options={{ title: "Deliveries", tabBarLabel: "Deliveries" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }} />
    </Tabs>
  );
}
