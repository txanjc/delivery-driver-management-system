"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import {
  normalizeVehicleStatus,
  VehicleStatusBadge,
} from "../_components/admin-ui";

type VehicleStatus = "Available" | "Assigned" | "Maintenance" | "Out of Service";

type VehicleRow = {
  vehicle_id: string;
  vehicle_number: string | null;
  license_plate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: string | null;
  mileage: number | null;
  insurance_policy_number: string | null;
  insurance_expiry_date: string | null;
  registration_number: string | null;
  registration_expiry_date: string | null;
  status: string | null;
};

type VehicleRecord = {
  vehicleId: string;
  vehicleNumber: string;
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  vehicleType: string;
  mileage: string;
  insurancePolicyNumber: string;
  insuranceExpiry: string;
  registrationNumber: string;
  registrationExpiry: string;
  status: VehicleStatus;
};

type VehicleFormState = {
  vehicleNumber: string;
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  vehicleType: string;
  mileage: string;
  insurancePolicyNumber: string;
  insuranceExpiry: string;
  registrationNumber: string;
  registrationExpiry: string;
  status: VehicleStatus;
};

type VehiclePayload = {
  vehicle_number: string | null;
  license_plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: string | null;
  mileage: number | null;
  insurance_policy_number: string | null;
  insurance_expiry_date: string | null;
  registration_number: string | null;
  registration_expiry_date: string | null;
  status: string;
};

const emptyVehicleForm: VehicleFormState = {
  vehicleNumber: "",
  plateNumber: "",
  make: "",
  model: "",
  year: "",
  vehicleType: "",
  mileage: "",
  insurancePolicyNumber: "",
  insuranceExpiry: "",
  registrationNumber: "",
  registrationExpiry: "",
  status: "Available",
};

const vehicleStatuses: VehicleStatus[] = [
  "Available",
  "Assigned",
  "Maintenance",
  "Out of Service",
];

function toVehicleStatus(status: string | null): VehicleStatus {
  const normalizedStatus = normalizeVehicleStatus(status ?? "");

  if (
    normalizedStatus === "Available" ||
    normalizedStatus === "Assigned" ||
    normalizedStatus === "Maintenance" ||
    normalizedStatus === "Out of Service"
  ) {
    return normalizedStatus;
  }

  return "Available";
}

function toVehicleStatusValue(status: VehicleStatus) {
  if (status === "Assigned") {
    return "in_service";
  }

  if (status === "Maintenance") {
    return "maintenance_due";
  }

  if (status === "Out of Service") {
    return "out_of_service";
  }

  return "available";
}

function toVehicleRecord(vehicle: VehicleRow): VehicleRecord {
  return {
    vehicleId: vehicle.vehicle_id,
    vehicleNumber: vehicle.vehicle_number ?? "",
    plateNumber: vehicle.license_plate ?? "",
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    year: vehicle.year === null ? "" : String(vehicle.year),
    vehicleType: vehicle.vehicle_type ?? "",
    mileage: vehicle.mileage === null ? "" : String(vehicle.mileage),
    insurancePolicyNumber: vehicle.insurance_policy_number ?? "",
    insuranceExpiry: vehicle.insurance_expiry_date ?? "",
    registrationNumber: vehicle.registration_number ?? "",
    registrationExpiry: vehicle.registration_expiry_date ?? "",
    status: toVehicleStatus(vehicle.status),
  };
}

function toVehicleForm(vehicle: VehicleRecord): VehicleFormState {
  return {
    vehicleNumber: vehicle.vehicleNumber,
    plateNumber: vehicle.plateNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    vehicleType: vehicle.vehicleType,
    mileage: vehicle.mileage,
    insurancePolicyNumber: vehicle.insurancePolicyNumber,
    insuranceExpiry: vehicle.insuranceExpiry,
    registrationNumber: vehicle.registrationNumber,
    registrationExpiry: vehicle.registrationExpiry,
    status: vehicle.status,
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

function toVehiclePayload(formState: VehicleFormState): VehiclePayload {
  return {
    vehicle_number: formState.vehicleNumber.trim() || null,
    license_plate: formState.plateNumber.trim(),
    make: formState.make.trim() || null,
    model: formState.model.trim() || null,
    year: toNullableNumber(formState.year),
    vehicle_type: formState.vehicleType.trim() || null,
    mileage: toNullableNumber(formState.mileage),
    insurance_policy_number: formState.insurancePolicyNumber.trim() || null,
    insurance_expiry_date: formState.insuranceExpiry || null,
    registration_number: formState.registrationNumber.trim() || null,
    registration_expiry_date: formState.registrationExpiry || null,
    status: toVehicleStatusValue(formState.status),
  };
}

function formatMileage(mileage: string) {
  const numericMileage = Number(mileage);

  if (!Number.isFinite(numericMileage)) {
    return "Not recorded";
  }

  return `${numericMileage.toLocaleString()} mi`;
}

function formatDate(value: string) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getVehicleName(vehicle: VehicleRecord) {
  const vehicleName = [vehicle.make, vehicle.model, vehicle.year]
    .filter(Boolean)
    .join(" ");

  return vehicleName || "Unnamed vehicle";
}

function VehicleKpiCard({
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

function VehicleModal({
  mode,
  formState,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  formState: VehicleFormState;
  isSaving: boolean;
  onChange: (field: keyof VehicleFormState, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const title = mode === "create" ? "Add Vehicle" : "Edit Vehicle";
  const buttonLabel = mode === "create" ? "Save Vehicle" : "Save Changes";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#222222] p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Maintain fleet records used by future assignment workflows.
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
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Vehicle Number
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("vehicleNumber", event.target.value)
                }
                value={formState.vehicleNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                License Plate
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) => onChange("plateNumber", event.target.value)}
                required
                value={formState.plateNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Make</span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) => onChange("make", event.target.value)}
                value={formState.make}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Model</span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) => onChange("model", event.target.value)}
                value={formState.model}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Year</span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                min="1900"
                onChange={(event) => onChange("year", event.target.value)}
                type="number"
                value={formState.year}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Vehicle Type
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) => onChange("vehicleType", event.target.value)}
                value={formState.vehicleType}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Mileage</span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                min="0"
                onChange={(event) => onChange("mileage", event.target.value)}
                type="number"
                value={formState.mileage}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Insurance Policy Number
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("insurancePolicyNumber", event.target.value)
                }
                value={formState.insurancePolicyNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Insurance Expiry
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) =>
                  onChange("insuranceExpiry", event.target.value)
                }
                type="date"
                value={formState.insuranceExpiry}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Registration Number
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("registrationNumber", event.target.value)
                }
                value={formState.registrationNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Registration Expiry
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) =>
                  onChange("registrationExpiry", event.target.value)
                }
                type="date"
                value={formState.registrationExpiry}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-zinc-300">Status</span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("status", event.target.value)}
                value={formState.status}
              >
                {vehicleStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

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
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Saving..." : buttonLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(
    null,
  );
  const [formState, setFormState] =
    useState<VehicleFormState>(emptyVehicleForm);

  const loadVehicles = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("vehicles")
      .select(
        "vehicle_id, vehicle_number, license_plate, make, model, year, vehicle_type, mileage, insurance_policy_number, insurance_expiry_date, registration_number, registration_expiry_date, status",
      )
      .order("created_at", { ascending: false })
      .returns<VehicleRow[]>();

    if (error) {
      setErrorMessage(error.message);
      setVehicles([]);
      setIsLoading(false);
      return;
    }

    setVehicles((data ?? []).map(toVehicleRecord));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadVehicles();
    });
  }, [loadVehicles]);

  const vehicleStats = useMemo(() => {
    return {
      assigned: vehicles.filter((vehicle) => vehicle.status === "Assigned")
        .length,
      available: vehicles.filter((vehicle) => vehicle.status === "Available")
        .length,
      maintenance: vehicles.filter(
        (vehicle) => vehicle.status === "Maintenance",
      ).length,
      total: vehicles.length,
    };
  }, [vehicles]);

  function openCreateModal() {
    setEditingVehicle(null);
    setFormState(emptyVehicleForm);
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function openEditModal(vehicle: VehicleRecord) {
    setEditingVehicle(vehicle);
    setFormState(toVehicleForm(vehicle));
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingVehicle(null);
    setFormState(emptyVehicleForm);
  }

  function updateFormState(field: keyof VehicleFormState, value: string) {
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

    const payload = toVehiclePayload(formState);

    if (!payload.license_plate) {
      setErrorMessage("Plate Number is required.");
      setIsSaving(false);
      return;
    }

    const { error } = editingVehicle
      ? await supabase
          .from("vehicles")
          .update(payload)
          .eq("vehicle_id", editingVehicle.vehicleId)
      : await supabase.from("vehicles").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    await loadVehicles();
    setSuccessMessage(
      editingVehicle
        ? "Vehicle updated successfully."
        : "Vehicle created successfully.",
    );
    setIsSaving(false);
    setIsModalOpen(false);
    setEditingVehicle(null);
    setFormState(emptyVehicleForm);
  }

  return (
    <section className="space-y-5 text-white">
      <div className="flex flex-col gap-4 rounded-3xl bg-[#222222] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">
            Fleet Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Vehicles
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Manage vehicle availability, service readiness, compliance dates,
            and future delivery assignment capacity.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          onClick={openCreateModal}
          type="button"
        >
          Add Vehicle
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <VehicleKpiCard
          accent
          detail="All fleet records"
          label="Total Vehicles"
          value={String(vehicleStats.total)}
        />
        <VehicleKpiCard
          detail="Ready for dispatch"
          label="Available Vehicles"
          value={String(vehicleStats.available)}
        />
        <VehicleKpiCard
          detail="Reserved for active work"
          label="Assigned Vehicles"
          value={String(vehicleStats.assigned)}
        />
        <VehicleKpiCard
          detail="Requires inspection or service"
          label="Maintenance Due"
          value={String(vehicleStats.maintenance)}
        />
      </div>

      <div className="rounded-3xl bg-[#222222] p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_240px]">
          <label className="block">
            <span className="sr-only">Search vehicles</span>
            <input
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
              placeholder="Search vehicles"
              type="search"
            />
          </label>
          <label className="block">
            <span className="sr-only">Status filter</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Status filter</option>
              {vehicleStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Maintenance filter</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Maintenance filter</option>
              <option value="current">Current</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_service">Out of Service</option>
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
            <h2 className="text-xl font-medium">Vehicle Records</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Fleet records loaded from the vehicles table.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-10 text-sm text-zinc-400">
            Loading vehicle records...
          </p>
        ) : vehicles.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              DE
            </div>
            <h3 className="mt-4 text-lg font-semibold">No vehicles found.</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-400">
              No vehicles found. Add your first vehicle to begin managing fleet
              operations.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Vehicle</th>
                  <th className="px-5 py-4 font-medium">License Plate</th>
                  <th className="px-5 py-4 font-medium">Mileage</th>
                  <th className="px-5 py-4 font-medium">Insurance Expiry</th>
                  <th className="px-5 py-4 font-medium">
                    Registration Expiry
                  </th>
                  <th className="px-5 py-4 font-medium">
                    Registration Number
                  </th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {vehicles.map((vehicle) => (
                  <tr
                    className="transition hover:bg-white/5"
                    key={vehicle.vehicleId}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                          {vehicle.make[0]?.toUpperCase() || "V"}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {getVehicleName(vehicle)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {vehicle.vehicleNumber || "No vehicle number"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {vehicle.plateNumber || "Not recorded"}
                    </td>
                    <td className="px-5 py-4">
                      {formatMileage(vehicle.mileage)}
                    </td>
                    <td className="px-5 py-4">
                      {formatDate(vehicle.insuranceExpiry)}
                    </td>
                    <td className="px-5 py-4">
                      {formatDate(vehicle.registrationExpiry)}
                    </td>
                    <td className="px-5 py-4">
                      {vehicle.registrationNumber || "Not recorded"}
                    </td>
                    <td className="px-5 py-4">
                      <VehicleStatusBadge status={vehicle.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                        onClick={() => openEditModal(vehicle)}
                        type="button"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen ? (
        <VehicleModal
          formState={formState}
          isSaving={isSaving}
          mode={editingVehicle ? "edit" : "create"}
          onChange={updateFormState}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  );
}
