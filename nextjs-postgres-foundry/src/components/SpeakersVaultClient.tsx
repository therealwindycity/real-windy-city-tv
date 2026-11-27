"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EMOTION_META, FacebookShareModal, SpeakerTurnPlayerCard, THEME_LABELS } from "@/components/GothamFoundrySuite";
import type { SpeakerProfile, SpeakerTurn } from "@/lib/types";

const CAPACITIES = [
  "Elected Official",
  "Municipal Staff / Counsel",
  "Organizational / Lobbyist Representative",
  "Contractor / Vendor / Applicant Agent",
  "Civic Watchdog / Statutory Advocate",
  "Individual Citizen",
];

const STANCES = [
  ["support_lobby_for", "Lobbies For / Supports"],
  ["oppose_challenge", "Opposes / Challenges"],
  ["sponsor_motion", "Sponsors Motion / Governing Action"],
  ["procedural_point_of_order", "Raises Point of Order"],
  ["technical_staff_report", "Staff / Legal Testimony"],
  ["inquiry_discussion", "Floor Inquiry / Deliberation"],
];

export default function SpeakersVaultClient({
  speakers,
  turns,
  totalTurns,
  page,
  pageSize,
  recentDates,
  ordinanceOptions,
  activeSpeaker,
  filters,
}: {
  speakers: SpeakerProfile[];
  turns: SpeakerTurn[];
  totalTurns: number;
  page: number;
  pageSize: number;
  recentDates: { date: string; bodyName: string; meetingSlug: string; turns: number; speakers: number }[];
  ordinanceOptions: { slug: string; title: string; kind: string }[];
  activeSpeaker: SpeakerProfile | null;
  filters: {
    speaker?: string;
    date?: string;
    ordinance?: string;
    theme?: string;
    emotion?: string;
    capacity?: string;
    stance?: string;
    poe?: string;
    q?: string;
    sort?: string;
    tab?: string;
    page?: string;
  };
}) {
  const router = useRouter();
  const [fbTurn, setFbTurn] = useState<SpeakerTurn | null>(null);
  const [playlistIdx, setPlaylistIdx] = useState<number | null>(null);
  const [speakerSearch, setSpeakerSearch] = useState("");
  const [qInput, setQInput] = useState(filters.q ?? "");

  const totalPages = Math.max(1, Math.ceil(totalTurns / pageSize));

  const pushFilter = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged: Record<string, string | undefined> = { ...filters, page: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    router.push(qs ? `/speakers?${qs}` : "/speakers");
  };

  const tab =
    filters.tab ??
    (filters.speaker ? "speaker" : filters.date ? "date" : filters.ordinance ? "ordinance" : filters.theme ? "theme" : filters.emotion ? "emotion" : "speaker");

  const filteredDirectory = speakers.filter(
    (s) => !speakerSearch || `${s.name} ${s.role} ${s.topThemes.join(" ")}`.toLowerCase().includes(speakerSearch.toLowerCase()),
  );

  const an = activeSpeaker?.analytics;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      {/* Command Header */}
      <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[#0b1528] via-[#070d1a] to-black p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">
              🎙️ Cheyenne Historical Speaker-Segment Video Database, Advocacy Analytics &amp; OSINT Studio
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
              2,448 Speaker Turns · 1,951 Timed to Video · 25 Branded Clips · {speakers.length} Verified Canonical Speakers
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Every clip features <b>The Real Windy City</b> intro/outro, a <b>C-SPAN style marquee info border</b>, synced cleaned captions, historical clip counts,{" "}
              <b>speaking capacities</b> (individual vs. organization/contractor/official), <b>topic &amp; lobby/oppose analytics</b>, average speaking times,{" "}
              <b>Point-of-Order</b> tracking, and verified <b>OSINT social/professional links</b>. Downloads &amp; Facebook exports strictly slice only the speaker&apos;s segment.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushFilter({ q: qInput.trim() || undefined });
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
              Enter ↵
            </button>
          </form>
        </div>

        {/* 5 Organization Axis Tabs */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-xs font-bold">
          {[
            ["speaker", "👤 By Speaker (All Historical Clips)"],
            ["date", "📅 By Sitting Date"],
            ["ordinance", "📜 By Ordinance (1st → Final Reading)"],
            ["theme", "🏷️ By Civic Topic"],
            ["emotion", "🔥 By Tone / Point of Order"],
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
          <Link
            href="/osint"
            className="rounded-full bg-emerald-500/20 px-3.5 py-2 text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30"
          >
            🕸️ OSINT Entity &amp; Contractor Graph →
          </Link>
          {(filters.speaker || filters.date || filters.ordinance || filters.theme || filters.emotion || filters.capacity || filters.stance || filters.poe || filters.q) && (
            <Link href="/speakers" className="ml-auto rounded-full bg-rose-500/20 px-3.5 py-2 text-rose-200 ring-1 ring-rose-400/40 hover:bg-rose-500/30">
              ✕ Clear Active Filters
            </Link>
          )}
        </div>

        {/* Instant Selectable Dropdowns: Capacity, Stance, Point-of-Order Toggle */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs">
          <select
            value={filters.capacity ?? ""}
            onChange={(e) => pushFilter({ capacity: e.target.value || undefined })}
            className="rounded-lg border border-white/15 bg-[#050912] px-3 py-1.5 font-semibold text-white"
          >
            <option value="">All Speaking Capacities</option>
            {CAPACITIES.map((c) => (
              <option key={c} value={c}>
                Capacity: {c}
              </option>
            ))}
          </select>
          <select
            value={filters.stance ?? ""}
            onChange={(e) => pushFilter({ stance: e.target.value || undefined })}
            className="rounded-lg border border-white/15 bg-[#050912] px-3 py-1.5 font-semibold text-white"
          >
            <option value="">All Advocacy Stances (Lobby / Oppose)</option>
            {STANCES.map(([k, lbl]) => (
              <option key={k} value={k}>
                Stance: {lbl}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-1.5 font-bold text-rose-200">
            <input
              type="checkbox"
              checked={filters.poe === "1"}
              onChange={(e) => pushFilter({ poe: e.target.checked ? "1" : undefined })}
            />
            ⚖️ Point-of-Order / Gavel Clips Only
          </label>
        </div>

        {/* Dynamic Selector Bar for Current Axis */}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/50 p-3.5">
          {tab === "speaker" && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-sky-300">
                  Select any Speaker to inspect their complete historical clips, capacities, stances &amp; OSINT dossier ({speakers.length} Canonical Speakers):
                </span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (filteredDirectory[0]) {
                      pushFilter({ speaker: filteredDirectory[0].slug, tab: "speaker" });
                    }
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    value={speakerSearch}
                    onChange={(e) => setSpeakerSearch(e.target.value)}
                    placeholder="Filter speaker roster (e.g. Mark Moody)…"
                    className="w-56 rounded border border-white/15 bg-[#050912] px-2.5 py-1 text-xs text-white"
                  />
                  <button type="submit" className="rounded bg-sky-400 px-2.5 py-1 text-xs font-black text-black hover:bg-sky-300">
                    Enter ↵
                  </button>
                </form>
              </div>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {filteredDirectory.slice(0, 109).map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => pushFilter({ speaker: filters.speaker === s.slug ? undefined : s.slug, tab: "speaker" })}
                    className={`rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      filters.speaker === s.slug
                        ? "bg-amber-400 font-black text-black"
                        : "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/15"
                    }`}
                  >
                    <span>{s.name}</span>{" "}
                    <span className="opacity-75">
                      ({s.turnCount} clips · {s.meetingCount} mtgs)
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
                    type="button"
                    onClick={() => pushFilter({ date: filters.date === d.date ? undefined : d.date, tab: "date", sort: "oldest" })}
                    className={`rounded-lg px-2.5 py-1.5 font-mono text-xs ${
                      filters.date === d.date ? "bg-amber-400 font-black text-black" : "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/15"
                    }`}
                  >
                    {d.date} · {d.bodyName} ({d.turns} clips / {d.speakers} speakers)
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
                    type="button"
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
                  type="button"
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
                  type="button"
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

      {/* Selected Speaker Complete Historical Analytics & OSINT Dossier */}
      {activeSpeaker && (
        <div className="rounded-2xl border-2 border-amber-400/50 bg-[#091224] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
                Complete Multi-Year Speaker Video, Advocacy &amp; OSINT Dossier · {activeSpeaker.role}
              </div>
              <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">{activeSpeaker.name}</h2>
              {an?.osint?.headline && <p className="mt-1 text-xs font-semibold text-sky-300">{an.osint.headline}</p>}
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
                <span className="rounded-lg bg-amber-400/20 px-2.5 py-1 font-bold text-amber-200 ring-1 ring-amber-400/40">
                  📼 {activeSpeaker.turnCount} Historical Clips ({activeSpeaker.meetingCount} Mtgs)
                </span>
                <span className="rounded-lg bg-sky-500/20 px-2.5 py-1 font-bold text-sky-200 ring-1 ring-sky-400/40">
                  ⏱️ Avg Speaking Time: {an?.avgSpeakingFormatted ?? `${Math.round(activeSpeaker.totalDurationSec / Math.max(1, activeSpeaker.turnCount))}s`}
                </span>
                <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 font-bold text-indigo-200 ring-1 ring-indigo-400/40">
                  ⏳ Total Floor Time: {an?.totalSpeakingFormatted ?? `${Math.round(activeSpeaker.totalDurationSec / 60)}m`}
                </span>
                <button
                  type="button"
                  onClick={() => pushFilter({ poe: filters.poe === "1" ? undefined : "1" })}
                  className="rounded-lg bg-rose-500/20 px-2.5 py-1 font-bold text-rose-200 ring-1 ring-rose-400/40 hover:bg-rose-500/30"
                >
                  ⚖️ Points of Order: {an?.pointOfOrderCount ?? 0} (Filter)
                </button>
              </div>

              {/* Verified OSINT Social, LinkedIn, Chamber & Official Links */}
              {an?.osint?.profiles && an.osint.profiles.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-bold text-emerald-300">Verified OSINT Profiles:</span>
                  {an.osint.profiles.map((p, idx) => (
                    <a
                      key={idx}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-bold text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-500/30"
                    >
                      🔗 {p.platform}: {p.label} ↗
                    </a>
                  ))}
                  <Link
                    href={`/osint?q=${encodeURIComponent(activeSpeaker.name)}`}
                    className="rounded-lg bg-white/10 px-2.5 py-1 font-bold text-white hover:bg-white/20"
                  >
                    🕸️ Open Full OSINT Graph →
                  </Link>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <a
                href={`/api/speakers/${encodeURIComponent(activeSpeaker.slug)}/bundle`}
                download
                className="rounded-xl bg-amber-400 px-4 py-2.5 font-black text-black shadow-lg hover:bg-amber-300"
              >
                📦 Speaker Segment &amp; OSINT Pack (.ZIP)
              </a>
              {turns[0] && (
                <button
                  type="button"
                  onClick={() => setFbTurn(turns[0])}
                  className="rounded-xl bg-[#1877F2] px-4 py-2.5 font-black text-white shadow-lg hover:bg-[#166fe5]"
                >
                  📘 Export Speaker Segment to Facebook
                </button>
              )}
            </div>
          </div>

          {/* 3-Column Analytics Matrix: Speaking Capacities | Topics Spoken On | Lobbies For vs Opposes */}
          {an && (
            <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-3">
              {/* Column 1: Capacities */}
              <div className="rounded-xl border border-white/10 bg-black/45 p-3.5 text-xs">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  🏛️ Speaking Capacities (Individual vs. Organizational)
                </div>
                <div className="mt-2 space-y-2">
                  {an.capacitiesBreakdown.map((cb) => (
                    <div key={cb.capacity}>
                      <div className="flex justify-between font-semibold text-white">
                        <span>{cb.capacity}</span>
                        <span className="font-mono text-amber-300">
                          {cb.count} ({cb.pct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded bg-slate-800">
                        <div className="h-1.5 rounded bg-indigo-400" style={{ width: `${cb.pct}%` }} />
                      </div>
                      {cb.orgs.length > 0 && <div className="mt-0.5 text-[10px] text-slate-400">{cb.orgs.join(" · ")}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Topic Distribution */}
              <div className="rounded-xl border border-white/10 bg-black/45 p-3.5 text-xs">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  📊 Topics Spoken On (Support vs. Oppose)
                </div>
                <div className="mt-2 space-y-1.5">
                  {an.topicAnalytics.map((ta) => (
                    <button
                      key={ta.topic}
                      type="button"
                      onClick={() => pushFilter({ theme: filters.theme === ta.topic ? undefined : ta.topic })}
                      className="flex w-full items-center justify-between rounded bg-white/5 px-2 py-1 text-left hover:bg-white/10"
                    >
                      <span className="truncate font-semibold text-slate-200">{ta.label}</span>
                      <span className="ml-2 whitespace-nowrap font-mono text-[10px]">
                        <b className="text-amber-300">{ta.count}</b>{" "}
                        <span className="text-emerald-300">(+{ta.supportCount}</span>/
                        <span className="text-rose-300">-{ta.opposeCount})</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 3: Lobbies For / Supports vs Opposes / Dissents */}
              <div className="rounded-xl border border-white/10 bg-black/45 p-3.5 text-xs">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  ✅ Lobbies For / Sponsors &amp; 🛑 Opposes / Dissents
                </div>
                {an.lobbiesFor.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] font-bold text-emerald-300">Lobbies For / Supports / Sponsors:</div>
                    <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11px] text-slate-200">
                      {an.lobbiesFor.slice(0, 4).map((item, idx) => (
                        <li key={idx} className="line-clamp-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {an.opposes.length > 0 && (
                  <div className="mt-2.5">
                    <div className="text-[10px] font-bold text-rose-300">Opposes / Challenges / NO Votes:</div>
                    <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11px] text-slate-200">
                      {an.opposes.slice(0, 4).map((item, idx) => (
                        <li key={idx} className="line-clamp-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSpeaker.compilationReels.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-300">
                🎞️ Verified Speaker Segment Reels (C-SPAN Framed Standalone MP4s)
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {activeSpeaker.compilationReels.map((reel) => (
                  <div key={reel.url} className="overflow-hidden rounded-xl border-2 border-amber-400/40 bg-[#050912]">
                    <div className="flex items-center justify-between border-b border-amber-400 bg-[#09152b] px-3 py-1 text-[10px] font-black uppercase text-amber-300">
                      <span>[RWC] THE REAL WINDY CITY · SPEAKER REEL</span>
                      <a href={reel.url} download target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">
                        ⬇ Download Segment MP4
                      </a>
                    </div>
                    <video src={reel.url} controls preload="metadata" className="h-44 w-full bg-black object-contain" />
                    <div className="border-t border-rose-700 bg-[#0a1931] px-3 py-1.5 text-xs font-bold text-white">
                      {reel.title} · <span className="font-mono text-[10px] text-emerald-300">{activeSpeaker.turnCount} Historical Clips</span>
                    </div>
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
          Page {page} of {totalPages} · Showing {turns.length} of {totalTurns.toLocaleString()} matching &le;3-min speaker video segments
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
              ▶ Play All {turns.length} Segments Sequentially
            </button>
          )}
          <select
            value={filters.sort ?? "impact"}
            onChange={(e) => pushFilter({ sort: e.target.value })}
            className="rounded-lg border border-white/15 bg-[#080f1d] px-3 py-2 text-xs font-semibold text-white"
          >
            <option value="impact">Sort: Highest Civic Impact</option>
            <option value="newest">Sort: Newest Meeting First</option>
            <option value="oldest">Sort: Chronological (First → Last)</option>
          </select>
        </div>
      </div>

      {playlistIdx !== null && turns[playlistIdx] && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-black p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-black text-emerald-300">
              ▶ SEQUENTIAL SPEAKER REEL: Clip {playlistIdx + 1} of {turns.length} · {turns[playlistIdx].speakerName} ({turns[playlistIdx].date})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={playlistIdx === 0}
                onClick={() => setPlaylistIdx((i) => Math.max(0, (i ?? 0) - 1))}
                className="rounded bg-white/10 px-2.5 py-1 disabled:opacity-40"
              >
                ⏮ Prev
              </button>
              <button
                type="button"
                disabled={playlistIdx >= turns.length - 1}
                onClick={() => setPlaylistIdx((i) => Math.min(turns.length - 1, (i ?? 0) + 1))}
                className="rounded bg-white/10 px-2.5 py-1 disabled:opacity-40"
              >
                Next ⏭
              </button>
              <button type="button" onClick={() => setPlaylistIdx(null)} className="rounded bg-rose-500/20 px-2.5 py-1 text-rose-200">
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

      {/* Full Previous / Next Page Pagination */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#080f1d] px-4 py-3 text-xs sm:text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => pushFilter({ page: String(page - 1) })}
          className="rounded-lg bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20 disabled:opacity-40"
        >
          ← Previous Page
        </button>
        <span className="font-mono text-slate-300">
          Page {page} of {totalPages} ({totalTurns.toLocaleString()} speaker clips)
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => pushFilter({ page: String(page + 1) })}
          className="rounded-lg bg-amber-400 px-4 py-2 font-black text-black hover:bg-amber-300 disabled:opacity-40"
        >
          Next Page →
        </button>
      </div>

      {fbTurn && <FacebookShareModal turn={fbTurn} speaker={activeSpeaker} onClose={() => setFbTurn(null)} />}
    </div>
  );
}
