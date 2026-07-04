"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { fetchAdministratorJson } from "@/lib/admin-api-client";
import {
  AdminCard,
  AdminPageIntro,
  PrimaryActionButton,
} from "../_components/admin-design-system";
import { DEFAULT_PAGE_SIZE, Pagination } from "../_components/Pagination";
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
  created_at: string | null;
  updated_at: string | null;
};

type AssignmentSchedule = { schedule_id: string; shift_date: string | null; shift_type: string | null; shift_name: string | null; start_time: string | null; end_time: string | null; status: string | null };
type VehicleAssignmentRow = { vehicle_id: string | null; driver_name: string | null; driver_email: string | null; schedule: AssignmentSchedule };
type VehicleAssignment = { driverName: string; driverEmail: string; schedule: AssignmentSchedule | null };

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
  createdAt: string | null;
  updatedAt: string | null;
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
    return "assigned";
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
    insuranceExpiry: vehicle.insurance_expiry_date?.slice(0, 10) ?? "",
    registrationNumber: vehicle.registration_number ?? "",
    registrationExpiry: vehicle.registration_expiry_date?.slice(0, 10) ?? "",
    status: toVehicleStatus(vehicle.status),
    createdAt: vehicle.created_at,
    updatedAt: vehicle.updated_at,
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

function toDateOnlyValue(value: string): string | null {
  const dateOnlyValue = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnlyValue) ? dateOnlyValue : null;
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
    insurance_expiry_date: toDateOnlyValue(formState.insuranceExpiry),
    registration_number: formState.registrationNumber.trim() || null,
    registration_expiry_date: toDateOnlyValue(formState.registrationExpiry),
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
  const dateOnlyValue = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnlyValue);
  if (!match) return "Not set";

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "Not set";
  return `${monthNames[month - 1]} ${day}, ${match[1]}`;
}

function getVehicleName(vehicle: VehicleRecord) {
  const vehicleName = [vehicle.make, vehicle.model, vehicle.year]
    .filter(Boolean)
    .join(" ");

  return vehicleName || "Unnamed vehicle";
}

function toVehicleAssignment(row: VehicleAssignmentRow): VehicleAssignment {
  return {
    driverName: row.driver_name || "Unnamed driver",
    driverEmail: row.driver_email ?? "",
    schedule: row.schedule.status === "cancelled" ? null : row.schedule,
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-700">{value}</p></div>;
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
      className={`rounded-[20px] border p-5 shadow-sm ${accent ? "border-[#172f3a] bg-[#172f3a] text-white" : "border-slate-100 bg-white text-[#17232b]"}`}
    >
      <p className={accent ? "text-xs text-slate-300" : "text-xs text-slate-500"}>{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function VehicleModal({
  mode,
  vehicle,
  assignment,
  formState,
  isEditing,
  isDirty,
  isSaving,
  onCancel,
  onChange,
  onClose,
  onEdit,
  onSubmit,
}: {
  mode: "create" | "view";
  vehicle: VehicleRecord | null;
  assignment: VehicleAssignment | null;
  formState: VehicleFormState;
  isEditing: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (field: keyof VehicleFormState, value: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isCreateMode = mode === "create";
  const fieldsEnabled = isCreateMode || isEditing;
  const previewVehicle: VehicleRecord = vehicle ?? {
    vehicleId: "", vehicleNumber: formState.vehicleNumber, plateNumber: formState.plateNumber,
    make: formState.make, model: formState.model, year: formState.year,
    vehicleType: formState.vehicleType, mileage: formState.mileage,
    insurancePolicyNumber: formState.insurancePolicyNumber, insuranceExpiry: formState.insuranceExpiry,
    registrationNumber: formState.registrationNumber, registrationExpiry: formState.registrationExpiry,
    status: formState.status, createdAt: null, updatedAt: null,
  };

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);

  const inputClass = "mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md"
      role="dialog"
    >
      <div className={`max-h-[94vh] w-full overflow-hidden rounded-[24px] border border-white bg-white/95 p-1.5 text-[#17232b] shadow-2xl shadow-slate-900/20 ring-1 ring-purple-100/50 ${isCreateMode ? "max-w-4xl" : "max-w-[1500px]"}`}>
       <div className="user-modal-scrollbar max-h-[calc(94vh-0.75rem)] overflow-y-auto rounded-[19px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-semibold">{isCreateMode ? "Create Vehicle" : "Vehicle Details"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isCreateMode ? "Add a vehicle to the operational fleet." : "Review vehicle details, maintenance data, and schedule context."}
            </p>
          </div>
          <button
            aria-label="Close vehicle details"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
          </button>
        </div>

        <form className="mt-5 space-y-5" onSubmit={onSubmit}>
          <div className={isCreateMode ? "" : "grid gap-5 lg:grid-cols-[250px_minmax(480px,1fr)_290px]"}>
          {!isCreateMode ? <aside className="border-b border-dashed border-slate-200 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600">Vehicle Overview</p>
            <div className="mt-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-100 text-2xl font-bold text-purple-700">{previewVehicle.year || "VE"}</div>
            <h3 className="mt-4 text-lg font-semibold">{getVehicleName(previewVehicle)}</h3>
            <div className="mt-2"><VehicleStatusBadge status={previewVehicle.status} /></div>
            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4">
              <DetailField label="Vehicle number" value={previewVehicle.vehicleNumber || "Not recorded"} />
              <DetailField label="License plate" value={previewVehicle.plateNumber || "Not recorded"} />
              <DetailField label="Created at" value={formatDateTime(previewVehicle.createdAt)} />
              <DetailField label="Updated at" value={formatDateTime(previewVehicle.updatedAt)} />
            </div>
          </aside> : null}
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600">Vehicle Fields</p><fieldset className="mt-4 grid gap-3 md:grid-cols-2" disabled={!fieldsEnabled}>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                Vehicle Number
              </span>
              <input
                className={inputClass}
                onChange={(event) =>
                  onChange("vehicleNumber", event.target.value)
                }
                value={formState.vehicleNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                License Plate
              </span>
              <input
                className={inputClass}
                onChange={(event) => onChange("plateNumber", event.target.value)}
                required
                value={formState.plateNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Make</span>
              <input
                className={inputClass}
                onChange={(event) => onChange("make", event.target.value)}
                value={formState.make}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Model</span>
              <input
                className={inputClass}
                onChange={(event) => onChange("model", event.target.value)}
                value={formState.model}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Year</span>
              <input
                className={inputClass}
                min="1900"
                onChange={(event) => onChange("year", event.target.value)}
                type="number"
                value={formState.year}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                Vehicle Type
              </span>
              <input
                className={inputClass}
                onChange={(event) => onChange("vehicleType", event.target.value)}
                value={formState.vehicleType}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Mileage</span>
              <input
                className={inputClass}
                min="0"
                onChange={(event) => onChange("mileage", event.target.value)}
                type="number"
                value={formState.mileage}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                Insurance Policy Number
              </span>
              <input
                className={inputClass}
                onChange={(event) =>
                  onChange("insurancePolicyNumber", event.target.value)
                }
                value={formState.insurancePolicyNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                Insurance Expiry
              </span>
              <input
                className={inputClass}
                onChange={(event) =>
                  onChange("insuranceExpiry", event.target.value)
                }
                type="date"
                value={formState.insuranceExpiry}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                Registration Number
              </span>
              <input
                className={inputClass}
                onChange={(event) =>
                  onChange("registrationNumber", event.target.value)
                }
                value={formState.registrationNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                Registration Expiry
              </span>
              <input
                className={inputClass}
                onChange={(event) =>
                  onChange("registrationExpiry", event.target.value)
                }
                type="date"
                value={formState.registrationExpiry}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Status</span>
              <select
                className={`${inputClass} appearance-none pr-9`}
                onChange={(event) => onChange("status", event.target.value)}
                value={formState.status}
              >
                {vehicleStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </fieldset></div>
          {!isCreateMode ? <aside className="border-t border-dashed border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600">Schedule / Assignment</p>
            {assignment ? <div className="mt-4">
              <div className="rounded-2xl bg-purple-50 p-4"><p className="text-xs text-purple-500">Current assigned driver</p><p className="mt-1 font-semibold text-purple-900">{assignment.driverName}</p>{assignment.driverEmail ? <p className="mt-1 break-all text-xs text-purple-600">{assignment.driverEmail}</p> : null}</div>
              {assignment.schedule ? <div className="mt-4 grid gap-4 rounded-2xl border border-slate-100 p-4">
                <DetailField label="Related schedule" value={assignment.schedule.shift_name || "Scheduled shift"} />
                <DetailField label="Shift date" value={formatDate(assignment.schedule.shift_date ?? "")} />
                <DetailField label="Shift type" value={assignment.schedule.shift_type || "Not set"} />
                <div className="grid grid-cols-2 gap-3"><DetailField label="Start time" value={assignment.schedule.start_time || "Not set"} /><DetailField label="End time" value={assignment.schedule.end_time || "Not set"} /></div>
              </div> : <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">No active schedule assignment found for this vehicle.</p>}
            </div> : <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">No active schedule assignment found for this vehicle.</p>}
          </aside> : null}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            {!isCreateMode && !isEditing ? <PrimaryActionButton disabled={isSaving} onClick={onEdit} type="button">Edit</PrimaryActionButton> : <>
            <button
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              disabled={isSaving}
              onClick={isCreateMode ? onClose : onCancel}
              type="button"
            >
              Cancel
            </button>
            <PrimaryActionButton
              disabled={isSaving || (!isCreateMode && !isDirty)}
              type="submit"
            >
              {isSaving ? "Saving..." : isCreateMode ? "Create Vehicle" : "Save Changes"}
            </PrimaryActionButton></>}
          </div>
        </form>
       </div>
      </div>
    </div>
  );
}

export default function AdminVehiclesPage() {
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [assignments, setAssignments] = useState<Record<string, VehicleAssignment | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(
    null,
  );
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (searchParams.get("action") !== "create") return;
    const timeoutId = window.setTimeout(() => setIsModalOpen(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);
  const [formState, setFormState] =
    useState<VehicleFormState>(emptyVehicleForm);
  const [initialFormState, setInitialFormState] = useState<VehicleFormState>(emptyVehicleForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const vehicleTypes = useMemo(() => Array.from(new Set(vehicles.map((vehicle) => vehicle.vehicleType).filter(Boolean))).sort(), [vehicles]);
  const filteredVehicles = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      const matchesSearch = !query || [getVehicleName(vehicle), vehicle.vehicleNumber, vehicle.plateNumber, vehicle.vehicleType].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;
      const matchesType = typeFilter === "all" || vehicle.vehicleType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [searchInput, statusFilter, typeFilter, vehicles]);
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / DEFAULT_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedVehicles = filteredVehicles.slice(
    (activePage - 1) * DEFAULT_PAGE_SIZE,
    activePage * DEFAULT_PAGE_SIZE,
  );

  const loadVehicles = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchAdministratorJson<{ vehicles: VehicleRow[] }>("/api/admin/vehicles");
      setVehicles(data.vehicles.map(toVehicleRecord));
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load vehicles.");
      setVehicles([]);
      setAssignments({});
      return false;
    } finally {
      setIsLoading(false);
    }
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
    setInitialFormState(emptyVehicleForm);
    setIsEditing(false);
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  async function openViewModal(vehicle: VehicleRecord) {
    const nextForm = toVehicleForm(vehicle);
    setEditingVehicle(vehicle);
    setFormState(nextForm);
    setInitialFormState(nextForm);
    setIsEditing(false);
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
    try {
      const data = await fetchAdministratorJson<{ assignment: VehicleAssignmentRow | null }>(`/api/admin/vehicles?vehicleId=${encodeURIComponent(vehicle.vehicleId)}`);
      setAssignments((current) => ({ ...current, [vehicle.vehicleId]: data.assignment ? toVehicleAssignment(data.assignment) : null }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load schedule assignment.");
    }
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingVehicle(null);
    setIsEditing(false);
    setFormState(emptyVehicleForm);
  }

  function cancelEditing() {
    setFormState(initialFormState);
    setIsEditing(false);
    setErrorMessage("");
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

    try {
      await fetchAdministratorJson("/api/admin/vehicles", { method: editingVehicle ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingVehicle ? { vehicle_id: editingVehicle.vehicleId, vehicle: payload } : payload) });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save vehicle.");
      setIsSaving(false);
      return;
    }

    const didRefreshVehicles = await loadVehicles();
    if (!didRefreshVehicles) {
      setIsSaving(false);
      return;
    }
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
    <section className="space-y-4 text-[#17232b]">
      <AdminPageIntro
        actions={<PrimaryActionButton className="gap-2 px-6 py-3" onClick={openCreateModal} type="button"><span aria-hidden="true" className="text-lg leading-none">+</span><span>Create Vehicle</span></PrimaryActionButton>}
        description="Manage vehicle availability, service readiness, compliance dates, and assignment capacity across the delivery fleet."
        eyebrow="Fleet management"
        title="Vehicles"
      />

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

      <AdminCard className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_240px]">
          <label className="block">
            <span className="sr-only">Search vehicles</span>
            <input
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
              onChange={(event) => { setSearchInput(event.target.value); setCurrentPage(1); }}
              placeholder="Search vehicles"
              type="search"
              value={searchInput}
            />
          </label>
          <label className="block">
            <span className="sr-only">Status filter</span>
            <select
              className="users-filter-select h-11 w-full appearance-none rounded-full border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-600 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
              onChange={(event) => { setStatusFilter(event.target.value as VehicleStatus | "all"); setCurrentPage(1); }}
              value={statusFilter}
            >
              <option value="all">All Statuses</option>
              {vehicleStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Vehicle type filter</span>
            <select
              className="users-filter-select h-11 w-full appearance-none rounded-full border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-600 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
              onChange={(event) => { setTypeFilter(event.target.value); setCurrentPage(1); }}
              value={typeFilter}
            >
              <option value="all">All Vehicle Types</option>
              {vehicleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>
      </AdminCard>

      {successMessage ? (
        <p className="fixed right-6 top-6 z-[60] rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-sm font-medium text-emerald-700 shadow-xl">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="fixed right-6 top-6 z-[60] max-w-sm rounded-2xl border border-red-200 bg-white px-5 py-4 text-sm font-medium text-red-700 shadow-xl">
          {errorMessage}
        </p>
      ) : null}

      <AdminCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-xl font-medium">Vehicle Records</h2>
            <p className="mt-1 text-sm text-slate-400">
              Fleet records loaded from the vehicles table.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-10 text-sm text-slate-500">
            Loading vehicle records...
          </p>
        ) : filteredVehicles.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-sm font-semibold text-purple-700">
              VE
            </div>
            <h3 className="mt-4 text-lg font-semibold">No vehicles found.</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              {vehicles.length === 0 ? "Add your first vehicle to begin managing fleet operations." : "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm [&_td]:py-2.5 [&_th]:py-2.5">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-medium">Vehicle</th>
                  <th className="px-5 py-4 font-medium">License Plate</th>
                  <th className="px-5 py-4 font-medium">Mileage</th>
                  <th className="px-5 py-4 font-medium">Insurance Expiry</th>
                  <th className="px-5 py-4 font-medium">
                    Registration Number
                  </th>
                  <th className="px-5 py-4 text-center font-medium">
                    Registration Expiry
                  </th>
                  <th className="px-5 py-4 text-center font-medium">Status</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-500">
                {paginatedVehicles.map((vehicle) => (
                  <tr
                    className="transition hover:bg-slate-50/70"
                    key={vehicle.vehicleId}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-xs font-semibold text-purple-700">
                          {vehicle.make[0]?.toUpperCase() || "V"}
                        </div>
                        <div>
                          <p className="font-semibold text-[#17232b]">
                            {getVehicleName(vehicle)}
                          </p>
                          <p className="text-xs text-slate-400">
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
                      {vehicle.registrationNumber || "Not recorded"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {formatDate(vehicle.registrationExpiry)}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <VehicleStatusBadge status={vehicle.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                        onClick={() => void openViewModal(vehicle)}
                        type="button"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </AdminCard>

      <Pagination
        currentPage={activePage}
        onPageChange={setCurrentPage}
        totalPages={totalPages}
        totalRecords={filteredVehicles.length}
        tone="purple"
      />

      {isModalOpen ? (
        <VehicleModal
          assignment={editingVehicle ? assignments[editingVehicle.vehicleId] ?? null : null}
          formState={formState}
          isDirty={JSON.stringify(formState) !== JSON.stringify(initialFormState)}
          isEditing={isEditing}
          isSaving={isSaving}
          mode={editingVehicle ? "view" : "create"}
          onCancel={cancelEditing}
          onChange={updateFormState}
          onClose={closeModal}
          onEdit={() => setIsEditing(true)}
          onSubmit={handleSubmit}
          vehicle={editingVehicle}
        />
      ) : null}
    </section>
  );
}
