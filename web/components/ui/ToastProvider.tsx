"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AppIcons } from "@/config/icons";

export type ToastType = "success" | "error" | "warning" | "information";

type ToastAction = { label: string; onClick: () => void };
type ToastInput = { title?: string; message: string; type?: ToastType; duration?: number; dismissible?: boolean; action?: ToastAction };
type ToastRecord = Required<Pick<ToastInput, "message" | "type" | "duration" | "dismissible">> & { id: string; title?: string; action?: ToastAction };
type ToastContextValue = {
  notify: (toast: ToastInput) => string;
  success: (message: string, options?: Omit<ToastInput, "message" | "type">) => string;
  error: (message: string, options?: Omit<ToastInput, "message" | "type">) => string;
  warning: (message: string, options?: Omit<ToastInput, "message" | "type">) => string;
  info: (message: string, options?: Omit<ToastInput, "message" | "type">) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const DEFAULT_DURATION = 5000;
const tones: Record<ToastType, { className: string; icon: typeof AppIcons.check; role: "status" | "alert" }> = {
  success: { className: "bg-emerald-600", icon: AppIcons.completed, role: "status" },
  error: { className: "bg-red-600", icon: AppIcons.cancelled, role: "alert" },
  warning: { className: "bg-amber-600", icon: AppIcons.warning, role: "alert" },
  information: { className: "bg-blue-600", icon: AppIcons.activity, role: "status" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, { startedAt: number; remaining: number; timeout: number }>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer.timeout);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const startTimer = useCallback((toast: ToastRecord, remaining = toast.duration) => {
    if (remaining <= 0) return;
    const timeout = window.setTimeout(() => dismiss(toast.id), remaining);
    timers.current.set(toast.id, { startedAt: Date.now(), remaining, timeout });
  }, [dismiss]);

  const pauseTimer = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (!timer) return;
    window.clearTimeout(timer.timeout);
    timers.current.set(id, { ...timer, remaining: Math.max(0, timer.remaining - (Date.now() - timer.startedAt)) });
  }, []);

  const resumeTimer = useCallback((id: string) => {
    const toast = toasts.find((item) => item.id === id);
    const timer = timers.current.get(id);
    if (!toast || !timer) return;
    startTimer(toast, timer.remaining);
  }, [startTimer, toasts]);

  const notify = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    const toast: ToastRecord = { id, message: input.message, title: input.title, type: input.type ?? "information", duration: input.duration ?? DEFAULT_DURATION, dismissible: input.dismissible ?? true, action: input.action };
    setToasts((current) => [toast, ...current].slice(0, 5));
    startTimer(toast);
    return id;
  }, [startTimer]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer.timeout));
    timers.current.clear();
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    notify,
    success: (message, options) => notify({ ...options, message, type: "success" }),
    error: (message, options) => notify({ ...options, message, type: "error" }),
    warning: (message, options) => notify({ ...options, message, type: "warning" }),
    info: (message, options) => notify({ ...options, message, type: "information" }),
  }), [notify]);

  return <ToastContext.Provider value={value}>{children}<div aria-live="polite" className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:w-full">{toasts.map((toast) => { const tone = tones[toast.type]; const Icon = tone.icon; return <div className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-xl shadow-slate-950/20 transition motion-reduce:transition-none ${tone.className}`} key={toast.id} onBlur={() => resumeTimer(toast.id)} onFocus={() => pauseTimer(toast.id)} onMouseEnter={() => pauseTimer(toast.id)} onMouseLeave={() => resumeTimer(toast.id)} role={tone.role}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20"><Icon aria-hidden size={18} weight="bold" /></span><div className="min-w-0 flex-1">{toast.title ? <p className="text-sm font-bold leading-5">{toast.title}</p> : null}<p className="text-sm font-semibold leading-5">{toast.message}</p></div>{toast.action ? <button className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white hover:bg-white/30" onClick={toast.action.onClick} type="button">{toast.action.label}</button> : null}{toast.dismissible ? <button aria-label="Dismiss notification" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/85 transition hover:bg-white/20 hover:text-white" onClick={() => dismiss(toast.id)} type="button"><AppIcons.close aria-hidden size={16} weight="bold" /></button> : null}</div>; })}</div></ToastContext.Provider>;
}

export function useNotify() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useNotify must be used within ToastProvider.");
  return context;
}
