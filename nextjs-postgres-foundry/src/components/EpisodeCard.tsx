import Link from "next/link";
import type { Meeting } from "@/lib/types";

const GRAD: Record<string, string> = {
  council: "from-amber-500/80 via-orange-700/60 to-slate-900",
  special: "from-fuchsia-500/80 via-purple-800/60 to-slate-900",
  psc: "from-sky-500/80 via-blue-800/60 to-slate-900",
  finance: "from-emerald-500/80 via-green-800/60 to-slate-900",
  cow: "from-rose-500/80 via-red-800/60 to-slate-900",
  work: "from-slate-400/60 via-slate-700/60 to-slate-900",
};
const CODE: Record<string, string> = { council: "CC", special: "SP", psc: "PSC", finance: "FIN", cow: "COW", work: "WS" };

export function dateShort(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function EpisodeCard({ m, wide = false }: { m: Meeting; wide?: boolean }) {
  const rt = m.runtimeMin ? `${Math.floor(m.runtimeMin / 60)}h ${String(m.runtimeMin % 60).padStart(2, "0")}m` : null;
  return (
    <Link
      href={`/episode/${m.slug}`}
      className={`group relative flex shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br p-4 ring-1 ring-white/10 transition hover:-translate-y-1 hover:ring-amber-300/70 ${GRAD[m.body] ?? GRAD.council} ${wide ? "h-52 w-80" : "h-44 w-64"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider">
          {CODE[m.body] ?? "MTG"} · {m.season} #{m.episodeNo}
        </span>
        {m.phase === "upcoming" ? <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-black uppercase text-black">Coming soon</span> : rt ? <span className="text-[10px] text-white/70">{rt}</span> : null}
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-widest text-white/70">{dateShort(m.date)} · {m.bodyName}</div>
        <div className="mt-0.5 line-clamp-2 text-lg font-black leading-tight">{m.title}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {m.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">{t}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
