"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  origin: string;
  destination: string;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  polyline: string;
};

type RoutesMapProps = {
  routes: RoutesMapRoute[];
  selectedId: string;
  layer: "light" | "contrast";
  zoom: number;
  currentPosition: { latitude: number; longitude: number } | null;
  loading: boolean;
  onSelect: (route: RoutesMapRoute) => void;
};

const center = { lat: 33.749, lng: -84.388 };
const routeColors = ["#6d4aff", "#20b970", "#f97316", "#2563eb", "#0891b2"];

function routeColor(id: string) {
  return routeColors[
    Array.from(id).reduce((sum, character) => sum + character.charCodeAt(0), 0) %
      routeColors.length
  ];
}

function makeMarkerNode(color: string, selected: boolean, label: string) {
  const node = document.createElement("div");
  node.className = selected
    ? "grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-lg"
    : "grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow-md";
  node.style.background = color;
  node.textContent = label;
  return node;
}

function routeHasCoordinates(route: RoutesMapRoute) {
  return (
    route.originLat !== null &&
    route.originLng !== null &&
    route.destinationLat !== null &&
    route.destinationLng !== null
  );
}

export function RoutesMap({
  routes,
  selectedId,
  layer,
  zoom,
  currentPosition,
  loading,
  onSelect,
}: RoutesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialZoomRef = useRef(zoom);
  const mapRef = useRef<google.maps.Map | null>(null);
  const librariesRef = useRef<GoogleMapsLibraries | null>(null);
  const overlaysRef = useRef<{
    polylines: google.maps.Polyline[];
    markers: google.maps.marker.AdvancedMarkerElement[];
    listeners: google.maps.MapsEventListener[];
  }>({ polylines: [], markers: [], listeners: [] });
  const [state, setState] = useState<RoutesMapState>("initializing");
  const [message, setMessage] = useState("");
  const mapId = getGoogleMapsConfig().mapId;
  const configurationError = getGoogleMapsConfigurationError();

  const positionedRoutes = useMemo(
    () => routes.filter((route) => routeHasCoordinates(route)),
    [routes],
  );

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
          center,
          disableDefaultUI: true,
          fullscreenControl: false,
          mapId,
          mapTypeControl: false,
          mapTypeId: "roadmap",
          streetViewControl: false,
          zoom: Math.round(12 * initialZoomRef.current),
          zoomControl: false,
        });
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
    };
  }, [configurationError, mapId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(Math.round(12 * zoom));
  }, [zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMapTypeId(layer === "contrast" ? "terrain" : "roadmap");
  }, [layer]);

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

    if (!positionedRoutes.length && !currentPosition) {
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

    const bounds = new google.maps.LatLngBounds();

    for (const route of positionedRoutes) {
      const color = routeColor(route.id);
      const selected = route.id === selectedId;
      const origin = { lat: route.originLat as number, lng: route.originLng as number };
      const destination = {
        lat: route.destinationLat as number,
        lng: route.destinationLng as number,
      };
      bounds.extend(origin);
      bounds.extend(destination);

      if (route.polyline) {
        const path = libraries.geometry.encoding.decodePath(route.polyline);
        const polyline = new google.maps.Polyline({
          clickable: true,
          map,
          path,
          strokeColor: color,
          strokeOpacity: selected ? 1 : 0.72,
          strokeWeight: selected ? 6 : 4,
          zIndex: selected ? 20 : 10,
        });
        overlaysRef.current.polylines.push(polyline);
        overlaysRef.current.listeners.push(
          polyline.addListener("click", () => onSelect(route)),
        );
        path.forEach((point) => bounds.extend(point));
      }

      const originMarker = new libraries.marker.AdvancedMarkerElement({
        content: makeMarkerNode(color, selected, "O"),
        map,
        position: origin,
        title: `${route.label} origin: ${route.origin}`,
      });
      const destinationMarker = new libraries.marker.AdvancedMarkerElement({
        content: makeMarkerNode(color, selected, "D"),
        map,
        position: destination,
        title: `${route.label} destination: ${route.destination}`,
      });
      overlaysRef.current.markers.push(originMarker, destinationMarker);
      overlaysRef.current.listeners.push(
        originMarker.addListener("click", () => onSelect(route)),
        destinationMarker.addListener("click", () => onSelect(route)),
      );
    }

    if (currentPosition) {
      const position = {
        lat: currentPosition.latitude,
        lng: currentPosition.longitude,
      };
      bounds.extend(position);
      overlaysRef.current.markers.push(
        new libraries.marker.AdvancedMarkerElement({
          content: makeMarkerNode("#2563eb", true, "ME"),
          map,
          position,
          title: "Current location",
        }),
      );
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 72);
    }
  }, [currentPosition, loading, onSelect, positionedRoutes, selectedId]);

  const showSkeleton = state === "initializing";
  const showMessage =
    state === "not_configured" || state === "empty" || state === "error";

  return (
    <div aria-busy={state === "initializing" || state === "loading_routes"} className="absolute inset-0 overflow-hidden bg-[#edf4f3]">
      {showSkeleton ? <SkeletonMapPanel className="absolute inset-0 h-full w-full rounded-none" /> : null}
      <div className="absolute inset-0" ref={containerRef} />
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
}
