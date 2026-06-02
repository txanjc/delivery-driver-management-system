"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { StatusBadge } from "../_components/admin-ui";
import { supabase } from "@/lib/supabase";

type DeliveryStatus =
  | "Pending"
  | "Assigned"
  | "In Transit"
  | "Delivered"
  | "Delayed"
  | "Failed"
  | "Returned";

type DriverProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type DeliveryDriver = {
  id: string;
  user_id: string | null;
  profiles: DriverProfile | DriverProfile[] | null;
};

type DeliveryVehicle = {
  id: string;
  plate_number: string | null;
};

type DeliveryRow = {
  id: string;
  delivery_number: string | null;
  customer_name: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  drivers: DeliveryDriver | DeliveryDriver[] | null;
  vehicles: DeliveryVehicle | DeliveryVehicle[] | null;
};

type DeliveryRecord = {
  id: string;
  deliveryNumber: string;
  customer: string;
  pickupAddress: string;
  deliveryAddress: string;
  assignedDriver: string;
  assignedVehicle: string;
  status: DeliveryStatus;
  priority: string;
  createdAt: string | null;
};

const deliveryStatuses: DeliveryStatus[] = [
  "Pending",
  "Assigned",
  "In Transit",
  "Delivered",
  "Delayed",
  "Failed",
  "Returned",
];

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
    id: delivery.id,
    deliveryNumber: delivery.delivery_number ?? "Unnumbered",
    customer: delivery.customer_name ?? "Not provided",
    pickupAddress: delivery.pickup_address ?? "Not provided",
    deliveryAddress: delivery.delivery_address ?? "Not provided",
    assignedDriver: driverName || profile?.email || "Unassigned",
    assignedVehicle: vehicle?.plate_number ?? "Unassigned",
    status: normalizeDeliveryStatus(delivery.status),
    priority: formatPriority(delivery.priority),
    createdAt: delivery.created_at,
  };
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
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {priority}
    </span>
  );
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("deliveries")
      .select(
        `
        id,
        delivery_number,
        customer_name,
        pickup_address,
        delivery_address,
        assigned_driver_id,
        assigned_vehicle_id,
        status,
        priority,
        created_at,
        drivers:assigned_driver_id (
          id,
          user_id,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        ),
        vehicles:assigned_vehicle_id (
          id,
          plate_number
        )
      `,
      )
      .order("created_at", { ascending: false })
      .returns<DeliveryRow[]>();

    if (error) {
      setErrorMessage(error.message);
      setDeliveries([]);
      setIsLoading(false);
      return;
    }

    setDeliveries((data ?? []).map(toDeliveryRecord));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDeliveries();
    });
  }, [loadDeliveries]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();

    return {
      pending: deliveries.filter((delivery) => delivery.status === "Pending")
        .length,
      assigned: deliveries.filter((delivery) => delivery.status === "Assigned")
        .length,
      inTransit: deliveries.filter(
        (delivery) => delivery.status === "In Transit",
      ).length,
      deliveredToday: deliveries.filter((delivery) => {
        if (delivery.status !== "Delivered" || !delivery.createdAt) {
          return false;
        }

        return new Date(delivery.createdAt).toDateString() === today;
      }).length,
    };
  }, [deliveries]);

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

  return (
    <section className="space-y-5 text-white">
      <div className="flex flex-col gap-4 rounded-3xl bg-[#222222] p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deliveries</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Track delivery workload, assignments, priorities, and operational
            status across the logistics network.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-lime-200"
          type="button"
        >
          New Delivery
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
            {deliveryStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select className="rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-lime-300">
            <option>Priority</option>
            <option>Low</option>
            <option>Normal</option>
            <option>Medium</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
          <select className="rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-lime-300">
            <option>Assigned Driver</option>
            {assignedDrivers.map((driver) => (
              <option key={driver}>{driver}</option>
            ))}
          </select>
        </div>
      </div>

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
              Delivery records will appear here once they are created. New
              delivery creation is planned for a later delivery form flow.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-black/20 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Delivery Number</th>
                  <th className="px-5 py-4 font-medium">Customer</th>
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
                {deliveries.map((delivery) => (
                  <tr
                    className="text-neutral-200 transition hover:bg-white/[0.03]"
                    key={delivery.id}
                  >
                    <td className="px-5 py-4 font-medium text-white">
                      {delivery.deliveryNumber}
                    </td>
                    <td className="px-5 py-4">{delivery.customer}</td>
                    <td className="max-w-64 px-5 py-4 text-neutral-300">
                      {delivery.pickupAddress}
                    </td>
                    <td className="max-w-64 px-5 py-4 text-neutral-300">
                      {delivery.deliveryAddress}
                    </td>
                    <td className="px-5 py-4">{delivery.assignedDriver}</td>
                    <td className="px-5 py-4">{delivery.assignedVehicle}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={delivery.status} />
                    </td>
                    <td className="px-5 py-4">
                      <PriorityBadge priority={delivery.priority} />
                    </td>
                    <td className="px-5 py-4">
                      {formatCreatedDate(delivery.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-300"
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
