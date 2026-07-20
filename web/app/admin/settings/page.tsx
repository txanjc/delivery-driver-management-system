"use client";

import {
  type KeyboardEvent,
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AdminCard,
  AdminPageIntro,
  SecondaryButton,
} from "../_components/admin-design-system";
import { AppIcons, type AppIconName } from "@/config/icons";
import { fetchAdministratorJson } from "@/lib/admin-api-client";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNotify } from "@/components/ui/ToastProvider";
import { supabase } from "@/lib/supabase";
import { PlacesAddressInput, type SelectedPlace } from "@/components/routes/PlacesAddressInput";

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
type EmailPreferenceKey = "new_delivery_assigned" | "delivery_status_updates" | "schedule_changes" | "system_alerts" | "maintenance_reminders" | "security_alerts";
type EmailPreferences = Record<EmailPreferenceKey, boolean>;
type CompanySettingsLocation = {
  operating_location_name: string | null;
  operating_address: string | null;
  operating_place_id: string | null;
  operating_latitude: number | null;
  operating_longitude: number | null;
};
type CompanySettingsResponse = { companySettings: CompanySettingsLocation | null };

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

function selectedPlaceFromLocation(location: CompanySettingsLocation | null): SelectedPlace | null {
  if (
    !location?.operating_address ||
    !location.operating_place_id ||
    typeof location.operating_latitude !== "number" ||
    typeof location.operating_longitude !== "number"
  ) return null;
  return {
    formattedAddress: location.operating_address,
    placeId: location.operating_place_id,
    latitude: location.operating_latitude,
    longitude: location.operating_longitude,
  };
}

function OperatingLocationSettings() {
  const notify = useNotify();
  const [savedLocation, setSavedLocation] = useState<CompanySettingsLocation | null>(null);
  const [locationName, setLocationName] = useState("DeliverEaze Warehouse");
  const [address, setAddress] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const restoreSavedLocation = useCallback((location: CompanySettingsLocation | null) => {
    setLocationName(location?.operating_location_name?.trim() || "DeliverEaze Warehouse");
    setAddress(location?.operating_address ?? "");
    setSelectedPlace(selectedPlaceFromLocation(location));
  }, []);

  const loadLocation = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { companySettings } = await fetchAdministratorJson<CompanySettingsResponse>("/api/operations/company-settings");
      setSavedLocation(companySettings);
      restoreSavedLocation(companySettings);
    } catch {
      setError("Company operating location could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [restoreSavedLocation]);

  useEffect(() => {
    queueMicrotask(() => void loadLocation());
  }, [loadLocation]);

  function selectPlace(place: SelectedPlace) {
    setSelectedPlace(place);
    setAddress(place.formattedAddress);
    setError("");
  }

  function changeAddress(value: string) {
    setAddress(value);
    if (selectedPlace?.formattedAddress !== value) setSelectedPlace(null);
  }

  async function save() {
    if (!selectedPlace || !locationName.trim() || saving) {
      setError("Select a valid address from Google Places before saving the operating location.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { companySettings } = await fetchAdministratorJson<CompanySettingsResponse>("/api/admin/settings/company-location", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationName: locationName.trim(),
          formattedAddress: selectedPlace.formattedAddress,
          placeId: selectedPlace.placeId,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
        }),
      });
      setSavedLocation(companySettings);
      restoreSavedLocation(companySettings);
      window.dispatchEvent(new CustomEvent("company-settings-location-updated", { detail: companySettings }));
      notify.success("Operating location saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Company operating location could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const savedAddress = savedLocation?.operating_address;
  const valid = Boolean(selectedPlace);
  return (
    <Panel description="Set the default warehouse used as the starting point for optimized multi-stop routes." title="Operating Location">
      <div className="grid gap-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Location name</span>
          <input className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100" disabled={loading || saving} onChange={(event) => setLocationName(event.target.value)} value={locationName} />
          <span className="mt-1.5 block text-xs leading-5 text-slate-500">Suggested name: DeliverEaze Warehouse</span>
        </label>
        <PlacesAddressInput className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" id="company-operating-location" label="Address search" onPlaceSelect={selectPlace} onTextChange={changeAddress} value={address} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">Saved formatted address</p>
            <p className="mt-1 text-sm text-slate-600">{loading ? "Loading operating location…" : savedAddress || "Not configured"}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${valid ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{valid ? "Valid Google Places location" : "Not configured"}</span>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="h-10 rounded-full bg-purple-600 px-5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300" disabled={loading || saving || !selectedPlace || !locationName.trim()} onClick={() => void save()} type="button">{saving ? "Saving…" : "Save operating location"}</button>
        <SecondaryButton disabled={loading || saving} onClick={() => { restoreSavedLocation(savedLocation); setError(""); }} type="button">Cancel changes</SecondaryButton>
      </div>
    </Panel>
  );
}
/*
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

*/
/*
type MfaFactor = { id: string; status: string; factor_type: string; friendly_name?: string };
function MfaSettingsRow() {
  const [factors, setFactors] = useState<MfaFactor[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null); const [code, setCode] = useState(""); const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null); const [removing, setRemoving] = useState<string | null>(null);
  const refresh = useCallback(async () => { setLoading(true); const { data, error } = await supabase.auth.mfa.listFactors(); if (error) setMessage({ error: true, text: "Authenticator status could not be loaded." }); else setFactors(((data?.totp ?? []) as MfaFactor[])); const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); if (aal?.nextLevel === "aal2" && !setup) setMessage({ error: false, text: "Verification required for this session." }); setLoading(false); }, [setup]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);
  async function begin() { setBusy(true); setMessage(null); const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: factors.length ? "Backup authenticator" : "Authenticator" }); if (error || !data) setMessage({ error: true, text: "Authenticator setup could not be started." }); else setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }); setBusy(false); }
  async function verify() { if (!setup || !/^\d{6}$/.test(code)) { setMessage({ error: true, text: "Enter a six-digit authenticator code." }); return; } setBusy(true); const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: setup.id }); if (challengeError || !challenge) { setMessage({ error: true, text: "Authenticator verification could not be started." }); setBusy(false); return; } const { error } = await supabase.auth.mfa.verify({ factorId: setup.id, challengeId: challenge.id, code }); if (error) setMessage({ error: true, text: "The authenticator code could not be verified. Try again." }); else { setSetup(null); setCode(""); setMessage({ error: false, text: "Authenticator factor verified successfully." }); await refresh(); } setBusy(false); }
  async function cancel() { if (!setup) return; setBusy(true); await supabase.auth.mfa.unenroll({ factorId: setup.id }); setSetup(null); setCode(""); setMessage({ error: false, text: "Incomplete authenticator setup cancelled." }); setBusy(false); }
  async function remove(id: string) { if (!window.confirm("Remove this authenticator factor?")) return; setRemoving(id); const { error } = await supabase.auth.mfa.unenroll({ factorId: id }); if (error) setMessage({ error: true, text: "Authenticator factor could not be removed." }); else { setMessage({ error: false, text: "Authenticator factor removed." }); await refresh(); } setRemoving(null); }
  const verified = factors.filter((factor) => factor.status === "verified");
  return <div className="py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-800">Two-factor authentication</p><p className="mt-1 text-xs leading-5 text-slate-500">{loading ? "Checking authenticator status..." : setup ? "Setup incomplete. Scan the code and verify it to finish." : verified.length ? "Two-factor authentication is active for this account." : "Add an authenticator app for additional sign-in protection."}</p></div><SecondaryButton disabled={busy || loading || Boolean(setup)} onClick={() => void begin()} type="button">{verified.length ? "Add backup authenticator" : "Add authenticator"}</SecondaryButton></div><p className="mt-3 text-xs leading-5 text-amber-700">Authenticator verification is required at sign-in for accounts with an enrolled factor.</p>{verified.length ? <a className="mt-2 inline-block text-xs font-semibold text-purple-700" href="/verify-mfa?returnTo=/admin/settings">Phase 2 verification test</a> : null}{setup ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold">Set up authenticator</p><img alt="Authenticator setup QR code" className="mt-3 h-40 w-40 rounded-lg bg-white p-2" src={setup?.qr ?? ""} /><p className="mt-3 text-xs text-slate-500">Manual setup key: <span className="font-mono text-slate-700">{setup?.secret ?? ""}</span></p><label className="mt-3 block text-sm font-medium">Six-digit code<input className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} value={code} /></label><div className="mt-3 flex gap-2"><button className="h-10 rounded-full bg-purple-600 px-4 text-sm font-semibold text-white disabled:bg-purple-300" disabled={busy} onClick={() => void verify()} type="button">Verify authenticator</button><SecondaryButton disabled={busy} onClick={() => void cancel()} type="button">Cancel setup</SecondaryButton></div></div> : null}{verified.length ? <div className="mt-4 space-y-2">{verified.map((factor, index) => <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2" key={factor.id}><span className="text-sm">{factor.friendly_name || `Authenticator ${index + 1}`}</span><button className="text-sm font-semibold text-red-600 disabled:text-slate-300" disabled={removing === factor.id} onClick={() => void remove(factor.id)} type="button">Remove factor</button></div>)}<p className="text-xs leading-5 text-slate-500">Add a backup authenticator factor to reduce the risk of losing access.</p></div> : null}{message ? <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.error ? "border border-red-100 bg-red-50 text-red-700" : "border border-emerald-100 bg-emerald-50 text-emerald-700"}`}>{message.text}</p> : null}</div>;
}

*/
type MfaFactor = { id: string; status: string; factor_type: string; friendly_name?: string; created_at?: string | null };
type MfaSetup = { id: string; qr: string; secret: string };

type MfaEnrollmentSetupProps = {
  busy: boolean;
  code: string;
  copied: boolean;
  digits: string[];
  inputRefs: MutableRefObject<Array<HTMLInputElement | null>>;
  manualOpen: boolean;
  onCancel: () => void;
  onCopy: () => void;
  onDigitChange: (index: number, value: string) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (index: number, value: string) => void;
  onVerify: () => void;
  setManualOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setup: MfaSetup;
};

function MfaEnrollmentSetup({
  busy,
  code,
  copied,
  digits,
  inputRefs,
  manualOpen,
  onCancel,
  onCopy,
  onDigitChange,
  onKeyDown,
  onPaste,
  onVerify,
  setManualOpen,
  setup,
}: MfaEnrollmentSetupProps) {
  const CopyIcon = AppIcons.clipboard;

  return (
    <div className="mx-auto mt-5 max-w-[960px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 shadow-sm shadow-slate-200/50">
      <div className="grid gap-8 p-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:p-6">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 1</p>
          <h3 className="mt-2 text-base font-semibold text-slate-800">Scan the QR code</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Scan this code with Google Authenticator, Microsoft Authenticator, Authy, or another compatible app.</p>
          <div className="mt-5 w-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <img alt="Authenticator setup QR code" className="h-40 w-40 rounded-lg" src={setup?.qr ?? ""} />
          </div>
          <button aria-expanded={manualOpen} className="mt-3 text-sm font-semibold text-purple-800 transition hover:text-purple-900" onClick={() => setManualOpen((current) => !current)} type="button">Can’t scan the code?</button>
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 2</p>
          <h3 className="mt-2 text-base font-semibold text-slate-800">Enter the verification code</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Enter the 6-digit code generated by your authenticator app.</p>
          <div aria-label="Six-digit verification code" className="mt-5 flex gap-2.5 sm:gap-3" role="group">
            {digits.map((digit, index) => (
              <input
                aria-label={`Verification digit ${index + 1}`}
                className="h-[60px] w-14 shrink-0 rounded-xl border border-slate-200 bg-white text-center text-xl font-semibold text-slate-900 outline-none transition hover:border-purple-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                inputMode="numeric"
                key={index}
                maxLength={1}
                onChange={(event) => onDigitChange(index, event.target.value)}
                onKeyDown={(event) => onKeyDown(index, event)}
                onPaste={(event) => {
                  event.preventDefault();
                  onPaste(index, event.clipboardData.getData("text"));
                }}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                value={digit}
              />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="h-11 rounded-xl bg-purple-600 px-5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300" disabled={busy || code.length !== 6} onClick={onVerify} type="button">
              {busy ? "Verifying…" : "Verify authenticator"}
            </button>
            <SecondaryButton className="!h-11 !rounded-xl !px-5" disabled={busy} onClick={onCancel} type="button">Cancel setup</SecondaryButton>
          </div>
        </section>
      </div>
      {manualOpen ? (
        <div className="border-t border-slate-200 bg-white/70 px-5 py-4 md:px-6">
          <p className="text-sm font-semibold text-slate-700">Manual setup key</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">{setup.secret}</code>
            <button className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-purple-800 transition hover:bg-purple-50" onClick={onCopy} type="button">
              <CopyIcon aria-hidden size={14} weight="bold" />
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Enter this key manually in your authenticator app.</p>
        </div>
      ) : null}
    </div>
  );
}

function MfaSettingsRow() {
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [manualOpen, setManualOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const notify = useNotify();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const verified = factors.filter((factor) => factor.status === "verified");
  const code = digits.join("");
  const ShieldIcon = AppIcons.insurance;

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) notify.error("Authenticator status could not be loaded.");
    else setFactors((data?.totp ?? []) as MfaFactor[]);
    setLoading(false);
  }, [notify]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  async function begin() {
    setBusy(true);
    const incompleteFactors = factors.filter(
      (factor) =>
        factor.factor_type === "totp" && factor.status === "unverified",
    );
    for (const factor of incompleteFactors) {
      const { error: cleanupError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (cleanupError) {
        notify.error("An incomplete authenticator setup could not be cleared. Try again.");
        setBusy(false);
        return;
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: verified.length
        ? `Backup authenticator ${verified.length}`
        : "Authenticator",
    });
    if (error || !data) notify.error("Authenticator setup could not be started.");
    else { setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }); setDigits(["", "", "", "", "", ""]); setManualOpen(false); setCopied(false); }
    setBusy(false);
  }
  async function verify() {
    if (!setup || code.length !== 6) { notify.error("Enter a six-digit authenticator code."); return; }
    setBusy(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: setup.id });
    if (challengeError || !challenge) { notify.error("Authenticator verification could not be started."); setBusy(false); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: setup.id, challengeId: challenge.id, code });
    if (error) notify.error("The authenticator code could not be verified. Try again.");
    else { setSetup(null); setDigits(["", "", "", "", "", ""]); setManualOpen(false); notify.success("Authenticator factor verified successfully."); await refresh(); }
    setBusy(false);
  }
  async function cancel() {
    if (!setup) return; setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: setup.id });
    if (error) notify.error("Incomplete authenticator setup could not be cancelled.");
    else { setSetup(null); setDigits(["", "", "", "", "", ""]); setManualOpen(false); notify.success("Incomplete authenticator setup cancelled."); }
    setBusy(false);
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this authenticator factor?")) return;
    setRemoving(id); const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) notify.error("Authenticator factor could not be removed.");
    else { notify.success("Authenticator factor removed."); await refresh(); }
    setRemoving(null);
  }
  async function copyManualKey() {
    if (!setup) return;
    try { await navigator.clipboard.writeText(setup.secret); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { notify.error("The manual setup key could not be copied."); }
  }
  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }
  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) { event.preventDefault(); inputRefs.current[index - 1]?.focus(); }
    if (event.key === "ArrowRight" && index < 5) { event.preventDefault(); inputRefs.current[index + 1]?.focus(); }
  }
  function onPaste(index: number, text: string) {
    const pasted = text.replace(/\D/g, "").slice(0, 6); if (!pasted) return;
    setDigits((current) => { const next = [...current]; [...pasted].forEach((digit, offset) => { if (index + offset < 6) next[index + offset] = digit; }); return next; });
    inputRefs.current[Math.min(index + pasted.length, 5)]?.focus();
  }
  const status = setup ? "Setup incomplete" : verified.length ? "Enabled" : "Not set up";

  return <div className="mfa-settings py-4">
    <style>{`
      .mfa-settings .dark\\:bg-slate-900 { background-color: #ffffff !important; }
      .mfa-settings .dark\\:bg-slate-800 { background-color: #f8fafc !important; }
      .mfa-settings .dark\\:border-slate-700 { border-color: #e2e8f0 !important; }
      .mfa-settings .dark\\:text-slate-100 { color: #1e293b !important; }
      .mfa-settings .dark\\:text-slate-200 { color: #334155 !important; }
      .mfa-settings .dark\\:text-slate-300,
      .mfa-settings .dark\\:text-slate-400 { color: #64748b !important; }
    `}</style>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Two-factor authentication</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${setup ? "border border-amber-200 bg-amber-50 text-amber-700 dark:!border-amber-200 dark:!bg-amber-50 dark:!text-amber-700" : verified.length ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:!border-emerald-200 dark:!bg-emerald-50 dark:!text-emerald-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{loading ? "Checking…" : status}</span></div><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{loading ? "Checking authenticator status..." : setup ? "Finish connecting your authenticator app to protect future sign-ins." : verified.length ? "Your authenticator is ready to protect future sign-ins." : "Set up an authenticator app to protect future sign-ins."}</p></div>
      {verified.length && !setup ? <SecondaryButton disabled={busy || loading} onClick={() => void begin()} type="button">Add backup authenticator</SecondaryButton> : null}
    </div>
    {!loading && !setup && !verified.length ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Protect your account with an authenticator app</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Use a time-based code from an authenticator app when you sign in.</p><button className="mt-4 h-10 rounded-full bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300" disabled={busy} onClick={() => void begin()} type="button">{busy ? "Starting setup…" : "Set up authenticator"}</button></div> : null}
    {setup ? <MfaEnrollmentSetup busy={busy} code={code} copied={copied} digits={digits} inputRefs={inputRefs} manualOpen={manualOpen} onCancel={() => void cancel()} onCopy={() => void copyManualKey()} onDigitChange={setDigit} onKeyDown={onKeyDown} onPaste={onPaste} onVerify={() => void verify()} setManualOpen={setManualOpen} setup={setup} /> : null}
    {setup && false ? <div className="mt-4 grid gap-5 rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-sm shadow-slate-200/50 backdrop-blur-sm md:grid-cols-2">
      <div><p className="text-base font-semibold text-slate-800 dark:text-slate-100">Scan with your authenticator app</p><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Use Google Authenticator, Microsoft Authenticator, Authy, or another compatible app.</p><div className="mt-4 flex w-fit flex-col items-center rounded-2xl border border-purple-100 bg-purple-50 p-3"><img alt="Authenticator setup QR code" className="h-48 w-48 rounded-xl bg-white p-2 shadow-sm shadow-purple-100" src={setup?.qr ?? ""} /><button aria-expanded={manualOpen} className="mt-3 text-center text-sm font-semibold text-purple-800 hover:text-purple-900 dark:!text-purple-800" onClick={() => setManualOpen((value) => !value)} type="button">Can’t scan the code?</button></div><div className="mt-3 min-h-[132px]">{manualOpen ? <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Manual setup key</p><code className="mt-2 block break-all rounded-lg bg-slate-100 px-2 py-1.5 font-mono text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-100">{setup?.secret ?? ""}</code><button className="mt-2 text-sm font-semibold text-purple-800 hover:text-purple-900 dark:!text-purple-800" onClick={() => void copyManualKey()} type="button">{copied ? "Copied" : "Copy key"}</button></div> : null}</div></div>
      <div className="flex flex-col justify-center"><label className="text-base font-semibold text-slate-800 dark:text-slate-100">Verification code</label><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Enter the six-digit code from your authenticator app.</p><div aria-label="Six-digit verification code" className="mt-4 flex gap-2" role="group">{digits.map((digit, index) => <input aria-label={`Verification digit ${index + 1}`} className="h-12 w-12 shrink-0 sm:h-14 sm:w-14 rounded-xl border border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-purple-950" inputMode="numeric" key={index} maxLength={1} onChange={(event) => setDigit(index, event.target.value)} onKeyDown={(event) => onKeyDown(index, event)} onPaste={(event) => { event.preventDefault(); onPaste(index, event.clipboardData.getData("text")); }} ref={(element) => { inputRefs.current[index] = element; }} value={digit} />)}</div><div className="mt-4 flex flex-wrap gap-2"><button className="h-11 rounded-full bg-purple-600 px-5 text-base font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300" disabled={busy || code.length !== 6} onClick={() => void verify()} type="button">{busy ? "Verifying…" : "Verify authenticator"}</button><SecondaryButton className="!h-11 !px-5 !text-base" disabled={busy} onClick={() => void cancel()} type="button">Cancel setup</SecondaryButton></div></div>
    </div> : null}
    {!loading && verified.length && !setup ? <div className="mt-4 space-y-2">{verified.map((factor, index) => <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900" key={factor.id}><div className="flex min-w-0 items-start gap-2"><ShieldIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" /><div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{factor.friendly_name || `Authenticator ${index + 1}`}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Authenticator app{factor.created_at ? ` · Added ${formatDate(factor.created_at)}` : ""}</p></div></div><button className="text-left text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:text-slate-300 sm:text-right" disabled={removing === factor.id || busy} onClick={() => void remove(factor.id)} type="button">{removing === factor.id ? "Removing…" : "Remove factor"}</button></div>)}</div> : null}
  </div>;
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("general");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences | null>(null);
  const [savingPreference, setSavingPreference] = useState<EmailPreferenceKey | null>(null);
  const notify = useNotify();
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
      .catch(() => notify.error("Email preferences could not be loaded."));
  }, [notify]);
  async function updateEmailPreference(key: EmailPreferenceKey) {
    if (!emailPreferences || key === "security_alerts" || savingPreference) return;
    const previous = emailPreferences[key];
    const enabled = !previous;
    setSavingPreference(key);
    setEmailPreferences({ ...emailPreferences, [key]: enabled });
    try {
      await fetchAdministratorJson("/api/notification-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, enabled }) });
      notify.success("Email preference saved.");
    } catch {
      setEmailPreferences((current) => current ? { ...current, [key]: previous } : current);
      notify.error("Email preference could not be saved.");
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
      <section className="space-y-5 text-[#17232b]">
        <AdminPageIntro
          description="Manage system configuration, security, notifications, and access controls."
          eyebrow="Administration"
          loading
          title="Settings"
        />
        <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <AdminCard className="self-start p-2">
            <div className="space-y-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton className="h-10 w-full" key={index} rounded="rounded-xl" />
              ))}
            </div>
          </AdminCard>
          <div className="space-y-6">
            <AdminCard className="overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <Skeleton className="h-5 w-40" rounded="rounded-full" />
                <Skeleton className="mt-2 h-3 w-80 max-w-full" rounded="rounded-full" />
              </div>
              <div className="space-y-5 p-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="flex items-center justify-between gap-4" key={index}>
                    <div className="min-w-0 flex-1"><Skeleton className="h-4 w-40" rounded="rounded-full" /><Skeleton className="mt-2 h-3 w-64 max-w-full" rounded="rounded-full" /></div>
                    <Skeleton className="h-6 w-11" rounded="rounded-full" />
                  </div>
                ))}
              </div>
            </AdminCard>
            <AdminCard className="p-5">
              <Skeleton className="h-5 w-36" rounded="rounded-full" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-24 w-full" key={index} rounded="rounded-2xl" />)}</div>
            </AdminCard>
          </div>
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
              <OperatingLocationSettings />
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
                description="Manage sign-in protection and authenticator settings for your account."
                title="Authentication"
              >
                <div className="divide-y divide-slate-100">
                  <MfaSettingsRow />
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
