import Link from "next/link";
import { getCast, getFeatured, listSpeakersDirectory } from "@/lib/bundle";

export const dynamic = "force-dynamic";

export default async function CastPage() {
  const [cast, featured, speakers] = await Promise.all([getCast(), getFeatured(), listSpeakersDirectory({ limit: 150 })]);
  const maxD = Math.max(1, ...cast.map((c) => c.dissents));
  const spkByLast = new Map(speakers.map((s) => [s.name.split(" ").slice(-1)[0].toLowerCase(), s]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">The recurring cast &amp; governing body</h1>
      <p className="text-sm text-slate-400">
        Reconciled against Official Clerk Minutes, City of Cheyenne Ward I–III rosters, and verified OSINT profiles. Click any member to open their complete Historical Video Clip Vault or OSINT Cross-Reference Dossier.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cast.map((c) => {
          const spk = spkByLast.get(c.lastName.toLowerCase());
          const spkHref = spk ? `/speakers?speaker=${encodeURIComponent(spk.slug)}` : `/speakers?q=${encodeURIComponent(c.lastName)}`;
          const osintHref = `/osint?q=${encodeURIComponent(c.lastName)}`;
          const an = spk?.analytics;
          return (
            <div key={c.id} className="flex flex-col justify-between rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition hover:ring-amber-400/60">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <Link href={spkHref} className="flex items-center gap-3 group">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 text-lg font-black text-white group-hover:bg-amber-400 group-hover:text-black">
                      {c.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-black text-white group-hover:text-amber-300 group-hover:underline">
                        {c.honorific} {c.name}
                      </div>
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">{c.role}</div>
                    </div>
                  </Link>
                  {spk && (
                    <Link
                      href={spkHref}
                      className="rounded-full bg-amber-400/20 px-2.5 py-1 font-mono text-[10px] font-black text-amber-200 ring-1 ring-amber-400/40 hover:bg-amber-400 hover:text-black"
                    >
                      📼 {spk.turnCount} Clips →
                    </Link>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span>Present in {c.meetingsPresent} roll-call minutes</span>
                  {an && (
                    <>
                      <span>·</span>
                      <span>Avg Turn: <b>{an.avgSpeakingFormatted}</b></span>
                      <span>·</span>
                      <span>POE Events: <b>{an.pointOfOrderCount}</b></span>
                    </>
                  )}
                </div>

                {c.role.includes("Council") || c.role.includes("Mayor") ? (
                  <div className="mt-2.5 grid grid-cols-[75px_1fr_28px] items-center gap-2 text-xs">
                    <span className="text-slate-400">NO dissents</span>
                    <div className="h-2 rounded bg-slate-800">
                      <div className="h-2 rounded bg-rose-400" style={{ width: `${(c.dissents / maxD) * 100}%` }} />
                    </div>
                    <span className="text-right font-mono font-bold tabular-nums text-rose-300">{c.dissents}</span>
                  </div>
                ) : null}

                {an?.osint?.profiles && an.osint.profiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    {an.osint.profiles.map((p, idx) => (
                      <a
                        key={idx}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-sky-500/20 px-2 py-0.5 font-bold text-sky-200 ring-1 ring-sky-400/30 hover:bg-sky-500/30"
                      >
                        🔗 {p.platform} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3 text-xs">
                <Link
                  href={spkHref}
                  className="rounded-lg bg-amber-400 px-3 py-1.5 font-black text-black hover:bg-amber-300"
                >
                  🎙️ Watch All Historical Clips {spk ? `(${spk.turnCount})` : ""} →
                </Link>
                <Link
                  href={osintHref}
                  className="rounded-lg bg-emerald-500/20 px-3 py-1.5 font-bold text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30"
                >
                  🕸️ OSINT &amp; Contracts Nexus →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-sm text-slate-400">
        See the full billing for the flagship episode:{" "}
        <Link className="text-amber-300 underline" href={`/episode/${featured.slug}`}>
          {featured.title}
        </Link>
        .
      </p>
    </div>
  );
}
