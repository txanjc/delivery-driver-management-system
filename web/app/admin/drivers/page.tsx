"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { useNotify } from "@/components/ui/ToastProvider";
import { fetchAdministratorJson } from "@/lib/admin-api-client";
import {
  AdminCard,
  AdminPageIntro,
  PrimaryActionButton,
} from "../_components/admin-design-system";
import { DEFAULT_PAGE_SIZE, Pagination } from "../_components/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";

type AvailabilityFilter = "all" | "available" | "on_delivery" | "unavailable";
type StatusFilter = "all" | "active" | "inactive";
type SortKey = "name" | "licenseExpiry" | "performanceScore";

type DriverProfile = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

type AssignedVehicle = {
  vehicle_id: string;
  vehicle_number: string | null;
  license_plate: string | null;
  make: string | null;
  model: string | null;
};

type DriverRow = {
  driver_id: string;
  user_id: string;
  license_number: string | null;
  license_expiry_date: string | null;
  availability: string | null;
  performance_score: number | null;
  assigned_vehicle_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  profiles: DriverProfile | DriverProfile[] | null;
  vehicles: AssignedVehicle | AssignedVehicle[] | null;
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
  assignedVehicleId: string;
  assignedVehicle: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type DriverFormState = {
  selectedProfileId: string;
  licenseNumber: string;
  licenseExpiry: string;
  availability: string;
  performanceScore: string;
};

type DriverPayload = {
  license_number: string | null;
  license_expiry_date: string | null;
  availability: string | null;
  performance_score: number | null;
  updated_at?: string;
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

function normalizeRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function getVehicleName(vehicle: AssignedVehicle | null) {
  if (!vehicle) return "Not assigned";
  const description = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return description || vehicle.vehicle_number || vehicle.license_plate || "Assigned vehicle";
}

function toDriverRecord(driver: DriverRow): DriverRecord {
  const profile = normalizeRelation(driver.profiles);
  const vehicle = normalizeRelation(driver.vehicles);
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
    performanceScore: driver.performance_score === null ? "" : String(driver.performance_score),
    assignedVehicleId: driver.assigned_vehicle_id ?? "",
    assignedVehicle: getVehicleName(vehicle),
    createdAt: driver.created_at,
    updatedAt: driver.updated_at,
  };
}

function applyInactiveDriverRules(driver: DriverRecord): DriverRecord {
  if (driver.isActive) return driver;

  return {
    ...driver,
    assignedVehicleId: "",
    assignedVehicle: "Not assigned",
    availability: "unavailable",
    performanceScore: "0",
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

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "Unnamed driver profile";
}

function getDriverName(driver: DriverRecord) {
  return [driver.firstName, driver.lastName].filter(Boolean).join(" ") || "Unnamed driver";
}

function formatAvailability(value: string) {
  return availabilityOptions.find((option) => option.value === value)?.label ?? "Not set";
}

function formatDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function matchesDriverSearch(driver: DriverRecord, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [getDriverName(driver), driver.email, driver.phone, driver.licenseNumber, driver.assignedVehicle]
    .some((value) => value.toLowerCase().includes(query));
}

function DriverKpiCard({ label, value, detail, accent = false, isLoading = false }: { label: string; value: string; detail: string; accent?: boolean; isLoading?: boolean }) {
  return (
    <div className={`rounded-[20px] border p-5 shadow-sm ${accent ? "border-[#172f3a] bg-[#172f3a] text-white" : "border-slate-100 bg-white text-[#17232b]"}`}>
      <p className={accent ? "text-xs text-slate-300" : "text-xs text-slate-500"}>{label}</p>
      {isLoading ? <><Skeleton className="mt-4 h-9 w-20" rounded="rounded-full" /><Skeleton className="mt-2 h-3 w-32" rounded="rounded-full" /></> : <><p className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></>}
    </div>
  );
}

function AvailabilityBadge({ availability }: { availability: string }) {
  const tone = availability === "available"
    ? "bg-emerald-50 text-emerald-700"
    : availability === "on_delivery"
      ? "bg-blue-50 text-blue-700"
      : availability === "unavailable"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-500";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{formatAvailability(availability)}</span>;
}

function PerformanceScore({ score }: { score: string }) {
  const parsed = Number(score);
  const value = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
  return (
    <div className="flex min-w-[130px] items-center gap-3">
      <style>{`@keyframes driver-score-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-purple-50 ring-1 ring-purple-100">
        <div
          className="h-full origin-left rounded-full bg-purple-500"
          style={{ animation: "driver-score-fill 700ms ease-out both", width: `${value}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-semibold text-slate-700">{value}%</span>
    </div>
  );
}

function DriverTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm [&_td]:py-2.5 [&_th]:py-2.5">
        <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-400">
          <tr>{["Driver Name", "Phone", "License Number", "License Expiry", "Availability", "Assigned Vehicle", "Performance Score", "Actions"].map((head) => <th className="px-5 py-4 font-medium" key={head}>{head}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 7 }).map((_, row) => (
            <tr key={row}>
              <td className="px-5 py-4"><div className="flex items-center gap-3"><Skeleton className="h-9 w-9" rounded="rounded-full" /><div className="min-w-[220px]"><Skeleton className="h-4 w-32" rounded="rounded-full" /><Skeleton className="mt-2 h-3 w-52" rounded="rounded-full" /></div></div></td>
              <td className="px-5 py-4"><Skeleton className="h-4 w-24" rounded="rounded-full" /></td>
              <td className="px-5 py-4"><Skeleton className="h-4 w-28" rounded="rounded-full" /></td>
              <td className="px-5 py-4"><Skeleton className="h-4 w-24" rounded="rounded-full" /></td>
              <td className="px-5 py-4"><Skeleton className="h-6 w-20" rounded="rounded-full" /></td>
              <td className="px-5 py-4"><Skeleton className="h-4 w-32" rounded="rounded-full" /></td>
              <td className="px-5 py-4"><div className="flex items-center gap-3"><Skeleton className="h-2 w-24" rounded="rounded-full" /><Skeleton className="h-3 w-8" rounded="rounded-full" /></div></td>
              <td className="px-5 py-4 text-right"><Skeleton className="ml-auto h-7 w-14" rounded="rounded-full" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProfileStatusBadge({ isActive }: { isActive: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{isActive ? "Active" : "Inactive"}</span>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-1 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">{value}</p></div>;
}

function DriverModal({ availableProfiles, driver, errorMessage, formState, isDirty, isEditing, isSaving, mode, onCancel, onChange, onClose, onEdit, onSubmit }: {
  availableProfiles: DriverProfile[];
  driver: DriverRecord | null;
  errorMessage: string;
  formState: DriverFormState;
  isDirty: boolean;
  isEditing: boolean;
  isSaving: boolean;
  mode: "create" | "view";
  onCancel: () => void;
  onChange: (field: keyof DriverFormState, value: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isCreateMode = mode === "create";
  const canEditDriver = isCreateMode || driver?.isActive === true;
  const fieldsEnabled = isCreateMode || (isEditing && canEditDriver);
  const initials = driver
    ? `${driver.firstName[0] ?? ""}${driver.lastName[0] ?? ""}`.toUpperCase() || "D"
    : "D";

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);

  const inputClass = "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60";
  const selectClass = `${inputClass} appearance-none pr-10`;

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md" role="dialog">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-white bg-white/95 p-1.5 text-[#17232b] shadow-2xl shadow-slate-900/20 ring-1 ring-purple-100/50 backdrop-blur-xl">
        <div className={`user-modal-scrollbar max-h-[calc(92vh-0.75rem)] overflow-y-auto overscroll-contain rounded-[19px] scroll-smooth ${isCreateMode ? "p-4 sm:p-5" : "p-5 sm:p-6"}`}>
          <div className={`flex items-start justify-between gap-4 border-b border-slate-100 ${isCreateMode ? "pb-3" : "pb-4"}`}>
            <div>
              <h2 className="text-xl font-semibold">{isCreateMode ? "Create Driver" : "Driver Details"}</h2>
              <p className="mt-1 text-sm text-slate-500">{isCreateMode ? "Link a driver profile to operational details." : "Review driver details or enable editing to make changes."}</p>
            </div>
            <button aria-label="Close driver details" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white/60 text-slate-500 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700" disabled={isSaving} onClick={onClose} type="button">
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
            </button>
          </div>
          <form className={isCreateMode ? "mt-4 space-y-4" : "mt-5 space-y-5"} onSubmit={onSubmit}>
            {errorMessage ? <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}
            <div className={isCreateMode ? "" : "grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]"}>
              {!isCreateMode && driver ? (
                <aside className="border-b border-dashed border-slate-200 pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 text-2xl font-semibold text-purple-700">{initials}</div>
                    <p className="mt-3 text-lg font-semibold">{getDriverName(driver)}</p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">Driver</span>
                      <ProfileStatusBadge isActive={driver.isActive} />
                    </div>
                    <p className="mt-3 break-all text-sm text-slate-500">{driver.email || "No email"}</p>
                    <p className="mt-1 text-sm text-slate-400">{driver.phone || "No phone"}</p>
                  </div>
                  <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-1">
                    <DetailField label="Created at" value={formatDateTime(driver.createdAt)} />
                    <DetailField label="Last updated at" value={formatDateTime(driver.updatedAt)} />
                  </div>
                </aside>
              ) : null}
              <div className={`grid content-start md:grid-cols-2 ${isCreateMode ? "gap-x-4 gap-y-3" : "gap-4"}`}>
              {isCreateMode ? (
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-600">Driver Profile</span>
                  <select className={selectClass} onChange={(event) => onChange("selectedProfileId", event.target.value)} required value={formState.selectedProfileId}>
                    <option value="">Select an existing driver profile</option>
                    {availableProfiles.map((profile) => <option key={profile.profile_id} value={profile.profile_id}>{getProfileName(profile)}</option>)}
                  </select>
                </label>
              ) : null}
              <label className="block"><span className="text-sm font-medium text-slate-600">License Number</span><input className={inputClass} disabled={!fieldsEnabled} onChange={(event) => onChange("licenseNumber", event.target.value)} required value={formState.licenseNumber} /></label>
              <label className="block"><span className="text-sm font-medium text-slate-600">License Expiry</span><input className={inputClass} disabled={!fieldsEnabled} onChange={(event) => onChange("licenseExpiry", event.target.value)} type="date" value={formState.licenseExpiry} /></label>
              <label className="block"><span className="text-sm font-medium text-slate-600">Availability</span><select className={selectClass} disabled={!fieldsEnabled} onChange={(event) => onChange("availability", event.target.value)} value={formState.availability}>{availabilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="block"><span className="text-sm font-medium text-slate-600">Performance Score</span><input className={inputClass} disabled={!fieldsEnabled} max="100" min="0" onChange={(event) => onChange("performanceScore", event.target.value)} type="number" value={formState.performanceScore} /></label>
              {!isCreateMode && driver ? <div className="md:col-span-2"><DetailField label="Assigned Vehicle" value={driver.assignedVehicle} /></div> : null}
              </div>
            </div>
            {isCreateMode && availableProfiles.length === 0 ? <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">Create a driver user in Supabase Auth and profiles first.</p> : null}
            <div className={`flex flex-col-reverse gap-3 border-t border-slate-100 sm:flex-row sm:justify-end ${isCreateMode ? "pt-4" : "pt-5"}`}>
              {!isCreateMode && !isEditing ? canEditDriver ? <PrimaryActionButton disabled={isSaving} onClick={onEdit} type="button">Edit</PrimaryActionButton> : <p className="rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-500">Inactive Driver</p> : <>
                <button className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100" disabled={isSaving} onClick={isCreateMode ? onClose : onCancel} type="button">Cancel</button>
                <PrimaryActionButton disabled={isSaving || (isCreateMode && availableProfiles.length === 0) || (!isCreateMode && !isDirty)} type="submit">{isSaving ? "Saving..." : isCreateMode ? "Create Driver" : "Save Changes"}</PrimaryActionButton>
              </>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AdminDriversPage() {
  const searchParams = useSearchParams();
  const notify = useNotify();
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [driverProfiles, setDriverProfiles] = useState<DriverProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [initialFormState, setInitialFormState] = useState<DriverFormState>(emptyDriverForm);
  const [formState, setFormState] = useState<DriverFormState>(emptyDriverForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const loadDriverData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
    const data = await fetchAdministratorJson<{ drivers: DriverRow[]; profiles: DriverProfile[] }>("/api/admin/drivers");
    const loadedDrivers = data.drivers.map(toDriverRecord);
    const inactiveDriversToNormalize = loadedDrivers.filter(
      (driver) =>
        !driver.isActive &&
        (driver.performanceScore !== "0" ||
          driver.assignedVehicleId !== "" ||
          driver.availability !== "unavailable"),
    );

    if (inactiveDriversToNormalize.length > 0) {
      const { error: normalizationError } = await supabase
        .from("drivers")
        .update({
          assigned_vehicle_id: null,
          availability: "unavailable",
          performance_score: 0,
          updated_at: new Date().toISOString(),
        })
        .in(
          "driver_id",
          inactiveDriversToNormalize.map((driver) => driver.driverId),
        );

      if (normalizationError) {
        setErrorMessage(
          `Unable to apply inactive driver rules: ${normalizationError.message}`,
        );
      }
    }

    setDrivers(loadedDrivers.map(applyInactiveDriverRules));
    setDriverProfiles(data.profiles);
    return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load driver records.");
      setDrivers([]);
      setDriverProfiles([]);
      return false;
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(() => { void loadDriverData(); }); }, [loadDriverData]);
  useEffect(() => { const id = window.setTimeout(() => { setDebouncedSearch(searchInput); setCurrentPage(1); }, 300); return () => window.clearTimeout(id); }, [searchInput]);
  useEffect(() => { if (searchParams.get("action") === "create") { const id = window.setTimeout(() => setIsModalOpen(true), 0); return () => window.clearTimeout(id); } }, [searchParams]);

  const availableProfiles = useMemo(() => {
    const usedIds = new Set(drivers.map((driver) => driver.userId));
    return driverProfiles.filter(
      (profile) => profile.is_active === true && profile.role === "driver" && !usedIds.has(profile.profile_id),
    );
  }, [driverProfiles, drivers]);

  const stats = useMemo(() => ({
    total: drivers.length,
    available: drivers.filter((driver) => driver.availability === "available").length,
    onDelivery: drivers.filter((driver) => driver.availability === "on_delivery").length,
    unavailable: drivers.filter((driver) => driver.availability === "unavailable").length,
  }), [drivers]);

  const filteredDrivers = useMemo(() => drivers.filter((driver) => {
    const matchesAvailability = availabilityFilter === "all" || driver.availability === availabilityFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? driver.isActive : !driver.isActive);
    return matchesAvailability && matchesStatus && matchesDriverSearch(driver, debouncedSearch);
  }).sort((a, b) => {
    if (sortKey === "licenseExpiry") return (a.licenseExpiry || "9999").localeCompare(b.licenseExpiry || "9999");
    if (sortKey === "performanceScore") return Number(b.performanceScore || -1) - Number(a.performanceScore || -1);
    return getDriverName(a).localeCompare(getDriverName(b));
  }), [availabilityFilter, debouncedSearch, drivers, sortKey, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / DEFAULT_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedDrivers = filteredDrivers.slice((activePage - 1) * DEFAULT_PAGE_SIZE, activePage * DEFAULT_PAGE_SIZE);

  function openCreateModal() {
    const next = { ...emptyDriverForm, selectedProfileId: availableProfiles[0]?.profile_id ?? "" };
    setEditingDriver(null); setFormState(next); setInitialFormState(next); setIsEditing(false); setErrorMessage(""); setIsModalOpen(true);
  }

  function openViewModal(driver: DriverRecord) {
    const next = toDriverForm(driver);
    setEditingDriver(driver); setFormState(next); setInitialFormState(next); setIsEditing(false); setErrorMessage(""); setIsModalOpen(true);
  }

  useEffect(() => { const driverId = searchParams.get("driver"); if (!driverId || isLoading) return; const match = drivers.find((driver) => driver.driverId === driverId); if (match) queueMicrotask(() => void openViewModal(match)); }, [drivers, isLoading, searchParams]);

  function closeModal() { if (!isSaving) { setIsModalOpen(false); setEditingDriver(null); setIsEditing(false); setFormState(emptyDriverForm); setErrorMessage(""); } }
  function cancelEditing() { setFormState(initialFormState); setIsEditing(false); setErrorMessage(""); }
  function updateFormState(field: keyof DriverFormState, value: string) { setFormState((current) => ({ ...current, [field]: value })); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setIsSaving(true); setErrorMessage("");
    if (editingDriver) {
      let linkedProfileIsActive = false;
      try {
        const linkedProfile = await fetchAdministratorJson<{ isActive: boolean }>(
          `/api/admin/drivers?profileId=${encodeURIComponent(editingDriver.userId)}`,
        );
        linkedProfileIsActive = linkedProfile.isActive;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to verify driver status.");
        setIsSaving(false);
        return;
      }

      if (!linkedProfileIsActive) {
        try { await fetchAdministratorJson("/api/admin/drivers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driver_id: editingDriver.driverId, driver: { license_number: editingDriver.licenseNumber, license_expiry_date: editingDriver.licenseExpiry || null, availability: "unavailable", performance_score: 0 } }) }); } catch { /* The API still normalizes inactive drivers before returning its read-only response. */ }
        await loadDriverData();
        setErrorMessage("Inactive drivers are read-only and cannot be updated.");
        setIsEditing(false);
        setIsSaving(false);
        return;
      }
    }
    const payload = toDriverPayload(formState);
    if (!payload.license_number) { setErrorMessage("License Number is required."); setIsSaving(false); return; }
    const score = payload.performance_score;
    if (score !== null && (score < 0 || score > 100)) { setErrorMessage("Performance Score must be between 0 and 100."); setIsSaving(false); return; }
    if (!editingDriver && !formState.selectedProfileId) { setErrorMessage("Select an existing driver profile."); setIsSaving(false); return; }
    if (!editingDriver) {
      const selectedProfile = driverProfiles.find((profile) => profile.profile_id === formState.selectedProfileId);
      if (!selectedProfile) { setErrorMessage("The selected driver profile could not be found. Refresh the page and try again."); setIsSaving(false); return; }
      if (selectedProfile.is_active !== true) { setErrorMessage("The selected profile is inactive. Activate the profile before creating a driver record."); setIsSaving(false); return; }
      if (selectedProfile.role !== "driver") { setErrorMessage("The selected profile must have the driver role before a driver record can be created."); setIsSaving(false); return; }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        setErrorMessage("Your admin session is unavailable or expired. Sign in again before creating a driver record.");
        setIsSaving(false);
        return;
      }

      const response = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
        user_id: selectedProfile.profile_id,
        license_number: payload.license_number,
        license_expiry_date: payload.license_expiry_date,
        availability: payload.availability,
        performance_score: payload.performance_score,
        assigned_vehicle_id: null,
        updated_at: new Date().toISOString(),
        }),
      });
      const responseBody: unknown = await response.json();
      if (!response.ok) {
        const message = typeof responseBody === "object" &&
          responseBody !== null &&
          "error" in responseBody &&
          typeof responseBody.error === "string"
          ? responseBody.error
          : "Unable to create driver record.";
        setErrorMessage(message); setIsSaving(false); return;
      }
      if (!(await loadDriverData())) { setIsSaving(false); return; }
      notify.success("Driver record created successfully.");
      setIsSaving(false); setIsModalOpen(false); setEditingDriver(null); setIsEditing(false); setFormState(emptyDriverForm);
      return;
    }
    try { await fetchAdministratorJson("/api/admin/drivers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driver_id: editingDriver.driverId, driver: payload }) }); } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Unable to update driver."); setIsSaving(false); return; }
    if (!(await loadDriverData())) { setIsSaving(false); return; }
    notify.success("Driver updated successfully.");
    setIsSaving(false); setIsModalOpen(false); setEditingDriver(null); setIsEditing(false); setFormState(emptyDriverForm);
  }

  const filterClass = "users-filter-select h-11 w-full appearance-none rounded-full border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-600 outline-none transition hover:border-blue-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100";

  return (
    <section className="space-y-4 text-[#17232b]">
      <AdminPageIntro actions={<PrimaryActionButton className="gap-2 px-6 py-3 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2" onClick={openCreateModal} type="button"><span aria-hidden="true" className="text-lg leading-none">+</span><span>Create Driver</span></PrimaryActionButton>} description="Monitor driver profiles, license readiness, availability, performance, and vehicle assignments across the delivery network." eyebrow="Fleet operations" title="Drivers" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DriverKpiCard accent detail="All operational records" isLoading={isLoading} label="Total Drivers" value={String(stats.total)} />
        <DriverKpiCard detail="Ready for assignment" isLoading={isLoading} label="Available Drivers" value={String(stats.available)} />
        <DriverKpiCard detail="Currently moving deliveries" isLoading={isLoading} label="On Delivery" value={String(stats.onDelivery)} />
        <DriverKpiCard detail="Not available for assignment" isLoading={isLoading} label="Unavailable Drivers" value={String(stats.unavailable)} />
      </div>

      <AdminCard className="p-4"><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
        <label><span className="sr-only">Search drivers</span><input className="users-search-input h-11 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-blue-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" onChange={(event) => setSearchInput(event.target.value)} placeholder="Search drivers" type="search" value={searchInput} /></label>
        <label><span className="sr-only">Availability filter</span><select className={filterClass} onChange={(event) => { setAvailabilityFilter(event.target.value as AvailabilityFilter); setCurrentPage(1); }} value={availabilityFilter}><option value="all">All Availability</option>{availabilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span className="sr-only">Status filter</span><select className={filterClass} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setCurrentPage(1); }} value={statusFilter}><option value="all">All Drivers</option><option value="active">Active Drivers</option><option value="inactive">Inactive Drivers</option></select></label>
        <label><span className="sr-only">Sort drivers</span><select className={filterClass} onChange={(event) => { setSortKey(event.target.value as SortKey); setCurrentPage(1); }} value={sortKey}><option value="name">Sort: Name</option><option value="licenseExpiry">Sort: License Expiry</option><option value="performanceScore">Sort: Performance</option></select></label>
      </div></AdminCard>

      {errorMessage && !isModalOpen ? <p aria-live="assertive" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}

      <AdminCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-xl font-medium">Driver Records</h2><p className="mt-1 text-sm text-slate-400">Driver records joined to profiles and assigned vehicles.</p></div>
        {isLoading ? <DriverTableSkeleton /> : filteredDrivers.length === 0 ? <div className="px-5 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-sm font-semibold text-purple-700">DR</div><h3 className="mt-4 text-lg font-semibold">No drivers found.</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{drivers.length === 0 ? "Create a driver record to begin managing fleet availability." : "Try adjusting your search or filters."}</p></div> : <div className="overflow-x-auto"><table className="min-w-full text-sm [&_td]:py-2.5 [&_th]:py-2.5">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-400"><tr><th className="px-5 py-4 font-medium">Driver Name</th><th className="px-5 py-4 font-medium">Phone</th><th className="px-5 py-4 font-medium">License Number</th><th className="px-5 py-4 font-medium">License Expiry</th><th className="px-5 py-4 font-medium">Availability</th><th className="px-5 py-4 font-medium">Assigned Vehicle</th><th className="px-5 py-4 font-medium">Performance Score</th><th className="px-5 py-4 text-right font-medium">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-slate-500">{paginatedDrivers.map((driver) => <tr className="transition hover:bg-slate-50/70" key={driver.driverId}>
            <td className="min-w-[260px] px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-xs font-semibold text-purple-700">{(driver.firstName[0] || "D").toUpperCase()}</div><div className="min-w-0"><p className="font-semibold text-[#17232b]">{getDriverName(driver)}</p><p className="whitespace-nowrap text-xs text-slate-400">{driver.email || driver.userId}</p></div></div></td>
            <td className="px-5 py-4">{driver.phone || "No phone"}</td><td className="px-5 py-4">{driver.licenseNumber || "No license"}</td><td className="px-5 py-4">{formatDate(driver.licenseExpiry)}</td><td className="px-5 py-4"><AvailabilityBadge availability={driver.availability} /></td><td className="px-5 py-4"><p className="font-medium text-slate-600">{driver.assignedVehicle}</p></td><td className="px-5 py-4"><PerformanceScore score={driver.performanceScore} /></td>
            <td className="px-5 py-4 text-right"><button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700" onClick={() => openViewModal(driver)} type="button">View</button></td>
          </tr>)}</tbody>
        </table></div>}
      </AdminCard>

      <Pagination currentPage={activePage} onPageChange={setCurrentPage} tone="purple" totalPages={totalPages} totalRecords={filteredDrivers.length} />
      {isModalOpen ? <DriverModal availableProfiles={availableProfiles} driver={editingDriver} errorMessage={errorMessage} formState={formState} isDirty={JSON.stringify(formState) !== JSON.stringify(initialFormState)} isEditing={isEditing} isSaving={isSaving} mode={editingDriver ? "view" : "create"} onCancel={cancelEditing} onChange={updateFormState} onClose={closeModal} onEdit={() => setIsEditing(true)} onSubmit={handleSubmit} /> : null}
    </section>
  );
}
