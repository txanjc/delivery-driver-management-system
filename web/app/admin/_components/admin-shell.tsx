"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppIcons, type AppIconName } from "@/config/icons";
import { Skeleton, SkeletonAvatar, SkeletonButton } from "@/components/ui/Skeleton";
import { supabase } from "@/lib/supabase";
import { isAdministrator } from "@/lib/roles";

import { TimeDateWidget } from "./TimeDateWidget";
import {
  QuickActionsDropdown,
  type QuickActionsRole,
} from "./QuickActionsDropdown";

const navigationItems: Array<{
  label: string;
  href: string;
  icon: AppIconName;
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

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isRoutesWorkspace = pathname === "/admin/routes";
  const router = useRouter();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [profileName, setProfileName] = useState({
    firstName: "Administrator",
    lastName: "User",
  });
  const [userRole, setUserRole] = useState<QuickActionsRole | null>(null);
  const fullName = `${profileName.firstName} ${profileName.lastName}`.trim();
  const initials = getInitials(profileName.firstName, profileName.lastName);
  const BrandIcon = AppIcons.brand;
  const SearchIcon = AppIcons.search;
  const BellIcon = AppIcons.notifications;
  const CaretDownIcon = AppIcons.dropdown;
  const LogoutIcon = AppIcons.logout;

  useEffect(() => {
    let isMounted = true;

    async function loadProfileName() {
      const { data: userData } = await supabase.auth.getUser();

      if (!isMounted || !userData.user) {
        if (isMounted) {
          setIsProfileLoading(false);
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, role")
        .eq("profile_id", userData.user.id)
        .maybeSingle<ProfileName>();

      if (!isMounted || !profile) {
        if (isMounted) {
          setIsProfileLoading(false);
        }
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
      setIsProfileLoading(false);
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
    <div className={`min-h-screen text-slate-950 ${isRoutesWorkspace ? "bg-[#eef5f8]" : "bg-slate-100"}`}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r px-3 py-5 transition-[width] duration-300 ease-out lg:flex ${isRoutesWorkspace ? "border-white/70 bg-white/55 shadow-xl shadow-slate-900/5 backdrop-blur-2xl" : "border-slate-200 bg-white shadow-xl shadow-slate-900/5"} ${
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
            <BrandIcon aria-hidden size={21} weight="fill" />
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
            const SidebarIcon = AppIcons[item.icon];

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                aria-label={!isSidebarExpanded ? item.label : undefined}
                className={`flex items-center rounded-xl text-sm font-medium transition-[background-color,color,box-shadow,width,height,padding] ${
                  isSidebarExpanded
                    ? "h-11 w-full gap-3 px-3"
                    : "mx-auto h-12 w-12 justify-center px-0"
                } ${
                  isActive
                    ? "bg-[#6d4aff] text-white shadow-sm shadow-purple-200"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                }`}
                href={item.href}
                key={item.href}
                title={!isSidebarExpanded ? item.label : undefined}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <SidebarIcon
                    aria-hidden
                    size={21}
                    weight={isActive ? "fill" : "bold"}
                  />
                </span>
                <span
                  className={`whitespace-nowrap transition-[width,opacity] duration-200 ${
                    isSidebarExpanded
                      ? "min-w-32 opacity-100"
                      : "w-0 min-w-0 overflow-hidden opacity-0"
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
        <header className={`sticky top-0 z-20 border-b px-5 py-4 lg:px-8 ${isRoutesWorkspace ? "routes-glass-header border-transparent bg-transparent" : "border-slate-100 bg-white/95 backdrop-blur-xl"}`}>
          <div className="flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_minmax(18rem,24rem)_1fr]">
            <div className="lg:hidden">
              <Link className="flex items-center gap-3" href="/admin">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <BrandIcon aria-hidden size={20} weight="fill" />
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  DeliverEaze Logistics
                </span>
              </Link>
            </div>

            <div className="hidden items-center gap-2 justify-self-start lg:flex">
              <TimeDateWidget />
              {isProfileLoading ? <SkeletonButton className="w-36" /> : userRole ? <QuickActionsDropdown role={userRole} /> : null}
            </div>

            <label className="relative hidden w-full justify-self-center lg:block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon aria-hidden size={18} weight="bold" />
              </span>
              <input
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                onChange={isRoutesWorkspace ? (event) => window.dispatchEvent(new CustomEvent("deliver-eaze:routes-search", { detail: event.target.value })) : undefined}
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
                <BellIcon aria-hidden size={19} weight="bold" />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  3
                </span>
              </button>

              <div className="relative">
                <button
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  aria-busy={isProfileLoading}
                  className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 text-slate-700 transition hover:bg-slate-100"
                  onClick={() => setIsProfileOpen((current) => !current)}
                  type="button"
                >
                  {isProfileLoading ? (
                    <>
                      <SkeletonAvatar className="h-9 w-9 ring-2 ring-white" />
                      <Skeleton className="hidden h-3 w-28 sm:block" rounded="rounded-full" />
                      <span className="sr-only">Loading profile information</span>
                    </>
                  ) : (
                    <>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-[#6d4aff] ring-2 ring-white">
                        {initials}
                      </span>
                      <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
                        {fullName}
                      </span>
                    </>
                  )}
                  <CaretDownIcon
                    aria-hidden
                    className={`text-slate-400 transition-transform ${
                      isProfileOpen ? "rotate-180" : ""
                    }`}
                    size={16}
                    weight="bold"
                  />
                </button>

                {isProfileOpen ? (
                  <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10">
                    <div className="border-b border-slate-100 px-3 py-3">
                      {isProfileLoading ? (
                        <Skeleton className="h-10 w-full" rounded="rounded-xl" />
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-slate-950">
                            {fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {userRole === "administrator"
                              ? "Administrator"
                              : "Dispatcher"}
                          </p>
                        </>
                      )}
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
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isLoggingOut}
                        onClick={() => void handleLogout()}
                        type="button"
                      >
                        <LogoutIcon aria-hidden size={16} weight="bold" />
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
              const MobileIcon = AppIcons[item.icon];

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
                  <MobileIcon aria-hidden size={18} weight={isActive ? "fill" : "bold"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className={isRoutesWorkspace ? "-mt-[73px] h-screen w-full overflow-hidden" : "mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-5 lg:px-7 lg:py-6"} data-routes-workspace={isRoutesWorkspace || undefined}>
          {children}
        </main>
      </div>
    </div>
  );
}
