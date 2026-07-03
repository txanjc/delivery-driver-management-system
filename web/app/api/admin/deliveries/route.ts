import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const [deliveriesResponse, driversResponse, vehiclesResponse] = await Promise.all([
    authorization.client.from("deliveries").select("delivery_id, delivery_number, customer_name, customer_phone, pickup_address, delivery_address, assigned_driver_id, assigned_vehicle_id, status, priority, notes, created_at, drivers:assigned_driver_id (driver_id, user_id, profiles:user_id (first_name, last_name, email)), vehicles:assigned_vehicle_id (vehicle_id, license_plate)").order("created_at", { ascending: false }),
    authorization.client.from("drivers").select("driver_id, user_id, profiles:user_id (first_name, last_name, email)").order("created_at", { ascending: false }),
    authorization.client.from("vehicles").select("vehicle_id, license_plate, make, model").order("license_plate", { ascending: true }),
  ]);
  const error = deliveriesResponse.error ?? driversResponse.error ?? vehiclesResponse.error;
  if (error) return apiError(error.message, 400);
  return Response.json({ deliveries: deliveriesResponse.data ?? [], drivers: driversResponse.data ?? [], vehicles: vehiclesResponse.data ?? [] });
}
