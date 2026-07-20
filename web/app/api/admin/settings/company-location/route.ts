import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

const companySettingsId = "00000000-0000-0000-0000-000000000001";

type CompanyLocation = {
  operating_location_name: string;
  operating_address: string;
  operating_place_id: string;
  operating_latitude: number;
  operating_longitude: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseLocation(value: unknown): CompanyLocation | null {
  if (!isRecord(value)) return null;
  const operating_location_name = text(value.locationName);
  const operating_address = text(value.formattedAddress);
  const operating_place_id = text(value.placeId);
  const operating_latitude = value.latitude;
  const operating_longitude = value.longitude;
  if (
    !operating_location_name ||
    !operating_address ||
    !/^[A-Za-z0-9_-]{10,}$/.test(operating_place_id) ||
    typeof operating_latitude !== "number" ||
    !Number.isFinite(operating_latitude) ||
    operating_latitude < -90 ||
    operating_latitude > 90 ||
    typeof operating_longitude !== "number" ||
    !Number.isFinite(operating_longitude) ||
    operating_longitude < -180 ||
    operating_longitude > 180
  ) return null;
  return { operating_location_name, operating_address, operating_place_id, operating_latitude, operating_longitude };
}

export async function PUT(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client || !authorization.userId) return authorization.response ?? apiError("Authentication is required.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const location = parseLocation(body);
  if (!location) return apiError("Select a valid address from Google Places before saving the operating location.", 400);

  const { data, error } = await authorization.client
    .from("company_settings")
    .upsert({
      id: companySettingsId,
      ...location,
      updated_by: authorization.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select("operating_location_name, operating_address, operating_place_id, operating_latitude, operating_longitude, updated_at")
    .single();

  if (error || !data) return apiError("Company operating location could not be saved.", 400);
  return Response.json({ companySettings: data });
}
