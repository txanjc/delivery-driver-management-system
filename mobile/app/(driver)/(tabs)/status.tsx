import { Text } from "react-native";

import { Card, EmptyState, Screen, textStyles } from "@/components/shared/Screen";

export default function StatusScreen() {
  return (
    <Screen showProfileButton title="Status" subtitle="Active delivery progress and status actions will be managed here.">
      <EmptyState
        title="No active delivery selected"
        message="When an assigned delivery is in progress, status actions will appear here. No updates are submitted from this placeholder."
      />
      <Card>
        <Text style={textStyles.label}>Update Delivery Status</Text>
        <Text style={textStyles.body}>This workflow will remain inside Status and will not appear as a primary tab.</Text>
      </Card>
    </Screen>
  );
}
