"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { SkeletonMapPanel } from "@/components/ui/Skeleton";
import {
  getGoogleMapsConfig,
  getGoogleMapsConfigurationError,
  loadGoogleMapsLibraries,
  type GoogleMapsLibraries,
} from "@/lib/google-maps-client";

type RoutesMapState =
  | "not_configured"
  | "initializing"
  | "ready"
  | "loading_routes"
  | "empty"
  | "error";

export type RoutesMapRoute = {
  id: string;
  label: string;
  deliveryNumber?: string;
  driverName?: string;
  vehicleName?: string;
  status?: string;
  origin: string;
  destination: string;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  polyline: string;
};

export type RoutesMapPreview = {
  encodedPolyline: string;
  returnToDepot: boolean;
  start: { latitude: number; longitude: number; label: string };
  stops: Array<{ deliveryId: string; sequence: number; latitude: number; longitude: number; label: string }>;
};

export type RoutesMapCompanyLocation = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type RoutesMapProps = {
  companyLocation?: RoutesMapCompanyLocation | null;
  routes: RoutesMapRoute[];
  selectedId: string;
  panelOpen?: boolean;
  layer: RoutesMapLayer;
  loading: boolean;
  preview?: RoutesMapPreview | null;
  selectedPreviewStopId?: string;
  onPreviewGeometryWarning?: (message: string | null) => void;
  onPreviewStopSelect?: (deliveryId: string) => void;
  onReadyChange?: (ready: boolean) => void;
  onSelect: (route: RoutesMapRoute) => void;
};

export type RoutesMapLayer = "roadmap" | "satellite" | "terrain";

export type RoutesMapHandle = {
  centerOnPosition: (position: { latitude: number; longitude: number }) => void;
  fitAllRoutes: () => void;
  isReady: () => boolean;
  resize: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

export const WESTCHESTER_DEFAULT_CENTER = {
  lat: 41.033,
  lng: -73.763,
};

export const WESTCHESTER_DEFAULT_ZOOM = 11;

const USER_LOCATION_ZOOM = 14;
const MIN_ZOOM = 3;
const MAX_ZOOM = 20;
const CLUSTER_ZOOM = 11;

function routeColor(status?: string, selected = false) {
  if (selected) return "#7c3aed";
  if (status === "completed") return "#16a34a";
  if (status === "delayed") return "#f97316";
  if (status === "exception") return "#dc2626";
  if (status === "planned") return "#8b7bb8";
  return "#6d4aff";
}

function markerTooltip(route: RoutesMapRoute, role: "Origin" | "Destination") {
  const location = role === "Origin" ? route.origin : route.destination;
  return `${role}\n${route.deliveryNumber || route.label}\n${location}\n${route.driverName || "Unassigned driver"}`;
}

function makeOriginMarkerNode(color: string, selected: boolean) {
  const node = document.createElement("div");
  node.className = `grid place-items-center rounded-full border-2 bg-white shadow-lg ${selected ? "h-9 w-9 border-purple-700 ring-4 ring-purple-200/70" : "h-7 w-7 border-purple-600"}`;
  node.setAttribute("aria-label", "Origin marker");
  node.innerHTML = `<span class="block rounded-full bg-purple-600 ${selected ? "h-3 w-3" : "h-2.5 w-2.5"}"></span>`;
  node.style.color = color;
  return node;
}

function makeDestinationMarkerNode(color: string, selected: boolean) {
  const node = document.createElement("div");
  node.className = `relative grid place-items-center rounded-full text-white shadow-lg ${selected ? "h-10 w-10 bg-purple-700 ring-4 ring-purple-200/70" : "h-8 w-8 bg-purple-600"}`;
  node.setAttribute("aria-label", "Destination marker");
  node.innerHTML = `<span class="text-[13px] font-black leading-none">⚑</span><span class="absolute -bottom-1 h-2 w-2 rotate-45 bg-current"></span>`;
  node.style.background = color;
  node.style.color = color;
  const flag = node.querySelector("span");
  if (flag) (flag as HTMLElement).style.color = "#fff";
  return node;
}

function makeClusterNode(count: number) {
  const node = document.createElement("div");
  node.className = "grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-purple-600 text-xs font-bold text-white shadow-xl ring-4 ring-purple-200/70";
  node.textContent = String(count);
  return node;
}

function makeUserMarkerNode() {
  const node = document.createElement("div");
  node.className = "grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-blue-600 text-[9px] font-bold text-white shadow-lg";
  node.textContent = "ME";
  return node;
}

function makePreviewStartMarkerNode(returnToDepot: boolean) {
  const node = document.createElement("div");
  node.className = "grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-slate-900 text-[9px] font-black text-white shadow-xl ring-4 ring-purple-200/70";
  node.setAttribute("aria-label", returnToDepot ? "Route start and return depot" : "Route start");
  node.textContent = returnToDepot ? "DEPOT" : "START";
  return node;
}

function makePreviewStopMarkerNode(sequence: number, selected: boolean) {
  const node = document.createElement("div");
  node.className = `grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-purple-600 text-xs font-black text-white shadow-xl transition ${selected ? "ring-4 ring-purple-200" : ""}`;
  node.setAttribute("aria-label", `Optimized stop ${sequence}`);
  node.textContent = String(sequence);
  return node;
}

function makeWarehouseMarkerNode() {
  const node = document.createElement("div");
  node.className = "deliver-eaze-warehouse-marker";
  node.setAttribute("aria-label", "DeliverEaze Warehouse");
  node.innerHTML = '<span class="deliver-eaze-warehouse-marker__pulse"></span><span class="deliver-eaze-warehouse-marker__pin"><span class="deliver-eaze-warehouse-marker__label">W</span></span>';
  return node;
}

function warehouseInfoContent(location: RoutesMapCompanyLocation) {
  const content = document.createElement("div");
  content.style.cssText = "max-width:220px;padding:2px 4px;color:#1e293b;font-family:Arial,sans-serif;";
  const title = document.createElement("p");
  title.style.cssText = "margin:0;font-size:13px;font-weight:700;";
  title.textContent = location.name || "DeliverEaze Warehouse";
  const address = document.createElement("p");
  address.style.cssText = "margin:5px 0 0;font-size:12px;line-height:1.45;color:#475569;";
  address.textContent = location.address;
  const note = document.createElement("p");
  note.style.cssText = "margin:7px 0 0;font-size:11px;font-weight:600;color:#7c3aed;";
  note.textContent = "Default operating location";
  content.append(title, address, note);
  return content;
}

function sameCoordinates(
  latitude: number,
  longitude: number,
  location: RoutesMapCompanyLocation | null,
) {
  const tolerance = 0.00005;
  return Boolean(location && Math.abs(latitude - location.latitude) <= tolerance && Math.abs(longitude - location.longitude) <= tolerance);
}

function routeHasCoordinates(route: RoutesMapRoute) {
  return (
    route.originLat !== null &&
    route.originLng !== null &&
    route.destinationLat !== null &&
    route.destinationLng !== null
  );
}

function routeBounds(routes: RoutesMapRoute[]) {
  const bounds = new google.maps.LatLngBounds();
  for (const route of routes) {
    if (route.originLat !== null && route.originLng !== null) bounds.extend({ lat: route.originLat, lng: route.originLng });
    if (route.destinationLat !== null && route.destinationLng !== null) bounds.extend({ lat: route.destinationLat, lng: route.destinationLng });
  }
  return bounds;
}

function fitRoutes(map: google.maps.Map, routes: RoutesMapRoute[], panelOpen: boolean) {
  const bounds = routeBounds(routes);
  if (bounds.isEmpty()) return;
  map.fitBounds(bounds, {
    bottom: 96,
    left: panelOpen ? 420 : 80,
    right: 116,
    top: 108,
  });
}

function fitPreview(map: google.maps.Map, preview: RoutesMapPreview, path: google.maps.LatLng[], panelOpen: boolean) {
  const bounds = new google.maps.LatLngBounds();
  bounds.extend({ lat: preview.start.latitude, lng: preview.start.longitude });
  preview.stops.forEach((stop) => bounds.extend({ lat: stop.latitude, lng: stop.longitude }));
  path.forEach((point) => bounds.extend(point));
  if (bounds.isEmpty()) return;
  map.fitBounds(bounds, { bottom: 96, left: panelOpen ? 430 : 80, right: 116, top: 108 });
}

export const RoutesMap = forwardRef<RoutesMapHandle, RoutesMapProps>(function RoutesMap({
  companyLocation = null,
  routes,
  selectedId,
  panelOpen = true,
  layer,
  loading,
  preview = null,
  selectedPreviewStopId = "",
  onPreviewGeometryWarning,
  onPreviewStopSelect,
  onReadyChange,
  onSelect,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const librariesRef = useRef<GoogleMapsLibraries | null>(null);
  const decodedPathCacheRef = useRef<Map<string, google.maps.LatLng[]>>(new Map());
  const lastFitKeyRef = useRef("");
  const overlaysRef = useRef<{
    polylines: google.maps.Polyline[];
    markers: google.maps.marker.AdvancedMarkerElement[];
    listeners: google.maps.MapsEventListener[];
  }>({ polylines: [], markers: [], listeners: [] });
  const [state, setState] = useState<RoutesMapState>("initializing");
  const [message, setMessage] = useState("");
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(WESTCHESTER_DEFAULT_ZOOM);
  const mapId = getGoogleMapsConfig().mapId;
  const configurationError = getGoogleMapsConfigurationError();

  const positionedRoutes = useMemo(
    () => routes.filter((route) => routeHasCoordinates(route)),
    [routes],
  );
  const selectedRoute = useMemo(
    () => positionedRoutes.find((route) => route.id === selectedId) ?? null,
    [positionedRoutes, selectedId],
  );

  useImperativeHandle(ref, () => ({
    centerOnPosition(position) {
      const map = mapRef.current;
      if (!map) return;
      const center = { lat: position.latitude, lng: position.longitude };
      setCurrentPosition(position);
      map.setCenter(center);
      map.setZoom(USER_LOCATION_ZOOM);
    },
    fitAllRoutes() {
      const map = mapRef.current;
      if (!map) return;
      fitRoutes(map, positionedRoutes, panelOpen);
    },
    isReady() {
      return Boolean(mapRef.current) && state === "ready";
    },
    resize() {
      const map = mapRef.current;
      if (!map) return;
      google.maps.event.trigger(map, "resize");
      const center = map.getCenter();
      if (center) map.setCenter(center);
    },
    zoomIn() {
      const map = mapRef.current;
      if (!map) return;
      const currentZoom = map.getZoom() ?? WESTCHESTER_DEFAULT_ZOOM;
      map.setZoom(Math.min(MAX_ZOOM, currentZoom + 1));
    },
    zoomOut() {
      const map = mapRef.current;
      if (!map) return;
      const currentZoom = map.getZoom() ?? WESTCHESTER_DEFAULT_ZOOM;
      map.setZoom(Math.max(MIN_ZOOM, currentZoom - 1));
    },
  }), [panelOpen, positionedRoutes, state]);

  useEffect(() => {
    if (configurationError) {
      queueMicrotask(() => {
        setState("not_configured");
        setMessage(configurationError);
      });
      return;
    }

    let cancelled = false;

    async function initializeMap() {
      if (!containerRef.current) return;
      setState("initializing");
      setMessage("");

      try {
        const libraries = await loadGoogleMapsLibraries();
        if (cancelled || !containerRef.current) return;

        librariesRef.current = libraries;
        mapRef.current = new libraries.maps.Map(containerRef.current, {
          center: WESTCHESTER_DEFAULT_CENTER,
          disableDefaultUI: true,
          fullscreenControl: false,
          keyboardShortcuts: false,
          mapId,
          mapTypeControl: false,
          mapTypeId: "roadmap",
          streetViewControl: false,
          zoom: WESTCHESTER_DEFAULT_ZOOM,
          zoomControl: false,
        });
        mapRef.current.addListener("zoom_changed", () => setZoomLevel(mapRef.current?.getZoom() ?? WESTCHESTER_DEFAULT_ZOOM));
        onReadyChange?.(true);
        setState("ready");
      } catch {
        if (!cancelled) {
          setState("error");
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
      onReadyChange?.(false);
    };
  }, [configurationError, mapId, onReadyChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMapTypeId(layer);
  }, [layer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      const center = map.getCenter();
      google.maps.event.trigger(map, "resize");
      if (center) map.setCenter(center);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

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

    if (loading) {
      queueMicrotask(() => setState("loading_routes"));
      return;
    }

    const warehouse = companyLocation && Number.isFinite(companyLocation.latitude) && Number.isFinite(companyLocation.longitude)
      ? companyLocation
      : null;
    if (warehouse) {
      const marker = new libraries.marker.AdvancedMarkerElement({
        content: makeWarehouseMarkerNode(),
        map,
        position: { lat: warehouse.latitude, lng: warehouse.longitude },
        title: `${warehouse.name || "DeliverEaze Warehouse"} — default operating location`,
        zIndex: 115,
      });
      const infoWindow = new libraries.maps.InfoWindow({ content: warehouseInfoContent(warehouse) });
      overlaysRef.current.markers.push(marker);
      overlaysRef.current.listeners.push(marker.addListener("click", () => infoWindow.open({ map, anchor: marker })));
    }

    if (preview) {
      queueMicrotask(() => {
        setState("ready");
        setMessage("");
      });
      let path: google.maps.LatLng[] = [];
      let geometryWarning: string | null = null;
      if (!preview.encodedPolyline) {
        geometryWarning = "The optimized route geometry is unavailable. Stop markers are still shown.";
      } else {
        try {
          path = libraries.geometry.encoding.decodePath(preview.encodedPolyline);
          if (!path.length) geometryWarning = "The optimized route geometry is empty. Stop markers are still shown.";
        } catch {
          geometryWarning = "The optimized route geometry could not be read. Stop markers are still shown.";
          path = [];
        }
      }
      onPreviewGeometryWarning?.(geometryWarning);

      if (path.length) {
        const casing = new google.maps.Polyline({ map, path, strokeColor: layer === "satellite" || layer === "terrain" ? "rgba(15,23,42,.76)" : "#ffffff", strokeOpacity: 0.92, strokeWeight: 10, zIndex: 70 });
        const inner = new google.maps.Polyline({ map, path, strokeColor: "#7c3aed", strokeOpacity: 1, strokeWeight: 6, zIndex: 80 });
        overlaysRef.current.polylines.push(casing, inner);
      }

      if (!sameCoordinates(preview.start.latitude, preview.start.longitude, warehouse)) {
      const startMarker = new libraries.marker.AdvancedMarkerElement({
        content: makePreviewStartMarkerNode(preview.returnToDepot),
        map,
        position: { lat: preview.start.latitude, lng: preview.start.longitude },
        title: preview.returnToDepot ? `${preview.start.label} — start and return depot` : `${preview.start.label} — route start`,
        zIndex: 120,
      });
      overlaysRef.current.markers.push(startMarker);
      }

      preview.stops.forEach((stop) => {
        const selected = stop.deliveryId === selectedPreviewStopId;
        const marker = new libraries.marker.AdvancedMarkerElement({
          content: makePreviewStopMarkerNode(stop.sequence, selected),
          map,
          position: { lat: stop.latitude, lng: stop.longitude },
          title: `Stop ${stop.sequence}: ${stop.label}`,
          zIndex: selected ? 140 : 130,
        });
        overlaysRef.current.markers.push(marker);
        if (onPreviewStopSelect) overlaysRef.current.listeners.push(marker.addListener("click", () => onPreviewStopSelect(stop.deliveryId)));
      });

      const fitKey = `preview:${panelOpen}:${preview.encodedPolyline}:${preview.start.latitude}:${preview.start.longitude}:${preview.stops.map((stop) => `${stop.deliveryId}:${stop.sequence}`).join(",")}`;
      if (fitKey !== lastFitKeyRef.current) {
        fitPreview(map, preview, path, panelOpen);
        lastFitKeyRef.current = fitKey;
      }
      return;
    }

    onPreviewGeometryWarning?.(null);

    if (!positionedRoutes.length && !currentPosition) {
      if (warehouse) {
        map.setCenter({ lat: warehouse.latitude, lng: warehouse.longitude });
        map.setZoom(USER_LOCATION_ZOOM);
        queueMicrotask(() => {
          setState("ready");
          setMessage("");
        });
        return;
      }
      map.setCenter(WESTCHESTER_DEFAULT_CENTER);
      map.setZoom(WESTCHESTER_DEFAULT_ZOOM);
      queueMicrotask(() => {
        setState("empty");
        setMessage("No route coordinates available.");
      });
      return;
    }

    queueMicrotask(() => {
      setState("ready");
      setMessage("");
    });

    const routesToFit = selectedRoute ? [selectedRoute] : positionedRoutes;
    const clusterable = !selectedRoute && zoomLevel <= CLUSTER_ZOOM && positionedRoutes.length > 5;
    const clusters = new Map<string, { position: google.maps.LatLngLiteral; bounds: google.maps.LatLngBounds; count: number }>();

    for (const route of positionedRoutes) {
      const selected = route.id === selectedId;
      const color = routeColor(route.status, selected);
      const dimmed = Boolean(selectedRoute && !selected);
      const origin = { lat: route.originLat as number, lng: route.originLng as number };
      const destination = {
        lat: route.destinationLat as number,
        lng: route.destinationLng as number,
      };

      if (route.polyline) {
        let path = decodedPathCacheRef.current.get(route.polyline);
        if (!path) {
          path = libraries.geometry.encoding.decodePath(route.polyline);
          decodedPathCacheRef.current.set(route.polyline, path);
        }
        const casing = new google.maps.Polyline({
          clickable: true,
          map,
          path,
          strokeColor: layer === "satellite" || layer === "terrain" ? "rgba(15,23,42,.76)" : "#ffffff",
          strokeOpacity: dimmed ? 0.28 : 0.88,
          strokeWeight: selected ? 10 : 8,
          zIndex: selected ? 40 : 10,
        });
        const inner = new google.maps.Polyline({
          clickable: true,
          icons: selected || !dimmed ? [{
            icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: selected ? 2.8 : 2.2, strokeColor: color, strokeOpacity: dimmed ? 0.32 : 0.86, strokeWeight: 1.5, fillColor: color, fillOpacity: dimmed ? 0.2 : 0.72 },
            offset: "24%",
            repeat: selected ? "110px" : "150px",
          }] : [],
          map,
          path,
          strokeColor: color,
          strokeOpacity: dimmed ? 0.26 : selected ? 1 : 0.78,
          strokeWeight: selected ? 6 : 4,
          zIndex: selected ? 50 : 20,
        });
        overlaysRef.current.polylines.push(casing, inner);
        overlaysRef.current.listeners.push(
          casing.addListener("click", () => onSelect(route)),
          inner.addListener("click", () => onSelect(route)),
          inner.addListener("mouseover", () => {
            inner.setOptions({ strokeOpacity: 1, strokeWeight: selected ? 7 : 5, zIndex: 60 });
            casing.setOptions({ strokeOpacity: 0.95, strokeWeight: selected ? 11 : 9, zIndex: 55 });
          }),
          inner.addListener("mouseout", () => {
            inner.setOptions({ strokeOpacity: dimmed ? 0.26 : selected ? 1 : 0.78, strokeWeight: selected ? 6 : 4, zIndex: selected ? 50 : 20 });
            casing.setOptions({ strokeOpacity: dimmed ? 0.28 : 0.88, strokeWeight: selected ? 10 : 8, zIndex: selected ? 40 : 10 });
          }),
        );
      }

      if (clusterable) {
        for (const position of [origin, destination]) {
          const key = `${Math.round(position.lat * 45)}:${Math.round(position.lng * 45)}`;
          const cluster = clusters.get(key) ?? { position, bounds: new google.maps.LatLngBounds(), count: 0 };
          cluster.bounds.extend(position);
          cluster.count += 1;
          clusters.set(key, cluster);
        }
        continue;
      }

      const originMarker = sameCoordinates(origin.lat, origin.lng, warehouse)
        ? null
        : new libraries.marker.AdvancedMarkerElement({
          content: makeOriginMarkerNode(color, selected),
          map,
          position: origin,
          title: markerTooltip(route, "Origin"),
          zIndex: selected ? 80 : dimmed ? 4 : 20,
        });
      const destinationMarker = new libraries.marker.AdvancedMarkerElement({
        content: makeDestinationMarkerNode(color, selected),
        map,
        position: destination,
        title: markerTooltip(route, "Destination"),
        zIndex: selected ? 81 : dimmed ? 5 : 21,
      });
      if (originMarker) overlaysRef.current.markers.push(originMarker);
      overlaysRef.current.markers.push(destinationMarker);
      overlaysRef.current.listeners.push(
        destinationMarker.addListener("click", () => onSelect(route)),
      );
      if (originMarker) overlaysRef.current.listeners.push(originMarker.addListener("click", () => onSelect(route)));
    }

    if (clusterable) {
      clusters.forEach((cluster) => {
        const marker = new libraries.marker.AdvancedMarkerElement({
          content: makeClusterNode(cluster.count),
          map,
          position: cluster.bounds.getCenter(),
          title: `${cluster.count} route markers`,
          zIndex: 30,
        });
        overlaysRef.current.markers.push(marker);
        overlaysRef.current.listeners.push(marker.addListener("click", () => map.fitBounds(cluster.bounds, 80)));
      });
    }

    if (currentPosition && !selectedRoute) {
      const position = {
        lat: currentPosition.latitude,
        lng: currentPosition.longitude,
      };
      overlaysRef.current.markers.push(
        new libraries.marker.AdvancedMarkerElement({
          content: makeUserMarkerNode(),
          map,
          position,
          title: "Current location",
        }),
      );
      map.setCenter(position);
      map.setZoom(USER_LOCATION_ZOOM);
      return;
    } else if (currentPosition) {
      overlaysRef.current.markers.push(
        new libraries.marker.AdvancedMarkerElement({
          content: makeUserMarkerNode(),
          map,
          position: { lat: currentPosition.latitude, lng: currentPosition.longitude },
          title: "Current location",
        }),
      );
    }

    const fitKey = `${panelOpen}:${selectedId || "all"}:${routesToFit.map((route) => route.id).join(",")}`;
    if (fitKey !== lastFitKeyRef.current) {
      fitRoutes(map, routesToFit, panelOpen);
      lastFitKeyRef.current = fitKey;
    }
  }, [companyLocation, currentPosition, layer, loading, onPreviewGeometryWarning, onPreviewStopSelect, onSelect, panelOpen, positionedRoutes, preview, selectedId, selectedPreviewStopId, selectedRoute, zoomLevel]);

  const showSkeleton = state === "initializing";
  const showMessage =
    state === "not_configured" || state === "empty" || state === "error";

  return (
    <div aria-busy={state === "initializing" || state === "loading_routes"} className="absolute inset-0 bg-[#edf4f3]">
      <style>{`
        .deliver-eaze-warehouse-marker { position: relative; display: grid; height: 38px; width: 38px; place-items: center; }
        .deliver-eaze-warehouse-marker__pulse { position: absolute; inset: 1px; border-radius: 999px; background: rgba(124, 58, 237, .34); animation: deliver-eaze-warehouse-pulse 2.8s ease-out infinite; }
        .deliver-eaze-warehouse-marker__pin { position: relative; display: grid; height: 28px; width: 28px; place-items: center; border: 2px solid #ffffff; border-radius: 999px 999px 999px 3px; background: #7c3aed; color: #ffffff; font: 800 11px/1 Arial, sans-serif; box-shadow: 0 6px 16px rgba(91, 33, 182, .34); transform: rotate(-45deg); }
        .deliver-eaze-warehouse-marker__label { transform: rotate(45deg); }
        @keyframes deliver-eaze-warehouse-pulse { 0% { opacity: .7; transform: scale(.72); } 72%, 100% { opacity: 0; transform: scale(1.72); } }
        @media (prefers-reduced-motion: reduce) { .deliver-eaze-warehouse-marker__pulse { animation: none; opacity: .42; transform: scale(1.12); } }
      `}</style>
      {showSkeleton ? <SkeletonMapPanel className="absolute inset-0 h-full w-full rounded-none" /> : null}
      <div className="absolute inset-0 h-full w-full" ref={containerRef} />
      {state === "loading_routes" ? (
        <div className="pointer-events-none absolute right-5 top-20 z-20 rounded-xl bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-lg backdrop-blur-sm">
          Loading route data...
        </div>
      ) : null}
      {showMessage ? (
        <div className="absolute inset-0 z-10 grid place-items-center">
          <div className="max-w-md rounded-[18px] border border-white/80 bg-white/88 p-5 text-center shadow-[0_18px_48px_-28px_rgba(15,23,42,.35)] backdrop-blur-xl">
            <p className="font-semibold text-slate-700">{message}</p>
            {state === "empty" ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Add valid origin and destination coordinates to visualize routes.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});
