import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text } from "react-native";

import { Card, EmptyState, LoadingState, Screen, textStyles } from "@/components/shared/Screen";
import { RouteMap } from "@/components/shared/RouteMap";
import { getRoute } from "@/services/route.service";
import type { Route } from "@/types/route";

export default function RouteMapScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRoute() {
      if (!routeId) return;

      setLoading(true);
      const response = await getRoute(routeId);

      if (response.error || !response.data) {
        setError(response.error?.message ?? "Route was not found.");
        setRoute(null);
      } else {
        setError(null);
        setRoute(response.data);
      }

      setLoading(false);
    }

    void loadRoute();
  }, [routeId]);

  const region = useMemo(() => {
    if (route?.origin_latitude !== null && route?.origin_longitude !== null && route?.origin_latitude !== undefined && route?.origin_longitude !== undefined) {
      return {
        latitude: route.origin_latitude,
        longitude: route.origin_longitude,
      };
    }

    return null;
  }, [route]);

  if (loading) {
    return <LoadingState label="Loading route..." />;
  }

  if (error || !route) {
    return <EmptyState title="Route unavailable" message={error ?? "This route could not be loaded."} />;
  }

  return (
    <Screen title="Route Map" subtitle="Map preview only. Location tracking is not started automatically.">
      {region ? (
        <RouteMap
          origin={region}
          destination={
            route.destination_latitude !== null && route.destination_longitude !== null
              ? { latitude: route.destination_latitude, longitude: route.destination_longitude }
              : null
          }
        />
      ) : (
        <EmptyState title="Map unavailable" message="This route does not have mapped coordinates yet." />
      )}
      <Card>
        <Text style={textStyles.label}>Route Summary</Text>
        <Text style={textStyles.value}>{route.estimated_distance_km ? `${route.estimated_distance_km} km` : "Distance unavailable"}</Text>
        <Text style={textStyles.body}>{route.estimated_duration_minutes ? `${route.estimated_duration_minutes} minutes` : "Duration unavailable"}</Text>
      </Card>
    </Screen>
  );
}
