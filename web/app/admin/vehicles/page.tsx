"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { fetchAdministratorJson } from "@/lib/admin-api-client";
import { useNotify } from "@/components/ui/ToastProvider";
import {
  AdminCard,
  AdminFilterBarSkeleton,
  AdminPageIntro,
  PrimaryActionButton,
  SecondaryButton,
} from "../_components/admin-design-system";
import { DEFAULT_PAGE_SIZE, Pagination } from "../_components/Pagination";
import {
  normalizeVehicleStatus,
  VehicleStatusBadge,
} from "../_components/admin-ui";
import { AppIcons } from "@/config/icons";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

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
type VehicleMaintenanceRow = { maintenance_id: string; maintenance_type: string | null; cost: number | string | null; maintenance_date: string | null; created_at: string | null };
type VehicleMaintenance = { type: string; cost: number; date: string | null; createdAt: string | null };

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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
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
  const vehicleName = [vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ");

  return vehicleName || "Unnamed vehicle";
}

function titleCase(value: string) {
  return value.trim().replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toVehicleAssignment(row: VehicleAssignmentRow): VehicleAssignment {
  return {
    driverName: row.driver_name || "Unnamed driver",
    driverEmail: row.driver_email ?? "",
    schedule: row.schedule.status === "cancelled" ? null : row.schedule,
  };
}

function toVehicleMaintenance(row: VehicleMaintenanceRow | null): VehicleMaintenance | null {
  if (!row) return null;
  const cost = typeof row.cost === "number" ? row.cost : Number(row.cost);
  return {
    type: row.maintenance_type ? titleCase(row.maintenance_type) : "Maintenance",
    cost: Number.isFinite(cost) ? cost : 0,
    date: row.maintenance_date,
    createdAt: row.created_at,
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
}

function VehicleDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-b-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-semibold text-slate-800">{value || "Not recorded"}</dd>
    </div>
  );
}

function VehicleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] border border-purple-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.07)]">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function VehicleKpiCard({
  label,
  value,
  detail,
  accent = false,
  isLoading = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
  isLoading?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border p-5 shadow-sm ${accent ? "border-[#172f3a] bg-[#172f3a] text-white" : "border-slate-100 bg-white text-[#17232b]"}`}
    >
      {isLoading ? (
        <>
          <Skeleton className="h-3 w-24" rounded="rounded-full" />
          <Skeleton className="mt-4 h-9 w-20" rounded="rounded-full" />
          <Skeleton className="mt-2 h-3 w-32" rounded="rounded-full" />
        </>
      ) : (
        <>
          <p className={accent ? "text-xs text-slate-300" : "text-xs text-slate-500"}>{label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </>
      )}
    </div>
  );
}

function VehicleModal({
  mode,
  vehicle,
  assignment,
  maintenance,
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
  maintenance: VehicleMaintenance | null;
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

  const CloseIcon = AppIcons.close;
  const EditIcon = AppIcons.edit;
  const MoreIcon = AppIcons.more;
  const MileageIcon = AppIcons.mileage;
  const PlateIcon = AppIcons.identification;
  const InfoIcon = AppIcons.activity;
  const WarningIcon = AppIcons.warning;
  const CalendarIcon = AppIcons.calendar;
  const MaintenanceIcon = AppIcons.maintenance;
  const vehicleName = getVehicleName(previewVehicle);
  const vehicleNumber = previewVehicle.vehicleNumber || "Vehicle";
  const blocksAssignment = previewVehicle.status === "Maintenance" || previewVehicle.status === "Out of Service";
  const assignmentSchedule = assignment?.schedule;
  const scheduledWindow = assignmentSchedule
    ? `${formatDate(assignmentSchedule.shift_date ?? assignmentSchedule.start_time ?? "")} · ${formatTime(assignmentSchedule.start_time)}-${formatTime(assignmentSchedule.end_time)}`
    : "";

  if (!isCreateMode && !isEditing) {
    return (
      <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md" role="dialog">
        <div className="max-h-[calc(100vh-48px)] w-[min(1180px,calc(100vw-48px))] overflow-hidden rounded-[24px] border border-white bg-white/95 p-1.5 text-[#17232b] shadow-2xl shadow-purple-950/15 ring-1 ring-purple-100/70">
          <div className="flex max-h-[calc(100vh-60px)] flex-col overflow-hidden rounded-[19px] bg-white">
            <div className="sticky top-0 z-20 border-b border-purple-50 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-950">{vehicleNumber} · {vehicleName}</h2>
                    <VehicleStatusBadge status={previewVehicle.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Vehicle details, status, maintenance, and assignment information.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PrimaryActionButton disabled={isSaving} onClick={onEdit} type="button">
                    <EditIcon aria-hidden className="mr-2" size={15} weight="bold" />
                    Edit Vehicle
                  </PrimaryActionButton>
                  <details className="relative">
                    <summary aria-label="More vehicle actions" className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-purple-50 hover:text-purple-700 [&::-webkit-details-marker]:hidden">
                      <MoreIcon aria-hidden size={17} weight="bold" />
                    </summary>
                    <div className="absolute right-0 top-11 z-30 w-48 rounded-2xl border border-slate-100 bg-white p-2 text-sm shadow-xl">
                      <p className="px-3 py-2 text-slate-400">No additional actions</p>
                    </div>
                  </details>
                  <button aria-label="Close vehicle details" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700" disabled={isSaving} onClick={onClose} type="button">
                    <CloseIcon aria-hidden size={16} weight="bold" />
                  </button>
                </div>
              </div>
            </div>

            <div className="user-modal-scrollbar overflow-y-auto px-5 py-4 sm:px-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
                <div className="space-y-3">
                  <section className="rounded-[22px] border border-purple-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_rgba(139,92,246,0.08)]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-purple-700">Vehicle {previewVehicle.vehicleNumber || "record"}</p>
                        <h3 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-950">{vehicleName}</h3>
                        <p className="mt-1 text-sm text-slate-500">{[previewVehicle.vehicleType, previewVehicle.year].filter(Boolean).join(" · ") || "Vehicle specifications not recorded"}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        { label: "License plate", value: previewVehicle.plateNumber || "Not recorded", icon: PlateIcon },
                        { label: "Mileage", value: formatMileage(previewVehicle.mileage), icon: MileageIcon },
                      ].map(({ label, value, icon: Icon }) => (
                        <div className="rounded-2xl border border-purple-100 bg-purple-50/30 p-3" key={label}>
                          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-purple-700 ring-1 ring-purple-100"><Icon aria-hidden size={13} weight="bold" /></span>
                            {label}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <VehicleSection title="Vehicle specifications">
                    <dl>
                      <VehicleDetailRow label="Make" value={previewVehicle.make ? titleCase(previewVehicle.make) : "Not recorded"} />
                      <VehicleDetailRow label="Model" value={previewVehicle.model ? titleCase(previewVehicle.model) : "Not recorded"} />
                      <VehicleDetailRow label="Year" value={previewVehicle.year || "Not recorded"} />
                      <VehicleDetailRow label="Vehicle type" value={previewVehicle.vehicleType ? titleCase(previewVehicle.vehicleType) : "Not recorded"} />
                      <VehicleDetailRow label="Mileage" value={formatMileage(previewVehicle.mileage)} />
                    </dl>
                  </VehicleSection>

                  <VehicleSection title="Registration and insurance">
                    <dl>
                      <VehicleDetailRow label="License plate" value={previewVehicle.plateNumber || "Not recorded"} />
                      <VehicleDetailRow label="Registration number" value={previewVehicle.registrationNumber || "Not recorded"} />
                      <VehicleDetailRow label="Registration expiry" value={formatDate(previewVehicle.registrationExpiry)} />
                      <VehicleDetailRow label="Insurance policy" value={previewVehicle.insurancePolicyNumber || "Not recorded"} />
                      <VehicleDetailRow label="Insurance expiry" value={formatDate(previewVehicle.insuranceExpiry)} />
                    </dl>
                  </VehicleSection>
                </div>

                <div className="space-y-3">
                  <section className={`rounded-[20px] border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_rgba(139,92,246,0.06)] ${blocksAssignment ? "border-amber-100 bg-amber-50/70" : "border-blue-100 bg-blue-50/70"}`}>
                    <div className="flex items-start gap-3">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white ring-1 ${blocksAssignment ? "text-amber-700 ring-amber-100" : "text-blue-700 ring-blue-100"}`}>
                        {blocksAssignment ? <WarningIcon aria-hidden size={15} weight="bold" /> : <InfoIcon aria-hidden size={15} weight="bold" />}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">{blocksAssignment ? "Vehicle unavailable" : assignment ? "Current assignment" : "Assignment readiness"}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {blocksAssignment ? `This vehicle cannot be assigned to schedules or deliveries while its status is ${previewVehicle.status}.` : assignment ? "This vehicle is assigned to an active or upcoming shift. Review the schedule details below." : "This vehicle does not have an active or upcoming assignment."}
                        </p>
                      </div>
                    </div>
                  </section>

                  <VehicleSection title="Schedule / assignment">
                    {assignment ? (
                      <dl>
                        <VehicleDetailRow label="Assigned driver" value={assignment.driverName} />
                        {assignment.driverEmail ? <VehicleDetailRow label="Driver email" value={assignment.driverEmail} /> : null}
                        <VehicleDetailRow label="Shift" value={assignmentSchedule?.shift_name || "Scheduled shift"} />
                        <VehicleDetailRow label="Scheduled" value={scheduledWindow || "Not recorded"} />
                      </dl>
                    ) : (
                      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-purple-700 ring-1 ring-purple-100">
                          <CalendarIcon aria-hidden size={16} weight="bold" />
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">No active assignment</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-500">This vehicle is not assigned to a current or upcoming shift.</p>
                        </div>
                      </div>
                    )}
                  </VehicleSection>

                  <VehicleSection title="Maintenance">
                    {maintenance ? (
                      <dl>
                        <VehicleDetailRow label="Last maintenance" value={formatDate(maintenance.date ?? maintenance.createdAt ?? "")} />
                        <VehicleDetailRow label="Next service due" value="Not scheduled" />
                        <VehicleDetailRow label="Latest maintenance cost" value={formatMoney(maintenance.cost)} />
                      </dl>
                    ) : (
                      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-purple-700 ring-1 ring-purple-100">
                          <MaintenanceIcon aria-hidden size={16} weight="bold" />
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">No maintenance history</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-500">No maintenance history is available.</p>
                        </div>
                      </div>
                    )}
                  </VehicleSection>

                  <VehicleSection title="Record information">
                    <dl>
                      <VehicleDetailRow label="Created" value={formatDateTime(previewVehicle.createdAt)} />
                      <VehicleDetailRow label="Updated" value={formatDateTime(previewVehicle.updatedAt)} />
                    </dl>
                  </VehicleSection>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t border-purple-50 bg-white/95 px-5 py-3 backdrop-blur sm:px-6">
              <SecondaryButton disabled={isSaving} onClick={onClose} type="button">Close</SecondaryButton>
              <PrimaryActionButton disabled={isSaving} onClick={onEdit} type="button">
                <EditIcon aria-hidden className="mr-2" size={15} weight="bold" />
                Edit Vehicle
              </PrimaryActionButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const inputClass = "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60";
  const modalTitle = isCreateMode ? "Create Vehicle" : "Edit Vehicle";
  const modalDescription = isCreateMode
    ? "Add a vehicle to the operational fleet."
    : "Update vehicle specifications, registration, insurance, and operational status.";

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md" role="dialog">
      <div className="max-h-[calc(100vh-48px)] w-[min(980px,calc(100vw-48px))] overflow-hidden rounded-[24px] border border-white bg-white/95 p-1.5 text-[#17232b] shadow-2xl shadow-slate-900/20 ring-1 ring-purple-100/50">
        <form className="flex max-h-[calc(100vh-60px)] flex-col overflow-hidden rounded-[19px] bg-white" onSubmit={onSubmit}>
          <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{modalTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{modalDescription}</p>
              </div>
              <button
                aria-label={`Close ${modalTitle.toLowerCase()} modal`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                disabled={isSaving}
                onClick={onClose}
                type="button"
              >
                <CloseIcon aria-hidden size={16} weight="bold" />
              </button>
            </div>
          </div>

          <div className="user-modal-scrollbar overflow-y-auto px-5 py-5 sm:px-6">
            <div className="mx-auto max-w-[900px] space-y-5">
              <section className="rounded-[20px] border border-purple-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.06)] sm:p-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-semibold text-slate-950">Vehicle identity</h3>
                  <p className="mt-1 text-sm text-slate-500">Core fleet details and operational status.</p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Vehicle Number</span>
                    <input className={inputClass} onChange={(event) => onChange("vehicleNumber", event.target.value)} value={formState.vehicleNumber} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">License Plate <span className="text-red-500">*</span></span>
                    <input className={inputClass} onChange={(event) => onChange("plateNumber", event.target.value)} required value={formState.plateNumber} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Make</span>
                    <input className={inputClass} onChange={(event) => onChange("make", event.target.value)} value={formState.make} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Model</span>
                    <input className={inputClass} onChange={(event) => onChange("model", event.target.value)} value={formState.model} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Year</span>
                    <input className={inputClass} min="1900" onChange={(event) => onChange("year", event.target.value)} type="number" value={formState.year} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Vehicle Type</span>
                    <input className={inputClass} onChange={(event) => onChange("vehicleType", event.target.value)} value={formState.vehicleType} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Mileage</span>
                    <input className={inputClass} min="0" onChange={(event) => onChange("mileage", event.target.value)} type="number" value={formState.mileage} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Status</span>
                    <select className={`${inputClass} appearance-none pr-9`} onChange={(event) => onChange("status", event.target.value)} value={formState.status}>
                      {vehicleStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="rounded-[20px] border border-purple-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.06)] sm:p-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-semibold text-slate-950">Registration and insurance</h3>
                  <p className="mt-1 text-sm text-slate-500">Compliance identifiers and expiry dates.</p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Insurance Policy Number</span>
                    <input className={inputClass} onChange={(event) => onChange("insurancePolicyNumber", event.target.value)} value={formState.insurancePolicyNumber} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Insurance Expiry</span>
                    <input className={inputClass} onChange={(event) => onChange("insuranceExpiry", event.target.value)} type="date" value={formState.insuranceExpiry} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Registration Number</span>
                    <input className={inputClass} onChange={(event) => onChange("registrationNumber", event.target.value)} value={formState.registrationNumber} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Registration Expiry</span>
                    <input className={inputClass} onChange={(event) => onChange("registrationExpiry", event.target.value)} type="date" value={formState.registrationExpiry} />
                  </label>
                </div>
              </section>
            </div>
          </div>

          <div className="sticky bottom-0 z-20 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
            <SecondaryButton disabled={isSaving} onClick={isCreateMode ? onClose : onCancel} type="button">
              Cancel
            </SecondaryButton>
            <PrimaryActionButton disabled={isSaving || (!isCreateMode && !isDirty)} type="submit">
              {isSaving ? "Saving..." : isCreateMode ? "Create Vehicle" : "Save Changes"}
            </PrimaryActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminVehiclesPage() {
  const searchParams = useSearchParams();
  const notify = useNotify();
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [assignments, setAssignments] = useState<Record<string, VehicleAssignment | null>>({});
  const [maintenanceRecords, setMaintenanceRecords] = useState<Record<string, VehicleMaintenance | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
      setMaintenanceRecords({});
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
    setIsModalOpen(true);
  }

  async function openViewModal(vehicle: VehicleRecord) {
    const nextForm = toVehicleForm(vehicle);
    setEditingVehicle(vehicle);
    setFormState(nextForm);
    setInitialFormState(nextForm);
    setIsEditing(false);
    setErrorMessage("");
    setIsModalOpen(true);
    try {
      const data = await fetchAdministratorJson<{ assignment: VehicleAssignmentRow | null; maintenance: VehicleMaintenanceRow | null }>(`/api/admin/vehicles?vehicleId=${encodeURIComponent(vehicle.vehicleId)}`);
      setAssignments((current) => ({ ...current, [vehicle.vehicleId]: data.assignment ? toVehicleAssignment(data.assignment) : null }));
      setMaintenanceRecords((current) => ({ ...current, [vehicle.vehicleId]: toVehicleMaintenance(data.maintenance) }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load schedule assignment.");
    }
  }

  useEffect(() => {
    const vehicleId = searchParams.get("vehicle");
    if (!vehicleId || isLoading) return;
    const match = vehicles.find((vehicle) => vehicle.vehicleId === vehicleId);
    if (match) queueMicrotask(() => void openViewModal(match));
  }, [isLoading, searchParams, vehicles]);

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
    notify.success(
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
        loading={isLoading}
        title="Vehicles"
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <VehicleKpiCard
          accent
          detail="All fleet records"
          isLoading={isLoading}
          label="Total Vehicles"
          value={String(vehicleStats.total)}
        />
        <VehicleKpiCard
          detail="Ready for dispatch"
          isLoading={isLoading}
          label="Available Vehicles"
          value={String(vehicleStats.available)}
        />
        <VehicleKpiCard
          detail="Reserved for active work"
          isLoading={isLoading}
          label="Assigned Vehicles"
          value={String(vehicleStats.assigned)}
        />
        <VehicleKpiCard
          detail="Requires inspection or service"
          isLoading={isLoading}
          label="Maintenance Due"
          value={String(vehicleStats.maintenance)}
        />
      </div>

      {isLoading ? <AdminFilterBarSkeleton className="lg:grid-cols-[minmax(0,1fr)_220px_240px]" count={3} /> : <AdminCard className="p-4">
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
      </AdminCard>}

      {errorMessage && !isModalOpen ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <AdminCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          {isLoading ? <div><Skeleton className="h-5 w-36" rounded="rounded-full" /><Skeleton className="mt-2 h-3 w-56" rounded="rounded-full" /></div> : <div><h2 className="text-xl font-medium">Vehicle Records</h2><p className="mt-1 text-sm text-slate-400">Fleet records loaded from the vehicles table.</p></div>}
        </div>

        {isLoading ? (
          <SkeletonTable columns={8} rows={7} />
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
          maintenance={editingVehicle ? maintenanceRecords[editingVehicle.vehicleId] ?? null : null}
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
