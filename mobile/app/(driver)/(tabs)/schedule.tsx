import { useEffect, useState } from "react";
import { Text } from "react-native";

import { Card, EmptyState, LoadingState, Screen, textStyles } from "@/components/shared/Screen";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { getSchedulesForDriver } from "@/services/schedule.service";
import type { Schedule } from "@/types/schedule";

export default function ScheduleScreen() {
  const { driver } = useDriverProfile();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSchedules() {
      if (!driver) return;

      setLoading(true);
      const response = await getSchedulesForDriver(driver.driver_id);

      if (response.error) {
        setError(response.error.message);
        setSchedules([]);
      } else {
        setError(null);
        setSchedules(response.data ?? []);
      }

      setLoading(false);
    }

    void loadSchedules();
  }, [driver]);

  if (loading) {
    return <LoadingState label="Loading schedule..." />;
  }

  const currentSchedule = schedules.find((schedule) => schedule.start_time && schedule.end_time && new Date(schedule.start_time) <= new Date() && new Date(schedule.end_time) >= new Date());
  const upcomingSchedules = schedules.filter((schedule) => schedule.start_time && new Date(schedule.start_time) > new Date()).slice(0, 5);

  return (
    <Screen title="Schedule" subtitle="Schedules are the source of truth for driver and vehicle assignments.">
      {error ? <EmptyState title="Schedule unavailable" message={error} /> : null}
      <Card>
        <Text style={textStyles.label}>Current Schedule</Text>
        <Text style={textStyles.value}>{currentSchedule?.shift_name ?? "No current schedule"}</Text>
        <Text style={textStyles.body}>{currentSchedule?.vehicle_id ? `Vehicle ${currentSchedule.vehicle_id}` : "No vehicle assignment is active right now."}</Text>
      </Card>
      {upcomingSchedules.length === 0 ? (
        <EmptyState title="No upcoming schedules" message="Upcoming driver schedules will appear here when dispatch assigns them." />
      ) : (
        upcomingSchedules.map((schedule) => (
          <Card key={schedule.schedule_id}>
            <Text style={textStyles.label}>{schedule.shift_date ?? "Upcoming shift"}</Text>
            <Text style={textStyles.value}>{schedule.shift_name ?? "Scheduled Shift"}</Text>
            <Text style={textStyles.body}>{schedule.start_time && schedule.end_time ? `${new Date(schedule.start_time).toLocaleString()} - ${new Date(schedule.end_time).toLocaleTimeString()}` : "Shift time unavailable"}</Text>
            <Text style={textStyles.body}>{schedule.vehicle_id ? `Assigned vehicle: ${schedule.vehicle_id}` : "Vehicle not assigned"}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}
