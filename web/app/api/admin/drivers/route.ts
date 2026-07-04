import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

type CreateDriverRequest = {
  user_id: string;
  license_number: string;
  license_expiry_date: string | null;
  availability: "available" | "on_delivery" | "unavailable";
  performance_score: number | null;
  assigned_vehicle_id: string | null;
  updated_at: string;
};

type DriverProfile = {
  profile_id: string;
  role: string | null;
  is_active: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown) {
  return value === null || typeof value === "string" ? value : undefined;
}

function parseCreateDriverRequest(body: unknown): CreateDriverRequest | null {
  if (!isRecord(body)) return null;

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const licenseNumber = typeof body.license_number === "string" ? body.license_number.trim() : "";
  const licenseExpiryDate = nullableString(body.license_expiry_date);
  const assignedVehicleId = nullableString(body.assigned_vehicle_id);
  const updatedAt = typeof body.updated_at === "string" ? body.updated_at : "";
  const validAvailability = ["available", "on_delivery", "unavailable"] as const;
  const availability = validAvailability.find((value) => value === body.availability);
  const performanceScore = body.performance_score;

  if (
    !userId ||
    !licenseNumber ||
    licenseExpiryDate === undefined ||
    assignedVehicleId === undefined ||
    !availability ||
    !updatedAt ||
    Number.isNaN(Date.parse(updatedAt)) ||
    (performanceScore !== null && typeof performanceScore !== "number") ||
    (typeof performanceScore === "number" &&
      (!Number.isFinite(performanceScore) || performanceScore < 0 || performanceScore > 100))
  ) {
    return null;
  }

  return {
    user_id: userId,
    license_number: licenseNumber,
    license_expiry_date: licenseExpiryDate?.trim() || null,
    availability,
    performance_score: performanceScore,
    assigned_vehicle_id: assignedVehicleId?.trim() || null,
    updated_at: updatedAt,
  };
}

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  const profileId = new URL(request.url).searchParams.get("profileId")?.trim();
  if (profileId) {
    const { data, error } = await authorization.client
      .from("profiles")
      .select("is_active")
      .eq("profile_id", profileId)
      .maybeSingle<{ is_active: boolean | null }>();
    if (error) return apiError(error.message, 400);
    if (!data) return apiError("Driver profile was not found.", 404);
    return Response.json({ isActive: data.is_active === true });
  }

  const [driversResponse, profilesResponse] = await Promise.all([
    authorization.client.from("drivers").select("driver_id, user_id, license_number, license_expiry_date, availability, performance_score, assigned_vehicle_id, created_at, updated_at, profiles:user_id (profile_id, first_name, last_name, email, phone, role, is_active), vehicles:assigned_vehicle_id (vehicle_id, vehicle_number, license_plate, make, model)").order("created_at", { ascending: false }),
    authorization.client.from("profiles").select("profile_id, first_name, last_name, email, phone, role, is_active").eq("role", "driver").order("first_name", { ascending: true }),
  ]);

  const error = driversResponse.error ?? profilesResponse.error;
  if (error) return apiError(error.message, 400);
  return Response.json({ drivers: driversResponse.data ?? [], profiles: profilesResponse.data ?? [] });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const driverRequest = parseCreateDriverRequest(body);
  if (!driverRequest) return apiError("Invalid driver creation request.", 400);

  const { data: selectedProfile, error: profileError } = await authorization.client
    .from("profiles")
    .select("profile_id, role, is_active")
    .eq("profile_id", driverRequest.user_id)
    .maybeSingle<DriverProfile>();
  if (profileError) return apiError(profileError.message, 400);
  if (!selectedProfile) return apiError("The selected driver profile was not found.", 404);
  if (selectedProfile.role !== "driver") {
    return apiError("The selected profile must have the driver role.", 400);
  }
  if (selectedProfile.is_active !== true) {
    return apiError("The selected driver profile must be active.", 400);
  }

  const { data: existingDriver, error: duplicateError } = await authorization.client
    .from("drivers")
    .select("driver_id")
    .eq("user_id", selectedProfile.profile_id)
    .maybeSingle<{ driver_id: string }>();
  if (duplicateError) return apiError(duplicateError.message, 400);
  if (existingDriver) return apiError("A driver record already exists for this profile.", 409);

  const { data: driver, error: insertError } = await authorization.client
    .from("drivers")
    .insert({
      user_id: selectedProfile.profile_id,
      license_number: driverRequest.license_number,
      license_expiry_date: driverRequest.license_expiry_date,
      availability: driverRequest.availability,
      performance_score: driverRequest.performance_score,
      assigned_vehicle_id: driverRequest.assigned_vehicle_id,
      updated_at: driverRequest.updated_at,
    })
    .select("driver_id")
    .single<{ driver_id: string }>();
  if (insertError || !driver) {
    return apiError(insertError?.message ?? "Unable to create driver record.", 400);
  }

  return Response.json(
    { message: "Driver record created successfully.", driverId: driver.driver_id },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  if (!isRecord(body) || typeof body.driver_id !== "string" || !isRecord(body.driver)) return apiError("Invalid driver update request.", 400);
  const driverId = body.driver_id.trim();
  const availability = body.driver.availability;
  const performanceScore = body.driver.performance_score;
  if (!driverId || !["available", "unavailable", "on_delivery"].includes(String(availability)) || (performanceScore !== null && (typeof performanceScore !== "number" || !Number.isFinite(performanceScore) || performanceScore < 0 || performanceScore > 100))) return apiError("Invalid driver update request.", 400);
  const { data: driver, error: driverError } = await authorization.client.from("drivers").select("user_id").eq("driver_id", driverId).maybeSingle();
  if (driverError || !driver?.user_id) return apiError(driverError?.message ?? "Driver was not found.", 404);
  const { data: profile, error: profileError } = await authorization.client.from("profiles").select("is_active").eq("profile_id", driver.user_id).maybeSingle();
  if (profileError || !profile) return apiError(profileError?.message ?? "Driver profile was not found.", 404);
  const update = profile.is_active === true ? {
    license_number: typeof body.driver.license_number === "string" ? body.driver.license_number.trim() || null : null,
    license_expiry_date: typeof body.driver.license_expiry_date === "string" ? body.driver.license_expiry_date || null : null,
    availability,
    performance_score: performanceScore,
    updated_at: new Date().toISOString(),
  } : { assigned_vehicle_id: null, availability: "unavailable", performance_score: 0, updated_at: new Date().toISOString() };
  const { error: updateError } = await authorization.client.from("drivers").update(update).eq("driver_id", driverId);
  if (updateError) return apiError(updateError.message, 400);
  if (profile.is_active !== true) return apiError("Inactive drivers are read-only and were normalized to unavailable.", 409);
  return Response.json({ message: "Driver updated successfully." });
}
