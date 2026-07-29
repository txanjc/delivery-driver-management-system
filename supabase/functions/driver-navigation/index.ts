import { createClient } from "npm:@supabase/supabase-js@2";

type Coordinate = { latitude: number; longitude: number };
type GoogleStep = {
  distanceMeters?: number;
  endLocation?: { latLng?: Coordinate };
  navigationInstruction?: { instructions?: string; maneuver?: string };
};

const jsonHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function parseCoordinate(value: unknown): Coordinate | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { latitude, longitude } = value as Record<string, unknown>;
  return typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    ? { latitude, longitude }
    : null;
}

function seconds(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/s$/, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  const googleRoutesKey = Deno.env.get("GOOGLE_MAPS_ROUTES_API_KEY");
  if (!authorization || !supabaseUrl || !publishableKey || !serviceRoleKey || !googleRoutesKey) {
    return response({ error: "Navigation service is unavailable." }, 503);
  }

  const authClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
  const { data: userResult, error: userError } = await authClient.auth.getUser();
  if (userError || !userResult.user) return response({ error: "Authentication is required." }, 401);

  let payload: Record<string, unknown>;
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("Invalid request.");
    payload = body as Record<string, unknown>;
  } catch {
    return response({ error: "Navigation request is invalid." }, 400);
  }

  const deliveryId = typeof payload.deliveryId === "string" ? payload.deliveryId.trim() : "";
  const origin = parseCoordinate(payload.origin);
  const target = payload.target === "pickup" || payload.target === "dropoff" ? payload.target : null;
  if (!deliveryId || !origin || !target) return response({ error: "A delivery, route stage, and current location are required." }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const [{ data: profile }, { data: driver }] = await Promise.all([
    admin.from("profiles").select("role, is_active").eq("profile_id", userResult.user.id).maybeSingle(),
    admin.from("drivers").select("driver_id").eq("user_id", userResult.user.id).maybeSingle(),
  ]);
  if (profile?.role !== "driver" || profile.is_active !== true || !driver) return response({ error: "Driver access is required." }, 403);

  const { data: delivery } = await admin
    .from("deliveries")
    .select("delivery_id, assigned_driver_id, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude")
    .eq("delivery_id", deliveryId)
    .maybeSingle();
  if (!delivery || delivery.assigned_driver_id !== driver.driver_id) return response({ error: "This delivery is unavailable." }, 403);

  const destination = target === "pickup"
    ? parseCoordinate({ latitude: delivery.pickup_latitude, longitude: delivery.pickup_longitude })
    : parseCoordinate({ latitude: delivery.delivery_latitude, longitude: delivery.delivery_longitude });
  if (!destination) return response({ error: target === "pickup" ? "The pickup location is not mapped." : "The delivery destination is not mapped." }, 422);

  const googleResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleRoutesKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.endLocation,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.navigationInstruction.maneuver",
    },
    body: JSON.stringify({
      origin: { location: { latLng: origin } },
      destination: { location: { latLng: destination } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "en-US",
      units: "IMPERIAL",
    }),
  });

  const googleBody = await googleResponse.json().catch(() => ({})) as { error?: { message?: string }; routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string }; legs?: Array<{ steps?: GoogleStep[] }> }> };
  if (!googleResponse.ok || !googleBody.routes?.[0]) return response({ error: googleBody.error?.message ?? "Unable to calculate navigation." }, 502);

  const route = googleBody.routes[0];
  return response({
    distanceMeters: typeof route.distanceMeters === "number" ? route.distanceMeters : null,
    durationSeconds: seconds(route.duration),
    encodedPolyline: route.polyline?.encodedPolyline ?? null,
    steps: (route.legs?.flatMap((leg) => leg.steps ?? []) ?? []).map((step) => ({
      distanceMeters: typeof step.distanceMeters === "number" ? step.distanceMeters : null,
      end: parseCoordinate(step.endLocation?.latLng),
      instruction: step.navigationInstruction?.instructions ?? null,
      maneuver: step.navigationInstruction?.maneuver ?? null,
    })),
  });
});
