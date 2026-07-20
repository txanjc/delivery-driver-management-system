"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ReactNode } from "react";

import { AppIcons, type AppIconName } from "@/config/icons";
import { Skeleton, SkeletonAvatar, SkeletonButton } from "@/components/ui/Skeleton";
import { useNotify } from "@/components/ui/ToastProvider";
import { fetchAdministratorJson } from "@/lib/admin-api-client";
import { supabase } from "@/lib/supabase";
import { isAdministrator } from "@/lib/roles";

import { TimeDateWidget } from "./TimeDateWidget";
import {
  QuickActionsDropdown,
  type QuickActionsRole,
} from "./QuickActionsDropdown";
import { AppModalShell } from "./AppModalShell";
import { NotificationBell } from "./NotificationBell";

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
type GlobalSearchType = "user" | "driver" | "vehicle" | "schedule" | "delivery" | "route" | "expense" | "revenue";
type GlobalSearchFilter = "all" | "users" | "drivers" | "vehicles" | "schedules" | "deliveries" | "routes" | "finance";
type GlobalSearchResult = { id: string; type: GlobalSearchType; title: string; subtitle?: string; metadata?: string; status?: string; href: string; recordId: string; relatedId?: string; routeId?: string; deliveryId?: string; driverId?: string; vehicleId?: string; rank: number };
type GlobalSearchResponse = { results: GlobalSearchResult[] };

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "AU";
}

function globalSearchGroupLabel(type: GlobalSearchType) {
  if (type === "user") return "Users";
  if (type === "driver") return "Drivers";
  if (type === "vehicle") return "Vehicles";
  if (type === "schedule") return "Schedules";
  if (type === "delivery") return "Deliveries";
  if (type === "route") return "Routes";
  if (type === "expense") return "Expenses";
  return "Revenue";
}

function globalSearchIcon(type: GlobalSearchType) {
  if (type === "user") return AppIcons.users;
  if (type === "delivery") return AppIcons.deliveries;
  if (type === "route") return AppIcons.routes;
  if (type === "driver") return AppIcons.drivers;
  if (type === "vehicle") return AppIcons.vehicles;
  if (type === "schedule") return AppIcons.schedules;
  return AppIcons.finance;
}

function filterMatches(type: GlobalSearchType, filter: GlobalSearchFilter) {
  if (filter === "all") return true;
  if (filter === "finance") return type === "expense" || type === "revenue";
  return filter === `${type}s`;
}

function globalSearchStatusClass(type: GlobalSearchType, status: string) {
  const normalized = status.toLowerCase().replaceAll(" ", "_");

  if (["inactive", "unavailable", "failed", "cancelled", "out_of_service"].includes(normalized)) {
    return "bg-red-50 text-red-700 ring-1 ring-red-100";
  }
  if (["delayed", "maintenance_due", "maintenance"].includes(normalized)) {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  }
  if (["active", "available", "delivered", "completed", "paid"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  }
  if (["on_delivery", "in_transit"].includes(normalized)) {
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-100";
  }
  if (["assigned", "scheduled"].includes(normalized)) {
    return "bg-purple-50 text-purple-700 ring-1 ring-purple-100";
  }
  if (type === "vehicle") return "bg-blue-50 text-blue-700 ring-1 ring-blue-100";
  if (type === "schedule") return "bg-purple-50 text-purple-700 ring-1 ring-purple-100";
  if (type === "delivery" || type === "route") return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100";
  if (type === "expense") return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
  if (type === "revenue") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return <>{text}</>;
  const index = text.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (index < 0) return <>{text}</>;
  return <>{text.slice(0, index)}<span className="font-bold text-purple-700">{text.slice(index, index + normalizedQuery.length)}</span>{text.slice(index + normalizedQuery.length)}</>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const pathname = usePathname();
  const isRoutesWorkspace = pathname === "/admin/routes";
  const router = useRouter();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [openTopbarMenu, setOpenTopbarMenu] = useState<OpenTopbarMenu>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [routesSearch, setRoutesSearch] = useState("");
  const [routesSearchResults, setRoutesSearchResults] = useState<GlobalSearchResult[]>([]);
  const [, setUnreadAlertsCount] = useState(0);
  const [globalSearchFilter, setGlobalSearchFilter] = useState<GlobalSearchFilter>("all");
  const [isRoutesSearchLoading, setIsRoutesSearchLoading] = useState(false);
  const [isRoutesSearchOpen, setIsRoutesSearchOpen] = useState(false);
  const [activeRouteSearchIndex, setActiveRouteSearchIndex] = useState(-1);
  const [profileName, setProfileName] = useState({
    firstName: "Administrator",
    lastName: "User",
  });
  const [userRole, setUserRole] = useState<QuickActionsRole | null>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const routesSearchRef = useRef<HTMLLabelElement>(null);
  const routesSearchTriggerRef = useRef<HTMLInputElement>(null);
  const globalSearchInputRef = useRef<HTMLInputElement>(null);
  const globalSearchPanelRef = useRef<HTMLDivElement>(null);
  const routesSearchRequestRef = useRef(0);
  const ignoreRestoredSearchFocusRef = useRef(false);

  const closeGlobalSearch = useCallback(() => {
    if (!isRoutesSearchOpen) return;

    ignoreRestoredSearchFocusRef.current = true;
    setIsRoutesSearchOpen(false);
  }, [isRoutesSearchOpen]);
  const fullName = `${profileName.firstName} ${profileName.lastName}`.trim();
  const isQuickActionsOpen = openTopbarMenu === "quick-actions";
  const isProfileOpen = openTopbarMenu === "user-profile";
  const initials = getInitials(profileName.firstName, profileName.lastName);
  const BrandIcon = AppIcons.brand;
  const SearchIcon = AppIcons.search;
  const CaretDownIcon = AppIcons.dropdown;
  const LogoutIcon = AppIcons.logout;
  const flatRoutesSearchResults = useMemo(() => {
    const types: GlobalSearchType[] = ["user", "driver", "vehicle", "schedule", "delivery", "route", "expense", "revenue"];
    return types.flatMap((type) => routesSearchResults.filter((result) => result.type === type && filterMatches(type, globalSearchFilter)).slice(0, 5));
  }, [globalSearchFilter, routesSearchResults]);
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
    queueMicrotask(() => {
      setRoutesSearch("");
      setRoutesSearchResults([]);
      setIsRoutesSearchOpen(false);
      setActiveRouteSearchIndex(-1);
    });
    return () => window.clearTimeout(closeMenu);
  }, [pathname]);

  useEffect(() => {
    const requestId = routesSearchRequestRef.current + 1;
    routesSearchRequestRef.current = requestId;
    const query = routesSearch.trim();
    if (query.length < 2) {
      queueMicrotask(() => {
        setIsRoutesSearchLoading(false);
        setRoutesSearchResults([]);
        setActiveRouteSearchIndex(-1);
      });
      return;
    }
    queueMicrotask(() => setIsRoutesSearchLoading(true));
    const timer = window.setTimeout(() => {
      if (routesSearchRequestRef.current !== requestId) return;
      void fetchAdministratorJson<GlobalSearchResponse>(`/api/admin/search?q=${encodeURIComponent(query)}`).then((data) => {
        if (routesSearchRequestRef.current !== requestId) return;
        setRoutesSearchResults(data.results);
        setActiveRouteSearchIndex(data.results.length ? 0 : -1);
        setIsRoutesSearchLoading(false);
        setIsRoutesSearchOpen(true);
      }).catch(() => {
        if (routesSearchRequestRef.current !== requestId) return;
        setRoutesSearchResults([]);
        setIsRoutesSearchLoading(false);
        notify.error("Global search could not be loaded.");
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [notify, routesSearch]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!routesSearchRef.current?.contains(target) && !globalSearchPanelRef.current?.contains(target)) closeGlobalSearch();
    }
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const isSearchShortcut =
        (event.key === "/" && !isTyping) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k");

      if (isSearchShortcut) {
        event.preventDefault();
        routesSearchTriggerRef.current?.focus();
        setIsRoutesSearchOpen(true);
        return;
      }

      if (event.key === "Escape") closeGlobalSearch();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeGlobalSearch]);

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

  function selectRouteSearchResult(result: GlobalSearchResult) {
    const canUseRoutesMap = isRoutesWorkspace && ["delivery", "route", "driver", "vehicle"].includes(result.type);
    if (canUseRoutesMap) {
      window.dispatchEvent(new CustomEvent("deliver-eaze:routes-search-select", { detail: result }));
    } else {
      router.push(result.href);
    }
    closeGlobalSearch();
    setActiveRouteSearchIndex(-1);
  }

  return (
    <div className={`${isRoutesWorkspace ? "h-dvh overflow-hidden bg-[#edf4f3]" : "min-h-screen bg-slate-100"} text-slate-950`}>
      <AppModalShell
        dialogClassName="w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-[22px] border border-white/85 bg-white/98 text-slate-900 shadow-[0_34px_110px_-34px_rgba(15,23,42,.75),0_0_0_1px_rgba(139,92,246,.10)] ring-1 ring-purple-100/70 backdrop-blur-xl"
        dialogRef={globalSearchPanelRef}
        initialFocusRef={globalSearchInputRef}
        label="Global search"
        onClose={closeGlobalSearch}
        open={isRoutesSearchOpen}
        placement="search"
        returnFocusRef={routesSearchTriggerRef}
      >
          <div className="relative border-b border-slate-100">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon aria-hidden size={18} weight="bold" />
            </span>
            <input
              aria-activedescendant={activeRouteSearchIndex >= 0 && flatRoutesSearchResults[activeRouteSearchIndex] ? `global-search-option-${flatRoutesSearchResults[activeRouteSearchIndex].id}` : undefined}
              aria-controls="global-search-results"
              aria-expanded={isRoutesSearchOpen}
              autoFocus
              className="h-14 w-full bg-white pl-11 pr-11 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              onChange={(event) => { setRoutesSearch(event.target.value); setIsRoutesSearchOpen(true); if (isRoutesWorkspace) window.dispatchEvent(new CustomEvent("deliver-eaze:routes-search", { detail: event.target.value })); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveRouteSearchIndex((current) => Math.min(flatRoutesSearchResults.length - 1, current + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveRouteSearchIndex((current) => Math.max(0, current - 1));
                } else if (event.key === "Enter") {
                  const result = flatRoutesSearchResults[activeRouteSearchIndex];
                  if (result) {
                    event.preventDefault();
                    selectRouteSearchResult(result);
                  }
                } else if (event.key === "Escape") {
                  closeGlobalSearch();
                }
              }}
              placeholder="Search across DeliverEaze"
              ref={globalSearchInputRef}
              role="combobox"
              type="text"
              value={routesSearch}
            />
            {routesSearch ? (
              <button
                aria-label="Clear global search"
                className="absolute right-4 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-purple-50 hover:text-purple-700"
                onClick={() => {
                  setRoutesSearch("");
                  setRoutesSearchResults([]);
                  if (isRoutesWorkspace) window.dispatchEvent(new CustomEvent("deliver-eaze:routes-search", { detail: "" }));
                }}
                type="button"
              >
                <AppIcons.close aria-hidden size={14} weight="bold" />
              </button>
            ) : null}
          </div>
          <div className="p-2" id="global-search-results" role="listbox">
            <div className="user-modal-scrollbar mb-2 flex gap-1 overflow-x-auto px-1 pb-1 text-xs font-semibold">
              {(["all", "users", "drivers", "vehicles", "schedules", "deliveries", "routes", "finance"] as GlobalSearchFilter[]).map((filter) => (
                <button
                  className={`shrink-0 rounded-full px-3 py-1.5 transition ${globalSearchFilter === filter ? "bg-purple-600 text-white shadow-sm shadow-purple-200" : "bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700"}`}
                  key={filter}
                  onClick={() => setGlobalSearchFilter(filter)}
                  type="button"
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            {!routesSearch.trim() ? (
              <div className="px-5 py-6 text-sm leading-6 text-slate-500">Search by name, record number, vehicle, address, or invoice.</div>
            ) : isRoutesSearchLoading ? (
              <div className="px-5 py-6 text-sm font-medium text-slate-500">Searching DeliverEaze...</div>
            ) : flatRoutesSearchResults.length ? (
              <div className="user-modal-scrollbar max-h-[min(28rem,calc(100vh-13rem))] overflow-y-auto pr-1">
                {(["user", "driver", "vehicle", "schedule", "delivery", "route", "expense", "revenue"] as GlobalSearchType[]).map((type) => {
                  const groupResults = routesSearchResults.filter((result) => result.type === type && filterMatches(result.type, globalSearchFilter)).slice(0, 5);
                  if (!groupResults.length) return null;
                  return (
                    <div className="py-1" key={type}>
                      <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{globalSearchGroupLabel(type)}</p>
                      <div className="space-y-1">
                        {groupResults.map((result) => {
                          const flatIndex = flatRoutesSearchResults.findIndex((item) => item.id === result.id);
                          const Icon = globalSearchIcon(result.type);
                          const active = flatIndex === activeRouteSearchIndex;
                          return (
                            <button
                              aria-selected={active}
                              className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition ${active ? "bg-purple-50 text-purple-950 ring-1 ring-purple-100" : "hover:bg-slate-50"}`}
                              id={`global-search-option-${result.id}`}
                              key={result.id}
                              onClick={() => selectRouteSearchResult(result)}
                              onMouseDown={(event) => event.preventDefault()}
                              onMouseEnter={() => setActiveRouteSearchIndex(flatIndex)}
                              role="option"
                              type="button"
                            >
                              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-600 ring-1 ring-purple-100">
                                <Icon aria-hidden size={17} weight="bold" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-3">
                                  <span className="truncate text-sm font-bold text-slate-900"><HighlightMatch query={routesSearch} text={result.title} /></span>
                                  {result.status ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${globalSearchStatusClass(result.type, result.status)}`}>{result.status.replaceAll("_", " ")}</span> : null}
                                </span>
                                {result.subtitle ? <span className="mt-0.5 block truncate text-xs text-slate-500"><HighlightMatch query={routesSearch} text={result.subtitle} /></span> : null}
                                {result.metadata ? <span className="mt-1 block text-[11px] font-medium text-slate-400">{result.metadata}</span> : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-6">
                <p className="text-sm font-bold text-slate-800">No matching records found.</p>
                <p className="mt-1 text-xs text-slate-500">Try another name, number, vehicle, or location.</p>
              </div>
            )}
          </div>
      </AppModalShell>
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
          className="relative block min-h-[88px] w-full min-w-0"
          href="/admin"
        >
          <span
            aria-hidden={!isSidebarExpanded}
            className={`absolute inset-y-0 left-0 flex w-[200px] origin-left items-center transition-[opacity,transform] duration-200 ease-out will-change-[opacity,transform] motion-reduce:transition-none ${
              isSidebarExpanded ? "scale-100 opacity-100" : "pointer-events-none scale-[0.97] opacity-0"
            }`}
          >
            <Image
              alt="DeliverEaze Logistics"
              className="h-auto w-full max-w-[200px] -translate-y-4 object-contain object-left"
              height={466}
              src="/images/brand/deliver-eaze-full.png"
              width={1430}
            />
          </span>
          <span
            aria-hidden={isSidebarExpanded}
            className={`absolute inset-y-0 left-[7px] flex w-[42px] origin-left items-center transition-[opacity,transform] duration-200 ease-out will-change-[opacity,transform] motion-reduce:transition-none ${
              isSidebarExpanded ? "pointer-events-none scale-[0.97] opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <Image
              alt=""
              className="h-[52px] w-[42px] -translate-y-4 object-contain"
              height={466}
              src="/images/brand/deliver-eaze-mark.png"
              width={382}
            />
          </span>
        </Link>

        <nav aria-label="Administrator navigation" className="flex-1 space-y-1">
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
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
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
          <div className="flex flex-wrap items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_minmax(18rem,24rem)_1fr]">
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

            <label className="relative order-3 w-full justify-self-center lg:order-none lg:block" ref={routesSearchRef}>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon aria-hidden size={18} weight="bold" />
              </span>
              <input
                aria-activedescendant={activeRouteSearchIndex >= 0 && flatRoutesSearchResults[activeRouteSearchIndex] ? `global-search-option-${flatRoutesSearchResults[activeRouteSearchIndex].id}` : undefined}
                aria-controls="global-search-results"
                aria-expanded={isRoutesSearchOpen}
                role="combobox"
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                onChange={(event) => { setRoutesSearch(event.target.value); setIsRoutesSearchOpen(true); if (isRoutesWorkspace) window.dispatchEvent(new CustomEvent("deliver-eaze:routes-search", { detail: event.target.value })); }}
                onFocus={() => {
                  if (ignoreRestoredSearchFocusRef.current) {
                    ignoreRestoredSearchFocusRef.current = false;
                    return;
                  }

                  setIsRoutesSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setIsRoutesSearchOpen(true);
                    setActiveRouteSearchIndex((current) => Math.min(flatRoutesSearchResults.length - 1, current + 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveRouteSearchIndex((current) => Math.max(0, current - 1));
                  } else if (event.key === "Enter") {
                    const result = flatRoutesSearchResults[activeRouteSearchIndex];
                    if (result) {
                      event.preventDefault();
                      selectRouteSearchResult(result);
                    }
                  } else if (event.key === "Escape") {
                    closeGlobalSearch();
                  }
                }}
                placeholder="Search across DeliverEaze"
                ref={routesSearchTriggerRef}
                type="text"
                value={routesSearch}
              />
              {routesSearch ? (
                <button
                  aria-label="Clear route search"
                  className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-white/70 hover:text-purple-700"
                  onClick={() => {
                    setRoutesSearch("");
                    setRoutesSearchResults([]);
                    closeGlobalSearch();
                    if (isRoutesWorkspace) window.dispatchEvent(new CustomEvent("deliver-eaze:routes-search", { detail: "" }));
                  }}
                  type="button"
                >
                  <AppIcons.close aria-hidden size={14} weight="bold" />
                </button>
              ) : null}
              {false ? (
                <div className={`absolute left-0 right-0 z-50 max-h-[min(32rem,calc(100vh-7rem))] overflow-hidden border p-2 shadow-[0_36px_110px_-34px_rgba(0,0,0,.88)] backdrop-blur-xl ${isRoutesSearchOpen ? "top-10 rounded-b-2xl border-white/10 border-t-0 bg-[#202322] text-slate-100 ring-1 ring-white/10" : "top-12 rounded-2xl border-white/90 bg-white/98 ring-1 ring-slate-900/5"}`} id="global-search-results" role="listbox">
                  <div className="user-modal-scrollbar mb-2 flex gap-1 overflow-x-auto px-1 pb-1 text-xs font-semibold">{(["all", "users", "drivers", "vehicles", "schedules", "deliveries", "routes", "finance"] as GlobalSearchFilter[]).map((filter) => <button className={`shrink-0 rounded-full px-3 py-1.5 transition ${globalSearchFilter === filter ? "bg-purple-600 text-white" : "bg-white/[0.07] text-slate-300 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"}`} key={filter} onClick={() => setGlobalSearchFilter(filter)} type="button">{filter.charAt(0).toUpperCase() + filter.slice(1)}</button>)}</div>
                  {!routesSearch.trim() ? <div className="px-4 py-5 text-sm text-slate-300">Search by name, record number, vehicle, address, or invoice.</div> : isRoutesSearchLoading ? <div className="px-4 py-5 text-sm font-medium text-slate-300">Searching DeliverEaze...</div> : flatRoutesSearchResults.length ? <div className="user-modal-scrollbar max-h-[28rem] overflow-y-auto pr-1">{(["user", "driver", "vehicle", "schedule", "delivery", "route", "expense", "revenue"] as GlobalSearchType[]).map((type) => {
                    const groupResults = routesSearchResults.filter((result) => result.type === type && filterMatches(result.type, globalSearchFilter)).slice(0, 5);
                    if (!groupResults.length) return null;
                    return <div className="py-1" key={type}><p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{globalSearchGroupLabel(type)}</p><div className="space-y-1">{groupResults.map((result) => { const flatIndex = flatRoutesSearchResults.findIndex((item) => item.id === result.id); const Icon = globalSearchIcon(result.type); const active = flatIndex === activeRouteSearchIndex; return <button aria-selected={active} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-white/[0.08] text-white ring-1 ring-white/10" : "hover:bg-white/[0.06]"}`} id={`global-search-option-${result.id}`} key={result.id} onMouseEnter={() => setActiveRouteSearchIndex(flatIndex)} onMouseDown={(event) => event.preventDefault()} onClick={() => selectRouteSearchResult(result)} role="option" type="button"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-purple-500/15 text-purple-300 ring-1 ring-purple-400/20"><Icon aria-hidden size={17} weight="bold" /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="truncate text-sm font-bold text-slate-100"><HighlightMatch query={routesSearch} text={result.title} /></span>{result.status ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${globalSearchStatusClass(result.type, result.status)}`}>{result.status.replaceAll("_", " ")}</span> : null}</span>{result.subtitle ? <span className="mt-0.5 block truncate text-xs text-slate-400"><HighlightMatch query={routesSearch} text={result.subtitle} /></span> : null}{result.metadata ? <span className="mt-1 block text-[11px] font-medium text-slate-500">{result.metadata}</span> : null}</span></button>; })}</div></div>;
                  })}</div> : <div className="px-4 py-5"><p className="text-sm font-bold text-slate-100">No matching records found.</p><p className="mt-1 text-xs text-slate-400">Try another name, number, vehicle, or location.</p></div>}
                </div>
              ) : null}
            </label>

            <div className="flex items-center gap-3 lg:justify-self-end">
              <NotificationBell onUnreadCountChange={setUnreadAlertsCount} />

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
                  <span className="relative">
                    <MobileIcon aria-hidden size={18} weight={isActive ? "fill" : "bold"} />
                  </span>
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
