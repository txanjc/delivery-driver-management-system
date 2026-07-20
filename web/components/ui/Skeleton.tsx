import type { CSSProperties } from "react";

type SkeletonProps = {
  className?: string;
  rounded?: string;
  style?: CSSProperties;
};

type SkeletonTextProps = {
  className?: string;
  lines?: number;
  widths?: string[];
};

type SkeletonTableProps = {
  className?: string;
  columns?: number;
  rows?: number;
  minWidth?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Skeleton({ className, rounded = "rounded-xl", style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "block animate-pulse bg-slate-200/75 motion-reduce:animate-none dark:bg-slate-700/70",
        rounded,
        className,
      )}
      style={style}
    />
  );
}

export function SkeletonAvatar({ className }: SkeletonProps) {
  return <Skeleton className={cx("h-10 w-10", className)} rounded="rounded-full" />;
}

export function SkeletonText({ className, lines = 1, widths }: SkeletonTextProps) {
  return (
    <span aria-hidden="true" className={cx("block space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          className={cx("h-3", widths?.[index] ?? (index === lines - 1 ? "w-2/3" : "w-full"))}
          key={index}
          rounded="rounded-full"
        />
      ))}
    </span>
  );
}

export function SkeletonButton({ className }: SkeletonProps) {
  return <Skeleton className={cx("h-10 w-28", className)} rounded="rounded-full" />;
}

export function SkeletonKpiCard() {
  return (
    <div className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-sm" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-10 w-10" rounded="rounded-2xl" />
        <Skeleton className="h-8 w-20" rounded="rounded-full" />
      </div>
      <SkeletonText className="mt-4" lines={2} widths={["w-24", "w-32"]} />
      <Skeleton className="mt-4 h-8 w-full" rounded="rounded-2xl" />
    </div>
  );
}

export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonKpiCard key={index} />
      ))}
    </div>
  );
}

export function SkeletonPageHeader({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading page content</span>
      <div className="min-w-0">
        <Skeleton className="h-7 w-44" rounded="rounded-full" />
        <SkeletonText className="mt-3" lines={2} widths={["w-96 max-w-full", "w-72 max-w-full"]} />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: actions }).map((_, index) => (
          <SkeletonButton key={index} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonFilterBar({ controls = 4 }: { controls?: number }) {
  return (
    <div className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-sm" aria-hidden="true">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(3,180px)]">
        <Skeleton className="h-11 w-full" rounded="rounded-full" />
        {Array.from({ length: Math.max(0, controls - 1) }).map((_, index) => (
          <Skeleton className="h-11 w-full" key={index} rounded="rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ className, columns = 6, rows = 6, minWidth = "900px" }: SkeletonTableProps) {
  return (
    <div aria-busy="true" aria-live="polite" className={cx("overflow-x-auto", className)}>
      <span className="sr-only">Loading table data</span>
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="border-b border-slate-100 bg-slate-50/70">
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th className="px-5 py-4" key={index}>
                <Skeleton className="h-3 w-20" rounded="rounded-full" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <td className="px-5 py-4" key={columnIndex}>
                  {columnIndex === 0 ? (
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 shrink-0" rounded="rounded-full" />
                      <SkeletonText className="w-36" lines={2} widths={["w-28", "w-20"]} />
                    </div>
                  ) : (
                    <Skeleton className={columnIndex === columns - 1 ? "ml-auto h-3 w-16" : "h-3 w-24"} rounded="rounded-full" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonList({ className, rows = 5 }: { className?: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className={cx("space-y-3", className)}>
      <span className="sr-only">Loading list data</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4" key={index}>
          <SkeletonAvatar />
          <SkeletonText className="min-w-0 flex-1" lines={2} widths={["w-40 max-w-full", "w-28 max-w-full"]} />
          <Skeleton className="h-7 w-20" rounded="rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetailsPanel({ className, rows = 6 }: { className?: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className={cx("rounded-2xl border border-slate-100 bg-white p-4", className)}>
      <span className="sr-only">Loading details</span>
      <div className="flex items-start gap-3">
        <SkeletonAvatar className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <SkeletonText lines={2} widths={["w-44 max-w-full", "w-32 max-w-full"]} />
        </div>
        <Skeleton className="h-7 w-20" rounded="rounded-full" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="rounded-xl bg-slate-50 p-3" key={index}>
            <Skeleton className="h-2.5 w-16" rounded="rounded-full" />
            <Skeleton className="mt-2 h-3.5 w-28" rounded="rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonModal() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-5">
      <span className="sr-only">Loading modal details</span>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="min-w-0 flex-1">
          <SkeletonText lines={2} widths={["w-52 max-w-full", "w-72 max-w-full"]} />
        </div>
        <Skeleton className="h-9 w-9" rounded="rounded-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <SkeletonDetailsPanel rows={6} />
        <SkeletonDetailsPanel rows={4} />
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <SkeletonButton />
        <SkeletonButton />
      </div>
    </div>
  );
}

export function SkeletonChart({ className }: SkeletonProps) {
  return (
    <div className={cx("rounded-[18px] border border-slate-100 bg-white p-5 shadow-sm", className)} aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-36" rounded="rounded-full" />
        <Skeleton className="h-8 w-24" rounded="rounded-xl" />
      </div>
      <div className="mt-6 flex h-40 items-end gap-3 border-b border-l border-slate-100 px-3 pb-3">
        {[48, 68, 54, 88, 62, 76, 96].map((height, index) => (
          <Skeleton className="w-full" key={index} rounded="rounded-t-xl" style={{ height }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonCalendar({ className }: SkeletonProps) {
  return (
    <div aria-busy="true" aria-live="polite" className={cx("overflow-x-auto pb-1", className)}>
      <span className="sr-only">Loading schedule calendar</span>
      <div className="min-w-[980px]">
        <div className="grid border-b border-slate-100 bg-slate-50/70" style={{ gridTemplateColumns: "240px repeat(7, minmax(112px, 1fr))" }}>
          <div className="px-4 py-4">
            <Skeleton className="h-3 w-24" rounded="rounded-full" />
          </div>
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="border-l border-slate-100 px-3 py-3" key={index}>
              <Skeleton className="mx-auto h-5 w-8" rounded="rounded-full" />
              <Skeleton className="mx-auto mt-2 h-2.5 w-10" rounded="rounded-full" />
            </div>
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div className="grid border-b border-slate-100" key={rowIndex} style={{ gridTemplateColumns: "240px repeat(7, minmax(112px, 1fr))" }}>
            <div className="flex items-center gap-3 bg-white px-4 py-4">
              <Skeleton className="h-9 w-9" rounded="rounded-full" />
              <SkeletonText className="w-32" lines={2} widths={["w-28", "w-24"]} />
            </div>
            {Array.from({ length: 7 }).map((_, cellIndex) => (
              <div className="min-h-28 border-l border-slate-100 p-2" key={cellIndex}>
                {(rowIndex + cellIndex) % 3 === 0 ? <Skeleton className="h-12 w-full" rounded="rounded-md" /> : null}
                {(rowIndex + cellIndex) % 4 === 0 ? <Skeleton className="mt-2 h-9 w-3/4" rounded="rounded-md" /> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonMapPanel({ className }: SkeletonProps) {
  return (
    <div aria-busy="true" aria-live="polite" className={cx("relative overflow-hidden rounded-[24px] bg-slate-100", className)}>
      <span className="sr-only">Loading route map</span>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,.28)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.28)_1px,transparent_1px)] bg-[size:56px_56px]" />
      {["left-[18%] top-[26%]", "left-[48%] top-[45%]", "left-[76%] top-[62%]"].map((position) => (
        <Skeleton className={cx("absolute h-8 w-8 border-4 border-white shadow-lg", position)} key={position} rounded="rounded-full" />
      ))}
      <div className="absolute left-4 top-4 w-72 max-w-[calc(100%-2rem)] rounded-[18px] bg-white/90 p-4 shadow-sm">
        <SkeletonText lines={3} widths={["w-28", "w-full", "w-2/3"]} />
      </div>
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <section className="space-y-4 text-[#17232b]">
      <SkeletonPageHeader />
      <SkeletonKpiGrid />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <div className="rounded-[18px] border border-slate-100 bg-white shadow-sm">
        <SkeletonTable columns={6} rows={6} />
      </div>
    </section>
  );
}
