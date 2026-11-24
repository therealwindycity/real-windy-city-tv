"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EMOTION_META, FacebookShareModal, SpeakerTurnPlayerCard, THEME_LABELS } from "@/components/GothamFoundrySuite";
import type { SpeakerProfile, SpeakerTurn } from "@/lib/types";

export default function SpeakersVaultClient({
  speakers,
  turns,
  totalTurns,
  recentDates,
  ordinanceOptions,
  activeSpeaker,
  filters,
}: {
  speakers: SpeakerProfile[];
  turns: SpeakerTurn[];
  totalTurns: number;
  recentDates: { date: string; bodyName: string; meetingSlug: string; turns: number; speakers: number }[];
  ordinanceOptions: { slug: string; title: string; kind: string }[];
  activeSpeaker: SpeakerProfile | null;
  filters: {
    speaker?: string;
    date?: string;
    ordinance?: string;
    theme?: string;
    emotion?: string;
    q?: string;
    sort?: string;
    tab?: string;
  };
}) {
  const router = useRouter();
  const [fbTurn, setFbTurn] = useState<SpeakerTurn | null>(null);
  const [playlistIdx, setPlaylistIdx] = useState<number | null>(null);
  const [speakerSearch, setSpeakerSearch] = useState("");
  const [qInput, setQInput] = useState(filters.q ?? "");

  const pushFilter = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged: Record<string, string | undefined> = { ...filters, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    router.push(`/speakers?${sp.toString()}`);
  };

  const tab =
    filters.tab ??
    (filters.speaker ? "speaker" : filters.date ? "date" : filters.ordinance ? "ordinance" : filters.theme ? "theme" : filters.emotion ? "emotion" : "speaker");

  const filteredDirectory = speakers.filter(
    (s) => !speakerSearch || `${s.name} ${s.role} ${s.topThemes.join(" ")}`.toLowerCase().includes(speakerSearch.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      {/* Command Header */}
      <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[#0b1528] via-[#070d1a] to-black p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">
              🎙️ Cheyenne Historical Speaker-Turn Video Database &amp; Facebook Clip Studio
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
              2,483 Individual &le;3-Min Speaker Video Turns · 246 Speakers
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Watch every individual public comment and council floor intervention across Cheyenne history — organized by <b>Speaker</b>, <b>Sitting Date</b>,{" "}
              <b>Ordinance (across all readings)</b>, <b>Civic Theme</b>, and <b>Emotional Tone / Impact</b>. Download any speaker&apos;s complete video archive as a{" "}
              <code>.ZIP</code> or generate ready-to-post <b>Facebook</b> video clips in one click.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushFilter({ q: qInput || undefined });
            }}
            className="flex gap-2"
          >
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search verbatim speech, speaker, date…"
              className="w-64 rounded-xl border border-white/15 bg-black/60 px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400"
            />
            <button type="submit" className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-black hover:bg-amber-300">
              Search
            </button>
          </form>
        </div>

        {/* 5 Organization Axis Tabs */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-xs font-bold">
          {[
            ["speaker", "👤 By Speaker (All Historical Meetings)"],
            ["date", "📅 By Sitting Date (All Speakers on Date)"],
            ["ordinance", "📜 By Ordinance (1st → Final Reading)"],
            ["theme", "🏷️ By Civic Theme (Annex, Budget, Data Centers…)"],
            ["emotion", "🔥 By Emotional Tone (Angry, Impactful, Concerned…)"],
          ].map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => pushFilter({ tab: k })}
              className={`rounded-full px-4 py-2 transition ${
                tab === k ? "bg-amber-400 text-black shadow-lg" : "bg-white/10 text-slate-200 hover:bg-white/20"
              }`}
            >
              {lbl}
            </button>
          ))}
          {(filters.speaker || filters.date || filters.ordinance || filters.theme || filters.emotion || filters.q) && (
            <Link href="/speakers" className="ml-auto rounded-full bg-rose-500/20 px-3.5 py-2 text-rose-200 ring-1 ring-rose-400/40 hover:bg-rose-500/30">
              ✕ Clear Active Filters
            </Link>
          )}
        </div>

        {/* Dynamic Selector Bar for Current Axis */}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/50 p-3.5">
          {tab === "speaker" && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-sky-300">
                  Select any Speaker to view every meeting they ever spoke in ({speakers.length} Speakers Indexed):
                </span>
                <input
                  value={speakerSearch}
                  onChange={(e) => setSpeakerSearch(e.target.value)}
                  placeholder="Filter speaker roster…"
                  className="w-56 rounded border border-white/15 bg-[#050912] px-2.5 py-1 text-xs text-white"
                />
              </div>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {filteredDirectory.slice(0, 80).map((s) => (
                  <button
                    key={s.slug}
                    onClick={() => pushFilter({ speaker: filters.speaker === s.slug ? undefined : s.slug, tab: "speaker" })}
                    className={`rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      filters.speaker === s.slug
                        ? "bg-amber-400 font-black text-black"
                        : "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/15"
                    }`}
                  >
                    <span>{s.name}</span>{" "}
                    <span className="opacity-70">
                      ({s.turnCount} turns · {s.meetingCount} mtgs)
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "date" && (
            <div>
              <div className="mb-2 text-xs font-bold text-sky-300">
                Select a Sitting Date to watch ALL speakers who took the floor on that date:
              </div>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {recentDates.map((d) => (
                  <button
                    key={d.meetingSlug}
                    onClick={() => pushFilter({ date: filters.date === d.date ? undefined : d.date, tab: "date", sort: "oldest" })}
                    className={`rounded-lg px-2.5 py-1.5 font-mono text-xs ${
                      filters.date === d.date ? "bg-amber-400 font-black text-black" : "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/15"
                    }`}
                  >
                    {d.date} · {d.bodyName} ({d.turns} turns / {d.speakers} speakers)
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "ordinance" && (
            <div>
              <div className="mb-2 text-xs font-bold text-violet-300">
                Select an Ordinance to watch ALL speakers across First Reading, Committee, Second Reading &amp; Final Vote:
              </div>
              <div className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {ordinanceOptions.map((o) => (
                  <button
                    key={o.slug}
                    onClick={() => pushFilter({ ordinance: filters.ordinance === o.slug ? undefined : o.slug, tab: "ordinance", sort: "oldest" })}
                    className={`truncate rounded-lg px-2.5 py-2 text-left text-xs ${
                      filters.ordinance === o.slug
                        ? "bg-violet-400 font-black text-black"
                        : "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/15"
                    }`}
                    title={o.title}
                  >
                    📜 [{o.kind}] {o.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "theme" && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(THEME_LABELS).map(([k, lbl]) => (
                <button
                  key={k}
                  onClick={() => pushFilter({ theme: filters.theme === k ? undefined : k, tab: "theme" })}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold ${
                    filters.theme === k ? "bg-emerald-400 text-black" : "bg-white/10 text-slate-200 hover:bg-white/20"
                  }`}
                >
                  #{k} · {lbl}
                </button>
              ))}
            </div>
          )}

          {tab === "emotion" && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(EMOTION_META).map(([k, m]) => (
                <button
                  key={k}
                  onClick={() => pushFilter({ emotion: filters.emotion === k ? undefined : k, tab: "emotion" })}
                  className={`flex items-center justify-between rounded-xl border p-3 text-left text-xs font-bold transition ${
                    filters.emotion === k ? "border-amber-300 bg-amber-400 text-black" : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/15"
                  }`}
                >
                  <span>
                    {m.icon} {m.label}
                  </span>
                  <span className="text-[10px] uppercase opacity-75">Filter →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Speaker Complete Historical Dossier Card */}
      {activeSpeaker && (
        <div className="rounded-2xl border-2 border-amber-400/50 bg-[#091224] p-5 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
                Complete Multi-Year Speaker Video Vault · {activeSpeaker.role}
              </div>
              <h2 className="mt-1 text-2xl font-black text-white">{activeSpeaker.name}</h2>
              <p className="mt-1 text-xs text-slate-300">
                <b>{activeSpeaker.turnCount}</b> recorded &le;3-min speaking turns across <b>{activeSpeaker.meetingCount}</b> Cheyenne government meetings (
                {activeSpeaker.firstDate} → {activeSpeaker.lastDate}) · Total Floor Time: <b>{Math.round(activeSpeaker.totalDurationSec / 60)} min</b> · Linked
                Ordinances: <b>{activeSpeaker.ordinanceCount}</b>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeSpeaker.topThemes.map((th) => (
                  <span key={th} className="rounded bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-200">
                    #{th}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <a
                href={`/api/speakers/${encodeURIComponent(activeSpeaker.slug)}/bundle`}
                download
                className="rounded-xl bg-amber-400 px-4 py-2.5 font-black text-black shadow-lg hover:bg-amber-300"
              >
                📦 Download All {activeSpeaker.turnCount} Speaker Clips &amp; FB Pack (.ZIP)
              </a>
              {turns[0] && (
                <button
                  type="button"
                  onClick={() => setFbTurn(turns[0])}
                  className="rounded-xl bg-[#1877F2] px-4 py-2.5 font-black text-white shadow-lg hover:bg-[#166fe5]"
                >
                  📘 Post Speaker Video to Facebook
                </button>
              )}
            </div>
          </div>

          {activeSpeaker.compilationReels.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-300">
                🎞️ Master Speaker Supercuts &amp; Documentary Compilation Reels (Direct MP4)
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {activeSpeaker.compilationReels.map((reel) => (
                  <div key={reel.url} className="rounded-xl border border-white/10 bg-black p-3">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{reel.title}</span>
                      <a href={reel.url} download target="_blank" rel="noreferrer" className="font-bold text-emerald-300 hover:underline">
                        ⬇ Download MP4
                      </a>
                    </div>
                    <video src={reel.url} controls preload="metadata" className="h-44 w-full rounded bg-black object-contain" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Toolbar + Continuous Sequential Player */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-bold text-slate-200">
          Showing {turns.length} of {totalTurns.toLocaleString()} matching &le;3-min speaker video turns
          {filters.ordinance && (
            <Link href={`/ordinance/${filters.ordinance}`} className="ml-3 text-xs font-black text-violet-300 underline">
              ▶ Open Full 1st→Final Ordinance Arc Player →
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => setPlaylistIdx(0)}
              className="rounded-lg bg-emerald-400 px-3.5 py-2 font-black text-black hover:bg-emerald-300"
            >
              ▶ Play All {turns.length} Turns Sequentially
            </button>
          )}
          <select
            value={filters.sort ?? "impact"}
            onChange={(e) => pushFilter({ sort: e.target.value })}
            className="rounded-lg border border-white/15 bg-[#080f1d] px-3 py-2 text-xs text-white"
          >
            <option value="impact">Sort: Highest Emotional Impact</option>
            <option value="newest">Sort: Newest Meeting First</option>
            <option value="oldest">Sort: Chronological (First → Last)</option>
          </select>
        </div>
      </div>

      {playlistIdx !== null && turns[playlistIdx] && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-black p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-black text-emerald-300">
              ▶ SEQUENTIAL SPEAKER REEL: Turn {playlistIdx + 1} of {turns.length} · {turns[playlistIdx].speakerName} ({turns[playlistIdx].date})
            </span>
            <div className="flex gap-2">
              <button
                disabled={playlistIdx === 0}
                onClick={() => setPlaylistIdx((i) => Math.max(0, (i ?? 0) - 1))}
                className="rounded bg-white/10 px-2.5 py-1 disabled:opacity-40"
              >
                ⏮ Prev
              </button>
              <button
                disabled={playlistIdx >= turns.length - 1}
                onClick={() => setPlaylistIdx((i) => Math.min(turns.length - 1, (i ?? 0) + 1))}
                className="rounded bg-white/10 px-2.5 py-1 disabled:opacity-40"
              >
                Next ⏭
              </button>
              <button onClick={() => setPlaylistIdx(null)} className="rounded bg-rose-500/20 px-2.5 py-1 text-rose-200">
                ✕ Close Player
              </button>
            </div>
          </div>
          <SpeakerTurnPlayerCard
            turn={turns[playlistIdx]}
            autoPlay
            onEnded={() => {
              if (playlistIdx < turns.length - 1) setPlaylistIdx(playlistIdx + 1);
            }}
            onShareFb={setFbTurn}
          />
        </div>
      )}

      {/* Grid of Individual <=3-Min Speaker Video Turn Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {turns.map((t) => (
          <SpeakerTurnPlayerCard key={t.id} turn={t} onShareFb={setFbTurn} />
        ))}
      </div>

      {fbTurn && <FacebookShareModal turn={fbTurn} speaker={activeSpeaker} onClose={() => setFbTurn(null)} />}
    </div>
  );
}
