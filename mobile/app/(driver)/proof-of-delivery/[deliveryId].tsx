import { useLocalSearchParams } from "expo-router";

import { EmptyState, Screen } from "@/components/shared/Screen";

export default function ProofOfDeliveryScreen() {
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();

  return (
    <Screen title="Proof of Delivery" subtitle={deliveryId ? `Delivery ${deliveryId}` : "Delivery confirmation"}>
      <EmptyState
        title="Proof of delivery not started"
        message="Signature capture and confirmation uploads will be added in the proof of delivery workflow later."
      />
    </Screen>
  );
}
