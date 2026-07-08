"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let configured = false;

export type GoogleMapsLibraries = {
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
  places: google.maps.PlacesLibrary;
  geometry: google.maps.GeometryLibrary;
};

export function getGoogleMapsConfig() {
  return {
    browserKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "",
    mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "",
  };
}

export function getGoogleMapsConfigurationError() {
  const { browserKey, mapId } = getGoogleMapsConfig();
  if (!browserKey) return "Google Maps is not configured.";
  if (!mapId) return "Google Maps Map ID is not configured.";
  return "";
}

function configureGoogleMaps() {
  if (configured) return;

  const { browserKey, mapId } = getGoogleMapsConfig();
  if (!browserKey) {
    throw new Error("Google Maps is not configured.");
  }

  setOptions({
    key: browserKey,
    mapIds: mapId ? [mapId] : undefined,
    v: "weekly",
  });
  configured = true;
}

export async function loadGoogleMapsLibraries(): Promise<GoogleMapsLibraries> {
  configureGoogleMaps();

  const [maps, marker, places, geometry] = await Promise.all([
    importLibrary("maps") as Promise<google.maps.MapsLibrary>,
    importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
    importLibrary("places") as Promise<google.maps.PlacesLibrary>,
    importLibrary("geometry") as Promise<google.maps.GeometryLibrary>,
  ]);

  return { maps, marker, places, geometry };
}
