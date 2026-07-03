"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "@/lib/supabase";
import { isAdministrator } from "@/lib/roles";

import { TimeDateWidget } from "./TimeDateWidget";
import {
  QuickActionsDropdown,
  type QuickActionsRole,
} from "./QuickActionsDropdown";

type IconName =
  | "brand"
  | "dashboard"
  | "users"
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
  { label: "Users", href: "/admin/users", icon: "users" },
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
];

type ProfileName = {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "AU";
}

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
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
        <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.8" />
        <path d="M16 3.1a4 4 0 0 1 0 7.8" />
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
  const router = useRouter();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [profileName, setProfileName] = useState({
    firstName: "Administrator",
    lastName: "User",
  });
  const [userRole, setUserRole] = useState<QuickActionsRole | null>(null);
  const fullName = `${profileName.firstName} ${profileName.lastName}`.trim();
  const initials = getInitials(profileName.firstName, profileName.lastName);

  useEffect(() => {
    let isMounted = true;

    async function loadProfileName() {
      const { data: userData } = await supabase.auth.getUser();

      if (!isMounted || !userData.user) {
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, role")
        .eq("profile_id", userData.user.id)
        .maybeSingle<ProfileName>();

      if (!isMounted || !profile) {
        return;
      }

      setProfileName({
        firstName: profile.first_name?.trim() || "Administrator",
        lastName: profile.last_name?.trim() || "User",
      });
      setUserRole(
        profile.role === "dispatcher"
          ? "dispatcher"
          : isAdministrator(profile.role)
            ? "administrator"
            : null,
      );
    }

    void loadProfileName();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError("");

    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      console.error("Unable to sign out:", error.message);
      setLogoutError(`Unable to sign out: ${error.message}`);
      setIsLoggingOut(false);
      return;
    }

    setIsProfileOpen(false);
    router.replace("/login");
    router.refresh();
    window.location.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-slate-200 bg-white px-3 py-5 shadow-xl shadow-slate-900/5 transition-[width] duration-300 ease-out lg:flex ${
          isSidebarExpanded ? "w-72" : "w-20"
        }`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsSidebarExpanded(false);
          }
        }}
        onFocus={() => setIsSidebarExpanded(true)}
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
      >
        <Link
          aria-label="DeliverEaze Logistics dashboard"
          className="flex h-11 min-w-0 items-center gap-3 px-2"
          href="/admin"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-sm shadow-indigo-500/20">
            <Icon name="brand" />
          </span>
          <span
            className={`min-w-44 whitespace-nowrap transition-opacity duration-200 ${
              isSidebarExpanded ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="block text-sm font-semibold tracking-tight text-slate-950">
              DeliverEaze Logistics
            </span>
            <span className="text-xs text-slate-500">Operations Portal</span>
          </span>
        </Link>

        <nav aria-label="Administrator navigation" className="mt-8 flex-1 space-y-1">
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                aria-label={!isSidebarExpanded ? item.label : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#6d4aff] text-white shadow-sm shadow-purple-200"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                }`}
                href={item.href}
                key={item.href}
                title={!isSidebarExpanded ? item.label : undefined}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon name={item.icon} />
                </span>
                <span
                  className={`min-w-32 whitespace-nowrap transition-opacity duration-200 ${
                    isSidebarExpanded ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <p
          className={`min-w-44 whitespace-nowrap px-3 text-xs text-slate-400 transition-opacity duration-200 ${
            isSidebarExpanded ? "opacity-100" : "opacity-0"
          }`}
        >
          DeliverEaze Administrator
        </p>
      </aside>

      <div
        className={`transition-[padding] duration-300 ease-out ${
          isSidebarExpanded ? "lg:pl-72" : "lg:pl-20"
        }`}
      >
        <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-xl lg:px-8">
          <div className="flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_minmax(18rem,24rem)_1fr]">
            <div className="lg:hidden">
              <Link className="flex items-center gap-3" href="/admin">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Icon name="brand" />
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  DeliverEaze Logistics
                </span>
              </Link>
            </div>

            <div className="hidden items-center gap-2 justify-self-start lg:flex">
              <TimeDateWidget />
              {userRole ? <QuickActionsDropdown role={userRole} /> : null}
            </div>

            <label className="relative hidden w-full justify-self-center lg:block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon name="search" />
              </span>
              <input
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                placeholder="Search deliveries, routes, drivers"
                type="search"
              />
            </label>

            <div className="flex items-center gap-3 lg:justify-self-end">
              <button
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                type="button"
              >
                <Icon name="bell" />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  3
                </span>
              </button>

              <div className="relative">
                <button
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 text-slate-700 transition hover:bg-slate-100"
                  onClick={() => setIsProfileOpen((current) => !current)}
                  type="button"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-[#6d4aff] ring-2 ring-white">
                    {initials}
                  </span>
                  <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
                    {fullName}
                  </span>
                  <svg
                    aria-hidden
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      isProfileOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {isProfileOpen ? (
                  <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10">
                    <div className="border-b border-slate-100 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-950">
                        {fullName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {userRole === "administrator"
                          ? "Administrator"
                          : "Dispatcher"}
                      </p>
                    </div>
                    <div className="py-2">
                      {profileItems.map((item) => (
                        <Link
                          className="block rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                          href={item.href}
                          key={item.label}
                          onClick={() => setIsProfileOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                      <button
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isLoggingOut}
                        onClick={() => void handleLogout()}
                        type="button"
                      >
                        {isLoggingOut ? "Logging out..." : "Logout"}
                      </button>
                      {logoutError ? (
                        <p className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">
                          {logoutError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <nav
            aria-label="Mobile Administrator navigation"
            className="mt-4 flex gap-2 overflow-x-auto border-t border-slate-100 pt-3 lg:hidden"
          >
            {navigationItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#6d4aff] text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
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
        </header>

        <main className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-5 lg:px-7 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
