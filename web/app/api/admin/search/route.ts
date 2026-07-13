import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";
import { expenseTypeLabel } from "@/lib/expense-types";

type SearchResultType = "user" | "driver" | "vehicle" | "schedule" | "delivery" | "route" | "expense" | "revenue";
type SearchResult = { id: string; type: SearchResultType; title: string; subtitle?: string; metadata?: string; status?: string; href: string; recordId: string; relatedId?: string; routeId?: string; deliveryId?: string; driverId?: string; vehicleId?: string; rank: number };

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function compact(value: string) { return normalize(value).replaceAll(" ", ""); }
function score(query: string, values: string[], exactBoost = 0) {
  const q = normalize(query);
  const cq = compact(query);
  let best: number | null = null;
  values.filter(Boolean).forEach((value) => {
    const v = normalize(value);
    const cv = compact(value);
    let next: number | null = null;
    if (v === q || cv === cq) next = 0 - exactBoost;
    else if (v.startsWith(q) || cv.startsWith(cq)) next = 25;
    else if (v.includes(q) || cv.includes(cq)) next = 60;
    if (next !== null) best = best === null ? next : Math.min(best, next);
  });
  return best;
}
function name(profile?: { first_name?: string | null; last_name?: string | null; email?: string | null }) { return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Unnamed"; }
function vehicleName(vehicle?: { vehicle_number?: string | null; make?: string | null; model?: string | null; license_plate?: string | null }) { return [vehicle?.vehicle_number ? `Vehicle ${vehicle.vehicle_number}` : "", [vehicle?.make, vehicle?.model].filter(Boolean).join(" ")].filter(Boolean).join(" - ") || vehicle?.license_plate || "Unnamed vehicle"; }
function shortPlace(value?: string | null) { const parts = (value ?? "").split(",").map((part) => part.trim()).filter(Boolean); return parts[0]?.replace(/^\d+\s+/, "") || "Unknown"; }
function money(value: number | string | null) { const amount = Number(value); return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "$0.00"; }
function dateText(value?: string | null) { if (!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date); }
function ref(prefix: string, id: string) { return `${prefix}-${id.replaceAll("-", "").slice(0, 6).toUpperCase()}`; }

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ results: [] });

  const client = authorization.client;
  const [profilesResponse, driversResponse, vehiclesResponse, schedulesResponse, deliveriesResponse, routesResponse, expensesResponse, revenueResponse] = await Promise.all([
    client.from("profiles").select("profile_id, first_name, last_name, email, phone, role, is_active").limit(300),
    client.from("drivers").select("driver_id, user_id, assigned_vehicle_id, license_number, availability").limit(300),
    client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, vehicle_type, registration_number, insurance_policy_number, status").limit(300),
    client.from("schedules").select("schedule_id, driver_id, vehicle_id, shift_date, shift_name, start_time, end_time, status, assigned_by").limit(300),
    client.from("deliveries").select("delivery_id, delivery_number, customer_name, customer_phone, pickup_address, delivery_address, assigned_driver_id, assigned_vehicle_id, status, priority").limit(300),
    client.from("routes").select("route_id, delivery_id, origin, destination, origin_address, destination_address, route_provider, estimated_distance_km, estimated_duration_minutes").limit(300),
    client.from("expenses").select("expense_id, expense_type, description, amount, expense_date, vehicle_id, created_by").limit(300),
    client.from("delivery_revenue").select("revenue_id, delivery_id, revenue_amount, net_revenue, invoice_number, revenue_date").limit(300),
  ]);
  const error = profilesResponse.error ?? driversResponse.error ?? vehiclesResponse.error ?? schedulesResponse.error ?? deliveriesResponse.error ?? routesResponse.error ?? expensesResponse.error ?? revenueResponse.error;
  if (error) return apiError(error.message, 400);

  const profiles = profilesResponse.data ?? [];
  const drivers = driversResponse.data ?? [];
  const vehicles = vehiclesResponse.data ?? [];
  const schedules = schedulesResponse.data ?? [];
  const deliveries = deliveriesResponse.data ?? [];
  const routes = routesResponse.data ?? [];
  const expenses = expensesResponse.data ?? [];
  const revenue = revenueResponse.data ?? [];
  const profileMap = new Map(profiles.map((profile) => [profile.profile_id, profile]));
  const driverMap = new Map(drivers.map((driver) => [driver.driver_id, driver]));
  const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]));
  const deliveryMap = new Map(deliveries.map((delivery) => [delivery.delivery_id, delivery]));
  const routeByDelivery = new Map(routes.filter((route) => route.delivery_id).map((route) => [route.delivery_id as string, route]));
  const results: SearchResult[] = [];

  profiles.forEach((profile) => {
    const title = name(profile);
    const rank = score(query, [title, profile.email ?? "", profile.phone ?? "", profile.role ?? "", profile.is_active ? "active" : "inactive"], 30);
    if (rank === null) return;
    results.push({ id: `user-${profile.profile_id}`, type: "user", title, subtitle: [profile.email, profile.role].filter(Boolean).join(" - "), status: profile.is_active ? "Active" : "Inactive", href: `/admin/users?user=${profile.profile_id}`, recordId: profile.profile_id, rank });
  });
  drivers.forEach((driver) => {
    const profile = driver.user_id ? profileMap.get(driver.user_id) : undefined;
    const vehicle = driver.assigned_vehicle_id ? vehicleMap.get(driver.assigned_vehicle_id) : undefined;
    const title = name(profile);
    const rank = score(query, [title, profile?.email ?? "", profile?.phone ?? "", driver.license_number ?? "", driver.availability ?? "", vehicleName(vehicle)], 30);
    if (rank === null) return;
    results.push({ id: `driver-${driver.driver_id}`, type: "driver", title, subtitle: profile?.email ?? profile?.phone ?? "No contact recorded", metadata: vehicle ? vehicleName(vehicle) : "No vehicle assigned", status: driver.availability ?? undefined, href: `/admin/drivers?driver=${driver.driver_id}`, recordId: driver.driver_id, driverId: driver.driver_id, rank });
  });
  vehicles.forEach((vehicle) => {
    const title = vehicleName(vehicle);
    const rank = score(query, [vehicle.vehicle_number ?? "", vehicle.license_plate ?? "", vehicle.make ?? "", vehicle.model ?? "", vehicle.vehicle_type ?? "", vehicle.registration_number ?? "", vehicle.insurance_policy_number ?? "", vehicle.status ?? "", title], 35);
    if (rank === null) return;
    results.push({ id: `vehicle-${vehicle.vehicle_id}`, type: "vehicle", title, subtitle: vehicle.license_plate ?? undefined, status: vehicle.status ?? undefined, href: `/admin/vehicles?vehicle=${vehicle.vehicle_id}`, recordId: vehicle.vehicle_id, vehicleId: vehicle.vehicle_id, rank });
  });
  schedules.forEach((schedule) => {
    const driver = schedule.driver_id ? driverMap.get(schedule.driver_id) : undefined;
    const profile = driver?.user_id ? profileMap.get(driver.user_id) : undefined;
    const vehicle = schedule.vehicle_id ? vehicleMap.get(schedule.vehicle_id) : undefined;
    const title = `${name(profile)} - ${schedule.shift_name ?? "Shift"}`;
    const rank = score(query, [title, name(profile), vehicleName(vehicle), schedule.shift_name ?? "", schedule.shift_date ?? "", schedule.status ?? ""], 10);
    if (rank === null) return;
    results.push({ id: `schedule-${schedule.schedule_id}`, type: "schedule", title, subtitle: `${dateText(schedule.shift_date)} - ${schedule.start_time ? new Date(schedule.start_time).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" }) : ""}-${schedule.end_time ? new Date(schedule.end_time).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" }) : ""}`, status: schedule.status ?? undefined, href: `/admin/schedules?schedule=${schedule.schedule_id}`, recordId: schedule.schedule_id, rank });
  });
  deliveries.forEach((delivery) => {
    const driver = delivery.assigned_driver_id ? driverMap.get(delivery.assigned_driver_id) : undefined;
    const profile = driver?.user_id ? profileMap.get(driver.user_id) : undefined;
    const vehicle = delivery.assigned_vehicle_id ? vehicleMap.get(delivery.assigned_vehicle_id) : undefined;
    const rank = score(query, [delivery.delivery_number ?? "", delivery.customer_name ?? "", delivery.customer_phone ?? "", delivery.pickup_address ?? "", delivery.delivery_address ?? "", name(profile), vehicleName(vehicle), delivery.status ?? "", delivery.priority ?? ""], 40);
    if (rank === null) return;
    const route = routeByDelivery.get(delivery.delivery_id);
    results.push({ id: `delivery-${delivery.delivery_id}`, type: "delivery", title: `${delivery.delivery_number ?? "Unnumbered"} - ${delivery.customer_name ?? "Unknown customer"}`, subtitle: `${shortPlace(delivery.pickup_address)} -> ${shortPlace(delivery.delivery_address)}`, status: delivery.status ?? undefined, href: `/admin/deliveries?delivery=${delivery.delivery_id}`, recordId: delivery.delivery_id, deliveryId: delivery.delivery_id, routeId: route?.route_id, rank });
  });
  routes.forEach((route) => {
    const delivery = route.delivery_id ? deliveryMap.get(route.delivery_id) : undefined;
    const origin = route.origin_address ?? route.origin ?? delivery?.pickup_address ?? "";
    const destination = route.destination_address ?? route.destination ?? delivery?.delivery_address ?? "";
    const rank = score(query, [delivery?.delivery_number ?? "", origin, destination, route.route_provider ?? "", delivery?.status ?? ""], 25);
    if (rank === null) return;
    results.push({ id: `route-${route.route_id}`, type: "route", title: `Route for ${delivery?.delivery_number ?? "Unassigned"}`, subtitle: `${shortPlace(origin)} -> ${shortPlace(destination)}`, metadata: `${route.estimated_distance_km ?? "?"} km - ${route.estimated_duration_minutes ?? "?"} min`, status: delivery?.status ?? undefined, href: `/admin/routes?route=${route.route_id}`, recordId: route.route_id, routeId: route.route_id, deliveryId: route.delivery_id ?? undefined, rank });
  });
  expenses.forEach((expense) => {
    const vehicle = expense.vehicle_id ? vehicleMap.get(expense.vehicle_id) : undefined;
    const creator = expense.created_by ? profileMap.get(expense.created_by) : undefined;
    const reference = ref("EXP", expense.expense_id);
    const rank = score(query, [reference, expense.expense_type ?? "", expense.description ?? "", vehicleName(vehicle), name(creator), expense.expense_date ?? ""], 35);
    if (rank === null) return;
    results.push({ id: `expense-${expense.expense_id}`, type: "expense", title: `${reference} - ${expenseTypeLabel(expense.expense_type)}`, subtitle: vehicle ? vehicleName(vehicle) : expense.description ?? "Operational expense", metadata: `${money(expense.amount)} - ${dateText(expense.expense_date)}`, href: `/admin/finance?tab=expenses&expense=${expense.expense_id}`, recordId: expense.expense_id, rank });
  });
  revenue.forEach((item) => {
    const delivery = item.delivery_id ? deliveryMap.get(item.delivery_id) : undefined;
    const reference = ref("REV", item.revenue_id);
    const rank = score(query, [reference, delivery?.delivery_number ?? "", delivery?.customer_name ?? "", item.invoice_number ?? "", item.revenue_date ?? "", String(item.net_revenue ?? ""), String(item.revenue_amount ?? "")], 35);
    if (rank === null) return;
    results.push({ id: `revenue-${item.revenue_id}`, type: "revenue", title: `${reference} - ${delivery?.delivery_number ?? "No delivery"}`, subtitle: item.invoice_number ? `Invoice ${item.invoice_number}` : delivery?.customer_name ?? "Revenue record", metadata: `Net revenue ${money(item.net_revenue)}`, href: `/admin/finance?tab=revenue&revenue=${item.revenue_id}`, recordId: item.revenue_id, relatedId: item.delivery_id ?? undefined, rank });
  });

  const groupOrder: Record<SearchResultType, number> = { user: 0, driver: 1, vehicle: 2, schedule: 3, delivery: 4, route: 5, expense: 6, revenue: 7 };
  return Response.json({ results: results.sort((left, right) => left.rank - right.rank || groupOrder[left.type] - groupOrder[right.type] || left.title.localeCompare(right.title)).slice(0, 80) });
}
