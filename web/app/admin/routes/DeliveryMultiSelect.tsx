"use client";

import { useMemo, useState } from "react";

export type DeliveryEligibilityReason = "Missing mapped location" | "Invalid mapped coordinates" | "Already assigned to an active route" | "Completed" | "Cancelled" | "Failed" | "Returned";

export type MultiStopDelivery = {
  address: string;
  assignedDriverId: string;
  customer: string;
  eligibilityReason: DeliveryEligibilityReason | null;
  id: string;
  number: string;
  scheduledDateTime: string | null;
  status: string;
};

type DeliveryMultiSelectProps = {
  deliveries: MultiStopDelivery[];
  selectedDeliveryIds: string[];
  onToggleDelivery: (deliveryId: string) => void;
};

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (status === "delivered") return "bg-emerald-50 text-emerald-700";
  if (status === "returned" || status === "failed") return "bg-red-50 text-red-700";
  if (status === "delayed") return "bg-amber-50 text-amber-700";
  if (status === "assigned" || status === "in_transit") return "bg-purple-50 text-purple-700";
  return "bg-slate-100 text-slate-600";
}

export function DeliveryMultiSelect({ deliveries, selectedDeliveryIds, onToggleDelivery }: DeliveryMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const selectedIds = useMemo(() => new Set(selectedDeliveryIds), [selectedDeliveryIds]);
  const statuses = useMemo(() => Array.from(new Set(deliveries.map((delivery) => delivery.status))).sort(), [deliveries]);
  const filteredDeliveries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return deliveries.filter((delivery) => {
      const matchesQuery = !normalizedQuery || [delivery.number, delivery.customer, delivery.address].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesQuery && (statusFilter === "all" || delivery.status === statusFilter);
    });
  }, [deliveries, query, statusFilter]);
  const eligibleCount = deliveries.filter((delivery) => delivery.eligibilityReason === null).length;
  const coordinateIssueCount = deliveries.filter((delivery) => delivery.eligibilityReason === "Missing mapped location" || delivery.eligibilityReason === "Invalid mapped coordinates").length;
  const assignedRouteCount = deliveries.filter((delivery) => delivery.eligibilityReason === "Already assigned to an active route").length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-2.5 py-2 text-emerald-700"><span className="block font-medium">Eligible</span><strong className="mt-0.5 block text-sm">{eligibleCount}</strong></div>
        <div className="rounded-xl border border-purple-100 bg-purple-50/60 px-2.5 py-2 text-purple-700"><span className="block font-medium">Selected</span><strong className="mt-0.5 block text-sm">{selectedDeliveryIds.length}</strong></div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-2.5 py-2 text-amber-700"><span className="block font-medium">Location issues</span><strong className="mt-0.5 block text-sm">{coordinateIssueCount}</strong></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-slate-600"><span className="block font-medium">Active routes</span><strong className="mt-0.5 block text-sm">{assignedRouteCount}</strong></div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <input aria-label="Search deliveries" className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-purple-300 focus:ring-2 focus:ring-purple-100" onChange={(event) => setQuery(event.target.value)} placeholder="Search delivery, recipient, or address" value={query} />
        <select aria-label="Filter deliveries by status" className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="all">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
        </select>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
        {filteredDeliveries.map((delivery) => {
          const eligible = delivery.eligibilityReason === null;
          const selected = selectedIds.has(delivery.id);
          return (
            <label className={`block rounded-xl border p-3 transition ${eligible ? selected ? "border-purple-300 bg-purple-50/70" : "border-slate-200 bg-white hover:border-purple-200" : "border-slate-200 bg-slate-50/70 opacity-75"}`} key={delivery.id}>
              <span className="flex items-start gap-3">
                <input aria-label={`Select ${delivery.number}`} checked={selected} className="mt-0.5 h-4 w-4 shrink-0 accent-purple-600" disabled={!eligible} onChange={() => onToggleDelivery(delivery.id)} type="checkbox" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2"><strong className="text-xs text-slate-900">{delivery.number}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(delivery.status)}`}>{statusLabel(delivery.status)}</span></span>
                  <span className="mt-1 block truncate text-xs font-medium text-slate-700">{delivery.customer}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500" title={delivery.address}>{delivery.address || "Address not recorded"}</span>
                  <span className="mt-1.5 block text-[10px] text-slate-500">Scheduled: {delivery.scheduledDateTime ?? "Not scheduled"}</span>
                  <span className={`mt-1 block text-[10px] font-semibold ${eligible ? "text-emerald-700" : "text-red-600"}`}>{eligible ? "Eligible" : delivery.eligibilityReason}</span>
                </span>
              </span>
            </label>
          );
        })}
        {!filteredDeliveries.length ? <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500">No deliveries match these filters.</p> : null}
      </div>
    </div>
  );
}
