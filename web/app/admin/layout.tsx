import Link from "next/link";

const navigationItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Drivers", href: "/admin/drivers" },
  { label: "Vehicles", href: "/admin/vehicles" },
  { label: "Deliveries", href: "/admin/deliveries" },
  { label: "Schedules", href: "/admin/schedules" },
  { label: "Logout", href: "/login" },
];

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-white px-4 py-6">
          <nav aria-label="Admin navigation" className="space-y-1">
            {navigationItems.map((item) => (
              <Link
                className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-8 py-5">
            <p className="text-lg font-semibold text-slate-950">
              DeliverEaze Logistics
            </p>
          </header>

          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
