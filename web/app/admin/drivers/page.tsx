"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type DriverProfile = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

type DriverRow = {
  driver_id: string;
  user_id: string;
  license_number: string | null;
  license_expiry_date: string | null;
  availability: string | null;
  performance_score: number | null;
  assigned_vehicle_id: string | null;
  profiles: DriverProfile | DriverProfile[] | null;
};

type DriverRecord = {
  driverId: string;
  userId: string;
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
};

type DriverFormState = {
  selectedProfileId: string;
  licenseNumber: string;
  licenseExpiry: string;
  availability: string;
  performanceScore: string;
};

type DriverPayload = {
  user_id?: string;
  license_number: string | null;
  license_expiry_date: string | null;
  availability: string | null;
  performance_score: number | null;
};

const emptyDriverForm: DriverFormState = {
  selectedProfileId: "",
  licenseNumber: "",
  licenseExpiry: "",
  availability: "available",
  performanceScore: "",
};

const availabilityOptions = [
  { label: "Available", value: "available" },
  { label: "On Delivery", value: "on_delivery" },
  { label: "Unavailable", value: "unavailable" },
];

function normalizeProfile(profile: DriverRow["profiles"]) {
  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile;
}

function toDriverRecord(driver: DriverRow): DriverRecord {
  const profile = normalizeProfile(driver.profiles);

  return {
    driverId: driver.driver_id,
    userId: driver.user_id,
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    role: profile?.role ?? "",
    isActive: profile?.is_active ?? false,
    licenseNumber: driver.license_number ?? "",
    licenseExpiry: driver.license_expiry_date ?? "",
    availability: driver.availability ?? "",
    performanceScore:
      driver.performance_score === null ? "" : String(driver.performance_score),
  };
}

function toDriverForm(driver: DriverRecord): DriverFormState {
  return {
    selectedProfileId: driver.userId,
    licenseNumber: driver.licenseNumber,
    licenseExpiry: driver.licenseExpiry,
    availability: driver.availability || "available",
    performanceScore: driver.performanceScore,
  };
}

function toNullableNumber(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function toDriverPayload(formState: DriverFormState): DriverPayload {
  return {
    license_number: formState.licenseNumber.trim() || null,
    license_expiry_date: formState.licenseExpiry || null,
    availability: formState.availability || null,
    performance_score: toNullableNumber(formState.performanceScore),
  };
}

function getProfileName(profile: DriverProfile) {
  const profileName = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ");

  return profileName || profile.email || "Unnamed driver profile";
}

function getDriverName(driver: DriverRecord) {
  const driverName = [driver.firstName, driver.lastName]
    .filter(Boolean)
    .join(" ");

  return driverName || "Unnamed driver";
}

function formatAvailability(availability: string) {
  const option = availabilityOptions.find(
    (availabilityOption) => availabilityOption.value === availability,
  );

  if (option) {
    return option.label;
  }

  return availability
    ? availability
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : "Not set";
}

function DriverKpiCard({
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
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
    >
      {formatAvailability(availability)}
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

function DriverModal({
  availableProfiles,
  formState,
  isSaving,
  mode,
  onChange,
  onClose,
  onSubmit,
}: {
  availableProfiles: DriverProfile[];
  formState: DriverFormState;
  isSaving: boolean;
  mode: "create" | "edit";
  onChange: (field: keyof DriverFormState, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isCreateMode = mode === "create";

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
              {isCreateMode ? "Add Driver" : "Edit Driver"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Link an existing driver profile to operational driver details.
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
            {isCreateMode ? (
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-zinc-300">
                  Driver Profile
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                  onChange={(event) =>
                    onChange("selectedProfileId", event.target.value)
                  }
                  required
                  value={formState.selectedProfileId}
                >
                  <option value="">Select an existing driver profile</option>
                  {availableProfiles.map((profile) => (
                    <option key={profile.profile_id} value={profile.profile_id}>
                      {getProfileName(profile)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                License Number
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) =>
                  onChange("licenseNumber", event.target.value)
                }
                required
                value={formState.licenseNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                License Expiry
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) =>
                  onChange("licenseExpiry", event.target.value)
                }
                type="date"
                value={formState.licenseExpiry}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Availability
              </span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) =>
                  onChange("availability", event.target.value)
                }
                value={formState.availability}
              >
                {availabilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Performance Score
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                max="100"
                min="0"
                onChange={(event) =>
                  onChange("performanceScore", event.target.value)
                }
                type="number"
                value={formState.performanceScore}
              />
            </label>
          </div>

          {isCreateMode && availableProfiles.length === 0 ? (
            <p className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
              Create a driver user in Supabase Auth and profiles first.
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
              disabled={isSaving || (isCreateMode && availableProfiles.length === 0)}
              type="submit"
            >
              {isSaving
                ? "Saving..."
                : isCreateMode
                  ? "Create Driver"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [driverProfiles, setDriverProfiles] = useState<DriverProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverRecord | null>(null);
  const [formState, setFormState] =
    useState<DriverFormState>(emptyDriverForm);

  const loadDriverData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const [driversResponse, profilesResponse] = await Promise.all([
      supabase
        .from("drivers")
        .select(
          "driver_id, user_id, license_number, license_expiry_date, availability, performance_score, assigned_vehicle_id, profiles:user_id (profile_id, first_name, last_name, email, phone, role, is_active)",
        )
        .order("created_at", { ascending: false })
        .returns<DriverRow[]>(),
      supabase
        .from("profiles")
        .select("profile_id, first_name, last_name, email, phone, role, is_active")
        .eq("role", "driver")
        .order("first_name", { ascending: true })
        .returns<DriverProfile[]>(),
    ]);

    if (driversResponse.error) {
      setErrorMessage(driversResponse.error.message);
      setDrivers([]);
      setIsLoading(false);
      return;
    }

    if (profilesResponse.error) {
      setErrorMessage(profilesResponse.error.message);
      setDriverProfiles([]);
      setIsLoading(false);
      return;
    }

    setDrivers((driversResponse.data ?? []).map(toDriverRecord));
    setDriverProfiles(profilesResponse.data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDriverData();
    });
  }, [loadDriverData]);

  const availableProfiles = useMemo(() => {
    const driverUserIds = new Set(drivers.map((driver) => driver.userId));

    return driverProfiles.filter(
      (profile) => !driverUserIds.has(profile.profile_id),
    );
  }, [driverProfiles, drivers]);

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

  function openCreateModal() {
    setEditingDriver(null);
    setFormState({
      ...emptyDriverForm,
      selectedProfileId: availableProfiles[0]?.profile_id ?? "",
    });
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function openEditModal(driver: DriverRecord) {
    setEditingDriver(driver);
    setFormState(toDriverForm(driver));
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingDriver(null);
    setFormState(emptyDriverForm);
  }

  function updateFormState(field: keyof DriverFormState, value: string) {
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

    const payload = toDriverPayload(formState);

    if (!payload.license_number) {
      setErrorMessage("License Number is required.");
      setIsSaving(false);
      return;
    }

    if (!editingDriver && !formState.selectedProfileId) {
      setErrorMessage("Select an existing driver profile.");
      setIsSaving(false);
      return;
    }

    const { error } = editingDriver
      ? await supabase
          .from("drivers")
          .update(payload)
          .eq("driver_id", editingDriver.driverId)
      : await supabase.from("drivers").insert({
          ...payload,
          user_id: formState.selectedProfileId,
        });

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    await loadDriverData();
    setSuccessMessage(
      editingDriver
        ? "Driver updated successfully."
        : "Driver record created successfully.",
    );
    setIsSaving(false);
    setIsModalOpen(false);
    setEditingDriver(null);
    setFormState(emptyDriverForm);
  }

  async function deactivateDriver(driver: DriverRecord) {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("profile_id", driver.userId);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    await loadDriverData();
    setSuccessMessage("Driver profile marked inactive.");
    setIsSaving(false);
  }

  const emptyStateMessage =
    driverProfiles.length === 0
      ? "Create a driver user in Supabase Auth and profiles first."
      : "Driver profiles exist, but no driver records have been created yet.";

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
            Monitor driver profiles, license readiness, availability,
            performance, and active status across the delivery network.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          onClick={openCreateModal}
          type="button"
        >
          Add Driver
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DriverKpiCard
          accent
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
              {availabilityOptions.map((option) => (
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
              defaultValue=""
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
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
            <h2 className="text-xl font-medium">Driver Records</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Driver records joined to profiles through drivers.user_id.
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
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-400">
              {emptyStateMessage}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Driver</th>
                  <th className="px-5 py-4 font-medium">Email</th>
                  <th className="px-5 py-4 font-medium">Phone</th>
                  <th className="px-5 py-4 font-medium">License Number</th>
                  <th className="px-5 py-4 font-medium">License Expiry</th>
                  <th className="px-5 py-4 font-medium">Availability</th>
                  <th className="px-5 py-4 font-medium">Performance Score</th>
                  <th className="px-5 py-4 font-medium">Active Status</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {drivers.map((driver) => (
                  <tr
                    className="transition hover:bg-white/5"
                    key={driver.driverId}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                          {(driver.firstName[0] || "D").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {getDriverName(driver)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {driver.role || "No role"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{driver.email || "No email"}</td>
                    <td className="px-5 py-4">{driver.phone || "No phone"}</td>
                    <td className="px-5 py-4">
                      {driver.licenseNumber || "No license"}
                    </td>
                    <td className="px-5 py-4">
                      {driver.licenseExpiry || "Not set"}
                    </td>
                    <td className="px-5 py-4">
                      <AvailabilityBadge availability={driver.availability} />
                    </td>
                    <td className="px-5 py-4">
                      <PerformanceMeter score={driver.performanceScore} />
                    </td>
                    <td className="px-5 py-4">
                      <ProfileStatusBadge isActive={driver.isActive} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                          onClick={() => openEditModal(driver)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-red-400/20 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isSaving || !driver.isActive}
                          onClick={() => void deactivateDriver(driver)}
                          type="button"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen ? (
        <DriverModal
          availableProfiles={availableProfiles}
          formState={formState}
          isSaving={isSaving}
          mode={editingDriver ? "edit" : "create"}
          onChange={updateFormState}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  );
}
