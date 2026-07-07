"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppIcons } from "@/config/icons";

export type QuickActionsRole = "administrator" | "dispatcher";

type QuickAction = {
  label: string;
  href: string;
  page: string;
  roles: QuickActionsRole[];
};

const actions: QuickAction[] = [
  { label: "Add User", href: "/admin/users?action=create", page: "/admin/users", roles: ["administrator"] },
  { label: "Add Driver", href: "/admin/drivers?action=create", page: "/admin/drivers", roles: ["administrator", "dispatcher"] },
  { label: "Add Vehicle", href: "/admin/vehicles?action=create", page: "/admin/vehicles", roles: ["administrator", "dispatcher"] },
  { label: "Create Schedule", href: "/admin/schedules?action=create", page: "/admin/schedules", roles: ["administrator", "dispatcher"] },
  { label: "Create Delivery", href: "/admin/deliveries?action=create", page: "/admin/deliveries", roles: ["administrator", "dispatcher"] },
  { label: "Create Route", href: "/admin/routes?action=create", page: "/admin/routes", roles: ["administrator", "dispatcher"] },
  { label: "Record Expense", href: "/admin/finance", page: "/admin/finance", roles: ["administrator"] },
  { label: "Generate Report", href: "/admin/reports", page: "/admin/reports", roles: ["administrator"] },
  { label: "Generate Operational Report", href: "/admin/reports", page: "/admin/reports", roles: ["dispatcher"] },
];

export function QuickActionsDropdown({ role }: { role: QuickActionsRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const PlusIcon = AppIcons.create;

  const availableActions = useMemo(() => {
    const roleActions = actions.filter(
      (action) => action.roles.includes(role) && action.page !== pathname,
    );

    if (pathname === "/admin/settings") {
      return roleActions.filter((action) => role === "administrator" && action.label === "Add User");
    }

    return roleActions;
  }, [pathname, role]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        if (containerRef.current?.contains(document.activeElement)) {
          triggerRef.current?.focus();
        }
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (availableActions.length === 0) {
    return null;
  }

  function moveFocus(currentIndex: number, direction: 1 | -1) {
    const nextIndex =
      (currentIndex + direction + availableActions.length) % availableActions.length;
    itemRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Quick Actions"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4f6df5] text-white shadow-sm shadow-indigo-200 transition hover:bg-[#405ee8] hover:shadow-md hover:shadow-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-95"
        onClick={() => {
          setIsOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
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
          className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10"
          role="menu"
        >
          {availableActions.map((action, index) => (
            <button
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 focus:bg-indigo-50 focus:text-indigo-700 focus:outline-none"
              key={action.label}
              onClick={() => {
                setIsOpen(false);
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
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <PlusIcon aria-hidden size={15} weight="bold" />
              </span>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
