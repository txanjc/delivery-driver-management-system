"use client";

import { AppIcons } from "@/config/icons";
import { Skeleton } from "@/components/ui/Skeleton";

const routesGlassPanel = "border border-white/70 bg-white/78 shadow-[0_18px_48px_-28px_rgba(15,23,42,.42)] ring-1 ring-white/60 backdrop-blur-xl backdrop-saturate-150";
const routesGlassCard = `rounded-[18px] ${routesGlassPanel}`;
const routesGlassCell = "rounded-xl border border-white/60 bg-white/48 shadow-[inset_0_1px_0_rgba(255,255,255,.62)] backdrop-blur-sm";
const routesGlassIconButton = "border border-white/75 bg-white/64 text-slate-700 shadow-[0_18px_48px_-28px_rgba(15,23,42,.45),inset_0_1px_0_rgba(255,255,255,.82)] ring-1 ring-white/60 backdrop-blur-2xl backdrop-saturate-150";
const routesGlassActionButton = "border border-white/55 bg-[#6d4aff]/82 text-white shadow-[0_18px_42px_-20px_rgba(79,70,229,.82),inset_0_1px_0_rgba(255,255,255,.28)] ring-1 ring-white/35 backdrop-blur-2xl backdrop-saturate-150";

function RoutesLoadingCard({ title, rows = 4 }: { title: string; rows?: number }) {
  return (
    <section className={`${routesGlassCard} p-3.5`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-purple-50 text-purple-600">
          <Skeleton className="h-3.5 w-3.5" rounded="rounded-full" />
        </span>
        {title}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div className={`${routesGlassCell} p-2.5`} key={index}>
            <Skeleton className="h-2.5 w-20" rounded="rounded-full" />
            <Skeleton className="mt-2 h-5 w-10" rounded="rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function RoutesGuardLoadingState() {
  const DashboardIcon = AppIcons.dashboard;
  const SearchIcon = AppIcons.search;
  const BellIcon = AppIcons.notifications;
  const MoreIcon = AppIcons.more;
  const BackIcon = AppIcons.back;
  const FilterIcon = AppIcons.filter;

  return (
    <main className="h-dvh overflow-hidden bg-[#edf4f3] text-[#17232b]">
      <div aria-busy="true" aria-live="polite" className="relative h-dvh lg:ml-20">
        <span className="sr-only">Loading Routes workspace</span>
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col overflow-hidden border-r border-slate-200 bg-white px-3 py-5 shadow-xl shadow-slate-900/5 lg:flex">
          <Skeleton className="mx-auto h-10 w-10" rounded="rounded-xl" />
          <div className="mt-8 space-y-1">
            {Array.from({ length: 10 }).map((_, index) => (
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl text-slate-400" key={index}>
                {index === 6 ? <DashboardIcon aria-hidden size={19} weight="fill" /> : <Skeleton className="h-5 w-5" rounded="rounded-md" />}
              </span>
            ))}
          </div>
        </aside>

        <header className="routes-glass-header absolute inset-x-0 top-0 z-40 border-b border-transparent bg-transparent px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_minmax(18rem,24rem)_1fr]">
            <div className="hidden shrink-0 flex-nowrap items-center gap-3 justify-self-start lg:flex">
              <div className="flex h-10 shrink-0 items-center rounded-xl border border-white/80 bg-gradient-to-br from-white/95 via-white/80 to-indigo-50/80 px-3.5 shadow-[0_8px_24px_-14px_rgba(79,70,229,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/70 backdrop-blur-xl">
                <Skeleton className="h-3 w-[4.75rem]" rounded="rounded-full" />
                <span className="mx-3 h-5 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent" />
                <Skeleton className="h-3 w-14" rounded="rounded-full" />
              </div>
              <Skeleton className="h-10 w-10 shrink-0 bg-[#4f6df5]/70" rounded="rounded-full" />
            </div>

            <label className="relative hidden w-full justify-self-center rounded-full border border-white/80 bg-white/70 shadow-[0_14px_34px_-22px_rgba(15,23,42,.5),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-xl lg:block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon aria-hidden size={18} weight="bold" />
              </span>
              <span className="block h-10 pl-10 pr-4 text-sm leading-10 text-slate-400">Search deliveries, routes, drivers</span>
            </label>

            <div className="flex items-center gap-3 lg:justify-self-end">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/70 text-slate-500 shadow-[0_14px_34px_-22px_rgba(15,23,42,.5),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-xl">
                <BellIcon aria-hidden size={19} weight="bold" />
              </span>
              <span className="flex h-10 w-36 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-1.5 shadow-[0_14px_34px_-22px_rgba(15,23,42,.5),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-xl">
                <Skeleton className="h-8 w-8" rounded="rounded-full" />
                <Skeleton className="h-3 w-20" rounded="rounded-full" />
              </span>
            </div>
          </div>
        </header>

        <section className="relative h-dvh overflow-hidden">
          <div className="absolute inset-0 bg-[#dff2f0]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(37,99,235,.12)_1px,transparent_1px),linear-gradient(rgba(37,99,235,.12)_1px,transparent_1px)] bg-[size:72px_72px]" />
          </div>

          <div className="absolute left-[430px] right-5 top-4 z-30 flex items-start justify-between gap-3">
            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${routesGlassIconButton}`}>
              <BackIcon aria-hidden size={18} weight="bold" />
            </span>
            <div className="flex items-start gap-3">
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${routesGlassIconButton}`}>
                <FilterIcon aria-hidden size={18} weight="bold" />
              </span>
              <span className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${routesGlassActionButton}`}>
                <MoreIcon aria-hidden size={17} weight="bold" />
                Actions
              </span>
            </div>
          </div>

          <aside className="user-modal-scrollbar absolute bottom-3 left-4 top-[88px] z-30 w-[410px] space-y-2.5 overflow-y-auto overscroll-contain pr-1">
            <RoutesLoadingCard title="Routes Overview" />
            <RoutesLoadingCard title="Route Performance" rows={2} />
            <RoutesLoadingCard title="Today&apos;s Activity" />
            <RoutesLoadingCard title="Operational Performance" />
            <section className={`${routesGlassCard} p-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">Today&apos;s Routes</span>
                <Skeleton className="h-8 w-32 bg-white/55" rounded="rounded-lg" />
              </div>
              <div className="mt-3 space-y-1.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className={`grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 px-2.5 py-2 ${routesGlassCell}`} key={index}>
                    <Skeleton className="h-3 w-20" rounded="rounded-full" />
                    <Skeleton className="h-3 w-24" rounded="rounded-full" />
                    <Skeleton className="h-3 w-12" rounded="rounded-full" />
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <div className="absolute bottom-16 right-5 z-30 flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton className={`${routesGlassIconButton} h-11 w-11`} key={index} rounded="rounded-full" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
