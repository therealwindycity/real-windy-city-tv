"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EpisodeBundle } from "@/lib/types";

type Scene = { id: string; label: string; ms: number };

function buildScenes(b: EpisodeBundle): Scene[] {
  const s = b.show;
  const list: Scene[] = [{ id: "cold", label: "Cold open", ms: 6500 }];
  if (s.previously.length) list.push({ id: "prev", label: "Previously on…", ms: Math.min(22000, 4500 + s.previously.length * 3200) });
  list.push({ id: "theme", label: "Theme song", ms: 15000 });
  if (s.cast.length) list.push({ id: "cast", label: "Cast of characters", ms: Math.min(18000, 5000 + Math.ceil(s.cast.length / 2) * 900) });
  s.acts.slice(0, 7).forEach((a, i) => list.push({ id: `act${i}`, label: a.name, ms: 5200 }));
  if (s.toBeContinued.length) list.push({ id: "tbc", label: "To be continued…", ms: Math.min(20000, 4000 + s.toBeContinued.length * 2800) });
  if (s.nextTime.length) list.push({ id: "next", label: "Next time on…", ms: Math.min(16000, 4000 + s.nextTime.length * 3000) });
  list.push({ id: "credits", label: "Credits", ms: 7500 });
  return list;
}

function playTheme(ctx: AudioContext, out: AudioNode) {
  const g = ctx.createGain();
  g.gain.value = 0.85;
  g.connect(out);
  const t0 = ctx.currentTime + 0.1;
  const beat = 60 / 126;
  const eighth = beat / 2;
  const f = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
  const nodes: AudioScheduledSourceNode[] = [];
  const note = (n: number, t: number, d: number, type: OscillatorType, vol: number, detune = 0, cutoff = 2600) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f(n);
    o.detune.value = detune;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cutoff;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    e.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(lp);
    lp.connect(e);
    e.connect(g);
    o.start(t);
    o.stop(t + d + 0.05);
    nodes.push(o);
  };
  const gavel = (t: number) => {
    const len = Math.floor(ctx.sampleRate * 0.14);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 700;
    const e = ctx.createGain();
    e.gain.value = 1.1;
    s.connect(bp);
    bp.connect(e);
    e.connect(g);
    s.start(t);
    nodes.push(s);
  };
  const lead = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 76, 72];
  const bass = [48, 53, 43, 48];
  for (let r = 0; r < 3; r++) {
    lead.forEach((n, i) => {
      const t = t0 + (r * 16 + i) * eighth;
      note(n, t, eighth * 0.9, "sawtooth", 0.1, -7);
      note(n, t, eighth * 0.9, "sawtooth", 0.09, 7);
    });
    bass.forEach((n, i) => note(n - 12, t0 + (r * 16 + i * 4) * eighth, eighth * 3.6, "triangle", 0.24, 0, 600));
    [0, 4, 8, 12].forEach((k) => gavel(t0 + (r * 16 + k) * eighth));
  }
  [60, 64, 67, 72].forEach((n) => note(n, t0 + 48 * eighth, eighth * 6, "sawtooth", 0.08, 0, 3000));
  gavel(t0 + 48 * eighth);
  return () => {
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 500);
  };
}

export default function BroadcastPlayer({ b, onClose }: { b: EpisodeBundle; onClose: () => void }) {
  const scenes = useMemo(() => buildScenes(b), [b]);
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const scene = scenes[idx];
  const progress = Math.min(1, elapsed / scene.ms);
  const s = b.show;

  const go = (i: number) => {
    setIdx(Math.max(0, Math.min(scenes.length - 1, i)));
    setElapsed(0);
  };

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setElapsed((e) => e + 100), 100);
    return () => clearInterval(t);
  }, [playing]);

  useEffect(() => {
    if (elapsed >= scene.ms) {
      if (idx < scenes.length - 1) {
        setIdx(idx + 1);
        setElapsed(0);
      } else setPlaying(false);
    }
  }, [elapsed, scene.ms, idx, scenes.length]);

  useEffect(() => {
    const stop = () => {
      stopRef.current?.();
      stopRef.current = null;
    };
    if (scene.id === "theme" && playing && !muted) {
      if (!ctxRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) {
          ctxRef.current = new AC();
          masterRef.current = ctxRef.current.createGain();
          masterRef.current.gain.value = 0.7;
          masterRef.current.connect(ctxRef.current.destination);
        }
      }
      const ctx = ctxRef.current;
      if (ctx && masterRef.current && !stopRef.current) {
        void ctx.resume();
        stopRef.current = playTheme(ctx, masterRef.current);
      }
    } else stop();
    return () => {
      if (scene.id !== "theme") stop();
    };
  }, [scene.id, playing, muted]);

  useEffect(
    () => () => {
      stopRef.current?.();
      void ctxRef.current?.close();
    },
    [],
  );

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === "ArrowLeft") go(idx - 1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const lyricI = Math.min(s.themeLyrics.length - 1, Math.floor(progress * s.themeLyrics.length));
  const montI = Math.min(s.montage.length - 1, Math.floor(progress * s.montage.length));
  const visible = (per: number, n: number) => Math.min(n, Math.floor(elapsed / per) + 1);
  const act = scene.id.startsWith("act") ? s.acts[Number(scene.id.slice(3))] : null;
  const actScores = act ? b.lenses.scoreboard.filter((x) => x.items.some((i) => act.items.includes(i))) : [];
  const actItems = act ? b.items.filter((i) => act.items.includes(i.itemNo)).slice(0, 6) : [];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#040811] text-white" role="dialog" aria-label="Episode player">
      {/* Top C-SPAN / The Real Windy City Broadcast Bar */}
      <div className="z-20 flex items-center justify-between border-b-2 border-amber-400 bg-[#09152b] px-4 py-1.5 text-xs font-black uppercase tracking-wider">
        <span className="text-amber-300">[RWC] THE REAL WINDY CITY · CHEYENNE CIVIC BROADCAST · {scene.label}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-slate-200">{b.meeting.bodyName} · {b.meeting.date}</span>
          {scene.id === "theme" || scene.id === "cold" || scene.id === "prev" ? (
            <button onClick={() => go(scenes.findIndex((x) => x.id === "cast"))} className="rounded border border-white/40 px-2.5 py-0.5 text-[11px] font-bold hover:bg-white/10">Skip intro ⏭</button>
          ) : null}
          <button onClick={onClose} className="rounded bg-rose-600 px-2.5 py-0.5 text-[11px] font-black hover:bg-rose-500">✕ Close</button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden border-x-8 border-[#09152b]">
        <div className="scanlines pointer-events-none absolute inset-0 z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#1e293b_0%,#02040a_75%)]" />
        <div key={scene.id} className="anim-in relative z-0 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-6 text-center">
          {scene.id === "cold" && (
            <>
              <div className="anim-up text-xs font-bold uppercase tracking-[0.5em] text-amber-300">The Real Windy City presents</div>
              <div className="anim-zoom mt-4 font-mono text-sm tracking-widest text-slate-400" style={{ animationDelay: "0.8s" }}>{s.code} · {b.meeting.date}</div>
              <h1 className="title-shimmer anim-zoom mt-3 text-5xl font-black leading-none sm:text-7xl" style={{ animationDelay: "1.2s" }}>{s.title}</h1>
              <p className="anim-up mt-6 max-w-2xl text-lg text-slate-300" style={{ animationDelay: "2.4s" }}>{s.tagline}</p>
              <div className="anim-up mt-6 flex gap-2" style={{ animationDelay: "3.4s" }}>
                <span className="rounded border border-white/40 px-2 py-0.5 text-xs font-bold">{s.rating}</span>
                {s.runtimeLabel && <span className="rounded border border-white/40 px-2 py-0.5 text-xs">runtime {s.runtimeLabel}</span>}
                {s.tags.slice(0, 2).map((t) => <span key={t} className="rounded bg-amber-300 px-2 py-0.5 text-xs font-black uppercase text-black">{t}</span>)}
              </div>
            </>
          )}
          {scene.id === "prev" && (
            <>
              <div className="text-xs font-bold uppercase tracking-[0.5em] text-sky-300">Previously on</div>
              <h2 className="mt-1 text-3xl font-black sm:text-5xl">The Real Windy City…</h2>
              <ul className="mt-8 w-full max-w-3xl space-y-3 text-left">
                {s.previously.slice(0, visible(3200, s.previously.length)).map((p, i) => (
                  <li key={i} className="anim-up rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
                    {p.date && <span className="mr-2 font-mono text-xs text-sky-300">{p.date}</span>}
                    <span className="text-base text-slate-100">{p.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {scene.id === "theme" && (
            <>
              <div key={montI} className="anim-zoom text-6xl font-black tabular-nums text-amber-300 sm:text-9xl">{s.montage[montI]?.big}</div>
              <div key={"s" + montI} className="anim-up mt-3 max-w-xl text-lg text-slate-300">{s.montage[montI]?.small}</div>
              <div className="absolute inset-x-0 bottom-10 px-6">
                <div key={lyricI} className="anim-up text-xl font-semibold italic text-white sm:text-3xl">♪ {s.themeLyrics[lyricI]} ♪</div>
                <div className="mt-3 text-xs uppercase tracking-[0.4em] text-slate-500">Main title · synthesized in your browser</div>
              </div>
            </>
          )}
          {scene.id === "cast" && (
            <>
              <div className="text-xs font-bold uppercase tracking-[0.5em] text-violet-300">Starring</div>
              <div className="mt-6 grid w-full max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3">
                {s.cast.slice(0, 12).map((c, i) => (
                  <div key={c.name} className="anim-up rounded-lg bg-white/5 p-3 text-left ring-1 ring-white/10" style={{ animationDelay: `${i * 0.35}s` }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-violet-300">{c.billing}</div>
                    <div className="text-base font-black leading-tight">{c.name}</div>
                    <div className="text-[11px] text-slate-400">{c.role}</div>
                  </div>
                ))}
              </div>
              {s.cast.length > 12 && <div className="mt-3 text-xs text-slate-400">+ {s.cast.length - 12} more in the Cast &amp; Crew lens</div>}
            </>
          )}
          {act && (
            <>
              <div className="text-xs font-bold uppercase tracking-[0.5em] text-amber-300">{act.n === 0 ? "Teaser" : `Act ${act.n}`}</div>
              <h2 className="anim-zoom mt-2 text-4xl font-black sm:text-6xl">{act.name.replace(/^(Act [IVX]+|Cold Open|Tag):\s*/i, "")}</h2>
              <p className="anim-up mt-4 max-w-2xl text-lg text-slate-300" style={{ animationDelay: "0.5s" }}>{act.beat}</p>
              <div className="mt-6 w-full max-w-3xl space-y-2 text-left">
                {actScores.slice(0, 3).map((x, i) => (
                  <div key={i} className="anim-up rounded-lg bg-emerald-900/40 p-2 text-sm ring-1 ring-emerald-700" style={{ animationDelay: `${1 + i * 0.6}s` }}>
                    <span className="mr-2 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black text-black">{x.result}</span>
                    <b>{x.tally}</b> <span className="text-slate-300">· {x.label.slice(0, 90)}</span>
                  </div>
                ))}
                {actScores.length === 0 && actItems.slice(0, 3).map((x, i) => (
                  <div key={x.itemNo + i} className="anim-up truncate rounded-lg bg-white/5 p-2 text-sm" style={{ animationDelay: `${1 + i * 0.5}s` }}>
                    <span className="mr-2 font-mono text-sky-300">{x.itemNo}</span>{x.title.slice(0, 110)}
                  </div>
                ))}
              </div>
            </>
          )}
          {scene.id === "tbc" && (
            <>
              <div className="text-5xl font-black italic text-amber-300 sm:text-7xl">TO BE CONTINUED <span className="inline-block animate-pulse">⟶</span></div>
              <ul className="mt-8 w-full max-w-3xl space-y-2 text-left">
                {s.toBeContinued.slice(0, visible(2800, s.toBeContinued.length)).map((t, i) => (
                  <li key={i} className="anim-up rounded-lg bg-white/5 p-3 text-base ring-1 ring-white/10">{t.text}{t.src && <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-500">{t.src}</span>}</li>
                ))}
              </ul>
            </>
          )}
          {scene.id === "next" && (
            <>
              <div className="text-xs font-bold uppercase tracking-[0.5em] text-rose-300">Next time on</div>
              <h2 className="mt-1 text-3xl font-black sm:text-5xl">The Real Windy City</h2>
              <ul className="mt-8 w-full max-w-3xl space-y-3 text-left">
                {s.nextTime.slice(0, visible(3000, s.nextTime.length)).map((n, i) => (
                  <li key={i} className="anim-up rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="font-mono text-xs text-rose-300">{n.date} · {n.body}</div>
                    <div className="text-base">{n.text}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {scene.id === "credits" && (
            <div className="space-y-3 text-sm text-slate-300">
              <div className="text-xs font-bold uppercase tracking-[0.5em] text-amber-300">THE REAL WINDY CITY · VERIFIED CIVIC RECORD</div>
              <p>Broadcast Stream: Internet Archive &amp; Wayback Machine ({b.provenance.waybackTs})</p>
              <p>Official Record: City of Cheyenne Clerk Minutes &amp; Supporting Agenda Packets</p>
              <p>OSINT &amp; Speaker Analytics: The Real Windy City Municipal Accountability Pipeline</p>
              <p className="pt-3 text-lg font-black text-white">Now inspect all 19 lenses ↓</p>
              <button onClick={onClose} className="rounded-full bg-amber-400 px-5 py-2 font-black text-black hover:bg-amber-300">Close player</button>
            </div>
          )}
        </div>
        {/* Synced Closed Captions Overlay */}
        <div className="pointer-events-none absolute inset-x-6 bottom-3 z-20 flex justify-center">
          <div className="max-w-3xl rounded bg-black/85 px-3 py-1 text-center font-mono text-xs text-white ring-1 ring-amber-400/30">
            CC · {act ? act.beat.slice(0, 140) : s.logline.slice(0, 140)}
          </div>
        </div>
      </div>
      {/* Bottom C-SPAN Marquee Info Border */}
      <div className="z-20 overflow-hidden border-t-2 border-rose-700 bg-[#071122] py-1 text-[11px] font-bold text-amber-300">
        <div className="ticker-track whitespace-nowrap">
          <span className="pr-16">
            THE REAL WINDY CITY · {b.meeting.bodyName.toUpperCase()} · {b.meeting.date} · {s.title} · {b.items.length} DOCKET ITEMS · {b.docs.length} PACKET PDFS · VERIFIED MINUTES &amp; INTERNET ARCHIVE RECORD
          </span>
          <span className="pr-16">
            THE REAL WINDY CITY · {b.meeting.bodyName.toUpperCase()} · {b.meeting.date} · {s.title} · {b.items.length} DOCKET ITEMS · {b.docs.length} PACKET PDFS · VERIFIED MINUTES &amp; INTERNET ARCHIVE RECORD
          </span>
        </div>
      </div>
      <div className="z-20 flex items-center gap-3 border-t border-white/10 bg-black/90 px-4 py-2">
        <button onClick={() => go(idx - 1)} className="px-2 text-lg" aria-label="Previous scene">⏮</button>
        <button onClick={() => setPlaying((p) => !p)} className="px-2 text-lg" aria-label={playing ? "Pause" : "Play"}>{playing ? "⏸" : "▶"}</button>
        <button onClick={() => go(idx + 1)} className="px-2 text-lg" aria-label="Next scene">⏭</button>
        <div className="flex flex-1 gap-1">
          {scenes.map((x, i) => (
            <button key={x.id} onClick={() => go(i)} title={x.label} className="h-2 flex-1 overflow-hidden rounded bg-white/15">
              <div className="h-full bg-amber-400" style={{ width: i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%" }} />
            </button>
          ))}
        </div>
        <button onClick={() => { setMuted((m) => !m); void ctxRef.current?.resume(); }} className="px-2 text-lg" aria-label={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🔊"}</button>
      </div>
    </div>
  );
}
