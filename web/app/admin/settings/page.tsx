"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AdminCard,
  PrimaryActionButton,
  SecondaryButton,
} from "../_components/admin-design-system";
import { fetchAdministratorJson } from "@/lib/admin-api-client";

type SettingsData = {
  system: {
    name: string;
    version: string;
    environment: string;
    lastUpdated: string;
    timeZone: string;
  };
  roles: { administrator: number; dispatcher: number; driver: number };
};
type ConfigState = {
  companyName: string;
  companyEmail: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
  pageSize: string;
  reportPageSize: string;
  language: string;
};
type SecurityState = {
  mfa: boolean;
  timeout: string;
  passwordExpiration: string;
  loginLimit: string;
  ipRestriction: boolean;
};
type NotificationChannel = "email" | "inApp" | "sms";
type NotificationState = Record<string, Record<NotificationChannel, boolean>>;

const modules = ["Users", "Drivers", "Vehicles", "Schedules", "Deliveries", "Routes", "Finance", "Reports", "Settings"];
const permissionRows = [
  { role: "Administrator", allowed: modules },
  { role: "Dispatcher", allowed: ["Users", "Drivers", "Vehicles", "Schedules", "Deliveries", "Routes"] },
  { role: "Driver", allowed: ["Deliveries", "Routes", "Finance"] },
];
const defaultConfig: ConfigState = {
  companyName: "DeliverEaze Logistics",
  companyEmail: "admin@delivereaze.com",
  currency: "USD - US Dollar",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12 Hour (AM/PM)",
  pageSize: "25",
  reportPageSize: "50",
  language: "English",
};
const defaultSecurity: SecurityState = {
  mfa: true,
  timeout: "30",
  passwordExpiration: "90",
  loginLimit: "5",
  ipRestriction: false,
};
const notificationTypes = [
  "New Delivery Assigned",
  "Delivery Status Updates",
  "Schedule Changes",
  "System Alerts",
  "Maintenance Reminders",
  "Security Alerts",
];
const defaultNotifications: NotificationState = Object.fromEntries(
  notificationTypes.map((type) => [
    type,
    {
      email: type !== "Maintenance Reminders",
      inApp: true,
      sms: ["System Alerts", "Security Alerts"].includes(type),
    },
  ]),
) as NotificationState;

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`relative h-5 w-9 rounded-full transition ${
        checked ? "bg-blue-600" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      type="button"
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
          checked ? "left-4" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-blue-50 text-xs text-blue-600">
        *
      </span>
      {children}
    </h2>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [config, setConfig] = useState(defaultConfig);
  const [security, setSecurity] = useState(defaultSecurity);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setData(await fetchAdministratorJson<SettingsData>("/api/admin/settings"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load settings.");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  const input =
    "mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100";
  const roleCounts = useMemo(
    () => ({
      Administrator: data?.roles.administrator ?? 0,
      Dispatcher: data?.roles.dispatcher ?? 0,
      Driver: data?.roles.driver ?? 0,
    }),
    [data],
  );

  async function save(scope: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetchAdministratorJson<{ message: string }>(
        "/api/admin/settings",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, config, security, notifications }),
        },
      );
      setMessage(response.message);
      window.setTimeout(() => setMessage(""), 4500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 text-[#17232b]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-sm shadow-blue-200">
            *
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.035em]">Settings</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure system settings, security options, notifications, and user permissions.
            </p>
          </div>
        </div>
        <PrimaryActionButton
          className="h-10 px-5 text-sm"
          disabled={saving}
          onClick={() => void save("all")}
          type="button"
        >
          Save All Changes
        </PrimaryActionButton>
      </div>

      {message ? (
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
          <AdminCard className="p-5">
            <SectionTitle>System Information</SectionTitle>
            <div className="grid gap-3 md:grid-cols-5">
              {[
                ["System Name", data?.system.name ?? "DeliverEaze DDMS"],
                ["Version", data?.system.version ?? "v0.1.0"],
                ["Environment", data?.system.environment ?? "Production"],
                ["Last Updated", data ? formatDateTime(data.system.lastUpdated) : "Loading..."],
                ["Time Zone", data?.system.timeZone ?? "(UTC-04:00) Atlantic Time (ET)"],
              ].map(([label, value]) => (
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-3" key={label}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-xs text-blue-600">
                    *
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-800">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard className="p-5">
              <SectionTitle>System Configuration</SectionTitle>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
                <Field label="Company Name">
                  <input
                    className={input}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, companyName: event.target.value }))
                    }
                    value={config.companyName}
                  />
                </Field>
                <Field label="Company Email">
                  <input
                    className={input}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, companyEmail: event.target.value }))
                    }
                    type="email"
                    value={config.companyEmail}
                  />
                </Field>
                <Field label="Currency">
                  <select
                    className={input}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, currency: event.target.value }))
                    }
                    value={config.currency}
                  >
                    <option>USD - US Dollar</option>
                  </select>
                </Field>
                <Field label="Date Format">
                  <select
                    className={input}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, dateFormat: event.target.value }))
                    }
                    value={config.dateFormat}
                  >
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </Field>
                <Field label="Time Format">
                  <select
                    className={input}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, timeFormat: event.target.value }))
                    }
                    value={config.timeFormat}
                  >
                    <option>12 Hour (AM/PM)</option>
                    <option>24 Hour</option>
                  </select>
                </Field>
                <Field label="Default Page Size">
                  <select
                    className={input}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, pageSize: event.target.value }))
                    }
                    value={config.pageSize}
                  >
                    <option>25</option>
                    <option>50</option>
                  </select>
                </Field>
                <Field label="Items Per Page (Reports)">
                  <select
                    className={input}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, reportPageSize: event.target.value }))
                    }
                    value={config.reportPageSize}
                  >
                    <option>50</option>
                    <option>100</option>
                  </select>
                </Field>
                <Field label="Language">
                  <select
                    className={input}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, language: event.target.value }))
                    }
                    value={config.language}
                  >
                    <option>English</option>
                  </select>
                </Field>
              </div>
              <PrimaryActionButton
                className="mt-4 h-9 px-4 text-xs"
                disabled={saving}
                onClick={() => void save("configuration")}
                type="button"
              >
                Update Configuration
              </PrimaryActionButton>
            </AdminCard>

            <AdminCard className="p-5">
              <SectionTitle>Security Settings</SectionTitle>
              <div className="divide-y divide-slate-100">
                {[
                  [
                    "Two-Factor Authentication (2FA)",
                    "Require 2FA for administrator logins",
                    <Toggle
                      checked={security.mfa}
                      key="mfa"
                      onChange={(value) =>
                        setSecurity((current) => ({ ...current, mfa: value }))
                      }
                    />,
                  ],
                  [
                    "Session Timeout (minutes)",
                    "Automatically logs out inactive users",
                    <select
                      className="h-9 rounded-lg border border-slate-200 px-3 text-xs"
                      key="timeout"
                      onChange={(event) =>
                        setSecurity((current) => ({ ...current, timeout: event.target.value }))
                      }
                      value={security.timeout}
                    >
                      <option>30</option>
                      <option>60</option>
                    </select>,
                  ],
                  [
                    "Password Expiration (days)",
                    "Require password change after expired days",
                    <select
                      className="h-9 rounded-lg border border-slate-200 px-3 text-xs"
                      key="password"
                      onChange={(event) =>
                        setSecurity((current) => ({
                          ...current,
                          passwordExpiration: event.target.value,
                        }))
                      }
                      value={security.passwordExpiration}
                    >
                      <option>90</option>
                      <option>180</option>
                    </select>,
                  ],
                  [
                    "Login Attempt Limit",
                    "Lock account after failed login attempts",
                    <select
                      className="h-9 rounded-lg border border-slate-200 px-3 text-xs"
                      key="limit"
                      onChange={(event) =>
                        setSecurity((current) => ({ ...current, loginLimit: event.target.value }))
                      }
                      value={security.loginLimit}
                    >
                      <option>5</option>
                      <option>10</option>
                    </select>,
                  ],
                  [
                    "IP Restriction",
                    "Displayed disabled because no existing IP restriction backend is present",
                    <Toggle checked={security.ipRestriction} disabled key="ip" />,
                  ],
                ].map(([title, help, control]) => (
                  <div className="flex items-center justify-between gap-4 py-2.5" key={String(title)}>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{help}</p>
                    </div>
                    {control}
                  </div>
                ))}
              </div>
              <PrimaryActionButton
                className="mt-4 h-9 px-4 text-xs"
                disabled={saving}
                onClick={() => void save("security")}
                type="button"
              >
                Update Security Settings
              </PrimaryActionButton>
            </AdminCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <AdminCard className="p-5">
              <SectionTitle>Notification Preferences</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-2">Notification Type</th>
                      <th>Email</th>
                      <th>In-App</th>
                      <th>SMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {notificationTypes.map((type) => (
                      <tr key={type}>
                        <td className="py-2 font-medium">{type}</td>
                        {(["email", "inApp", "sms"] as NotificationChannel[]).map((channel) => (
                          <td key={channel}>
                            <Toggle
                              checked={notifications[type][channel]}
                              disabled={
                                channel === "sms" &&
                                !["System Alerts", "Security Alerts"].includes(type)
                              }
                              onChange={(value) =>
                                setNotifications((current) => ({
                                  ...current,
                                  [type]: { ...current[type], [channel]: value },
                                }))
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PrimaryActionButton
                className="mt-4 h-9 px-4 text-xs"
                disabled={saving}
                onClick={() => void save("notifications")}
                type="button"
              >
                Save Notification Settings
              </PrimaryActionButton>
            </AdminCard>

            <AdminCard className="p-5">
              <SectionTitle>User Permissions</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-center text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2.5 py-2.5 text-left">Role</th>
                      {modules.map((module) => (
                        <th className="px-2.5 py-2.5" key={module}>
                          {module}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {permissionRows.map((row) => (
                      <tr key={row.role}>
                        <td className="px-2.5 py-2.5 text-left font-semibold">
                          {row.role}
                          <span className="ml-2 font-normal text-slate-400">
                            {roleCounts[row.role as keyof typeof roleCounts]}
                          </span>
                        </td>
                        {modules.map((module) => {
                          const allowed = row.allowed.includes(module);
                          return (
                            <td className="px-2.5 py-2.5" key={module}>
                              <span
                                className={`inline-grid h-5 w-5 place-items-center rounded-full border text-[10px] ${
                                  allowed
                                    ? "border-emerald-200 text-emerald-600"
                                    : "border-red-200 text-red-500"
                                }`}
                              >
                                {allowed ? "o" : "x"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <SecondaryButton
                className="mt-4 h-9 px-4 text-xs"
                onClick={() =>
                  setMessage("Roles are managed through existing RBAC in the Users module.")
                }
                type="button"
              >
                Manage Roles & Permissions
              </SecondaryButton>
            </AdminCard>
          </div>
      </div>

      <AdminCard className="p-4 text-xs text-slate-500">
        Save All Changes validates configuration updates against the current backend. Persistent
        global settings require an existing settings store in the finalized schema.
      </AdminCard>
    </section>
  );
}
