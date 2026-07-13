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
type RoutesApiData = { routes: RouteRow[]; deliveries: DeliveryRow[]; drivers: DriverRow[]; profiles: ProfileRow[]; vehicles: VehicleRow[]; schedules: ScheduleRow[] };
type NotificationRow = { notification_id: string; delivery_id: string | null; notification_type: string | null; title: string | null; message: string | null; status: string | null; unread?: boolean; created_at: string | null; sent_at: string | null };
type NotificationsApiData = { notifications: NotificationRow[]; unreadCount: number };
type DeliveryRecord = DeliveryRow & { statusValue: DeliveryStatus; driverName: string; vehicleName: string; route: RouteRow | null };
type MapPoint = { x: number; y: number };
type DashboardIssue = { label: string; message: string; severity: "critical" | "warning" | "info"; href: string; deliveryId?: string };
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

function fitMapToRecords(map: google.maps.Map, records: DashboardMapRecord[]) {
  const bounds = new google.maps.LatLngBounds();
  for (const record of records) {
    for (const point of routePath(record)) bounds.extend(point);
  }
  if (bounds.isEmpty()) {
    map.setCenter(WESTCHESTER_DEFAULT_CENTER);
    map.setZoom(WESTCHESTER_DEFAULT_ZOOM);
    return;
  }
  map.fitBounds(bounds, { bottom: 156, left: 72, right: 72, top: 96 });
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

function DashboardSkeleton() {
  return <section className="space-y-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton className="h-28" key={index} rounded="rounded-[20px]" />)}</section>;
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

function LiveOperationsMap({ records, selectedId, onSelect }: { records: DashboardMapRecord[]; selectedId: string; onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const librariesRef = useRef<GoogleMapsLibraries | null>(null);
  const overlaysRef = useRef<{
    listeners: google.maps.MapsEventListener[];
    markers: google.maps.marker.AdvancedMarkerElement[];
    polylines: google.maps.Polyline[];
  }>({ listeners: [], markers: [], polylines: [] });
  const [mapState, setMapState] = useState<"initializing" | "ready" | "empty" | "error" | "not_configured">("initializing");
  const [message, setMessage] = useState("");
  const mapId = getGoogleMapsConfig().mapId;
  const configurationError = getGoogleMapsConfigurationError();
  const mappableRecords = useMemo(() => records.filter(mapRecordHasCoordinates), [records]);
  const selected = useMemo(
    () => mappableRecords.find((record) => record.deliveryId === selectedId) ?? mappableRecords[0] ?? null,
    [mappableRecords, selectedId],
  );

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
      overlaysRef.current.listeners.forEach((listener) => listener.remove());
      overlaysRef.current.polylines.forEach((polyline) => polyline.setMap(null));
      overlaysRef.current.markers.forEach((marker) => {
        marker.map = null;
      });
      overlaysRef.current = { listeners: [], markers: [], polylines: [] };
      mapRef.current = null;
    };
  }, [configurationError, mapId]);

  useEffect(() => {
    const map = mapRef.current;
    const libraries = librariesRef.current;
    if (!map || !libraries) return;

    overlaysRef.current.listeners.forEach((listener) => listener.remove());
    overlaysRef.current.polylines.forEach((polyline) => polyline.setMap(null));
    overlaysRef.current.markers.forEach((marker) => {
      marker.map = null;
    });
    overlaysRef.current = { listeners: [], markers: [], polylines: [] };

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
      const selectedRecord = record.deliveryId === selected?.deliveryId;
      const dimmed = Boolean(selected && !selectedRecord);
      const color = statusColors[record.status];
      const path = routePath(record);

      if (path.length > 1) {
        const casing = new google.maps.Polyline({
          clickable: true,
          map,
          path,
          strokeColor: "#ffffff",
          strokeOpacity: dimmed ? 0.34 : 0.9,
          strokeWeight: selectedRecord ? 10 : 7,
          zIndex: selectedRecord ? 40 : 10,
        });
        const routeLine = new google.maps.Polyline({
          clickable: true,
          icons: selectedRecord ? [{
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
          }] : [],
          map,
          path,
          strokeColor: color,
          strokeOpacity: dimmed ? 0.28 : selectedRecord ? 1 : 0.78,
          strokeWeight: selectedRecord ? 5 : 4,
          zIndex: selectedRecord ? 50 : 20,
        });
        overlaysRef.current.polylines.push(casing, routeLine);
        overlaysRef.current.listeners.push(
          casing.addListener("click", () => onSelect(record.deliveryId)),
          routeLine.addListener("click", () => onSelect(record.deliveryId)),
          routeLine.addListener("mouseover", () => {
            routeLine.setOptions({ strokeOpacity: 1, strokeWeight: selectedRecord ? 6 : 5 });
            casing.setOptions({ strokeOpacity: 0.95, strokeWeight: selectedRecord ? 11 : 8 });
          }),
          routeLine.addListener("mouseout", () => {
            routeLine.setOptions({ strokeOpacity: dimmed ? 0.28 : selectedRecord ? 1 : 0.78, strokeWeight: selectedRecord ? 5 : 4 });
            casing.setOptions({ strokeOpacity: dimmed ? 0.34 : 0.9, strokeWeight: selectedRecord ? 10 : 7 });
          }),
        );
      }

      const pickupMarker = new libraries.marker.AdvancedMarkerElement({
        content: makePickupMarkerNode(color, selectedRecord),
        map,
        position: { lat: record.pickupLat as number, lng: record.pickupLng as number },
        title: markerTooltip(record, "Pickup"),
        zIndex: selectedRecord ? 80 : dimmed ? 5 : 20,
      });
      const dropoffMarker = new libraries.marker.AdvancedMarkerElement({
        content: makeDropoffMarkerNode(color, selectedRecord),
        map,
        position: { lat: record.dropoffLat as number, lng: record.dropoffLng as number },
        title: markerTooltip(record, "Drop-off"),
        zIndex: selectedRecord ? 81 : dimmed ? 6 : 21,
      });
      overlaysRef.current.markers.push(pickupMarker, dropoffMarker);
      overlaysRef.current.listeners.push(
        pickupMarker.addListener("click", () => onSelect(record.deliveryId)),
        dropoffMarker.addListener("click", () => onSelect(record.deliveryId)),
      );
    }

    fitMapToRecords(map, selected ? [selected] : mappableRecords);
  }, [mappableRecords, onSelect, records.length, selected]);

  const showMessage = mapState === "empty" || mapState === "error" || mapState === "not_configured";

  return (
    <AdminCard className="relative min-h-[520px] overflow-hidden bg-[#edf4f3] p-0">
      <div className="absolute inset-0" ref={containerRef} />
      {mapState === "initializing" ? <Skeleton className="absolute inset-0 h-full w-full rounded-none" /> : null}
      <div className="absolute left-5 top-5 z-10 rounded-2xl border border-white/80 bg-white/92 px-4 py-3 shadow-lg backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-[#17232b]">Live Operations Map</h2>
        <p className="mt-1 text-xs text-slate-500">
          {mappableRecords.length ? `${mappableRecords.length} mapped deliveries in scope` : "No mapped deliveries in this view"}
        </p>
      </div>
      {showMessage ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/35 backdrop-blur-[2px]">
          <div className="max-w-md rounded-[20px] border border-white/80 bg-white/95 p-5 text-center shadow-[0_18px_48px_-28px_rgba(15,23,42,.35)]">
            <p className="font-semibold text-slate-800">{message}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">The dashboard keeps the delivery data visible while waiting for valid route coordinates.</p>
          </div>
        </div>
      ) : null}
      <div className="absolute bottom-5 left-5 z-10 w-[min(380px,calc(100%-2.5rem))] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur-xl">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#17232b]">{selected.deliveryNumber}</p>
                <p className="mt-0.5 text-xs text-slate-500">{selected.customerName}</p>
              </div>
              <StatusBadge status={statusLabels[selected.status]} />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-600">{shortPlace(selected.pickupAddress)} -&gt; {shortPlace(selected.dropoffAddress)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-slate-400">Driver</dt><dd className="font-semibold text-slate-700">{selected.driverName}</dd></div>
              <div><dt className="text-slate-400">Vehicle</dt><dd className="font-semibold text-slate-700">{selected.vehicleName}</dd></div>
              <div><dt className="text-slate-400">Distance</dt><dd className="font-semibold text-slate-700">{selected.distanceKm !== null ? `${selected.distanceKm} km` : "Not recorded"}</dd></div>
              <div><dt className="text-slate-400">Duration</dt><dd className="font-semibold text-slate-700">{selected.durationMinutes !== null ? `${selected.durationMinutes} min` : "Not recorded"}</dd></div>
            </dl>
            <Link className="mt-3 inline-flex rounded-full border border-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50" href={`/admin/deliveries?delivery=${selected.deliveryId}`}>Open delivery</Link>
          </>
        ) : <p className="text-sm text-slate-500">Select a mapped delivery to view route details.</p>}
      </div>
      <div className="absolute bottom-5 right-5 z-10 hidden max-w-[320px] flex-wrap gap-2 rounded-2xl border border-white/80 bg-white/90 p-3 text-[11px] font-semibold text-slate-500 shadow-lg backdrop-blur-xl md:flex">
        {(["assigned", "in_transit", "delayed", "delivered", "failed"] as DeliveryStatus[]).map((status) => <span className="inline-flex items-center gap-1.5" key={status}><span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColors[status] }} />{statusLabels[status]}</span>)}
      </div>
    </AdminCard>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [scope, setScope] = useState<DateScope>("today");
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [routesData, setRoutesData] = useState<RoutesApiData | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [routePayload, notificationPayload] = await Promise.all([
        fetchAdministratorJson<RoutesApiData>("/api/admin/routes"),
        fetchAdministratorJson<NotificationsApiData>("/api/admin/notifications?limit=12").catch(() => ({ notifications: [], unreadCount: 0 })),
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

  const dashboard = useMemo(() => {
    const data = routesData ?? { routes: [], deliveries: [], drivers: [], profiles: [], vehicles: [], schedules: [] };
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
    const vehiclesInUse = new Set<string>([...scopedSchedules.map((schedule) => schedule.vehicle_id).filter((id): id is string => Boolean(id)), ...activeDeliveries.map((delivery) => delivery.assigned_vehicle_id).filter((id): id is string => Boolean(id))]);
    const driversOnShift = new Set<string>((scope === "today" ? activeSchedules : scopedSchedules).map((schedule) => schedule.driver_id).filter((id): id is string => Boolean(id)));
    const visibleDeliveries = scopedDeliveries.filter((delivery) => statusMatchesFilter(delivery, filter, driversOnShift, vehiclesInUse));
    const mapRecords = visibleDeliveries.map(mapRecordFromDelivery);
    const statusCounts = scopedDeliveries.reduce<Record<DeliveryStatus, number>>((counts, delivery) => ({ ...counts, [delivery.statusValue]: (counts[delivery.statusValue] ?? 0) + 1 }), { pending: 0, assigned: 0, in_transit: 0, delivered: 0, delayed: 0, failed: 0, returned: 0 });
    const conflictCount = scopedSchedules.filter((schedule, index) => scopedSchedules.some((other, otherIndex) => otherIndex > index && schedule.start_time && schedule.end_time && other.start_time && other.end_time && (schedule.driver_id === other.driver_id || Boolean(schedule.vehicle_id && schedule.vehicle_id === other.vehicle_id)) && new Date(schedule.start_time) < new Date(other.end_time) && new Date(other.start_time) < new Date(schedule.end_time))).length;
    const issues: DashboardIssue[] = [
      ...scopedDeliveries.filter((delivery) => isExceptionStatus(delivery.statusValue)).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Delivery", message: `${delivery.delivery_number ?? "Delivery"} is ${statusLabels[delivery.statusValue].toLowerCase()}.`, severity: delivery.statusValue === "delayed" ? "warning" : "critical", href: `/admin/deliveries?delivery=${delivery.delivery_id}` })),
      ...scopedDeliveries.filter((delivery) => !delivery.assigned_driver_id).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Delivery", message: `${delivery.delivery_number ?? "Delivery"} has no assigned driver.`, severity: "warning", href: `/admin/deliveries?delivery=${delivery.delivery_id}` })),
      ...scopedDeliveries.filter((delivery) => !delivery.assigned_vehicle_id).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Delivery", message: `${delivery.delivery_number ?? "Delivery"} has no assigned vehicle.`, severity: "warning", href: `/admin/deliveries?delivery=${delivery.delivery_id}` })),
      ...scopedDeliveries.filter((delivery) => !delivery.route).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Route", message: `${delivery.delivery_number ?? "Delivery"} does not have a generated route.`, severity: "info", href: "/admin/routes" })),
      ...scopedDeliveries.filter((delivery) => !deliveryHasCoordinates(delivery)).map((delivery): DashboardIssue => ({ deliveryId: delivery.delivery_id, label: "Map data", message: `${delivery.delivery_number ?? "Delivery"} needs pickup and drop-off coordinates.`, severity: "info", href: `/admin/deliveries?delivery=${delivery.delivery_id}` })),
      ...data.vehicles.filter((vehicle) => ["maintenance_due", "out_of_service"].includes(vehicle.status ?? "")).map((vehicle): DashboardIssue => ({ label: "Vehicle", message: `${vehicleName(vehicle)} is ${String(vehicle.status).replaceAll("_", " ")}.`, severity: vehicle.status === "out_of_service" ? "critical" : "warning", href: `/admin/vehicles?vehicle=${vehicle.vehicle_id}` })),
    ].slice(0, 8);
    return { scopedDeliveries, visibleDeliveries, mapRecords, scopedSchedules, activeSchedules, driversOnShift, vehiclesInUse, statusCounts, conflictCount, issues };
  }, [filter, routesData, scope]);

  useEffect(() => {
    if (!selectedDeliveryId && dashboard.visibleDeliveries[0]) queueMicrotask(() => setSelectedDeliveryId(dashboard.visibleDeliveries[0].delivery_id));
    if (selectedDeliveryId && !dashboard.visibleDeliveries.some((delivery) => delivery.delivery_id === selectedDeliveryId)) queueMicrotask(() => setSelectedDeliveryId(dashboard.visibleDeliveries[0]?.delivery_id ?? ""));
  }, [dashboard.visibleDeliveries, selectedDeliveryId]);

  if (loading) return <DashboardSkeleton />;

  const recentDeliveries = [...dashboard.visibleDeliveries].sort((left, right) => (right.updated_at ?? "").localeCompare(left.updated_at ?? "")).slice(0, 6);
  const activity = notifications.length ? notifications.slice(0, 6) : dashboard.scopedDeliveries.slice(0, 6).map((delivery) => ({ notification_id: delivery.delivery_id, delivery_id: delivery.delivery_id, notification_type: "delivery", title: `${delivery.delivery_number ?? "Delivery"} ${statusLabels[delivery.statusValue]}`, message: `${delivery.customer_name ?? "Customer"} · ${shortPlace(delivery.pickup_address)} → ${shortPlace(delivery.delivery_address)}`, status: "sent", unread: false, created_at: delivery.updated_at, sent_at: delivery.updated_at }));

  return (
    <section className="space-y-4 text-[#17232b]">
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <LiveOperationsMap records={dashboard.mapRecords} onSelect={setSelectedDeliveryId} selectedId={selectedDeliveryId} />
        <aside className="space-y-4">
          <AdminCard className="p-5"><h2 className="text-lg font-semibold">Delivery Status Breakdown</h2><p className="mt-1 text-xs text-slate-400">{dashboard.scopedDeliveries.length} deliveries in scope</p><div className="mt-4 space-y-2">{(Object.keys(statusLabels) as DeliveryStatus[]).filter((status) => dashboard.statusCounts[status] > 0).map((status) => <button className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${filter === status ? "bg-purple-50 ring-1 ring-purple-100" : "hover:bg-slate-50"}`} key={status} onClick={() => setFilter(filter === status ? "all" : status)} type="button"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColors[status] }} />{statusLabels[status]}</span><strong>{dashboard.statusCounts[status]}</strong></button>)}{dashboard.scopedDeliveries.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No deliveries in this period.</p> : null}</div></AdminCard>
          <AdminCard className="p-5"><h2 className="text-lg font-semibold">Attention Needed</h2><div className="mt-4 space-y-2">{dashboard.issues.length ? dashboard.issues.map((issue, index) => <button className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 px-3 py-2.5 text-left transition hover:bg-purple-50/50" key={`${issue.href}-${index}`} onClick={() => { const mappableIssue = issue.deliveryId ? dashboard.mapRecords.find((record) => record.deliveryId === issue.deliveryId && mapRecordHasCoordinates(record)) : null; if (mappableIssue) setSelectedDeliveryId(mappableIssue.deliveryId); else router.push(issue.href); }} type="button"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${issue.severity === "critical" ? "bg-red-50 text-red-600" : issue.severity === "warning" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}><AppIcons.warning aria-hidden size={14} weight="bold" /></span><span><span className="text-xs font-bold uppercase tracking-wide text-slate-400">{issue.label}</span><span className="mt-0.5 block text-sm font-semibold text-slate-700">{issue.message}</span></span></button>) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No urgent operational issues.</p>}</div></AdminCard>
          <AdminCard className="p-5"><h2 className="text-lg font-semibold">Schedule Snapshot</h2><dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{[["Scheduled shifts", dashboard.scopedSchedules.length], ["Active shift", dashboard.activeSchedules.length], ["Conflicts", dashboard.conflictCount], ["Cancelled shifts", 0]].map(([label, value]) => <div className="rounded-2xl bg-slate-50 p-3" key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd></div>)}</dl></AdminCard>
        </aside>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <AdminCard className="overflow-hidden"><div className="flex items-center justify-between px-5 py-4"><div><h2 className="text-lg font-semibold">Recent Deliveries</h2><p className="mt-1 text-xs text-slate-400">Most recent operational activity in scope</p></div><Link className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-purple-50 hover:text-purple-700" href="/admin/deliveries">View all</Link></div>{recentDeliveries.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-y border-slate-100 bg-slate-50/70 text-left text-xs text-slate-400"><tr><th className="px-5 py-3 font-medium">Delivery</th><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Route</th><th className="px-5 py-3 font-medium">Driver</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Updated</th><th className="px-5 py-3 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{recentDeliveries.map((delivery) => <tr className="hover:bg-purple-50/30" key={delivery.delivery_id}><td className="px-5 py-4 font-semibold text-purple-700">{delivery.delivery_number ?? "Unnumbered"}</td><td className="px-5 py-4 text-slate-600">{delivery.customer_name ?? "Unknown"}</td><td className="px-5 py-4 text-slate-500">{shortPlace(delivery.pickup_address)} → {shortPlace(delivery.delivery_address)}</td><td className="px-5 py-4 text-slate-500">{delivery.driverName}</td><td className="px-5 py-4"><StatusBadge status={statusLabels[delivery.statusValue]} /></td><td className="px-5 py-4 text-slate-500">{formatDate(delivery.updated_at)}</td><td className="px-5 py-4 text-right"><Link className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-purple-50 hover:text-purple-700" href={`/admin/deliveries?delivery=${delivery.delivery_id}`}>View</Link></td></tr>)}</tbody></table></div> : <p className="px-5 py-12 text-center text-sm text-slate-500">No recent deliveries in this period.</p>}</AdminCard>
        <AdminCard className="p-5"><h2 className="text-lg font-semibold">Recent Alerts / Activity</h2><div className="mt-4 space-y-2">{activity.length ? activity.map((item) => <button className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 px-3 py-2.5 text-left transition hover:bg-purple-50/50" key={item.notification_id} onClick={() => item.delivery_id ? router.push(`/admin/deliveries?delivery=${item.delivery_id}`) : router.push("/admin/alerts")} type="button"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${item.unread ? "bg-purple-50 text-purple-600" : "bg-slate-50 text-slate-500"}`}><AppIcons.notifications aria-hidden size={15} weight="bold" /></span><span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-800">{item.title ?? "Operational activity"}</span><span className="shrink-0 text-[10px] text-slate-400">{relativeTime(item.created_at ?? item.sent_at)}</span></span><span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-500">{item.message ?? "No additional details."}</span></span></button>) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No operational alerts.</p>}</div></AdminCard>
      </div>
    </section>
  );
}
