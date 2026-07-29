import { supabase } from "@/lib/supabase";
import type { DriverNavigation, NavigationCoordinate, NavigationStep, NavigationTarget } from "@/types/navigation";

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function coordinate(value: unknown): NavigationCoordinate | null {
  const item = record(value);
  const latitude = item?.latitude;
  const longitude = item?.longitude;

  return typeof latitude === "number" && Number.isFinite(latitude) && typeof longitude === "number" && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function navigationStep(value: unknown): NavigationStep | null {
  const item = record(value);
  if (!item) return null;

  return {
    distanceMeters: typeof item.distanceMeters === "number" && Number.isFinite(item.distanceMeters) ? item.distanceMeters : null,
    end: coordinate(item.end),
    instruction: typeof item.instruction === "string" ? item.instruction : null,
    maneuver: typeof item.maneuver === "string" ? item.maneuver : null,
  };
}

function navigation(value: unknown): DriverNavigation | null {
  const item = record(value);
  if (!item || !Array.isArray(item.steps)) return null;

  return {
    distanceMeters: typeof item.distanceMeters === "number" && Number.isFinite(item.distanceMeters) ? item.distanceMeters : null,
    durationSeconds: typeof item.durationSeconds === "number" && Number.isFinite(item.durationSeconds) ? item.durationSeconds : null,
    encodedPolyline: typeof item.encodedPolyline === "string" ? item.encodedPolyline : null,
    steps: item.steps.map(navigationStep).filter((step): step is NavigationStep => Boolean(step)),
  };
}

export async function getDriverNavigation(deliveryId: string, origin: NavigationCoordinate, target: NavigationTarget) {
  const response = await supabase.functions.invoke("driver-navigation", {
    body: { deliveryId, origin, target },
  });

  if (response.error) {
    return { data: null, error: response.error };
  }

  const data = navigation(response.data);
  return data ? { data, error: null } : { data: null, error: new Error("Navigation data was unavailable.") };
}
