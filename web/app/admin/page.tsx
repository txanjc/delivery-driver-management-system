import Link from "next/link";

import {
  AdminCard,
  AdminPageIntro,
  PrimaryActionLink,
  SecondaryButton,
} from "./_components/admin-design-system";
import { StatusBadge } from "./_components/admin-ui";

const deliveries = [
  { id: "#DE-29109", pickup: "La Paz Central", destination: "Calacoto", date: "Jul 1, 2026", status: "Pending" as const },
  { id: "#DE-29108", pickup: "El Alto Hub", destination: "Miraflores", date: "Jul 1, 2026", status: "In Transit" as const },
  { id: "#DE-29107", pickup: "Sopocachi", destination: "Achumani", date: "Jun 30, 2026", status: "Assigned" as const },
  { id: "#DE-29106", pickup: "Obrajes", destination: "San Miguel", date: "Jun 30, 2026", status: "Delivered" as const },
];

function DashboardIcon({ type }: { type: "box" | "pin" | "truck" }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#132b36] text-white">
      <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        {type === "box" ? <><path d="m4 7 8-4 8 4-8 4z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></> : null}
        {type === "pin" ? <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></> : null}
        {type === "truck" ? <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></> : null}
      </svg>
    </span>
  );
}

function MapPin({ className }: { className: string }) {
  return <span className={`absolute h-4 w-4 rounded-full border-[4px] border-[#7547ee] bg-white shadow-[0_0_0_5px_rgba(117,71,238,0.14)] ${className}`} />;
}

export default function AdminPage() {
  return (
    <section className="space-y-4">
      <AdminPageIntro
        actions={
          <>
            <SecondaryButton type="button">This week</SecondaryButton>
            <PrimaryActionLink href="/admin/deliveries">
              + Add delivery
            </PrimaryActionLink>
          </>
        }
        eyebrow="Operations overview"
        title="Dashboard"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <article className="relative overflow-hidden rounded-[20px] bg-[#132b36] p-5 text-white shadow-sm">
              <div className="flex items-center gap-3"><span className="bg-white text-[#132b36] [&>span]:bg-white [&>span]:text-[#132b36]"><DashboardIcon type="box" /></span><p className="text-sm text-slate-200">Active deliveries</p></div>
              <div className="mt-7 flex items-end gap-2"><strong className="text-3xl font-semibold">112</strong><span className="mb-1 text-xs font-semibold text-lime-300">↗ 20%</span></div>
              <svg aria-hidden className="absolute bottom-0 right-0 h-20 w-32 opacity-90" viewBox="0 0 130 80"><defs><linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#7848f4" stopOpacity=".7"/><stop offset="1" stopColor="#7848f4" stopOpacity="0"/></linearGradient></defs><path d="M0 70C20 65 28 26 51 42s31 24 41-3 22-25 38-34v75H0Z" fill="url(#lineFill)"/><path d="M0 70C20 65 28 26 51 42s31 24 41-3 22-25 38-34" fill="none" stroke="#7c4dff" strokeWidth="2"/></svg>
            </article>
            <AdminCard className="p-5">
              <div className="flex items-center gap-3"><DashboardIcon type="pin" /><p className="text-sm text-slate-600">Awaiting drop-off</p></div>
              <div className="mt-7 flex items-end justify-between"><div><strong className="text-3xl font-semibold text-[#17232b]">42</strong><span className="ml-2 text-xs font-semibold text-green-600">↗ 20%</span></div><div className="h-12 w-12 rounded-full border-[5px] border-[#f6c72e] border-r-[#713ce8]" /></div>
            </AdminCard>
            <AdminCard className="p-5">
              <div className="flex items-center gap-3"><DashboardIcon type="truck" /><p className="text-sm text-slate-600">Active vehicles</p></div>
              <div className="mt-7 flex items-end justify-between"><div><strong className="text-3xl font-semibold text-[#17232b]">92%</strong><span className="ml-1 text-[10px] text-green-600">31 active</span></div><div className="flex h-12 items-end gap-1">{[27,42,34,22,39,31].map((height, index) => <span className={index === 3 ? "w-1.5 rounded-full bg-amber-300" : "w-1.5 rounded-full bg-[#7442ed]"} key={index} style={{ height }} />)}</div></div>
            </AdminCard>
          </div>

          <AdminCard className="relative min-h-[430px] overflow-hidden bg-[#f4f5f7]">
            <div className="absolute inset-0 bg-[linear-gradient(30deg,transparent_48%,rgba(255,255,255,.95)_49%,rgba(255,255,255,.95)_51%,transparent_52%),linear-gradient(90deg,rgba(210,214,222,.55)_1px,transparent_1px),linear-gradient(rgba(210,214,222,.55)_1px,transparent_1px)] bg-[size:180px_180px,55px_55px,55px_55px]" />
            <div className="absolute left-[18%] top-[8%] h-[115%] w-1.5 -rotate-[43deg] rounded-full bg-[#7442ed]" />
            <div className="absolute left-[42%] top-[40%] h-1.5 w-[45%] rotate-[24deg] rounded-full bg-[#7442ed]" />
            <div className="absolute left-[64%] top-[67%] h-1.5 w-[40%] rotate-[50deg] rounded-full bg-slate-300" />
            <div className="absolute left-5 top-5 z-10"><h2 className="text-lg font-semibold text-[#17232b]">Live tracking</h2><p className="mt-1 text-xs text-slate-500">112 active DeliverEaze deliveries</p></div>
            <MapPin className="left-[26%] top-[28%]" /><MapPin className="left-[48%] top-[48%]" /><MapPin className="left-[72%] top-[60%]" /><MapPin className="left-[86%] top-[78%]" />
            <div className="absolute bottom-5 left-5 z-10 w-52 rounded-2xl bg-white p-4 shadow-xl shadow-slate-300/50"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-[#17232b]">Delivery status</p><span className="text-slate-400">×</span></div><p className="mt-3 text-[10px] text-slate-400">DELIVERY ID</p><p className="text-xs font-semibold">#DE-29108</p><div className="mt-3 space-y-2 text-xs text-slate-600"><p><span className="mr-2 text-[#7442ed]">●</span>Collected · 09:00</p><p><span className="mr-2 text-[#7442ed]">●</span>In transit · 10:43</p><p><span className="mr-2 text-slate-300">●</span>Drop-off · 13:00</p></div></div>
            <div className="absolute bottom-5 right-5 z-10 overflow-hidden rounded-full bg-white shadow-lg"><button className="block h-10 w-10 text-lg" type="button">+</button><div className="h-px bg-slate-100"/><button className="block h-10 w-10 text-lg" type="button">−</button></div>
          </AdminCard>

          <AdminCard className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4"><div><h2 className="text-lg font-semibold text-[#17232b]">Recent deliveries</h2><p className="mt-1 text-xs text-slate-400">Latest activity across your network</p></div><Link className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600" href="/admin/deliveries">View all</Link></div>
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-y border-slate-100 bg-slate-50/60 text-left text-xs text-slate-400"><tr><th className="px-5 py-3 font-medium">Delivery ID</th><th className="px-5 py-3 font-medium">Pickup</th><th className="px-5 py-3 font-medium">Destination</th><th className="px-5 py-3 font-medium">Expected</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{deliveries.map((delivery) => <tr className="hover:bg-slate-50/70" key={delivery.id}><td className="px-5 py-4 font-semibold text-[#17232b]">{delivery.id}</td><td className="px-5 py-4 text-slate-500">{delivery.pickup}</td><td className="px-5 py-4 text-slate-500">{delivery.destination}</td><td className="px-5 py-4 text-slate-500">{delivery.date}</td><td className="px-5 py-4"><StatusBadge status={delivery.status}/></td></tr>)}</tbody></table></div>
          </AdminCard>
        </div>

        <aside className="space-y-4">
          <AdminCard className="p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-[#17232b]">Delivery vehicles</h2><button className="h-9 w-9 rounded-full border border-slate-200 text-slate-400" type="button">...</button></div><div className="mt-5 flex items-end justify-between"><div><strong className="text-4xl font-semibold">31</strong><span className="ml-2 rounded-full bg-amber-300 px-2 py-1 text-[10px] font-semibold">+12.4%</span><p className="mt-2 text-xs text-slate-400">than last week</p></div><div className="relative h-20 w-28"><div className="absolute bottom-2 right-1 h-10 w-24 rounded-lg bg-[#6534de]"/><div className="absolute bottom-0 left-3 h-4 w-4 rounded-full bg-[#17232b] ring-4 ring-white"/><div className="absolute bottom-0 right-3 h-4 w-4 rounded-full bg-[#17232b] ring-4 ring-white"/><div className="absolute bottom-10 right-5 h-7 w-12 -skew-x-12 rounded-t-lg bg-[#7b4af0]"/></div></div><p className="mt-5 text-xs text-slate-500"><span className="mr-2 text-green-500">●</span>On-route</p></AdminCard>
          <AdminCard className="p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-[#17232b]">Delivery rate</h2><span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs">Last week</span></div><p className="mt-5 text-3xl font-semibold">76.6%</p><p className="text-xs text-slate-400">than last week</p><div className="mt-5 flex h-32 items-end gap-2">{[52,38,67,108,49,78,90].map((height,index)=><div className="flex flex-1 flex-col items-center gap-2" key={index}><span className={index===3?"w-full rounded-lg bg-[#713ce8]":"w-full rounded-lg bg-[#f0ecfb]"} style={{height}}/><span className="text-[10px] text-slate-400">{["Su","Mo","Tu","We","Th","Fr","Sa"][index]}</span></div>)}</div></AdminCard>
          <AdminCard className="p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-[#17232b]">Deliveries completed</h2><span className="text-slate-400">Up</span></div><div className="relative mx-auto mt-6 h-28 w-52 overflow-hidden"><div className="absolute left-1/2 top-4 h-44 w-44 -translate-x-1/2 rounded-full border-[18px] border-[#ece7fb] border-l-[#6d3df0] border-t-[#6d3df0] rotate-[-35deg]"/><div className="absolute inset-x-0 bottom-0 text-center"><strong className="text-2xl">87,321</strong><p className="text-[10px] text-slate-400">deliveries completed</p></div></div></AdminCard>
          <article className="rounded-[20px] bg-[#172f3a] p-5 text-white shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Attention needed</p><p className="mt-3 text-3xl font-semibold">7</p><p className="mt-1 text-sm text-slate-300">delayed deliveries require dispatcher review.</p><Link className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#17232b]" href="/admin/deliveries">Review deliveries</Link></article>
        </aside>
      </div>
    </section>
  );
}
