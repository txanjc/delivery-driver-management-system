"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type DeliveryRelation = {
  id: string;
  delivery_number: string | null;
};

type RouteRow = {
  id: string;
  delivery_id: string | null;
  origin: string | null;
  destination: string | null;
  estimated_distance: number | string | null;
  estimated_time: number | string | null;
  sequence_order: number | null;
  google_maps_url: string | null;
  status: string | null;
  created_at: string | null;
  deliveries: DeliveryRelation | DeliveryRelation[] | null;
};

type RouteRecord = {
  id: string;
  deliveryNumber: string;
  origin: string;
  destination: string;
  estimatedDistance: string;
  estimatedTime: string;
  sequenceOrder: string;
  googleMapsUrl: string | null;
  status: string;
};

function normalizeRelation<T>(relation: T | T[] | null): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function formatRouteStatus(status: string | null): string {
  if (!status) {
    return "Planned";
  }

  return status
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDistance(value: number | string | null): string {
  if (value === null || value === "") {
    return "Not estimated";
  }

  const numericDistance = Number(value);

  if (Number.isFinite(numericDistance)) {
    return `${numericDistance.toLocaleString()} mi`;
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

function toRouteRecord(route: RouteRow): RouteRecord {
  const delivery = normalizeRelation(route.deliveries);

  return {
    id: route.id,
    deliveryNumber: delivery?.delivery_number ?? "Unassigned",
    origin: route.origin ?? "Not provided",
    destination: route.destination ?? "Not provided",
    estimatedDistance: formatDistance(route.estimated_distance),
    estimatedTime: formatTravelTime(route.estimated_time),
    sequenceOrder:
      route.sequence_order === null ? "Not set" : String(route.sequence_order),
    googleMapsUrl: route.google_maps_url,
    status: formatRouteStatus(route.status),
  };
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

function RouteStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const tone =
    normalizedStatus === "active"
      ? "bg-blue-500/15 text-blue-300"
      : normalizedStatus === "optimized"
        ? "bg-emerald-500/15 text-emerald-300"
        : normalizedStatus === "delayed"
          ? "bg-orange-500/15 text-orange-300"
          : "bg-zinc-500/15 text-zinc-300";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

function getNumericValue(value: string): number | null {
  const numericValue = Number(value.replace(/[^\d.]/g, ""));

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadRoutes = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("routes")
      .select(
        `
        id,
        delivery_id,
        origin,
        destination,
        estimated_distance,
        estimated_time,
        sequence_order,
        google_maps_url,
        status,
        created_at,
        deliveries:delivery_id (
          id,
          delivery_number
        )
      `,
      )
      .order("created_at", { ascending: false })
      .returns<RouteRow[]>();

    if (error) {
      setErrorMessage(error.message);
      setRoutes([]);
      setIsLoading(false);
      return;
    }

    setRoutes((data ?? []).map(toRouteRecord));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRoutes();
    });
  }, [loadRoutes]);

  const routeStats = useMemo(() => {
    const travelTimes = routes
      .map((route) => getNumericValue(route.estimatedTime))
      .filter((time): time is number => time !== null);
    const distances = routes
      .map((route) => getNumericValue(route.estimatedDistance))
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
      active: routes.filter((route) => route.status === "Active").length,
      optimized: routes.filter((route) => route.status === "Optimized").length,
      averageTime: averageTime === 0 ? "0 min" : `${Math.round(averageTime)} min`,
      totalDistance:
        totalDistance === 0 ? "0 mi" : `${Math.round(totalDistance)} mi`,
    };
  }, [routes]);

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

  const routeStatuses = useMemo(
    () => Array.from(new Set(routes.map((route) => route.status))),
    [routes],
  );

  const sequenceOrders = useMemo(
    () =>
      Array.from(
        new Set(
          routes
            .map((route) => route.sequenceOrder)
            .filter((sequenceOrder) => sequenceOrder !== "Not set"),
        ),
      ),
    [routes],
  );

  return (
    <section className="space-y-5 text-white">
      <div className="flex flex-col gap-4 rounded-3xl bg-[#222222] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">
            Route Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Routes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Review planned routes, delivery sequence, travel estimates, and map
            links for active logistics operations.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          type="button"
        >
          Plan Route
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <RouteKpiCard
          accent
          detail="Routes currently in motion"
          label="Active Routes"
          value={String(routeStats.active)}
        />
        <RouteKpiCard
          detail="Ready for efficient dispatch"
          label="Optimized Routes"
          value={String(routeStats.optimized)}
        />
        <RouteKpiCard
          detail="Across estimated route plans"
          label="Avg. Travel Time"
          value={routeStats.averageTime}
        />
        <RouteKpiCard
          detail="Combined estimated mileage"
          label="Total Distance"
          value={routeStats.totalDistance}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="overflow-hidden rounded-3xl bg-[#222222]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-xl font-medium">Route Map Preview</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Live Google Maps integration will connect here later.
              </p>
            </div>
          </div>
          <div className="relative min-h-80 overflow-hidden bg-[#141414]">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:36px_36px]" />
            <div className="absolute left-[12%] top-[58%] h-2 w-[72%] rotate-[-8deg] rounded-full bg-lime-300/70 shadow-[0_0_28px_rgba(190,242,100,0.45)]" />
            <div className="absolute left-[18%] top-[55%] h-5 w-5 rounded-full border-4 border-[#141414] bg-lime-300" />
            <div className="absolute left-[45%] top-[45%] h-5 w-5 rounded-full border-4 border-[#141414] bg-blue-400" />
            <div className="absolute right-[16%] top-[38%] h-5 w-5 rounded-full border-4 border-[#141414] bg-orange-400" />
            <div className="absolute bottom-5 left-5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
              Route visualization placeholder
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-[#222222] p-5">
          <h2 className="text-xl font-medium">Plan Route</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            Route planning inputs are reserved for a later workflow. Database
            inserts are intentionally not enabled yet.
          </p>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-400">
              Select delivery
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-400">
              Set origin and destination
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-400">
              Estimate distance and travel time
            </div>
          </div>
          <button
            className="mt-5 w-full rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-400"
            disabled
            type="button"
          >
            Planning Coming Soon
          </button>
        </div>
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
            <span className="sr-only">Route status</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Route Status</option>
              {routeStatuses.map((status) => (
                <option key={status}>{status}</option>
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
              Route data loaded from Supabase with delivery number context.
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
              Route records will appear here once route plans are added to the
              routes table.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
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
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {routes.map((route) => (
                  <tr className="transition hover:bg-white/5" key={route.id}>
                    <td className="px-5 py-4 font-medium text-white">
                      {route.deliveryNumber}
                    </td>
                    <td className="max-w-64 px-5 py-4">{route.origin}</td>
                    <td className="max-w-64 px-5 py-4">
                      {route.destination}
                    </td>
                    <td className="px-5 py-4">{route.estimatedDistance}</td>
                    <td className="px-5 py-4">{route.estimatedTime}</td>
                    <td className="px-5 py-4">{route.sequenceOrder}</td>
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
                    <td className="px-5 py-4">
                      <RouteStatusBadge status={route.status} />
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
