"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

type IconName =
  | "brand"
  | "dashboard"
  | "drivers"
  | "vehicles"
  | "schedules"
  | "deliveries"
  | "routes"
  | "finance"
  | "reports"
  | "settings"
  | "search"
  | "bell"
  | "user";

const navigationItems: Array<{
  label: string;
  href: string;
  icon: IconName;
}> = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" },
  { label: "Drivers", href: "/admin/drivers", icon: "drivers" },
  { label: "Vehicles", href: "/admin/vehicles", icon: "vehicles" },
  { label: "Schedules", href: "/admin/schedules", icon: "schedules" },
  { label: "Deliveries", href: "/admin/deliveries", icon: "deliveries" },
  { label: "Routes", href: "/admin/routes", icon: "routes" },
  { label: "Finance", href: "/admin/finance", icon: "finance" },
  { label: "Reports", href: "/admin/reports", icon: "reports" },
  { label: "Settings", href: "/admin/settings", icon: "settings" },
];

const profileItems = [
  { label: "My Profile", href: "/admin/settings" },
  { label: "Account Settings", href: "/admin/settings" },
  { label: "Preferences", href: "/admin/settings" },
  { label: "Logout", href: "/login" },
];

function Icon({ name }: { name: IconName }) {
  const commonProps = {
    "aria-hidden": true,
    className: "h-4 w-4",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  const paths: Record<IconName, ReactNode> = {
    brand: (
      <>
        <path d="M7 7h10v10H7z" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </>
    ),
    dashboard: (
      <>
        <path d="M4 4h7v7H4z" />
        <path d="M13 4h7v4h-7z" />
        <path d="M13 10h7v10h-7z" />
        <path d="M4 13h7v7H4z" />
      </>
    ),
    drivers: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
        <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      </>
    ),
    vehicles: (
      <>
        <path d="M5 17h14" />
        <path d="M6 17l1-7h10l1 7" />
        <path d="M8 17v2" />
        <path d="M16 17v2" />
      </>
    ),
    schedules: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M3 10h18" />
        <path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z" />
      </>
    ),
    deliveries: (
      <>
        <path d="M3 7l9-4 9 4-9 4z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </>
    ),
    routes: (
      <>
        <path d="M4 19c4-8 12 0 16-8" />
        <path d="M5 5h.01" />
        <path d="M19 19h.01" />
      </>
    ),
    finance: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    reports: (
      <>
        <path d="M4 19V5" />
        <path d="M8 19v-8" />
        <path d="M12 19V7" />
        <path d="M16 19v-5" />
        <path d="M20 19V9" />
      </>
    ),
    settings: (
      <>
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.7h4.4l.4-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />
      </>
    ),
    search: (
      <>
        <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
        <path d="M21 21l-4.3-4.3" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
      </>
    ),
  };

  return <svg {...commonProps}>{paths[name]}</svg>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-white/10 bg-black px-4 py-5 lg:flex">
        <Link className="flex items-center gap-3 px-2" href="/admin">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
            <Icon name="brand" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight">
              DeliverEaze Logistics
            </span>
            <span className="text-xs text-zinc-500">Operations Portal</span>
          </span>
        </Link>

        <nav aria-label="Admin navigation" className="mt-8 space-y-1">
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="lg:hidden">
              <Link className="flex items-center gap-3" href="/admin">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black">
                  <Icon name="brand" />
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  DeliverEaze Logistics
                </span>
              </Link>
            </div>

            <label className="relative hidden max-w-md flex-1 lg:block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <Icon name="search" />
              </span>
              <input
                className="h-10 w-full rounded-full border border-white/10 bg-zinc-900 pl-10 pr-4 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:bg-zinc-800"
                placeholder="Search deliveries, routes, drivers"
                type="search"
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800"
                type="button"
              >
                <Icon name="bell" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-400" />
              </button>

              <div className="relative">
                <button
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition hover:bg-zinc-200"
                  onClick={() => setIsProfileOpen((current) => !current)}
                  type="button"
                >
                  <Icon name="user" />
                </button>

                {isProfileOpen ? (
                  <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-white/10 bg-[#222222] p-2 shadow-2xl">
                    <div className="border-b border-white/10 px-3 py-3">
                      <p className="text-sm font-semibold text-white">
                        Admin User
                      </p>
                      <p className="text-xs text-zinc-400">
                        Operations Manager
                      </p>
                    </div>
                    <div className="py-2">
                      {profileItems.map((item) => (
                        <Link
                          className="block rounded-xl px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          href={item.href}
                          key={item.label}
                          onClick={() => setIsProfileOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-5 py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
