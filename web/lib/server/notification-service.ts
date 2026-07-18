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
type SafeError = { code: string };

function diagnostic(stage: string, details: Record<string, boolean | number | string | null | undefined> = {}) {
  console.info("[DeliverEaze email]", JSON.stringify({ stage, ...details }));
}

function safeError(error: unknown): SafeError {
  return { code: typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "unknown" };
}

function smtpEnvironmentStatus() {
  return {
    SMTP_HOST: Boolean(process.env.SMTP_HOST),
    SMTP_PORT: Boolean(process.env.SMTP_PORT),
    SMTP_SECURE: Boolean(process.env.SMTP_SECURE),
    SMTP_USER: Boolean(process.env.SMTP_USER),
    SMTP_PASSWORD: Boolean(process.env.SMTP_PASSWORD),
    SMTP_FROM_EMAIL: Boolean(process.env.SMTP_FROM_EMAIL),
    SMTP_FROM_NAME: Boolean(process.env.SMTP_FROM_NAME),
    APP_URL: Boolean(process.env.APP_URL),
  };
}

export function getSmtpConfigurationDiagnostics() {
  const variables = smtpEnvironmentStatus();
  return { variables, configured: Object.values(variables).every(Boolean) };
}

function logSmtpConfiguration() {
  const configuration = getSmtpConfigurationDiagnostics();
  diagnostic("smtp_configuration_detected", { ...configuration.variables, configured: configuration.configured });
  return configuration;
}

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
  diagnostic("recipient_lookup_started", { eventType: event.type, relatedRecordId: event.relatedId });
  const driverIds = [...new Set(event.driverIds ?? [])];
  const driverResponse = driverIds.length ? await client.from("drivers").select("user_id").in("driver_id", driverIds) : { data: [], error: null };
  if (driverResponse.error) {
    diagnostic("driver_recipient_lookup_failed", { eventType: event.type, relatedRecordId: event.relatedId, errorCode: safeError(driverResponse.error).code });
    throw driverResponse.error;
  }
  const profileIds = [...new Set([...(event.recipientIds ?? []), ...(driverResponse.data ?? []).map((driver) => driver.user_id).filter((id): id is string => Boolean(id))])];
  let query = client.from("profiles").select("profile_id, first_name, last_name, email, role, is_active");
  if (profileIds.length) query = query.in("profile_id", profileIds);
  const { data, error } = await query;
  if (error) {
    diagnostic("profile_recipient_lookup_failed", { eventType: event.type, relatedRecordId: event.relatedId, errorCode: safeError(error).code });
    throw error;
  }
  const roles = event.recipientRoles ? new Set(event.recipientRoles) : null;
  const recipients = ((data ?? []) as ProfileRow[]).flatMap((profile): Recipient[] => {
    const role = recipientRole(profile.role);
    if (profile.is_active !== true) {
      diagnostic("recipient_skipped_inactive", { eventType: event.type, relatedRecordId: event.relatedId, recipientProfileId: profile.profile_id });
      return [];
    }
    if (!validEmail(profile.email)) {
      diagnostic("recipient_skipped_missing_email", { eventType: event.type, relatedRecordId: event.relatedId, recipientProfileId: profile.profile_id });
      return [];
    }
    if (!role || (roles && !roles.has(role))) return [];
    return [{ profileId: profile.profile_id, name: profileName(profile), email: profile.email as string, role }];
  });
  diagnostic("recipients_resolved", { eventType: event.type, relatedRecordId: event.relatedId, count: recipients.length });
  return recipients;
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
  if (!process.env.SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65_535 || !secure || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM_EMAIL || !process.env.SMTP_FROM_NAME) return null;
  return { host: process.env.SMTP_HOST, port, user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD };
}

/** Creates the server-only SMTP SSL transport from environment configuration. */
export function createEmailTransport() {
  const configuration = smtpConfiguration();
  if (!configuration) return null;
  return nodemailer.createTransport({ host: configuration.host, port: configuration.port, secure: true, auth: { user: configuration.user, pass: configuration.password }, tls: { minVersion: "TLSv1.2" } });
}

function smtpFailureMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
  if (code === "EAUTH") return "Gmail rejected the SMTP login or app password. Confirm that SMTP_PASSWORD contains the Google-generated app password, not the normal Gmail password.";
  if (code === "ESOCKET") return "TLS failure: Gmail SMTP TLS connection failed.";
  if (["ECONNECTION", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN"].includes(code)) return "Connection failure: Gmail SMTP connection failed.";
  return "Email send failure: Gmail SMTP email send failed.";
}

function isTemporarySmtpFailure(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
  const responseCode = typeof error === "object" && error !== null && "responseCode" in error && typeof error.responseCode === "number" ? error.responseCode : 0;
  return ["ECONNECTION", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN"].includes(code) || (responseCode >= 400 && responseCode < 500);
}

async function sendEmail(email: DeliverEazeEmail, recipient: Recipient) {
  const transport = createEmailTransport();
  if (!transport) return { status: "failed" as const, error: "Missing configuration: Gmail SMTP is not configured." };
  const logoUrl = appUrl("/images/brand/deliver-eaze-full.png");
  if (!logoUrl) return { status: "failed" as const, error: "Missing configuration: Application URL is not configured." };
  const content = renderDeliverEazeEmail(email, logoUrl);
  const message = { to: recipient.email, from: { address: process.env.SMTP_FROM_EMAIL as string, name: process.env.SMTP_FROM_NAME as string }, subject: email.title, html: content.html, text: content.text };
  try {
    diagnostic("smtp_send_started", { recipientProfileId: recipient.profileId });
    await transport.sendMail(message);
    diagnostic("smtp_send_succeeded", { recipientProfileId: recipient.profileId });
    return { status: "sent" as const, error: null };
  } catch (caught) {
    const error = safeError(caught);
    if (error.code === "EAUTH") diagnostic("smtp_authentication_failed", { recipientProfileId: recipient.profileId, errorCode: error.code });
    else if (["ECONNECTION", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ESOCKET"].includes(error.code)) diagnostic("smtp_connection_failed", { recipientProfileId: recipient.profileId, errorCode: error.code });
    else diagnostic("smtp_send_failed", { recipientProfileId: recipient.profileId, errorCode: error.code });
    if (isTemporarySmtpFailure(caught)) {
      try {
        diagnostic("smtp_send_retry_started", { recipientProfileId: recipient.profileId });
        await transport.sendMail(message);
        diagnostic("smtp_send_succeeded", { recipientProfileId: recipient.profileId, retry: true });
        return { status: "sent" as const, error: null };
      } catch (retryError) {
        diagnostic("smtp_send_failed", { recipientProfileId: recipient.profileId, errorCode: safeError(retryError).code, retry: true });
      }
    }
    return { status: "failed" as const, error: smtpFailureMessage(caught) };
  }
}

export async function inspectNotificationEmailFields(client: SupabaseClient) {
  const { error } = await client.from("notifications").select("email_status, email_sent_at, email_error, email_attempts").limit(1);
  return { present: !error, errorCode: error ? safeError(error).code : null };
}

export async function runSmtpDiagnostic(recipient: string, sendEmailMessage: boolean) {
  const configuration = logSmtpConfiguration();
  const transport = createEmailTransport();
  if (!transport) return { configuration, verified: false, sent: false, error: "Missing configuration: Gmail SMTP is not configured." };
  const actionUrl = appUrl("/admin");
  const logoUrl = appUrl("/images/brand/deliver-eaze-full.png");
  if (!actionUrl || !logoUrl) return { configuration, verified: false, sent: false, error: "Missing configuration: Application URL is not configured." };
  try {
    await transport.verify();
    diagnostic("smtp_transport_verified");
    if (!sendEmailMessage) return { configuration, verified: true, sent: false, error: null };
    const content = renderDeliverEazeEmail({ recipientName: "DeliverEaze team", recipientRole: "Administrator", title: "DeliverEaze Gmail SMTP diagnostic", message: "This is a clearly labelled administrator-requested Gmail SMTP diagnostic email.", tone: "purple", badge: "SMTP diagnostic", reason: "an Administrator requested an SMTP diagnostic", details: [{ label: "From", value: process.env.SMTP_FROM_EMAIL }, { label: "Web application", value: actionUrl }], actionLabel: "Open DeliverEaze", actionUrl }, logoUrl);
    diagnostic("smtp_send_started", { diagnostic: true });
    await transport.sendMail({ to: recipient, from: { address: process.env.SMTP_FROM_EMAIL as string, name: process.env.SMTP_FROM_NAME as string }, subject: "DeliverEaze Gmail SMTP diagnostic", html: content.html, text: content.text });
    diagnostic("smtp_send_succeeded", { diagnostic: true });
    return { configuration, verified: true, sent: true, error: null };
  } catch (error) {
    const detail = safeError(error);
    if (detail.code === "EAUTH") diagnostic("smtp_authentication_failed", { errorCode: detail.code, diagnostic: true });
    else if (["ECONNECTION", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ESOCKET"].includes(detail.code)) diagnostic("smtp_connection_failed", { errorCode: detail.code, diagnostic: true });
    else diagnostic("smtp_send_failed", { errorCode: detail.code, diagnostic: true });
    return { configuration, verified: false, sent: false, error: smtpFailureMessage(error) };
  }
}

export async function sendDevelopmentSmtpTest(recipient: string) {
  const result = await runSmtpDiagnostic(recipient, true);
  return { ok: result.verified && result.sent, error: result.error };
}

/** Creates one existing in-app notification per recipient, then independently attempts email. */
export async function notifyOperationalEvent(client: SupabaseClient, event: NotificationEvent) {
  try {
    diagnostic("notification_event_received", { eventType: event.type, relatedRecordId: event.relatedId });
    logSmtpConfiguration();
    const recipients = await resolveRecipients(client, event);
    await Promise.all(recipients.map(async (recipient) => {
      const actionUrl = actionUrlFor(event, recipient);
      const notificationId = eventNotificationId(recipient.profileId, event.key);
      const { data: existing, error: existingError } = await client.from("notifications").select("notification_id, email_status, email_attempts").eq("notification_id", notificationId).maybeSingle<NotificationDeliveryRow>();
      if (existingError) {
        diagnostic("notification_row_lookup_failed", { eventType: event.type, relatedRecordId: event.relatedId, errorCode: safeError(existingError).code });
        throw existingError;
      }
      if (!existing) {
        const { error } = await client.from("notifications").insert({ notification_id: notificationId, user_id: recipient.profileId, notification_type: `email:${event.type}`, title: event.title, message: event.message, delivery_id: event.module === "deliveries" ? event.relatedId : null, status: "unresolved", email_status: "pending", email_attempts: 0 });
        if (error) {
          diagnostic("notification_row_create_failed", { eventType: event.type, relatedRecordId: event.relatedId, errorCode: safeError(error).code });
          throw error;
        }
        diagnostic("notification_row_created", { eventType: event.type, relatedRecordId: event.relatedId, recipientProfileId: recipient.profileId });
      }
      if (existing?.email_status === "sent") {
        diagnostic("duplicate_notification_skipped", { eventType: event.type, relatedRecordId: event.relatedId, recipientProfileId: recipient.profileId });
        return;
      }
      const outcome = actionUrl ? await sendEmail(emailFor(event, recipient, actionUrl), recipient) : { status: "failed" as const, error: "Missing configuration: Application URL is not configured." };
      const { error } = await client.from("notifications").update({ email_status: outcome.status, email_sent_at: outcome.status === "sent" ? new Date().toISOString() : null, email_error: outcome.error, email_attempts: (existing?.email_attempts ?? 0) + 1 }).eq("notification_id", notificationId);
      if (error) {
        diagnostic("email_status_write_failed", { eventType: event.type, relatedRecordId: event.relatedId, errorCode: safeError(error).code });
        throw error;
      }
      diagnostic("email_status_written", { eventType: event.type, relatedRecordId: event.relatedId, recipientProfileId: recipient.profileId, status: outcome.status });
    }));
  } catch (error) {
    diagnostic("notification_service_failed", { eventType: event.type, relatedRecordId: event.relatedId, errorCode: safeError(error).code });
  }
}

export const notificationPaths = {
  delivery: (id: string) => `/admin/deliveries?delivery=${encodeURIComponent(id)}`,
  schedule: (id: string) => `/admin/schedules?schedule=${encodeURIComponent(id)}`,
  vehicle: (id: string) => `/admin/vehicles?vehicle=${encodeURIComponent(id)}`,
  route: (id: string) => `/admin/routes?route=${encodeURIComponent(id)}`,
  user: (id: string) => `/admin/users?profile=${encodeURIComponent(id)}`,
};
