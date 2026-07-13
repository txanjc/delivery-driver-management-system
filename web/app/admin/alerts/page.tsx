"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminCard, AdminPageIntro, PrimaryActionButton } from "../_components/admin-design-system";
import { AppIcons } from "@/config/icons";
import { fetchAdministratorJson } from "@/lib/admin-api-client";
import { Skeleton } from "@/components/ui/Skeleton";

type AlertSeverity = "information" | "warning" | "error" | "success";
type NotificationRecord = { notification_id: string; notification_type: string | null; title: string | null; message: string | null; channel: string | null; read_at: string | null; created_at: string | null; sent_at: string | null; unread: boolean };
type NotificationsResponse = { notifications: NotificationRecord[]; unreadCount: number };

const modules = ["all", "drivers", "vehicles", "schedules", "deliveries", "routes", "finance", "system"];
const severities: Array<"all" | AlertSeverity> = ["all", "information", "warning", "error", "success"];

function severityFor(alert: NotificationRecord): AlertSeverity {
  const text = `${alert.notification_type ?? ""} ${alert.title ?? ""} ${alert.message ?? ""}`.toLowerCase();
  if (/(fail|failed|error|expired|ineligible|critical)/.test(text)) return "error";
  if (/(warning|delayed|delay|conflict|maintenance|expires soon|unavailable)/.test(text)) return "warning";
  if (/(success|completed|available|returned)/.test(text)) return "success";
  return "information";
}
function moduleFor(alert: NotificationRecord) {
  const type = (alert.notification_type ?? "system").toLowerCase();
  return modules.find((module) => module !== "all" && type.includes(module.slice(0, -1))) ?? "system";
}
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function relativeTime(value: string | null) { if (!value) return "Not recorded"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "Not recorded"; const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000)); if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60); if (hours < 24) return `${hours}h ago`; return `${Math.round(hours / 24)}d ago`; }
function tone(severity: AlertSeverity) { if (severity === "error") return { icon: AppIcons.cancelled, className: "border-red-100 bg-red-50 text-red-600" }; if (severity === "warning") return { icon: AppIcons.warning, className: "border-amber-100 bg-amber-50 text-amber-600" }; if (severity === "success") return { icon: AppIcons.completed, className: "border-emerald-100 bg-emerald-50 text-emerald-600" }; return { icon: AppIcons.activity, className: "border-blue-100 bg-blue-50 text-blue-600" }; }

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"all" | "unread">("all");
  const [module, setModule] = useState("all");
  const [severity, setSeverity] = useState<"all" | AlertSeverity>("all");
  const [search, setSearch] = useState("");

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdministratorJson<NotificationsResponse>("/api/admin/notifications?limit=100");
      setAlerts(data.notifications);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { queueMicrotask(() => void loadAlerts()); }, [loadAlerts]);

  const filtered = useMemo(() => alerts.filter((alert) => {
    const query = search.trim().toLowerCase();
    return (status === "all" || alert.unread) && (module === "all" || moduleFor(alert) === module) && (severity === "all" || severityFor(alert) === severity) && (!query || `${alert.title ?? ""} ${alert.message ?? ""} ${alert.notification_type ?? ""}`.toLowerCase().includes(query));
  }), [alerts, module, search, severity, status]);

  async function markRead(notificationId: string) {
    setAlerts((current) => current.map((alert) => alert.notification_id === notificationId ? { ...alert, unread: false, read_at: new Date().toISOString() } : alert));
    await fetchAdministratorJson("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notification_id: notificationId }) });
  }
  async function markAllRead() {
    setAlerts((current) => current.map((alert) => ({ ...alert, unread: false, read_at: alert.read_at ?? new Date().toISOString() })));
    await fetchAdministratorJson("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
  }

  return <section className="space-y-4 text-[#17232b]"><AdminPageIntro actions={<PrimaryActionButton disabled={!alerts.some((alert) => alert.unread)} onClick={() => void markAllRead()} type="button">Mark All Read</PrimaryActionButton>} description="Review persistent operational alerts, unread updates, and system notifications." eyebrow="Operations" title="Alerts" /><AdminCard className="p-4"><div className="grid gap-3 md:grid-cols-[1fr_140px_160px_160px]"><input aria-label="Search alerts" className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100" onChange={(event) => setSearch(event.target.value)} placeholder="Search alerts" value={search} /><select className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100" onChange={(event) => setStatus(event.target.value as "all" | "unread")} value={status}><option value="all">All</option><option value="unread">Unread</option></select><select className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100" onChange={(event) => setModule(event.target.value)} value={module}>{modules.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100" onChange={(event) => setSeverity(event.target.value as "all" | AlertSeverity)} value={severity}>{severities.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div></AdminCard>{error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Notifications could not be loaded. <button className="font-bold underline" onClick={() => void loadAlerts()} type="button">Try again</button></div> : null}<AdminCard className="overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Operational Alerts</h2><p className="mt-1 text-xs text-slate-400">{filtered.length} alert{filtered.length === 1 ? "" : "s"}</p></div>{loading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, index) => <Skeleton className="h-20 w-full" key={index} rounded="rounded-2xl" />)}</div> : filtered.length ? <div className="divide-y divide-slate-100">{filtered.map((alert) => { const alertSeverity = severityFor(alert); const alertTone = tone(alertSeverity); const Icon = alertTone.icon; return <article className={`flex gap-4 px-5 py-4 transition ${alert.unread ? "bg-purple-50/35" : "bg-white"}`} key={alert.notification_id}><span className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${alertTone.className}`}><Icon aria-hidden size={18} weight="bold" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2">{alert.unread ? <span aria-label="Unread alert" className="h-2 w-2 rounded-full bg-purple-600" /> : null}<h3 className="truncate font-semibold text-slate-950">{alert.title || label(alert.notification_type ?? "System alert")}</h3></div><p className="mt-1 text-sm leading-6 text-slate-600">{alert.message || "No message provided."}</p></div><button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40" disabled={!alert.unread} onClick={() => void markRead(alert.notification_id)} type="button">Mark read</button></div><div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-slate-400"><span>{label(moduleFor(alert))}</span><span>-</span><span>{label(alertSeverity)}</span><span>-</span><span>{relativeTime(alert.created_at ?? alert.sent_at)}</span></div></div></article>; })}</div> : <div className="px-5 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-purple-50 text-purple-600"><AppIcons.notifications aria-hidden size={22} weight="bold" /></span><h3 className="mt-4 font-semibold text-slate-900">{status === "unread" ? "You're all caught up." : "No alerts"}</h3><p className="mt-1 text-sm text-slate-500">Operational alerts and updates will appear here.</p></div>}</AdminCard></section>;
}
