"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AdminCard,
  AdminPageIntro,
  PrimaryActionLink,
  SecondaryButton,
} from "./_components/admin-design-system";
import { StatusBadge } from "./_components/admin-ui";
import { AppIcons } from "@/config/icons";
import { fetchAdministratorJson } from "@/lib/admin-api-client";
import { type OperationalAlert, type OperationalAlertsResponse } from "@/lib/operational-alerts";
import {
  getGoogleMapsConfig,
  getGoogleMapsConfigurationError,
  loadGoogleMapsLibraries,
  type GoogleMapsLibraries,
} from "@/lib/google-maps-client";
import { Skeleton } from "@/components/ui/Skeleton";

type DateScope = "today" | "week" | "month";
type DeliveryStatus = "pending" | "assigned" | "in_transit" | "delivered" | "delayed" | "failed" | "returned";
type DashboardFilter = "all" | "active" | "in_transit" | "completed" | "exceptions" | "drivers_on_shift" | "vehicles_in_use" | DeliveryStatus;
type DeliveryRow = { delivery_id: string; delivery_number: string | null; customer_name: string | null; customer_phone: string | null; pickup_address: string | null; pickup_latitude: number | string | null; pickup_longitude: number | string | null; delivery_address: string | null; delivery_latitude: number | string | null; delivery_longitude: number | string | null; assigned_driver_id: string | null; assigned_vehicle_id: string | null; status: string | null; priority: string | null; updated_at: string | null };
type RouteRow = { route_id: string; delivery_id: string | null; origin: string | null; destination: string | null; origin_address: string | null; origin_latitude: number | string | null; origin_longitude: number | string | null; destination_address: string | null; destination_latitude: number | string | null; destination_longitude: number | string | null; estimated_distance_km: number | string | null; estimated_duration_minutes: number | string | null; route_polyline: string | null; maps_url: string | null; route_provider: string | null; created_at: string | null };
type DriverRow = { driver_id: string; user_id: string | null; availability: string | null };
type ProfileRow = { profile_id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; is_active: boolean | null };
type VehicleRow = { vehicle_id: string; vehicle_number: string | null; license_plate: string | null; make: string | null; model: string | null; vehicle_type: string | null; status: string | null };
type ScheduleRow = { schedule_id: string; driver_id: string | null; vehicle_id: string | null; shift_name: string | null; start_time: string | null; end_time: string | null; status: string | null };
type DeliveryHistoryRow = { delivery_id: string; status: string | null; created_at: string | null };
type RoutesApiData = { routes: RouteRow[]; deliveries: DeliveryRow[]; deliveryHistory: DeliveryHistoryRow[]; drivers: DriverRow[]; profiles: ProfileRow[]; vehicles: VehicleRow[]; schedules: ScheduleRow[] };
type DeliveryRecord = DeliveryRow & { statusValue: DeliveryStatus; driverName: string; vehicleName: string; route: RouteRow | null };
type MapPoint = { x: number; y: number };
type DashboardIssue = { label: string; message: string; severity: "critical" | "warning" | "info"; href: string; createdAt: string | null; deliveryId?: string };
type DashboardMapRecord = {
  deliveryId: string;
  deliveryNumber: string;
  customerName: string;
  status: DeliveryStatus;
  driverName: string;
  vehicleName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  routePath: Array<{ lat: number; lng: number }>;
};
type DashboardMapOverlay = {
  casing: google.maps.Polyline | null;
  dropoffMarker: google.maps.marker.AdvancedMarkerElement;
  pickupMarker: google.maps.marker.AdvancedMarkerElement;
  record: DashboardMapRecord;
  routeLine: google.maps.Polyline | null;
};
type DriverPerformanceStatus = "On Shift" | "Assigned" | "Available" | "Off Shift";
type DriverPerformanceRow = { completed: number; driverId: string; initials: string; name: string; onTimeRate: number | null; score: number; status: DriverPerformanceStatus };

const WESTCHESTER_DEFAULT_CENTER = { lat: 41.033, lng: -73.763 };
const WESTCHESTER_DEFAULT_ZOOM = 11;

const statusLabels: Record<DeliveryStatus, "Pending" | "Assigned" | "In Transit" | "Delivered" | "Delayed" | "Failed" | "Returned"> = {
  pending: "Pending",
  assigned: "Assigned",
  in_transit: "In Transit",
  delivered: "Delivered",
  delayed: "Delayed",
  failed: "Failed",
  returned: "Returned",
};
const statusColors: Record<DeliveryStatus, string> = {
  pending: "#94a3b8",
  assigned: "#6d4aff",
  in_transit: "#2563eb",
  delivered: "#16a34a",
  delayed: "#f59e0b",
  failed: "#dc2626",
  returned: "#ea580c",
};

function normalizeStatus(value: string | null): DeliveryStatus {
  const normalized = (value ?? "pending").toLowerCase().replaceAll(" ", "_");
  return ["pending", "assigned", "in_transit", "delivered", "delayed", "failed", "returned"].includes(normalized) ? normalized as DeliveryStatus : "pending";
}

function numberValue(value: number | string | null) {
  const parsed = Number(value);
  return value === null || value === "" || !Number.isFinite(parsed) ? null : parsed;
}

function dateRange(scope: DateScope) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (scope === "week") start.setDate(start.getDate() - start.getDay());
  if (scope === "month") start.setDate(1);
  const end = new Date(start);
  if (scope === "today") end.setDate(start.getDate() + 1);
  if (scope === "week") end.setDate(start.getDate() + 7);
  if (scope === "month") end.setMonth(start.getMonth() + 1);
  return { start, end, now };
}

function inRange(value: string | null, scope: DateScope) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const { start, end } = dateRange(scope);
  return date >= start && date < end;
}

function overlapsRange(startValue: string | null, endValue: string | null, scope: DateScope) {
  if (!startValue || !endValue) return false;
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const range = dateRange(scope);
  return start < range.end && end > range.start;
}

function isActiveStatus(status: DeliveryStatus) {
  return ["assigned", "in_transit", "delayed"].includes(status);
}

function isExceptionStatus(status: DeliveryStatus) {
  return ["delayed", "failed", "returned"].includes(status);
}

function profileName(profile?: ProfileRow) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Unassigned";
}

function vehicleName(vehicle?: VehicleRow) {
  return [vehicle?.vehicle_number, [vehicle?.make, vehicle?.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || vehicle?.license_plate || "Unassigned";
}

function shortPlace(value: string | null | undefined) {
  const parts = (value ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return parts[0]?.replace(/^\d+\s+/, "") || "Unknown";
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function relativeTime(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function decodePolyline(encoded: string | null) {
  if (!encoded) return [];
  const coordinates: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coordinates;
}

function deliveryHasCoordinates(delivery: DeliveryRecord) {
  return (
    numberValue(delivery.pickup_latitude) !== null &&
    numberValue(delivery.pickup_longitude) !== null &&
    numberValue(delivery.delivery_latitude) !== null &&
    numberValue(delivery.delivery_longitude) !== null
  );
}

function mapRecordFromDelivery(delivery: DeliveryRecord): DashboardMapRecord {
  return {
    customerName: delivery.customer_name ?? "Unknown customer",
    deliveryId: delivery.delivery_id,
    deliveryNumber: delivery.delivery_number ?? "Unnumbered",
    distanceKm: numberValue(delivery.route?.estimated_distance_km ?? null),
    driverName: delivery.driverName,
    dropoffAddress: delivery.delivery_address ?? delivery.route?.destination_address ?? delivery.route?.destination ?? "Destination not recorded",
    dropoffLat: numberValue(delivery.delivery_latitude),
    dropoffLng: numberValue(delivery.delivery_longitude),
    durationMinutes: numberValue(delivery.route?.estimated_duration_minutes ?? null),
    pickupAddress: delivery.pickup_address ?? delivery.route?.origin_address ?? delivery.route?.origin ?? "Pickup not recorded",
    pickupLat: numberValue(delivery.pickup_latitude),
    pickupLng: numberValue(delivery.pickup_longitude),
    routePath: decodePolyline(delivery.route?.route_polyline ?? null),
    status: delivery.statusValue,
    vehicleName: delivery.vehicleName,
  };
}

function mapRecordHasCoordinates(record: DashboardMapRecord) {
  return record.pickupLat !== null && record.pickupLng !== null && record.dropoffLat !== null && record.dropoffLng !== null;
}

function routePath(record: DashboardMapRecord) {
  if (record.routePath.length > 1) return record.routePath;
  if (!mapRecordHasCoordinates(record)) return [];
  return [
    { lat: record.pickupLat as number, lng: record.pickupLng as number },
    { lat: record.dropoffLat as number, lng: record.dropoffLng as number },
  ];
}

function markerTooltip(record: DashboardMapRecord, label: "Pickup" | "Drop-off") {
  const address = label === "Pickup" ? record.pickupAddress : record.dropoffAddress;
  return `${label}\n${record.deliveryNumber}\n${record.customerName}\n${address}`;
}

function makePickupMarkerNode(color: string, selected: boolean) {
  const node = document.createElement("div");
  node.className = `grid place-items-center rounded-full border-2 border-white bg-white shadow-lg ${selected ? "h-9 w-9 ring-4 ring-purple-200/80" : "h-7 w-7"}`;
  node.innerHTML = `<span class="block rounded-full ${selected ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}"></span>`;
  const dot = node.querySelector("span");
  if (dot) (dot as HTMLElement).style.background = color;
  return node;
}

function makeDropoffMarkerNode(color: string, selected: boolean) {
  const node = document.createElement("div");
  node.className = `relative grid place-items-center rounded-full border-2 border-white text-[11px] font-black text-white shadow-lg ${selected ? "h-10 w-10 ring-4 ring-purple-200/80" : "h-8 w-8"}`;
  node.style.background = color;
  node.innerHTML = `<span>D</span><span class="absolute -bottom-1 h-2 w-2 rotate-45 border-b-2 border-r-2 border-white"></span>`;
  return node;
}

function focusMapOnRecord(map: google.maps.Map, record: DashboardMapRecord) {
  const pickup = { lat: record.pickupLat as number, lng: record.pickupLng as number };
  const dropoff = { lat: record.dropoffLat as number, lng: record.dropoffLng as number };
  map.setCenter({ lat: (pickup.lat + dropoff.lat) / 2, lng: (pickup.lng + dropoff.lng) / 2 });
  map.setZoom(12);
}

function statusMatchesFilter(delivery: DeliveryRecord, filter: DashboardFilter, driversOnShift: Set<string>, vehiclesInUse: Set<string>) {
  if (filter === "all") return true;
  if (filter === "active") return isActiveStatus(delivery.statusValue);
  if (filter === "completed") return delivery.statusValue === "delivered";
  if (filter === "exceptions") return isExceptionStatus(delivery.statusValue);
  if (filter === "drivers_on_shift") return delivery.assigned_driver_id !== null && driversOnShift.has(delivery.assigned_driver_id);
  if (filter === "vehicles_in_use") return delivery.assigned_vehicle_id !== null && vehiclesInUse.has(delivery.assigned_vehicle_id);
  return delivery.statusValue === filter;
}

function KpiCard({ label, value, detail, icon: Icon, active, onClick }: { label: string; value: number; detail: string; icon: typeof AppIcons[keyof typeof AppIcons]; active?: boolean; onClick?: () => void }) {
  return (
    <button className={`rounded-[20px] border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-purple-300 ring-2 ring-purple-100" : "border-slate-100"}`} onClick={onClick} type="button">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#17232b]">{value}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-50 text-purple-600 ring-1 ring-purple-100">
          <Icon aria-hidden size={18} weight="bold" />
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </button>
  );
}

function DriverPerformanceCard({ drivers }: { drivers: DriverPerformanceRow[] }) {
  const statusClass: Record<DriverPerformanceStatus, string> = {
    "On Shift": "bg-orange-50 text-orange-700",
    Assigned: "bg-blue-50 text-blue-700",
    Available: "bg-emerald-50 text-emerald-700",
    "Off Shift": "bg-slate-100 text-slate-700",
  };
  return (
    <AdminCard className="h-full min-h-0 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Driver Performance</h2>
          <p className="mt-1 text-xs text-slate-400">Top-performing drivers based on current delivery activity</p>
        </div>
        <Link className="shrink-0 text-xs font-semibold text-purple-700 hover:text-purple-900" href="/admin/drivers">View all drivers</Link>
      </div>
      {drivers.length ? <div className="border-t border-slate-100">
        <div className="hidden grid-cols-[2rem_minmax(0,1.7fr)_0.7fr_0.8fr_0.9fr_1fr] gap-3 bg-slate-50/70 px-5 py-2 text-[10px] font-medium uppercase text-slate-400 md:grid"><span>#</span><span>Driver</span><span>Completed</span><span>On-time</span><span>Status</span><span>Score</span></div>
        <div className="divide-y divide-slate-100">{drivers.map((driver, index) => <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-3 transition hover:bg-purple-50/30 md:grid-cols-[2rem_minmax(0,1.7fr)_0.7fr_0.8fr_0.9fr_1fr]" key={driver.driverId}>
          <span className="text-xs font-bold text-slate-400">{index + 1}</span>
          <span className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple-50 text-[10px] font-bold text-purple-700 ring-1 ring-purple-100">{driver.initials}</span><span className="truncate text-sm font-semibold text-slate-800">{driver.name}</span></span>
          <span className="hidden text-xs font-semibold text-slate-700 md:block">{driver.completed}</span>
          <span className="hidden text-xs text-slate-500 md:block">{driver.onTimeRate === null ? "Not tracked" : `${driver.onTimeRate}%`}</span>
          <span className={`hidden w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold sm:inline-flex ${statusClass[driver.status]}`}>{driver.status}</span>
          <span className="flex items-center justify-end gap-2 md:justify-start"><span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100 sm:w-16"><span className="block h-full rounded-full bg-purple-600" style={{ width: `${driver.score}%` }} /></span><strong className="w-6 text-right text-xs text-slate-700">{driver.score}</strong></span>
        </div>)}</div>
      </div> : <div className="border-t border-slate-100 px-5 py-10 text-center"><p className="text-sm font-semibold text-slate-700">No driver performance data is available for this period.</p><p className="mt-1 text-xs text-slate-500">Performance results will appear as deliveries are completed.</p></div>}
    </AdminCard>
  );
}

function DashboardSkeleton() {
  return <section className="space-y-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton className="h-28" key={index} rounded="rounded-[20px]" />)}</section>;
}

function alertTone(alert: OperationalAlert) {
  if (alert.severity === "error") return { icon: AppIcons.cancelled, className: "border-red-100 bg-red-50 text-red-600" };
  if (alert.severity === "warning") return { icon: AppIcons.warning, className: "border-amber-100 bg-amber-50 text-amber-600" };
  if (alert.severity === "success") return { icon: AppIcons.completed, className: "border-emerald-100 bg-emerald-50 text-emerald-600" };
  if (alert.module === "deliveries") return { icon: AppIcons.deliveries, className: "border-purple-100 bg-purple-50 text-purple-600" };
  if (alert.module === "vehicles") return { icon: AppIcons.vehicles, className: "border-blue-100 bg-blue-50 text-blue-600" };
  if (alert.module === "schedules") return { icon: AppIcons.schedules, className: "border-purple-100 bg-purple-50 text-purple-600" };
  if (alert.module === "routes") return { icon: AppIcons.routes, className: "border-indigo-100 bg-indigo-50 text-indigo-600" };
  if (alert.module === "drivers") return { icon: AppIcons.drivers, className: "border-violet-100 bg-violet-50 text-violet-600" };
  return { icon: AppIcons.activity, className: "border-blue-100 bg-blue-50 text-blue-600" };
}

function LegacyLiveOperationsMap({ deliveries, selectedId, onSelect }: { deliveries: DeliveryRecord[]; selectedId: string; onSelect: (id: string) => void }) {
  const geoDeliveries = deliveries.filter((delivery) => numberValue(delivery.pickup_latitude) !== null && numberValue(delivery.pickup_longitude) !== null && numberValue(delivery.delivery_latitude) !== null && numberValue(delivery.delivery_longitude) !== null);
  const bounds = geoDeliveries.flatMap((delivery) => {
    const routePoints = decodePolyline(delivery.route?.route_polyline ?? null);
    if (routePoints.length) return routePoints;
    return [
      { lat: numberValue(delivery.pickup_latitude) ?? 0, lng: numberValue(delivery.pickup_longitude) ?? 0 },
      { lat: numberValue(delivery.delivery_latitude) ?? 0, lng: numberValue(delivery.delivery_longitude) ?? 0 },
    ];
  });
  const minLat = Math.min(...bounds.map((point) => point.lat), 40.6);
  const maxLat = Math.max(...bounds.map((point) => point.lat), 41);
  const minLng = Math.min(...bounds.map((point) => point.lng), -74.2);
  const maxLng = Math.max(...bounds.map((point) => point.lng), -73.7);
  const project = (lat: number, lng: number): MapPoint => ({
    x: 5 + ((lng - minLng) / Math.max(0.0001, maxLng - minLng)) * 90,
    y: 92 - ((lat - minLat) / Math.max(0.0001, maxLat - minLat)) * 84,
  });
  const selected = deliveries.find((delivery) => delivery.delivery_id === selectedId) ?? geoDeliveries[0];

  return (
    <AdminCard className="relative min-h-[520px] overflow-hidden bg-[#f8fafc]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,.22)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.22)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute left-5 top-5 z-10">
        <h2 className="text-lg font-semibold text-[#17232b]">Live Operations Map</h2>
        <p className="mt-1 text-xs text-slate-500">{geoDeliveries.length ? `${geoDeliveries.length} mapped deliveries in scope` : "No mapped deliveries in this period"}</p>
      </div>
      <svg className="absolute inset-0 h-full w-full" role="img" aria-label="Live operations route map" preserveAspectRatio="none" viewBox="0 0 100 100">
        {geoDeliveries.map((delivery) => {
          const routePoints = decodePolyline(delivery.route?.route_polyline ?? null);
          const points = routePoints.length ? routePoints : [
            { lat: numberValue(delivery.pickup_latitude) ?? 0, lng: numberValue(delivery.pickup_longitude) ?? 0 },
            { lat: numberValue(delivery.delivery_latitude) ?? 0, lng: numberValue(delivery.delivery_longitude) ?? 0 },
          ];
          const projected = points.map((point) => project(point.lat, point.lng));
          const color = statusColors[delivery.statusValue];
          const isSelected = delivery.delivery_id === selected?.delivery_id;
          return <polyline fill="none" key={delivery.delivery_id} points={projected.map((point) => `${point.x},${point.y}`).join(" ")} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={selected && !isSelected ? 0.18 : 0.86} strokeWidth={isSelected ? 1.5 : 0.85} />;
        })}
      </svg>
      {geoDeliveries.map((delivery) => {
        const pickup = project(numberValue(delivery.pickup_latitude) ?? 0, numberValue(delivery.pickup_longitude) ?? 0);
        const dropoff = project(numberValue(delivery.delivery_latitude) ?? 0, numberValue(delivery.delivery_longitude) ?? 0);
        const active = delivery.delivery_id === selected?.delivery_id;
        return (
          <div key={delivery.delivery_id}>
            <button aria-label={`Select pickup for ${delivery.delivery_number ?? "delivery"}`} className={`absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-purple-500 shadow-lg ${active ? "ring-4 ring-purple-200" : ""}`} onClick={() => onSelect(delivery.delivery_id)} style={{ left: `${pickup.x}%`, top: `${pickup.y}%` }} type="button" />
            <button aria-label={`Select destination for ${delivery.delivery_number ?? "delivery"}`} className={`absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg ${delivery.statusValue === "delivered" ? "bg-emerald-500" : isExceptionStatus(delivery.statusValue) ? "bg-red-500" : "bg-blue-500"} ${active ? "ring-4 ring-purple-200" : ""}`} onClick={() => onSelect(delivery.delivery_id)} style={{ left: `${dropoff.x}%`, top: `${dropoff.y}%` }} type="button" />
          </div>
        );
      })}
      <div className="absolute bottom-5 left-5 z-10 w-[min(360px,calc(100%-2.5rem))] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#17232b]">{selected.delivery_number ?? "Unnumbered"}</p>
                <p className="mt-0.5 text-xs text-slate-500">{selected.customer_name ?? "Unknown customer"}</p>
              </div>
              <StatusBadge status={statusLabels[selected.statusValue]} />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-600">{shortPlace(selected.pickup_address)} → {shortPlace(selected.delivery_address)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-slate-400">Driver</dt><dd className="font-semibold text-slate-700">{selected.driverName}</dd></div>
              <div><dt className="text-slate-400">Vehicle</dt><dd className="font-semibold text-slate-700">{selected.vehicleName}</dd></div>
              <div><dt className="text-slate-400">Distance</dt><dd className="font-semibold text-slate-700">{selected.route?.estimated_distance_km ?? "N/A"} km</dd></div>
              <div><dt className="text-slate-400">Duration</dt><dd className="font-semibold text-slate-700">{selected.route?.estimated_duration_minutes ?? "N/A"} min</dd></div>
            </dl>
            <Link className="mt-3 inline-flex rounded-full border border-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50" href={`/admin/deliveries?delivery=${selected.delivery_id}`}>Open delivery</Link>
          </>
        ) : <p className="text-sm text-slate-500">Select a mapped delivery to view route details.</p>}
      </div>
      <div className="absolute bottom-5 right-5 z-10 flex flex-wrap gap-2 rounded-2xl border border-white/80 bg-white/90 p-3 text-[11px] font-semibold text-slate-500 shadow-lg">
        {(["assigned", "in_transit", "delayed", "delivered", "failed"] as DeliveryStatus[]).map((status) => <span className="inline-flex items-center gap-1.5" key={status}><span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColors[status] }} />{statusLabels[status]}</span>)}
      </div>
    </AdminCard>
  );
}

void LegacyLiveOperationsMap;

function DeliveryPreviewCard({ delivery }: { delivery: DashboardMapRecord }) {
  return (
    <div className="motion-safe:animate-[dashboard-map-card-in_200ms_ease-out]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#17232b]">{delivery.deliveryNumber}</p>
          <p className="mt-0.5 text-xs text-slate-500">{delivery.customerName}</p>
        </div>
        <StatusBadge status={statusLabels[delivery.status]} />
      </div>
      <p className="mt-3 truncate text-xs font-medium text-slate-600" title={delivery.dropoffAddress}>{delivery.dropoffAddress}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-slate-400">Driver</dt><dd className="font-semibold text-slate-700">{delivery.driverName}</dd></div>
        <div><dt className="text-slate-400">Vehicle</dt><dd className="font-semibold text-slate-700">{delivery.vehicleName}</dd></div>
        <div><dt className="text-slate-400">Distance</dt><dd className="font-semibold text-slate-700">{delivery.distanceKm !== null ? `${delivery.distanceKm} km` : "Not recorded"}</dd></div>
        <div><dt className="text-slate-400">ETA</dt><dd className="font-semibold text-slate-700">{delivery.durationMinutes !== null ? `${delivery.durationMinutes} min` : "Not recorded"}</dd></div>
      </dl>
      <Link className="mt-3 inline-flex rounded-full border border-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50" href={`/admin/deliveries?delivery=${delivery.deliveryId}`}>Open delivery</Link>
    </div>
  );
}

function LiveOperationsMap({ records, selectedId, onSelect, onInteractionChange }: { records: DashboardMapRecord[]; selectedId: string; onSelect: (id: string) => void; onInteractionChange: (active: boolean) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const librariesRef = useRef<GoogleMapsLibraries | null>(null);
  const selectedIdRef = useRef(selectedId);
  const overlaysRef = useRef<{
    listeners: google.maps.MapsEventListener[];
    records: Map<string, DashboardMapOverlay>;
  }>({ listeners: [], records: new Map() });
  const [mapState, setMapState] = useState<"initializing" | "ready" | "empty" | "error" | "not_configured">("initializing");
  const [message, setMessage] = useState("");
  const [showMapHelper, setShowMapHelper] = useState(true);
  const mapId = getGoogleMapsConfig().mapId;
  const configurationError = getGoogleMapsConfigurationError();
  const mappableRecords = useMemo(() => records.filter(mapRecordHasCoordinates), [records]);
  const selected = useMemo(
    () => mappableRecords.find((record) => record.deliveryId === selectedId) ?? mappableRecords[0] ?? null,
    [mappableRecords, selectedId],
  );

  useEffect(() => {
    selectedIdRef.current = selected?.deliveryId ?? "";
  }, [selected]);

  const clearOverlays = useCallback(() => {
    overlaysRef.current.listeners.forEach((listener) => listener.remove());
    overlaysRef.current.records.forEach((overlay) => {
      overlay.casing?.setMap(null);
      overlay.routeLine?.setMap(null);
      overlay.pickupMarker.map = null;
      overlay.dropoffMarker.map = null;
    });
    overlaysRef.current = { listeners: [], records: new Map() };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowMapHelper(false), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (configurationError) {
      queueMicrotask(() => {
        setMapState("not_configured");
        setMessage(configurationError);
      });
      return;
    }

    let cancelled = false;

    async function initializeMap() {
      if (!containerRef.current) return;
      setMapState("initializing");
      setMessage("");

      try {
        const libraries = await loadGoogleMapsLibraries();
        if (cancelled || !containerRef.current) return;
        librariesRef.current = libraries;
        mapRef.current = new libraries.maps.Map(containerRef.current, {
          center: WESTCHESTER_DEFAULT_CENTER,
          clickableIcons: false,
          disableDefaultUI: true,
          fullscreenControl: false,
          gestureHandling: "cooperative",
          keyboardShortcuts: false,
          mapId,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: WESTCHESTER_DEFAULT_ZOOM,
          zoomControl: false,
        });
        setMapState("ready");
      } catch {
        if (!cancelled) {
          setMapState("error");
          setMessage("Unable to load Google Maps.");
        }
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;
      clearOverlays();
      mapRef.current = null;
    };
  }, [clearOverlays, configurationError, mapId]);

  useEffect(() => {
    const map = mapRef.current;
    const libraries = librariesRef.current;
    if (!map || !libraries) return;

    clearOverlays();

    if (!mappableRecords.length) {
      map.setCenter(WESTCHESTER_DEFAULT_CENTER);
      map.setZoom(WESTCHESTER_DEFAULT_ZOOM);
      queueMicrotask(() => {
        setMapState("empty");
        setMessage(records.length ? "Deliveries in scope need pickup and drop-off coordinates before they can appear on the map." : "No deliveries match the current dashboard filters.");
      });
      return;
    }

    queueMicrotask(() => {
      setMapState("ready");
      setMessage("");
    });

    for (const record of mappableRecords) {
      const color = statusColors[record.status];
      const path = routePath(record);
      let casing: google.maps.Polyline | null = null;
      let routeLine: google.maps.Polyline | null = null;

      if (path.length > 1) {
        casing = new google.maps.Polyline({
          clickable: true,
          map,
          path,
          strokeColor: "#ffffff",
          strokeOpacity: 0.9,
          strokeWeight: 7,
          zIndex: 10,
        });
        routeLine = new google.maps.Polyline({
          clickable: true,
          icons: [],
          map,
          path,
          strokeColor: color,
          strokeOpacity: 0.78,
          strokeWeight: 4,
          zIndex: 20,
        });
        overlaysRef.current.listeners.push(
          casing.addListener("click", () => onSelect(record.deliveryId)),
          routeLine.addListener("click", () => onSelect(record.deliveryId)),
          routeLine.addListener("mouseover", () => {
            const active = selectedIdRef.current === record.deliveryId;
            routeLine?.setOptions({ strokeOpacity: 1, strokeWeight: active ? 6 : 5 });
            casing?.setOptions({ strokeOpacity: 0.95, strokeWeight: active ? 11 : 8 });
          }),
          routeLine.addListener("mouseout", () => {
            const active = selectedIdRef.current === record.deliveryId;
            const dimmed = Boolean(selectedIdRef.current && !active);
            routeLine?.setOptions({ strokeOpacity: dimmed ? 0.28 : active ? 1 : 0.78, strokeWeight: active ? 5 : 4 });
            casing?.setOptions({ strokeOpacity: dimmed ? 0.34 : 0.9, strokeWeight: active ? 10 : 7 });
          }),
        );
      }

      const pickupMarker = new libraries.marker.AdvancedMarkerElement({
        content: makePickupMarkerNode(color, false),
        map,
        position: { lat: record.pickupLat as number, lng: record.pickupLng as number },
        title: markerTooltip(record, "Pickup"),
        zIndex: 20,
      });
      const dropoffMarker = new libraries.marker.AdvancedMarkerElement({
        content: makeDropoffMarkerNode(color, false),
        map,
        position: { lat: record.dropoffLat as number, lng: record.dropoffLng as number },
        title: markerTooltip(record, "Drop-off"),
        zIndex: 21,
      });
      overlaysRef.current.records.set(record.deliveryId, { casing, dropoffMarker, pickupMarker, record, routeLine });
      overlaysRef.current.listeners.push(
        pickupMarker.addListener("click", () => onSelect(record.deliveryId)),
        dropoffMarker.addListener("click", () => onSelect(record.deliveryId)),
      );
    }

    const initialRecord = mappableRecords.find((record) => record.deliveryId === selectedIdRef.current) ?? mappableRecords[0];
    focusMapOnRecord(map, initialRecord);
  }, [clearOverlays, mapState, mappableRecords, onSelect, records.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !overlaysRef.current.records.size) return;

    overlaysRef.current.records.forEach((overlay, deliveryId) => {
      const active = deliveryId === selected?.deliveryId;
      const dimmed = Boolean(selected && !active);
      const color = statusColors[overlay.record.status];
      const selectedIcons = active ? [{
        icon: {
          fillColor: color,
          fillOpacity: 0.75,
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 2.4,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 1.5,
        },
        offset: "28%",
        repeat: "120px",
      }] : [];

      overlay.casing?.setOptions({ strokeOpacity: dimmed ? 0.34 : 0.9, strokeWeight: active ? 10 : 7, zIndex: active ? 40 : 10 });
      overlay.routeLine?.setOptions({ icons: selectedIcons, strokeOpacity: dimmed ? 0.28 : active ? 1 : 0.78, strokeWeight: active ? 5 : 4, zIndex: active ? 50 : 20 });
      overlay.pickupMarker.content = makePickupMarkerNode(color, active);
      overlay.pickupMarker.zIndex = active ? 80 : dimmed ? 5 : 20;
      overlay.dropoffMarker.content = makeDropoffMarkerNode(color, active);
      overlay.dropoffMarker.zIndex = active ? 81 : dimmed ? 6 : 21;
    });

    if (selected?.dropoffLat !== null && selected?.dropoffLng !== null) {
      map.panTo({ lat: selected.dropoffLat, lng: selected.dropoffLng });
    }
  }, [selected]);

  const showMessage = mapState === "empty" || mapState === "error" || mapState === "not_configured";
  const mapGlassCard = "border border-white/70 bg-white/72 shadow-[0_22px_70px_-30px_rgba(15,23,42,.55),0_0_0_1px_rgba(255,255,255,.42)] ring-1 ring-purple-100/40 backdrop-blur-2xl";

  return (
    <div
      className="min-w-0"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onInteractionChange(false);
      }}
      onFocusCapture={() => onInteractionChange(true)}
      onMouseEnter={() => {
        setShowMapHelper(false);
        onInteractionChange(true);
      }}
      onMouseLeave={() => onInteractionChange(false)}
      onPointerCancel={() => onInteractionChange(false)}
      onPointerDown={() => onInteractionChange(true)}
      onPointerUp={(event) => {
        if (event.pointerType !== "mouse") onInteractionChange(false);
      }}
    >
    <AdminCard className="relative h-[520px] min-h-[500px] max-h-[540px] overflow-hidden bg-[#edf4f3] p-0">
      <div
        className="absolute inset-0"
        ref={containerRef}
      />
      {mapState === "initializing" ? <Skeleton className="absolute inset-0 h-full w-full rounded-none" /> : null}
      <div className={`absolute left-5 top-5 z-10 rounded-2xl px-4 py-3 ${mapGlassCard}`}>
        <h2 className="text-lg font-semibold text-[#17232b]">Live Operations Map</h2>
        <p className="mt-1 text-xs text-slate-500">
          {mappableRecords.length ? `${mappableRecords.length} mapped deliveries in scope` : "No mapped deliveries in this view"}
        </p>
      </div>
      <div className={`pointer-events-none absolute right-5 top-5 z-10 rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition-opacity duration-300 ${mapGlassCard} ${showMapHelper ? "opacity-100" : "opacity-0"}`}>
        Use ctrl + scroll to zoom the map
      </div>
      {showMessage ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/35 backdrop-blur-[2px]">
          <div className={`max-w-md rounded-[20px] p-5 text-center ${mapGlassCard}`}>
            <p className="font-semibold text-slate-800">{message}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">The dashboard keeps the delivery data visible while waiting for valid route coordinates.</p>
          </div>
        </div>
      ) : null}
      <div className={`absolute bottom-5 left-5 z-10 w-[min(380px,calc(100%-2.5rem))] rounded-2xl p-4 ${mapGlassCard}`}>
        {selected ? (
          <DeliveryPreviewCard delivery={selected} key={selected.deliveryId} />
        ) : <p className="text-sm text-slate-500">Select a mapped delivery to view route details.</p>}
      </div>
      <div className={`absolute bottom-5 right-5 z-10 hidden max-w-[320px] flex-wrap gap-2 rounded-2xl p-3 text-[11px] font-semibold text-slate-500 md:flex ${mapGlassCard}`}>
        {(["assigned", "in_transit", "delayed", "delivered", "failed"] as DeliveryStatus[]).map((status) => <span className="inline-flex items-center gap-1.5" key={status}><span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColors[status] }} />{statusLabels[status]}</span>)}
      </div>
      <style>{`@keyframes dashboard-map-card-in { from { opacity: .45; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </AdminCard>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [scope, setScope] = useState<DateScope>("today");
  const [filter, setFilter] = useState<DashboardFilter>("active");
  const [routesData, setRoutesData] = useState<RoutesApiData | null>(null);
  const [notifications, setNotifications] = useState<OperationalAlert[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [isMapInteractionActive, setIsMapInteractionActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rotationResumeTimeoutRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [routePayload, notificationPayload] = await Promise.all([
        fetchAdministratorJson<RoutesApiData>("/api/admin/routes"),
        fetchAdministratorJson<OperationalAlertsResponse>("/api/admin/notifications?limit=12&status=unresolved").catch(() => ({ notifications: [], alerts: [], unreadCount: 0, unresolvedCount: 0 })),
      ]);
      setRoutesData(routePayload);
      setNotifications(notificationPayload.notifications);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load dashboard data.");
      setRoutesData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void loadData()); }, [loadData]);

  const handleMapInteractionChange = useCallback((active: boolean) => {
    if (rotationResumeTimeoutRef.current !== null) {
      window.clearTimeout(rotationResumeTimeoutRef.current);
      rotationResumeTimeoutRef.current = null;
    }
    if (active) {
      setIsMapInteractionActive(true);
      return;
    }
    rotationResumeTimeoutRef.current = window.setTimeout(() => {
      setIsMapInteractionActive(false);
      rotationResumeTimeoutRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => () => {
    if (rotationResumeTimeoutRef.current !== null) window.clearTimeout(rotationResumeTimeoutRef.current);
  }, []);

  const dashboard = useMemo(() => {
    const data = routesData ?? { routes: [], deliveries: [], deliveryHistory: [], drivers: [], profiles: [], vehicles: [], schedules: [] };
    const driverMap = new Map(data.drivers.map((driver) => [driver.driver_id, driver]));
    const profileMap = new Map(data.profiles.map((profile) => [profile.profile_id, profile]));
    const vehicleMap = new Map(data.vehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]));
    const routeMap = new Map(data.routes.filter((route) => route.delivery_id).map((route) => [route.delivery_id as string, route]));
    const scopedDeliveries = data.deliveries.filter((delivery) => {
      const status = normalizeStatus(delivery.status);
      if (scope === "today") return isActiveStatus(status) || inRange(delivery.updated_at, scope);
      return isActiveStatus(status) || inRange(delivery.updated_at, scope);
    }).map((delivery) => {
      const driver = delivery.assigned_driver_id ? driverMap.get(delivery.assigned_driver_id) : undefined;
      const profile = driver?.user_id ? profileMap.get(driver.user_id) : undefined;
      const vehicle = delivery.assigned_vehicle_id ? vehicleMap.get(delivery.assigned_vehicle_id) : undefined;
      return { ...delivery, statusValue: normalizeStatus(delivery.status), driverName: profileName(profile), vehicleName: vehicleName(vehicle), route: routeMap.get(delivery.delivery_id) ?? null } satisfies DeliveryRecord;
    });
    const scopedSchedules = data.schedules.filter((schedule) => schedule.status !== "cancelled" && overlapsRange(schedule.start_time, schedule.end_time, scope));
    const now = dateRange(scope).now;
    const activeSchedules = scopedSchedules.filter((schedule) => schedule.start_time && schedule.end_time && new Date(schedule.start_time) <= now && new Date(schedule.end_time) > now);
    const activeDeliveries = scopedDeliveries.filter((delivery) => isActiveStatus(delivery.statusValue));
    const activeShiftDriverIds = new Set(activeSchedules.map((schedule) => schedule.driver_id).filter((id): id is string => Boolean(id)));
    const assignedDriverIds = new Set(activeDeliveries.map((delivery) => delivery.assigned_driver_id).filter((id): id is string => Boolean(id)));
    const terminalTimestampByDelivery = new Map<string, string>();
    data.deliveryHistory.forEach((event) => {
      if (event.created_at && !terminalTimestampByDelivery.has(event.delivery_id)) terminalTimestampByDelivery.set(event.delivery_id, event.created_at);
    });
    const performanceDeliveries = data.deliveries.filter((delivery) => {
      if (!delivery.assigned_driver_id || !["delivered", "failed", "returned"].includes(normalizeStatus(delivery.status))) return false;
      return inRange(terminalTimestampByDelivery.get(delivery.delivery_id) ?? delivery.updated_at, scope);
    });
    const driverPerformance = data.drivers.flatMap((driver): DriverPerformanceRow[] => {
      const activity = performanceDeliveries.filter((delivery) => delivery.assigned_driver_id === driver.driver_id);
      if (!activity.length) return [];
      const completed = activity.filter((delivery) => normalizeStatus(delivery.status) === "delivered").length;
      const exceptions = activity.filter((delivery) => ["failed", "returned"].includes(normalizeStatus(delivery.status))).length;
      const completionScore = Math.min(completed / 10, 1) * 100;
      const score = Math.max(0, Math.min(100, Math.round(completionScore - exceptions * 10)));
      const profile = driver.user_id ? profileMap.get(driver.user_id) : undefined;
      const name = profileName(profile);
      const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "DR";
      const status: DriverPerformanceStatus = activeShiftDriverIds.has(driver.driver_id)
        ? "On Shift"
        : assignedDriverIds.has(driver.driver_id)
          ? "Assigned"
          : profile?.is_active === true && driver.availability === "available"
            ? "Available"
            : "Off Shift";
      return [{ completed, driverId: driver.driver_id, initials, name, onTimeRate: null, score, status }];
    }).sort((left, right) => right.score - left.score || right.completed - left.completed || left.name.localeCompare(right.name)).slice(0, 5);
    const vehiclesInUse = new Set<string>([...scopedSchedules.map((schedule) => schedule.vehicle_id).filter((id): id is string => Boolean(id)), ...activeDeliveries.map((delivery) => delivery.assigned_vehicle_id).filter((id): id is string => Boolean(id))]);
    const driversOnShift = new Set<string>((scope === "today" ? activeSchedules : scopedSchedules).map((schedule) => schedule.driver_id).filter((id): id is string => Boolean(id)));
    const visibleDeliveries = scopedDeliveries.filter((delivery) => statusMatchesFilter(delivery, filter, driversOnShift, vehiclesInUse));
    const mapRecords = visibleDeliveries.map(mapRecordFromDelivery);
    const statusCounts = scopedDeliveries.reduce<Record<DeliveryStatus, number>>((counts, delivery) => ({ ...counts, [delivery.statusValue]: (counts[delivery.statusValue] ?? 0) + 1 }), { pending: 0, assigned: 0, in_transit: 0, delivered: 0, delayed: 0, failed: 0, returned: 0 });
    const conflictCount = scopedSchedules.filter((schedule, index) => scopedSchedules.some((other, otherIndex) => otherIndex > index && schedule.start_time && schedule.end_time && other.start_time && other.end_time && (schedule.driver_id === other.driver_id || Boolean(schedule.vehicle_id && schedule.vehicle_id === other.vehicle_id)) && new Date(schedule.start_time) < new Date(other.end_time) && new Date(other.start_time) < new Date(schedule.end_time))).length;
    const issuePriority: Record<DashboardIssue["severity"], number> = { critical: 0, warning: 1, info: 2 };
    const allIssues: DashboardIssue[] = [
      ...scopedDeliveries.filter((delivery) => isExceptionStatus(delivery.statusValue)).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Delivery", message: `${delivery.delivery_number ?? "Delivery"} is ${statusLabels[delivery.statusValue].toLowerCase()}.`, severity: delivery.statusValue === "delayed" ? "warning" : "critical", href: `/admin/deliveries?delivery=${delivery.delivery_id}`, createdAt: delivery.updated_at })),
      ...scopedDeliveries.filter((delivery) => !delivery.assigned_driver_id).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Delivery", message: `${delivery.delivery_number ?? "Delivery"} has no assigned driver.`, severity: "warning", href: `/admin/deliveries?delivery=${delivery.delivery_id}`, createdAt: delivery.updated_at })),
      ...scopedDeliveries.filter((delivery) => !delivery.assigned_vehicle_id).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Delivery", message: `${delivery.delivery_number ?? "Delivery"} has no assigned vehicle.`, severity: "warning", href: `/admin/deliveries?delivery=${delivery.delivery_id}`, createdAt: delivery.updated_at })),
      ...scopedDeliveries.filter((delivery) => !delivery.route).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Route", message: `${delivery.delivery_number ?? "Delivery"} does not have a generated route.`, severity: "info", href: "/admin/routes", createdAt: delivery.updated_at })),
      ...scopedDeliveries.filter((delivery) => !deliveryHasCoordinates(delivery)).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Map data", message: `${delivery.delivery_number ?? "Delivery"} needs pickup and drop-off coordinates.`, severity: "info", href: `/admin/deliveries?delivery=${delivery.delivery_id}`, createdAt: delivery.updated_at })),
      ...data.vehicles.filter((vehicle) => ["maintenance_due", "out_of_service"].includes(vehicle.status ?? "")).map((vehicle): DashboardIssue => ({ label: "Vehicle", message: `${vehicleName(vehicle)} is ${String(vehicle.status).replaceAll("_", " ")}.`, severity: vehicle.status === "out_of_service" ? "critical" : "warning", href: `/admin/vehicles?vehicle=${vehicle.vehicle_id}`, createdAt: null })),
    ].sort((left, right) => {
      const priorityDifference = issuePriority[left.severity] - issuePriority[right.severity];
      if (priorityDifference !== 0) return priorityDifference;
      return (right.createdAt ? Date.parse(right.createdAt) || 0 : 0) - (left.createdAt ? Date.parse(left.createdAt) || 0 : 0);
    });
    return { scopedDeliveries, visibleDeliveries, mapRecords, scopedSchedules, activeSchedules, driversOnShift, vehiclesInUse, statusCounts, conflictCount, driverPerformance, issues: allIssues.slice(0, 5), issueCount: allIssues.length };
  }, [filter, routesData, scope]);

  const rotatingDeliveryIds = useMemo(
    () => dashboard.mapRecords
      .filter((record) => mapRecordHasCoordinates(record) && ["pending", "assigned", "in_transit", "delayed"].includes(record.status))
      .map((record) => record.deliveryId),
    [dashboard.mapRecords],
  );

  useEffect(() => {
    const mappableIds = dashboard.mapRecords.filter(mapRecordHasCoordinates).map((record) => record.deliveryId);
    if (!selectedDeliveryId || !mappableIds.includes(selectedDeliveryId)) {
      queueMicrotask(() => setSelectedDeliveryId(rotatingDeliveryIds[0] ?? mappableIds[0] ?? ""));
    }
  }, [dashboard.mapRecords, rotatingDeliveryIds, selectedDeliveryId]);

  useEffect(() => {
    if (isMapInteractionActive || rotatingDeliveryIds.length <= 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setSelectedDeliveryId((current) => {
        const currentIndex = rotatingDeliveryIds.indexOf(current);
        return rotatingDeliveryIds[(currentIndex + 1 + rotatingDeliveryIds.length) % rotatingDeliveryIds.length];
      });
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isMapInteractionActive, rotatingDeliveryIds]);

  if (loading) return <DashboardSkeleton />;

  const recentDeliveries = [...dashboard.visibleDeliveries].sort((left, right) => (right.updated_at ?? "").localeCompare(left.updated_at ?? "")).slice(0, 6);
  const activity = notifications.slice(0, 5);

  return (
    <section className="space-y-5 text-[#17232b]">
      <AdminPageIntro
        actions={<><div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">{(["today", "week", "month"] as DateScope[]).map((item) => <button className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${scope === item ? "bg-purple-600 text-white" : "text-slate-500 hover:bg-purple-50 hover:text-purple-700"}`} key={item} onClick={() => { setScope(item); setFilter("all"); }} type="button">{item === "today" ? "Today" : item === "week" ? "This Week" : "This Month"}</button>)}</div><SecondaryButton onClick={() => void loadData()} type="button"><AppIcons.refresh aria-hidden size={15} weight="bold" />Refresh</SecondaryButton><PrimaryActionLink href="/admin/deliveries?action=create">Add Delivery</PrimaryActionLink></>}
        description="Real-time view of deliveries, routes, drivers, vehicles, and scheduling activity."
        eyebrow="Operations control center"
        title="Operations Dashboard"
      />
      {error ? <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard active={filter === "active"} detail="Assigned, in transit, or delayed" icon={AppIcons.deliveries} label="Active Deliveries" onClick={() => setFilter(filter === "active" ? "all" : "active")} value={dashboard.scopedDeliveries.filter((delivery) => isActiveStatus(delivery.statusValue)).length} />
        <KpiCard active={filter === "in_transit"} detail="Currently moving" icon={AppIcons.navigation} label="In Transit" onClick={() => setFilter(filter === "in_transit" ? "all" : "in_transit")} value={dashboard.statusCounts.in_transit} />
        <KpiCard active={filter === "completed"} detail={`Delivered in ${scope === "today" ? "today" : scope === "week" ? "this week" : "this month"}`} icon={AppIcons.completed} label="Completed" onClick={() => setFilter(filter === "completed" ? "all" : "completed")} value={dashboard.statusCounts.delivered} />
        <KpiCard active={filter === "exceptions"} detail="Delayed, failed, or returned" icon={AppIcons.warning} label="Delayed / Exceptions" onClick={() => setFilter(filter === "exceptions" ? "all" : "exceptions")} value={dashboard.statusCounts.delayed + dashboard.statusCounts.failed + dashboard.statusCounts.returned} />
        <KpiCard active={filter === "drivers_on_shift"} detail={scope === "today" ? "Active shifts now" : "Scheduled in scope" } icon={AppIcons.drivers} label="Drivers On Shift" onClick={() => setFilter(filter === "drivers_on_shift" ? "all" : "drivers_on_shift")} value={dashboard.driversOnShift.size} />
        <KpiCard active={filter === "vehicles_in_use"} detail="Assigned to active work" icon={AppIcons.vehicles} label="Vehicles In Use" onClick={() => setFilter(filter === "vehicles_in_use" ? "all" : "vehicles_in_use")} value={dashboard.vehiclesInUse.size} />
      </div>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-5">
          <LiveOperationsMap onInteractionChange={handleMapInteractionChange} records={dashboard.mapRecords} onSelect={setSelectedDeliveryId} selectedId={selectedDeliveryId} />
          <AdminCard className="overflow-hidden"><div className="flex items-center justify-between px-5 py-4"><div><h2 className="text-lg font-semibold">Recent Deliveries</h2><p className="mt-1 text-xs text-slate-400">Most recent operational activity in scope</p></div><Link className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-purple-50 hover:text-purple-700" href="/admin/deliveries">View all</Link></div>{recentDeliveries.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-y border-slate-100 bg-slate-50/70 text-left text-xs text-slate-400"><tr><th className="px-5 py-3 font-medium">Delivery</th><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Route</th><th className="px-5 py-3 font-medium">Driver</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Updated</th><th className="px-5 py-3 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{recentDeliveries.map((delivery) => <tr className="hover:bg-purple-50/30" key={delivery.delivery_id}><td className="px-5 py-4 font-semibold text-purple-700">{delivery.delivery_number ?? "Unnumbered"}</td><td className="px-5 py-4 text-slate-600">{delivery.customer_name ?? "Unknown"}</td><td className="px-5 py-4 text-slate-500">{shortPlace(delivery.pickup_address)} → {shortPlace(delivery.delivery_address)}</td><td className="px-5 py-4 text-slate-500">{delivery.driverName}</td><td className="px-5 py-4"><StatusBadge status={statusLabels[delivery.statusValue]} /></td><td className="px-5 py-4 text-slate-500">{formatDate(delivery.updated_at)}</td><td className="px-5 py-4 text-right"><Link className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-purple-50 hover:text-purple-700" href={`/admin/deliveries?delivery=${delivery.delivery_id}`}>View</Link></td></tr>)}</tbody></table></div> : <p className="px-5 py-12 text-center text-sm text-slate-500">No recent deliveries in this period.</p>}</AdminCard>
          <DriverPerformanceCard drivers={dashboard.driverPerformance} />
        </div>
        <aside className="grid grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-5">
          <AdminCard className="p-5"><h2 className="text-lg font-semibold">Schedule Snapshot</h2><dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{[["Scheduled shifts", dashboard.scopedSchedules.length], ["Active shift", dashboard.activeSchedules.length], ["Conflicts", dashboard.conflictCount], ["Cancelled shifts", 0]].map(([label, value]) => <div className="rounded-2xl bg-slate-50 p-3" key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd></div>)}</dl></AdminCard>
          <AdminCard className="p-5"><h2 className="text-lg font-semibold">Delivery Status Breakdown</h2><p className="mt-1 text-xs text-slate-400">{dashboard.scopedDeliveries.length} deliveries in scope</p><div className="mt-4 space-y-2">{(Object.keys(statusLabels) as DeliveryStatus[]).filter((status) => dashboard.statusCounts[status] > 0).map((status) => <button className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${filter === status ? "bg-purple-50 ring-1 ring-purple-100" : "hover:bg-slate-50"}`} key={status} onClick={() => setFilter(filter === status ? "all" : status)} type="button"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColors[status] }} />{statusLabels[status]}</span><strong>{dashboard.statusCounts[status]}</strong></button>)}{dashboard.scopedDeliveries.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No deliveries in this period.</p> : null}</div></AdminCard>
          <AdminCard className="p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Attention Needed</h2>{dashboard.issueCount > 5 ? <Link className="text-xs font-semibold text-purple-700 hover:text-purple-900" href="/admin/deliveries">View all</Link> : null}</div><div className="mt-4 space-y-2">{dashboard.issues.length ? dashboard.issues.map((issue, index) => <button className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 px-3 py-2.5 text-left transition hover:bg-purple-50/50" key={`${issue.href}-${index}`} onClick={() => { const mappableIssue = issue.deliveryId ? dashboard.mapRecords.find((record) => record.deliveryId === issue.deliveryId && mapRecordHasCoordinates(record)) : null; if (mappableIssue) setSelectedDeliveryId(mappableIssue.deliveryId); else router.push(issue.href); }} type="button"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${issue.severity === "critical" ? "bg-red-50 text-red-600" : issue.severity === "warning" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}><AppIcons.warning aria-hidden size={14} weight="bold" /></span><span><span className="text-xs font-bold uppercase tracking-wide text-slate-400">{issue.label}</span><span className="mt-0.5 block text-sm font-semibold text-slate-700">{issue.message}</span></span></button>) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No urgent operational issues.</p>}</div></AdminCard>
          <AdminCard className="h-full p-5"><div><h2 className="text-lg font-semibold">Recent Alerts / Activity</h2><p className="mt-1 text-xs text-slate-400">Highest-priority unresolved operational alerts</p></div><div className="mt-4 space-y-2">{activity.length ? activity.map((alert) => { const tone = alertTone(alert); const Icon = tone.icon; return <article className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 px-3 py-2.5 text-left transition hover:bg-purple-50/50" key={alert.id}><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl border ${tone.className}`}><Icon aria-hidden size={16} weight="bold" /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-800">{alert.title}</span><span className="shrink-0 text-[10px] text-slate-400">{relativeTime(alert.createdAt)}</span></span><span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-500">{alert.message}</span></span></article>; }) : <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600"><AppIcons.completed aria-hidden size={18} weight="bold" /></span><p className="mt-3 text-sm font-semibold text-slate-800">No active alerts</p><p className="mt-1 text-xs text-slate-500">Operations are currently clear.</p></div>}</div></AdminCard>
        </aside>
      </div>
    </section>
  );
}
