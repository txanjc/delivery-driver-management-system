import { createHash } from "node:crypto";

import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";

import { renderDeliverEazeEmail, type DeliverEazeEmail, type EmailTone } from "@/lib/server/email-template";

type RecipientRole = "administrator" | "dispatcher" | "driver";
type Recipient = { profileId: string; name: string; email: string; role: RecipientRole };
type EventType = "delivery_assignment" | "schedule_created" | "schedule_updated" | "schedule_cancelled" | "delivery_delayed" | "delivery_failed" | "delivery_returned" | "delivery_completed" | "vehicle_unavailable" | "route_updated" | "account_created" | "account_updated";
export type NotificationEvent = { type: EventType; key: string; title: string; message: string; tone: EmailTone; badge: string; module: string; relatedId: string; actionPath: string; driverActionPath?: string; actionLabel: string; details: Array<{ label: string; value: string | null | undefined }>; recipientIds?: string[]; driverIds?: string[]; recipientRoles?: RecipientRole[]; priority?: string | null; critical?: boolean };

type ProfileRow = { profile_id: string; first_name: string | null; last_name: string | null; email: string | null; role: string | null; is_active: boolean | null };
type NotificationDeliveryRow = { notification_id: string; email_status: "pending" | "sent" | "failed" | null; email_attempts: number | null };

function eventNotificationId(profileId: string, key: string) {
  const hex = createHash("sha256").update(`email:${profileId}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function appUrl(path: string) {
  const value = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (!value) return null;
  try {
    const base = new URL(value);
    if (!/^https?:$/.test(base.protocol)) return null;
    return new URL(path, `${base.toString().replace(/\/$/, "")}/`).toString();
  } catch { return null; }
}

function actionUrlFor(event: NotificationEvent, recipient: Recipient) {
  if (recipient.role === "driver" && event.driverActionPath && process.env.DRIVER_APP_URL) {
    const driverPath = event.driverActionPath.replace(/^\//, "");
    const driverBase = process.env.DRIVER_APP_URL;
    if (/^[a-z][a-z\d+.-]*:\/\/$/i.test(driverBase)) return `${driverBase}${driverPath}`;
    try { return new URL(driverPath, driverBase).toString(); } catch { /* Fall back to the web record. */ }
  }
  return appUrl(event.actionPath);
}

function profileName(profile: ProfileRow) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "DeliverEaze user";
}

function recipientRole(role: string | null): RecipientRole | null {
  if (role === "administrator" || role === "admin") return "administrator";
  if (role === "dispatcher" || role === "driver") return role;
  return null;
}

function validEmail(value: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

async function resolveRecipients(client: SupabaseClient, event: NotificationEvent) {
  const driverIds = [...new Set(event.driverIds ?? [])];
  const driverResponse = driverIds.length ? await client.from("drivers").select("user_id").in("driver_id", driverIds) : { data: [], error: null };
  if (driverResponse.error) throw driverResponse.error;
  const profileIds = [...new Set([...(event.recipientIds ?? []), ...(driverResponse.data ?? []).map((driver) => driver.user_id).filter((id): id is string => Boolean(id))])];
  let query = client.from("profiles").select("profile_id, first_name, last_name, email, role, is_active").eq("is_active", true);
  if (profileIds.length) query = query.in("profile_id", profileIds);
  const { data, error } = await query;
  if (error) throw error;
  const roles = event.recipientRoles ? new Set(event.recipientRoles) : null;
  return ((data ?? []) as ProfileRow[]).flatMap((profile): Recipient[] => {
    const role = recipientRole(profile.role);
    if (!role || !validEmail(profile.email) || (roles && !roles.has(role))) return [];
    return [{ profileId: profile.profile_id, name: profileName(profile), email: profile.email as string, role }];
  });
}

function roleReason(event: NotificationEvent, recipient: Recipient) {
  if (recipient.role === "driver") return "the event affects your assigned delivery, route, or schedule";
  if (recipient.role === "dispatcher") return "you are responsible for delivery operations that may need attention";
  return event.critical ? "this is a critical operational event requiring Administrator visibility" : "you have Administrator visibility over this operation";
}

function emailFor(event: NotificationEvent, recipient: Recipient, actionUrl: string): DeliverEazeEmail {
  return { recipientName: recipient.name, recipientRole: recipient.role[0].toUpperCase() + recipient.role.slice(1), title: event.title, message: event.message, tone: event.tone, badge: event.badge, reason: roleReason(event, recipient), details: event.details, actionLabel: event.actionLabel, actionUrl };
}

function smtpConfiguration() {
  const port = Number(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE === "true";
  if (!process.env.SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65_535 || secure || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM_EMAIL || !process.env.SMTP_FROM_NAME) return null;
  return { host: process.env.SMTP_HOST, port, secure: false, requireTLS: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }, tls: { minVersion: "TLSv1.2" as const } };
}

/** Creates the server-only Outlook SMTP STARTTLS transport (smtp-mail.outlook.com:587). */
export function createOutlookTransport() {
  const configuration = smtpConfiguration();
  return configuration ? nodemailer.createTransport(configuration) : null;
}

function smtpFailureMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
  if (code === "EAUTH") return "Outlook SMTP authentication failed. Confirm SMTP_USER and SMTP_PASSWORD.";
  if (["ECONNECTION", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN"].includes(code)) return "Outlook SMTP is temporarily unavailable.";
  return "Email delivery could not be completed.";
}

function isTemporarySmtpFailure(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
  const responseCode = typeof error === "object" && error !== null && "responseCode" in error && typeof error.responseCode === "number" ? error.responseCode : 0;
  return ["ECONNECTION", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN"].includes(code) || (responseCode >= 400 && responseCode < 500);
}

async function sendEmail(email: DeliverEazeEmail, recipient: Recipient) {
  const transport = createOutlookTransport();
  if (!transport) return { status: "failed" as const, error: "Outlook SMTP is not configured." };
  const logoUrl = appUrl("/images/brand/deliver-eaze-full.png");
  if (!logoUrl) return { status: "failed" as const, error: "Application URL is not configured." };
  const content = renderDeliverEazeEmail(email, logoUrl);
  const message = { to: recipient.email, from: { address: process.env.SMTP_FROM_EMAIL as string, name: process.env.SMTP_FROM_NAME as string }, subject: email.title, html: content.html, text: content.text };
  try {
    await transport.sendMail(message);
    return { status: "sent" as const, error: null };
  } catch (caught) {
    if (isTemporarySmtpFailure(caught)) {
      try { await transport.sendMail(message); return { status: "sent" as const, error: null }; } catch (retryError) {
        if (process.env.NODE_ENV === "development") console.error("Outlook SMTP retry failed:", { code: typeof retryError === "object" && retryError !== null && "code" in retryError ? retryError.code : "unknown" });
      }
    }
    if (process.env.NODE_ENV === "development") console.error("Outlook SMTP delivery failed:", { code: typeof caught === "object" && caught !== null && "code" in caught ? caught.code : "unknown" });
    return { status: "failed" as const, error: smtpFailureMessage(caught) };
  }
}

export async function sendDevelopmentSmtpTest(recipient: string) {
  const transport = createOutlookTransport();
  if (!transport) return { ok: false, error: "Outlook SMTP is not configured." };
  const actionUrl = appUrl("/admin");
  const logoUrl = appUrl("/images/brand/deliver-eaze-full.png");
  if (!actionUrl || !logoUrl) return { ok: false, error: "Application URL is not configured." };
  const content = renderDeliverEazeEmail({ recipientName: "DeliverEaze team", recipientRole: "Administrator", title: "DeliverEaze Outlook SMTP test", message: "This confirms that the DeliverEaze server can send email through Outlook SMTP.", tone: "purple", badge: "SMTP test", reason: "an Administrator requested a development SMTP test", details: [{ label: "From", value: process.env.SMTP_FROM_EMAIL }, { label: "SMTP host", value: process.env.SMTP_HOST }, { label: "Web application", value: actionUrl }], actionLabel: "Open DeliverEaze", actionUrl }, logoUrl);
  try {
    await transport.verify();
    await transport.sendMail({ to: recipient, from: { address: process.env.SMTP_FROM_EMAIL as string, name: process.env.SMTP_FROM_NAME as string }, subject: "DeliverEaze Outlook SMTP test", html: content.html, text: content.text });
    return { ok: true, error: null };
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("Outlook SMTP test failed:", { code: typeof error === "object" && error !== null && "code" in error ? error.code : "unknown" });
    return { ok: false, error: smtpFailureMessage(error) };
  }
}

/** Creates one existing in-app notification per recipient, then independently attempts email. */
export async function notifyOperationalEvent(client: SupabaseClient, event: NotificationEvent) {
  try {
    const recipients = await resolveRecipients(client, event);
    await Promise.all(recipients.map(async (recipient) => {
      const actionUrl = actionUrlFor(event, recipient);
      const notificationId = eventNotificationId(recipient.profileId, event.key);
      const { data: existing, error: existingError } = await client.from("notifications").select("notification_id, email_status, email_attempts").eq("notification_id", notificationId).maybeSingle<NotificationDeliveryRow>();
      if (existingError) throw existingError;
      if (!existing) {
        const { error } = await client.from("notifications").insert({ notification_id: notificationId, user_id: recipient.profileId, notification_type: `email:${event.type}`, title: event.title, message: event.message, delivery_id: event.module === "deliveries" ? event.relatedId : null, status: "unresolved", email_status: "pending", email_attempts: 0 });
        if (error) throw error;
      }
      if (existing?.email_status === "sent") return;
      const outcome = actionUrl ? await sendEmail(emailFor(event, recipient, actionUrl), recipient) : { status: "failed" as const, error: "Application URL is not configured." };
      const { error } = await client.from("notifications").update({ email_status: outcome.status, email_sent_at: outcome.status === "sent" ? new Date().toISOString() : null, email_error: outcome.error, email_attempts: (existing?.email_attempts ?? 0) + 1 }).eq("notification_id", notificationId);
      if (error) throw error;
    }));
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("Notification email delivery failed:", error);
  }
}

export const notificationPaths = {
  delivery: (id: string) => `/admin/deliveries?delivery=${encodeURIComponent(id)}`,
  schedule: (id: string) => `/admin/schedules?schedule=${encodeURIComponent(id)}`,
  vehicle: (id: string) => `/admin/vehicles?vehicle=${encodeURIComponent(id)}`,
  route: (id: string) => `/admin/routes?route=${encodeURIComponent(id)}`,
  user: (id: string) => `/admin/users?profile=${encodeURIComponent(id)}`,
};
