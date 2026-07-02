"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { DEFAULT_PAGE_SIZE, Pagination } from "../_components/Pagination";

type DeliveryRelation = {
  delivery_id: string;
  delivery_number: string | null;
  status: string | null;
};

type RouteRow = {
  route_id: string;
  delivery_id: string | null;
  origin_name: string | null;
  origin_address: string | null;
  origin_latitude: number | string | null;
  origin_longitude: number | string | null;
  destination_name: string | null;
  destination_address: string | null;
  destination_latitude: number | string | null;
  destination_longitude: number | string | null;
  estimated_distance_km: number | string | null;
  estimated_duration_minutes: number | string | null;
  actual_distance_km: number | string | null;
  actual_duration_minutes: number | string | null;
  route_polyline: string | null;
  maps_url: string | null;
  route_provider: string | null;
  route_generated_at: string | null;
  sequence_order: number | null;
  created_at: string | null;
  deliveries: DeliveryRelation | DeliveryRelation[] | null;
};

type RouteRecord = {
  routeId: string;
  deliveryId: string;
  deliveryNumber: string;
  origin: string;
  destination: string;
  estimatedDistance: string;
  estimatedDistanceLabel: string;
  estimatedTime: string;
  estimatedTimeLabel: string;
  sequenceOrder: string;
  googleMapsUrl: string;
  deliveryStatus: string;
};

type RouteFormState = {
  deliveryId: string;
  origin: string;
  destination: string;
  estimatedDistance: string;
  estimatedTime: string;
  sequenceOrder: string;
  googleMapsUrl: string;
};

type RoutePayload = {
  delivery_id: string | null;
  origin_address: string;
  destination_address: string;
  estimated_distance_km: number | null;
  estimated_duration_minutes: number | null;
  sequence_order: number | null;
  maps_url: string | null;
};

const emptyRouteForm: RouteFormState = {
  deliveryId: "",
  origin: "",
  destination: "",
  estimatedDistance: "",
  estimatedTime: "",
  sequenceOrder: "",
  googleMapsUrl: "",
};

function normalizeRelation<T>(relation: T | T[] | null): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function formatDistance(value: number | string | null): string {
  if (value === null || value === "") {
    return "Not estimated";
  }

  const numericDistance = Number(value);

  if (Number.isFinite(numericDistance)) {
    return `${numericDistance.toLocaleString()} km`;
  }

  return String(value);
}

function formatTravelTime(value: number | string | null): string {
  if (value === null || value === "") {
    return "Not estimated";
  }

  const numericTime = Number(value);

  if (Number.isFinite(numericTime)) {
    return `${numericTime.toLocaleString()} min`;
  }

  return String(value);
}

function toFormNumber(value: number | string | null): string {
  if (value === null || value === "") {
    return "";
  }

  return String(value);
}

function toNullableNumber(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function toNullableInteger(value: string): number | null {
  const numericValue = toNullableNumber(value);

  return numericValue === null ? null : Math.trunc(numericValue);
}

function toRouteRecord(route: RouteRow): RouteRecord {
  const delivery = normalizeRelation(route.deliveries);
  const estimatedDistance = toFormNumber(route.estimated_distance_km);
  const estimatedTime = toFormNumber(route.estimated_duration_minutes);

  return {
    routeId: route.route_id,
    deliveryId: route.delivery_id ?? "",
    deliveryNumber: delivery?.delivery_number ?? "Unassigned",
    origin: route.origin_address ?? route.origin_name ?? "",
    destination: route.destination_address ?? route.destination_name ?? "",
    estimatedDistance,
    estimatedDistanceLabel: formatDistance(route.estimated_distance_km),
    estimatedTime,
    estimatedTimeLabel: formatTravelTime(route.estimated_duration_minutes),
    sequenceOrder:
      route.sequence_order === null ? "" : String(route.sequence_order),
    googleMapsUrl: route.maps_url ?? "",
    deliveryStatus: delivery?.status ?? "",
  };
}

function toRouteForm(route: RouteRecord): RouteFormState {
  return {
    deliveryId: route.deliveryId,
    origin: route.origin,
    destination: route.destination,
    estimatedDistance: route.estimatedDistance,
    estimatedTime: route.estimatedTime,
    sequenceOrder: route.sequenceOrder,
    googleMapsUrl: route.googleMapsUrl,
  };
}

function toRoutePayload(formState: RouteFormState): RoutePayload {
  return {
    delivery_id: formState.deliveryId || null,
    origin_address: formState.origin.trim(),
    destination_address: formState.destination.trim(),
    estimated_distance_km: toNullableNumber(formState.estimatedDistance),
    estimated_duration_minutes: toNullableInteger(formState.estimatedTime),
    sequence_order: toNullableInteger(formState.sequenceOrder),
    maps_url: formState.googleMapsUrl.trim() || null,
  };
}

function getDeliveryOptionLabel(delivery: DeliveryRelation): string {
  return delivery.delivery_number ?? "Unnumbered delivery";
}

function RouteKpiCard({
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

function RouteModal({
  deliveryOptions,
  formState,
  isSaving,
  mode,
  onChange,
  onClose,
  onSubmit,
}: {
  deliveryOptions: DeliveryRelation[];
  formState: RouteFormState;
  isSaving: boolean;
  mode: "create" | "edit";
  onChange: (field: keyof RouteFormState, value: string) => void;
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
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#222222] p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {isCreateMode ? "Add Route" : "Edit Route"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Maintain route details used for dispatch planning and driver
              navigation.
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
              <span className="text-sm font-medium text-zinc-300">
                Delivery
              </span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("deliveryId", event.target.value)}
                required
                value={formState.deliveryId}
              >
                <option value="">Select delivery</option>
                {deliveryOptions.map((delivery) => (
                  <option key={delivery.delivery_id} value={delivery.delivery_id}>
                    {getDeliveryOptionLabel(delivery)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Origin</span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) => onChange("origin", event.target.value)}
                required
                value={formState.origin}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Destination
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("destination", event.target.value)
                }
                required
                value={formState.destination}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Estimated Distance
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                min="0"
                onChange={(event) =>
                  onChange("estimatedDistance", event.target.value)
                }
                step="0.1"
                type="number"
                value={formState.estimatedDistance}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Estimated Time in Minutes
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                min="0"
                onChange={(event) =>
                  onChange("estimatedTime", event.target.value)
                }
                type="number"
                value={formState.estimatedTime}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Sequence Order
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                min="0"
                onChange={(event) =>
                  onChange("sequenceOrder", event.target.value)
                }
                type="number"
                value={formState.sequenceOrder}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Google Maps URL
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-lime-300"
                onChange={(event) =>
                  onChange("googleMapsUrl", event.target.value)
                }
                type="url"
                value={formState.googleMapsUrl}
              />
            </label>
          </div>

          {deliveryOptions.length === 0 ? (
            <p className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
              Create a delivery before adding a route.
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
              disabled={isSaving || deliveryOptions.length === 0}
              type="submit"
            >
              {isSaving
                ? "Saving..."
                : isCreateMode
                  ? "Create Route"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminRoutesPage() {
  const searchParams = useSearchParams();
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryRelation[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteRecord | null>(null);

  useEffect(() => {
    if (searchParams.get("action") !== "create") return;
    const timeoutId = window.setTimeout(() => setIsModalOpen(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);
  const [formState, setFormState] = useState<RouteFormState>(emptyRouteForm);
  const [currentPage, setCurrentPage] = useState(1);

  const loadRouteData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const [routesResponse, deliveriesResponse] = await Promise.all([
      supabase
        .from("routes")
        .select(
          `
        route_id,
        delivery_id,
        origin_name,
        origin_address,
        origin_latitude,
        origin_longitude,
        destination_name,
        destination_address,
        destination_latitude,
        destination_longitude,
        estimated_distance_km,
        estimated_duration_minutes,
        actual_distance_km,
        actual_duration_minutes,
        route_polyline,
        maps_url,
        route_provider,
        route_generated_at,
        sequence_order,
        created_at,
        deliveries:delivery_id (
          delivery_id,
          delivery_number,
          status
        )
      `,
        )
        .order("created_at", { ascending: false })
        .returns<RouteRow[]>(),
      supabase
        .from("deliveries")
        .select("delivery_id, delivery_number, status")
        .order("delivery_number", { ascending: true })
        .returns<DeliveryRelation[]>(),
    ]);

    if (routesResponse.error) {
      setErrorMessage(routesResponse.error.message);
      setRoutes([]);
      setIsLoading(false);
      return;
    }

    if (deliveriesResponse.error) {
      setErrorMessage(deliveriesResponse.error.message);
      setDeliveryOptions([]);
      setIsLoading(false);
      return;
    }

    setRoutes((routesResponse.data ?? []).map(toRouteRecord));
    setDeliveryOptions(deliveriesResponse.data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRouteData();
    });
  }, [loadRouteData]);

  const routeStats = useMemo(() => {
    const travelTimes = routes
      .map((route) => toNullableNumber(route.estimatedTime))
      .filter((time): time is number => time !== null);
    const distances = routes
      .map((route) => toNullableNumber(route.estimatedDistance))
      .filter((distance): distance is number => distance !== null);
    const totalDistance = distances.reduce(
      (sum, distance) => sum + distance,
      0,
    );
    const averageTime =
      travelTimes.length === 0
        ? 0
        : travelTimes.reduce((sum, time) => sum + time, 0) /
          travelTimes.length;

    return {
      active: routes.filter((route) =>
        ["assigned", "in_transit"].includes(
          route.deliveryStatus.trim().toLowerCase(),
        ),
      ).length,
      averageTime: averageTime === 0 ? "0 min" : `${Math.round(averageTime)} min`,
      total: routes.length,
      totalDistance:
        totalDistance === 0 ? "0 km" : `${Math.round(totalDistance)} km`,
    };
  }, [routes]);

  const totalPages = Math.max(1, Math.ceil(routes.length / DEFAULT_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedRoutes = routes.slice(
    (activePage - 1) * DEFAULT_PAGE_SIZE,
    activePage * DEFAULT_PAGE_SIZE,
  );

  const deliveryNumbers = useMemo(
    () =>
      Array.from(
        new Set(
          routes
            .map((route) => route.deliveryNumber)
            .filter((deliveryNumber) => deliveryNumber !== "Unassigned"),
        ),
      ),
    [routes],
  );

  const sequenceOrders = useMemo(
    () =>
      Array.from(
        new Set(
          routes
            .map((route) => route.sequenceOrder)
            .filter((sequenceOrder) => sequenceOrder !== ""),
        ),
      ),
    [routes],
  );

  function openCreateModal() {
    setEditingRoute(null);
    setFormState({
      ...emptyRouteForm,
      deliveryId: deliveryOptions[0]?.delivery_id ?? "",
    });
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function openEditModal(route: RouteRecord) {
    setEditingRoute(route);
    setFormState(toRouteForm(route));
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingRoute(null);
    setFormState(emptyRouteForm);
  }

  function updateFormState(field: keyof RouteFormState, value: string) {
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

    const payload = toRoutePayload(formState);

    if (!payload.delivery_id) {
      setErrorMessage("Delivery is required.");
      setIsSaving(false);
      return;
    }

    if (!payload.origin_address || !payload.destination_address) {
      setErrorMessage("Origin and Destination are required.");
      setIsSaving(false);
      return;
    }

    const { error } = editingRoute
      ? await supabase
          .from("routes")
          .update(payload)
          .eq("route_id", editingRoute.routeId)
      : await supabase.from("routes").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    await loadRouteData();
    setSuccessMessage(
      editingRoute
        ? "Route updated successfully."
        : "Route created successfully.",
    );
    setIsSaving(false);
    setIsModalOpen(false);
    setEditingRoute(null);
    setFormState(emptyRouteForm);
  }

  return (
    <section className="space-y-4 text-white">
      <div className="flex flex-col gap-4 rounded-3xl bg-[#222222] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">
            Route Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Routes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Manage route origins, destinations, delivery sequence, travel
            estimates, and map links for logistics operations.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          onClick={openCreateModal}
          type="button"
        >
          Add Route
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <RouteKpiCard
          accent
          detail="All route records"
          label="Total Routes"
          value={String(routeStats.total)}
        />
        <RouteKpiCard
          detail="Linked to assigned or in transit deliveries"
          label="Active Routes"
          value={String(routeStats.active)}
        />
        <RouteKpiCard
          detail="Across estimated route plans"
          label="Average Travel Time"
          value={routeStats.averageTime}
        />
        <RouteKpiCard
          detail="Combined estimated mileage"
          label="Total Distance"
          value={routeStats.totalDistance}
        />
      </div>

      <div className="rounded-3xl bg-[#222222] p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="sr-only">Search routes</span>
            <input
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
              placeholder="Search routes"
              type="search"
            />
          </label>
          <label className="block">
            <span className="sr-only">Delivery</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Delivery</option>
              {deliveryNumbers.map((deliveryNumber) => (
                <option key={deliveryNumber}>{deliveryNumber}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Sequence order</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Sequence Order</option>
              {sequenceOrders.map((sequenceOrder) => (
                <option key={sequenceOrder}>{sequenceOrder}</option>
              ))}
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
            <h2 className="text-xl font-medium">Route Records</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Route records joined to deliveries through routes.delivery_id.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-10 text-sm text-zinc-400">
            Loading route records...
          </p>
        ) : routes.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              RT
            </div>
            <h3 className="mt-4 text-lg font-semibold">No routes found.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Add your first route to connect a delivery with origin,
              destination, travel estimates, and map details.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm [&_td]:py-2.5 [&_th]:py-2.5">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Delivery Number</th>
                  <th className="px-5 py-4 font-medium">Origin</th>
                  <th className="px-5 py-4 font-medium">Destination</th>
                  <th className="px-5 py-4 font-medium">
                    Estimated Distance
                  </th>
                  <th className="px-5 py-4 font-medium">Estimated Time</th>
                  <th className="px-5 py-4 font-medium">Sequence Order</th>
                  <th className="px-5 py-4 font-medium">Google Maps Link</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {paginatedRoutes.map((route) => (
                  <tr className="transition hover:bg-white/5" key={route.routeId}>
                    <td className="px-5 py-4 font-medium text-white">
                      {route.deliveryNumber}
                    </td>
                    <td className="max-w-64 px-5 py-4">
                      {route.origin || "Not provided"}
                    </td>
                    <td className="max-w-64 px-5 py-4">
                      {route.destination || "Not provided"}
                    </td>
                    <td className="px-5 py-4">
                      {route.estimatedDistanceLabel}
                    </td>
                    <td className="px-5 py-4">{route.estimatedTimeLabel}</td>
                    <td className="px-5 py-4">
                      {route.sequenceOrder || "Not set"}
                    </td>
                    <td className="px-5 py-4">
                      {route.googleMapsUrl ? (
                        <a
                          className="font-semibold text-lime-300 transition hover:text-lime-200"
                          href={route.googleMapsUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open map
                        </a>
                      ) : (
                        "Not provided"
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                        onClick={() => openEditModal(route)}
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
        totalRecords={routes.length}
      />

      {isModalOpen ? (
        <RouteModal
          deliveryOptions={deliveryOptions}
          formState={formState}
          isSaving={isSaving}
          mode={editingRoute ? "edit" : "create"}
          onChange={updateFormState}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  );
}
