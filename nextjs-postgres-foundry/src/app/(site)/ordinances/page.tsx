import Link from "next/link";
import InstantFilterForm from "@/components/InstantFilterForm";
import { listOrdinances } from "@/lib/bundle";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 28;
const KINDS = ["Annexation", "Rezoning", "Code amendment", "Fiscal", "Ordinance"];
const chip = (s: string) => (s === "first" ? "bg-sky-500" : s === "second" ? "bg-amber-400" : s === "third" ? "bg-emerald-400" : "bg-slate-500");

export default async function OrdinancesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { rows, total } = await listOrdinances({
    q: sp.q || undefined,
    kind: sp.kind || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, kind: sp.kind, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/ordinances${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-black tracking-tight">Ordinance arcs ({total})</h1>
      <p className="text-sm text-slate-400">
        Every ordinance is a mini-series. Its readings are the episodes: <span className="font-bold text-sky-400">pilot</span> (1st reading) →{" "}
        <span className="font-bold text-amber-300">second act</span> (2nd) → <span className="font-bold text-emerald-400">finale</span> (3rd).
      </p>
      <InstantFilterForm action="/ordinances" className="mt-4 flex flex-wrap gap-2 text-sm">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search ordinance titles (e.g. Roundtop, zoning, Municipal Code)…"
          className="min-w-[240px] flex-1 rounded border border-white/15 bg-white/5 px-3 py-2 outline-none focus:border-amber-300"
        />
        <button type="submit" className="rounded bg-amber-400 px-4 py-2 font-black text-black hover:bg-amber-300">
          Enter ↵
        </button>
        <select name="kind" defaultValue={sp.kind ?? ""} className="rounded border border-white/15 bg-[#0d1220] px-3 py-2">
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {(sp.q || sp.kind) && (
          <Link href="/ordinances" className="rounded bg-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/20">
            Reset
          </Link>
        )}
      </InstantFilterForm>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {rows.map((o) => (
          <Link key={o.slug} href={`/ordinance/${o.slug}`} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10 hover:ring-amber-300/60">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
              <span>{o.kind}</span>
              <span className="text-slate-500">
                {o.firstDate} → {o.lastDate}
              </span>
            </div>
            <div className="mt-1 line-clamp-3 text-sm font-semibold leading-snug">{o.title}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {o.readings.slice(0, 14).map((r, i) => (
                <span key={i} className={`rounded px-1.5 py-0.5 text-[9px] font-black text-black ${chip(r.stage)}`}>
                  {r.date.slice(2)}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
      {rows.length === 0 && <p className="mt-10 text-center text-slate-400">No ordinances match.</p>}

      <div className="mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-[#080f1d] px-4 py-3 text-xs sm:text-sm">
        {page > 1 ? (
          <Link className="rounded-lg bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20" href={qs({ page: String(page - 1) })}>
            ← Previous Page
          </Link>
        ) : (
          <span className="rounded-lg bg-white/5 px-4 py-2 text-slate-500">← Previous Page</span>
        )}
        <span className="font-mono text-slate-300">
          Page {page} of {totalPages} ({total} ordinances)
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
