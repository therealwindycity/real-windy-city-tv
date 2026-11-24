"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LENSES, type LensKey } from "@/lib/lens-meta";
import { LensView } from "@/components/lenses";
import type { EpisodeBundle } from "@/lib/types";

type Float = { id: number; key: LensKey; x: number; y: number; z: number; full: boolean };
const DIETS = ["All", "Watch", "Follow", "Verify"] as const;
const DIET_HINT: Record<(typeof DIETS)[number], string> = {
  All: "Every lens (19 total)",
  Watch: "Speaker videos, stories, tabloid, cast, script, run of show",
  Follow: "Gotham link graph, votes, maps, history, money, jargon",
  Verify: "Palantir Foundry PDFs/OCR, provenance films, legal, fact-check, analytics, raw record",
};

function FloatWin({
  f,
  b,
  slug,
  onClose,
  onFocus,
  onMove,
  onFull,
}: {
  f: Float;
  b: EpisodeBundle;
  slug: string;
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onFull: () => void;
}) {
  const meta = LENSES.find((l) => l.key === f.key)!;
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  return (
    <div
      onPointerDown={onFocus}
      className="fixed flex flex-col overflow-hidden rounded-xl bg-[#0b0f19] shadow-2xl ring-1 ring-white/20"
      style={
        f.full
          ? { inset: 8, zIndex: f.z }
          : { left: f.x, top: f.y, zIndex: f.z, width: "min(92vw, 520px)", height: 420, resize: "both", minWidth: 280, minHeight: 220 }
      }
    >
      <div
        className="flex cursor-grab items-center gap-2 px-2.5 py-1.5 text-xs active:cursor-grabbing"
        style={{ background: meta.accent + "33", borderBottom: `2px solid ${meta.accent}`, touchAction: "none" }}
        onPointerDown={(e) => {
          if (f.full) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { dx: e.clientX - f.x, dy: e.clientY - f.y };
        }}
        onPointerMove={(e) => {
          if (drag.current) onMove(Math.max(0, e.clientX - drag.current.dx), Math.max(48, e.clientY - drag.current.dy));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <span>{meta.icon}</span>
        <b className="truncate">{meta.name}</b>
        <span className="ml-auto flex gap-1">
          <button onClick={onFull} className="rounded bg-white/10 px-1.5 hover:bg-white/25" title={f.full ? "Restore" : "Expand"}>
            {f.full ? "▭" : "⤢"}
          </button>
          <a href={`/embed/${slug}/${f.key}`} target="_blank" rel="noreferrer" className="rounded bg-white/10 px-1.5 hover:bg-white/25" title="Open standalone">
            ↗
          </a>
          <button onClick={onClose} className="rounded bg-white/10 px-1.5 hover:bg-red-500" title="Close">
            ✕
          </button>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#060913]">
        <LensView lensKey={f.key} b={b} />
      </div>
    </div>
  );
}

export default function LensDeck({ b }: { b: EpisodeBundle }) {
  const slug = b.meeting.slug;
  const [diet, setDiet] = useState<(typeof DIETS)[number]>("All");
  const [mode, setMode] = useState<"swipe" | "split" | "mosaic">("swipe");
  const [active, setActive] = useState(0);
  const [splitLeft, setSplitLeft] = useState<LensKey>("foundry");
  const [splitRight, setSplitRight] = useState<LensKey>("speakers");
  const [floats, setFloats] = useState<Float[]>([]);
  const [expanded, setExpanded] = useState<LensKey | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const z = useRef(60);
  const idc = useRef(1);
  const lenses = useMemo(() => LENSES.filter((l) => diet === "All" || l.group === diet), [diet]);

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const n = Math.max(0, Math.min(lenses.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    setActive(n);
  };
  useEffect(() => {
    setActive(0);
    scroller.current?.scrollTo({ left: 0 });
  }, [diet, mode]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openFloat = (key: LensKey) =>
    setFloats((fs) => {
      if (fs.some((f) => f.key === key)) return fs.map((f) => (f.key === key ? { ...f, z: ++z.current } : f));
      const n = fs.length;
      const x = typeof window === "undefined" ? 40 : Math.min(window.innerWidth - 340, 40 + n * 36);
      return [...fs, { id: idc.current++, key, x, y: 110 + n * 36, z: ++z.current, full: false }];
    });
  const floatSet = () => (["foundry", "gotham", "speakers", "provenance"] as LensKey[]).forEach((k) => openFloat(k));

  const cur = lenses[active] ?? lenses[0];

  return (
    <section id="lenses" className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Same verified record. {LENSES.length} lenses.</h2>
          <p className="text-sm text-slate-400">
            Swipe sideways, compare two lenses side-by-side (e.g. Palantir Foundry PDFs + Speaker Videos), tile all {LENSES.length} lenses at once, or float draggable windows.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1 rounded-full bg-white/5 p-1 text-xs font-bold">
          <button onClick={() => setMode("swipe")} className={`rounded-full px-3 py-1.5 ${mode === "swipe" ? "bg-amber-400 text-black" : "text-slate-300"}`}>
            ↔ Swipe
          </button>
          <button onClick={() => setMode("split")} className={`rounded-full px-3 py-1.5 ${mode === "split" ? "bg-amber-400 text-black" : "text-slate-300"}`}>
            ◫ Side-by-Side
          </button>
          <button onClick={() => setMode("mosaic")} className={`rounded-full px-3 py-1.5 ${mode === "mosaic" ? "bg-amber-400 text-black" : "text-slate-300"}`}>
            ▦ All {LENSES.length} Mosaic
          </button>
          <button onClick={floatSet} className="rounded-full px-3 py-1.5 text-slate-300 hover:bg-white/10">
            ⧉ Float 4
          </button>
          {floats.length > 0 && (
            <button onClick={() => setFloats([])} className="rounded-full px-3 py-1.5 text-rose-300 hover:bg-white/10">
              Close windows ({floats.length})
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold uppercase tracking-widest text-slate-400">Diet</span>
        {DIETS.map((d) => (
          <button
            key={d}
            onClick={() => setDiet(d)}
            title={DIET_HINT[d]}
            className={`rounded-full px-3 py-1 font-semibold ${diet === d ? "bg-white text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
          >
            {d}
          </button>
        ))}
        <span className="text-slate-500">{DIET_HINT[diet]}</span>
      </div>

      {mode === "swipe" ? (
        <>
          <div className="hide-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist">
            {lenses.map((l, i) => (
              <button
                key={l.key}
                role="tab"
                aria-selected={i === active}
                onClick={() => goTo(i)}
                className={`group relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  i === active ? "text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
                style={i === active ? { background: l.accent } : undefined}
              >
                <span>{l.icon}</span>
                {l.name}
                <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded-lg bg-black p-2.5 text-left text-[11px] font-normal normal-case text-slate-200 shadow-xl ring-1 ring-white/20 group-hover:block">
                  {l.blurb}
                  <br />
                  <span className="text-amber-300">{l.group}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-center gap-2 text-sm">
            <button onClick={() => goTo(active - 1)} className="rounded-full bg-white/10 px-3 py-1 font-bold hover:bg-white/20" aria-label="Previous lens">
              ‹
            </button>
            <span className="font-bold" style={{ color: cur.accent }}>
              {cur.icon} {cur.name}
            </span>
            <span className="hidden text-xs text-slate-400 sm:inline">{cur.blurb}</span>
            <span className="ml-auto text-xs text-slate-500">
              {active + 1} / {lenses.length} · swipe or use ‹ ›
            </span>
            <button onClick={() => openFloat(cur.key)} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20">
              ⧉ Float
            </button>
            <button onClick={() => goTo(active + 1)} className="rounded-full bg-white/10 px-3 py-1 font-bold hover:bg-white/20" aria-label="Next lens">
              ›
            </button>
          </div>
          <div
            ref={scroller}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") goTo(active + 1);
              if (e.key === "ArrowLeft") goTo(active - 1);
            }}
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / el.clientWidth);
              if (i !== active) setActive(i);
            }}
            className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl ring-1 ring-white/10 focus:outline-none focus:ring-amber-300/60"
          >
            {lenses.map((l) => (
              <div key={l.key} className="h-[76vh] min-h-[520px] w-full shrink-0 snap-center overflow-y-auto" style={{ borderTop: `3px solid ${l.accent}` }}>
                <LensView lensKey={l.key} b={b} />
              </div>
            ))}
          </div>
        </>
      ) : mode === "split" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[
            { val: splitLeft, setVal: setSplitLeft, label: "Left Pane" },
            { val: splitRight, setVal: setSplitRight, label: "Right Pane" },
          ].map((pane) => {
            const meta = LENSES.find((x) => x.key === pane.val) ?? LENSES[0];
            return (
              <div key={pane.label} className="flex h-[76vh] min-h-[520px] flex-col overflow-hidden rounded-2xl bg-[#070b14] ring-1 ring-white/15" style={{ borderTop: `3px solid ${meta.accent}` }}>
                <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-3 py-2 text-xs">
                  <span className="font-bold text-slate-300">{pane.label}</span>
                  <select
                    value={pane.val}
                    onChange={(e) => pane.setVal(e.target.value as LensKey)}
                    className="rounded border border-white/15 bg-[#0b1324] px-2.5 py-1 font-bold text-white"
                  >
                    {LENSES.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.icon} {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <LensView lensKey={pane.val} b={b} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lenses.map((l) => (
            <div key={l.key} className="flex flex-col justify-between overflow-hidden rounded-xl bg-[#080d1a] p-4 ring-1 ring-white/10 transition hover:ring-white/30" style={{ borderTop: `3px solid ${l.accent}` }}>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-black text-white">
                    {l.icon} {l.name}
                  </span>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">{l.group}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{l.blurb}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <button
                  onClick={() => setExpanded(l.key)}
                  className="flex-1 rounded-lg px-3 py-2 font-black text-black transition hover:opacity-90"
                  style={{ background: l.accent }}
                >
                  ⤢ Open Full Lens
                </button>
                <button onClick={() => openFloat(l.key)} className="rounded-lg bg-white/10 px-3 py-2 font-bold text-white hover:bg-white/20">
                  ⧉ Float
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/85 p-3 backdrop-blur-sm" onClick={() => setExpanded(null)}>
          <div className="mb-2 flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
            <b>
              {LENSES.find((l) => l.key === expanded)?.icon} {LENSES.find((l) => l.key === expanded)?.name}
            </b>
            <button
              onClick={() => {
                openFloat(expanded);
                setExpanded(null);
              }}
              className="ml-auto rounded bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20"
            >
              ⧉ Float
            </button>
            <button onClick={() => setExpanded(null)} className="rounded bg-white/10 px-3 py-1 text-xs font-bold hover:bg-red-500">
              Close ✕
            </button>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-[#070b14] ring-1 ring-white/15">
            <LensView lensKey={expanded} b={b} />
          </div>
        </div>
      )}

      {floats.map((f) => (
        <FloatWin
          key={f.id}
          f={f}
          b={b}
          slug={slug}
          onClose={() => setFloats((fs) => fs.filter((x) => x.id !== f.id))}
          onFocus={() => setFloats((fs) => fs.map((x) => (x.id === f.id ? { ...x, z: ++z.current } : x)))}
          onMove={(x, y) => setFloats((fs) => fs.map((q) => (q.id === f.id ? { ...q, x, y } : q)))}
          onFull={() => setFloats((fs) => fs.map((q) => (q.id === f.id ? { ...q, full: !q.full, z: ++z.current } : q)))}
        />
      ))}
    </section>
  );
}
