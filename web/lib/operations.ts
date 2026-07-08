export type ScheduleLike = {
  schedule_id?: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  shift_date?: string | null;
  shift_type?: string | null;
  shift_name?: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
};

const restrictedVehicleStatuses = new Set([
  "inactive",
  "out_of_service",
  "maintenance",
  "maintenance_due",
  "inspection_hold",
  "registration_issue",
  "insurance_issue",
]);

export function isVehicleOperational(status: string | null | undefined) {
  return !restrictedVehicleStatuses.has((status ?? "available").toLowerCase());
}

export function isScheduleCancelled(schedule: ScheduleLike) {
  return schedule.status === "cancelled";
}

export function scheduleDurationHours(schedule: ScheduleLike) {
  if (isScheduleCancelled(schedule) || !schedule.start_time || !schedule.end_time) {
    return 0;
  }

  const start = new Date(schedule.start_time).getTime();
  const end = new Date(schedule.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return (end - start) / 3_600_000;
}

export function effectiveScheduleStatus(schedule: ScheduleLike, hasConflict = false, now = new Date()) {
  if (schedule.status === "cancelled") return "cancelled";
  if (schedule.status === "conflict" || hasConflict) return "conflict";
  if (schedule.end_time && new Date(schedule.end_time).getTime() <= now.getTime()) {
    return "completed";
  }
  return "scheduled";
}

export function findRelevantAssignment<T extends ScheduleLike>(schedules: T[], now = new Date()) {
  const nowTime = now.getTime();
  return schedules
    .filter((schedule) => !isScheduleCancelled(schedule) && schedule.start_time && schedule.end_time)
    .filter((schedule) => new Date(schedule.end_time as string).getTime() > nowTime)
    .sort((left, right) => {
      const leftActive = new Date(left.start_time as string).getTime() <= nowTime;
      const rightActive = new Date(right.start_time as string).getTime() <= nowTime;
      if (leftActive !== rightActive) return leftActive ? -1 : 1;
      return new Date(left.start_time as string).getTime() - new Date(right.start_time as string).getTime();
    })[0] ?? null;
}

export function deriveVehicleStatus(status: string | null | undefined, schedules: ScheduleLike[], now = new Date()) {
  if (!isVehicleOperational(status)) return status ?? "out_of_service";
  return findRelevantAssignment(schedules, now) ? "assigned" : "available";
}
