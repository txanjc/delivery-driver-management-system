"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  AdminCard,
  AdminPageIntro,
  PrimaryActionButton,
  SecondaryButton,
} from "../_components/admin-design-system";
import { DEFAULT_PAGE_SIZE, Pagination } from "../_components/Pagination";
import { AppIcons, type AppIconName } from "@/config/icons";
import { fetchAdministratorJson } from "@/lib/admin-api-client";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNotify } from "@/components/ui/ToastProvider";
import { expenseTypeLabel, expenseTypeOptions, expenseTypeRequiresVehicle, expenseTypeShowsVehicle, isExpenseType, type ExpenseType } from "@/lib/expense-types";

type ExpenseRow = {
  expense_id: string;
  delivery_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  expense_type: string | null;
  description: string | null;
  amount: number | string | null;
  expense_date: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string | null;
};
type RevenueRow = {
  revenue_id: string;
  delivery_id: string | null;
  revenue_amount: number | string | null;
  tax_amount: number | string | null;
  discount_amount: number | string | null;
  net_revenue: number | string | null;
  invoice_number: string | null;
  revenue_date: string | null;
  created_at: string | null;
};
type MaintenanceRow = {
  maintenance_id: string;
  maintenance_type: string | null;
  notes: string | null;
  cost: number | string | null;
  maintenance_date: string | null;
  created_at: string | null;
};
type ProfileRow = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};
type DeliveryOptionRow = {
  delivery_id: string;
  delivery_number: string | null;
  customer_name: string | null;
  status?: string | null;
  assigned_driver_id?: string | null;
  assigned_vehicle_id?: string | null;
  updated_at?: string | null;
};
type DriverOptionRow = { driver_id: string; user_id: string | null };
type VehicleOptionRow = {
  vehicle_id: string;
  vehicle_number: string | null;
  license_plate: string | null;
  make: string | null;
  model: string | null;
  status: string | null;
};
type ApiData = {
  expenses: ExpenseRow[];
  revenue: RevenueRow[];
  maintenance: MaintenanceRow[];
  profiles: ProfileRow[];
  deliveries: DeliveryOptionRow[];
  drivers: DriverOptionRow[];
  vehicles: VehicleOptionRow[];
  driverProfiles: ProfileRow[];
};
type ExpenseRecord = {
  id: string;
  category: ExpenseType;
  description: string;
  amount: number;
  date: string;
  deliveryId: string;
  deliveryLabel: string;
  driverId: string;
  driverLabel: string;
  vehicleId: string;
  vehicleLabel: string;
  receiptUrl: string;
  recordedBy: string;
  createdAt: string | null;
  vehicleStatus: string;
};
type RevenueRecord = {
  id: string;
  deliveryId: string;
  deliveryNumber: string;
  deliveryLabel: string;
  customer: string;
  gross: number;
  tax: number;
  discount: number;
  amount: number;
  invoiceNumber: string;
  date: string;
  createdAt: string | null;
  deliveryStatus: string;
  deliveryUpdatedAt: string | null;
  driverLabel: string;
  vehicleLabel: string;
};
type BreakdownRecord = { category: ExpenseType; amount: number; count: number; color: string };
type FinanceChartPoint = {
  key: string;
  label: string;
  fullLabel: string;
  revenue: number;
  expenses: number;
  vehicleExpenses: number;
  nonVehicleExpenses: number;
  expenseCount: number;
  revenueCount: number;
};
type FormState = {
  category: ExpenseType;
  description: string;
  amount: string;
  date: string;
  vehicleId: string;
};
type RevenueFormState = { deliveryId: string; gross: string; tax: string; discount: string; invoiceNumber: string; date: string };

const emptyForm: FormState = {
  category: "fuel",
  description: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  vehicleId: "",
};

const emptyRevenueForm: RevenueFormState = { deliveryId: "", gross: "", tax: "0", discount: "0", invoiceNumber: "", date: new Date().toISOString().slice(0, 10) };

const FINANCE_SERIES_COLORS = {
  revenue: "#6d4aff",
  nonVehicleExpenses: "#f59e0b",
  vehicleExpenses: "#a78bfa",
} as const;

const EXPENSE_CATEGORY_COLORS: Record<ExpenseType, string> = {
  fuel: "#38bdf8",
  maintenance: "#8b5cf6",
  repair: "#ef4444",
  insurance: "#f59e0b",
  registration: "#14b8a6",
  other: "#94a3b8",
};

function numberValue(value: number | string | null) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1000) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
  return money(value);
}

function axisMoney(value: number) {
  if (value === 0) return "$0";
  if (Math.abs(value) >= 1000) return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(value)}`;
  return `$${Math.round(value)}`;
}

function shortDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dateKey(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function profileName(profile?: ProfileRow) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Administrator";
}

function deliveryLabel(delivery?: DeliveryOptionRow) {
  return [delivery?.delivery_number, delivery?.customer_name].filter(Boolean).join(" / ") || "No delivery";
}

function deliveryNumber(delivery?: DeliveryOptionRow) {
  return delivery?.delivery_number || "No delivery";
}

function driverLabel(driver?: DriverOptionRow, profile?: ProfileRow) {
  return (profile ? profileName(profile) : "") || driver?.driver_id || "No driver";
}

function vehicleLabel(vehicle?: VehicleOptionRow) {
  return (
    [vehicle?.vehicle_number, [vehicle?.make, vehicle?.model].filter(Boolean).join(" "), vehicle?.license_plate]
      .filter(Boolean)
      .join(" / ") || "No vehicle"
  );
}

function vehicleOptionLabel(vehicle?: VehicleOptionRow) {
  if (!vehicle) return "No vehicle";
  return [vehicle.vehicle_number, [vehicle.make, vehicle.model].filter(Boolean).join(" "), vehicle.license_plate?.toUpperCase()].filter(Boolean).join(" \u00B7 ") || "No vehicle";
}

function titleCase(text: string) {
  return text.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status: string) {
  return status ? titleCase(status.replaceAll("_", " ")) : "Not recorded";
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function normalizeExpenseType(value: string | null | undefined): ExpenseType {
  const normalized = value?.trim().toLowerCase() ?? "";
  return isExpenseType(normalized) ? normalized : "other";
}

function expenseReference(expense: ExpenseRecord) {
  const suffix = expense.id.replaceAll("-", "").slice(0, 6).toUpperCase();
  return suffix ? `EXP-${suffix}` : "Expense";
}

function relatedSummary(expense: ExpenseRecord) {
  const items = [
    expense.vehicleId ? ["Vehicle", expense.vehicleLabel] : null,
    expense.deliveryId ? ["Delivery", expense.deliveryLabel] : null,
    expense.driverId ? ["Driver", expense.driverLabel] : null,
  ].filter((item): item is string[] => Boolean(item));
  return items.length ? items : [["General", "No related record"]];
}

function readableRelatedValue(value: string) {
  const parts = value.split(" / ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} \u00B7 ${titleCase(parts[1])}`;
  return titleCase(value);
}

function relatedDetail(label: string, value: string) {
  const parts = value.split(" / ").filter(Boolean);
  if (label === "Vehicle" && parts.length) {
    return {
      primary: [parts[0], parts[1] ? titleCase(parts[1]) : ""].filter(Boolean).join(" \u00B7 "),
      secondary: parts[2] ? `License plate: ${parts[2].toUpperCase()}` : "",
    };
  }
  if (label === "Delivery" && parts.length) return { primary: parts[0], secondary: parts[1] ? titleCase(parts[1]) : "" };
  return { primary: value, secondary: "" };
}

function categoryBadgeClass(category: ExpenseType) {
  const classes: Record<ExpenseType, string> = {
    fuel: "bg-blue-50 text-blue-700 ring-blue-100",
    maintenance: "bg-purple-50 text-purple-700 ring-purple-100",
    repair: "bg-red-50 text-red-700 ring-red-100",
    insurance: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    registration: "bg-amber-50 text-amber-700 ring-amber-100",
    other: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return classes[category];
}

function inDateRange(date: string, from: string, to: string) {
  return (!from || date >= from) && (!to || date <= to);
}

function revenueNet(form: RevenueFormState) {
  const gross = numberValue(form.gross || 0);
  const tax = numberValue(form.tax || 0);
  const discount = numberValue(form.discount || 0);
  const value = Math.round((gross + tax - discount) * 100) / 100;
  return Object.is(value, -0) ? 0 : value;
}

function scopedMonthKeys(dates: string[], fallbackCount: number) {
  const months = Array.from(new Set(dates.filter(Boolean).map((date) => monthKey(date)))).sort();
  if (months.length) return months;
  return Array.from({ length: fallbackCount }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (fallbackCount - 1 - index));
    return monthKey(date.toISOString());
  });
}

function KpiCard({
  label,
  value,
  detail,
  tone,
  icon,
  isLoading = false,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
  icon: AppIconName;
  isLoading?: boolean;
}) {
  const Icon = AppIcons[icon];

  return (
    <AdminCard className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-3 h-8 w-28" rounded="rounded-full" />
          ) : (
            <p className="mt-3 text-2xl font-bold tracking-[-0.035em] text-slate-950">{value}</p>
          )}
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}>
          <Icon aria-hidden size={20} weight="bold" />
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="mt-4 h-3 w-36" rounded="rounded-full" />
      ) : (
        <p className="mt-3 text-xs font-medium text-slate-400">{detail}</p>
      )}
    </AdminCard>
  );
}

function PerformanceMetric({
  label,
  value,
  helper,
  tone = "neutral",
  isLoading,
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "positive" | "negative" | "purple";
  isLoading: boolean;
}) {
  const valueClass =
    tone === "negative"
      ? "text-red-600"
      : tone === "positive"
        ? "text-emerald-700"
        : tone === "purple"
          ? "text-purple-700"
          : "text-slate-950";

  return (
    <div className="min-w-0 rounded-2xl border border-purple-100/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(139,92,246,0.06)]">
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "negative" ? "bg-red-500" : tone === "positive" ? "bg-emerald-500" : "bg-purple-500"}`} />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
          {isLoading ? <Skeleton className="mt-2 h-5 w-20" rounded="rounded-full" /> : <p className={`mt-1 text-base font-bold leading-6 ${valueClass}`}>{value}</p>}
          {isLoading ? <Skeleton className="mt-2 h-3 w-24" rounded="rounded-full" /> : <p className="mt-0.5 truncate text-[11px] text-slate-400">{helper}</p>}
        </div>
      </div>
    </div>
  );
}

function FinanceExpenseTableSkeleton() {
  const headers = ["Expense", "Category", "Description", "Related To", "Amount", "Recorded By", "Date", "Actions"];
  return (
    <div aria-busy="true" aria-live="polite" className="overflow-hidden">
      <span className="sr-only">Loading expense records</span>
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[28%]" />
          <col className="w-[18%]" />
          <col className="w-[9%]" />
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[6%]" />
        </colgroup>
        <thead className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500">
          <tr>
            {headers.map((head) => (
              <th className="px-3 py-3 font-semibold" key={head}>
                <Skeleton className="h-3 w-16" rounded="rounded-full" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, index) => (
            <tr key={index}>
              <td className="px-3 py-3"><Skeleton className="h-4 w-20" rounded="rounded-full" /></td>
              <td className="px-3 py-3"><Skeleton className="h-6 w-20" rounded="rounded-full" /></td>
              <td className="px-3 py-3"><Skeleton className="h-4 w-full" rounded="rounded-full" /></td>
              <td className="px-3 py-3"><div className="space-y-1.5"><Skeleton className="h-3 w-14" rounded="rounded-full" /><Skeleton className="h-4 w-full" rounded="rounded-full" /></div></td>
              <td className="px-3 py-3"><Skeleton className="ml-auto h-4 w-14" rounded="rounded-full" /></td>
              <td className="px-3 py-3"><Skeleton className="h-4 w-20" rounded="rounded-full" /></td>
              <td className="px-3 py-3"><Skeleton className="h-4 w-20" rounded="rounded-full" /></td>
              <td className="px-3 py-3"><Skeleton className="h-7 w-14" rounded="rounded-full" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsPanelSkeleton({ type }: { type: "chart" | "breakdown" }) {
  return (
    <div className="h-[286px]">
      {type === "chart" ? (
        <div className="mt-5 grid h-56 grid-cols-7 items-end gap-3 border-b border-slate-100 bg-[linear-gradient(to_bottom,rgba(148,163,184,0.22)_1px,transparent_1px)] [background-size:100%_25%]">
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="flex items-end justify-center gap-1.5" key={index}>
              <Skeleton className="w-4" rounded="rounded-t-full" style={{ height: `${88 + (index % 3) * 32}px` }} />
              <Skeleton className="w-4" rounded="rounded-t-full" style={{ height: `${64 + (index % 4) * 24}px` }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <Skeleton className="mx-auto h-36 w-36" rounded="rounded-full" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-4 w-full" key={index} rounded="rounded-full" />)}
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueExpenseChart({ data }: { data: FinanceChartPoint[] }) {
  const hasData = data.some((point) => point.revenue > 0 || point.expenses > 0);
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.revenue, point.expenses]));
  const yTicks = [maxValue, maxValue * 0.66, maxValue * 0.33, 0];
  const chartHeight = 210;

  if (!hasData) {
    return (
      <div className="mt-5 grid h-[286px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-700">No revenue or expense activity</p>
          <p className="mt-1 text-xs text-slate-500">Financial activity for the selected period will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5" aria-label="Revenue versus expenses grouped by reporting interval">
      <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3">
        <div className="flex h-[250px] flex-col justify-between pb-10 pt-1 text-right text-[11px] text-slate-400">
          {yTicks.map((tick) => <span key={tick}>{axisMoney(tick)}</span>)}
        </div>
        <div className="relative h-[250px]">
          <div className="absolute inset-x-0 top-1 h-[210px] rounded-xl bg-[linear-gradient(to_bottom,rgba(148,163,184,0.24)_1px,transparent_1px)] [background-size:100%_33.33%]" />
          <div className="relative z-10 grid h-full items-end gap-2 pb-8 sm:gap-3" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
            {data.map((point) => {
              const revenueHeight = Math.max(point.revenue ? 6 : 0, (point.revenue / maxValue) * chartHeight);
              const expenseHeight = Math.max(point.expenses ? 6 : 0, (point.expenses / maxValue) * chartHeight);
              const vehicleHeight = point.expenses ? (point.vehicleExpenses / point.expenses) * expenseHeight : 0;
              const nonVehicleHeight = Math.max(0, expenseHeight - vehicleHeight);
              return (
                <div className="group relative flex min-w-0 flex-col items-center gap-2 outline-none" key={point.key} tabIndex={0}>
                  <div className="pointer-events-none absolute bottom-[calc(100%-12px)] left-1/2 z-30 w-64 -translate-x-1/2 rounded-2xl bg-slate-950 p-3 text-xs text-white opacity-0 shadow-2xl transition group-hover:opacity-100 group-focus:opacity-100">
                    <p className="font-semibold">{point.fullLabel}</p>
                    {[
                      ["Revenue", point.revenue, FINANCE_SERIES_COLORS.revenue],
                      ["Operating Expenses", point.expenses, FINANCE_SERIES_COLORS.nonVehicleExpenses],
                      ["Vehicle Expenses", point.vehicleExpenses, FINANCE_SERIES_COLORS.vehicleExpenses],
                      ["Net Result", point.revenue - point.expenses, "#ffffff"],
                    ].map(([label, value, color]) => (
                      <div className="mt-2 flex items-center justify-between gap-3" key={label as string}>
                        <span className="inline-flex items-center gap-2 text-slate-300"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color as string }} />{label as string}</span>
                        <strong className="text-white">{money(Number(value))}</strong>
                      </div>
                    ))}
                    <div className="mt-2 border-t border-white/10 pt-2 text-slate-400">Expense Count: {point.expenseCount}{" \u00B7 "}Revenue Records: {point.revenueCount}</div>
                  </div>
                  <div className="flex h-[210px] items-end justify-center gap-1.5">
                    <div className="w-4 rounded-t-full rounded-b-md transition group-hover:opacity-80" style={{ height: revenueHeight, backgroundColor: FINANCE_SERIES_COLORS.revenue }} title={`${point.fullLabel} revenue: ${money(point.revenue)}`} />
                    <div className="flex w-4 flex-col-reverse overflow-hidden rounded-t-full rounded-b-md bg-slate-100 transition group-hover:opacity-80" style={{ height: expenseHeight }} title={`${point.fullLabel} expenses: ${money(point.expenses)}`}>
                      {point.nonVehicleExpenses ? <span style={{ height: nonVehicleHeight, backgroundColor: FINANCE_SERIES_COLORS.nonVehicleExpenses }} /> : null}
                      {point.vehicleExpenses ? <span style={{ height: vehicleHeight, backgroundColor: FINANCE_SERIES_COLORS.vehicleExpenses }} /> : null}
                    </div>
                  </div>
                  <span className="truncate text-[11px] font-medium text-slate-400">{point.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
        {[
          ["Revenue", FINANCE_SERIES_COLORS.revenue],
          ["Non-vehicle Expenses", FINANCE_SERIES_COLORS.nonVehicleExpenses],
          ["Vehicle Expenses", FINANCE_SERIES_COLORS.vehicleExpenses],
        ].map(([label, color]) => (
          <span className="inline-flex items-center gap-2" key={label}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>
        ))}
      </div>
    </div>
  );
}

function ExpenseBreakdownPanel({ breakdown, total }: { breakdown: BreakdownRecord[]; total: number }) {
  const rows = [...breakdown].sort((a, b) => b.amount - a.amount);
  const circumference = 2 * Math.PI * 48;
  const segments = rows.reduce<Array<{ item: BreakdownRecord; length: number; offset: number }>>((items, item) => {
    const offset = items.reduce((sum, segment) => sum + segment.length, 0);
    const length = total ? (item.amount / total) * circumference : 0;
    return [...items, { item, length, offset }];
  }, []);

  if (!total || rows.length === 0) {
    return (
      <div className="mt-5 grid min-h-[286px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-700">No expense breakdown available</p>
          <p className="mt-1 text-xs text-slate-500">Record expenses or adjust the active filters to see category totals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="relative mx-auto h-44 w-44">
        <svg className="-rotate-90" role="img" viewBox="0 0 120 120">
          <title>Expense category breakdown</title>
          <circle cx="60" cy="60" fill="none" r="48" stroke="#f1f5f9" strokeWidth="16" />
          {segments.map(({ item, length, offset }) => (
              <circle
                cx="60"
                cy="60"
                fill="none"
                key={item.category}
                r="48"
                stroke={item.color}
                strokeDasharray={`${Math.max(0, length - 5)} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                strokeWidth="16"
              >
                <title>{`${expenseTypeLabel(item.category)}: ${money(item.amount)}`}</title>
              </circle>
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-lg font-bold text-slate-950">{compactMoney(total)}</p>
            <p className="text-[11px] font-medium text-slate-400">Total expenses</p>
          </div>
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">Records</th>
              <th className="px-3 py-2 text-right font-semibold">Share</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((item) => (
              <tr className="hover:bg-purple-50/35" key={item.category}>
                <td className="px-3 py-2 font-medium text-slate-700"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{expenseTypeLabel(item.category)}</span></td>
                <td className="px-3 py-2 text-right text-slate-500">{item.count}</td>
                <td className="px-3 py-2 text-right text-slate-500">{Math.round((item.amount / total) * 100)}%</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpenseModal({
  form,
  editing,
  saving,
  error,
  categories,
  vehicles,
  onChange,
  onClose,
  onSubmit,
}: {
  form: FormState;
  editing: boolean;
  saving: boolean;
  error: string;
  categories: typeof expenseTypeOptions;
  vehicles: VehicleOptionRow[];
  onChange: (field: keyof FormState, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const input =
    "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100";
  const CloseIcon = AppIcons.close;
  const SaveIcon = AppIcons.save;
  const showsVehicle = expenseTypeShowsVehicle(form.category);
  const requiresVehicle = expenseTypeRequiresVehicle(form.category);
  const selectableVehicles = vehicles.filter((vehicle) => vehicle.vehicle_id === form.vehicleId || vehicle.status !== "out_of_service");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md" role="dialog">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-white bg-white/95 p-1.5 text-[#17232b] shadow-2xl shadow-slate-900/20 ring-1 ring-purple-100/50">
        <div className="user-modal-scrollbar max-h-[calc(92vh-0.75rem)] overflow-y-auto rounded-[19px] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-semibold">{editing ? "Edit Expense" : "Record Expense"}</h2>
              <p className="mt-1 text-sm text-slate-500">Record an operational or vehicle-related expense.</p>
            </div>
            <button
              aria-label="Close expense modal"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-purple-50 hover:text-purple-700"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              <CloseIcon aria-hidden size={16} weight="bold" />
            </button>
          </div>
          <form className="mt-5" onSubmit={onSubmit}>
            {error ? <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-medium text-slate-600">Expense Category</span>
                <select className={`${input} appearance-none`} onChange={(event) => onChange("category", event.target.value)} required value={form.category}>
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-slate-600">Amount</span>
                <input className={input} min="0.01" onChange={(event) => onChange("amount", event.target.value)} required step="0.01" type="number" value={form.amount} />
              </label>
              <label className="sm:col-span-2">
                <span className="text-sm font-medium text-slate-600">Description</span>
                <textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100" onChange={(event) => onChange("description", event.target.value)} required value={form.description} />
              </label>
              {showsVehicle ? (
                <label>
                  <span className="text-sm font-medium text-slate-600">Related Vehicle{requiresVehicle ? " *" : ""}</span>
                  <select className={`${input} appearance-none`} onChange={(event) => onChange("vehicleId", event.target.value)} required={requiresVehicle} value={form.vehicleId}>
                    <option value="">{requiresVehicle ? "Select a vehicle" : "No vehicle"}</option>
                    {selectableVehicles.map((vehicle) => (
                      <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                        {vehicleOptionLabel(vehicle)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                <span className="text-sm font-medium text-slate-600">Expense Date</span>
                <input className={input} onChange={(event) => onChange("date", event.target.value)} required type="date" value={form.date} />
              </label>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <SecondaryButton disabled={saving} onClick={onClose} type="button">
                Cancel
              </SecondaryButton>
              <PrimaryActionButton disabled={saving} type="submit">
                <SaveIcon aria-hidden className="mr-2" size={15} weight="bold" />
                {saving ? "Saving..." : editing ? "Save Expense" : "Record Expense"}
              </PrimaryActionButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function RevenueModal({
  form,
  editing,
  saving,
  error,
  deliveries,
  existingDeliveryIds,
  currentDeliveryId,
  onChange,
  onClose,
  onSubmit,
}: {
  form: RevenueFormState;
  editing: boolean;
  saving: boolean;
  error: string;
  deliveries: DeliveryOptionRow[];
  existingDeliveryIds: Set<string>;
  currentDeliveryId: string;
  onChange: (field: keyof RevenueFormState, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const input =
    "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100";
  const CloseIcon = AppIcons.close;
  const SaveIcon = AppIcons.save;
  const eligibleDeliveries = deliveries.filter((delivery) => delivery.delivery_id === currentDeliveryId || !existingDeliveryIds.has(delivery.delivery_id));
  const net = revenueNet(form);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md" role="dialog">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-white bg-white/95 p-1.5 text-[#17232b] shadow-2xl shadow-slate-900/20 ring-1 ring-purple-100/50">
        <div className="user-modal-scrollbar max-h-[calc(92vh-0.75rem)] overflow-y-auto rounded-[19px] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-semibold">{editing ? "Edit Revenue" : "Record Revenue"}</h2>
              <p className="mt-1 text-sm text-slate-500">{editing ? "Update delivery income and invoice details." : "Record delivery income and invoice details."}</p>
            </div>
            <button aria-label="Close revenue modal" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-purple-50 hover:text-purple-700" disabled={saving} onClick={onClose} type="button">
              <CloseIcon aria-hidden size={16} weight="bold" />
            </button>
          </div>
          <form className="mt-5" onSubmit={onSubmit}>
            {error ? <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-medium text-slate-600">Related Delivery *</span>
                <select className={`${input} appearance-none`} onChange={(event) => onChange("deliveryId", event.target.value)} required value={form.deliveryId}>
                  <option value="">Select a delivery</option>
                  {eligibleDeliveries.map((delivery) => (
                    <option key={delivery.delivery_id} value={delivery.delivery_id}>
                      {deliveryLabel(delivery).replace(" / ", " · ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-slate-600">Gross Revenue *</span>
                <input className={input} min="0" onChange={(event) => onChange("gross", event.target.value)} required step="0.01" type="number" value={form.gross} />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-600">Tax Amount</span>
                <input className={input} min="0" onChange={(event) => onChange("tax", event.target.value)} step="0.01" type="number" value={form.tax} />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-600">Discount Amount</span>
                <input className={input} min="0" onChange={(event) => onChange("discount", event.target.value)} step="0.01" type="number" value={form.discount} />
              </label>
              <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                <p className="text-sm font-medium text-purple-700">Net Revenue</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{money(net)}</p>
                <p className="mt-1 text-xs text-slate-500">Gross plus tax minus discount</p>
              </div>
              <label>
                <span className="text-sm font-medium text-slate-600">Invoice Number</span>
                <input className={input} onChange={(event) => onChange("invoiceNumber", event.target.value)} value={form.invoiceNumber} />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-600">Revenue Date *</span>
                <input className={input} onChange={(event) => onChange("date", event.target.value)} required type="date" value={form.date} />
              </label>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <SecondaryButton disabled={saving} onClick={onClose} type="button">Cancel</SecondaryButton>
              <PrimaryActionButton disabled={saving} type="submit">
                <SaveIcon aria-hidden className="mr-2" size={15} weight="bold" />
                {saving ? "Saving..." : editing ? "Save Revenue" : "Record Revenue"}
              </PrimaryActionButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ expense, onClose, onEdit, onDelete }: { expense: ExpenseRecord; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const CloseIcon = AppIcons.close;
  const EditIcon = AppIcons.edit;
  const DeleteIcon = AppIcons.delete;
  const MoreIcon = AppIcons.more;
  const CheckIcon = AppIcons.check;
  const ReceiptIcon = AppIcons.receipt;
  const related = relatedSummary(expense).filter(([label]) => label !== "General");
  const syncedMaintenance = ["maintenance", "repair"].includes(expense.category) && expense.vehicleStatus === "maintenance_due";
  const relatedVehicle = expense.vehicleId ? readableRelatedValue(expense.vehicleLabel) : "No vehicle";
  const summaryItems = [
    ["Expense date", shortDate(expense.date)],
    ["Recorded by", expense.recordedBy],
    ["Related vehicle", relatedVehicle],
    ["Status impact", syncedMaintenance ? "Maintenance Due" : "No vehicle status change"],
  ];
  const field = (label: string, value: string) => (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-800">{value}</p>
    </div>
  );

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md" role="dialog">
      <div className="max-h-[calc(100vh-48px)] w-full max-w-3xl overflow-hidden rounded-[24px] border border-white bg-white/95 p-1.5 shadow-2xl shadow-purple-950/15 ring-1 ring-purple-100/70">
        <div className="flex max-h-[calc(100vh-60px)] flex-col overflow-hidden rounded-[19px] bg-white">
          <div className="sticky top-0 z-20 border-b border-purple-50 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-950">{expenseReference(expense)}</h2>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${categoryBadgeClass(expense.category)}`}>{expenseTypeLabel(expense.category)}</span>
                  <span className="text-lg font-bold text-purple-700">{money(expense.amount)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Complete expense information</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PrimaryActionButton onClick={onEdit} type="button">
                  <EditIcon aria-hidden className="mr-2" size={15} weight="bold" />
                  Edit
                </PrimaryActionButton>
                <details className="relative">
                  <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-purple-50 hover:text-purple-700 [&::-webkit-details-marker]:hidden" aria-label="Expense actions">
                    <MoreIcon aria-hidden size={17} weight="bold" />
                  </summary>
                  <div className="absolute right-0 top-11 z-30 w-44 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl">
                    <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50" onClick={onDelete} type="button">
                      <DeleteIcon aria-hidden size={15} weight="bold" />
                      Delete expense
                    </button>
                  </div>
                </details>
                <button aria-label="Close expense details" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-purple-50 hover:text-purple-700" onClick={onClose} type="button">
                  <CloseIcon aria-hidden size={16} weight="bold" />
                </button>
              </div>
            </div>
          </div>
          <div className="user-modal-scrollbar overflow-y-auto px-5 py-4 sm:px-6">
            <div className="grid gap-2 rounded-2xl border border-purple-100/80 bg-purple-50/30 p-3 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_rgba(139,92,246,0.06)] sm:grid-cols-2 lg:grid-cols-4">
              {summaryItems.map(([label, value]) => (
                <div className="min-w-0" key={label}>
                  <p className="text-[11px] font-medium text-slate-500">{label}</p>
                  <p className="mt-1 truncate font-semibold text-slate-800" title={value}>{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <section className="rounded-[20px] border border-purple-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.08)]">
                <h3 className="font-semibold text-slate-950">Expense overview</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {field("Category", expenseTypeLabel(expense.category))}
                  {field("Amount", money(expense.amount))}
                  {field("Expense date", shortDate(expense.date))}
                </div>
                <div className="mt-3 rounded-2xl border border-purple-100 bg-purple-50/40 p-3">
                  <p className="text-xs font-medium text-purple-700">Description</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{expense.description}</p>
                </div>
                {expense.receiptUrl ? (
                  <a className="mt-3 inline-flex items-center gap-2 rounded-full border border-purple-100 px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50" href={expense.receiptUrl} rel="noreferrer" target="_blank">
                    <ReceiptIcon aria-hidden size={15} weight="bold" />
                    View receipt
                  </a>
                ) : null}
              </section>

              <section className="rounded-[20px] border border-purple-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.08)]">
                <h3 className="font-semibold text-slate-950">Related records</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {related.length ? (
                    related.map(([label, value]) => {
                      const detail = relatedDetail(label, value);
                      return (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3" key={label}>
                          <p className="text-xs font-medium text-slate-400">{label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{detail.primary}</p>
                          {detail.secondary ? <p className="mt-1 text-xs text-slate-500">{detail.secondary}</p> : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">No related records.</p>
                  )}
                </div>
              </section>

              {syncedMaintenance ? (
                <section className="flex items-start gap-3 rounded-[20px] border border-purple-100/80 bg-purple-50/50 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_rgba(139,92,246,0.06)]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-purple-700 ring-1 ring-purple-100">
                    <CheckIcon aria-hidden size={15} weight="bold" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Vehicle synchronization</h3>
                    <p className="mt-1 text-sm text-slate-600">Vehicle moved to Maintenance Due.</p>
                  </div>
                </section>
              ) : null}

              <section className="rounded-[20px] border border-purple-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.08)]">
                <h3 className="font-semibold text-slate-950">Record information</h3>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <span><span className="text-slate-400">Recorded by</span> <strong className="font-semibold text-slate-800">{expense.recordedBy}</strong></span>
                  <span><span className="text-slate-400">Created</span> <strong className="font-semibold text-slate-800">{shortDate(expense.createdAt)}</strong></span>
                </div>
              </section>

            </div>
          </div>

          <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t border-purple-50 bg-white/95 px-5 py-3 backdrop-blur sm:px-6">
            <SecondaryButton onClick={onClose} type="button">Close</SecondaryButton>
            <PrimaryActionButton onClick={onEdit} type="button">
              <EditIcon aria-hidden className="mr-2" size={15} weight="bold" />
              Edit Expense
            </PrimaryActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueDetailModal({ revenue, onClose, onEdit }: { revenue: RevenueRecord; onClose: () => void; onEdit: () => void }) {
  const CloseIcon = AppIcons.close;
  const EditIcon = AppIcons.edit;
  const DeliveryIcon = AppIcons.deliveries;
  const CustomerIcon = AppIcons.customer;
  const CalendarIcon = AppIcons.calendar;
  const InvoiceIcon = AppIcons.document;
  const ImpactIcon = AppIcons.finance;
  const summaryItems = [
    { label: "Delivery", value: revenue.deliveryNumber, icon: DeliveryIcon },
    { label: "Customer", value: revenue.customer, icon: CustomerIcon },
    { label: "Revenue date", value: shortDate(revenue.date), icon: CalendarIcon },
    { label: "Invoice", value: revenue.invoiceNumber || "Not provided", icon: InvoiceIcon },
  ];
  const calculationItems = [
    { label: "Gross", operator: "", value: revenue.gross, className: "text-slate-950" },
    { label: "Tax", operator: "+", value: revenue.tax, className: "text-emerald-700" },
    { label: "Discount", operator: "-", value: revenue.discount, className: "text-amber-700" },
    { label: "Net Revenue", operator: "=", value: revenue.amount, className: "text-purple-700" },
  ];
  const deliveryDetails = [
    revenue.deliveryStatus ? ["Status", statusLabel(revenue.deliveryStatus)] : null,
    revenue.deliveryStatus === "delivered" && revenue.deliveryUpdatedAt ? ["Completed", shortDate(revenue.deliveryUpdatedAt)] : null,
    revenue.driverLabel !== "No driver" ? ["Driver", revenue.driverLabel] : null,
    revenue.vehicleLabel !== "No vehicle" ? ["Vehicle", readableRelatedValue(revenue.vehicleLabel)] : null,
  ].filter((item): item is string[] => Boolean(item));

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md" role="dialog">
      <div className="max-h-[calc(100vh-48px)] w-full max-w-3xl overflow-hidden rounded-[24px] border border-white bg-white/95 p-1.5 shadow-2xl shadow-purple-950/15 ring-1 ring-purple-100/70">
        <div className="flex max-h-[calc(100vh-60px)] flex-col overflow-hidden rounded-[19px] bg-white">
          <div className="sticky top-0 z-20 border-b border-purple-50 bg-white/95 px-5 py-4 shadow-[0_12px_30px_rgba(16,185,129,0.06)] backdrop-blur sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-purple-800">REV-{revenue.id.replaceAll("-", "").slice(0, 6).toUpperCase()}</h2>
                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">Revenue</span>
                </div>
                <p className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950">{money(revenue.amount)}</p>
                <p className="mt-1 text-sm text-slate-500">Delivery income and invoice details.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PrimaryActionButton onClick={onEdit} type="button">
                  <EditIcon aria-hidden className="mr-2" size={15} weight="bold" />
                  Edit Revenue
                </PrimaryActionButton>
                <button aria-label="Close revenue details" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-purple-50 hover:text-purple-700" onClick={onClose} type="button">
                  <CloseIcon aria-hidden size={16} weight="bold" />
                </button>
              </div>
            </div>
            <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-emerald-300 via-purple-300 to-purple-600 opacity-70" />
          </div>
          <div className="user-modal-scrollbar overflow-y-auto px-5 py-4 sm:px-6">
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {summaryItems.map(({ label, value, icon: Icon }) => (
                <div className="min-w-0 rounded-2xl border border-purple-100/80 bg-purple-50/30 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_rgba(139,92,246,0.05)]" key={label}>
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-purple-700 ring-1 ring-purple-100">
                      <Icon aria-hidden size={13} weight="bold" />
                    </span>
                    {label}
                  </div>
                  <p className="mt-2 break-words font-semibold text-slate-800" title={value}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <section className="rounded-[20px] border border-purple-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_rgba(139,92,246,0.1)]">
                <h3 className="font-semibold text-slate-950">Revenue calculation</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  {calculationItems.map((item, index) => (
                    <div className={`relative rounded-2xl border p-3 ${item.label === "Net Revenue" ? "border-purple-200 bg-purple-50/60" : "border-slate-100 bg-slate-50/60"}`} key={item.label}>
                      {item.operator ? <span className="absolute -left-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-white text-xs font-bold text-slate-400 ring-1 ring-slate-100 sm:grid">{item.operator}</span> : null}
                      <p className={`text-lg font-bold ${item.className}`}>{money(item.value)}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-500">{item.label}</p>
                      {index === 0 ? <p className="mt-1 text-[11px] text-slate-400">Starting amount</p> : null}
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-[20px] border border-purple-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.07)]">
                <h3 className="font-semibold text-slate-950">Delivery details</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {deliveryDetails.length ? deliveryDetails.map(([label, value]) => (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3" key={label}>
                      <p className="text-xs font-medium text-slate-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
                    </div>
                  )) : <p className="text-sm text-slate-500">No additional delivery details are available.</p>}
                </div>
              </section>
              <section className="flex items-start gap-3 rounded-[20px] border border-emerald-100 bg-emerald-50/70 p-4 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_rgba(16,185,129,0.06)]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-100">
                  <ImpactIcon aria-hidden size={15} weight="bold" />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-950">Revenue impact</h3>
                  <p className="mt-1 text-slate-600">This record added <strong className="font-semibold text-emerald-700">{money(revenue.amount)}</strong> to Total Revenue.</p>
                </div>
              </section>
              <div className="flex flex-wrap gap-x-5 gap-y-2 px-1 pb-1 text-sm text-slate-500">
                <span>Created <strong className="font-semibold text-slate-700">{shortDate(revenue.createdAt)}</strong></span>
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t border-purple-50 bg-white/95 px-5 py-3 backdrop-blur sm:px-6">
            <SecondaryButton onClick={onClose} type="button">Close</SecondaryButton>
            <PrimaryActionButton onClick={onEdit} type="button">
              <EditIcon aria-hidden className="mr-2" size={15} weight="bold" />
              Edit Revenue
            </PrimaryActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const notify = useNotify();
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [revenue, setRevenue] = useState<RevenueRecord[]>([]);
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOptionRow[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [editingRevenue, setEditingRevenue] = useState<RevenueRecord | null>(null);
  const [selected, setSelected] = useState<ExpenseRecord | null>(null);
  const [selectedRevenue, setSelectedRevenue] = useState<RevenueRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [revenueForm, setRevenueForm] = useState<RevenueFormState>(emptyRevenueForm);
  const [recordsTab, setRecordsTab] = useState<"expenses" | "revenue">("expenses");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [sort, setSort] = useState("date_desc");
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdministratorJson<ApiData>("/api/admin/finance");
      const profiles = new Map(data.profiles.map((profile) => [profile.profile_id, profile]));
      const deliveryMap = new Map(data.deliveries.map((delivery) => [delivery.delivery_id, delivery]));
      const vehicleMap = new Map(data.vehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]));
      const driverProfiles = new Map(data.driverProfiles.map((profile) => [profile.profile_id, profile]));
      const driverMap = new Map(data.drivers.map((driver) => [driver.driver_id, driver]));

      setDeliveryOptions(data.deliveries);
      setVehicleOptions(data.vehicles);
      setExpenses(
        data.expenses.map((expense) => {
          const driver = expense.driver_id ? driverMap.get(expense.driver_id) : undefined;
          return {
            id: expense.expense_id,
            category: normalizeExpenseType(expense.expense_type),
            description: expense.description ?? "Operational expense",
            amount: numberValue(expense.amount),
            date: dateKey(expense.expense_date || expense.created_at),
            deliveryId: expense.delivery_id ?? "",
            deliveryLabel: expense.delivery_id ? deliveryLabel(deliveryMap.get(expense.delivery_id)) : "No delivery",
            driverId: expense.driver_id ?? "",
            driverLabel: expense.driver_id ? driverLabel(driver, driver?.user_id ? driverProfiles.get(driver.user_id) : undefined) : "No driver",
            vehicleId: expense.vehicle_id ?? "",
            vehicleLabel: expense.vehicle_id ? vehicleLabel(vehicleMap.get(expense.vehicle_id)) : "No vehicle",
            vehicleStatus: expense.vehicle_id ? vehicleMap.get(expense.vehicle_id)?.status ?? "" : "",
            receiptUrl: expense.receipt_url ?? "",
            recordedBy: profileName(expense.created_by ? profiles.get(expense.created_by) : undefined),
            createdAt: expense.created_at,
          };
        }),
      );
      setRevenue(
        data.revenue.map((item) => {
          const delivery = item.delivery_id ? deliveryMap.get(item.delivery_id) : undefined;
          const driver = delivery?.assigned_driver_id ? driverMap.get(delivery.assigned_driver_id) : undefined;
          const vehicle = delivery?.assigned_vehicle_id ? vehicleMap.get(delivery.assigned_vehicle_id) : undefined;
          return {
            id: item.revenue_id,
            deliveryId: item.delivery_id ?? "",
            deliveryNumber: deliveryNumber(delivery),
            deliveryLabel: item.delivery_id ? deliveryLabel(delivery) : "No delivery",
            customer: delivery?.customer_name ?? "Unknown customer",
            gross: numberValue(item.revenue_amount ?? item.net_revenue),
            tax: numberValue(item.tax_amount),
            discount: numberValue(item.discount_amount),
            amount: numberValue(item.net_revenue),
            invoiceNumber: item.invoice_number ?? "",
            date: dateKey(item.revenue_date || item.created_at),
            createdAt: item.created_at,
            deliveryStatus: delivery?.status ?? "",
            deliveryUpdatedAt: delivery?.updated_at ?? null,
            driverLabel: delivery?.assigned_driver_id ? driverLabel(driver, driver?.user_id ? driverProfiles.get(driver.user_id) : undefined) : "No driver",
            vehicleLabel: delivery?.assigned_vehicle_id ? vehicleLabel(vehicle) : "No vehicle",
          };
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load finance records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const expenseId = searchParams.get("expense");
    const revenueId = searchParams.get("revenue");
    queueMicrotask(() => {
      if (tab === "revenue") setRecordsTab("revenue");
      if (tab === "expenses") setRecordsTab("expenses");
      if (loading) return;
      if (expenseId) {
        const match = expenses.find((expense) => expense.id === expenseId);
        if (match) {
          setRecordsTab("expenses");
          setSelected(match);
          setSelectedRevenue(null);
        }
      }
      if (revenueId) {
        const match = revenue.find((item) => item.id === revenueId);
        if (match) {
          setRecordsTab("revenue");
          setSelectedRevenue(match);
          setSelected(null);
        }
      }
    });
  }, [expenses, loading, revenue, searchParams]);

  const categoryOptions = expenseTypeOptions;
  const filtered = useMemo(
    () =>
      expenses
        .filter((expense) => {
          const query = search.trim().toLowerCase();
          const matches =
            !query ||
            [expense.id, expense.category, expense.description, expense.deliveryLabel, expense.driverLabel, expense.vehicleLabel, expense.recordedBy].some((value) =>
              value.toLowerCase().includes(query),
            );
          return matches && (categoryFilter === "all" || expense.category === categoryFilter) && (!dateFrom || expense.date >= dateFrom) && (!dateTo || expense.date <= dateTo);
        })
        .sort((a, b) => (sort === "amount_desc" ? b.amount - a.amount : sort === "amount_asc" ? a.amount - b.amount : sort === "date_asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))),
    [categoryFilter, dateFrom, dateTo, expenses, search, sort],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / DEFAULT_PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const visible = filtered.slice((activePage - 1) * DEFAULT_PAGE_SIZE, activePage * DEFAULT_PAGE_SIZE);
  const scopedExpenses = useMemo(
    () => expenses.filter((expense) => (categoryFilter === "all" || expense.category === categoryFilter) && inDateRange(expense.date, dateFrom, dateTo)),
    [categoryFilter, dateFrom, dateTo, expenses],
  );
  const scopedRevenue = useMemo(
    () => revenue.filter((item) => inDateRange(item.date, dateFrom, dateTo)),
    [dateFrom, dateTo, revenue],
  );
  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString().slice(0, 10);
    const totalRevenue = scopedRevenue.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = scopedExpenses.reduce((sum, item) => sum + item.amount, 0);
    const vehicleExpenses = scopedExpenses.filter((item) => item.vehicleId).reduce((sum, item) => sum + item.amount, 0);
    const deliveryCosts = scopedExpenses.filter((item) => item.deliveryId).reduce((sum, item) => sum + item.amount, 0);
    const monthRevenue = scopedRevenue.filter((item) => item.date >= monthStart).reduce((sum, item) => sum + item.amount, 0);
    const deliveryIds = new Set(scopedRevenue.map((item) => item.deliveryId || item.id));
    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      vehicleExpenses,
      deliveryCosts,
      profit: totalRevenue - totalExpenses,
      monthRevenue,
      totalDeliveries: deliveryIds.size,
      avgRevenue: deliveryIds.size ? totalRevenue / deliveryIds.size : 0,
      avgCost: deliveryIds.size ? deliveryCosts / deliveryIds.size : 0,
      margin: totalRevenue ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
    };
  }, [scopedExpenses, scopedRevenue]);
  const chart = useMemo(() => {
    const keys = dateFrom || dateTo
      ? scopedMonthKeys([...scopedRevenue.map((item) => item.date), ...scopedExpenses.map((item) => item.date)], 1)
      : Array.from({ length: period === "monthly" ? 6 : period === "quarterly" ? 4 : 5 }, (_, index) => {
        const date = new Date();
        if (period === "yearly") date.setFullYear(date.getFullYear() - (4 - index));
        else date.setMonth(date.getMonth() - ((period === "monthly" ? 5 : 3) - index));
        return period === "yearly" ? String(date.getFullYear()) : monthKey(date.toISOString());
      });
    return keys.map((key) => {
      const revenueRows = scopedRevenue.filter((item) => item.date.startsWith(key));
      const expenseRows = scopedExpenses.filter((item) => item.date.startsWith(key));
      const revenueTotal = revenueRows.reduce((sum, item) => sum + item.amount, 0);
      const expenseTotal = expenseRows.reduce((sum, item) => sum + item.amount, 0);
      const vehicleExpenseTotal = expenseRows.filter((item) => item.vehicleId).reduce((sum, item) => sum + item.amount, 0);
      const label = period === "yearly" ? key : new Date(`${key}-02`).toLocaleString("en", { month: "short" });
      const fullLabel = period === "yearly" ? key : new Date(`${key}-02`).toLocaleString("en", { month: "long", year: "numeric" });
      return {
        key,
        label,
        fullLabel,
        revenue: revenueTotal,
        expenses: expenseTotal,
        vehicleExpenses: vehicleExpenseTotal,
        nonVehicleExpenses: Math.max(0, expenseTotal - vehicleExpenseTotal),
        expenseCount: expenseRows.length,
        revenueCount: revenueRows.length,
      } satisfies FinanceChartPoint;
    });
  }, [dateFrom, dateTo, period, scopedExpenses, scopedRevenue]);
  const breakdown = useMemo(
    () => categoryOptions.map((category) => {
      const rows = scopedExpenses.filter((item) => item.category === category.value);
      return { category: category.value, amount: rows.reduce((sum, item) => sum + item.amount, 0), count: rows.length, color: EXPENSE_CATEGORY_COLORS[category.value] } satisfies BreakdownRecord;
    }).filter((item) => item.amount > 0),
    [categoryOptions, scopedExpenses],
  );
  const hasActiveFilters = Boolean(search || dateFrom || dateTo || categoryFilter !== "all" || sort !== "date_desc");

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setCategoryFilter("all");
    setSort("date_desc");
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openRevenueCreate() {
    setEditingRevenue(null);
    setRevenueForm(emptyRevenueForm);
    setError("");
    setRevenueModalOpen(true);
  }

  function openRevenueEdit(item: RevenueRecord) {
    setEditingRevenue(item);
    setSelectedRevenue(null);
    setRevenueForm({
      deliveryId: item.deliveryId,
      gross: String(item.gross),
      tax: String(item.tax),
      discount: String(item.discount),
      invoiceNumber: item.invoiceNumber,
      date: item.date,
    });
    setError("");
    setRevenueModalOpen(true);
  }

  function openEdit(expense: ExpenseRecord) {
    setEditing(expense);
    setSelected(null);
    setForm({
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      date: expense.date,
      vehicleId: expense.vehicleId,
    });
    setError("");
    setModalOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    if (expenseTypeRequiresVehicle(form.category) && !form.vehicleId) {
      setError("Select a related vehicle for maintenance or repair expenses.");
      setSaving(false);
      return;
    }
    const expense = {
      expense_type: form.category.trim(),
      vehicle_id: form.vehicleId || null,
      description: form.description.trim(),
      amount: Number(form.amount),
      expense_date: form.date,
    };
    try {
      const response = await fetchAdministratorJson<{ message?: string }>("/api/admin/finance", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { expense_id: editing.id, expense } : { expense }),
      });
      await loadData();
      notify.success(response.message ?? (editing ? "Expense updated successfully." : "Expense recorded successfully."));
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save expense.");
    } finally {
      setSaving(false);
    }
  }

  async function submitRevenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const gross = numberValue(revenueForm.gross);
    const tax = numberValue(revenueForm.tax || 0);
    const discount = numberValue(revenueForm.discount || 0);
    if (!revenueForm.deliveryId) {
      setError("Select a related delivery.");
      setSaving(false);
      return;
    }
    if (gross < 0 || tax < 0 || discount < 0 || discount > gross + tax) {
      setError("Revenue amounts must be valid and discount cannot exceed gross plus tax.");
      setSaving(false);
      return;
    }
    const revenuePayload = {
      delivery_id: revenueForm.deliveryId,
      revenue_amount: gross,
      tax_amount: tax,
      discount_amount: discount,
      net_revenue: revenueNet(revenueForm),
      invoice_number: revenueForm.invoiceNumber.trim() || null,
      revenue_date: revenueForm.date,
    };
    try {
      const response = await fetchAdministratorJson<{ message?: string }>("/api/admin/finance/revenue", {
        method: editingRevenue ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRevenue ? { revenue_id: editingRevenue.id, revenue: revenuePayload } : { revenue: revenuePayload }),
      });
      await loadData();
      setRecordsTab("revenue");
      notify.success(response.message ?? (editingRevenue ? "Revenue updated successfully." : "Revenue recorded successfully."));
      setRevenueModalOpen(false);
      setEditingRevenue(null);
      setRevenueForm(emptyRevenueForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save revenue.");
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await fetchAdministratorJson(`/api/admin/finance?expenseId=${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      await loadData();
      setDeleteTarget(null);
      notify.success("Expense deleted successfully.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete expense.");
    } finally {
      setSaving(false);
    }
  }

  function exportRecords(format: "csv" | "excel" | "pdf", kind: "expenses" | "revenue" | "combined" = "expenses") {
    const expenseRows = [
      ["Type", "Expense", "Category", "Description", "Related To", "Amount", "Recorded By", "Date"],
      ...filtered.map((item) => [
        "Expense",
        expenseReference(item),
        expenseTypeLabel(item.category),
        item.description,
        relatedSummary(item).map(([label, value]) => `${label}: ${value}`).join(" | "),
        item.amount.toFixed(2),
        item.recordedBy,
        item.date,
      ]),
    ];
    const revenueRows = [
      ["Type", "Revenue", "Delivery", "Customer", "Gross Revenue", "Tax", "Discount", "Net Revenue", "Invoice Number", "Revenue Date"],
      ...scopedRevenue.map((item) => ["Revenue", `REV-${item.id.replaceAll("-", "").slice(0, 6).toUpperCase()}`, item.deliveryLabel, item.customer, item.gross.toFixed(2), item.tax.toFixed(2), item.discount.toFixed(2), item.amount.toFixed(2), item.invoiceNumber, item.date]),
    ];
    const rows = kind === "expenses" ? expenseRows : kind === "revenue" ? revenueRows : [["Type", "Reference", "Category/Delivery", "Description/Customer", "Related/Gross", "Tax", "Discount", "Amount", "Recorder/Invoice", "Date"], ...expenseRows.slice(1), ...revenueRows.slice(1)];
    if (format === "pdf") {
      window.print();
      return;
    }
    const separator = format === "csv" ? "," : "\t";
    const mime = format === "csv" ? "text/csv" : "application/vnd.ms-excel";
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(separator)).join("\n")], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finance-${kind}.${format === "csv" ? "csv" : "xls"}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const selectClass = "h-10 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600 outline-none focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100";
  const dropdownSelectClass = `${selectClass} appearance-none pr-10`;
  const CreateIcon = AppIcons.create;
  const ViewIcon = AppIcons.view;
  const DeleteIcon = AppIcons.delete;
  const WarningIcon = AppIcons.warning;
  const DropdownIcon = AppIcons.dropdown;

  return (
    <section className="space-y-4 text-[#17232b]">
      <AdminPageIntro
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <select
                aria-label="Export financial records"
                className={`${dropdownSelectClass} min-w-48`}
                defaultValue=""
                onChange={(event) => {
                  const [kind, format] = event.target.value.split(":") as ["expenses" | "revenue" | "combined", "csv" | "excel" | "pdf"];
                  if (kind && format) exportRecords(format, kind);
                  event.target.value = "";
                }}
              >
                <option value="">Export</option>
                <option value="expenses:csv">Expenses CSV</option>
                <option value="revenue:csv">Revenue CSV</option>
                <option value="combined:csv">Combined CSV</option>
                <option value="combined:excel">Combined Excel</option>
                <option value="combined:pdf">Print / PDF</option>
              </select>
              <DropdownIcon aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} weight="bold" />
            </div>
            <SecondaryButton onClick={openRevenueCreate} type="button">
              <CreateIcon aria-hidden className="mr-2" size={15} weight="bold" />
              Record Revenue
            </SecondaryButton>
            <PrimaryActionButton onClick={openCreate} type="button">
              <CreateIcon aria-hidden className="mr-2" size={15} weight="bold" />
              Record Expense
            </PrimaryActionButton>
          </div>
        }
        description="Monitor revenue, operational expenses, delivery costs, and overall financial performance."
        eyebrow="Financial operations"
        title="Finance"
      />

      {error && !modalOpen && !revenueModalOpen ? <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard detail={metrics.revenue ? `${scopedRevenue.length} revenue record${scopedRevenue.length === 1 ? "" : "s"}` : "No revenue recorded"} icon="finance" isLoading={loading} label="Total Revenue" tone="bg-emerald-50 text-emerald-700" value={money(metrics.revenue)} />
        <KpiCard detail={metrics.expenses ? `${scopedExpenses.length} recorded expense${scopedExpenses.length === 1 ? "" : "s"}` : "No expenses recorded"} icon="receipt" isLoading={loading} label="Total Expenses" tone="bg-orange-50 text-orange-700" value={money(metrics.expenses)} />
        <KpiCard detail={metrics.expenses ? `${((metrics.vehicleExpenses / metrics.expenses) * 100).toFixed(1)}% of total expenses` : "Subset of total expenses"} icon="deliveries" isLoading={loading} label="Vehicle Expenses" tone="bg-blue-50 text-blue-700" value={money(metrics.vehicleExpenses)} />
        <KpiCard detail="Current reporting period" icon="reports" isLoading={loading} label="Net Profit / Loss" tone={metrics.profit >= 0 ? "bg-purple-50 text-purple-700" : "bg-red-50 text-red-700"} value={money(metrics.profit)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <AdminCard className="min-h-[350px] border border-purple-100/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.08)]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Revenue vs Expenses</h2>
            <div className="relative">
              <select className={`${dropdownSelectClass} min-w-36`} onChange={(event) => setPeriod(event.target.value as "monthly" | "quarterly" | "yearly")} value={period}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
              <DropdownIcon aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} weight="bold" />
            </div>
          </div>
          {loading ? (
            <AnalyticsPanelSkeleton type="chart" />
          ) : (
            <RevenueExpenseChart data={chart} />
          )}
        </AdminCard>
        <AdminCard className="min-h-[350px] border border-purple-100/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.08)]">
          <h2 className="font-semibold">Expense Breakdown</h2>
          {loading ? <AnalyticsPanelSkeleton type="breakdown" /> : <ExpenseBreakdownPanel breakdown={breakdown} total={metrics.expenses} />}
        </AdminCard>
      </div>

      <AdminCard className="border border-purple-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.08)]">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Financial Performance</h2>
          <p className="text-sm text-slate-500">Performance for the selected reporting period</p>
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <PerformanceMetric helper="Revenue minus expenses" isLoading={loading} label="Net Profit" tone={metrics.profit < 0 ? "negative" : "positive"} value={money(metrics.profit)} />
          <PerformanceMetric helper="Per delivery" isLoading={loading} label="Avg. Revenue / Delivery" tone="positive" value={money(metrics.avgRevenue)} />
          <PerformanceMetric helper="Per delivery" isLoading={loading} label="Avg. Cost / Delivery" value={money(metrics.avgCost)} />
          <PerformanceMetric helper="Profitability" isLoading={loading} label="Profit Margin" tone={metrics.margin < 0 ? "negative" : "purple"} value={`${metrics.margin.toFixed(2)}%`} />
          <PerformanceMetric helper="For selected period" isLoading={loading} label="Total Deliveries" value={String(metrics.totalDeliveries)} />
          <PerformanceMetric helper="Current month" isLoading={loading} label="Revenue This Month" tone="purple" value={money(metrics.monthRevenue)} />
        </div>
      </AdminCard>

      <AdminCard className="overflow-hidden border border-purple-100/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(139,92,246,0.08)]">
        <div className="border-b border-purple-50 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold">Finance Records</h2>
              <p className="mt-1 text-sm text-slate-500">Search, filter, and review expenses or revenue.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full border border-purple-100 bg-purple-50 p-1">
                {(["expenses", "revenue"] as const).map((tab) => (
                  <button className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${recordsTab === tab ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-purple-700"}`} key={tab} onClick={() => setRecordsTab(tab)} type="button">
                    {tab === "expenses" ? "Expenses" : "Revenue"}
                  </button>
                ))}
              </div>
              {loading ? <Skeleton className="h-6 w-20" rounded="rounded-full" /> : <span className="inline-flex h-7 items-center rounded-full border border-purple-100 bg-purple-50 px-3 text-xs font-semibold text-purple-700">{recordsTab === "expenses" ? filtered.length : scopedRevenue.length} result{(recordsTab === "expenses" ? filtered.length : scopedRevenue.length) === 1 ? "" : "s"}</span>}
            </div>
          </div>
          <div className="mt-3 grid items-end gap-2 lg:grid-cols-[minmax(260px,1fr)_132px_132px_150px_132px_auto]">
            <input className="h-10 min-w-0 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100" onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search expenses" value={search} />
            <input aria-label="From date" className={`${selectClass} w-full`} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} type="date" value={dateFrom} />
            <input aria-label="To date" className={`${selectClass} w-full`} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} type="date" value={dateTo} />
            <div className="relative">
            <select aria-label="Category" className={`${dropdownSelectClass} w-full`} onChange={(event) => { setCategoryFilter(event.target.value as ExpenseType | "all"); setPage(1); }} value={categoryFilter}>
                <option value="all">All categories</option>
                {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
              <DropdownIcon aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} weight="bold" />
            </div>
            <div className="relative">
            <select aria-label="Sort" className={`${dropdownSelectClass} w-full`} onChange={(event) => { setSort(event.target.value); setPage(1); }} value={sort}>
                <option value="date_desc">Newest</option>
                <option value="date_asc">Oldest</option>
                <option value="amount_desc">Amount high</option>
                <option value="amount_asc">Amount low</option>
            </select>
              <DropdownIcon aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} weight="bold" />
            </div>
            <button className="h-10 rounded-full px-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent" disabled={!hasActiveFilters} onClick={clearFilters} type="button">Clear</button>
          </div>
        </div>
        {recordsTab === "expenses" ? loading ? (
          <FinanceExpenseTableSkeleton />
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No expense records found.</p>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[28%]" />
                <col className="w-[18%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead className="bg-slate-50/80 text-xs text-slate-500">
                <tr>
                  {["Expense", "Category", "Description", "Related To", "Amount", "Recorded By", "Date", "Actions"].map((head) => (
                    <th className={`px-3 py-3 font-semibold ${head === "Amount" ? "text-right" : ""}`} key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {visible.map((expense) => (
                  <tr className="align-middle transition hover:bg-purple-50/35" key={expense.id}>
                    <td className="px-3 py-3">
                      <p className="truncate font-semibold text-purple-700">{expenseReference(expense)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${categoryBadgeClass(expense.category)}`}>{expenseTypeLabel(expense.category)}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <p
                        className="overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-5"
                        title={expense.description}
                      >
                        {expense.description}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1.5">
                        {relatedSummary(expense).map(([label, value]) => (
                          <div className="min-w-0" key={`${expense.id}-${label}`}>
                            <p className="text-[11px] font-medium text-slate-400">{label}</p>
                            <p className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-700">{readableRelatedValue(value)}</p>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-950">{money(expense.amount)}</td>
                    <td className="px-3 py-3 text-slate-600"><span className="block truncate">{expense.recordedBy}</span></td>
                    <td className="px-3 py-3 text-slate-500"><span className="whitespace-nowrap">{shortDate(expense.date)}</span></td>
                    <td className="px-3 py-3">
                      <div className="flex justify-start">
                        <button aria-label={`View ${expenseReference(expense)}`} className="inline-flex h-8 items-center gap-1 rounded-full border border-purple-100 px-2.5 text-xs font-semibold text-purple-700 hover:bg-purple-50" onClick={() => setSelected(expense)} type="button"><ViewIcon aria-hidden size={13} weight="bold" />View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : loading ? (
          <FinanceExpenseTableSkeleton />
        ) : scopedRevenue.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No revenue records found.</p>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[22%]" />
                <col className="w-[11%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead className="bg-slate-50/80 text-xs text-slate-500">
                <tr>{["Revenue", "Delivery", "Gross", "Adjustments", "Net Revenue", "Invoice", "Date", "Actions"].map((head) => <th className={`px-3 py-3 font-semibold ${["Gross", "Net Revenue"].includes(head) ? "text-right" : head === "Actions" ? "text-center" : ""}`} key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {scopedRevenue.map((item) => (
                  <tr className="align-middle transition hover:bg-purple-50/35" key={item.id}>
                    <td className="px-3 py-3 font-semibold text-purple-700">REV-{item.id.replaceAll("-", "").slice(0, 6).toUpperCase()}</td>
                    <td className="px-3 py-3"><p className="truncate font-semibold text-slate-800">{item.deliveryLabel}</p><p className="truncate text-xs text-slate-400">{item.customer}</p></td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">{money(item.gross)}</td>
                    <td className="px-3 py-3 text-xs text-slate-500"><p>Tax {money(item.tax)}</p><p>Discount {money(item.discount)}</p></td>
                    <td className="px-3 py-3 text-right font-bold text-slate-950">{money(item.amount)}</td>
                    <td className="px-3 py-3 text-slate-600"><span className="block truncate">{item.invoiceNumber || "Not provided"}</span></td>
                    <td className="px-3 py-3 text-slate-500"><span className="whitespace-nowrap">{shortDate(item.date)}</span></td>
                    <td className="px-3 py-3">
                      <div className="flex justify-center">
                        <button aria-label={`View revenue ${item.id}`} className="inline-flex h-8 items-center gap-1 rounded-full border border-purple-100 px-2.5 text-xs font-semibold text-purple-700 hover:bg-purple-50" onClick={() => setSelectedRevenue(item)} type="button"><ViewIcon aria-hidden size={13} weight="bold" />View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {recordsTab === "expenses" ? <Pagination currentPage={activePage} onPageChange={setPage} tone="purple" totalPages={totalPages} totalRecords={filtered.length} /> : null}

      {modalOpen ? (
        <ExpenseModal
          categories={categoryOptions}
          editing={Boolean(editing)}
          error={error}
          form={form}
          onChange={(field, value) => setForm((current) => {
            if (field === "category") {
              const category = isExpenseType(value) ? value : "other";
              return { ...current, category, vehicleId: expenseTypeShowsVehicle(category) ? current.vehicleId : "" };
            }
            return { ...current, [field]: value };
          })}
          onClose={() => {
            if (!saving) setModalOpen(false);
          }}
          onSubmit={submit}
          saving={saving}
          vehicles={vehicleOptions}
        />
      ) : null}
      {revenueModalOpen ? (
        <RevenueModal
          currentDeliveryId={editingRevenue?.deliveryId ?? ""}
          deliveries={deliveryOptions}
          editing={Boolean(editingRevenue)}
          error={error}
          existingDeliveryIds={new Set(revenue.map((item) => item.deliveryId).filter(Boolean))}
          form={revenueForm}
          onChange={(field, value) => setRevenueForm((current) => ({ ...current, [field]: value }))}
          onClose={() => {
            if (!saving) {
              setRevenueModalOpen(false);
              setEditingRevenue(null);
            }
          }}
          onSubmit={submitRevenue}
          saving={saving}
        />
      ) : null}
      {selected ? (
        <DetailModal
          expense={selected}
          onClose={() => setSelected(null)}
          onDelete={() => {
            setDeleteTarget(selected);
            setSelected(null);
          }}
          onEdit={() => openEdit(selected)}
        />
      ) : null}
      {selectedRevenue ? <RevenueDetailModal onClose={() => setSelectedRevenue(null)} onEdit={() => openRevenueEdit(selectedRevenue)} revenue={selectedRevenue} /> : null}
      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-600"><WarningIcon aria-hidden size={21} weight="bold" /></div>
            <h2 className="mt-4 text-xl font-semibold">Delete {expenseReference(deleteTarget)}?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">This permanently removes the expense record and updates Finance totals.</p>
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton disabled={saving} onClick={() => setDeleteTarget(null)} type="button">Cancel</SecondaryButton>
              <button className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60" disabled={saving} onClick={() => void removeExpense()} type="button">
                <DeleteIcon aria-hidden size={15} weight="bold" />
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

