import { Badge, Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";

import { formatUnreadNotificationBadge, useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { colors } from "@/theme/shared";

export default function DriverNativeTabsLayout() {
  const { count, error } = useUnreadNotificationCount();
  const alertBadge = error ? null : formatUnreadNotificationBadge(count);

  return (
    <NativeTabs iconColor={{ default: "rgba(109, 74, 255, 0.58)", selected: colors.primary }} minimizeBehavior="automatic">
      <NativeTabs.Trigger name="index">
        <Label>Dashboard</Label>
        <Icon sf={{ default: "house", selected: "house.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="schedule">
        <Label>Schedules</Label>
        <Icon sf={{ default: "calendar", selected: "calendar" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="deliveries">
        <Label>Deliveries</Label>
        <Icon sf={{ default: "shippingbox", selected: "shippingbox.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="status">
        <Label>Status</Label>
        <Icon sf={{ default: "checkmark.circle", selected: "checkmark.circle.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="alerts">
        <Label>Alerts</Label>
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Badge hidden={!alertBadge}>{alertBadge ?? undefined}</Badge>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
