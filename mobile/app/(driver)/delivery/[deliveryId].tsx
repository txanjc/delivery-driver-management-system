import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { Card, EmptyState, LoadingState, Screen, textStyles } from "@/components/shared/Screen";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { getDeliveryForDriver } from "@/services/delivery.service";
import { getRouteForDeliveryForDriver } from "@/services/route.service";
import type { Delivery } from "@/types/delivery";
import type { Route } from "@/types/route";
import { colors } from "@/theme/shared";
import { triggerButtonHaptic } from "@/utils/haptics";

export default function DeliveryDetailsScreen() {
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const { driver, loading: profileLoading } = useDriverProfile();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDelivery() {
      if (!deliveryId || profileLoading) return;

      if (!driver) {
        setDelivery(null);
        setRoute(null);
        setError("This delivery was not found or is not assigned to your driver record.");
        setLoading(false);
        return;
      }

      setLoading(true);
      const deliveryResponse = await getDeliveryForDriver(deliveryId, driver.driver_id);

      if (!mounted) return;

      if (deliveryResponse.error || !deliveryResponse.data) {
        setDelivery(null);
        setRoute(null);
        setError("This delivery was not found or is not assigned to your driver record.");
        setLoading(false);
        return;
      }

      const routeResponse = await getRouteForDeliveryForDriver(deliveryResponse.data.delivery_id, driver.driver_id);

      if (!mounted) return;

      setDelivery(deliveryResponse.data);
      setRoute(routeResponse.data ?? null);
      setError(null);
      setLoading(false);
    }

    void loadDelivery();

    return () => {
      mounted = false;
    };
  }, [deliveryId, driver, profileLoading]);

  if (loading || profileLoading) {
    return <LoadingState label="Loading delivery..." />;
  }

  if (error || !delivery) {
    return <EmptyState title="Delivery unavailable" message={error ?? "This delivery could not be loaded."} />;
  }

  return (
    <Screen title={`#${delivery.delivery_number ?? "Delivery"}`} subtitle={delivery.status ?? "Status unavailable"}>
      <Card>
        <Text style={textStyles.label}>Customer</Text>
        <Text style={textStyles.value}>{delivery.customer_name ?? "Not provided"}</Text>
        <Text style={textStyles.body}>{delivery.customer_phone ?? "No phone number"}</Text>
      </Card>
      <Card>
        <Text style={textStyles.label}>Pickup</Text>
        <Text style={textStyles.value}>{delivery.pickup_address ?? "Pickup unavailable"}</Text>
      </Card>
      <Card>
        <Text style={textStyles.label}>Drop-off</Text>
        <Text style={textStyles.value}>{delivery.delivery_address ?? "Delivery address unavailable"}</Text>
      </Card>
      {route ? (
        <Link asChild href={{ pathname: "/(driver)/route/[routeId]", params: { routeId: route.route_id } }}>
          <Pressable onPressIn={triggerButtonHaptic} style={styles.routeButton}>
            <Text style={styles.routeButtonText}>Confirm Route</Text>
          </Pressable>
        </Link>
      ) : (
        <EmptyState title="Route unavailable" message="A dispatcher has not generated a route for this delivery yet." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  routeButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  routeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
