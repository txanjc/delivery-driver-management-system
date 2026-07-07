import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  const [deliveriesResponse, driversResponse, vehiclesResponse, schedulesResponse, routesResponse, expensesResponse, revenueResponse, maintenanceResponse] = await Promise.all([
    authorization.client.from("deliveries").select("delivery_id, delivery_number, customer_name, assigned_driver_id, assigned_vehicle_id, status, priority, created_at, updated_at").order("created_at", { ascending: false }),
    authorization.client.from("drivers").select("driver_id, user_id, availability, performance_score, assigned_vehicle_id, created_at, profiles:user_id (profile_id, first_name, last_name, email, is_active)").order("created_at", { ascending: false }),
    authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, status, created_at").order("created_at", { ascending: false }),
    authorization.client.from("schedules").select("schedule_id, driver_id, vehicle_id, shift_date, shift_type, shift_name, start_time, end_time, status, created_at").order("start_time", { ascending: false }),
    authorization.client.from("routes").select("route_id, delivery_id, estimated_distance_km, actual_distance_km, estimated_duration_minutes, actual_duration_minutes, created_at").order("created_at", { ascending: false }),
    authorization.client.from("expenses").select("expense_id, expense_type, amount, expense_date, created_at"),
    authorization.client.from("delivery_revenue").select("revenue_id, delivery_id, net_revenue, revenue_date, created_at"),
    authorization.client.from("vehicle_maintenance").select("maintenance_id, vehicle_id, maintenance_type, cost, maintenance_date, created_at"),
  ]);

  const error = deliveriesResponse.error ?? driversResponse.error ?? vehiclesResponse.error ?? schedulesResponse.error ?? routesResponse.error ?? expensesResponse.error ?? revenueResponse.error ?? maintenanceResponse.error;
  if (error) return apiError(error.message, 400);

  return Response.json({
    deliveries: deliveriesResponse.data ?? [],
    drivers: driversResponse.data ?? [],
    vehicles: vehiclesResponse.data ?? [],
    schedules: schedulesResponse.data ?? [],
    routes: routesResponse.data ?? [],
    expenses: expensesResponse.data ?? [],
    revenue: revenueResponse.data ?? [],
    maintenance: maintenanceResponse.data ?? [],
  });
}
