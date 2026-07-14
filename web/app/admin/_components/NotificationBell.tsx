"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppIcons } from "@/config/icons";
import { fetchAdministratorJson } from "@/lib/admin-api-client";
import {
  moduleLabel,
  type OperationalAlert,
  type OperationalAlertsResponse,
} from "@/lib/operational-alerts";
import { supabase } from "@/lib/supabase";

import { AppModalShell } from "./AppModalShell";

type AlertTone = { icon: typeof AppIcons.activity; className: string };

function reportNotificationError(error: unknown) {
  if (process.env.NODE_ENV === "development") console.error("Notification UI request failed:", error);
}

function toneFor(alert: OperationalAlert): AlertTone {
  if (alert.severity === "error") return { icon: AppIcons.cancelled, className: "bg-red-50 text-red-600 ring-red-100" };
  if (alert.severity === "warning") return { icon: AppIcons.warning, className: "bg-amber-50 text-amber-600 ring-amber-100" };
  if (alert.severity === "success") return { icon: AppIcons.completed, className: "bg-emerald-50 text-emerald-600 ring-emerald-100" };
  if (alert.module === "vehicles") return { icon: AppIcons.vehicles, className: "bg-blue-50 text-blue-600 ring-blue-100" };
  if (alert.module === "routes") return { icon: AppIcons.routes, className: "bg-indigo-50 text-indigo-600 ring-indigo-100" };
  if (alert.module === "drivers") return { icon: AppIcons.drivers, className: "bg-violet-50 text-violet-600 ring-violet-100" };
  if (alert.module === "schedules") return { icon: AppIcons.schedules, className: "bg-purple-50 text-purple-600 ring-purple-100" };
  if (alert.module === "deliveries") return { icon: AppIcons.deliveries, className: "bg-purple-50 text-purple-600 ring-purple-100" };
  return { icon: AppIcons.activity, className: "bg-slate-100 text-slate-600 ring-slate-200" };
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

function recordLabel(alert: OperationalAlert) {
  return alert.recordLabel ?? alert.relatedRecordId?.slice(0, 8) ?? "No record";
}

function AlertRow({ alert, compact, onNavigate }: { alert: OperationalAlert; compact?: boolean; onNavigate?: () => void }) {
  const tone = toneFor(alert);
  const Icon = tone.icon;

  return (
    <article className={`flex w-full gap-3 rounded-2xl text-left transition hover:bg-slate-50 ${compact ? "px-3 py-3" : "border border-slate-100 bg-white px-4 py-3 shadow-sm shadow-slate-950/[0.03]"} ${alert.isUnread ? "bg-purple-50/50" : ""}`}>
      <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${tone.className}`}>
        <Icon aria-hidden size={18} weight="bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-950">{alert.title}</span>
            <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">{alert.message}</span>
          </span>
          <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${alert.isResolved ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : alert.isUnread ? "bg-purple-50 text-purple-700 ring-1 ring-purple-100" : "bg-slate-100 text-slate-600"}`}>
            {alert.isResolved ? "Resolved" : alert.isUnread ? "Unread" : "Read"}
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-400">
          <span>{moduleLabel(alert.module)}</span>
          <span aria-hidden="true">/</span>
          <span>{recordLabel(alert)}</span>
          <span aria-hidden="true">/</span>
          <span>{relativeTime(alert.createdAt)}</span>
        </span>
        {!compact && alert.actionHref ? <Link className="mt-2 inline-flex rounded-full bg-purple-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm shadow-purple-200 transition hover:bg-purple-700" href={alert.actionHref} onClick={onNavigate}>{alert.actionLabel ?? "Review"}</Link> : null}
      </span>
    </article>
  );
}

function ModalAlertRow({ alert, onNavigate, onReadChange, updating }: { alert: OperationalAlert; onNavigate: () => void; onReadChange: (alert: OperationalAlert, isRead: boolean) => void; updating: boolean }) {
  const tone = toneFor(alert);
  const Icon = tone.icon;
  const isRead = !alert.isUnread;
  return (
    <article className={`grid min-h-24 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 px-5 py-4 transition-colors sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:gap-4 ${isRead ? "bg-slate-50 text-slate-500" : "bg-white"}`} data-read={isRead}>
      <label className="grid h-6 w-6 cursor-pointer place-items-center" title={isRead ? "Mark unread" : "Mark read"}>
        <input aria-label={`${isRead ? "Mark unread" : "Mark read"}: ${alert.title}`} checked={isRead} className="peer sr-only" disabled={updating} onChange={(event) => onReadChange(alert, event.target.checked)} type="checkbox" />
        <span className="grid h-5 w-5 place-items-center rounded-md border border-slate-300 bg-white text-transparent transition peer-checked:border-purple-600 peer-checked:bg-purple-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-purple-200 peer-disabled:cursor-wait peer-disabled:opacity-60"><AppIcons.check aria-hidden size={13} weight="bold" /></span>
      </label>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${isRead ? "bg-slate-100 text-slate-400 ring-slate-200" : tone.className}`}><Icon aria-hidden size={16} weight="bold" /></span>
      <div className="min-w-0">
        <div className="flex items-center gap-2"><h3 className={`truncate text-sm ${isRead ? "font-semibold text-slate-600" : "font-bold text-slate-950"}`}>{alert.title}</h3>{!isRead ? <span aria-label="Unread" className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-600" /> : null}</div>
        <p className={`mt-0.5 line-clamp-2 text-xs leading-5 ${isRead ? "text-slate-500" : "text-slate-600"}`}>{alert.message}</p>
        <p className="mt-1.5 truncate text-[11px] font-medium text-slate-400">{moduleLabel(alert.module)} <span aria-hidden>•</span> {recordLabel(alert)} <span aria-hidden>•</span> {relativeTime(alert.createdAt)}</p>
      </div>
      {alert.actionHref ? <Link className="col-start-3 inline-flex h-9 w-fit items-center rounded-full bg-purple-600 px-4 text-xs font-bold text-white shadow-sm shadow-purple-200 transition hover:bg-purple-700 sm:col-start-4 sm:row-start-1" href={alert.actionHref} onClick={onNavigate}>{alert.actionLabel ?? "Review"}</Link> : null}
    </article>
  );
}

export function NotificationBell({ onUnreadCountChange }: { onUnreadCountChange?: (count: number) => void }) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [notifications, setNotifications] = useState<OperationalAlert[]>([]);
  const [allAlerts, setAllAlerts] = useState<OperationalAlert[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [updatingAlertIds, setUpdatingAlertIds] = useState<Set<string>>(() => new Set());
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const recent = useMemo(() => notifications.slice(0, 5), [notifications]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdministratorJson<OperationalAlertsResponse>("/api/admin/notifications?limit=5&status=unresolved");
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setUnresolvedCount(data.unresolvedCount);
      onUnreadCountChange?.(data.unreadCount);
    } catch (caught) {
      reportNotificationError(caught);
      setError("Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  const loadAllAlerts = useCallback(async (showLoading = true) => {
    if (showLoading) setModalLoading(true);
    setModalError("");
    try {
      const data = await fetchAdministratorJson<OperationalAlertsResponse>("/api/admin/notifications?limit=100&status=all");
      setAllAlerts(data.alerts);
      setUnreadCount(data.unreadCount);
      setUnresolvedCount(data.unresolvedCount);
      onUnreadCountChange?.(data.unreadCount);
    } catch (caught) {
      reportNotificationError(caught);
      setModalError("Notifications could not be loaded.");
    } finally {
      if (showLoading) setModalLoading(false);
    }
  }, [onUnreadCountChange]);

  async function setAlertRead(alert: OperationalAlert, isRead: boolean) {
    setUpdatingAlertIds((current) => new Set(current).add(alert.id));
    setModalError("");
    try {
      await fetchAdministratorJson("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alert_id: alert.id, is_read: isRead }) });
      await Promise.all([loadNotifications(), modalOpen ? loadAllAlerts(false) : Promise.resolve()]);
    } catch (caught) {
      reportNotificationError(caught);
      setModalError("Alert read state could not be updated.");
    } finally {
      setUpdatingAlertIds((current) => { const next = new Set(current); next.delete(alert.id); return next; });
    }
  }

  async function markAllRead() {
    setMarkingAllRead(true);
    setModalError("");
    try {
      await fetchAdministratorJson("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      await Promise.all([loadNotifications(), modalOpen ? loadAllAlerts(false) : Promise.resolve()]);
    } catch (caught) {
      reportNotificationError(caught);
      setModalError("Alerts could not be marked as read.");
    } finally {
      setMarkingAllRead(false);
    }
  }

  function openAlertsModal() {
    setOpen(false);
    setModalOpen(true);
    void loadAllAlerts();
  }

  function closeAlertsModal() {
    setModalOpen(false);
  }

  useEffect(() => { queueMicrotask(() => void loadNotifications()); }, [loadNotifications]);
  useEffect(() => {
    const channel = supabase.channel("admin-notifications-bell").on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
      void loadNotifications();
      if (modalOpen) void loadAllAlerts();
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadAllAlerts, loadNotifications, modalOpen]);
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !open) return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button aria-controls="notifications-menu" aria-expanded={open} aria-haspopup="dialog" aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900" onClick={() => setOpen((value) => !value)} ref={buttonRef} type="button">
        <AppIcons.notifications aria-hidden size={19} weight="bold" />
        {unreadCount ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_24px_70px_-24px_rgba(15,23,42,.28)] ring-1 ring-slate-900/5 backdrop-blur-xl" id="notifications-menu" ref={popoverRef} role="dialog">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="font-bold text-slate-950">Notifications</h2>
              <p className="text-xs text-slate-400">{unresolvedCount} unresolved <span aria-hidden>•</span> {unreadCount} unread</p>
            </div>
            <button className="text-xs font-semibold text-purple-700 transition hover:text-purple-900 disabled:text-slate-300" disabled={!unreadCount || loading || markingAllRead} onClick={() => void markAllRead()} type="button">Mark all read</button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? Array.from({ length: 4 }).map((_, index) => <div className="m-2 h-16 animate-pulse rounded-xl bg-slate-100" key={index} />) : error ? <div className="p-4 text-sm text-slate-600"><p>{error}</p><button className="mt-2 text-xs font-bold text-purple-700 hover:text-purple-900" onClick={() => void loadNotifications()} type="button">Retry</button></div> : recent.length ? recent.map((alert) => (
              <div key={alert.id}>
                <AlertRow alert={alert} compact onNavigate={() => setOpen(false)} />
                {alert.isUnread ? <button className="ml-16 -mt-1 mb-2 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:text-slate-300" disabled={updatingAlertIds.has(alert.id)} onClick={() => void setAlertRead(alert, true)} type="button">Mark read</button> : null}
              </div>
            )) : <div className="px-4 py-8 text-center"><p className="font-semibold text-slate-800">You&apos;re all caught up.</p><p className="mt-1 text-sm text-slate-500">Operational alerts and updates will appear here.</p></div>}
          </div>
          <div className="border-t border-slate-100 p-2">
            <button className="block w-full rounded-xl px-3 py-2 text-center text-sm font-semibold text-purple-700 transition hover:bg-purple-50" onClick={openAlertsModal} type="button">View all alerts</button>
          </div>
        </div>
      ) : null}

      <AppModalShell
        dialogClassName="flex max-h-[min(760px,calc(100dvh-32px))] w-[min(920px,calc(100vw-48px))] flex-col overflow-hidden rounded-[24px] border border-white/85 bg-white text-slate-900 shadow-[0_34px_110px_-34px_rgba(15,23,42,.75),0_0_0_1px_rgba(139,92,246,.10)] ring-1 ring-purple-100/70 backdrop-blur-xl"
        initialFocusRef={modalCloseRef}
        label="All alerts"
        onClose={closeAlertsModal}
        open={modalOpen}
        returnFocusRef={buttonRef}
      >
              <header className="shrink-0 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">All Alerts</h2>
                    <p className="mt-1 text-sm text-slate-500">{unresolvedCount} unresolved alerts <span aria-hidden>•</span> {unreadCount} unread</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="h-9 rounded-full border border-purple-100 px-4 text-xs font-bold text-purple-700 transition hover:bg-purple-50 disabled:border-slate-100 disabled:text-slate-300" disabled={!unreadCount || modalLoading || markingAllRead} onClick={() => void markAllRead()} type="button">Mark All Read</button>
                    <button aria-label="Close alerts modal" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-purple-50 hover:text-purple-700" onClick={closeAlertsModal} ref={modalCloseRef} type="button"><AppIcons.close aria-hidden size={17} weight="bold" /></button>
                  </div>
                </div>
              </header>
              <div className="user-modal-scrollbar min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4">
                {modalLoading ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white divide-y divide-slate-100">{Array.from({ length: 6 }).map((_, index) => <div className="h-24 animate-pulse bg-white" key={index} />)}</div>
                ) : allAlerts.length ? (
                  <><div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-950/[0.03] divide-y divide-slate-100">{allAlerts.map((alert) => <ModalAlertRow alert={alert} key={alert.id} onNavigate={closeAlertsModal} onReadChange={(item, isRead) => void setAlertRead(item, isRead)} updating={updatingAlertIds.has(alert.id)} />)}</div>{modalError ? <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{modalError}</p> : null}</>
                ) : modalError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><p>{modalError}</p><button className="mt-3 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100" onClick={() => void loadAllAlerts()} type="button">Retry</button></div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><AppIcons.completed aria-hidden size={22} weight="bold" /></span>
                    <h3 className="mt-4 font-semibold text-slate-900">No alerts</h3>
                    <p className="mt-1 text-sm text-slate-500">Operational alerts and notifications will appear here.</p>
                  </div>
                )}
              </div>
      </AppModalShell>
    </div>
  );
}
