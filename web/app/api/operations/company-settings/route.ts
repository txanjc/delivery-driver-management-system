import { apiError, authorizeOperationsRequest } from "@/lib/server/administrator-api";

export async function GET(request: Request) {
  const authorization = await authorizeOperationsRequest(request);
  if (!authorization.client) return authorization.response;

  const { data, error } = await authorization.client
    .from("company_settings")
    .select("operating_location_name, operating_address, operating_place_id, operating_latitude, operating_longitude")
    .maybeSingle();

  if (error) return apiError("Company operating location could not be loaded.", 400);
  return Response.json({ companySettings: data ?? null });
}
