import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

type ExpenseInput = {
  expense_type: string;
  description: string;
  amount: number;
  expense_date: string;
  notes: string | null;
  receipt_url: string | null;
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
  const expenseType = typeof value.expense_type === "string" ? value.expense_type.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const amount = typeof value.amount === "number" ? value.amount : Number(value.amount);
  const expenseDate = typeof value.expense_date === "string" ? value.expense_date.trim() : "";
  const notes = nullableText(value.notes);
  const receiptUrl = nullableText(value.receipt_url);
  if (!expenseType || !description || !Number.isFinite(amount) || amount <= 0 || !isDate(expenseDate) || notes === undefined || receiptUrl === undefined) return null;
  if (receiptUrl) {
    try {
      const url = new URL(receiptUrl);
      if (!["http:", "https:"].includes(url.protocol)) return null;
    } catch {
      return null;
    }
  }
  return { expense_type: expenseType, description, amount: Math.round(amount * 100) / 100, expense_date: expenseDate, notes, receipt_url: receiptUrl };
}

async function requesterId(client: SupabaseClient, request: Request) {
  const token = (request.headers.get("authorization") ?? "").split(" ")[1] ?? "";
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;

  const [expensesResponse, revenueResponse, maintenanceResponse] = await Promise.all([
    authorization.client.from("expenses").select("expense_id, expense_type, description, amount, expense_date, notes, receipt_url, created_by, created_at, updated_at").order("expense_date", { ascending: false }),
    authorization.client.from("delivery_revenue").select("revenue_id, delivery_id, net_revenue, revenue_date, created_at").order("revenue_date", { ascending: false }),
    authorization.client.from("vehicle_maintenance").select("maintenance_id, vehicle_id, maintenance_type, description, cost, maintenance_date, created_at").order("maintenance_date", { ascending: false }),
  ]);
  const error = expensesResponse.error ?? revenueResponse.error ?? maintenanceResponse.error;
  if (error) return apiError(error.message, 400);

  const profileIds = Array.from(new Set((expensesResponse.data ?? []).map((expense) => expense.created_by).filter((id): id is string => Boolean(id))));
  const profilesResponse = profileIds.length ? await authorization.client.from("profiles").select("profile_id, first_name, last_name, email").in("profile_id", profileIds) : { data: [], error: null };
  if (profilesResponse.error) return apiError(profilesResponse.error.message, 400);

  return Response.json({ expenses: expensesResponse.data ?? [], revenue: revenueResponse.data ?? [], maintenance: maintenanceResponse.data ?? [], profiles: profilesResponse.data ?? [] });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const userId = await requesterId(authorization.client, request);
  if (!userId) return apiError("Authentication is required.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const expense = parseExpense(isRecord(body) ? body.expense : null);
  if (!expense) return apiError("Invalid expense details.", 400);
  const { error } = await authorization.client.from("expenses").insert({ ...expense, created_by: userId });
  if (error) return apiError(error.message, 400);
  return Response.json({ message: "Expense recorded successfully." }, { status: 201 });
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
  return Response.json({ message: "Expense updated successfully." });
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
