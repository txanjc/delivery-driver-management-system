import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, LoadingState, Screen, textStyles } from "@/components/shared/Screen";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { getDeliveriesForDriver } from "@/services/delivery.service";
import { getRouteForDelivery } from "@/services/route.service";
import { getSchedulesForDriver, getVehicle } from "@/services/schedule.service";
import type { Delivery } from "@/types/delivery";
import type { Route } from "@/types/route";
import type { Schedule, VehicleSummary } from "@/types/schedule";

type TodayState = {
  schedule: Schedule | null;
  vehicle: VehicleSummary | null;
  deliveries: Delivery[];
  activeRoute: Route | null;
};

function sameDate(value: string | null) {
  return value?.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export default function TodayScreen() {
  const { driver } = useDriverProfile();
  const [state, setState] = useState<TodayState>({ schedule: null, vehicle: null, deliveries: [], activeRoute: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadToday() {
      if (!driver) return;

      setLoading(true);
      setError(null);

      const [scheduleResponse, deliveryResponse] = await Promise.all([
        getSchedulesForDriver(driver.driver_id),
        getDeliveriesForDriver(driver.driver_id),
      ]);

      if (scheduleResponse.error || deliveryResponse.error) {
        setError(scheduleResponse.error?.message ?? deliveryResponse.error?.message ?? "Unable to load today's work.");
        setLoading(false);
        return;
      }

      const todaySchedule = (scheduleResponse.data ?? []).find((schedule) => sameDate(schedule.shift_date) || sameDate(schedule.start_time)) ?? null;
      const todayDeliveries = (deliveryResponse.data ?? []).filter((delivery) => sameDate(delivery.created_at));
      const routeResponse = todayDeliveries[0] ? await getRouteForDelivery(todayDeliveries[0].delivery_id) : null;
      const vehicleResponse = todaySchedule?.vehicle_id ? await getVehicle(todaySchedule.vehicle_id) : null;

      setState({
        schedule: todaySchedule,
        vehicle: vehicleResponse?.data ?? null,
        deliveries: todayDeliveries,
        activeRoute: routeResponse?.data ?? null,
      });
      setLoading(false);
    }

    void loadToday();
  }, [driver]);

  if (loading) {
    return <LoadingState label="Loading today's assignments..." />;
  }

  return (
    <Screen title="Today" subtitle="Your current shift, vehicle, route, and delivery workload.">
      {error ? <EmptyState title="Today unavailable" message={error} /> : null}
      <Card>
        <Text style={textStyles.label}>Current Shift</Text>
        <Text style={textStyles.value}>{state.schedule?.shift_name ?? "No active shift"}</Text>
        <Text style={textStyles.body}>{state.schedule?.start_time && state.schedule.end_time ? `${new Date(state.schedule.start_time).toLocaleTimeString()} - ${new Date(state.schedule.end_time).toLocaleTimeString()}` : "A dispatcher has not scheduled a shift for today."}</Text>
      </Card>
      <Card>
        <Text style={textStyles.label}>Assigned Vehicle</Text>
        <Text style={textStyles.value}>{state.vehicle ? [state.vehicle.vehicle_number, state.vehicle.license_plate].filter(Boolean).join(" / ") : "No vehicle assigned"}</Text>
      </Card>
      <Card>
        <Text style={textStyles.label}>Active Route</Text>
        <Text style={textStyles.value}>{state.activeRoute ? `${state.activeRoute.estimated_duration_minutes ?? "ETA"} min` : "No active route"}</Text>
      </Card>
      <Card>
        <Text style={textStyles.label}>Today's Deliveries</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metric}>{state.deliveries.length}</Text>
          <Text style={textStyles.body}>assigned today</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    color: "#2563eb",
    fontSize: 32,
    fontWeight: "800",
  },
});
