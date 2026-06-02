"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DriverProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

type DriverRow = {
  id: string;
  user_id: string;
  license_number: string | null;
  license_expiry: string | null;
  availability: string | null;
  performance_score: number | null;
  assigned_vehicle_id: string | null;
  profiles: DriverProfile | DriverProfile[] | null;
};

type DriverRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  licenseNumber: string;
  licenseExpiry: string;
  availability: string;
  performanceScore: string;
  assignedVehicleId: string;
};

function normalizeProfile(profile: DriverRow["profiles"]) {
  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile;
}

function toDriverRecord(driver: DriverRow): DriverRecord {
  const profile = normalizeProfile(driver.profiles);

  return {
    id: driver.id,
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    role: profile?.role ?? "",
    isActive: profile?.is_active ?? false,
    licenseNumber: driver.license_number ?? "",
    licenseExpiry: driver.license_expiry ?? "",
    availability: driver.availability ?? "",
    performanceScore:
      driver.performance_score === null ? "" : String(driver.performance_score),
    assignedVehicleId: driver.assigned_vehicle_id ?? "",
  };
}

function DriverKpiCard({
  label,
  value,
  detail,
  accent = "bg-[#222222]",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: string;
}) {
  return (
    <div className={`rounded-2xl p-5 text-white ${accent}`}>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function AvailabilityBadge({ availability }: { availability: string }) {
  const normalizedAvailability = availability.toLowerCase();
  const badgeClass =
    normalizedAvailability === "available"
      ? "bg-emerald-500/15 text-emerald-300"
      : normalizedAvailability === "on_delivery"
        ? "bg-orange-500/15 text-orange-300"
        : normalizedAvailability === "unavailable"
          ? "bg-red-500/15 text-red-300"
          : "bg-zinc-500/15 text-zinc-300";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
      {availability || "Not set"}
    </span>
  );
}

function ProfileStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        isActive
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-zinc-500/15 text-zinc-300"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function PerformanceMeter({ score }: { score: string }) {
  const numericScore = Number(score);
  const safeScore = Number.isFinite(numericScore)
    ? Math.max(0, Math.min(100, numericScore))
    : 0;

  return (
    <div className="min-w-36">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">Score</span>
        <span className="font-semibold text-white">
          {score ? `${safeScore}%` : "Not scored"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-lime-400"
          style={{ width: `${safeScore}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDrivers = useCallback(async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select(
        "id, user_id, license_number, license_expiry, availability, performance_score, assigned_vehicle_id, profiles:user_id (id, first_name, last_name, email, phone, role, is_active)",
      )
      .order("created_at", { ascending: false })
      .returns<DriverRow[]>();

    if (error) {
      setErrorMessage(error.message);
      setDrivers([]);
      setIsLoading(false);
      return;
    }

    setDrivers((data ?? []).map(toDriverRecord));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDrivers();
    });
  }, [loadDrivers]);

  const driverStats = useMemo(() => {
    const activeDrivers = drivers.filter((driver) => driver.isActive).length;
    const availableDrivers = drivers.filter(
      (driver) => driver.availability.toLowerCase() === "available",
    ).length;
    const onDelivery = drivers.filter(
      (driver) => driver.availability.toLowerCase() === "on_delivery",
    ).length;
    const inactiveDrivers = drivers.filter((driver) => !driver.isActive).length;

    return {
      activeDrivers,
      availableDrivers,
      inactiveDrivers,
      onDelivery,
    };
  }, [drivers]);

  return (
    <section className="space-y-5 text-white">
      <div className="flex flex-col gap-4 rounded-3xl bg-[#222222] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">
            Fleet Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Drivers
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Monitor driver profiles, license readiness, availability, assigned
            vehicles, and active status across the delivery network.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          type="button"
        >
          Add Driver
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DriverKpiCard
          accent="bg-white text-black"
          detail="Profiles marked active"
          label="Active Drivers"
          value={String(driverStats.activeDrivers)}
        />
        <DriverKpiCard
          detail="Ready for assignment"
          label="Available Drivers"
          value={String(driverStats.availableDrivers)}
        />
        <DriverKpiCard
          detail="Currently moving deliveries"
          label="On Delivery"
          value={String(driverStats.onDelivery)}
        />
        <DriverKpiCard
          detail="Inactive profile records"
          label="Inactive Drivers"
          value={String(driverStats.inactiveDrivers)}
        />
      </div>

      <div className="rounded-3xl bg-[#222222] p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="block">
            <span className="sr-only">Search drivers</span>
            <input
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
              placeholder="Search drivers"
              type="search"
            />
          </label>
          <label className="block">
            <span className="sr-only">Availability filter</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Availability</option>
              <option value="available">Available</option>
              <option value="on_delivery">On Delivery</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Status filter</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
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
            <h2 className="text-xl font-medium">Driver Records</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Read-only records currently allowed by Supabase RLS.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-10 text-sm text-zinc-400">
            Loading driver records...
          </p>
        ) : drivers.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              DE
            </div>
            <h3 className="mt-4 text-lg font-semibold">No drivers found.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Driver account creation will be handled through the user
              management flow.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Driver</th>
                  <th className="px-5 py-4 font-medium">Contact</th>
                  <th className="px-5 py-4 font-medium">License</th>
                  <th className="px-5 py-4 font-medium">Availability</th>
                  <th className="px-5 py-4 font-medium">Assigned Vehicle</th>
                  <th className="px-5 py-4 font-medium">Performance Score</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {drivers.map((driver) => (
                  <tr className="transition hover:bg-white/5" key={driver.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                          {(driver.firstName[0] || "D").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {driver.firstName || driver.lastName
                              ? `${driver.firstName} ${driver.lastName}`.trim()
                              : "Unnamed driver"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {driver.role || "No role"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>{driver.email || "No email"}</div>
                      <div className="text-xs text-zinc-500">
                        {driver.phone || "No phone"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>{driver.licenseNumber || "No license"}</div>
                      <div className="text-xs text-zinc-500">
                        Expires {driver.licenseExpiry || "not set"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <AvailabilityBadge availability={driver.availability} />
                    </td>
                    <td className="px-5 py-4">
                      {driver.assignedVehicleId || "Unassigned"}
                    </td>
                    <td className="px-5 py-4">
                      <PerformanceMeter score={driver.performanceScore} />
                    </td>
                    <td className="px-5 py-4">
                      <ProfileStatusBadge isActive={driver.isActive} />
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
