import Link from "next/link";
import EpisodeCard from "@/components/EpisodeCard";
import InstantFilterForm from "@/components/InstantFilterForm";
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
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
      <p className="text-sm text-slate-400">
        {total.toLocaleString()} meetings from the Internet Archive / Wayback broadcast guide, merged with Official Clerk Minutes and Foundry Packet PDFs.
      </p>
      <InstantFilterForm action="/episodes" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search titles, dates (2026-09), bodies…"
          className="min-w-[220px] flex-1 rounded border border-white/15 bg-white/5 px-3 py-2 outline-none focus:border-amber-300"
        />
        <button type="submit" className="rounded bg-amber-400 px-4 py-2 font-black text-black hover:bg-amber-300">
          Enter ↵
        </button>
        <select name="body" defaultValue={sp.body ?? ""} className="rounded border border-white/15 bg-[#0d1220] px-3 py-2">
          <option value="">All series</option>
          {BODIES.map((b) => (
            <option key={b.key} value={b.key}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="season" defaultValue={sp.season ?? ""} className="rounded border border-white/15 bg-[#0d1220] px-3 py-2">
          <option value="">All seasons</option>
          {seasons.map((s) => (
            <option key={s} value={s}>
              Season {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 rounded border border-white/15 bg-[#0d1220] px-3 py-2 text-xs text-slate-200">
          <input type="checkbox" name="minutes" value="1" defaultChecked={sp.minutes === "1"} /> Has full minutes text
        </label>
        <Link href="/episodes" className="rounded bg-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/20">
          Reset
        </Link>
      </InstantFilterForm>

      <div className="mt-6 grid justify-items-center gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((m) => (
          <EpisodeCard key={m.slug} m={m} />
        ))}
      </div>
      {rows.length === 0 && <p className="mt-10 text-center text-slate-400">No episodes match.</p>}

      <div className="mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-[#080f1d] px-4 py-3 text-xs sm:text-sm">
        {page > 1 ? (
          <Link className="rounded-lg bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20" href={qs({ page: String(page - 1) })}>
            ← Previous Page
          </Link>
        ) : (
          <span className="rounded-lg bg-white/5 px-4 py-2 text-slate-500">← Previous Page</span>
        )}
        <span className="font-mono text-slate-300">
          Page {page} of {totalPages} ({total.toLocaleString()} episodes)
        </span>
        {page < totalPages ? (
          <Link className="rounded-lg bg-amber-400 px-4 py-2 font-black text-black hover:bg-amber-300" href={qs({ page: String(page + 1) })}>
            Next Page →
          </Link>
        ) : (
          <span className="rounded-lg bg-white/5 px-4 py-2 text-slate-500">Next Page →</span>
        )}
      </div>
    </div>
  );
}
