import { apiError, requireAdministratorAal2 } from "@/lib/server/administrator-api";
import { sendDevelopmentSmtpTest } from "@/lib/server/notification-service";

export const runtime = "nodejs";

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const authorization = await requireAdministratorAal2(request);
  if (!authorization.client) return authorization.response;
  const body: unknown = await request.json().catch(() => null);
  const recipient = typeof body === "object" && body !== null && "recipient" in body ? body.recipient : null;
  if (!isValidEmail(recipient)) return apiError("A valid test recipient email address is required.", 400);
  const result = await sendDevelopmentSmtpTest(recipient.trim());
  if (!result.ok) return apiError(result.error ?? "SMTP test failed.", 502);
  return Response.json({ message: "Gmail SMTP test email sent." });
}
