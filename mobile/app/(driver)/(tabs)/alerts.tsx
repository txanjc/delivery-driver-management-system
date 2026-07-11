import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Text } from "react-native";

import { Card, EmptyState, Screen, textStyles } from "@/components/shared/Screen";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";

export default function AlertsScreen() {
  const { refreshUnreadCount } = useUnreadNotificationCount();

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
    }, [refreshUnreadCount]),
  );

  return (
    <Screen showProfileButton title="Alerts" subtitle="Stored operational alerts for assignments, schedule changes, route changes, delays, and system announcements.">
      <EmptyState title="No alerts" message="Driver alerts will appear here when they are available." />
      <Card>
        <Text style={textStyles.label}>Alert Center</Text>
        <Text style={textStyles.body}>This page is separate from temporary banners, confirmation dialogs, and native push notifications.</Text>
      </Card>
    </Screen>
  );
}
