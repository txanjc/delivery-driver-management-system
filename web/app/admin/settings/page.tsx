"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminCard,
  AdminPageIntro,
  SecondaryButton,
} from "../_components/admin-design-system";
import { AppIcons, type AppIconName } from "@/config/icons";
import { fetchAdministratorJson } from "@/lib/admin-api-client";
import { Skeleton } from "@/components/ui/Skeleton";
import { supabase } from "@/lib/supabase";

type Section =
  "general" | "security" | "notifications" | "permissions" | "system";
type Health = "operational" | "configuration_required" | "unavailable";
type SettingsData = {
  system: {
    name: string;
    version: string;
    environment: string;
    lastDataUpdate: string | null;
    timeZone: string;
    database: Health;
    authentication: Health;
    maps: Health;
  };
  roles: { administrator: number; dispatcher: number; driver: number };
  capabilities: {
    globalSettings: false;
    notificationPreferences: false;
    securityPolicy: false;
    granularPermissions: false;
    sms: false;
    mandatoryMfa: false;
    ipRestriction: false;
    passwordExpiration: false;
    loginLockout: false;
  };
};
type EmailDiagnosticsResult = {
  smtp: {
    variables: {
      SMTP_HOST: boolean;
      SMTP_PORT: boolean;
      SMTP_SECURE: boolean;
      SMTP_USER: boolean;
      SMTP_PASSWORD: boolean;
      SMTP_FROM_EMAIL: boolean;
      SMTP_FROM_NAME: boolean;
      APP_URL: boolean;
    };
    configured: boolean;
    verified: boolean;
    sent: boolean;
    error: string | null;
  };
  notificationEmailFields: { present: boolean; errorCode: string | null };
};
type EmailPreferenceKey = "new_delivery_assigned" | "delivery_status_updates" | "schedule_changes" | "system_alerts" | "maintenance_reminders" | "security_alerts";
type EmailPreferences = Record<EmailPreferenceKey, boolean>;

const sections: Array<{ value: Section; label: string; icon: AppIconName }> = [
  { value: "general", label: "General", icon: "settings" },
  { value: "security", label: "Security", icon: "insurance" },
  { value: "notifications", label: "Notifications", icon: "notifications" },
  { value: "permissions", label: "Roles & Permissions", icon: "users" },
  { value: "system", label: "System Information", icon: "identification" },
];
const notificationRows: Array<{ label: string; key: EmailPreferenceKey; mandatory?: boolean }> = [
  { label: "New Delivery Assigned", key: "new_delivery_assigned" },
  { label: "Delivery Status Updates", key: "delivery_status_updates" },
  { label: "Schedule Changes", key: "schedule_changes" },
  { label: "System Alerts", key: "system_alerts" },
  { label: "Maintenance Reminders", key: "maintenance_reminders" },
  { label: "Security Alerts", key: "security_alerts", mandatory: true },
];
const modules = [
  "Users",
  "Drivers",
  "Vehicles",
  "Schedules",
  "Deliveries",
  "Routes",
  "Finance",
  "Reports",
  "Settings",
];
const roleDefinitions = [
  {
    role: "Administrator",
    description: "Full system administration and configuration access.",
    modules,
  },
  {
    role: "Dispatcher",
    description:
      "Operational access for drivers, vehicles, schedules, deliveries, and routes.",
    modules: ["Drivers", "Vehicles", "Schedules", "Deliveries", "Routes"],
  },
  {
    role: "Driver",
    description:
      "Restricted access to personal schedules, assigned deliveries, routes, and notifications.",
    modules: ["Schedules", "Deliveries", "Routes"],
  },
];
function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
function healthLabel(value: Health) {
  return value === "operational"
    ? "Operational"
    : value === "configuration_required"
      ? "Configuration required"
      : "Unavailable";
}
function healthClass(value: Health) {
  return value === "operational"
    ? "bg-emerald-50 text-emerald-700"
    : value === "configuration_required"
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-600";
}

function UnsupportedField({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        className="mt-2 h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500"
        disabled
        value={value}
      />
      <span className="mt-1.5 block text-xs leading-5 text-slate-400">
        {help}
      </span>
    </label>
  );
}
function DisabledToggle({
  checked = false,
  label,
}: {
  checked?: boolean;
  label: string;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`relative h-6 w-11 cursor-not-allowed rounded-full ${checked ? "bg-purple-300" : "bg-slate-200"}`}
      disabled
      role="switch"
      type="button"
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ${checked ? "left-5.5" : "left-0.5"}`}
      />
    </button>
  );
}
function EmailToggle({ checked, disabled, label, loading, onClick }: { checked: boolean; disabled?: boolean; label: string; loading?: boolean; onClick: () => void }) {
  return <button aria-checked={checked} aria-label={label} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-purple-600" : "bg-slate-200"} ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`} disabled={disabled} onClick={onClick} role="switch" type="button"><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "left-5.5" : "left-0.5"}`}>{loading ? <span className="absolute inset-1 rounded-full border-2 border-slate-300 border-t-purple-600" /> : null}</span></button>;
}
function SettingRow({
  title,
  description,
  control,
  note,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        {note ? (
          <p className="mt-1 text-xs font-medium text-amber-700">{note}</p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <AdminCard className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="px-5 py-2">{children}</div>
    </AdminCard>
  );
}
function DiagnosticStatus({
  ok,
  label,
  successLabel = "Available",
  failureLabel = "Unavailable",
}: {
  ok: boolean | null;
  label: string;
  successLabel?: string;
  failureLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ok === null ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}
      >
        {ok === null ? "Not tested" : ok ? successLabel : failureLabel}
      </span>
    </div>
  );
}
function EmailDiagnosticsPanel() {
  const [recipient, setRecipient] = useState("");
  const [result, setResult] = useState<EmailDiagnosticsResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState<"verify" | "send" | null>(null);
  const [requestedSend, setRequestedSend] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email)
        setRecipient((current) => current || data.user?.email || "");
    });
  }, []);

  async function run(send: boolean) {
    const email = recipient.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid recipient email address.");
      return;
    }
    setRunning(send ? "send" : "verify");
    setRequestedSend(send);
    setError("");
    try {
      setResult(
        await fetchAdministratorJson<EmailDiagnosticsResult>(
          "/api/admin/email-diagnostics",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipient: email, send }),
          },
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Email diagnostics could not be completed.",
      );
    } finally {
      setRunning(null);
    }
  }
  const testEmailStatus = requestedSend ? (result?.smtp.sent ?? null) : null;

  return (
    <Panel
      description="Administrator-only diagnostic tool. It reports sanitized configuration status and never exposes SMTP credentials."
      title="Email Delivery Diagnostics"
    >
      <div className="py-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-800 ring-1 ring-purple-100 dark:bg-purple-950 dark:text-purple-200 dark:ring-purple-900">
            Gmail SMTP
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900">
            Development / Diagnostic Tool
          </span>
        </div>
        <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            DeliverEaze Logistics
          </p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            delivereazelogistics@gmail.com
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Recipient email
          </span>
          <input
            autoComplete="email"
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            disabled={running !== null}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="administrator@example.com"
            type="email"
            value={recipient}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <SecondaryButton
            aria-label="Verify SMTP Connection"
            className="relative !text-transparent"
            disabled={running !== null}
            onClick={() => void run(false)}
            type="button"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 inline-flex items-center justify-center text-slate-700"
            >
              {running === "verify"
                ? "Verifying SMTP..."
                : "Verify SMTP Connection"}
            </span>
            {running === "verify" ? "Verifying SMTP…" : "Verify SMTP"}
          </SecondaryButton>
          <button
            aria-label="Send Test Email"
            className="h-10 rounded-full bg-purple-600 px-5 text-sm font-semibold text-white shadow-sm shadow-purple-200 transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
            disabled={running !== null}
            onClick={() => void run(true)}
            type="button"
          >
            {running === "send" ? "Sending test email…" : "Send Test Email"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Gmail requires a Google app password for SMTP access. Do not use the
          normal Gmail account password.
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Diagnostic attempts are limited to three per Administrator every five
          minutes.
        </p>
        {error ? (
          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}
        {result ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Email delivery status
              </h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${result.smtp.verified ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}
              >
                {result.smtp.verified ? "Verified" : "Failed"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DiagnosticStatus
                label="SMTP configuration"
                ok={result.smtp.configured}
                successLabel="Configured"
                failureLabel="Missing"
              />
              <DiagnosticStatus
                label="Connection verification"
                ok={result.smtp.verified}
                successLabel="Verified"
                failureLabel="Failed"
              />
              <DiagnosticStatus
                label="Test email delivery"
                ok={testEmailStatus}
                successLabel="Sent"
                failureLabel="Unavailable"
              />
              <DiagnosticStatus
                label="Notification database fields"
                ok={result.notificationEmailFields.present}
                successLabel="Available"
                failureLabel="Unavailable"
              />
            </div>
            <h4 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              SMTP configuration
            </h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(result.smtp.variables).map(([name, present]) => (
                <DiagnosticStatus
                  key={name}
                  label={name}
                  ok={present}
                  successLabel="Configured"
                  failureLabel="Missing"
                />
              ))}
            </div>
            {result.smtp.verified && !requestedSend ? (
              <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                Gmail SMTP connection verified successfully.
              </p>
            ) : null}
            {result.smtp.sent && requestedSend ? (
              <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                Test email sent successfully to the selected recipient.
              </p>
            ) : null}
            {!result.notificationEmailFields.present ? (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                Notification database migration issue. Required email tracking
                fields are unavailable.
              </p>
            ) : null}
            {result.smtp.error ? (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {result.smtp.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("general");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences | null>(null);
  const [savingPreference, setSavingPreference] = useState<EmailPreferenceKey | null>(null);
  const [preferenceToast, setPreferenceToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await fetchAdministratorJson<SettingsData>("/api/admin/settings"),
      );
    } catch (caught) {
      if (process.env.NODE_ENV === "development") console.error(caught);
      setError("Settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  useEffect(() => {
    void fetchAdministratorJson<{ preferences: EmailPreferences }>("/api/notification-preferences")
      .then(({ preferences }) => setEmailPreferences(preferences))
      .catch(() => setPreferenceToast({ tone: "error", message: "Email preferences could not be loaded." }));
  }, []);
  async function updateEmailPreference(key: EmailPreferenceKey) {
    if (!emailPreferences || key === "security_alerts" || savingPreference) return;
    const previous = emailPreferences[key];
    const enabled = !previous;
    setSavingPreference(key);
    setEmailPreferences({ ...emailPreferences, [key]: enabled });
    try {
      await fetchAdministratorJson("/api/notification-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, enabled }) });
      setPreferenceToast({ tone: "success", message: "Email preference saved." });
    } catch {
      setEmailPreferences((current) => current ? { ...current, [key]: previous } : current);
      setPreferenceToast({ tone: "error", message: "Email preference could not be saved." });
    } finally {
      setSavingPreference(null);
    }
  }
  const roleCounts = useMemo(
    () => ({
      Administrator: data?.roles.administrator ?? 0,
      Dispatcher: data?.roles.dispatcher ?? 0,
      Driver: data?.roles.driver ?? 0,
    }),
    [data],
  );
  if (loading)
    return (
      <section className="space-y-5">
        <Skeleton className="h-20" rounded="rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Skeleton className="h-64" rounded="rounded-[20px]" />
          <Skeleton className="h-[520px]" rounded="rounded-[20px]" />
        </div>
      </section>
    );
  if (error || !data)
    return (
      <AdminCard className="p-10 text-center">
        <p className="text-sm font-semibold text-red-700">
          Settings could not be loaded.
        </p>
        <SecondaryButton
          className="mt-4"
          onClick={() => void load()}
          type="button"
        >
          Retry
        </SecondaryButton>
      </AdminCard>
    );
  return (
    <section className="space-y-5 text-[#17232b]">
      <AdminPageIntro
        actions={
          <div className="flex gap-2">
            <SecondaryButton disabled type="button">
              Discard Changes
            </SecondaryButton>
            <button
              className="h-10 cursor-not-allowed rounded-full bg-purple-300 px-5 text-sm font-semibold text-white"
              disabled
              type="button"
            >
              Save Changes
            </button>
          </div>
        }
        description="Manage system configuration, security, notifications, and access controls."
        eyebrow="Administration"
        title="Settings"
      />
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <AdminCard className="settings-navigation sticky top-5 overflow-hidden p-2">
          <nav
            aria-label="Settings sections"
            className="flex gap-1 overflow-x-auto lg:flex-col"
          >
            {sections.map((item) => {
              const Icon = AppIcons[item.icon];
              return (
                <button
                  aria-current={section === item.value ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition lg:w-full ${section === item.value ? "bg-purple-50 text-purple-700 ring-1 ring-purple-100" : "text-slate-600 hover:bg-slate-50"}`}
                  key={item.value}
                  onClick={() => setSection(item.value)}
                  type="button"
                >
                  <Icon aria-hidden size={17} weight="bold" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </AdminCard>
        <main className="min-w-0 space-y-5">
          {section === "general" ? (
            <>
              <Panel
                description="Current application defaults are shown read-only because no persistent global settings store exists."
                title="Organization"
              >
                <div className="grid gap-5 py-4 md:grid-cols-2">
                  <UnsupportedField
                    help="A settings store is required before this value can be changed safely."
                    label="Company name"
                    value="DeliverEaze Logistics"
                  />
                  <UnsupportedField
                    help="A settings store is required before this value can be changed safely."
                    label="Company email"
                    value="Not configured"
                  />
                  <UnsupportedField
                    help="The application currently operates in this IANA time zone."
                    label="Default time zone"
                    value={data.system.timeZone}
                  />
                  <UnsupportedField
                    help="Only English is currently supported."
                    label="Default language"
                    value="English"
                  />
                </div>
              </Panel>
              <Panel
                description="Formatting choices are fixed to formats currently used by Finance and Reports."
                title="Regional Formatting"
              >
                <div className="grid gap-5 py-4 md:grid-cols-3">
                  <UnsupportedField
                    help="Finance and Reports currently format monetary values in USD."
                    label="Currency"
                    value="USD"
                  />
                  <UnsupportedField
                    help="Application formatting is not yet configurable."
                    label="Date format"
                    value="Locale default"
                  />
                  <UnsupportedField
                    help="Application formatting is not yet configurable."
                    label="Time format"
                    value="Locale default"
                  />
                </div>
              </Panel>
              <Panel title="Display and Pagination">
                <div className="grid gap-5 py-4 md:grid-cols-2">
                  <UnsupportedField
                    help="Operational modules define pagination locally."
                    label="Default table page size"
                    value="25"
                  />
                  <UnsupportedField
                    help="The Reports preview currently shows all generated result rows."
                    label="Reports page size"
                    value="Not configurable"
                  />
                </div>
              </Panel>
            </>
          ) : null}
          {section === "security" ? (
            <>
              <Panel
                description="Authentication enforcement remains controlled by Supabase Auth and implemented server policies."
                title="Authentication"
              >
                <div className="divide-y divide-slate-100">
                  <SettingRow
                    control={
                      <DisabledToggle label="Mandatory two-factor authentication unavailable" />
                    }
                    description="Require two-factor authentication for all administrator sign-ins."
                    note="Mandatory two-factor authentication is not available until enrollment and recovery are configured."
                    title="Require two-factor authentication"
                  />
                  <SettingRow
                    control={
                      <select
                        className="h-10 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                        disabled
                      >
                        <option>Not configurable</option>
                      </select>
                    }
                    description="No application-enforced idle timeout currently exists."
                    note="Session lifetime is managed by the authentication provider."
                    title="Session timeout"
                  />
                  <SettingRow
                    control={
                      <DisabledToggle label="Password expiration unavailable" />
                    }
                    description="Periodic password expiration is not enforced by the current authentication flow."
                    note="Password expiration is unavailable."
                    title="Password expiration"
                  />
                  <SettingRow
                    control={
                      <DisabledToggle label="Login lockout unavailable" />
                    }
                    description="Failed-attempt tracking and administrator unlock workflows are not implemented."
                    note="Account lockout settings are unavailable."
                    title="Failed login attempts and lockout"
                  />
                </div>
              </Panel>
              <Panel title="Access Controls">
                <div className="divide-y divide-slate-100">
                  <SettingRow
                    control={
                      <DisabledToggle label="IP restriction unavailable" />
                    }
                    description="Restrict administrator access by network address."
                    note="IP restriction is unavailable because no IP enforcement service is configured."
                    title="IP restriction"
                  />
                  <SettingRow
                    control={
                      <DisabledToggle
                        checked
                        label="New users must change password"
                      />
                    }
                    description="Administrator-created users are required to change their temporary password."
                    title="Require password change for newly created users"
                  />
                </div>
              </Panel>
              <Panel title="Security Status">
                <dl className="grid gap-3 py-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs text-slate-500">
                      Authentication provider
                    </dt>
                    <dd className="mt-2 font-semibold">Supabase Auth</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs text-slate-500">
                      Password policy source
                    </dt>
                    <dd className="mt-2 font-semibold">
                      Authentication provider
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs text-slate-500">
                      Configuration update
                    </dt>
                    <dd className="mt-2 font-semibold">Not tracked</dd>
                  </div>
                </dl>
              </Panel>
            </>
          ) : null}
          {section === "notifications" ? (
            <Panel title="Notification Preferences">
              <div className="my-4 overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Notification</th>
                      <th className="px-4 py-3 text-center">In-App</th>
                      <th className="px-4 py-3 text-center">Email</th>
                      <th className="px-4 py-3 text-center">SMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {notificationRows.map((row) => (
                      <tr key={row.key}>
                        <td className="px-4 py-4">
                          <p className="font-semibold">{row.label}</p>
                          {row.mandatory ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Critical administrator alerts cannot be disabled.
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <DisabledToggle
                            checked
                            label={`${row.label} in-app is system managed`}
                          />
                        </td>
                        <td className="px-4 py-4 text-center">
                          {emailPreferences ? <EmailToggle checked={row.mandatory ? true : emailPreferences[row.key]} disabled={row.mandatory || savingPreference !== null} label={row.mandatory ? `${row.label} email is required` : `${row.label} email`} loading={savingPreference === row.key} onClick={() => void updateEmailPreference(row.key)} /> : <DisabledToggle label={`${row.label} email loading`} />}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <DisabledToggle label={`${row.label} SMS unavailable`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                In-app operational alerts are system managed. Email notifications
                are sent based on your selected preferences. SMS delivery is
                unavailable until a messaging provider is configured.
              </div>
              {preferenceToast ? <div className={`mb-4 rounded-xl px-4 py-3 text-xs font-medium ${preferenceToast.tone === "success" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "border border-red-100 bg-red-50 text-red-700"}`} role="status">{preferenceToast.message}</div> : null}
            </Panel>
          ) : null}
          {section === "permissions" ? (
            <Panel
              description="Access is enforced by existing role checks and row-level security. Settings does not maintain a separate permission store."
              title="Roles & Permissions"
            >
              <div className="divide-y divide-slate-100">
                {roleDefinitions.map((role) => (
                  <div
                    className="grid gap-3 py-5 md:grid-cols-[160px_minmax(0,1fr)_80px_1.4fr] md:items-center"
                    key={role.role}
                  >
                    <p className="font-semibold">{role.role}</p>
                    <p className="text-sm text-slate-500">{role.description}</p>
                    <p className="text-sm">
                      <strong>
                        {roleCounts[role.role as keyof typeof roleCounts]}
                      </strong>{" "}
                      users
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.modules.map((module) => (
                        <span
                          className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-semibold text-purple-700"
                          key={module}
                        >
                          {module}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-4 flex justify-end">
                <SecondaryButton
                  onClick={() => setPermissionsOpen(true)}
                  type="button"
                >
                  View Permission Matrix
                </SecondaryButton>
              </div>
            </Panel>
          ) : null}
          {section === "system" ? (
            <>
              <Panel
                description="Read-only information derived from the application and currently authenticated services."
                title="System Information"
              >
                <dl className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["System name", data.system.name],
                    ["Application version", data.system.version],
                    ["Environment", data.system.environment],
                    [
                      "Latest profile data update",
                      formatDate(data.system.lastDataUpdate),
                    ],
                    ["Time zone", data.system.timeZone],
                  ].map(([key, value]) => (
                    <div className="rounded-2xl bg-slate-50 p-4" key={key}>
                      <dt className="text-xs text-slate-500">{key}</dt>
                      <dd className="mt-2 font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <Panel
                description="Statuses are reported only where the current request can verify configuration or connectivity."
                title="Service Status"
              >
                <div className="divide-y divide-slate-100">
                  {[
                    ["Database connection", data.system.database],
                    ["Authentication service", data.system.authentication],
                    ["Maps service", data.system.maps],
                  ].map(([service, status]) => (
                    <div
                      className="flex items-center justify-between py-4"
                      key={service}
                    >
                      <p className="text-sm font-semibold">{service}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${healthClass(status as Health)}`}
                      >
                        {healthLabel(status as Health)}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
              <EmailDiagnosticsPanel />
            </>
          ) : null}
        </main>
      </div>
      {permissionsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
          onClick={() => setPermissionsOpen(false)}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[24px] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Role Permission Matrix
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Read-only summary of the current module-level role model.
                </p>
              </div>
              <button
                aria-label="Close permissions"
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100"
                onClick={() => setPermissionsOpen(false)}
                type="button"
              >
                <AppIcons.close aria-hidden size={16} weight="bold" />
              </button>
            </div>
            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[760px] text-center text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 text-left">Role</th>
                    {modules.map((module) => (
                      <th className="px-3 py-3" key={module}>
                        {module}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roleDefinitions.map((role) => (
                    <tr key={role.role}>
                      <td className="px-3 py-4 text-left font-semibold">
                        {role.role}
                      </td>
                      {modules.map((module) => (
                        <td className="px-3 py-4" key={module}>
                          {role.modules.includes(module) ? (
                            <AppIcons.completed
                              className="mx-auto text-emerald-600"
                              size={16}
                              weight="bold"
                            />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Mandatory administrator access and driver record scoping are
                enforced by server authorization and Supabase Row Level
                Security. Granular action-level permissions are not stored and
                cannot be edited here.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
