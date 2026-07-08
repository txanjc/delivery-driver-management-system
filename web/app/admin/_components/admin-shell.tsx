"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
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

type OpenTopbarMenu = "quick-actions" | "user-profile" | null;
type RoutesShellStyle = CSSProperties & {
  "--routes-sidebar-width"?: string;
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "AU";
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isRoutesWorkspace = pathname === "/admin/routes";
  const router = useRouter();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [openTopbarMenu, setOpenTopbarMenu] = useState<OpenTopbarMenu>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [routesSearch, setRoutesSearch] = useState("");
  const [profileName, setProfileName] = useState({
    firstName: "Administrator",
    lastName: "User",
  });
  const [userRole, setUserRole] = useState<QuickActionsRole | null>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const fullName = `${profileName.firstName} ${profileName.lastName}`.trim();
  const isQuickActionsOpen = openTopbarMenu === "quick-actions";
  const isProfileOpen = openTopbarMenu === "user-profile";
  const initials = getInitials(profileName.firstName, profileName.lastName);
  const BrandIcon = AppIcons.brand;
  const SearchIcon = AppIcons.search;
  const BellIcon = AppIcons.notifications;
  const CaretDownIcon = AppIcons.dropdown;
  const LogoutIcon = AppIcons.logout;
  const routesShellStyle: RoutesShellStyle | undefined = isRoutesWorkspace
    ? { "--routes-sidebar-width": isSidebarExpanded ? "18rem" : "5rem" }
    : undefined;
  const profileMenuSurfaceClass = isRoutesWorkspace
    ? "border-white/75 bg-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,.82),rgba(246,243,255,.58))] shadow-[0_24px_70px_-24px_rgba(15,23,42,.40)] ring-white/70 backdrop-blur-xl"
    : "border-white/80 bg-white/95 shadow-[0_24px_70px_-24px_rgba(15,23,42,.28)] ring-slate-900/5 backdrop-blur-xl";

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

  useEffect(() => {
    const closeMenu = window.setTimeout(() => setOpenTopbarMenu(null), 0);
    if (pathname !== "/admin/routes") {
      queueMicrotask(() => setRoutesSearch(""));
    }
    return () => window.clearTimeout(closeMenu);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        quickActionsRef.current?.contains(target) ||
        profileMenuRef.current?.contains(target)
      ) {
        return;
      }

      setOpenTopbarMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setOpenTopbarMenu((current) => {
        if (current === "user-profile") {
          profileTriggerRef.current?.focus();
        } else if (current === "quick-actions") {
          quickActionsRef.current?.querySelector("button")?.focus();
        }

        return null;
      });
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
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

    setOpenTopbarMenu(null);
    router.replace("/login");
    router.refresh();
    window.location.replace("/login");
  }

  return (
    <div className={`${isRoutesWorkspace ? "h-dvh overflow-hidden bg-[#edf4f3]" : "min-h-screen bg-slate-100"} text-slate-950`}>
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
        className={
          isRoutesWorkspace
            ? "relative h-dvh overflow-hidden transition-[margin] duration-300 ease-out motion-reduce:transition-none lg:ml-[var(--routes-sidebar-width)]"
            : `relative transition-[padding] duration-300 ease-out ${
                isSidebarExpanded ? "lg:pl-72" : "lg:pl-20"
              }`
        }
        style={routesShellStyle}
      >
        <header className={`z-40 border-b px-5 py-4 lg:px-8 ${isRoutesWorkspace ? "routes-glass-header absolute inset-x-0 top-0 border-transparent bg-transparent" : "sticky top-0 border-slate-100 bg-white/95 backdrop-blur-xl"}`}>
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

            <div className={`hidden items-center justify-self-start lg:flex ${isRoutesWorkspace ? "shrink-0 flex-nowrap gap-3" : "gap-2"}`}>
              {isRoutesWorkspace ? <div className="shrink-0"><TimeDateWidget /></div> : <TimeDateWidget />}
              {isProfileLoading ? <SkeletonButton className={isRoutesWorkspace ? "w-10 shrink-0" : "w-36"} /> : userRole ? <div className="shrink-0" ref={quickActionsRef}><QuickActionsDropdown isOpen={isQuickActionsOpen} onOpenChange={(nextIsOpen) => setOpenTopbarMenu(nextIsOpen ? "quick-actions" : null)} role={userRole} /></div> : null}
            </div>

            <label className="relative hidden w-full justify-self-center lg:block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon aria-hidden size={18} weight="bold" />
              </span>
              <input
                className={`h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 ${isRoutesWorkspace ? "pr-10" : "pr-4"}`}
                onChange={isRoutesWorkspace ? (event) => { setRoutesSearch(event.target.value); window.dispatchEvent(new CustomEvent("deliver-eaze:routes-search", { detail: event.target.value })); } : undefined}
                placeholder="Search deliveries, routes, drivers"
                type="search"
                value={isRoutesWorkspace ? routesSearch : undefined}
              />
              {isRoutesWorkspace && routesSearch ? (
                <button
                  aria-label="Clear route search"
                  className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-white/70 hover:text-purple-700"
                  onClick={() => {
                    setRoutesSearch("");
                    window.dispatchEvent(new CustomEvent("deliver-eaze:routes-search", { detail: "" }));
                  }}
                  type="button"
                >
                  <AppIcons.close aria-hidden size={14} weight="bold" />
                </button>
              ) : null}
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

              <div className="relative" ref={profileMenuRef}>
                <button
                  aria-controls="user-profile-menu"
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  aria-busy={isProfileLoading}
                  className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 text-slate-700 transition hover:bg-slate-100"
                  onClick={() => setOpenTopbarMenu((current) => current === "user-profile" ? null : "user-profile")}
                  ref={profileTriggerRef}
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
                  <div className={`absolute right-0 z-50 mt-3 w-56 max-w-[calc(100vw-2rem)] rounded-2xl border p-2 ring-1 ${profileMenuSurfaceClass}`} id="user-profile-menu" role="menu">
                    <div className="border-b border-slate-100 px-3 py-3">
                      {isProfileLoading ? (
                        <Skeleton className="h-10 w-full" rounded="rounded-xl" />
                      ) : (
                        <>
                          <p className="truncate text-sm font-semibold text-slate-950">
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
                          onClick={() => setOpenTopbarMenu(null)}
                          role="menuitem"
                        >
                          {item.label}
                        </Link>
                      ))}
                      <button
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isLoggingOut}
                        onClick={() => void handleLogout()}
                        role="menuitem"
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

        <main className={isRoutesWorkspace ? "h-dvh w-full overflow-hidden" : "mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-5 lg:px-7 lg:py-6"} data-routes-workspace={isRoutesWorkspace || undefined}>
          {children}
        </main>
      </div>
    </div>
  );
}
