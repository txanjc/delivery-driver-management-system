"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DriverProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type ScheduleDriver = {
  id: string;
  user_id: string | null;
  profiles: DriverProfile | DriverProfile[] | null;
};

type ScheduleRow = {
  id: string;
  driver_id: string | null;
  shift_name: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  drivers: ScheduleDriver | ScheduleDriver[] | null;
};

type ScheduleRecord = {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: string;
};

function normalizeRelation<T>(relation: T | T[] | null) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function toScheduleRecord(schedule: ScheduleRow): ScheduleRecord {
  const driver = normalizeRelation(schedule.drivers);
  const profile = normalizeRelation(driver?.profiles ?? null);
  const driverName =
    profile?.first_name || profile?.last_name
      ? `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim()
      : "Unassigned driver";

  return {
    id: schedule.id,
    driverId: schedule.driver_id ?? "",
    driverEmail: profile?.email ?? "",
    driverName,
    endTime: schedule.end_time ?? "",
    shiftName: schedule.shift_name ?? inferShiftName(schedule.start_time),
    startTime: schedule.start_time ?? "",
    status: schedule.status ?? "Scheduled",
  };
}

function inferShiftName(startTime: string | null) {
  if (!startTime) {
    return "Scheduled Shift";
  }

  const hour = new Date(startTime).getHours();
  return hour < 14 ? "Morning Shift" : "Evening Shift";
}

function formatDateTime(value: string) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function schedulesOverlap(first: ScheduleRecord, second: ScheduleRecord) {
  if (!first.driverId || first.driverId !== second.driverId) {
    return false;
  }

  const firstStart = new Date(first.startTime).getTime();
  const firstEnd = new Date(first.endTime).getTime();
  const secondStart = new Date(second.startTime).getTime();
  const secondEnd = new Date(second.endTime).getTime();

  if (
    [firstStart, firstEnd, secondStart, secondEnd].some((time) =>
      Number.isNaN(time),
    )
  ) {
    return false;
  }

  return firstStart < secondEnd && secondStart < firstEnd;
}

function getConflictIds(schedules: ScheduleRecord[]) {
  const conflictIds = new Set<string>();

  for (let i = 0; i < schedules.length; i += 1) {
    for (let j = i + 1; j < schedules.length; j += 1) {
      if (schedulesOverlap(schedules[i], schedules[j])) {
        conflictIds.add(schedules[i].id);
        conflictIds.add(schedules[j].id);
      }
    }
  }

  return conflictIds;
}

function ScheduleKpiCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        accent ? "bg-white text-black" : "bg-[#222222] text-white"
      }`}
    >
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function ScheduleStatusBadge({
  hasConflict,
  status,
}: {
  hasConflict: boolean;
  status: string;
}) {
  if (hasConflict) {
    return (
      <span className="inline-flex rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-300">
        Conflict
      </span>
    );
  }

  const normalizedStatus = status.toLowerCase();
  const badgeClass =
    normalizedStatus === "scheduled" || normalizedStatus === "active"
      ? "bg-blue-500/15 text-blue-300"
      : normalizedStatus === "completed"
        ? "bg-emerald-500/15 text-emerald-300"
        : normalizedStatus === "cancelled"
          ? "bg-red-500/15 text-red-300"
          : "bg-zinc-500/15 text-zinc-300";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
    >
      {status || "Not set"}
    </span>
  );
}

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadSchedules = useCallback(async () => {
    const { data, error } = await supabase
      .from("schedules")
      .select(
        "id, driver_id, shift_name, start_time, end_time, status, drivers:driver_id (id, user_id, profiles:user_id (first_name, last_name, email))",
      )
      .order("start_time", { ascending: true })
      .returns<ScheduleRow[]>();

    if (error) {
      setErrorMessage(error.message);
      setSchedules([]);
      setIsLoading(false);
      return;
    }

    setSchedules((data ?? []).map(toScheduleRecord));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSchedules();
    });
  }, [loadSchedules]);

  const conflictIds = useMemo(() => getConflictIds(schedules), [schedules]);

  const scheduleStats = useMemo(() => {
    return {
      conflicts: conflictIds.size,
      evening: schedules.filter((schedule) =>
        schedule.shiftName.toLowerCase().includes("evening"),
      ).length,
      morning: schedules.filter((schedule) =>
        schedule.shiftName.toLowerCase().includes("morning"),
      ).length,
      total: schedules.length,
    };
  }, [conflictIds.size, schedules]);

  return (
    <section className="space-y-5 text-white">
      <div className="flex flex-col gap-4 rounded-3xl bg-[#222222] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">
            Driver Scheduling
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Schedules
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Plan driver coverage across morning and evening shift windows while
            identifying overlapping assignments.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          type="button"
        >
          Add Schedule
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ScheduleKpiCard
          accent
          detail="Total schedule records"
          label="Scheduled Shifts"
          value={String(scheduleStats.total)}
        />
        <ScheduleKpiCard
          detail="6 AM - 2 PM coverage"
          label="Morning Shifts"
          value={String(scheduleStats.morning)}
        />
        <ScheduleKpiCard
          detail="2 PM - 10 PM coverage"
          label="Evening Shifts"
          value={String(scheduleStats.evening)}
        />
        <ScheduleKpiCard
          detail="Overlapping assignments"
          label="Schedule Conflicts"
          value={String(scheduleStats.conflicts)}
        />
      </div>

      <div className="rounded-3xl bg-[#222222] p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_190px]">
          <label className="block">
            <span className="sr-only">Search schedules</span>
            <input
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
              placeholder="Search schedules"
              type="search"
            />
          </label>
          <label className="block">
            <span className="sr-only">Shift type</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Shift Type</option>
              <option value="morning">Morning Shift</option>
              <option value="evening">Evening Shift</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Driver</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Driver</option>
              {Array.from(new Set(schedules.map((schedule) => schedule.driverName)))
                .filter(Boolean)
                .map((driverName) => (
                  <option key={driverName} value={driverName}>
                    {driverName}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Status</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="conflict">Conflict</option>
            </select>
          </label>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl bg-[#222222] text-white">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-xl font-medium">Schedule Records</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Morning Shift runs 6 AM - 2 PM. Evening Shift runs 2 PM - 10 PM.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-10 text-sm text-zinc-400">
            Loading schedule records...
          </p>
        ) : schedules.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              DE
            </div>
            <h3 className="mt-4 text-lg font-semibold">No schedules found.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Schedule records will appear here when driver shifts are added to
              the schedules table.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Driver</th>
                  <th className="px-5 py-4 font-medium">Shift Name</th>
                  <th className="px-5 py-4 font-medium">Start Time</th>
                  <th className="px-5 py-4 font-medium">End Time</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {schedules.map((schedule) => {
                  const hasConflict = conflictIds.has(schedule.id);

                  return (
                    <tr
                      className={`transition hover:bg-white/5 ${
                        hasConflict ? "bg-red-500/5" : ""
                      }`}
                      key={schedule.id}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                            {(schedule.driverName[0] || "D").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              {schedule.driverName}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {schedule.driverEmail || "No email"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>{schedule.shiftName}</div>
                        <div className="text-xs text-zinc-500">
                          {schedule.shiftName
                            .toLowerCase()
                            .includes("evening")
                            ? "2 PM - 10 PM"
                            : "6 AM - 2 PM"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {formatDateTime(schedule.startTime)}
                      </td>
                      <td className="px-5 py-4">
                        {formatDateTime(schedule.endTime)}
                      </td>
                      <td className="px-5 py-4">
                        <ScheduleStatusBadge
                          hasConflict={hasConflict}
                          status={schedule.status}
                        />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-400"
                          disabled
                          type="button"
                        >
                          Planned
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
