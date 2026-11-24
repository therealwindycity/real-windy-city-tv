import Link from "next/link";
import EpisodeCard from "@/components/EpisodeCard";
import { BODIES, listEpisodes, seasonSummary } from "@/lib/bundle";

export const dynamic = "force-dynamic";
const PAGE = 36;

export default async function EpisodesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const season = sp.season ? Number(sp.season) : undefined;
  const [{ rows, total }, summary] = await Promise.all([
    listEpisodes({ body: sp.body || undefined, season, q: sp.q || undefined, withMinutes: sp.minutes === "1", limit: PAGE, offset: (page - 1) * PAGE }),
    seasonSummary(),
  ]);
  const seasons = [...new Set(summary.map((s) => s.season))].sort((a, b) => b - a);
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { body: sp.body, season: sp.season, q: sp.q, minutes: sp.minutes, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/episodes${s ? `?${s}` : ""}`;
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-black tracking-tight">All episodes</h1>
      <p className="text-sm text-slate-400">{total} meetings from the Wayback-archived season guide, merged with the agenda and minutes database. Every one is an episode.</p>
      <form className="mt-4 flex flex-wrap items-center gap-2 text-sm" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Search titles, dates (2026-09), bodies…" className="min-w-[220px] flex-1 rounded border border-white/15 bg-white/5 px-3 py-2 outline-none focus:border-amber-300" />
        <select name="body" defaultValue={sp.body ?? ""} className="rounded border border-white/15 bg-[#0d1220] px-3 py-2">
          <option value="">All series</option>
          {BODIES.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
        </select>
        <select name="season" defaultValue={sp.season ?? ""} className="rounded border border-white/15 bg-[#0d1220] px-3 py-2">
          <option value="">All seasons</option>
          {seasons.map((s) => <option key={s} value={s}>Season {s}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-300"><input type="checkbox" name="minutes" value="1" defaultChecked={sp.minutes === "1"} /> has full minutes text</label>
        <button className="rounded bg-amber-400 px-4 py-2 font-bold text-black">Filter</button>
        <Link href="/episodes" className="text-xs text-slate-400 underline">reset</Link>
      </form>
      <div className="mt-6 grid justify-items-center gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((m) => <EpisodeCard key={m.slug} m={m} />)}
      </div>
      {rows.length === 0 && <p className="mt-10 text-center text-slate-400">No episodes match.</p>}
      <div className="mt-8 flex items-center justify-center gap-3 text-sm">
        {page > 1 && <Link className="rounded bg-white/10 px-4 py-2" href={qs({ page: String(page - 1) })}>← Newer</Link>}
        <span className="text-slate-400">Page {page} of {Math.max(1, Math.ceil(total / PAGE))}</span>
        {page * PAGE < total && <Link className="rounded bg-white/10 px-4 py-2" href={qs({ page: String(page + 1) })}>Older →</Link>}
      </div>
    </div>
  );
}
