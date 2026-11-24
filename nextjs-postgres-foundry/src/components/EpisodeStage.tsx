"use client";

import Link from "next/link";
import { useState } from "react";
import BroadcastPlayer from "@/components/BroadcastPlayer";
import LensDeck from "@/components/LensDeck";
import type { EpisodeBundle } from "@/lib/types";

const GRAD: Record<string, string> = {
  council: "from-amber-600/50 via-orange-900/30",
  special: "from-fuchsia-600/50 via-purple-900/30",
  psc: "from-sky-600/50 via-blue-900/30",
  finance: "from-emerald-600/50 via-green-900/30",
  cow: "from-rose-600/50 via-red-900/30",
  work: "from-slate-500/40 via-slate-800/30",
};

function pretty(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function EpisodeStage({ b }: { b: EpisodeBundle }) {
  const [playing, setPlaying] = useState(false);
  const m = b.meeting;
  const s = b.show;
  return (
    <>
      <section className={`relative overflow-hidden bg-gradient-to-br ${GRAD[m.body] ?? GRAD.council} to-[#07090f]`}>
        <div className="scanlines pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-7xl px-4 py-10">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-black/60 px-2 py-1 font-mono font-bold tracking-wider">{s.code}</span>
            <span className="rounded border border-white/40 px-2 py-0.5 font-bold" title={s.ratingNote}>{s.rating}</span>
            {s.tags.map((t) => <span key={t} className="rounded-full bg-amber-300 px-2 py-0.5 font-black uppercase tracking-wider text-black">{t}</span>)}
            {m.phase === "upcoming" && <span className="rounded bg-white/20 px-2 py-0.5 font-bold">Upcoming at archive capture</span>}
          </div>
          <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">{s.title}</h1>
          <p className="mt-1 text-lg text-slate-200 sm:text-xl">{s.tagline}</p>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">{s.logline}</p>
          <div className="mt-2 text-xs uppercase tracking-widest text-slate-400">
            {pretty(m.date)} · {m.bodyName} · Season {m.season}, Episode {m.episodeNo} of {m.seasonSize}
            {s.runtimeLabel ? ` · Runtime ${s.runtimeLabel}` : ""}
            {m.note ? ` · ${m.note}` : ""}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setPlaying(true)} className="flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-black text-black shadow-lg shadow-amber-500/20 hover:bg-amber-300">
              ▶ Play the episode <span className="font-normal opacity-70">theme · recap · cast · acts · next time</span>
            </button>
            <a href="#lenses" className="rounded-full bg-white/10 px-5 py-3 text-sm font-bold hover:bg-white/20">↔ Skip to the lenses</a>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {b.nav.premiere && b.nav.premiere.slug !== m.slug && <Link className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20" href={`/episode/${b.nav.premiere.slug}`}>⏮ Season premiere: {b.nav.premiere.title}</Link>}
            {b.nav.prev && <Link className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20" href={`/episode/${b.nav.prev.slug}`}>← Previously: {b.nav.prev.title}</Link>}
            {b.nav.next && <Link className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20" href={`/episode/${b.nav.next.slug}`}>Next: {b.nav.next.title} →</Link>}
            {b.nav.finale && b.nav.finale.slug !== m.slug && <Link className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20" href={`/episode/${b.nav.finale.slug}`}>Latest in season ⏭ {b.nav.finale.title}</Link>}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pt-8 md:grid-cols-3">
        <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-300">Previously on…</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {s.previously.slice(0, 3).map((p, i) => <li key={i}>{p.date && <span className="mr-1 font-mono text-xs text-sky-300">{p.date}</span>}{p.text.length > 170 ? p.text.slice(0, 170) + "…" : p.text}</li>)}
            {s.previously.length === 0 && <li className="text-slate-500">This is the first episode of its series in the dataset.</li>}
          </ul>
        </div>
        <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">To be continued…</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {s.toBeContinued.slice(0, 4).map((p, i) => <li key={i}>{p.text.length > 150 ? p.text.slice(0, 150) + "…" : p.text}</li>)}
            {s.toBeContinued.length === 0 && <li className="text-slate-500">No open threads recorded.</li>}
          </ul>
        </div>
        <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-rose-300">Next time on…</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {s.nextTime.map((n, i) => (
              <li key={i}>
                <span className="mr-1 font-mono text-xs text-rose-300">{n.date}</span>
                {n.slug ? <Link href={`/episode/${n.slug}`} className="font-semibold underline-offset-2 hover:underline">{n.body}</Link> : <b>{n.body}</b>}
                <span className="text-slate-400"> — {n.text.length > 110 ? n.text.slice(0, 110) + "…" : n.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LensDeck b={b} />
      {playing && <BroadcastPlayer b={b} onClose={() => setPlaying(false)} />}
    </>
  );
}
