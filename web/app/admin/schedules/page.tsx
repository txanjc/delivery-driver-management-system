"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type ShiftType = "morning" | "evening";
type ScheduleStatus = "scheduled" | "active" | "completed" | "cancelled";

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

type DriverRow = {
  id: string;
  user_id: string | null;
  profiles: DriverProfile | DriverProfile[] | null;
};

type DriverOption = {
  id: string;
  name: string;
  email: string;
};

type ScheduleRecord = {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  shiftName: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  status: string;
};

type ScheduleFormState = {
  driverId: string;
  shiftType: ShiftType;
  date: string;
  status: ScheduleStatus;
};

type SchedulePayload = {
  driver_id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  status: ScheduleStatus;
};

const emptyScheduleForm: ScheduleFormState = {
  driverId: "",
  shiftType: "morning",
  date: "",
  status: "scheduled",
};

const shiftOptions: Array<{
  label: string;
  value: ShiftType;
  hours: string;
  startHour: number;
  endHour: number;
}> = [
  {
    label: "Morning Shift",
    value: "morning",
    hours: "6 AM - 2 PM",
    startHour: 6,
    endHour: 14,
  },
  {
    label: "Evening Shift",
    value: "evening",
    hours: "2 PM - 10 PM",
    startHour: 14,
    endHour: 22,
  },
];

const statusOptions: Array<{ label: string; value: ScheduleStatus }> = [
  { label: "Scheduled", value: "scheduled" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function normalizeRelation<T>(relation: T | T[] | null) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function getDriverName(profile: DriverProfile | null) {
  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ");

  return name || profile?.email || "Unnamed driver";
}

function inferShiftType(shiftName: string | null, startTime: string | null) {
  if (shiftName?.toLowerCase().includes("evening")) {
    return "evening";
  }

  if (shiftName?.toLowerCase().includes("morning")) {
    return "morning";
  }

  return startTime && new Date(startTime).getHours() >= 14
    ? "evening"
    : "morning";
}

function toScheduleRecord(schedule: ScheduleRow): ScheduleRecord {
  const driver = normalizeRelation(schedule.drivers);
  const profile = normalizeRelation(driver?.profiles ?? null);
  const shiftType = inferShiftType(schedule.shift_name, schedule.start_time);
  const shift = shiftOptions.find((option) => option.value === shiftType);

  return {
    id: schedule.id,
    driverId: schedule.driver_id ?? "",
    driverEmail: profile?.email ?? "",
    driverName: getDriverName(profile),
    endTime: schedule.end_time ?? "",
    shiftName: schedule.shift_name ?? shift?.label ?? "Scheduled Shift",
    shiftType,
    startTime: schedule.start_time ?? "",
    status: schedule.status ?? "scheduled",
  };
}

function toDriverOption(driver: DriverRow): DriverOption {
  const profile = normalizeRelation(driver.profiles);

  return {
    id: driver.id,
    name: getDriverName(profile),
    email: profile?.email ?? "",
  };
}

function getLocalDateValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toScheduleForm(schedule: ScheduleRecord): ScheduleFormState {
  const normalizedStatus = schedule.status.toLowerCase();
  const status = statusOptions.some((option) => option.value === normalizedStatus)
    ? (normalizedStatus as ScheduleStatus)
    : "scheduled";

  return {
    driverId: schedule.driverId,
    shiftType: schedule.shiftType,
    date: getLocalDateValue(schedule.startTime),
    status,
  };
}

function toSchedulePayload(formState: ScheduleFormState): SchedulePayload {
  const shift = shiftOptions.find(
    (shiftOption) => shiftOption.value === formState.shiftType,
  );
  const [year, month, day] = formState.date.split("-").map(Number);
  const startTime = new Date(
    year,
    month - 1,
    day,
    shift?.startHour ?? 6,
  );
  const endTime = new Date(year, month - 1, day, shift?.endHour ?? 14);

  return {
    driver_id: formState.driverId,
    shift_name: shift?.label ?? "Morning Shift",
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    status: formState.status,
  };
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

function formatStatus(status: string) {
  return (
    statusOptions.find((option) => option.value === status.toLowerCase())
      ?.label ??
    status
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
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
    <div className="flex flex-wrap gap-2">
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
      >
        {formatStatus(status)}
      </span>
      {hasConflict ? (
        <span className="inline-flex rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-300">
          Conflict
        </span>
      ) : null}
    </div>
  );
}

function ScheduleModal({
  drivers,
  formState,
  isSaving,
  mode,
  onChange,
  onClose,
  onSubmit,
}: {
  drivers: DriverOption[];
  formState: ScheduleFormState;
  isSaving: boolean;
  mode: "create" | "edit";
  onChange: (field: keyof ScheduleFormState, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isCreateMode = mode === "create";
  const selectedShift = shiftOptions.find(
    (option) => option.value === formState.shiftType,
  );

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#222222] p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {isCreateMode ? "Add Schedule" : "Edit Schedule"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Assign an existing driver to a standard DeliverEaze shift.
            </p>
          </div>
          <button
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <form className="mt-5 space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-zinc-300">Driver</span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("driverId", event.target.value)}
                required
                value={formState.driverId}
              >
                <option value="">Select an existing driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                    {driver.email ? ` (${driver.email})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Shift</span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("shiftType", event.target.value)}
                value={formState.shiftType}
              >
                {shiftOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}: {option.hours}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Date</span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("date", event.target.value)}
                required
                type="date"
                value={formState.date}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-zinc-300">Status</span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("status", event.target.value)}
                value={formState.status}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
            Start and end times will be calculated automatically as{" "}
            <span className="font-semibold text-white">
              {selectedShift?.hours}
            </span>
            . Overlapping schedules are allowed and will be marked as conflicts.
          </p>

          {drivers.length === 0 ? (
            <p className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
              Add an operational driver record before creating a schedule.
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving || drivers.length === 0}
              type="submit"
            >
              {isSaving
                ? "Saving..."
                : isCreateMode
                  ? "Add Schedule"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<ScheduleRecord | null>(null);
  const [formState, setFormState] =
    useState<ScheduleFormState>(emptyScheduleForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadScheduleData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const [schedulesResponse, driversResponse] = await Promise.all([
      supabase
        .from("schedules")
        .select(
          "id, driver_id, shift_name, start_time, end_time, status, drivers:driver_id (id, user_id, profiles:user_id (first_name, last_name, email))",
        )
        .order("start_time", { ascending: true })
        .returns<ScheduleRow[]>(),
      supabase
        .from("drivers")
        .select(
          "id, user_id, profiles:user_id (first_name, last_name, email)",
        )
        .order("created_at", { ascending: false })
        .returns<DriverRow[]>(),
    ]);

    if (schedulesResponse.error) {
      setErrorMessage(schedulesResponse.error.message);
      setSchedules([]);
      setIsLoading(false);
      return;
    }

    if (driversResponse.error) {
      setErrorMessage(driversResponse.error.message);
      setDrivers([]);
      setIsLoading(false);
      return;
    }

    setSchedules((schedulesResponse.data ?? []).map(toScheduleRecord));
    setDrivers((driversResponse.data ?? []).map(toDriverOption));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadScheduleData();
    });
  }, [loadScheduleData]);

  const conflictIds = useMemo(() => getConflictIds(schedules), [schedules]);

  const scheduleStats = useMemo(
    () => ({
      conflicts: conflictIds.size,
      evening: schedules.filter((schedule) => schedule.shiftType === "evening")
        .length,
      morning: schedules.filter((schedule) => schedule.shiftType === "morning")
        .length,
      total: schedules.length,
    }),
    [conflictIds.size, schedules],
  );

  const filteredSchedules = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return schedules.filter((schedule) => {
      const matchesSearch =
        !normalizedQuery ||
        [
          schedule.driverName,
          schedule.driverEmail,
          schedule.shiftName,
          formatStatus(schedule.status),
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesDriver =
        !driverFilter || schedule.driverId === driverFilter;
      const matchesShift =
        !shiftFilter || schedule.shiftType === shiftFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "conflict"
          ? conflictIds.has(schedule.id)
          : schedule.status.toLowerCase() === statusFilter);

      return matchesSearch && matchesDriver && matchesShift && matchesStatus;
    });
  }, [
    conflictIds,
    driverFilter,
    schedules,
    searchQuery,
    shiftFilter,
    statusFilter,
  ]);

  function openCreateModal() {
    setEditingSchedule(null);
    setFormState({
      ...emptyScheduleForm,
      driverId: drivers[0]?.id ?? "",
      date: getLocalDateValue(new Date().toISOString()),
    });
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function openEditModal(schedule: ScheduleRecord) {
    setEditingSchedule(schedule);
    setFormState(toScheduleForm(schedule));
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingSchedule(null);
    setFormState(emptyScheduleForm);
  }

  function updateFormState(field: keyof ScheduleFormState, value: string) {
    setFormState((currentFormState) => ({
      ...currentFormState,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    if (!formState.driverId || !formState.date) {
      setErrorMessage("Driver and date are required.");
      setIsSaving(false);
      return;
    }

    const payload = toSchedulePayload(formState);
    const { error } = editingSchedule
      ? await supabase
          .from("schedules")
          .update(payload)
          .eq("id", editingSchedule.id)
      : await supabase.from("schedules").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    await loadScheduleData();
    setSuccessMessage(
      editingSchedule
        ? "Schedule updated successfully."
        : "Schedule created successfully.",
    );
    setIsSaving(false);
    setIsModalOpen(false);
    setEditingSchedule(null);
    setFormState(emptyScheduleForm);
  }

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
            Plan driver coverage across morning and evening shifts and identify
            overlapping assignments before dispatch.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          onClick={openCreateModal}
          type="button"
        >
          Add Schedule
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ScheduleKpiCard
          accent
          detail="All schedule records"
          label="Total Shifts"
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
          detail="Shifts with an overlap"
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
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search schedules"
              type="search"
              value={searchQuery}
            />
          </label>
          <label className="block">
            <span className="sr-only">Driver filter</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              onChange={(event) => setDriverFilter(event.target.value)}
              value={driverFilter}
            >
              <option value="">Driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Shift type filter</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              onChange={(event) => setShiftFilter(event.target.value)}
              value={shiftFilter}
            >
              <option value="">Shift Type</option>
              {shiftOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Status filter</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="">Status</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="conflict">Conflict</option>
            </select>
          </label>
        </div>
      </div>

      {successMessage ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </p>
      ) : null}

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
              Schedules joined to drivers and their profile names.
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
            <h3 className="mt-4 text-lg font-semibold">No schedules yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Add the first driver shift to begin planning daily coverage.
            </p>
            <button
              className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-lime-200"
              onClick={openCreateModal}
              type="button"
            >
              Add Schedule
            </button>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <h3 className="text-lg font-semibold">No matching schedules</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Adjust the search or filters to see more schedule records.
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
                {filteredSchedules.map((schedule) => {
                  const hasConflict = conflictIds.has(schedule.id);
                  const shift = shiftOptions.find(
                    (option) => option.value === schedule.shiftType,
                  );

                  return (
                    <tr
                      className={`transition hover:bg-white/5 ${
                        hasConflict
                          ? "border-l-2 border-red-400 bg-red-500/5"
                          : ""
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
                          {shift?.hours}
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
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                          onClick={() => openEditModal(schedule)}
                          type="button"
                        >
                          Edit
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

      {isModalOpen ? (
        <ScheduleModal
          drivers={drivers}
          formState={formState}
          isSaving={isSaving}
          mode={editingSchedule ? "edit" : "create"}
          onChange={updateFormState}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  );
}
