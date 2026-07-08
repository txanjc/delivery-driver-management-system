import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { Card, EmptyState, LoadingState, Screen, textStyles } from "@/components/shared/Screen";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { getDeliveriesForDriver } from "@/services/delivery.service";
import type { Delivery } from "@/types/delivery";
import { colors } from "@/theme/shared";

export default function DeliveriesScreen() {
  const { driver } = useDriverProfile();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDeliveries() {
      if (!driver) return;

      setLoading(true);
      const response = await getDeliveriesForDriver(driver.driver_id);

      if (response.error) {
        setError(response.error.message);
        setDeliveries([]);
      } else {
        setError(null);
        setDeliveries(response.data ?? []);
      }

      setLoading(false);
    }

    void loadDeliveries();
  }, [driver]);

  if (loading) {
    return <LoadingState label="Loading deliveries..." />;
  }

  return (
    <Screen title="Deliveries" subtitle="Only deliveries assigned to your driver record are shown.">
      {error ? <EmptyState title="Deliveries unavailable" message={error} /> : null}
      {!error && deliveries.length === 0 ? <EmptyState title="No assigned deliveries" message="Assigned deliveries will appear here when dispatch publishes them." /> : null}
      {deliveries.map((delivery) => (
        <Link asChild href={{ pathname: "/(driver)/delivery/[deliveryId]", params: { deliveryId: delivery.delivery_id } }} key={delivery.delivery_id}>
          <Pressable>
            <Card>
              <Text style={textStyles.label}>#{delivery.delivery_number ?? "Unnumbered"}</Text>
              <Text style={textStyles.value}>{delivery.customer_name ?? "Customer unavailable"}</Text>
              <Text style={textStyles.body}>{delivery.pickup_address ?? "Pickup unavailable"}</Text>
              <Text style={textStyles.body}>{delivery.delivery_address ?? "Delivery address unavailable"}</Text>
              <Text style={styles.status}>{delivery.status ?? "status unavailable"}</Text>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
});
