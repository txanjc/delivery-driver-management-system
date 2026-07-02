"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { StatusBadge } from "../_components/admin-ui";
import { supabase } from "@/lib/supabase";
import { DEFAULT_PAGE_SIZE, Pagination } from "../_components/Pagination";

type DeliveryStatus =
  | "Pending"
  | "Assigned"
  | "In Transit"
  | "Delivered"
  | "Delayed"
  | "Failed"
  | "Returned";

type DeliveryStatusValue =
  | "pending"
  | "assigned"
  | "in_transit"
  | "delivered"
  | "delayed"
  | "failed"
  | "returned";

type DriverProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type DeliveryDriver = {
  driver_id: string;
  user_id: string | null;
  profiles: DriverProfile | DriverProfile[] | null;
};

type DeliveryVehicle = {
  vehicle_id: string;
  license_plate: string | null;
};

type DeliveryRow = {
  delivery_id: string;
  delivery_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  status: string | null;
  priority: string | null;
  notes: string | null;
  created_at: string | null;
  drivers: DeliveryDriver | DeliveryDriver[] | null;
  vehicles: DeliveryVehicle | DeliveryVehicle[] | null;
};

type DeliveryRecord = {
  deliveryId: string;
  deliveryNumber: string;
  customerName: string;
  customerPhone: string;
  customer: string;
  pickupAddress: string;
  deliveryAddress: string;
  assignedDriverId: string;
  assignedVehicleId: string;
  assignedDriver: string;
  assignedVehicle: string;
  status: DeliveryStatusValue;
  priority: string;
  notes: string;
  createdAt: string | null;
};

type DriverOption = {
  driver_id: string;
  user_id: string | null;
  profiles: DriverProfile | DriverProfile[] | null;
};

type VehicleOption = {
  vehicle_id: string;
  license_plate: string | null;
  make: string | null;
  model: string | null;
};

type DeliveryFormState = {
  deliveryNumber: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  assignedDriverId: string;
  assignedVehicleId: string;
  status: DeliveryStatusValue;
  priority: string;
  notes: string;
};

type DeliveryPayload = {
  delivery_number: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_address: string;
  delivery_address: string;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  status: DeliveryStatusValue;
  priority: string;
  notes: string | null;
};

type DeliveryInsertPayload = DeliveryPayload & {
  created_by: string;
};

const deliveryStatusOptions: Array<{
  label: DeliveryStatus;
  value: DeliveryStatusValue;
}> = [
  { label: "Pending", value: "pending" },
  { label: "Assigned", value: "assigned" },
  { label: "In Transit", value: "in_transit" },
  { label: "Delivered", value: "delivered" },
  { label: "Delayed", value: "delayed" },
  { label: "Failed", value: "failed" },
  { label: "Returned", value: "returned" },
];

const priorityOptions = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const emptyDeliveryForm: DeliveryFormState = {
  deliveryNumber: "",
  customerName: "",
  customerPhone: "",
  pickupAddress: "",
  deliveryAddress: "",
  assignedDriverId: "",
  assignedVehicleId: "",
  status: "pending",
  priority: "normal",
  notes: "",
};

function normalizeRelation<T>(relation: T | T[] | null): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function normalizeDeliveryStatus(status: string | null): DeliveryStatus {
  const normalized = (status ?? "pending")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (normalized === "assigned") {
    return "Assigned";
  }

  if (normalized === "in transit") {
    return "In Transit";
  }

  if (normalized === "delivered") {
    return "Delivered";
  }

  if (normalized === "delayed") {
    return "Delayed";
  }

  if (normalized === "failed") {
    return "Failed";
  }

  if (normalized === "returned") {
    return "Returned";
  }

  return "Pending";
}

function toDeliveryStatusValue(status: string | null): DeliveryStatusValue {
  const normalized = (status ?? "pending")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  if (normalized === "assigned") {
    return "assigned";
  }

  if (normalized === "in_transit") {
    return "in_transit";
  }

  if (normalized === "delivered") {
    return "delivered";
  }

  if (normalized === "delayed") {
    return "delayed";
  }

  if (normalized === "failed") {
    return "failed";
  }

  if (normalized === "returned") {
    return "returned";
  }

  return "pending";
}

function formatPriority(priority: string | null): string {
  if (!priority) {
    return "Normal";
  }

  return priority
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toDeliveryPriorityValue(priority: string): string {
  const normalizedPriority = priority.trim().toLowerCase();

  if (
    normalizedPriority === "low" ||
    normalizedPriority === "high" ||
    normalizedPriority === "urgent"
  ) {
    return normalizedPriority;
  }

  return "normal";
}

function formatCreatedDate(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function toDeliveryRecord(delivery: DeliveryRow): DeliveryRecord {
  const driver = normalizeRelation(delivery.drivers);
  const vehicle = normalizeRelation(delivery.vehicles);
  const profile = normalizeRelation(driver?.profiles ?? null);
  const driverName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ");

  return {
    deliveryId: delivery.delivery_id,
    deliveryNumber: delivery.delivery_number ?? "Unnumbered",
    customerName: delivery.customer_name ?? "",
    customerPhone: delivery.customer_phone ?? "",
    customer: delivery.customer_name ?? "Not provided",
    pickupAddress: delivery.pickup_address ?? "Not provided",
    deliveryAddress: delivery.delivery_address ?? "Not provided",
    assignedDriverId: delivery.assigned_driver_id ?? "",
    assignedVehicleId: delivery.assigned_vehicle_id ?? "",
    assignedDriver: driverName || profile?.email || "Unassigned",
    assignedVehicle: vehicle?.license_plate ?? "Unassigned",
    status: toDeliveryStatusValue(delivery.status),
    priority: formatPriority(delivery.priority),
    notes: delivery.notes ?? "",
    createdAt: delivery.created_at,
  };
}

function toDeliveryForm(delivery: DeliveryRecord): DeliveryFormState {
  return {
    deliveryNumber:
      delivery.deliveryNumber === "Unnumbered" ? "" : delivery.deliveryNumber,
    customerName: delivery.customerName,
    customerPhone: delivery.customerPhone,
    pickupAddress:
      delivery.pickupAddress === "Not provided" ? "" : delivery.pickupAddress,
    deliveryAddress:
      delivery.deliveryAddress === "Not provided" ? "" : delivery.deliveryAddress,
    assignedDriverId: delivery.assignedDriverId,
    assignedVehicleId: delivery.assignedVehicleId,
    status: delivery.status,
    priority: delivery.priority,
    notes: delivery.notes,
  };
}

function toDeliveryPayload(formState: DeliveryFormState): DeliveryPayload {
  return {
    delivery_number: formState.deliveryNumber.trim(),
    customer_name: formState.customerName.trim(),
    customer_phone: formState.customerPhone.trim() || null,
    pickup_address: formState.pickupAddress.trim(),
    delivery_address: formState.deliveryAddress.trim(),
    assigned_driver_id: formState.assignedDriverId || null,
    assigned_vehicle_id: formState.assignedVehicleId || null,
    status: formState.status,
    priority: toDeliveryPriorityValue(formState.priority),
    notes: formState.notes.trim() || null,
  };
}

async function getCurrentProfileId() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      errorMessage: "You must be signed in to save deliveries.",
      profileId: "",
    };
  }

  return { errorMessage: "", profileId: data.user.id };
}

function getDriverOptionName(driver: DriverOption): string {
  const profile = normalizeRelation(driver.profiles);
  const driverName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ");

  return driverName || profile?.email || "Unnamed driver";
}

function getVehicleOptionName(vehicle: VehicleOption): string {
  const vehicleName = [vehicle.license_plate, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" - ");

  return vehicleName || "Unnamed vehicle";
}

function KpiCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-5 shadow-sm ${
        accent ? "bg-white text-black" : "bg-[#222222] text-white"
      }`}
    >
      <p
        className={`text-sm ${
          accent ? "text-neutral-500" : "text-neutral-400"
        }`}
      >
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const normalized = priority.toLowerCase();
  const tone =
    normalized === "urgent" || normalized === "high"
      ? "bg-red-50 text-red-700"
      : normalized === "medium" || normalized === "normal"
        ? "bg-blue-50 text-blue-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {priority}
    </span>
  );
}

function DeliveryModal({
  driverOptions,
  formState,
  isSaving,
  mode,
  onChange,
  onClose,
  onSubmit,
  vehicleOptions,
}: {
  driverOptions: DriverOption[];
  formState: DeliveryFormState;
  isSaving: boolean;
  mode: "create" | "edit";
  onChange: (field: keyof DeliveryFormState, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  vehicleOptions: VehicleOption[];
}) {
  const isCreateMode = mode === "create";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-[#222222] p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {isCreateMode ? "Add Delivery" : "Edit Delivery"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Manage customer delivery details, assignments, status, and
              priority.
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
                Delivery Number
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("deliveryNumber", event.target.value)
                }
                required
                value={formState.deliveryNumber}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Customer Name
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("customerName", event.target.value)
                }
                required
                value={formState.customerName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Customer Phone
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("customerPhone", event.target.value)
                }
                type="tel"
                value={formState.customerPhone}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Assigned Driver
              </span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) =>
                  onChange("assignedDriverId", event.target.value)
                }
                value={formState.assignedDriverId}
              >
                <option value="">Unassigned</option>
                {driverOptions.map((driver) => (
                  <option key={driver.driver_id} value={driver.driver_id}>
                    {getDriverOptionName(driver)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-zinc-300">
                Pickup Address
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("pickupAddress", event.target.value)
                }
                required
                value={formState.pickupAddress}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-zinc-300">
                Delivery Address
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("deliveryAddress", event.target.value)
                }
                required
                value={formState.deliveryAddress}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Assigned Vehicle
              </span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) =>
                  onChange("assignedVehicleId", event.target.value)
                }
                value={formState.assignedVehicleId}
              >
                <option value="">Unassigned</option>
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                    {getVehicleOptionName(vehicle)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Status</span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("status", event.target.value)}
                value={formState.status}
              >
                {deliveryStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Priority</span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("priority", event.target.value)}
                value={formState.priority}
              >
                {priorityOptions.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-zinc-300">Notes</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) => onChange("notes", event.target.value)}
                value={formState.notes}
              />
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
              {isSaving
                ? "Saving..."
                : isCreateMode
                  ? "Create Delivery"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DeliveriesPage() {
  const searchParams = useSearchParams();
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] =
    useState<DeliveryRecord | null>(null);

  useEffect(() => {
    if (searchParams.get("action") !== "create") return;
    const timeoutId = window.setTimeout(() => setIsModalOpen(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);
  const [formState, setFormState] =
    useState<DeliveryFormState>(emptyDeliveryForm);
  const [currentPage, setCurrentPage] = useState(1);

  const loadDeliveryData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const [deliveriesResponse, driversResponse, vehiclesResponse] =
      await Promise.all([
        supabase
          .from("deliveries")
          .select(
            `
        delivery_id,
        delivery_number,
        customer_name,
        customer_phone,
        pickup_address,
        delivery_address,
        assigned_driver_id,
        assigned_vehicle_id,
        status,
        priority,
        notes,
        created_at,
        drivers:assigned_driver_id (
          driver_id,
          user_id,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        ),
        vehicles:assigned_vehicle_id (
          vehicle_id,
          license_plate
        )
      `,
          )
          .order("created_at", { ascending: false })
          .returns<DeliveryRow[]>(),
        supabase
          .from("drivers")
          .select(
            "driver_id, user_id, profiles:user_id (first_name, last_name, email)",
          )
          .order("created_at", { ascending: false })
          .returns<DriverOption[]>(),
        supabase
          .from("vehicles")
          .select("vehicle_id, license_plate, make, model")
          .order("license_plate", { ascending: true })
          .returns<VehicleOption[]>(),
      ]);

    if (deliveriesResponse.error) {
      setErrorMessage(deliveriesResponse.error.message);
      setDeliveries([]);
      setIsLoading(false);
      return;
    }

    if (driversResponse.error) {
      setErrorMessage(driversResponse.error.message);
      setDriverOptions([]);
      setIsLoading(false);
      return;
    }

    if (vehiclesResponse.error) {
      setErrorMessage(vehiclesResponse.error.message);
      setVehicleOptions([]);
      setIsLoading(false);
      return;
    }

    setDeliveries((deliveriesResponse.data ?? []).map(toDeliveryRecord));
    setDriverOptions(driversResponse.data ?? []);
    setVehicleOptions(vehiclesResponse.data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDeliveryData();
    });
  }, [loadDeliveryData]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();

    return {
      pending: deliveries.filter((delivery) => delivery.status === "pending")
        .length,
      assigned: deliveries.filter((delivery) => delivery.status === "assigned")
        .length,
      inTransit: deliveries.filter(
        (delivery) => delivery.status === "in_transit",
      ).length,
      deliveredToday: deliveries.filter((delivery) => {
        if (delivery.status !== "delivered" || !delivery.createdAt) {
          return false;
        }

        return new Date(delivery.createdAt).toDateString() === today;
      }).length,
    };
  }, [deliveries]);

  const totalPages = Math.max(
    1,
    Math.ceil(deliveries.length / DEFAULT_PAGE_SIZE),
  );
  const activePage = Math.min(currentPage, totalPages);
  const paginatedDeliveries = deliveries.slice(
    (activePage - 1) * DEFAULT_PAGE_SIZE,
    activePage * DEFAULT_PAGE_SIZE,
  );

  const assignedDrivers = useMemo(
    () =>
      Array.from(
        new Set(
          deliveries
            .map((delivery) => delivery.assignedDriver)
            .filter((driver) => driver !== "Unassigned"),
        ),
      ),
    [deliveries],
  );

  function openCreateModal() {
    setEditingDelivery(null);
    setFormState(emptyDeliveryForm);
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function openEditModal(delivery: DeliveryRecord) {
    setEditingDelivery(delivery);
    setFormState(toDeliveryForm(delivery));
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingDelivery(null);
    setFormState(emptyDeliveryForm);
  }

  function updateFormState(field: keyof DeliveryFormState, value: string) {
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

    const payload = toDeliveryPayload(formState);

    if (!payload.delivery_number) {
      setErrorMessage("Delivery Number is required.");
      setIsSaving(false);
      return;
    }

    if (!payload.customer_name) {
      setErrorMessage("Customer Name is required.");
      setIsSaving(false);
      return;
    }

    if (!payload.pickup_address || !payload.delivery_address) {
      setErrorMessage("Pickup Address and Delivery Address are required.");
      setIsSaving(false);
      return;
    }

    let insertPayload: DeliveryInsertPayload | null = null;

    if (!editingDelivery) {
      const { errorMessage: profileErrorMessage, profileId } =
        await getCurrentProfileId();

      if (profileErrorMessage) {
        setErrorMessage(profileErrorMessage);
        setIsSaving(false);
        return;
      }

      insertPayload = {
        ...payload,
        created_by: profileId,
      };
    }

    const deliveryResponse = editingDelivery
      ? await supabase
          .from("deliveries")
          .update(payload)
          .eq("delivery_id", editingDelivery.deliveryId)
      : insertPayload
        ? await supabase.from("deliveries").insert(insertPayload)
        : { error: new Error("Delivery creator profile is required.") };
    const { error } = deliveryResponse;

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    await loadDeliveryData();
    setSuccessMessage(
      editingDelivery
        ? "Delivery updated successfully."
        : "Delivery created successfully.",
    );
    setIsSaving(false);
    setIsModalOpen(false);
    setEditingDelivery(null);
    setFormState(emptyDeliveryForm);
  }

  return (
    <section className="space-y-4 text-white">
      <div className="flex flex-col gap-4 rounded-3xl bg-[#222222] p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">
            Delivery Management
          </p>
          <h1 className="text-2xl font-semibold">Deliveries</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Track delivery workload, assignments, priorities, and operational
            status across the logistics network.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-lime-200"
          onClick={openCreateModal}
          type="button"
        >
          Add Delivery
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard accent label="Pending Deliveries" value={stats.pending} />
        <KpiCard label="Assigned Deliveries" value={stats.assigned} />
        <KpiCard label="In Transit" value={stats.inTransit} />
        <KpiCard label="Delivered Today" value={stats.deliveredToday} />
      </div>

      <div className="rounded-3xl bg-[#222222] p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            className="rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-lime-300"
            placeholder="Search deliveries"
            type="search"
          />
          <select className="rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-lime-300">
            <option>Delivery Status</option>
            {deliveryStatusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select className="rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-lime-300">
            <option>Priority</option>
            {priorityOptions.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
          <select className="rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-lime-300">
            <option>Assigned Driver</option>
            {assignedDrivers.map((driver) => (
              <option key={driver}>{driver}</option>
            ))}
          </select>
        </div>
      </div>

      {successMessage ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl bg-[#222222] shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Delivery Records</h2>
            <p className="text-sm text-neutral-400">
              Real delivery records from Supabase appear here when available.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-sm text-neutral-400">
            Loading delivery records...
          </div>
        ) : deliveries.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-lg font-semibold">No deliveries found.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-400">
              Delivery records will appear here once they are created. Add your
              first delivery to begin tracking assignments.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm [&_td]:py-2.5 [&_th]:py-2.5">
              <thead className="bg-black/20 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Delivery Number</th>
                  <th className="px-5 py-4 font-medium">Customer</th>
                  <th className="px-5 py-4 font-medium">Phone</th>
                  <th className="px-5 py-4 font-medium">Pickup Address</th>
                  <th className="px-5 py-4 font-medium">Delivery Address</th>
                  <th className="px-5 py-4 font-medium">Assigned Driver</th>
                  <th className="px-5 py-4 font-medium">Assigned Vehicle</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Priority</th>
                  <th className="px-5 py-4 font-medium">Created Date</th>
                  <th className="px-5 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {paginatedDeliveries.map((delivery) => (
                  <tr
                    className="text-neutral-200 transition hover:bg-white/[0.03]"
                    key={delivery.deliveryId}
                  >
                    <td className="px-5 py-4 font-medium text-white">
                      {delivery.deliveryNumber}
                    </td>
                    <td className="px-5 py-4">{delivery.customer}</td>
                    <td className="px-5 py-4">
                      {delivery.customerPhone || "No phone"}
                    </td>
                    <td className="max-w-64 px-5 py-4 text-neutral-300">
                      {delivery.pickupAddress}
                    </td>
                    <td className="max-w-64 px-5 py-4 text-neutral-300">
                      {delivery.deliveryAddress}
                    </td>
                    <td className="px-5 py-4">{delivery.assignedDriver}</td>
                    <td className="px-5 py-4">{delivery.assignedVehicle}</td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        status={normalizeDeliveryStatus(delivery.status)}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <PriorityBadge priority={delivery.priority} />
                    </td>
                    <td className="px-5 py-4">
                      {formatCreatedDate(delivery.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-300 transition hover:bg-white/10"
                        onClick={() => openEditModal(delivery)}
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
          </>
        )}
      </div>

      <Pagination
        currentPage={activePage}
        onPageChange={setCurrentPage}
        totalPages={totalPages}
        totalRecords={deliveries.length}
      />

      {isModalOpen ? (
        <DeliveryModal
          driverOptions={driverOptions}
          formState={formState}
          isSaving={isSaving}
          mode={editingDelivery ? "edit" : "create"}
          onChange={updateFormState}
          onClose={closeModal}
          onSubmit={handleSubmit}
          vehicleOptions={vehicleOptions}
        />
      ) : null}
    </section>
  );
}
