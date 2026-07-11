import { Tabs } from "expo-router";

import { DriverTabBar } from "@/components/shared/DriverTabBar";
import { driverTabs } from "@/components/shared/driverTabs";
import { formatUnreadNotificationBadge, useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";

export default function DriverTabsLayout() {
  const { count, error } = useUnreadNotificationCount();
  const alertBadge = error ? null : formatUnreadNotificationBadge(count);

  return (
    <Tabs
      tabBar={(props) => <DriverTabBar {...props} />}
      screenOptions={{
        headerShadowVisible: false,
      }}
    >
      {driverTabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.name === "alerts" && alertBadge ? `Alerts, ${alertBadge} unread` : tab.label,
            tabBarBadge: tab.name === "alerts" ? (alertBadge ?? undefined) : undefined,
            tabBarLabel: tab.label,
          }}
        />
      ))}
    </Tabs>
  );
}
