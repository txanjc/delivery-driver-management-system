import type { ReactNode } from "react";

type KpiCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "blue" | "green" | "orange" | "slate";
};

type ContentCardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

type DataTableProps = {
  children: ReactNode;
};

type StatusBadgeProps = {
  status:
    | "Pending"
    | "Assigned"
    | "In Transit"
    | "Delivered"
    | "Delayed"
    | "Failed"
    | "Returned";
};

type VehicleStatusBadgeProps = {
  status: string;
};

const kpiTones = {
  blue: "border-blue-100 bg-blue-50 text-blue-700",
  green: "border-emerald-100 bg-emerald-50 text-emerald-700",
  orange: "border-orange-100 bg-orange-50 text-orange-700",
  slate: "border-slate-100 bg-slate-50 text-slate-700",
};

const statusTones = {
  Pending: "bg-slate-100 text-slate-700",
  Assigned: "bg-blue-50 text-blue-700",
  "In Transit": "bg-orange-50 text-orange-700",
  Delivered: "bg-emerald-50 text-emerald-700",
  Delayed: "bg-yellow-50 text-yellow-700",
  Failed: "bg-red-50 text-red-700",
  Returned: "bg-purple-50 text-purple-700",
};

const vehicleStatusTones = {
  Available: "bg-emerald-500/15 text-emerald-300",
  Assigned: "bg-blue-500/15 text-blue-300",
  Maintenance: "bg-orange-500/15 text-orange-300",
  "Out of Service": "bg-red-500/15 text-red-300",
  Unknown: "bg-zinc-500/15 text-zinc-300",
};

function classNames(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
        {description}
      </p>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  tone = "slate",
}: KpiCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={classNames(
          "mb-4 inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold",
          kpiTones[tone],
        )}
      >
        {label}
      </div>
      <p className="text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{detail}</p>
    </div>
  );
}

export function ContentCard({
  title,
  description,
  children,
  className,
}: ContentCardProps) {
  return (
    <section
      className={classNames(
        "rounded-lg border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {title || description ? (
        <div className="border-b border-slate-200 px-6 py-4">
          {title ? (
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="p-6">{children}</div>
    </section>
  );
}

export function DataTable({ children }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>;
}

export function TableHeaderCell({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

export function TableCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={classNames(
        "px-4 py-4 text-slate-600",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </td>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="transition hover:bg-slate-50">{children}</tr>;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={classNames(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        statusTones[status],
      )}
    >
      {status}
    </span>
  );
}

export function normalizeVehicleStatus(status: string) {
  const normalizedStatus = status.trim().toLowerCase().replaceAll("_", " ");

  if (normalizedStatus === "available") {
    return "Available";
  }

  if (normalizedStatus === "assigned" || normalizedStatus === "in service") {
    return "Assigned";
  }

  if (
    normalizedStatus === "maintenance" ||
    normalizedStatus === "maintenance due"
  ) {
    return "Maintenance";
  }

  if (normalizedStatus === "out of service") {
    return "Out of Service";
  }

  return "Unknown";
}

export function VehicleStatusBadge({ status }: VehicleStatusBadgeProps) {
  const normalizedStatus = normalizeVehicleStatus(status);

  return (
    <span
      className={classNames(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        vehicleStatusTones[normalizedStatus],
      )}
    >
      {normalizedStatus}
    </span>
  );
}

export function PlannedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      {children}
    </span>
  );
}
