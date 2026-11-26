"use client";

import { useState } from "react";
import Link from "next/link";
import { FacebookShareModal, SpeakerTurnPlayerCard } from "@/components/GothamFoundrySuite";
import type { SpeakerTurn } from "@/lib/types";

type OrdReading = {
  date: string;
  body: string;
  stage: string;
  context: string;
  meeting: string | null;
  itemNo: string;
  source: string;
};

type OrdEpisode = {
  id: number;
  slug: string;
  title: string;
  date: string;
  bodyName: string;
  videoUrl: string | null;
  mp4Url: string | null;
  iaMp4Url?: string | null;
  iaPageUrl?: string | null;
  agendaUrl: string | null;
  minutesUrl: string | null;
  extraLinks: { label: string; url: string; kind: string }[];
};

type OrdDoc = {
  id: number;
  meetingId: number | null;
  role: string;
  itemNo: string | null;
  title: string;
  url: string | null;
  pages: number | null;
  words: number | null;
  ocr: boolean;
  sha1: string | null;
};

export default function OrdinanceArcPlayer({
  ord,
  episodes,
  speakerTurns: turns,
  docs,
  votes,
}: {
  ord: {
    id: number;
    slug: string;
    title: string;
    kind: string;
    firstDate: string;
    lastDate: string;
    sources: string[];
    readings: OrdReading[];
  };
  episodes: OrdEpisode[];
  speakerTurns: SpeakerTurn[];
  docs: OrdDoc[];
  votes: { id: number; meetingId: number; idx: number; excerpt: string; result: string; unanimous: boolean; noNames: string[]; source: string }[];
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [fbTurn, setFbTurn] = useState<SpeakerTurn | null>(null);
  const [phase, setPhase] = useState<"intro" | "main" | "outro">("main");
  const [ccOn, setCcOn] = useState(true);

  const activeReading = ord.readings[activeIdx] ?? ord.readings[0];
  const ep = episodes.find((e) => e.slug === activeReading?.meeting) ?? null;
  const readingTurns = turns.filter((t) => t.meetingSlug === activeReading?.meeting);
  const readingDocs = ep ? docs.filter((d) => d.meetingId === ep.id) : [];
  const readingVotes = ep ? votes.filter((v) => v.meetingId === ep.id) : [];

  const cleanIaMp4 =
    ep?.iaMp4Url ||
    readingTurns.find((t) => t.sourceMeetingMp4Url)?.sourceMeetingMp4Url ||
    (ep?.mp4Url && !ep.mp4Url.includes("granicus.com") ? ep.mp4Url : null);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="rounded-2xl border border-violet-400/35 bg-gradient-to-br from-[#0f1329] via-[#090d1b] to-black p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-violet-300">
              📜 Complete Multi-Reading Legislative Arc · {ord.kind}
            </div>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-4xl">{ord.title}</h1>
            <div className="mt-2 font-mono text-xs text-slate-300">
              {ord.readings.length} Sequential Readings ({ord.firstDate} → {ord.lastDate}) · {turns.length} Speaker Clips · {docs.length} Supporting PDFs · {votes.length} Recorded Votes
            </div>
          </div>
          <Link href="/ordinances" className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/20">
            ← All 275 Ordinance Arcs
          </Link>
        </div>
      </div>

      {/* Multi-Reading Stepper Bar */}
      <div className="rounded-2xl border border-violet-400/35 bg-[#090f20] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-widest text-violet-300">
            Select any Reading to Watch Verified Broadcast + Speaker Segments + Packet PDFs:
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPhase("intro")}
              className={`rounded-full px-3 py-1 font-bold ${phase === "intro" ? "bg-amber-400 text-black" : "bg-white/10 text-amber-200"}`}
            >
              🎬 RWC Intro
            </button>
            <button
              type="button"
              onClick={() => setCcOn((v) => !v)}
              className={`rounded-full px-3 py-1 font-bold ${ccOn ? "bg-amber-400 text-black" : "bg-white/10 text-slate-300"}`}
            >
              CC {ccOn ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={() => setPhase("outro")}
              className={`rounded-full px-3 py-1 font-bold ${phase === "outro" ? "bg-amber-400 text-black" : "bg-white/10 text-amber-200"}`}
            >
              🎬 RWC Outro
            </button>
            <Link
              href={`/speakers?ordinance=${encodeURIComponent(ord.slug)}&sort=oldest`}
              className="rounded-full bg-amber-400 px-3.5 py-1 font-black text-black hover:bg-amber-300"
            >
              🎙️ All {turns.length} Speaker Clips →
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {ord.readings.map((r: OrdReading, idx: number) => (
            <button
              key={`${r.meeting}-${r.itemNo}-${idx}`}
              type="button"
              onClick={() => {
                setActiveIdx(idx);
                setPhase("main");
              }}
              className={`rounded-xl border px-3.5 py-2 text-left text-xs transition ${
                idx === activeIdx
                  ? "border-amber-300 bg-amber-400 font-black text-black shadow-lg"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/15"
              }`}
            >
              <div className="font-mono text-[10px] uppercase opacity-80">
                Reading {idx + 1} · {r.date}
              </div>
              <div className="font-bold">{r.stage || r.body}</div>
            </button>
          ))}
        </div>

        {/* Active Reading Broadcast Video Stage (C-SPAN Framed) */}
        {activeReading && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            <div className="overflow-hidden rounded-xl border-2 border-amber-400/50 bg-[#050912]">
              <div className="flex items-center justify-between border-b-2 border-amber-400 bg-[#09152b] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider">
                <span className="text-amber-300">[RWC] THE REAL WINDY CITY · ORDINANCE ARC RECORD</span>
                <span className="font-mono text-white">
                  {activeReading.body} · {activeReading.date}
                </span>
              </div>

              {phase === "intro" ? (
                <div className="flex h-72 flex-col items-center justify-center bg-gradient-to-br from-[#071124] via-[#040914] to-black p-6 text-center">
                  <div className="rounded bg-amber-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-black">
                    THE REAL WINDY CITY · CHEYENNE LEGISLATIVE ARCHIVE
                  </div>
                  <div className="mt-3 text-xl font-black text-white">{ord.title}</div>
                  <div className="mt-1 text-xs font-bold text-amber-300">
                    Reading {activeIdx + 1} of {ord.readings.length} · {activeReading.date} · {activeReading.stage || activeReading.body}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhase("main")}
                    className="mt-4 rounded-full bg-amber-400 px-5 py-2 text-xs font-black text-black hover:bg-amber-300"
                  >
                    ▶ Watch Verified Broadcast →
                  </button>
                </div>
              ) : phase === "outro" ? (
                <div className="flex h-72 flex-col items-center justify-center bg-gradient-to-br from-black via-[#061022] to-[#0b1933] p-6 text-center">
                  <div className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">THE REAL WINDY CITY</div>
                  <div className="mt-1 text-xs font-bold text-white">Verified Cheyenne Municipal Legislative Record (2008–2026)</div>
                  <div className="mt-2 font-mono text-[11px] text-emerald-300">
                    {ord.readings.length} Readings · {turns.length} Speaker Clips · {docs.length} Supporting PDFs
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhase("main")}
                    className="mt-4 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/25"
                  >
                    ↺ Replay Broadcast
                  </button>
                </div>
              ) : cleanIaMp4 ? (
                <div className="relative">
                  <video
                    key={cleanIaMp4}
                    src={cleanIaMp4}
                    controls
                    preload="metadata"
                    onEnded={() => setPhase("outro")}
                    className="aspect-video w-full bg-black"
                  />
                  {ccOn && (
                    <div className="pointer-events-none absolute inset-x-3 bottom-11 rounded bg-black/85 px-2.5 py-1 text-center font-mono text-[11px] text-white ring-1 ring-amber-400/30">
                      CC · {activeReading.context || ord.title}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center p-6 text-center text-sm text-slate-300">
                  <div className="text-lg font-black text-amber-300">
                    Reading {activeIdx + 1}: {activeReading.date} · {activeReading.body}
                  </div>
                  <p className="mt-2 max-w-md text-xs text-slate-400">
                    Inspect all speaker clips and supporting Foundry agenda/staff packet exhibits for this reading below, or open the full episode.
                  </p>
                  {activeReading.meeting && (
                    <Link
                      href={`/episode/${activeReading.meeting}`}
                      className="mt-4 rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-black"
                    >
                      ▶ Open Full Sitting Episode ({activeReading.date}) →
                    </Link>
                  )}
                </div>
              )}

              {/* C-SPAN Lower-Third + Marquee Info Border */}
              <div className="border-t-2 border-rose-700 bg-[#0a1931] px-3 py-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 font-black text-white">
                  <span className="truncate">{ord.title}</span>
                  <span className="font-mono text-[11px] text-amber-300">Item {activeReading.itemNo}</span>
                </div>
                <div className="mt-1 overflow-hidden border-t border-white/10 pt-1 text-[10px] font-bold text-amber-300">
                  <div className="ticker-track whitespace-nowrap">
                    <span className="pr-12">
                      THE REAL WINDY CITY · ORDINANCE RECORD · {activeReading.date} · {activeReading.body} · {readingTurns.length} SPEAKER CLIPS · {readingDocs.length} SUPPORTING EXHIBITS · INTERNET ARCHIVE PROVENANCE
                    </span>
                    <span className="pr-12">
                      THE REAL WINDY CITY · ORDINANCE RECORD · {activeReading.date} · {activeReading.body} · {readingTurns.length} SPEAKER CLIPS · {readingDocs.length} SUPPORTING EXHIBITS · INTERNET ARCHIVE PROVENANCE
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/50 p-4">
              <div>
                <div className="font-mono text-xs text-amber-300">
                  Reading {activeIdx + 1} of {ord.readings.length} · {activeReading.date} · Item {activeReading.itemNo}
                </div>
                <h3 className="mt-1 text-lg font-black text-white">
                  {activeReading.body} — {activeReading.stage || "Floor Consideration"}
                </h3>
                {activeReading.context && <p className="mt-3 text-xs leading-relaxed text-slate-300">{activeReading.context}</p>}

                {readingVotes.length > 0 && (
                  <div className="mt-3 rounded-lg bg-emerald-950/50 p-2.5 text-xs ring-1 ring-emerald-500/30">
                    <div className="font-bold text-emerald-300">Recorded Roll-Call Votes ({readingVotes.length}):</div>
                    {readingVotes.slice(0, 3).map((v) => (
                      <div key={v.id} className="mt-1 text-[11px] text-slate-200">
                        <b>{v.result}</b> {v.noNames.length > 0 ? `(NO: ${v.noNames.join(", ")})` : "(Unanimous)"} — {v.excerpt.slice(0, 90)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Supporting PDFs for this Reading */}
                <div className="mt-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                    📄 Supporting Foundry Agenda &amp; Packet PDFs ({readingDocs.length})
                  </div>
                  <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto">
                    {readingDocs.slice(0, 6).map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-2 rounded bg-white/5 px-2.5 py-1.5 text-xs">
                        <span className="truncate text-slate-200">{d.title}</span>
                        {d.url && (
                          <a
                            href={d.url.includes("granicus.com") && !d.url.includes("web.archive.org") ? `https://web.archive.org/web/${d.url}` : d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 font-bold text-amber-300 hover:underline"
                          >
                            PDF ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
                <button
                  type="button"
                  disabled={activeIdx === 0}
                  onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                  className="rounded-lg bg-white/10 px-3 py-1.5 font-bold disabled:opacity-40"
                >
                  ← Previous Reading
                </button>
                {activeReading.meeting && (
                  <Link href={`/episode/${activeReading.meeting}`} className="font-bold text-amber-300 hover:underline">
                    Full Episode →
                  </Link>
                )}
                <button
                  type="button"
                  disabled={activeIdx >= ord.readings.length - 1}
                  onClick={() => setActiveIdx((i) => Math.min(ord.readings.length - 1, i + 1))}
                  className="rounded-lg bg-amber-400 px-3 py-1.5 font-black text-black disabled:opacity-40"
                >
                  Next Reading →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* All Speaker Video Turns Across All Readings of this Ordinance */}
      {turns.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black text-white">
              🎙️ All Speaker Testimony Across Readings ({turns.length} Speaker Turns)
            </h2>
            <span className="text-xs text-slate-400">
              Chronological testimony from First Reading ({ord.firstDate}) through Final Consideration ({ord.lastDate})
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {turns.map((t) => (
              <SpeakerTurnPlayerCard key={t.id} turn={t} onShareFb={setFbTurn} />
            ))}
          </div>
        </section>
      )}

      {fbTurn && <FacebookShareModal turn={fbTurn} speaker={null} onClose={() => setFbTurn(null)} />}
    </div>
  );
}
