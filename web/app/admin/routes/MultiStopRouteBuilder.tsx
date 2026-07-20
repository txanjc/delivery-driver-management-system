"use client";

import { useEffect, useRef } from "react";

import { DeliveryMultiSelect, type MultiStopDelivery } from "./DeliveryMultiSelect";
import { isValidStartLocation, type StartLocation } from "./start-location";
import { PlacesAddressInput, type SelectedPlace } from "@/components/routes/PlacesAddressInput";
import type { OptimizationPreview, PreviewDeliveryDetail } from "./multi-stop-preview";

type DriverOption = { id: string; name: string; availability: string; assignmentSummary?: string };
type VehicleOption = { id: string; label: string; status: string | null; isOperational: boolean };
type ScheduleOption = { schedule_id: string; driver_id: string | null; vehicle_id: string | null; shift_date: string | null; shift_type: string | null; shift_name: string | null; start_time: string | null; end_time: string | null; status: string | null };

type MultiStopRouteBuilderProps = {
  canOptimizeRoute: boolean;
  cardsVisible: boolean;
  companyDefaultStartLocation: StartLocation | null;
  companyLocationError: string;
  companyLocationLoading: boolean;
  departureTime: string;
  deliveries: MultiStopDelivery[];
  drivers: DriverOption[];
  isOptimizing: boolean;
  optimizationError: string | null;
  optimizationNotice: string | null;
  optimizedPreview: OptimizationPreview | null;
  previewDeliveries: PreviewDeliveryDetail[];
  previewGeometryWarning: string | null;
  isEditingOptimizedPreview: boolean;
  isSavingOptimizedRoute: boolean;
  optimizeDisabledReason: string;
  returnToDepot: boolean;
  routeDate: string;
  schedules: ScheduleOption[];
  selectedDeliveryIds: string[];
  selectedDriverId: string;
  selectedPreviewStopId: string;
  selectedScheduleId: string;
  selectedVehicleId: string;
  shiftEndTime: string;
  startLocation: StartLocation | null;
  vehicles: VehicleOption[];
  onClearSelection: () => void;
  onClose: () => void;
  onEditSelection: () => void;
  onOptimize: () => void;
  onPreviewStopSelect: (deliveryId: string) => void;
  onRouteDateChange: (value: string) => void;
  onRouteDriverChange: (value: string) => void;
  onRouteScheduleChange: (value: string) => void;
  onReturnToDepotChange: (value: boolean) => void;
  onResetPreview: () => void;
  onSaveOptimizedRoute: () => void;
  onToggleDelivery: (deliveryId: string) => void;
  onStartLocationTextChange: (value: string) => void;
  onStartLocationSelect: (place: SelectedPlace) => void;
  onUseCompanyDefault: () => void;
};

function statusLabel(value: string | null) {
  return (value ?? "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scheduleLabel(schedule: ScheduleOption) {
  const start = schedule.start_time ? new Date(schedule.start_time) : null;
  const end = schedule.end_time ? new Date(schedule.end_time) : null;
  const time = start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
    ? `${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(start)}–${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(end)}`
    : "Invalid shift times";
  return `${schedule.shift_name ?? schedule.shift_type ?? "Scheduled shift"} · ${time}`;
}

function timeLabel(value: string) {
  if (!value) return "Not resolved";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid time" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function SelectionField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] font-semibold text-slate-700">{label}</span>{children}</label>;
}

function StaticField({ label, value, tone = "text-slate-600" }: { label: string; value: string; tone?: string }) {
  return <div><p className="text-[11px] font-semibold text-slate-700">{label}</p><p className={`mt-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs ${tone}`}>{value}</p></div>;
}

function formatDistance(meters: number) { return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`; }
function formatDuration(seconds: number) { const minutes = Math.max(0, Math.round(seconds / 60)); const hours = Math.floor(minutes / 60); return hours ? `${hours}h ${minutes % 60}m` : `${minutes} min`; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }

function OptimizedRoutePreview({ optimizedPreview, previewDeliveries, previewGeometryWarning, selectedPreviewStopId, driverName, vehicleName, scheduleName, isSaving, onEditSelection, onPreviewStopSelect, onResetPreview, onSave }: { optimizedPreview: OptimizationPreview; previewDeliveries: PreviewDeliveryDetail[]; previewGeometryWarning: string | null; selectedPreviewStopId: string; driverName: string; vehicleName: string; scheduleName: string; isSaving: boolean; onEditSelection: () => void; onPreviewStopSelect: (deliveryId: string) => void; onResetPreview: () => void; onSave: () => void }) {
  const detailById = new Map(previewDeliveries.map((delivery) => [delivery.id, delivery]));
  const skipped = new Set(optimizedPreview.skippedShipmentIds);
  const stops = optimizedPreview.optimizedStops.filter((stop) => !skipped.has(stop.deliveryId)).sort((left, right) => left.sequence - right.sequence);
  const skippedDeliveries = optimizedPreview.skippedShipmentIds.flatMap((id) => { const delivery = detailById.get(id); return delivery ? [delivery] : []; });
  return <div className="mt-4 space-y-4">
    <section className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-950">Unsaved optimized route</p><p className="mt-1 text-[11px] leading-4 text-slate-600">Review this route on the map before the save workflow is added.</p></div><span className="rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-bold text-purple-700">Preview</span></div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]"><div><dt className="text-slate-500">Route date</dt><dd className="mt-0.5 font-semibold text-slate-800">{optimizedPreview.context.routeDate}</dd></div><div><dt className="text-slate-500">Schedule</dt><dd className="mt-0.5 truncate font-semibold text-slate-800" title={scheduleName}>{scheduleName}</dd></div><div><dt className="text-slate-500">Driver</dt><dd className="mt-0.5 truncate font-semibold text-slate-800" title={driverName}>{driverName}</dd></div><div><dt className="text-slate-500">Vehicle</dt><dd className="mt-0.5 truncate font-semibold text-slate-800" title={vehicleName}>{vehicleName}</dd></div><div className="col-span-2"><dt className="text-slate-500">Starting location</dt><dd className="mt-0.5 truncate font-semibold text-slate-800" title={optimizedPreview.context.startLocation.address}>{optimizedPreview.context.startLocation.name || optimizedPreview.context.startLocation.address}</dd></div></dl>
      <div className="mt-3 grid grid-cols-3 gap-2"><StaticField label="Distance" value={formatDistance(optimizedPreview.metrics.totalDistanceMeters)} /><StaticField label="Duration" value={formatDuration(optimizedPreview.metrics.totalDurationSeconds)} /><StaticField label="Completion" value={formatDateTime(optimizedPreview.metrics.estimatedCompletionTime)} /></div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold"><span className="rounded-full bg-white px-2.5 py-1 text-slate-700 ring-1 ring-purple-100">{optimizedPreview.context.returnToDepot ? "Return to depot" : "End at final stop"}</span><span className="rounded-full bg-white px-2.5 py-1 text-slate-700 ring-1 ring-purple-100">{optimizedPreview.context.selectedDeliveryIds.length} selected</span><span className="rounded-full bg-white px-2.5 py-1 text-slate-700 ring-1 ring-purple-100">{stops.length} optimized</span><span className={`rounded-full px-2.5 py-1 ring-1 ${skippedDeliveries.length ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"}`}>{skippedDeliveries.length} skipped</span></div>
    </section>
    {previewGeometryWarning ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800" role="status">{previewGeometryWarning}</p> : null}
    <section><div className="flex items-center justify-between gap-3"><h2 className="text-xs font-bold text-slate-900">Optimized stops</h2><span className="text-[10px] font-semibold text-slate-500">{stops.length} stops</span></div><div className="mt-2 space-y-2">{stops.map((stop) => { const delivery = detailById.get(stop.deliveryId); return <button className={`w-full rounded-xl border p-3 text-left transition ${selectedPreviewStopId === stop.deliveryId ? "border-purple-300 bg-purple-50 ring-1 ring-purple-100" : "border-slate-200 bg-white hover:border-purple-200"}`} key={stop.deliveryId} onClick={() => onPreviewStopSelect(stop.deliveryId)} type="button"><span className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-purple-600 text-xs font-bold text-white">{stop.sequence}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-xs text-slate-900">{delivery?.number ?? "Delivery"}</strong><span className="shrink-0 text-[10px] font-medium text-slate-500">ETA {stop.estimatedArrivalTime ? formatDateTime(stop.estimatedArrivalTime) : "Not available"}</span></span><span className="mt-1 block truncate text-[11px] font-medium text-slate-700">{delivery?.customer ?? "Customer not available"}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500" title={delivery?.address}>{delivery?.address ?? "Address not available"}</span><span className="mt-1 block text-[10px] text-slate-500">Service {formatDuration(stop.serviceDurationSeconds)}{delivery ? ` · ${statusLabel(delivery.status)}` : ""}</span></span></span></button>; })}</div></section>
    {skippedDeliveries.length ? <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-3"><h2 className="text-xs font-bold text-amber-900">Skipped deliveries</h2><p className="mt-1 text-[11px] leading-4 text-amber-800">These deliveries were not included in the optimized route.</p><div className="mt-2 space-y-2">{skippedDeliveries.map((delivery) => <div className="rounded-lg border border-amber-100 bg-white/75 px-2.5 py-2" key={delivery.id}><p className="text-[11px] font-semibold text-slate-800">{delivery.number} · {delivery.customer}</p><p className="mt-0.5 truncate text-[10px] text-slate-500" title={delivery.address}>{delivery.address}</p></div>)}</div></section> : null}
    <div className="border-t border-slate-200 pt-3"><div className="flex flex-wrap gap-2"><button className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-purple-200 hover:text-purple-700 disabled:opacity-60" disabled={isSaving} onClick={onEditSelection} type="button">Edit selection</button><button className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-700 disabled:opacity-60" disabled={isSaving} onClick={onResetPreview} type="button">Reset preview</button><button className="rounded-full bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300" disabled={isSaving || !stops.length} onClick={onSave} type="button">{isSaving ? "Saving Route…" : "Save optimized route"}</button></div></div>
  </div>;
}

export function MultiStopRouteBuilder({ canOptimizeRoute, cardsVisible, companyDefaultStartLocation, companyLocationError, companyLocationLoading, departureTime, deliveries, drivers, isEditingOptimizedPreview, isOptimizing, isSavingOptimizedRoute, optimizationError, optimizationNotice, optimizedPreview, optimizeDisabledReason, previewDeliveries, previewGeometryWarning, returnToDepot, routeDate, schedules, selectedDeliveryIds, selectedDriverId, selectedPreviewStopId, selectedScheduleId, selectedVehicleId, shiftEndTime, startLocation, vehicles, onClearSelection, onClose, onEditSelection, onOptimize, onPreviewStopSelect, onResetPreview, onRouteDateChange, onRouteDriverChange, onRouteScheduleChange, onReturnToDepotChange, onSaveOptimizedRoute, onToggleDelivery, onStartLocationTextChange, onStartLocationSelect, onUseCompanyDefault }: MultiStopRouteBuilderProps) {
  const deliverySectionRef = useRef<HTMLElement>(null);
  const selectedWithValidationIssues = deliveries.filter((delivery) => selectedDeliveryIds.includes(delivery.id) && delivery.eligibilityReason !== null).length;
  const startLocationValid = isValidStartLocation(startLocation);
  const matchingSchedules = schedules.filter((schedule) => schedule.driver_id === selectedDriverId);
  const selectedSchedule = matchingSchedules.find((schedule) => schedule.schedule_id === selectedScheduleId) ?? null;
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const scheduleMessage = selectedDriverId && !matchingSchedules.length ? "No valid schedule is available for this driver and route date." : matchingSchedules.length > 1 && !selectedScheduleId ? "Select the shift to use for this route." : "";
  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId);
  useEffect(() => {
    if (!optimizedPreview || !isEditingOptimizedPreview) return;
    queueMicrotask(() => {
      deliverySectionRef.current?.focus();
      deliverySectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [isEditingOptimizedPreview, optimizedPreview]);

  return (
    <aside aria-label="Multi-stop route builder" className={`user-modal-scrollbar absolute bottom-3 top-16 z-40 w-[min(390px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[20px] border border-white/75 bg-white/90 p-4 shadow-[0_24px_60px_-28px_rgba(15,23,42,.48)] ring-1 ring-white/70 backdrop-blur-xl backdrop-saturate-150 ${cardsVisible ? "left-4 xl:left-[392px]" : "left-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">Multi-stop route builder</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Select operational assignments, then generate an unsaved route preview.</p>
        </div>
        <button aria-label="Close multi-stop route builder" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-500 transition hover:border-purple-200 hover:text-purple-700" onClick={onClose} type="button">&times;</button>
      </div>

      {optimizedPreview && !isEditingOptimizedPreview ? <OptimizedRoutePreview driverName={selectedDriver?.name ?? "Not selected"} isSaving={isSavingOptimizedRoute} onEditSelection={onEditSelection} onPreviewStopSelect={onPreviewStopSelect} onResetPreview={onResetPreview} onSave={onSaveOptimizedRoute} optimizedPreview={optimizedPreview} previewDeliveries={previewDeliveries} previewGeometryWarning={previewGeometryWarning} scheduleName={selectedSchedule ? scheduleLabel(selectedSchedule) : "Not selected"} selectedPreviewStopId={selectedPreviewStopId} vehicleName={selectedVehicle?.label ?? "Not selected"} /> : <div className="mt-4 space-y-4">
        <section ref={deliverySectionRef} tabIndex={-1}>
          <div className="flex items-center justify-between gap-3"><h2 className="text-xs font-bold text-slate-900">Deliveries</h2><span className="text-[10px] font-semibold text-slate-500">{selectedDeliveryIds.length} selected</span></div>
          <div className="mt-2"><DeliveryMultiSelect deliveries={deliveries} selectedDeliveryIds={selectedDeliveryIds} onToggleDelivery={onToggleDelivery} /></div>
        </section>

        <section>
          <h2 className="text-xs font-bold text-slate-900">Driver and shift</h2>
          <div className="mt-2 grid gap-2">
            <SelectionField label="Route date"><input className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" onChange={(event) => onRouteDateChange(event.target.value)} type="date" value={routeDate} /></SelectionField>
            <SelectionField label="Driver"><select className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" onChange={(event) => onRouteDriverChange(event.target.value)} value={selectedDriverId}><option value="">Select an eligible driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} · {statusLabel(driver.availability)}{driver.assignmentSummary ? ` · ${driver.assignmentSummary}` : ""}</option>)}</select></SelectionField>
            {!drivers.length ? <p className="text-[11px] text-amber-700">No operationally eligible drivers are available.</p> : null}
            <SelectionField label="Schedule or shift"><select className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" disabled={!selectedDriverId || !matchingSchedules.length} onChange={(event) => onRouteScheduleChange(event.target.value)} value={selectedScheduleId}><option value="">{selectedDriverId ? "Select a valid shift" : "Select a driver first"}</option>{matchingSchedules.map((schedule) => <option key={schedule.schedule_id} value={schedule.schedule_id}>{scheduleLabel(schedule)}</option>)}</select></SelectionField>
            {scheduleMessage ? <p className="text-[11px] font-medium text-amber-700">{scheduleMessage}</p> : null}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold text-slate-900">Vehicle</h2>
          <div className={`mt-2 rounded-xl border p-3 ${selectedVehicle?.isOperational ? "border-emerald-100 bg-emerald-50/50" : "border-amber-100 bg-amber-50/50"}`}>
            <p className="text-xs font-semibold text-slate-800">{selectedVehicle?.label ?? "No valid vehicle assigned"}</p>
            <p className={`mt-1 text-[11px] ${selectedVehicle?.isOperational ? "text-emerald-700" : "text-amber-700"}`}>{selectedVehicle?.isOperational ? `Assigned by the selected schedule · ${statusLabel(selectedVehicle.status)}` : selectedSchedule ? "The selected schedule does not have an operational vehicle." : "Select a valid schedule to resolve its vehicle."}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold text-slate-900">Starting location</h2>
          <div className={`mt-2 rounded-xl border p-3 ${startLocationValid ? "border-emerald-100 bg-emerald-50/50" : "border-amber-100 bg-amber-50/50"}`}>
            {companyLocationLoading ? <p className="text-[11px] text-slate-500">Loading company operating location...</p> : null}
            {companyLocationError ? <p className="text-[11px] text-amber-700">{companyLocationError}</p> : null}
            {startLocation ? <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{startLocation.name}</p><p className="mt-0.5 truncate text-[11px] text-slate-500" title={startLocation.address}>{startLocation.address}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${startLocation.source === "company_default" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{startLocation.source === "company_default" ? "Company default" : "Route override"}</span></div><p className={`mt-2 text-[10px] font-semibold ${startLocationValid ? "text-emerald-700" : "text-amber-700"}`}>{startLocationValid ? "Valid location" : "Starting location required"}</p></> : <><p className="text-xs font-semibold text-amber-800">Starting location required</p><p className="mt-1 text-[11px] leading-4 text-amber-700">Select a starting location for this route. Delivery selection can continue while this is incomplete.</p></>}
          </div>
          <div className="mt-2"><PlacesAddressInput className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" id="multi-stop-route-start-location" label="Change route start location" onPlaceSelect={onStartLocationSelect} onTextChange={onStartLocationTextChange} value={startLocation?.address ?? ""} /></div>
          {companyDefaultStartLocation ? <button className="mt-2 text-[11px] font-semibold text-purple-700 transition hover:text-purple-800" onClick={onUseCompanyDefault} type="button">Use company default</button> : null}
        </section>

        <section>
          <h2 className="text-xs font-bold text-slate-900">Return to depot</h2>
          <label className="mt-2 flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"><span className="text-xs text-slate-600">Add a return stop after the final delivery</span><input checked={returnToDepot} className="h-4 w-4 accent-purple-600" onChange={(event) => onReturnToDepotChange(event.target.checked)} type="checkbox" /></label>
        </section>

        <section>
          <h2 className="text-xs font-bold text-slate-900">Departure and shift end</h2>
          <div className="mt-2 grid grid-cols-2 gap-2"><StaticField label="Departure" value={timeLabel(departureTime)} /><StaticField label="Shift end" value={timeLabel(shiftEndTime)} /></div>
          <p className="mt-2 text-[10px] text-slate-500">Times are supplied by the selected schedule.</p>
        </section>

        <section className="rounded-xl border border-purple-100 bg-purple-50/60 p-3">
          <h2 className="text-xs font-bold text-slate-900">Route summary</h2>
          <dl className="mt-2 space-y-1.5 text-[11px] text-slate-600"><div className="flex items-center justify-between gap-3"><dt>Selected deliveries</dt><dd className="font-semibold text-slate-800">{selectedDeliveryIds.length}</dd></div><div className="flex items-center justify-between gap-3"><dt>Two-delivery minimum</dt><dd className={`font-semibold ${selectedDeliveryIds.length >= 2 ? "text-emerald-700" : "text-amber-700"}`}>{selectedDeliveryIds.length >= 2 ? "Met" : "Not met"}</dd></div><div className="flex items-center justify-between gap-3"><dt>Selected validation issues</dt><dd className="font-semibold text-slate-800">{selectedWithValidationIssues}</dd></div><div className="flex items-center justify-between gap-3"><dt>Start</dt><dd className="max-w-44 truncate text-right font-semibold text-slate-800" title={startLocation?.name}>{startLocation?.name || "Not selected"}</dd></div><div className="flex items-center justify-between gap-3"><dt>End</dt><dd className="font-semibold text-slate-800">{returnToDepot ? "Return to start" : "Final optimized stop"}</dd></div></dl>
          {optimizationNotice ? <p className="mt-2 text-[11px] font-medium text-emerald-700">{optimizationNotice}</p> : null}
          {optimizationError ? <p className="mt-2 text-[11px] font-medium text-red-600">{optimizationError}</p> : null}
          {optimizedPreview ? <p className="mt-2 text-[11px] text-slate-600">The unsaved preview is ready for the next route-preview phase.</p> : null}
        </section>
      </div>}

      {!optimizedPreview || isEditingOptimizedPreview ? <div className="mt-4 border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between gap-3"><button className="text-xs font-semibold text-slate-600 transition hover:text-purple-700" onClick={onClearSelection} type="button">Clear selection</button><button className="rounded-full bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-[0_12px_24px_-14px_rgba(109,74,255,.9)] transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300 disabled:shadow-none" disabled={!canOptimizeRoute} onClick={onOptimize} type="button">{isOptimizing ? "Optimizing Route…" : "Optimize Route"}</button></div>
        {optimizeDisabledReason ? <p className="mt-2 text-[11px] text-slate-500">{optimizeDisabledReason}.</p> : null}
      </div> : null}
    </aside>
  );
}
