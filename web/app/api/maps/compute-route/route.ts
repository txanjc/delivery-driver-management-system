import { createClient } from "@supabase/supabase-js";

import { isAdministrator } from "@/lib/roles";
import { apiError } from "@/lib/server/administrator-api";

type EndpointInput = {
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

type ComputeRouteRequest = {
  origin?: EndpointInput;
  destination?: EndpointInput;
};

type GoogleRouteResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type Profile = {
  role: string | null;
  is_active: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCoordinate(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseEndpoint(value: unknown): EndpointInput | null {
  if (!isRecord(value)) return null;

  const placeId = typeof value.placeId === "string" ? value.placeId.trim() : "";
  const latitude = parseCoordinate(value.latitude);
  const longitude = parseCoordinate(value.longitude);

  if (placeId) return { placeId };
  if (latitude !== undefined && longitude !== undefined) {
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }
    return { latitude, longitude };
  }

  return null;
}

function endpointToWaypoint(endpoint: EndpointInput) {
  if (endpoint.placeId) return { placeId: endpoint.placeId };

  return {
    location: {
      latLng: {
        latitude: endpoint.latitude,
        longitude: endpoint.longitude,
      },
    },
  };
}

function durationSeconds(duration: string | undefined) {
  if (!duration) return 0;
  const value = Number(duration.replace(/s$/, ""));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

async function authorizeMapsRequest(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return apiError("Server Supabase configuration is missing.", 500);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, accessToken] = authorization.split(" ");
  if (scheme.toLowerCase() !== "bearer" || !accessToken) {
    return apiError("Authentication is required.", 401);
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await client.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return apiError("Authentication is required.", 401);
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role, is_active")
    .eq("profile_id", userData.user.id)
    .maybeSingle<Profile>();

  if (profileError || profile?.is_active !== true) {
    return apiError("Active user access is required.", 403);
  }

  if (!isAdministrator(profile.role) && profile.role !== "dispatcher") {
    return apiError("Administrator or Dispatcher access is required.", 403);
  }

  return null;
}

export async function POST(request: Request) {
  const authorizationError = await authorizeMapsRequest(request);
  if (authorizationError) return authorizationError;

  const apiKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
  if (!apiKey) {
    return apiError("Google Maps Routes API is not configured.", 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const input: ComputeRouteRequest = isRecord(body) ? body : {};
  const origin = parseEndpoint(input.origin);
  const destination = parseEndpoint(input.destination);
  if (!origin || !destination) {
    return apiError("A valid origin and destination are required.", 400);
  }

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    body: JSON.stringify({
      computeAlternativeRoutes: false,
      destination: endpointToWaypoint(destination),
      languageCode: "en-US",
      origin: endpointToWaypoint(origin),
      routingPreference: "TRAFFIC_AWARE",
      travelMode: "DRIVE",
      units: "METRIC",
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    method: "POST",
  });

  const googleBody = (await response.json().catch(() => ({}))) as GoogleRouteResponse;
  if (!response.ok) {
    return apiError(googleBody.error?.message ?? "Unable to calculate route.", 502);
  }

  const route = googleBody.routes?.[0];
  const encodedPolyline = route?.polyline?.encodedPolyline ?? "";
  if (!route?.distanceMeters || !encodedPolyline) {
    return apiError("Google Maps did not return a usable route.", 502);
  }

  return Response.json({
    distanceMeters: route.distanceMeters,
    durationSeconds: durationSeconds(route.duration),
    encodedPolyline,
  });
}
