import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

type RevenueInput = {
  delivery_id: string;
  revenue_amount: number;
  tax_amount: number;
  discount_amount: number;
  net_revenue: number;
  invoice_number: string | null;
  revenue_date: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableText(value: unknown) {
  return value === null || value === undefined ? null : typeof value === "string" ? value.trim() || null : undefined;
}

function moneyValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function isDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime());
}

function parseRevenue(value: unknown): RevenueInput | null {
  if (!isRecord(value)) return null;
  const deliveryId = typeof value.delivery_id === "string" ? value.delivery_id.trim() : "";
  const gross = moneyValue(value.revenue_amount);
  const tax = moneyValue(value.tax_amount ?? 0);
  const discount = moneyValue(value.discount_amount ?? 0);
  const invoiceNumber = nullableText(value.invoice_number);
  const revenueDate = typeof value.revenue_date === "string" ? value.revenue_date.trim() : "";
  if (!deliveryId || gross === null || tax === null || discount === null || invoiceNumber === undefined || !isDate(revenueDate)) return null;
  if (gross < 0 || tax < 0 || discount < 0 || discount > gross + tax) return null;
  const net = Math.round((gross + tax - discount) * 100) / 100;
  return { delivery_id: deliveryId, revenue_amount: gross, tax_amount: tax, discount_amount: discount, net_revenue: net, invoice_number: invoiceNumber, revenue_date: revenueDate };
}

export async function POST(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const revenue = parseRevenue(isRecord(body) ? body.revenue : null);
  if (!revenue) return apiError("Invalid revenue details.", 400);

  const existingDelivery = await authorization.client.from("delivery_revenue").select("revenue_id", { count: "exact", head: true }).eq("delivery_id", revenue.delivery_id);
  if (existingDelivery.error) return apiError(existingDelivery.error.message, 400);
  if ((existingDelivery.count ?? 0) > 0) return apiError("This delivery already has a revenue record.", 409);

  if (revenue.invoice_number) {
    const existingInvoice = await authorization.client.from("delivery_revenue").select("revenue_id", { count: "exact", head: true }).eq("invoice_number", revenue.invoice_number);
    if (existingInvoice.error) return apiError(existingInvoice.error.message, 400);
    if ((existingInvoice.count ?? 0) > 0) return apiError("This invoice number is already in use.", 409);
  }

  const { error } = await authorization.client.from("delivery_revenue").insert(revenue);
  if (error) return apiError(error.message, 400);
  return Response.json({ message: "Revenue recorded successfully." }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  const revenueId = isRecord(body) && typeof body.revenue_id === "string" ? body.revenue_id.trim() : "";
  const revenue = parseRevenue(isRecord(body) ? body.revenue : null);
  if (!revenueId || !revenue) return apiError("Invalid revenue details.", 400);

  const existingRevenue = await authorization.client.from("delivery_revenue").select("revenue_id").eq("revenue_id", revenueId).maybeSingle();
  if (existingRevenue.error) return apiError(existingRevenue.error.message, 400);
  if (!existingRevenue.data) return apiError("Revenue record was not found.", 404);

  const existingDelivery = await authorization.client.from("delivery_revenue").select("revenue_id", { count: "exact", head: true }).eq("delivery_id", revenue.delivery_id).neq("revenue_id", revenueId);
  if (existingDelivery.error) return apiError(existingDelivery.error.message, 400);
  if ((existingDelivery.count ?? 0) > 0) return apiError("This delivery already has a revenue record.", 409);

  if (revenue.invoice_number) {
    const existingInvoice = await authorization.client.from("delivery_revenue").select("revenue_id", { count: "exact", head: true }).eq("invoice_number", revenue.invoice_number).neq("revenue_id", revenueId);
    if (existingInvoice.error) return apiError(existingInvoice.error.message, 400);
    if ((existingInvoice.count ?? 0) > 0) return apiError("This invoice number is already in use.", 409);
  }

  const { error } = await authorization.client.from("delivery_revenue").update(revenue).eq("revenue_id", revenueId);
  if (error) return apiError(error.message, 400);
  return Response.json({ message: "Revenue updated successfully." });
}
