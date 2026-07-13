"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppIcons } from "@/config/icons";
import { fetchAdministratorJson } from "@/lib/admin-api-client";
import { supabase } from "@/lib/supabase";

type AlertSeverity = "information" | "warning" | "error" | "success";
type NotificationRecord = {
  notification_id: string;
  notification_type: string | null;
  title: string | null;
  message: string | null;
  channel: string | null;
  read_at: string | null;
  created_at: string | null;
  sent_at: string | null;
  unread: boolean;
};
type NotificationsResponse = { notifications: NotificationRecord[]; unreadCount: number };

function severityFor(type: string | null, title: string | null, message: string | null): AlertSeverity {
  const text = `${type ?? ""} ${title ?? ""} ${message ?? ""}`.toLowerCase();
  if (/(fail|failed|error|expired|ineligible|critical)/.test(text)) return "error";
  if (/(warning|delayed|delay|conflict|maintenance|expires soon|unavailable)/.test(text)) return "warning";
  if (/(success|completed|available|returned)/.test(text)) return "success";
  return "information";
}

function toneFor(severity: AlertSeverity) {
  if (severity === "error") return { icon: AppIcons.cancelled, className: "bg-red-50 text-red-600 ring-red-100" };
  if (severity === "warning") return { icon: AppIcons.warning, className: "bg-amber-50 text-amber-600 ring-amber-100" };
  if (severity === "success") return { icon: AppIcons.completed, className: "bg-emerald-50 text-emerald-600 ring-emerald-100" };
  return { icon: AppIcons.activity, className: "bg-blue-50 text-blue-600 ring-blue-100" };
}

function relativeTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function moduleLabel(type: string | null) {
  const value = (type ?? "System").replaceAll("_", " ");
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((notification) => notification.unread).length;
  const recent = useMemo(() => notifications.slice(0, 8), [notifications]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdministratorJson<NotificationsResponse>("/api/admin/notifications?limit=8");
      setNotifications(data.notifications);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function markRead(notificationId: string) {
    setNotifications((current) => current.map((item) => item.notification_id === notificationId ? { ...item, unread: false, read_at: new Date().toISOString() } : item));
    await fetchAdministratorJson("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notification_id: notificationId }) });
  }

  async function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false, read_at: item.read_at ?? new Date().toISOString() })));
    await fetchAdministratorJson("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
  }

  useEffect(() => { queueMicrotask(() => void loadNotifications()); }, [loadNotifications]);
  useEffect(() => {
    const channel = supabase.channel("admin-notifications-bell").on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void loadNotifications()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadNotifications]);
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return <div className="relative"><button aria-controls="notifications-menu" aria-expanded={open} aria-haspopup="dialog" aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900" onClick={() => setOpen((value) => !value)} ref={buttonRef} type="button"><AppIcons.notifications aria-hidden size={19} weight="bold" />{unreadCount ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}</button>{open ? <div className="absolute right-0 z-50 mt-3 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_24px_70px_-24px_rgba(15,23,42,.28)] ring-1 ring-slate-900/5 backdrop-blur-xl" id="notifications-menu" ref={popoverRef} role="dialog"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="font-bold text-slate-950">Notifications</h2><button className="text-xs font-semibold text-purple-700 transition hover:text-purple-900 disabled:text-slate-300" disabled={!unreadCount || loading} onClick={() => void markAllRead()} type="button">Mark all as read</button></div><div className="max-h-96 overflow-y-auto p-2">{loading ? Array.from({ length: 4 }).map((_, index) => <div className="m-2 h-16 animate-pulse rounded-xl bg-slate-100" key={index} />) : error ? <div className="p-4 text-sm text-red-600">{error}</div> : recent.length ? recent.map((notification) => { const severity = severityFor(notification.notification_type, notification.title, notification.message); const tone = toneFor(severity); const Icon = tone.icon; return <button className={`flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 ${notification.unread ? "bg-purple-50/50" : ""}`} key={notification.notification_id} onClick={() => void markRead(notification.notification_id)} type="button"><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${tone.className}`}><Icon aria-hidden size={17} weight="bold" /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="truncate text-sm font-bold text-slate-900">{notification.title || moduleLabel(notification.notification_type)}</span>{notification.unread ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-purple-600" aria-label="Unread" /> : null}</span><span className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{notification.message || "No message provided."}</span><span className="mt-1 block text-[11px] font-medium text-slate-400">{moduleLabel(notification.notification_type)} - {relativeTime(notification.created_at ?? notification.sent_at)}</span></span></button>; }) : <div className="px-4 py-8 text-center"><p className="font-semibold text-slate-800">No alerts</p><p className="mt-1 text-sm text-slate-500">Operational alerts and updates will appear here.</p></div>}</div><div className="border-t border-slate-100 p-2"><Link className="block rounded-xl px-3 py-2 text-center text-sm font-semibold text-purple-700 transition hover:bg-purple-50" href="/admin/alerts" onClick={() => setOpen(false)}>View all alerts</Link></div></div> : null}</div>;
}
