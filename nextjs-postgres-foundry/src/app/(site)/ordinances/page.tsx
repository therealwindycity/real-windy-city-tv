import Link from "next/link";
import { listOrdinances } from "@/lib/bundle";

export const dynamic = "force-dynamic";
const KINDS = ["Annexation", "Rezoning", "Code amendment", "Fiscal", "Ordinance"];
const chip = (s: string) => (s === "first" ? "bg-sky-500" : s === "second" ? "bg-amber-400" : s === "third" ? "bg-emerald-400" : "bg-slate-500");

export default async function OrdinancesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rows = await listOrdinances({ q: sp.q || undefined, kind: sp.kind || undefined, limit: 80 });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-black tracking-tight">Ordinance arcs</h1>
      <p className="text-sm text-slate-400">Every ordinance is a mini-series. Its readings are the episodes: <span className="font-bold text-sky-400">pilot</span> (1st reading) → <span className="font-bold text-amber-300">second act</span> (2nd) → <span className="font-bold text-emerald-400">finale</span> (3rd).</p>
      <form method="get" className="mt-4 flex flex-wrap gap-2 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="Search ordinance titles (e.g. Roundtop, zoning, Municipal Code)…" className="min-w-[240px] flex-1 rounded border border-white/15 bg-white/5 px-3 py-2 outline-none focus:border-amber-300" />
        <select name="kind" defaultValue={sp.kind ?? ""} className="rounded border border-white/15 bg-[#0d1220] px-3 py-2">
          <option value="">All kinds</option>
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <button className="rounded bg-amber-400 px-4 py-2 font-bold text-black">Filter</button>
      </form>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {rows.map((o) => (
          <Link key={o.slug} href={`/ordinance/${o.slug}`} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10 hover:ring-amber-300/60">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-300"><span>{o.kind}</span><span className="text-slate-500">{o.firstDate} → {o.lastDate}</span></div>
            <div className="mt-1 line-clamp-3 text-sm font-semibold leading-snug">{o.title}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {o.readings.slice(0, 14).map((r, i) => <span key={i} className={`rounded px-1.5 py-0.5 text-[9px] font-black text-black ${chip(r.stage)}`}>{r.date.slice(2)}</span>)}
            </div>
          </Link>
        ))}
      </div>
      {rows.length === 0 && <p className="mt-10 text-center text-slate-400">No ordinances match.</p>}
    </div>
  );
}
