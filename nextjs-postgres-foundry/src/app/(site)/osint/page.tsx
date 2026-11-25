import Link from "next/link";
import InstantFilterForm from "@/components/InstantFilterForm";
import { listOsintEntities } from "@/lib/bundle";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 16;

const CATEGORIES = [
  "Chamber / LEADS / DDA",
  "Vendor / Contractor",
  "Developer / Property / Project",
  "Council / Elected",
  "City Staff",
  "Special Interest / Watchdog",
];

function fmtUsd(n: number) {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export default async function OsintGraphPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { rows, total } = await listOsintEntities({
    q: sp.q || undefined,
    category: sp.category || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, category: sp.category, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/osint${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-[#071518] via-[#070f1d] to-black p-6 shadow-2xl">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-300">
          🕸️ CIVIC OSINT // ENTITY, VENDOR, CHAMBER/LEADS/DDA &amp; SPEAKER CROSS-REFERENCE MATRIX
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
          51 Verified Civic Entities · Contracts, Bids, Ordinances, Social &amp; Business Profiles
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-300">
          Cross-referencing Cheyenne <b>Council Members</b>, <b>Mayor &amp; City Staff</b>, <b>Cheyenne LEADS</b>,{" "}
          <b>Greater Cheyenne Chamber of Commerce</b>, <b>Downtown Development Authority (DDA)</b>,{" "}
          <b>Engineering &amp; Paving Contractors</b> (AVI PC, Simon Contractors, Knife River, Reiman Corp, Benchmark),{" "}
          <b>Developers &amp; Property Projects</b> (Microsoft, Skybox, Sweetgrass, Cox Ranch), and <b>Civic Watchdogs</b> across 1,615 meetings, 8,983 docket items, and 2,483 speaker clips.
        </p>

        <InstantFilterForm action="/osint" className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search entities, contractors, councilors, LEADS, DDA, bids, projects…"
            className="min-w-[260px] flex-1 rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-white outline-none focus:border-emerald-400"
          />
          <select
            name="category"
            defaultValue={sp.category ?? ""}
            className="rounded-xl border border-white/15 bg-[#08111f] px-3.5 py-2.5 font-semibold text-white"
          >
            <option value="">All Entity Categories ({total})</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-xl bg-emerald-400 px-4 py-2.5 font-black text-black hover:bg-emerald-300">
            Enter ↵
          </button>
          {(sp.q || sp.category) && (
            <Link href="/osint" className="rounded-xl bg-white/10 px-3 py-2.5 font-bold text-slate-200 hover:bg-white/20">
              Reset
            </Link>
          )}
        </InstantFilterForm>

        {/* Quick Category Chips */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <Link
            href={qs({ category: undefined, page: undefined })}
            className={`rounded-full px-3 py-1 font-bold ${!sp.category ? "bg-emerald-400 text-black" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}
          >
            All Categories
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={qs({ category: sp.category === c ? undefined : c, page: undefined })}
              className={`rounded-full px-3 py-1 font-bold ${sp.category === c ? "bg-emerald-400 text-black" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-slate-400">
        <span>
          MATCHED_OSINT_ENTITIES={total} · PAGE {page} OF {totalPages}
        </span>
        <Link href="/speakers" className="font-bold text-amber-300 hover:underline">
          🎙️ Open 2,483 Speaker Clips &amp; Advocacy Analytics →
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((e) => {
          const usd = fmtUsd(e.trackedContractValueUsd);
          return (
            <div key={e.slug} className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#080f1d] p-5 shadow-xl">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-300 ring-1 ring-emerald-400/30">
                      {e.category}
                    </span>
                    <h2 className="mt-1.5 text-xl font-black text-white">{e.name}</h2>
                    <div className="text-xs font-semibold text-sky-300">{e.subtype}</div>
                  </div>
                  <div className="text-right font-mono text-xs">
                    {usd && (
                      <div className="rounded bg-amber-400/20 px-2.5 py-1 font-black text-amber-300 ring-1 ring-amber-400/40">
                        Tracked Bids/Contracts: {usd}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-slate-400">{e.meetingCount} Linked Meetings</div>
                  </div>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-300">{e.nexusSummary}</p>

                {/* Verified Social, LinkedIn, Chamber, Gov & Business Entity Profiles */}
                {e.verifiedProfiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Verified Profiles:</span>
                    {e.verifiedProfiles.map((p, idx) => (
                      <a
                        key={idx}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-sky-500/20 px-2.5 py-1 text-[11px] font-bold text-sky-200 ring-1 ring-sky-400/30 hover:bg-sky-500/30"
                      >
                        🔗 {p.platform}: {p.label} ↗
                      </a>
                    ))}
                  </div>
                )}

                {/* Key Principals / Affiliations */}
                {e.keyPeople.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1 text-[10px]">
                    {e.keyPeople.map((kp, idx) => (
                      <span key={idx} className="rounded bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-white/10">
                        👤 {kp}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tracked Contracts, Bids, Proposals & Packet Exhibits */}
                {e.contractsAndBids.length > 0 && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/45 p-3">
                    <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      📋 Linked Contracts, Bids, Proposals &amp; Docket Items ({e.contractsAndBids.length})
                    </div>
                    <div className="max-h-36 space-y-1.5 overflow-y-auto text-[11px]">
                      {e.contractsAndBids.map((cb, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 border-b border-white/5 pb-1 last:border-0">
                          <Link href={`/episode/${cb.meeting}`} className="text-slate-200 hover:text-amber-300 hover:underline">
                            <span className="font-mono text-sky-300">[{cb.meeting.slice(0, 10)}]</span> {cb.title}
                          </Link>
                          {cb.amountUsd ? (
                            <span className="whitespace-nowrap font-mono font-bold text-emerald-300">{fmtUsd(cb.amountUsd)}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked Ordinances & Resolutions */}
                {e.ordinancesAndResolutions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {e.ordinancesAndResolutions.slice(0, 4).map((o) => (
                      <Link
                        key={o.slug}
                        href={`/ordinance/${o.slug}`}
                        className="truncate rounded bg-violet-500/20 px-2 py-1 text-[10px] font-semibold text-violet-200 ring-1 ring-violet-400/30 hover:bg-violet-500/30"
                        title={o.title}
                      >
                        📜 {o.title.slice(0, 56)}… →
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Co-Appearing Speakers + Direct Historical Clips Link */}
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>🎙️ Linked Speakers &amp; Historical Clip Vaults</span>
                  {e.speakerSlug && (
                    <Link href={`/speakers?speaker=${encodeURIComponent(e.speakerSlug)}`} className="text-amber-300 hover:underline">
                      Open All Speaker Clips →
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {e.linkedSpeakers.map((ls) => (
                    <Link
                      key={ls.slug}
                      href={`/speakers?speaker=${encodeURIComponent(ls.slug)}`}
                      className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-amber-400 hover:font-black hover:text-black"
                    >
                      {ls.name} ({ls.clipCount} clips)
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-300">
          No OSINT entities match that filter. <Link href="/osint" className="text-emerald-300 underline">Reset OSINT filters</Link>.
        </div>
      )}

      {/* Pagination Bar */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#080f1d] px-4 py-3 text-xs">
        {page > 1 ? (
          <Link href={qs({ page: String(page - 1) })} className="rounded-lg bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20">
            ← Previous Page
          </Link>
        ) : (
          <span className="rounded-lg bg-white/5 px-4 py-2 text-slate-500">← Previous Page</span>
        )}
        <span className="font-mono text-slate-300">
          Page {page} of {totalPages} ({total} OSINT Entities)
        </span>
        {page < totalPages ? (
          <Link href={qs({ page: String(page + 1) })} className="rounded-lg bg-emerald-400 px-4 py-2 font-black text-black hover:bg-emerald-300">
            Next Page →
          </Link>
        ) : (
          <span className="rounded-lg bg-white/5 px-4 py-2 text-slate-500">Next Page →</span>
        )}
      </div>
    </div>
  );
}
