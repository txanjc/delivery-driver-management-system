import { StatusBadge } from "./_components/admin-ui";

const orders = [
  {
    id: "#29109",
    pickup: "123 Main St, NY",
    delivery: "789 Elm St, NY",
    date: "15 Jan, 2026",
    status: "Pending" as const,
  },
  {
    id: "#29108",
    pickup: "456 Oak Ave, LA",
    delivery: "321 Pine Rd, LA",
    date: "11 Jan, 2026",
    status: "In Transit" as const,
  },
  {
    id: "#29107",
    pickup: "789 Maple St, TX",
    delivery: "654 Cedar St, TX",
    date: "13 Jan, 2026",
    status: "Assigned" as const,
  },
  {
    id: "#29106",
    pickup: "333 Walnut St, IL",
    delivery: "555 Spruce St, IL",
    date: "12 Jan, 2026",
    status: "Delivered" as const,
  },
];

const alerts = [
  "Delivery delays: 7 orders require dispatcher review",
  "Vehicle issue: Unit 14 awaiting maintenance clearance",
  "Driver alert: 2 drivers have unconfirmed route blocks",
];

function MetricCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        accent ? "bg-white text-black" : "bg-[#222222] text-white"
      }`}
    >
      <p className="text-xs leading-4 opacity-80">{label}</p>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] opacity-60">{detail}</p>
    </div>
  );
}

function MapMarker({
  className,
  color,
}: {
  className: string;
  color: string;
}) {
  return (
    <span
      className={`absolute flex h-9 w-9 items-center justify-center rounded-full ${color} shadow-[0_0_0_8px_rgba(255,255,255,0.12)] ${className}`}
    >
      <span className="h-3 w-3 rounded-full border-2 border-black/40" />
    </span>
  );
}

export default function AdminPage() {
  return (
    <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            accent
            detail="active now"
            label="Active Drivers"
            value="42"
          />
          <MetricCard
            detail="+8% vs last month"
            label="Active Deliveries"
            value="112"
          />
          <MetricCard
            detail="+7% vs last month"
            label="Available Vehicles"
            value="31"
          />
          <MetricCard
            detail="-4% vs last month"
            label="Delayed Deliveries"
            value="7"
          />
        </div>

        <div className="rounded-2xl bg-[#222222] p-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Status Overview</h2>
            <button
              aria-label="Status options"
              className="h-8 w-8 rounded-full bg-white/10 text-sm text-zinc-300"
              type="button"
            >
              ...
            </button>
          </div>
          <div className="mt-6 flex h-4 overflow-hidden rounded-full bg-zinc-800">
            <div className="w-[18%] bg-zinc-500" />
            <div className="w-[22%] bg-blue-500" />
            <div className="w-[28%] bg-orange-500" />
            <div className="w-[26%] bg-emerald-500" />
            <div className="w-[6%] bg-red-500" />
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-300">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-zinc-500" />
              Pending
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Assigned
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              In Transit
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Delivered
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Failed
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-[#222222] p-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium leading-5">
              Revenue
              <br />
              Performance
            </h2>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
              6 months
            </span>
          </div>
          <div className="relative mt-6 h-32 overflow-hidden">
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
              viewBox="0 0 320 130"
            >
              <path
                d="M0 95 C40 8 63 130 101 92 C142 48 168 112 204 59 C236 13 265 29 320 16"
                fill="none"
                stroke="#a3e635"
                strokeWidth="3"
              />
              <path
                d="M0 114 C49 82 74 65 110 73 C152 82 190 35 230 32 C270 29 292 46 320 38"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeDasharray="4 5"
                strokeWidth="2"
              />
              <circle cx="160" cy="80" fill="#a3e635" r="6" />
            </svg>
          </div>
        </div>

        <div className="rounded-2xl bg-[#222222] p-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Financial Snapshot</h2>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
              This month
            </span>
          </div>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm text-zinc-400">Revenue This Month</span>
              <span className="text-sm font-semibold text-emerald-400">
                $84,500
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm text-zinc-400">Expenses This Month</span>
              <span className="text-sm font-semibold text-orange-400">
                $51,200
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Net Profit</span>
              <span className="text-lg font-semibold text-white">$33,300</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="space-y-4">
        <div className="relative min-h-[540px] overflow-hidden rounded-3xl bg-[#202020] text-white">
          <div className="absolute left-4 top-4 z-10 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
            Active deliveries: 112
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:54px_54px]" />
          <div className="absolute inset-0 opacity-70">
            <div className="absolute left-[-5%] top-[45%] h-2 w-[115%] rotate-[2deg] rounded-full bg-yellow-200/70" />
            <div className="absolute left-[10%] top-[20%] h-2 w-[78%] rotate-[35deg] rounded-full bg-yellow-200/60" />
            <div className="absolute bottom-[22%] left-[20%] h-2 w-[74%] -rotate-[18deg] rounded-full bg-yellow-200/60" />
            <div className="absolute left-[34%] top-0 h-[110%] w-2 rotate-[5deg] rounded-full bg-white/20" />
            <div className="absolute right-[18%] top-[-10%] h-[95%] w-2 rotate-[21deg] rounded-full bg-white/20" />
          </div>
          <MapMarker className="left-[18%] top-[12%]" color="bg-blue-500" />
          <MapMarker className="left-[27%] top-[36%]" color="bg-orange-500" />
          <MapMarker className="left-[44%] top-[54%]" color="bg-emerald-500" />
          <MapMarker className="left-[57%] top-[12%]" color="bg-blue-500" />
          <MapMarker className="left-[75%] top-[20%]" color="bg-emerald-500" />
          <MapMarker className="left-[86%] top-[62%]" color="bg-red-500" />
          <button
            aria-label="Expand map"
            className="absolute right-5 top-5 z-10 flex h-11 min-w-11 items-center justify-center rounded-full bg-white px-3 text-sm font-semibold text-black"
            type="button"
          >
            Max
          </button>
          <div className="absolute bottom-7 right-6 z-10 overflow-hidden rounded-full bg-white text-black">
            <button className="block px-4 py-2 text-lg" type="button">
              +
            </button>
            <div className="h-px bg-zinc-200" />
            <button className="block px-4 py-2 text-lg" type="button">
              -
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl bg-[#222222] p-5 text-white">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-medium">Recent Deliveries</h2>
              <div className="flex rounded-full bg-white/10 p-1 text-xs">
                {["All", "Pending", "Assigned", "In Transit"].map(
                  (filter, index) => (
                    <span
                      className={`rounded-full px-3 py-1.5 ${
                        index === 0
                          ? "bg-white text-black"
                          : "text-zinc-300"
                      }`}
                      key={filter}
                    >
                      {filter}
                    </span>
                  ),
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="py-3 font-medium">Order ID</th>
                    <th className="py-3 font-medium">Pickup address</th>
                    <th className="py-3 font-medium">Delivery address</th>
                    <th className="py-3 font-medium">Date</th>
                    <th className="py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {orders.map((order) => (
                    <tr className="transition hover:bg-white/5" key={order.id}>
                      <td className="py-3 pr-4 text-white">{order.id}</td>
                      <td className="py-3 pr-4">{order.pickup}</td>
                      <td className="py-3 pr-4">{order.delivery}</td>
                      <td className="py-3 pr-4">{order.date}</td>
                      <td className="py-3">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl bg-[#222222] p-5 text-white">
            <h2 className="text-xl font-medium">Alerts</h2>
            <div className="mt-5 space-y-3">
              {alerts.map((alert) => (
                <div
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200"
                  key={alert}
                >
                  {alert}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
