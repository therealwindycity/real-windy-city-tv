"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FacebookShareModal, SpeakerTurnPlayerCard } from "@/components/GothamFoundrySuite";
import type { SpeakerTurn } from "@/lib/types";

const STAGE_BADGE: Record<string, { label: string; color: string }> = {
  first: { label: "ACT I · FIRST READING (PILOT)", color: "bg-sky-400 text-black" },
  committee: { label: "COMMITTEE / PUBLIC HEARING", color: "bg-violet-400 text-black" },
  second: { label: "ACT II · SECOND READING & AMENDMENTS", color: "bg-amber-400 text-black" },
  third: { label: "ACT III · THIRD & FINAL READING", color: "bg-emerald-400 text-black" },
  listed: { label: "DOCKET APPEARANCE", color: "bg-slate-300 text-black" },
};

export default function OrdinanceArcPlayer({
  ord,
  episodes,
  speakerTurns,
  docs,
  votes,
}: {
  ord: {
    slug: string;
    title: string;
    kind: string;
    firstDate: string;
    lastDate: string;
    sources: string[];
    readings: { date: string; body: string; stage: string; context: string; meeting: string | null; source: string }[];
  };
  episodes: {
    id: number;
    slug: string;
    title: string;
    date: string;
    bodyName: string;
    videoUrl: string | null;
    mp4Url: string | null;
    agendaUrl: string | null;
    minutesUrl: string | null;
  }[];
  speakerTurns: SpeakerTurn[];
  docs: {
    id: number;
    meetingId: number;
    role: string;
    itemNo: string;
    title: string;
    url: string | null;
    pages: number | null;
    ocr: boolean;
    sha1: string | null;
  }[];
  votes: {
    meetingId: number;
    idx: number;
    excerpt: string;
    result: string;
    unanimous: boolean;
    noNames: string[];
  }[];
}) {
  const epBySlug = useMemo(() => new Map(episodes.map((e) => [e.slug, e])), [episodes]);
  const [activeReadingIdx, setActiveReadingIdx] = useState(0);
  const [fbTurn, setFbTurn] = useState<SpeakerTurn | null>(null);
  const [seqTurnIdx, setSeqTurnIdx] = useState<number | null>(null);

  // Filter speaker turns directly mentioning this ordinance OR occurring in its reading sittings
  const directOrdTurns = useMemo(() => {
    const exact = speakerTurns.filter((t) => t.ordinances.some((o) => o.slug === ord.slug));
    return exact.length > 0 ? exact : speakerTurns;
  }, [speakerTurns, ord.slug]);

  const activeReading = ord.readings[activeReadingIdx] ?? ord.readings[0];
  const activeEp = activeReading?.meeting ? epBySlug.get(activeReading.meeting) ?? null : null;
  const stageTurns = activeReading?.meeting
    ? directOrdTurns.filter((t) => t.meetingSlug === activeReading.meeting)
    : directOrdTurns.filter((t) => t.date === activeReading?.date);
  const stageDocs = activeEp ? docs.filter((d) => d.meetingId === activeEp.id) : [];
  const stageVotes = activeEp ? votes.filter((v) => v.meetingId === activeEp.id) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/ordinances" className="text-xs font-bold text-amber-300 hover:underline">
          ← All 275 Multi-Reading Ordinance Arcs
        </Link>
        <Link
          href={`/speakers?ordinance=${encodeURIComponent(ord.slug)}`}
          className="rounded-full bg-[#1877F2] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#166fe5]"
        >
          🎙️ Open All Speaker Clips for This Ordinance in FB Studio ({directOrdTurns.length}) →
        </Link>
      </div>

      {/* Ordinance Series Header */}
      <div className="rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-950/60 via-[#080f1e] to-black p-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-300">
          📜 First-to-Last Reading Ordinance Player · {ord.kind} · {ord.readings.length} Chronological Stages ({ord.firstDate} → {ord.lastDate})
        </div>
        <h1 className="mt-2 text-2xl font-black leading-snug text-white sm:text-3xl">{ord.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveReadingIdx(0);
              if (directOrdTurns.length > 0) setSeqTurnIdx(0);
            }}
            className="rounded-full bg-amber-400 px-5 py-2.5 font-black text-black shadow-lg hover:bg-amber-300"
          >
            ▶ Play Ordinance From 1st Reading to Final Vote ({directOrdTurns.length} Speaker Turns)
          </button>
          <span className="self-center text-slate-400">
            Click any stage below to inspect that reading&apos;s broadcast tape, speaker testimony videos, Foundry PDFs &amp; roll-call votes.
          </span>
        </div>

        {/* Interactive First -> Last Reading Stepper */}
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {ord.readings.map((r, i) => {
            const meta = STAGE_BADGE[r.stage] ?? STAGE_BADGE.listed;
            const active = i === activeReadingIdx;
            const rTurns = r.meeting ? directOrdTurns.filter((t) => t.meetingSlug === r.meeting).length : 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveReadingIdx(i)}
                className={`rounded-xl border p-3.5 text-left transition ${
                  active ? "border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/40" : "border-white/10 bg-black/40 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-black ${meta.color}`}>
                    STAGE {i + 1} · {r.stage.toUpperCase()}
                  </span>
                  <span className="font-mono text-[11px] text-slate-300">{r.date}</span>
                </div>
                <div className="mt-1.5 text-xs font-bold text-white">{r.body}</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {rTurns} speaker clips · {r.meeting ? "Full Episode Linked" : "Docket Record"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sequential First-to-Last Testimony Reel Player */}
      {seqTurnIdx !== null && directOrdTurns[seqTurnIdx] && (
        <div className="rounded-2xl border-2 border-amber-400 bg-black p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-black text-amber-300">
              ▶ CHRONOLOGICAL 1ST → FINAL READING SPEAKER REEL: Clip {seqTurnIdx + 1} of {directOrdTurns.length} ({directOrdTurns[seqTurnIdx].date} ·{" "}
              {directOrdTurns[seqTurnIdx].speakerName})
            </span>
            <div className="flex gap-2">
              <button
                disabled={seqTurnIdx === 0}
                onClick={() => setSeqTurnIdx((i) => Math.max(0, (i ?? 0) - 1))}
                className="rounded bg-white/10 px-2.5 py-1 disabled:opacity-40"
              >
                ⏮ Prev Turn
              </button>
              <button
                disabled={seqTurnIdx >= directOrdTurns.length - 1}
                onClick={() => setSeqTurnIdx((i) => Math.min(directOrdTurns.length - 1, (i ?? 0) + 1))}
                className="rounded bg-white/10 px-2.5 py-1 disabled:opacity-40"
              >
                Next Turn ⏭
              </button>
              <button onClick={() => setSeqTurnIdx(null)} className="rounded bg-rose-500/20 px-2.5 py-1 text-rose-200">
                ✕ Stop Reel
              </button>
            </div>
          </div>
          <SpeakerTurnPlayerCard
            turn={directOrdTurns[seqTurnIdx]}
            autoPlay
            onEnded={() => {
              if (seqTurnIdx < directOrdTurns.length - 1) setSeqTurnIdx(seqTurnIdx + 1);
            }}
            onShareFb={setFbTurn}
          />
        </div>
      )}

      {/* Active Reading Stage Detail Workbench */}
      {activeReading && (
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/15 bg-[#080f1d] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-black ${(STAGE_BADGE[activeReading.stage] ?? STAGE_BADGE.listed).color}`}>
                    {(STAGE_BADGE[activeReading.stage] ?? STAGE_BADGE.listed).label}
                  </span>
                  <h2 className="mt-2 text-xl font-black text-white">
                    {activeReading.date} · {activeReading.body}
                  </h2>
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    disabled={activeReadingIdx === 0}
                    onClick={() => setActiveReadingIdx((i) => Math.max(0, i - 1))}
                    className="rounded-lg bg-white/10 px-3 py-1.5 font-bold disabled:opacity-40"
                  >
                    ← Earlier Reading
                  </button>
                  <button
                    disabled={activeReadingIdx >= ord.readings.length - 1}
                    onClick={() => setActiveReadingIdx((i) => Math.min(ord.readings.length - 1, i + 1))}
                    className="rounded-lg bg-amber-400 px-3 py-1.5 font-black text-black disabled:opacity-40"
                  >
                    Next Reading →
                  </button>
                </div>
              </div>

              {activeReading.context && <p className="mt-2 text-xs italic text-slate-300">&ldquo;{activeReading.context}&rdquo;</p>}

              {activeEp && (
                <div className="mt-4 space-y-3">
                  {activeEp.mp4Url ? (
                    <video src={activeEp.mp4Url} controls preload="metadata" className="aspect-video w-full rounded-xl border border-white/10 bg-black" />
                  ) : activeEp.videoUrl && activeEp.videoUrl.includes("archive.org/details/") ? (
                    <iframe
                      title={activeEp.title}
                      src={activeEp.videoUrl.replace("/details/", "/embed/")}
                      allowFullScreen
                      className="aspect-video w-full rounded-xl border border-white/10 bg-black"
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link href={`/episode/${activeEp.slug}`} className="rounded-lg bg-sky-400 px-3.5 py-2 font-black text-black hover:bg-sky-300">
                      ▶ Open Full 19-Lens Episode ({activeEp.slug}) →
                    </Link>
                    {activeEp.agendaUrl && (
                      <a href={activeEp.agendaUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-2 font-semibold hover:bg-white/20">
                        📄 Official Agenda ↗
                      </a>
                    )}
                    {activeEp.minutesUrl && (
                      <a href={activeEp.minutesUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-2 font-semibold hover:bg-white/20">
                        📜 Official Minutes ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Speaker Turns at This Reading */}
            <div className="rounded-2xl border border-white/15 bg-[#080f1d] p-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">
                🎙️ Speaker Video Turns at Stage {activeReadingIdx + 1} ({stageTurns.length})
              </h3>
              {stageTurns.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {stageTurns.slice(0, 12).map((t) => (
                    <SpeakerTurnPlayerCard key={t.id} turn={t} onShareFb={setFbTurn} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  No individual speaker video clips extracted on this specific reading date; see other reading stages or open the parent episode transcript.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Supporting PDFs + Roll Call Votes at This Stage */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-sky-500/30 bg-[#080f1d] p-4">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-sky-300">
                🏛️ Palantir Foundry Supporting PDFs at Stage {activeReadingIdx + 1} ({stageDocs.length})
              </div>
              <div className="mt-3 max-h-80 divide-y divide-white/10 overflow-y-auto text-xs">
                {stageDocs.map((d) => (
                  <div key={d.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-slate-400">
                      <span className="uppercase text-sky-300">{d.role}</span>
                      <span>
                        {d.pages ? `${d.pages}p` : ""} {d.ocr ? "· 🔬SHA1-OCR" : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-100">{d.title}</div>
                    {d.url && (
                      <a href={d.url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-[11px] text-amber-300 underline">
                        Open Primary PDF / Packet ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-[#080f1d] p-4">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-300">
                🗳️ Recorded Motions &amp; Roll-Call Votes ({stageVotes.length})
              </div>
              <div className="mt-3 max-h-80 space-y-2.5 overflow-y-auto text-xs">
                {stageVotes.length > 0 ? (
                  stageVotes.map((v) => (
                    <div key={v.idx} className="rounded-lg border border-white/10 bg-black/40 p-2.5">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className={v.result === "failed" ? "font-bold text-rose-400" : "font-bold text-emerald-400"}>
                          {v.result.toUpperCase()} {v.unanimous ? "(UNANIMOUS)" : ""}
                        </span>
                        {v.noNames.length > 0 && <span className="text-rose-300">NO: {v.noNames.join(", ")}</span>}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">{v.excerpt.slice(0, 220)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">Committee review / non-final reading or voice referral.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {fbTurn && <FacebookShareModal turn={fbTurn} onClose={() => setFbTurn(null)} />}
    </div>
  );
}
