"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DocMeta, EpisodeBundle, ProvenanceCatalogData, SpeakerProfile, SpeakerTurn } from "@/lib/types";

export const EMOTION_META: Record<string, { label: string; icon: string; badge: string }> = {
  impactful: { label: "Emotionally Impactful", icon: "🔥", badge: "bg-amber-500/20 text-amber-200 ring-amber-400/40" },
  angry: { label: "Angry / Gaveled / Point of Order", icon: "😠", badge: "bg-rose-500/20 text-rose-200 ring-rose-400/40" },
  concerned: { label: "Concerned / Urgent", icon: "😟", badge: "bg-orange-500/20 text-orange-200 ring-orange-400/40" },
  legal: { label: "Legal / Statutory Challenge", icon: "⚖️", badge: "bg-violet-500/20 text-violet-200 ring-violet-400/40" },
  technical: { label: "Fiscal / Staff / Technical", icon: "📊", badge: "bg-sky-500/20 text-sky-200 ring-sky-400/40" },
  supportive: { label: "Supportive / Coalition", icon: "🤝", badge: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40" },
};

export const THEME_LABELS: Record<string, string> = {
  annexation: "Annexation & Boundaries",
  datacenters: "Data Centers, Power & Water",
  budget: "Budget, Taxes & 6th Penny",
  zoning: "Zoning & UDC Code",
  procedure: "Public Comment & Procedure",
  housing: "Housing, Plats & Subdivisions",
  safety: "Public Safety, Police & Fire",
  contracts: "Contracts, Bids & LEADS",
  infrastructure: "Stormwater, Roads & Parks",
};

// ============================================================================
// 1. FACEBOOK POST & SPEAKER CLIP DOWNLOAD STUDIO MODAL
// ============================================================================
export function FacebookShareModal({
  turn,
  speaker,
  onClose,
}: {
  turn: SpeakerTurn;
  speaker?: SpeakerProfile | null;
  onClose: () => void;
}) {
  const sharePageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/speakers?speaker=${encodeURIComponent(turn.speakerSlug)}&turn=${turn.id}`
      : `https://therealwindycity.github.io/real-windy-city-tv/?speaker=${encodeURIComponent(turn.speakerSlug)}`;

  const defaultCaption = useMemo(() => {
    const emo = EMOTION_META[turn.emotion] ?? EMOTION_META.impactful;
    const ordTxt = turn.ordinances.length
      ? `\n📜 Ordinance Arc: ${turn.ordinances.map((o) => `${o.slug} (${o.stage} reading)`).join(", ")}`
      : "";
    return [
      `${emo.icon} ${turn.speakerName} (${turn.speakerRole}) at Cheyenne ${turn.bodyName} — ${turn.date} [${turn.hms}]`,
      ``,
      `“${turn.text.slice(0, 320)}${turn.text.length > 320 ? "…" : ""}”`,
      ordTxt,
      `🎥 Verified Primary-Source Video & Supporting Documents:`,
      sharePageUrl,
      ``,
      `#CheyenneWY #TheRealWindyCity #PublicRecord #Wyoming #CityCouncil ${turn.themes.map((t) => `#${t}`).join(" ")}`,
    ]
      .filter((x) => x !== null)
      .join("\n");
  }, [turn, sharePageUrl]);

  const [caption, setCaption] = useState(defaultCaption);
  const [copied, setCopied] = useState(false);

  const fbShareHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePageUrl)}&quote=${encodeURIComponent(caption)}`;
  const zipHref = `/api/speakers/${encodeURIComponent(turn.speakerSlug)}/bundle`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-sky-400/30 bg-[#080d19] p-5 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-sky-400">Facebook Civic Video & Clip Studio</div>
            <h3 className="text-lg font-black">
              {turn.speakerName} · {turn.date} ({Math.round(turn.durationSec)}s clip)
            </h3>
          </div>
          <button onClick={onClose} className="rounded bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20">
            ✕ Close
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div className="rounded-xl border border-white/10 bg-black/50 p-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Step 1 · Download Video Clip or Full Speaker Pack (Ready for Facebook Video / Reels Upload)</span>
              <span className="font-mono text-emerald-300">{Math.round(turn.durationSec)}s (&le; 3 min public comment window)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {turn.directMp4Url && (
                <a
                  href={turn.directMp4Url}
                  download={`${turn.date}_${turn.speakerSlug}_turn${turn.id}.mp4`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-500 px-3.5 py-2 font-black text-black hover:bg-emerald-400"
                >
                  ⬇ Download Standalone Clip (.MP4)
                </a>
              )}
              <a
                href={zipHref}
                download
                className="rounded-lg bg-amber-400 px-3.5 py-2 font-black text-black hover:bg-amber-300"
              >
                📦 Download Entire Speaker&apos;s Clips (.ZIP{speaker ? ` · ${speaker.turnCount} turns` : ""})
              </a>
              {turn.speakerZipUrl && (
                <a
                  href={turn.speakerZipUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-white/10 px-3 py-2 font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
                >
                  ⬇ GitHub Release Speaker .ZIP
                </a>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/50 p-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Step 2 · Copy Verified Facebook Caption (Editable — Includes Verbatim Quote & Provenance Link)</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(caption);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
                className="rounded bg-sky-500/20 px-2.5 py-1 font-bold text-sky-300 ring-1 ring-sky-400/40 hover:bg-sky-500/30"
              >
                {copied ? "✓ Copied to Clipboard!" : "📋 Copy Post Text"}
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-white/15 bg-[#050811] p-2.5 font-mono text-xs text-slate-200 outline-none focus:border-sky-400"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-400">
              Tip: Copy caption above, upload the downloaded <code>.mp4</code> directly to Facebook for maximum native video reach, or share link directly:
            </span>
            <a
              href={fbShareHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => navigator.clipboard.writeText(caption).catch(() => undefined)}
              className="rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-black text-white shadow-lg hover:bg-[#166fe5]"
            >
              📘 Post / Share on Facebook ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. INLINE <=3-MIN SPEAKER TURN VIDEO PLAYER & WORKBENCH
// ============================================================================
export function SpeakerTurnPlayerCard({
  turn,
  autoPlay = false,
  onEnded,
  onShareFb,
}: {
  turn: SpeakerTurn;
  autoPlay?: boolean;
  onEnded?: () => void;
  onShareFb: (t: SpeakerTurn) => void;
}) {
  const [playing, setPlaying] = useState(autoPlay);
  const emo = EMOTION_META[turn.emotion] ?? EMOTION_META.technical;

  useEffect(() => {
    if (autoPlay) setPlaying(true);
  }, [autoPlay, turn.id]);

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#080e1a] p-3.5 shadow-lg transition hover:border-sky-500/40">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/speakers?speaker=${encodeURIComponent(turn.speakerSlug)}`}
              className="font-black text-white hover:text-amber-300 hover:underline"
            >
              🎙️ {turn.speakerName}
            </Link>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{turn.speakerRole}</span>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${emo.badge}`}>
            {emo.icon} {emo.label} · {turn.impactScore}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <Link href={`/episode/${turn.meetingSlug}`} className="font-mono text-sky-300 hover:underline">
            {turn.date} · {turn.bodyName}
          </Link>
          <span>·</span>
          <span className="font-mono text-amber-300">
            {turn.hms} ({Math.round(turn.durationSec)}s)
          </span>
          {turn.ordinances.map((o) => (
            <Link
              key={o.slug + o.stage}
              href={`/ordinance/${o.slug}`}
              className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200 ring-1 ring-violet-400/30 hover:bg-violet-500/30"
            >
              📜 Ord ({o.stage})
            </Link>
          ))}
        </div>

        {/* Video stage */}
        <div className="mt-2.5 overflow-hidden rounded-lg border border-white/10 bg-black">
          {!playing ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="flex h-36 w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-900 via-[#0b1528] to-black text-center hover:from-slate-800"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-400 text-lg font-black text-black shadow-lg">
                ▶
              </span>
              <span className="text-xs font-bold text-slate-200">
                Play {Math.round(turn.durationSec)}s Speaker Turn Clip ({turn.hms})
              </span>
              <span className="text-[10px] text-slate-400">
                {turn.directMp4Url ? "Direct Verbatim MP4 Clip" : turn.youtubeId ? "Timestamped Official Tape Cue" : "Archive.org Ch192 Stream Cue"}
              </span>
            </button>
          ) : turn.directMp4Url ? (
            <video
              key={turn.directMp4Url + turn.startSec}
              src={turn.directMp4Url.includes("#t=") ? turn.directMp4Url : `${turn.directMp4Url}#t=${turn.startSec},${turn.endSec}`}
              controls
              autoPlay
              onEnded={onEnded}
              className="h-48 w-full bg-black object-contain"
            />
          ) : turn.youtubeId ? (
            <iframe
              title={`${turn.speakerName} ${turn.hms}`}
              src={`https://www.youtube.com/embed/${turn.youtubeId}?start=${Math.floor(turn.startSec)}&end=${Math.ceil(turn.endSec)}&autoplay=1`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-48 w-full border-0"
            />
          ) : turn.embedUrl ? (
            <iframe
              title={`${turn.speakerName} ${turn.hms}`}
              src={turn.embedUrl}
              allowFullScreen
              className="h-48 w-full border-0"
            />
          ) : (
            <div className="p-4 text-center text-xs text-slate-400">Primary transcript record verified; open parent episode for full broadcast stream.</div>
          )}
        </div>

        <p className="mt-2.5 line-clamp-4 text-xs leading-relaxed text-slate-200">&ldquo;{turn.text}&rdquo;</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-white/10 pt-2.5 text-[11px]">
        <div className="flex flex-wrap gap-1">
          {turn.themes.map((th) => (
            <Link
              key={th}
              href={`/speakers?theme=${encodeURIComponent(th)}`}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
            >
              #{th}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {turn.directMp4Url && (
            <a
              href={turn.directMp4Url}
              download
              target="_blank"
              rel="noreferrer"
              className="rounded bg-emerald-500/20 px-2 py-1 font-bold text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-500/30"
            >
              ⬇ MP4
            </a>
          )}
          <a
            href={`/api/speakers/${encodeURIComponent(turn.speakerSlug)}/bundle`}
            className="rounded bg-amber-400/20 px-2 py-1 font-bold text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-400/30"
            title="Download all historical clips & Facebook captions for this speaker"
          >
            📦 All Speaker Clips
          </a>
          <button
            type="button"
            onClick={() => onShareFb(turn)}
            className="rounded bg-[#1877F2] px-2.5 py-1 font-bold text-white hover:bg-[#166fe5]"
          >
            📘 Post to FB
          </button>
        </div>
      </div>
    </div>
  );
}

export function EpisodeSpeakersLens({ b }: { b: EpisodeBundle }) {
  const [emoFilter, setEmoFilter] = useState<string>("");
  const [themeFilter, setThemeFilter] = useState<string>("");
  const [fbTurn, setFbTurn] = useState<SpeakerTurn | null>(null);
  const [playlistIdx, setPlaylistIdx] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      b.speakerTurns.filter(
        (t) => (!emoFilter || t.emotion === emoFilter) && (!themeFilter || t.themes.includes(themeFilter)),
      ),
    [b.speakerTurns, emoFilter, themeFilter],
  );

  const zipLinks = b.meeting.extraLinks.filter((l) => l.kind === "speaker_zips" || l.kind === "speaker_zip_asset");

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-amber-400/30 bg-[#080f1d] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
              🎙️ Speaker Turn Video Database · {b.meeting.date}
            </div>
            <h3 className="text-lg font-black text-white">
              {b.speakerTurns.length} Individual Speaker Turns · Organized by Emotion, Theme & Ordinance
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {filtered.length > 0 && (
              <button
                type="button"
                onClick={() => setPlaylistIdx(0)}
                className="rounded-lg bg-amber-400 px-3.5 py-2 font-black text-black hover:bg-amber-300"
              >
                ▶ Play All {filtered.length} Turns Back-to-Back
              </button>
            )}
            <Link
              href={`/speakers?date=${encodeURIComponent(b.meeting.date)}`}
              className="rounded-lg bg-white/10 px-3 py-2 font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              Open Global Historical Speaker Vault ↗
            </Link>
          </div>
        </div>

        {zipLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3 text-xs">
            <span className="self-center text-[11px] font-bold text-emerald-300">GitHub Speaker .ZIP Releases:</span>
            {zipLinks.slice(0, 8).map((z, i) => (
              <a
                key={i}
                href={z.url}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25"
              >
                ⬇ {z.label}
              </a>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <button
            onClick={() => setEmoFilter("")}
            className={`rounded-full px-2.5 py-1 ${!emoFilter ? "bg-amber-400 font-bold text-black" : "bg-white/10 text-slate-300"}`}
          >
            All Emotions ({b.speakerTurns.length})
          </button>
          {Object.entries(EMOTION_META).map(([k, m]) => {
            const cnt = b.speakerTurns.filter((t) => t.emotion === k).length;
            if (!cnt) return null;
            return (
              <button
                key={k}
                onClick={() => setEmoFilter(emoFilter === k ? "" : k)}
                className={`rounded-full px-2.5 py-1 ${emoFilter === k ? "bg-amber-400 font-bold text-black" : "bg-white/10 text-slate-300"}`}
              >
                {m.icon} {m.label.split("/")[0].trim()} ({cnt})
              </button>
            );
          })}
          <select
            value={themeFilter}
            onChange={(e) => setThemeFilter(e.target.value)}
            className="ml-auto rounded border border-white/15 bg-[#050912] px-2.5 py-1 text-xs text-slate-200"
          >
            <option value="">All Civic Themes</option>
            {Object.entries(THEME_LABELS).map(([k, lbl]) => (
              <option key={k} value={k}>
                {lbl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {playlistIdx !== null && filtered[playlistIdx] && (
        <div className="rounded-xl border-2 border-amber-400 bg-black p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-bold text-amber-300">
              ▶ Continuous Turn Playlist: Clip {playlistIdx + 1} of {filtered.length} — {filtered[playlistIdx].speakerName} ({filtered[playlistIdx].hms})
            </span>
            <div className="flex gap-2">
              <button
                disabled={playlistIdx === 0}
                onClick={() => setPlaylistIdx((i) => Math.max(0, (i ?? 0) - 1))}
                className="rounded bg-white/10 px-2 py-1 disabled:opacity-40"
              >
                ⏮ Prev
              </button>
              <button
                disabled={playlistIdx >= filtered.length - 1}
                onClick={() => setPlaylistIdx((i) => Math.min(filtered.length - 1, (i ?? 0) + 1))}
                className="rounded bg-white/10 px-2 py-1 disabled:opacity-40"
              >
                Next ⏭
              </button>
              <button onClick={() => setPlaylistIdx(null)} className="rounded bg-rose-500/20 px-2 py-1 text-rose-200">
                ✕ Stop
              </button>
            </div>
          </div>
          <SpeakerTurnPlayerCard
            turn={filtered[playlistIdx]}
            autoPlay
            onEnded={() => {
              if (playlistIdx < filtered.length - 1) setPlaylistIdx(playlistIdx + 1);
            }}
            onShareFb={setFbTurn}
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((t) => (
            <SpeakerTurnPlayerCard key={t.id} turn={t} onShareFb={setFbTurn} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-300">
          No speaker turns match the active filter on this sitting date.{" "}
          <Link href="/speakers" className="text-amber-300 underline">
            Browse all 2,483 historical speaker turns across 246 Cheyenne speakers →
          </Link>
        </div>
      )}

      {fbTurn && <FacebookShareModal turn={fbTurn} onClose={() => setFbTurn(null)} />}
    </div>
  );
}

// ============================================================================
// 3. PALANTIR FOUNDRY AGENDAS & SUPPORTING DOCUMENTS WORKBENCH
// ============================================================================
export function FoundryLensView({ b }: { b: EpisodeBundle }) {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocMeta | null>(b.docs[0] ?? null);
  const [viewMode, setViewMode] = useState<"pdf" | "text" | "ocr">("pdf");
  const [docBody, setDocBody] = useState<string>("");
  const [ocrPages, setOcrPages] = useState<Record<string, string> | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  const filteredDocs = useMemo(() => {
    return b.docs.filter((d) => {
      if (roleFilter === "ocr" && !d.ocr) return false;
      if (roleFilter !== "all" && roleFilter !== "ocr" && d.role !== roleFilter) return false;
      if (q && !`${d.title} ${d.role} ${d.itemNo} ${d.sha1 ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [b.docs, roleFilter, q]);

  useEffect(() => {
    if (!selectedDoc) return;
    setLoadingText(true);
    setOcrPages(null);
    fetch(`/api/documents/${selectedDoc.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDocBody(d?.body ?? "No inline text stored; inspect raw PDF stream or SHA-1 OCR tab."))
      .catch(() => setDocBody("Failed to fetch document body."))
      .finally(() => setLoadingText(false));

    if (selectedDoc.ocr && selectedDoc.sha1) {
      fetch(`https://raw.githubusercontent.com/therealwindycity/TheReelWindyCity/main/ai-record-ocr/${selectedDoc.sha1}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j && typeof j === "object") setOcrPages(j);
        })
        .catch(() => undefined);
    }
  }, [selectedDoc]);

  const suppClip = b.provenanceFilms?.chapters.find((c) => c.ledgerKey === "supporting_documents");

  return (
    <div className="bg-[#050912] p-3 font-sans text-slate-200">
      {/* Foundry Tactical Telemetry Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-sky-500/30 bg-[#091224] px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-sky-300 ring-1 ring-sky-400/40">
            FOUNDRY // ONTOLOGY VAULT
          </span>
          <span className="font-mono text-xs text-slate-300">
            EPISODE_OBJECTS={b.docs.length} · OCR_INDEXED={b.docs.filter((d) => d.ocr).length} · FACTS={b.briefs.reduce((s, x) => s + Object.keys(x.facts).length, 0)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/documents"
            className="rounded border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-sky-200 hover:bg-sky-500/25"
          >
            SEARCH ALL 6,371 ARCHIVE PDFs (2008–2026) ↗
          </Link>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[310px_1fr_290px]">
        {/* Left Pane: Object Explorer Table */}
        <div className="flex max-h-[660px] flex-col rounded border border-slate-800 bg-[#080f1d]">
          <div className="border-b border-slate-800 p-2.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter packet objects, SHA-1…"
              className="w-full rounded border border-slate-700 bg-[#040811] px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-400"
            />
            <div className="mt-2 flex flex-wrap gap-1 font-mono text-[10px]">
              {[
                ["all", `ALL (${b.docs.length})`],
                ["agenda", "AGENDAS"],
                ["attachment", "SUPPORTING PDF"],
                ["staff_report", "STAFF RPT"],
                ["minutes", "MINUTES/TX"],
                ["ocr", `SHA1-OCR (${b.docs.filter((d) => d.ocr).length})`],
              ].map(([k, lbl]) => (
                <button
                  key={k}
                  onClick={() => setRoleFilter(k)}
                  className={`rounded px-1.5 py-0.5 ${roleFilter === k ? "bg-sky-400 font-bold text-black" : "bg-slate-900 text-slate-400 hover:text-white"}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 divide-y divide-slate-800/80 overflow-y-auto">
            {filteredDocs.map((d) => {
              const active = selectedDoc?.id === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDoc(d)}
                  className={`w-full p-2.5 text-left transition ${active ? "border-l-2 border-l-sky-400 bg-sky-500/15" : "hover:bg-white/5"}`}
                >
                  <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 uppercase text-sky-300">{d.role}</span>
                    <span className="text-slate-500">
                      {d.pages ? `${d.pages}p` : ""} {d.ocr ? "· 🔬OCR" : ""}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-100">{d.title}</div>
                  {d.sha1 && <div className="mt-1 truncate font-mono text-[10px] text-emerald-400/80">SHA1: {d.sha1.slice(0, 16)}…</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Pane: Embedded PDF / Text / Live SHA-1 OCR Forensic Viewer */}
        <div className="flex min-h-[540px] flex-col rounded border border-slate-800 bg-[#080f1d]">
          {selectedDoc ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0b1528] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-white">{selectedDoc.title}</div>
                  <div className="font-mono text-[10px] text-slate-400">
                    OBJ_ID={selectedDoc.id} · ITEM={selectedDoc.itemNo} · SHA1={selectedDoc.sha1 ?? "WAYBACK_REF"}
                  </div>
                </div>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <button
                    onClick={() => setViewMode("pdf")}
                    className={`rounded px-2.5 py-1 ${viewMode === "pdf" ? "bg-sky-400 font-bold text-black" : "bg-slate-800 text-slate-300"}`}
                  >
                    📄 PDF / Portal
                  </button>
                  <button
                    onClick={() => setViewMode("text")}
                    className={`rounded px-2.5 py-1 ${viewMode === "text" ? "bg-sky-400 font-bold text-black" : "bg-slate-800 text-slate-300"}`}
                  >
                    📝 Extracted Text
                  </button>
                  <button
                    onClick={() => setViewMode("ocr")}
                    className={`rounded px-2.5 py-1 ${viewMode === "ocr" ? "bg-emerald-400 font-bold text-black" : "bg-slate-800 text-slate-300"}`}
                  >
                    🔬 SHA-1 OCR {ocrPages ? `(${Object.keys(ocrPages).length}p)` : ""}
                  </button>
                  {selectedDoc.url && (
                    <a
                      href={selectedDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-amber-400/20 px-2 py-1 text-amber-300 ring-1 ring-amber-400/40 hover:bg-amber-400/30"
                    >
                      Raw ↗
                    </a>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {viewMode === "pdf" && selectedDoc.url ? (
                  selectedDoc.url.toLowerCase().includes(".pdf") ? (
                    <iframe
                      title={selectedDoc.title}
                      src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(selectedDoc.url)}`}
                      className="h-[520px] w-full rounded border border-slate-800 bg-white"
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded border border-sky-500/30 bg-sky-500/10 p-3 text-xs">
                        External Official PortalViewer URL:{" "}
                        <a href={selectedDoc.url} target="_blank" rel="noreferrer" className="font-mono text-sky-300 underline">
                          {selectedDoc.url}
                        </a>
                      </div>
                      <pre className="max-h-[450px] overflow-y-auto whitespace-pre-wrap rounded bg-[#040811] p-3 font-mono text-xs text-slate-200">
                        {loadingText ? "Loading extracted text…" : docBody}
                      </pre>
                    </div>
                  )
                ) : viewMode === "ocr" ? (
                  ocrPages ? (
                    <div className="space-y-3">
                      {Object.entries(ocrPages)
                        .sort((a, b) => Number(a[0]) - Number(b[0]))
                        .map(([pg, txt]) => (
                          <div key={pg} className="rounded border border-emerald-500/25 bg-[#040811] p-3">
                            <div className="mb-1 font-mono text-[10px] font-bold text-emerald-400">
                              PAGE {pg} · LIVE FETCH FROM TheReelWindyCity/ai-record-ocr/{selectedDoc.sha1}.json
                            </div>
                            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-200">{txt}</pre>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap rounded bg-[#040811] p-3 font-mono text-xs text-slate-300">
                      {docBody || "This document uses native digital text extraction rather than scanned image OCR."}
                    </pre>
                  )
                ) : (
                  <pre className="whitespace-pre-wrap rounded bg-[#040811] p-3 font-mono text-xs leading-relaxed text-slate-200">
                    {loadingText ? "Querying PostgreSQL documents table…" : docBody}
                  </pre>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Right Pane: Foundry Telemetry, Provenance Video Cue & Data Lineage DAG */}
        <div className="flex flex-col gap-3">
          {suppClip && (
            <div className="rounded border border-rose-500/30 bg-[#080f1d] p-2.5">
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] font-bold text-rose-300">
                <span>🎥 MANUAL-CLICK PROVENANCE CUE</span>
                <Link href="/provenance" className="underline">
                  All 14 Films ↗
                </Link>
              </div>
              <video
                src={suppClip.localUrl}
                controls
                preload="metadata"
                className="h-32 w-full rounded border border-slate-800 bg-black object-cover"
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                Screen recording showing the exact clicks required to manually retrieve Cheyenne Supporting Documents.
              </p>
            </div>
          )}

          <div className="rounded border border-slate-800 bg-[#080f1d] p-3">
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-sky-400">
              Deterministic Packet Telemetry
            </div>
            <div className="mt-2 max-h-52 space-y-2 overflow-y-auto text-xs">
              {b.briefs.map((br, idx) => (
                <div key={idx} className="rounded border border-slate-800 bg-[#040811] p-2">
                  <div className="font-bold text-slate-200">
                    Item {br.itemNo}: {br.title.slice(0, 75)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {br.flags.map((f, fi) => (
                      <span
                        key={fi}
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          f.sev === "HIGH" ? "bg-rose-500/25 text-rose-300" : f.sev === "MED" ? "bg-amber-500/25 text-amber-300" : "bg-sky-500/20 text-sky-300"
                        }`}
                      >
                        {f.sev}:{f.code}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-400">
                    {Object.entries(br.facts)
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <div key={k} className="truncate">
                          <span className="text-slate-500">{k}:</span> <span className="text-emerald-300">{v}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Foundry Pipeline Lineage DAG */}
          <div className="rounded border border-slate-800 bg-[#080f1d] p-3 font-mono text-[10px]">
            <div className="mb-2 font-bold uppercase tracking-widest text-emerald-400">Foundry Pipeline Lineage DAG</div>
            <div className="space-y-1.5">
              {[
                ["01. ORIGIN_PORTAL", "cheyennecity.org / Granicus / Ch192"],
                ["02. ARCHIVE_VAULT", "cheyenne-archives-* (Git Blob SHA-1)"],
                ["03. OCR_ENGINE", "ai-record-ocr/{sha1}.json (1,081 PDFs)"],
                ["04. RULE_COMPILER", "CivicWatch Facts + Severity Flags"],
                ["05. DUAL_SERVE", "PostgreSQL 17 + GitHub Pages Shards"],
              ].map(([step, desc]) => (
                <div key={step} className="rounded border border-slate-800 bg-[#040811] px-2 py-1.5">
                  <div className="font-bold text-sky-300">{step}</div>
                  <div className="text-slate-400">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. PALANTIR GOTHAM TACTICAL ENTITY-DOCUMENT LINK GRAPH
// ============================================================================
type GothamNode = {
  id: string;
  label: string;
  kind: "hub" | "official" | "ordinance" | "doc" | "money" | "speaker";
  x: number;
  y: number;
  color: string;
  detail: string;
  href?: string;
};

export function GothamGraphLensView({ b }: { b: EpisodeBundle }) {
  const [layer, setLayer] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string>("hub");

  const { nodes, edges } = useMemo(() => {
    const cx = 420;
    const cy = 260;
    const ns: GothamNode[] = [
      {
        id: "hub",
        label: `${b.show.code} · ${b.meeting.date}`,
        kind: "hub",
        x: cx,
        y: cy,
        color: "#fbbf24",
        detail: `${b.show.title} — ${b.items.length} docket items, ${b.docs.length} primary documents, ${b.speakerTurns.length} speaker turns.`,
      },
    ];
    const es: { from: string; to: string; label: string }[] = [];

    const ring = <T,>(arr: T[], radius: number, startAngle: number, spanAngle: number, mapFn: (item: T, idx: number, x: number, y: number) => GothamNode) => {
      arr.forEach((item, idx) => {
        const ang = startAngle + (arr.length > 1 ? (idx / (arr.length - 1)) * spanAngle : spanAngle / 2);
        const x = Math.round(cx + Math.cos(ang) * radius);
        const y = Math.round(cy + Math.sin(ang) * radius);
        const node = mapFn(item, idx, x, y);
        ns.push(node);
        es.push({ from: "hub", to: node.id, label: node.kind.toUpperCase() });
      });
    };

    // Ordinances & substantive items
    const ords: { title: string; sub: string; href?: string }[] = b.series.length
      ? b.series.slice(0, 5).map((o) => ({ title: o.title, sub: `${o.kind} (${o.readings.length} readings)`, href: `/ordinance/${o.slug}` }))
      : b.items
          .filter((i) => i.kind !== "procedural")
          .slice(0, 5)
          .map((i) => ({ title: `Item ${i.itemNo}: ${i.title}`, sub: i.action || i.kind }));
    ring(ords, 175, -Math.PI * 0.9, Math.PI * 0.7, (o, idx, x, y) => ({
      id: `ord-${idx}`,
      label: o.title.slice(0, 28) + "…",
      kind: "ordinance",
      x,
      y,
      color: "#38bdf8",
      detail: `${o.title} — ${o.sub}`,
      href: o.href,
    }));

    // Supporting PDFs & Documents
    ring(b.docs.slice(0, 6), 215, -Math.PI * 0.15, Math.PI * 0.75, (d, idx, x, y) => ({
      id: `doc-${d.id}`,
      label: d.title.replace(/^\[[^\]]+\]\s*/, "").slice(0, 24) + "…",
      kind: "doc",
      x,
      y,
      color: "#10b981",
      detail: `[${d.role.toUpperCase()}] ${d.title} · SHA1: ${d.sha1 ?? "Wayback"}`,
      href: d.url ?? undefined,
    }));

    // Money / Contracts
    ring(b.analytics.amounts.slice(0, 4), 165, Math.PI * 0.65, Math.PI * 0.45, (m, idx, x, y) => ({
      id: `usd-${idx}`,
      label: `$${Math.round(m.amount).toLocaleString()}`,
      kind: "money",
      x,
      y,
      color: "#84cc16",
      detail: `Item ${m.itemNo}: $${Math.round(m.amount).toLocaleString()} — ${m.title}`,
    }));

    // Officials / Sponsors / Dissenters
    const officials = [
      ...b.analytics.dissent.map((d) => ({ name: `${d.name} (${d.n} NO)`, role: "Dissenter on Roll Call" })),
      ...b.analytics.sponsors.map((s) => ({ name: s.name, role: `Sponsor (${s.n} items)` })),
    ].slice(0, 5);
    ring(officials, 225, Math.PI * 1.15, Math.PI * 0.45, (o, idx, x, y) => ({
      id: `off-${idx}`,
      label: o.name.slice(0, 22),
      kind: "official",
      x,
      y,
      color: "#a855f7",
      detail: `${o.name} — ${o.role}`,
    }));

    // Speaker Video Turns
    const uniqSpk = Array.from(new Map(b.speakerTurns.map((t) => [t.speakerSlug, t])).values()).slice(0, 5);
    ring(uniqSpk, 130, 0, Math.PI * 1.6, (s, idx, x, y) => ({
      id: `spk-${idx}`,
      label: `🎙️ ${s.speakerName.slice(0, 18)}`,
      kind: "speaker",
      x,
      y,
      color: "#f43f5e",
      detail: `${s.speakerName} (${s.speakerRole}) — "${s.text.slice(0, 160)}…"`,
      href: `/speakers?speaker=${encodeURIComponent(s.speakerSlug)}`,
    }));

    return { nodes: ns, edges: es };
  }, [b]);

  const visibleNodes = nodes.filter((n) => layer === "all" || n.kind === "hub" || n.kind === layer);
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const selected = nodes.find((n) => n.id === selectedId) ?? nodes[0];

  return (
    <div className="bg-[#050912] p-3 text-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-500/30 bg-[#081518] px-3.5 py-2">
        <div className="font-mono text-xs">
          <span className="font-bold text-emerald-400">GOTHAM // LINK-ANALYSIS GRAPH</span> · NODES={visibleNodes.length} · EDGES={edges.filter((e) => visibleIds.has(e.to)).length}
        </div>
        <div className="flex flex-wrap gap-1 font-mono text-[10px]">
          {[
            ["all", "ALL LAYERS"],
            ["ordinance", "📜 ORDINANCES"],
            ["doc", "📄 SUPPORTING PDFs"],
            ["money", "💵 FISCAL FLOWS"],
            ["official", "🏛️ SPONSORS/DISSENT"],
            ["speaker", "🎙️ SPEAKER VIDEOS"],
          ].map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setLayer(k)}
              className={`rounded px-2 py-1 ${layer === k ? "bg-emerald-400 font-bold text-black" : "bg-slate-900 text-slate-300"}`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded border border-slate-800 bg-[#04070e]">
          <svg viewBox="0 0 840 520" className="h-[480px] w-full select-none">
            <defs>
              <pattern id="gothamGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#0f172a" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="840" height="520" fill="url(#gothamGrid)" />
            {edges
              .filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to))
              .map((e, idx) => {
                const a = nodes.find((n) => n.id === e.from)!;
                const t = nodes.find((n) => n.id === e.to)!;
                return (
                  <line
                    key={idx}
                    x1={a.x}
                    y1={a.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={selectedId === t.id ? "#38bdf8" : "#1e293b"}
                    strokeWidth={selectedId === t.id ? 2.4 : 1.2}
                    strokeDasharray={t.kind === "doc" ? "4 3" : undefined}
                  />
                );
              })}
            {visibleNodes.map((n) => {
              const isSel = n.id === selectedId;
              return (
                <g key={n.id} onClick={() => setSelectedId(n.id)} className="cursor-pointer">
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.kind === "hub" ? 22 : isSel ? 15 : 11}
                    fill="#091120"
                    stroke={n.color}
                    strokeWidth={isSel ? 3.5 : 2}
                  />
                  <text x={n.x} y={n.y + (n.kind === "hub" ? 35 : 24)} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontFamily="monospace">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col justify-between rounded border border-slate-800 bg-[#080f1d] p-4">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Selected Ontology Entity
            </div>
            <div className="mt-2 inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase text-black" style={{ backgroundColor: selected.color }}>
              {selected.kind}
            </div>
            <h4 className="mt-2 text-base font-black text-white">{selected.label}</h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{selected.detail}</p>
            {selected.href && (
              <a
                href={selected.href}
                target={selected.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="mt-4 inline-block rounded bg-sky-400 px-3 py-2 text-xs font-black text-black hover:bg-sky-300"
              >
                Inspect Linked Dossier / PDF →
              </a>
            )}
          </div>
          <div className="mt-6 border-t border-slate-800 pt-3 font-mono text-[10px] text-slate-400">
            Click any node on the canvas to inspect its statutory receipts, SHA-1 packet PDFs, or historical speaker video turns.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. PROVENANCE SCREEN-RECORDING FILMS & 121-ROW CLICK-PATH LEDGER
// ============================================================================
export function ProvenanceFilmsWorkbench({ catalog }: { catalog: ProvenanceCatalogData | null }) {
  const [activeVideo, setActiveVideo] = useState<{ title: string; url: string; desc: string } | null>(
    catalog?.masterFilms[0]
      ? {
          title: catalog.masterFilms[0].title,
          url: catalog.masterFilms[0].localUrl,
          desc: catalog.masterFilms[0].description,
        }
      : null,
  );
  const [ledgerQ, setLedgerQ] = useState("");

  if (!catalog) {
    return <div className="p-6 text-sm text-slate-400">Provenance film catalog loading…</div>;
  }

  const allLedgerRows = catalog.chapters.flatMap((c) => c.ledgerRows.map((r) => ({ ...r, chapterTitle: c.title, clipUrl: c.localUrl })));
  const filteredRows = allLedgerRows.filter(
    (r) => !ledgerQ || `${r.key} ${r.item} ${r.how ?? ""} ${r.origin?.url ?? ""}`.toLowerCase().includes(ledgerQ.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-4 text-slate-100">
      {/* Summary Banner */}
      <div className="rounded-2xl border border-rose-400/30 bg-gradient-to-r from-[#140914] via-[#0b1222] to-[#08141c] p-5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-rose-300">
          🎥 Screen-Recorded Manual Click-Path Provenance Suite
        </div>
        <h2 className="mt-1 text-2xl font-black">
          Every Public Portal, Every Manual Browser Click, Recorded on Tape
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
          Nothing in this archive is taken on faith. Watch the actual screen-recorded browser walkthroughs showing what a human had to click on{" "}
          <code>cheyennecity.org</code>, <code>cheyenne.granicus.com</code>, and public repositories to download each calendar, agenda packet, supporting PDF, clerk minute, and broadcast video by hand.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
          {[
            [catalog.summaryStats.totalFilesAudited.toLocaleString(), "Files Audited"],
            [String(catalog.summaryStats.recordFamilies), "Record Families"],
            [catalog.summaryStats.publicSiteCaptures.toLocaleString(), "Public Captures"],
            [String(catalog.summaryStats.originHosts), "Origin Portals"],
            [String(catalog.summaryStats.unaccountedFiles), "Unaccounted Files"],
            [catalog.summaryStats.manualEquivalentEstimate, "Manual Click Work"],
          ].map(([big, lbl]) => (
            <div key={lbl} className="rounded-xl border border-white/10 bg-black/40 p-2.5 text-center">
              <div className="font-mono text-lg font-black text-amber-300">{big}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Screen-Recording Theater */}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-white/15 bg-black p-4">
          {activeVideo && (
            <>
              <video
                key={activeVideo.url}
                src={activeVideo.url}
                poster={catalog.masterFilms[0]?.posterUrl}
                controls
                className="aspect-video w-full rounded-xl border border-white/10 bg-black"
              />
              <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-white">{activeVideo.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{activeVideo.desc}</p>
                </div>
                <a
                  href={activeVideo.url}
                  download
                  className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-black text-white hover:bg-rose-400"
                >
                  ⬇ Download MP4
                </a>
              </div>
            </>
          )}

          {/* 3 Master Films */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {catalog.masterFilms.map((mf) => (
              <button
                key={mf.id}
                type="button"
                onClick={() => setActiveVideo({ title: mf.title, url: mf.localUrl, desc: mf.description })}
                className={`rounded-xl border p-2.5 text-left text-xs transition ${
                  activeVideo?.url === mf.localUrl ? "border-rose-400 bg-rose-500/20" : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="font-mono text-[10px] text-rose-300">
                  MASTER FILM · {mf.durationSec}s · {mf.sizeMb} MB
                </div>
                <div className="mt-0.5 line-clamp-2 font-bold text-white">{mf.title}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 11 Per-Record-Family Manual Click Chapters */}
        <div className="flex max-h-[540px] flex-col rounded-2xl border border-white/15 bg-[#080f1d] p-3.5">
          <div className="mb-2 text-xs font-black uppercase tracking-wider text-sky-300">
            11 Manual Click-Path Screen-Recording Chapters (~15s each)
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {catalog.chapters.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveVideo({ title: ch.title, url: ch.localUrl, desc: ch.description })}
                className={`w-full rounded-xl border p-2.5 text-left transition ${
                  activeVideo?.url === ch.localUrl ? "border-sky-400 bg-sky-500/20" : "border-white/10 bg-black/40 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-amber-300">
                  <span>▶ {ch.title}</span>
                  <span>{ch.durationSec}s</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-300">{ch.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Investigative Supercuts & Screening Room */}
      <div className="rounded-2xl border border-white/10 bg-[#080f1d] p-4">
        <div className="mb-3 text-xs font-black uppercase tracking-wider text-amber-300">
          🎞️ Verified Floor-Tape Supercuts & Contradiction Reels
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.investigativeReels.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveVideo({ title: r.title, url: r.url, desc: "Rendered directly from unedited City of Cheyenne broadcast tape & statutory exhibit cards." })}
              className="rounded-xl border border-white/10 bg-black/50 p-3 text-left text-xs hover:border-amber-400/50"
            >
              <div className="font-mono text-[10px] text-amber-300">▶ FLOOR REEL · {r.duration}</div>
              <div className="mt-1 font-bold text-white">{r.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Searchable Manual Click-Path Ledger */}
      <div className="rounded-2xl border border-white/10 bg-[#080f1d] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-300">
              Manual Click-Path Verification Ledger ({allLedgerRows.length} Verified Datum Paths)
            </h3>
            <p className="text-xs text-slate-400">Follow the literal click sequence below to re-fetch any public record yourself in two minutes.</p>
          </div>
          <input
            value={ledgerQ}
            onChange={(e) => setLedgerQ(e.target.value)}
            placeholder="Filter click paths (e.g. supporting, granicus, minutes)…"
            className="w-72 rounded border border-white/15 bg-black/60 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
          />
        </div>
        <div className="mt-3 max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#050912] font-mono text-[10px] uppercase text-slate-400">
              <tr>
                <th className="p-2">Datum / Family</th>
                <th className="p-2">Count</th>
                <th className="p-2">Literal Manual Click-Path</th>
                <th className="p-2">Film Cue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredRows.slice(0, 60).map((r) => (
                <tr key={r.key} className="hover:bg-white/5">
                  <td className="p-2 font-mono text-[11px] text-sky-300">
                    <div>{r.key}</div>
                    {r.origin?.url && (
                      <a href={r.origin.url} target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 underline">
                        {r.origin.host} ↗
                      </a>
                    )}
                  </td>
                  <td className="p-2 font-mono font-bold text-amber-300">{String(r.value)}</td>
                  <td className="p-2 text-[11px] text-slate-300">{r.how ?? "Verified checkout artifact"}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => setActiveVideo({ title: r.chapterTitle, url: r.clipUrl, desc: r.how ?? "" })}
                      className="rounded bg-rose-500/20 px-2 py-1 font-mono text-[10px] font-bold text-rose-200 hover:bg-rose-500/30"
                    >
                      ▶ Watch Clicks
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
