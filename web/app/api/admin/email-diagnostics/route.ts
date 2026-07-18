import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";
import { inspectNotificationEmailFields, runSmtpDiagnostic } from "@/lib/server/notification-service";

export const runtime = "nodejs";

const attemptsByAdministrator = new Map<string, { count: number; resetAt: number }>();
const maximumAttempts = 3;
const windowMs = 5 * 60 * 1000;

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function canRunDiagnostic(userId: string) {
  const now = Date.now();
  const current = attemptsByAdministrator.get(userId);
  if (!current || current.resetAt <= now) {
    attemptsByAdministrator.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= maximumAttempts) return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function POST(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response ?? apiError("Administrator authorization failed.", 403);
  if (!authorization.userId) return apiError("Administrator authorization failed.", 403);
  const rateLimit = canRunDiagnostic(authorization.userId);
  if (!rateLimit.allowed) return Response.json({ error: "Too many diagnostic requests. Try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });

  const body: unknown = await request.json().catch(() => null);
  const recipient = typeof body === "object" && body !== null && "recipient" in body ? body.recipient : null;
  const send = typeof body === "object" && body !== null && "send" in body && body.send === true;
  if (!isValidEmail(recipient)) return apiError("A valid diagnostic recipient email address is required.", 400);

  const [smtp, notificationFields] = await Promise.all([
    runSmtpDiagnostic(recipient.trim(), send),
    inspectNotificationEmailFields(authorization.client),
  ]);
  return Response.json({
    smtp: { variables: smtp.configuration.variables, configured: smtp.configuration.configured, verified: smtp.verified, sent: smtp.sent, error: smtp.error },
    notificationEmailFields: notificationFields,
  });
}
