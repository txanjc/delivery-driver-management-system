import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";
import { expenseTypeRequiresVehicle, expenseTypeSyncsVehicleMaintenance, isExpenseType, type ExpenseType } from "@/lib/expense-types";

type ExpenseInput = {
  expense_type: ExpenseType;
  vehicle_id: string | null;
  description: string;
  amount: number;
  expense_date: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableText(value: unknown) {
  return value === null || value === undefined ? null : typeof value === "string" ? value.trim() || null : undefined;
}

function isDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime());
}

function parseExpense(value: unknown): ExpenseInput | null {
  if (!isRecord(value)) return null;
  const expenseType = typeof value.expense_type === "string" ? value.expense_type.trim().toLowerCase() : "";
  const vehicleId = nullableText(value.vehicle_id);
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const amount = typeof value.amount === "number" ? value.amount : Number(value.amount);
  const expenseDate = typeof value.expense_date === "string" ? value.expense_date.trim() : "";
  if (!isExpenseType(expenseType) || vehicleId === undefined || !description || !Number.isFinite(amount) || amount <= 0 || !isDate(expenseDate)) return null;
  if (expenseTypeRequiresVehicle(expenseType) && !vehicleId) return null;
  return { expense_type: expenseType, vehicle_id: vehicleId, description, amount: Math.round(amount * 100) / 100, expense_date: expenseDate };
}

async function syncVehicleMaintenanceStatus(client: SupabaseClient, expense: ExpenseInput) {
  if (!expenseTypeSyncsVehicleMaintenance(expense.expense_type) || !expense.vehicle_id) return { error: null, warning: "" };
  const { error } = await client.from("vehicles").update({ status: "maintenance_due", updated_at: new Date().toISOString() }).eq("vehicle_id", expense.vehicle_id);
  if (error) return { error, warning: "" };

  const now = new Date().toISOString();
  const [schedulesResponse, deliveriesResponse] = await Promise.all([
    client.from("schedules").select("schedule_id", { count: "exact", head: true }).eq("vehicle_id", expense.vehicle_id).neq("status", "cancelled").gt("end_time", now),
    client.from("deliveries").select("delivery_id", { count: "exact", head: true }).eq("assigned_vehicle_id", expense.vehicle_id).in("status", ["pending", "assigned", "in_transit", "delayed"]),
  ]);
  const conflictCount = (schedulesResponse.count ?? 0) + (deliveriesResponse.count ?? 0);
  return { error: schedulesResponse.error ?? deliveriesResponse.error, warning: conflictCount > 0 ? "Vehicle was placed into maintenance and has existing future or active assignments to review." : "" };
}

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  const [expensesResponse, revenueResponse, maintenanceResponse] = await Promise.all([
    authorization.client.from("expenses").select("expense_id, delivery_id, vehicle_id, driver_id, expense_type, description, amount, expense_date, receipt_url, created_by, created_at").order("expense_date", { ascending: false }),
    authorization.client.from("delivery_revenue").select("revenue_id, delivery_id, revenue_amount, tax_amount, discount_amount, net_revenue, invoice_number, revenue_date, created_at").order("revenue_date", { ascending: false }),
    authorization.client.from("vehicle_maintenance").select("maintenance_id, vehicle_id, maintenance_type, notes, cost, maintenance_date, created_at").order("maintenance_date", { ascending: false }),
  ]);
  const error = expensesResponse.error ?? revenueResponse.error ?? maintenanceResponse.error;
  if (error) return apiError(error.message, 400);

  const expenses = expensesResponse.data ?? [];
  const profileIds = Array.from(new Set(expenses.map((expense) => expense.created_by).filter((id): id is string => Boolean(id))));
  const revenue = revenueResponse.data ?? [];
  const profilesResponse = profileIds.length ? await authorization.client.from("profiles").select("profile_id, first_name, last_name, email").in("profile_id", profileIds) : { data: [], error: null };
  const deliveriesResponse = await authorization.client.from("deliveries").select("delivery_id, delivery_number, customer_name, status, assigned_driver_id, assigned_vehicle_id, updated_at").order("delivery_number", { ascending: true });
  const vehiclesResponse = await authorization.client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, status").order("vehicle_number", { ascending: true });
  const deliveries = deliveriesResponse.data ?? [];
  const driverIds = Array.from(new Set([...expenses.map((expense) => expense.driver_id), ...deliveries.map((delivery) => delivery.assigned_driver_id)].filter((id): id is string => Boolean(id))));
  const driversResponse = driverIds.length ? await authorization.client.from("drivers").select("driver_id, user_id").in("driver_id", driverIds) : { data: [], error: null };
  const driverProfileIds = Array.from(new Set((driversResponse.data ?? []).map((driver) => driver.user_id).filter((id): id is string => Boolean(id))));
  const driverProfilesResponse = driverProfileIds.length ? await authorization.client.from("profiles").select("profile_id, first_name, last_name, email").in("profile_id", driverProfileIds) : { data: [], error: null };
  const relatedError = profilesResponse.error ?? deliveriesResponse.error ?? vehiclesResponse.error ?? driversResponse.error ?? driverProfilesResponse.error;
  if (relatedError) return apiError(relatedError.message, 400);

  return Response.json({ expenses, revenue, maintenance: maintenanceResponse.data ?? [], profiles: profilesResponse.data ?? [], deliveries, vehicles: vehiclesResponse.data ?? [], drivers: driversResponse.data ?? [], driverProfiles: driverProfilesResponse.data ?? [] });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const expense = parseExpense(isRecord(body) ? body.expense : null);
  if (!expense) return apiError("Invalid expense details.", 400);
  const { error } = await authorization.client.from("expenses").insert({ ...expense, created_by: authorization.userId });
  if (error) return apiError(error.message, 400);
  const syncResult = await syncVehicleMaintenanceStatus(authorization.client, expense);
  if (syncResult.error) {
    console.error("Unable to sync expense vehicle maintenance status", { vehicleId: expense.vehicle_id, expenseType: expense.expense_type, message: syncResult.error.message });
    return apiError("Expense was saved, but the related vehicle could not be placed into maintenance. Review vehicle status before continuing.", 400);
  }
  return Response.json({ message: syncResult.warning || "Expense recorded successfully." }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const expenseId = isRecord(body) && typeof body.expense_id === "string" ? body.expense_id.trim() : "";
  const expense = parseExpense(isRecord(body) ? body.expense : null);
  if (!expenseId || !expense) return apiError("Invalid expense update request.", 400);
  const { error } = await authorization.client.from("expenses").update(expense).eq("expense_id", expenseId);
  if (error) return apiError(error.message, 400);
  const syncResult = await syncVehicleMaintenanceStatus(authorization.client, expense);
  if (syncResult.error) {
    console.error("Unable to sync expense vehicle maintenance status", { vehicleId: expense.vehicle_id, expenseType: expense.expense_type, message: syncResult.error.message });
    return apiError("Expense was saved, but the related vehicle could not be placed into maintenance. Review vehicle status before continuing.", 400);
  }
  return Response.json({ message: syncResult.warning || "Expense updated successfully." });
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const expenseId = new URL(request.url).searchParams.get("expenseId")?.trim();
  if (!expenseId) return apiError("An expense ID is required.", 400);
  const { error } = await authorization.client.from("expenses").delete().eq("expense_id", expenseId);
  if (error) return apiError(error.message, 400);
  return Response.json({ message: "Expense deleted successfully." });
}
