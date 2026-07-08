"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef } from "react";

import { AppIcons, type AppIconName } from "@/config/icons";

export type QuickActionsRole = "administrator" | "dispatcher";

type QuickAction = {
  label: string;
  href: string;
  icon: AppIconName;
  page: string;
  roles: QuickActionsRole[];
};

const actions: QuickAction[] = [
  { label: "Add User", href: "/admin/users?action=create", icon: "users", page: "/admin/users", roles: ["administrator"] },
  { label: "Add Driver", href: "/admin/drivers?action=create", icon: "drivers", page: "/admin/drivers", roles: ["administrator", "dispatcher"] },
  { label: "Add Vehicle", href: "/admin/vehicles?action=create", icon: "vehicles", page: "/admin/vehicles", roles: ["administrator", "dispatcher"] },
  { label: "Create Schedule", href: "/admin/schedules?action=create", icon: "schedules", page: "/admin/schedules", roles: ["administrator", "dispatcher"] },
  { label: "Create Delivery", href: "/admin/deliveries?action=create", icon: "deliveries", page: "/admin/deliveries", roles: ["administrator", "dispatcher"] },
  { label: "Create Route", href: "/admin/routes?action=create", icon: "routes", page: "/admin/routes", roles: ["administrator", "dispatcher"] },
  { label: "Record Expense", href: "/admin/finance", icon: "finance", page: "/admin/finance", roles: ["administrator"] },
  { label: "Generate Report", href: "/admin/reports", icon: "reports", page: "/admin/reports", roles: ["administrator"] },
  { label: "Generate Operational Report", href: "/admin/reports", icon: "activity", page: "/admin/reports", roles: ["dispatcher"] },
];

export function QuickActionsDropdown({ isOpen, onOpenChange, role }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; role: QuickActionsRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const PlusIcon = AppIcons.create;
  const menuSurfaceClass =
    pathname === "/admin/routes"
      ? "border-white/75 bg-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,.82),rgba(246,243,255,.58))] shadow-[0_24px_70px_-24px_rgba(15,23,42,.40)] ring-white/70 backdrop-blur-xl"
      : "border-white/80 bg-white/95 shadow-[0_24px_70px_-24px_rgba(15,23,42,.28)] ring-slate-900/5 backdrop-blur-xl";
  const itemClass =
    pathname === "/admin/routes"
      ? "hover:bg-white/55 hover:text-indigo-700 focus:bg-white/55 focus:text-indigo-700"
      : "hover:bg-slate-100 hover:text-slate-950 focus:bg-slate-100 focus:text-slate-950";
  const iconClass =
    pathname === "/admin/routes"
      ? "bg-white/55 text-indigo-600"
      : "bg-indigo-50 text-indigo-600";

  const availableActions = useMemo(() => {
    const roleActions = actions.filter(
      (action) => action.roles.includes(role) && action.page !== pathname,
    );

    if (pathname === "/admin/settings") {
      return roleActions.filter((action) => role === "administrator" && action.label === "Add User");
    }

    return roleActions;
  }, [pathname, role]);

  if (availableActions.length === 0) {
    return null;
  }

  function moveFocus(currentIndex: number, direction: 1 | -1) {
    const nextIndex =
      (currentIndex + direction + availableActions.length) % availableActions.length;
    itemRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="relative">
      <button
        aria-controls="quick-actions-menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Quick Actions"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4f6df5] text-white shadow-sm shadow-indigo-200 transition hover:bg-[#405ee8] hover:shadow-md hover:shadow-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-95"
        onClick={() => {
          onOpenChange(!isOpen);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpenChange(true);
            window.setTimeout(() => itemRefs.current[0]?.focus(), 0);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <PlusIcon aria-hidden className="shrink-0" size={18} weight="bold" />
      </button>

      {isOpen ? (
        <div
          aria-label="Quick Actions"
          className={`absolute left-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border p-2 ring-1 ${menuSurfaceClass}`}
          id="quick-actions-menu"
          role="menu"
        >
          {availableActions.map((action, index) => {
            const ActionIcon = AppIcons[action.icon];

            return (
              <button
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition focus:outline-none ${itemClass}`}
                key={action.label}
                onClick={() => {
                  onOpenChange(false);
                  router.push(action.href);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveFocus(index, 1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveFocus(index, -1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    itemRefs.current[0]?.focus();
                  } else if (event.key === "End") {
                    event.preventDefault();
                    itemRefs.current[availableActions.length - 1]?.focus();
                  }
                }}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                role="menuitem"
                type="button"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                  <ActionIcon aria-hidden size={15} weight="bold" />
                </span>
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
