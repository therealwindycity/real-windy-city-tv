"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function playBroadcastChime(isIntro: boolean) {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const freqs = isIntro ? [440, 554.37, 659.25] : [523.25, 392];
    freqs.forEach((f, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.09);
      g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + idx * 0.09 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + idx * 0.09);
      o.stop(ctx.currentTime + 1.5);
    });
    setTimeout(() => void ctx.close().catch(() => undefined), 1800);
  } catch {
    /* ignore autoplay audio policy */
  }
}

function fmtDurShort(sec: number) {
  const s = Math.max(1, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${String(rem).padStart(2, "0")}s` : `${rem}s`;
}

// ============================================================================
// 0. REUSABLE C-SPAN MARQUEE BORDER + INTRO + OUTRO + SYNCED CAPTIONS PLAYER
// ============================================================================
export function BrandedCspanVideoStage({
  turn,
  onEnded,
}: {
  turn: SpeakerTurn;
  onEnded?: () => void;
}) {
  const clampedDur = Math.min(180, Math.max(5, Math.round(turn.durationSec)));
  // If pre-rendered branded C-SPAN MP4 exists on CDN, it already has Intro + C-SPAN Border + Burned Captions + Outro!
  const hasPreburned = Boolean(turn.brandedMp4Url);
  const [phase, setPhase] = useState<"intro" | "body" | "outro">(hasPreburned ? "body" : "intro");
  const [ccOn, setCcOn] = useState(true);
  const [relSec, setRelSec] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const sa = turn.speakerAnalytics;
  const histClips = sa?.historicalClipCount ?? 1;
  const avgFmt = sa?.avgSpeakingFormatted ?? fmtDurShort(clampedDur);
  const poeCount = sa?.pointOfOrderCount ?? 0;

  const captionChunks = useMemo(() => {
    const words = (turn.text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!words.length) return ["Verbatim speaker segment from City of Cheyenne primary broadcast record."];
    const out: string[] = [];
    for (let i = 0; i < words.length; i += 12) {
      out.push(words.slice(i, i + 12).join(" "));
    }
    return out;
  }, [turn.text]);

  useEffect(() => {
    if (phase === "intro") {
      playBroadcastChime(true);
      const t = setTimeout(() => setPhase("body"), 2200);
      return () => clearTimeout(t);
    }
    if (phase === "outro") {
      playBroadcastChime(false);
      const t = setTimeout(() => {
        onEnded?.();
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [phase, onEnded]);

  // Timer fallback for iframe/YouTube caption sync & strict <=180s stop
  useEffect(() => {
    if (phase !== "body" || hasPreburned) return;
    if (turn.directMp4Url || turn.sourceMeetingMp4Url) return;
    const iv = setInterval(() => {
      setRelSec((s) => {
        if (s + 0.5 >= clampedDur) {
          setPhase("outro");
          return clampedDur;
        }
        return s + 0.5;
      });
    }, 500);
    return () => clearInterval(iv);
  }, [phase, hasPreburned, turn.directMp4Url, turn.sourceMeetingMp4Url, clampedDur]);

  const activeCaption = useMemo(() => {
    const idx = Math.min(
      captionChunks.length - 1,
      Math.max(0, Math.floor((relSec / Math.max(1, clampedDur)) * captionChunks.length)),
    );
    return captionChunks[idx] ?? "";
  }, [captionChunks, relSec, clampedDur]);

  if (hasPreburned && turn.brandedMp4Url) {
    return (
      <div className="relative overflow-hidden rounded-lg border-2 border-amber-400/50 bg-[#050912]">
        <video
          key={turn.brandedMp4Url}
          src={`/api/clips/${turn.id}`}
          controls
          autoPlay
          onEnded={onEnded}
          className="aspect-video w-full bg-black object-contain"
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border-2 border-amber-400/50 bg-[#050912] text-white shadow-xl">
      {/* Top C-SPAN / The Real Windy City Broadcast Bar */}
      <div className="flex items-center justify-between border-b-2 border-amber-400 bg-[#09152b] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
        <span className="text-amber-300">[RWC] THE REAL WINDY CITY · CHEYENNE CIVIC BROADCAST</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-200">
            {turn.bodyName} · {turn.date} · [{turn.hms}]
          </span>
          <button
            type="button"
            onClick={() => setCcOn((v) => !v)}
            className={`rounded px-1.5 py-0.5 text-[9px] font-black ${ccOn ? "bg-amber-400 text-black" : "bg-white/15 text-slate-300"}`}
            title="Toggle Cleaned Broadcast Captions"
          >
            CC
          </button>
        </div>
      </div>

      {/* Main Viewport: Branded Intro -> Framed Speaker Segment -> Branded Outro */}
      <div className="relative flex aspect-video w-full items-center justify-center bg-[#040812]">
        {phase === "intro" ? (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#0b1930] via-[#050912] to-[#0b1930] px-4 text-center">
            <div className="rounded border-t-4 border-rose-500 bg-[#0a1326]/95 px-5 py-4 shadow-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-sky-300">
                OFFICIAL SPEAKER SEGMENT · MINUTES, PACKET &amp; OSINT VERIFIED
              </div>
              <div className="mt-1 text-xl font-black uppercase tracking-wide text-white">{turn.speakerName}</div>
              <div className="mt-1 text-xs text-slate-300">
                {turn.speakerRole} · Capacity: {turn.speakingCapacity ?? turn.speakerRole}
              </div>
              <div className="mt-2 font-mono text-[11px] font-bold text-amber-300">
                Historical Archive: {histClips} Clips · Avg Turn: {avgFmt} · Points of Order: {poeCount}
              </div>
            </div>
          </div>
        ) : phase === "outro" ? (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#0b1930] via-[#050912] to-[#0b1930] px-4 text-center">
            <div className="rounded border-t-4 border-amber-400 bg-[#0a1326]/95 px-5 py-4 shadow-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">END OF VERIFIED SPEAKER SEGMENT</div>
              <div className="mt-1 text-xl font-black uppercase tracking-wide text-white">THE REAL WINDY CITY</div>
              <div className="mt-1 text-xs text-slate-300">
                Official Clerk Minutes · Foundry Packet PDFs · Internet Archive Ch. 192 Broadcast
              </div>
              <div className="mt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRelSec(0);
                    setPhase("intro");
                  }}
                  className="rounded bg-amber-400 px-3 py-1 text-[11px] font-black text-black hover:bg-amber-300"
                >
                  ↻ Replay Branded Segment
                </button>
              </div>
            </div>
          </div>
        ) : turn.directMp4Url ? (
          <video
            ref={videoRef}
            key={turn.directMp4Url}
            src={turn.directMp4Url.split("#")[0]}
            controls
            autoPlay
            onTimeUpdate={(e) => {
              const ct = e.currentTarget.currentTime;
              setRelSec(ct);
              if (ct >= clampedDur) {
                e.currentTarget.pause();
                setPhase("outro");
              }
            }}
            onEnded={() => setPhase("outro")}
            className="h-full w-full bg-black object-contain"
          />
        ) : turn.sourceMeetingMp4Url ? (
          <video
            ref={videoRef}
            key={`${turn.sourceMeetingMp4Url}-${turn.startSec}`}
            src={`${turn.sourceMeetingMp4Url}#t=${turn.startSec},${turn.startSec + clampedDur}`}
            controls
            autoPlay
            onLoadedMetadata={(e) => {
              if (Math.abs(e.currentTarget.currentTime - turn.startSec) > 2) {
                e.currentTarget.currentTime = turn.startSec;
              }
            }}
            onTimeUpdate={(e) => {
              const ct = e.currentTarget.currentTime;
              if (ct < turn.startSec - 1) {
                e.currentTarget.currentTime = turn.startSec;
                return;
              }
              const elapsed = Math.max(0, ct - turn.startSec);
              setRelSec(elapsed);
              // STRICT SPEAKER-ONLY CLAMP: Stop immediately at end of speaker turn!
              if (ct >= turn.startSec + clampedDur) {
                e.currentTarget.pause();
                setPhase("outro");
              }
            }}
            onEnded={() => setPhase("outro")}
            className="h-full w-full bg-black object-contain"
          />
        ) : turn.youtubeId ? (
          <iframe
            title={`${turn.speakerName} ${turn.hms}`}
            src={`https://www.youtube.com/embed/${turn.youtubeId}?start=${Math.floor(turn.startSec)}&end=${Math.floor(turn.startSec) + clampedDur}&autoplay=1`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
            <div className="text-xs font-black uppercase tracking-widest text-amber-300">
              {turn.videoTiming === "removed" ? "Transcript Only — No Verified Video" : "Verbatim Broadcast Transcript Cue"}
            </div>
            {turn.videoTimingNote && <p className="mt-1 max-w-md text-[10px] text-slate-400">{turn.videoTimingNote}</p>}
            <p className="mt-2 max-w-md text-xs text-slate-200">&ldquo;{activeCaption}&rdquo;</p>
          </div>
        )}

        {/* Live Cleaned Captions Overlay */}
        {phase === "body" && ccOn && activeCaption && (
          <div className="pointer-events-none absolute inset-x-4 bottom-2 rounded bg-black/85 px-3 py-1.5 text-center text-xs font-semibold leading-snug text-white ring-1 ring-white/15">
            {activeCaption}
          </div>
        )}
      </div>

      {/* Bottom C-SPAN Lower-Third Chyron */}
      <div className="border-t-2 border-rose-700 bg-[#0a1931] px-2.5 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="text-xs font-black uppercase tracking-wide text-white">
            {turn.speakerName}{" "}
            <span className="text-[10px] font-bold text-amber-300">({turn.speakerRole})</span>
          </div>
          <span className="font-mono text-[10px] font-bold text-emerald-300">
            ARCHIVE: {histClips} CLIPS · AVG: {avgFmt} · POE: {poeCount} · SEG: {clampedDur}s
          </span>
        </div>
        <div className="mt-0.5 truncate text-[10px] font-semibold text-sky-200">
          CAPACITY: {(turn.speakingCapacity ?? turn.speakerRole).toUpperCase()} · STANCE:{" "}
          {(turn.stanceLabel ?? "FLOOR RECORD").toUpperCase()}
        </div>
      </div>

      {/* Bottom Scrolling "The Real Windy City" Marquee Info Ticker */}
      <div className="overflow-hidden border-t border-amber-400/60 bg-[#040811] py-1">
        <div className="whitespace-nowrap px-2 font-mono text-[10px] font-bold text-amber-300">
          THE REAL WINDY CITY · {turn.speakerName.toUpperCase()} · {histClips} HISTORICAL CLIPS · AVG SPEAKING TIME {avgFmt} ·{" "}
          {turn.representingOrg ? `REPRESENTING: ${turn.representingOrg.toUpperCase()} · ` : ""}
          MINUTES &amp; PACKET VERIFIED SEGMENT (&le;3 MIN)
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 1. FACEBOOK POST & STRICT SPEAKER-SEGMENT-ONLY DOWNLOAD STUDIO MODAL
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
  const clampedDur = Math.min(180, Math.max(5, Math.round(turn.durationSec)));
  const sa = turn.speakerAnalytics;
  const histClips = speaker?.turnCount ?? sa?.historicalClipCount ?? 1;
  const avgFmt = speaker?.analytics?.avgSpeakingFormatted ?? sa?.avgSpeakingFormatted ?? fmtDurShort(clampedDur);

  const sharePageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/speakers?speaker=${encodeURIComponent(turn.speakerSlug)}&turn=${turn.id}`
      : `https://therealwindycity.github.io/real-windy-city-tv/#/speakers/${encodeURIComponent(turn.speakerSlug)}`;

  const defaultCaption = useMemo(() => {
    const emo = EMOTION_META[turn.emotion] ?? EMOTION_META.impactful;
    const ordTxt = turn.ordinances.length
      ? `\n📜 Ordinance Arc: ${turn.ordinances.map((o) => `${o.slug} (${o.stage} reading)`).join(", ")}`
      : "";
    return [
      `${emo.icon} ${turn.speakerName} (${turn.speakerRole}) at Cheyenne ${turn.bodyName} — ${turn.date} [${turn.hms}]`,
      `🏛️ Capacity: ${turn.speakingCapacity ?? turn.speakerRole} · Stance: ${turn.stanceLabel ?? "Floor Record"}`,
      `📼 Speaker Historical Record: ${histClips} Clips · Avg Speaking Time: ${avgFmt} · Points of Order: ${sa?.pointOfOrderCount ?? 0}`,
      ``,
      `“${turn.text.slice(0, 300)}${turn.text.length > 300 ? "…" : ""}”`,
      ordTxt,
      `🎥 Watch All ${histClips} Historical Clips & OSINT Profile:`,
      sharePageUrl,
      ``,
      `#CheyenneWY #TheRealWindyCity #PublicRecord #Wyoming #CityCouncil ${turn.themes.map((t) => `#${t}`).join(" ")}`,
    ]
      .filter((x) => x !== null)
      .join("\n");
  }, [turn, sharePageUrl, histClips, avgFmt, sa?.pointOfOrderCount]);

  const [caption, setCaption] = useState(defaultCaption);
  const [copied, setCopied] = useState(false);

  const fbShareHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePageUrl)}&quote=${encodeURIComponent(caption)}`;
  // STRICTLY speaker-only C-SPAN branded segment MP4 — NEVER the full meeting video!
  const brandedSegmentDownloadHref = `/api/clips/${turn.id}?download=1`;
  const zipHref = `/api/speakers/${encodeURIComponent(turn.speakerSlug)}/bundle`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-sky-400/30 bg-[#080d19] p-5 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
              Facebook Branded C-SPAN Speaker Segment Studio (Speaker-Only &le;3 Min)
            </div>
            <h3 className="text-lg font-black">
              {turn.speakerName} · {turn.date} ({clampedDur}s Speaker Segment — Never Full Meeting)
            </h3>
          </div>
          <button onClick={onClose} className="rounded bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20">
            ✕ Close
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div className="rounded-xl border border-emerald-400/30 bg-black/50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <span>
                Step 1 · Download Branded C-SPAN Speaker Segment (Includes RWC Intro, C-SPAN Marquee Border, Cleaned Captions &amp; Outro)
              </span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono font-bold text-emerald-300">
                Strictly {clampedDur}s Speaker Clip Only
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={brandedSegmentDownloadHref}
                download={`RWC_${turn.date}_${turn.speakerSlug}_turn${turn.id}.mp4`}
                className="rounded-lg bg-emerald-500 px-3.5 py-2 font-black text-black hover:bg-emerald-400"
              >
                ⬇ Download Branded C-SPAN Speaker Clip (.MP4 · {clampedDur}s)
              </a>
              <a
                href={zipHref}
                download
                className="rounded-lg bg-amber-400 px-3.5 py-2 font-black text-black hover:bg-amber-300"
              >
                📦 Speaker OSINT &amp; Segment Pack (.ZIP · {histClips} Clips)
              </a>
              <Link
                href={`/speakers?speaker=${encodeURIComponent(turn.speakerSlug)}`}
                onClick={onClose}
                className="rounded-lg bg-white/10 px-3 py-2 font-bold text-sky-200 ring-1 ring-white/20 hover:bg-white/20"
              >
                📼 View All {histClips} Clips →
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/50 p-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Step 2 · Copy Verified Facebook Caption (Includes Speaker Analytics, Capacity, Stance &amp; Quote)</span>
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
              Upload the {clampedDur}s branded speaker <code>.mp4</code> above directly to Facebook Reels/Video, or share speaker clip link:
            </span>
            <a
              href={fbShareHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => navigator.clipboard.writeText(caption).catch(() => undefined)}
              className="rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-black text-white shadow-lg hover:bg-[#166fe5]"
            >
              📘 Post / Share Speaker Segment on Facebook ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. INLINE <=3-MIN SPEAKER TURN VIDEO PLAYER + HISTORICAL & OSINT ANALYTICS CARD
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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const emo = EMOTION_META[turn.emotion] ?? EMOTION_META.technical;

  useEffect(() => {
    if (autoPlay) setPlaying(true);
  }, [autoPlay, turn.id]);

  const sa = turn.speakerAnalytics;
  const histClips = sa?.historicalClipCount ?? 1;
  const histMtgs = sa?.historicalMeetingCount ?? 1;
  const avgFmt = sa?.avgSpeakingFormatted ?? fmtDurShort(turn.durationSec);
  const poeCount = sa?.pointOfOrderCount ?? (turn.hasPointOfOrder ? 1 : 0);
  const clampedDur = Math.min(180, Math.max(5, Math.round(turn.durationSec)));

  const stanceBadge =
    turn.stance === "oppose_challenge" || turn.stance === "procedural_point_of_order"
      ? "bg-rose-500/20 text-rose-200 ring-rose-400/40"
      : turn.stance === "support_lobby_for" || turn.stance === "sponsor_motion"
        ? "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40"
        : "bg-sky-500/20 text-sky-200 ring-sky-400/40";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#080e1a] p-3.5 shadow-lg transition hover:border-amber-400/40">
      <div>
        {/* Speaker Identity + Historical Clip Count Direct Link */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/speakers?speaker=${encodeURIComponent(turn.speakerSlug)}`}
              className="font-black text-white hover:text-amber-300 hover:underline"
            >
              🎙️ {turn.speakerName}
            </Link>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">{turn.speakerRole}</span>
          </div>
          <Link
            href={`/speakers?speaker=${encodeURIComponent(turn.speakerSlug)}`}
            className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black text-amber-200 ring-1 ring-amber-400/40 hover:bg-amber-400 hover:text-black"
            title={`View all ${histClips} historical video clips of ${turn.speakerName}`}
          >
            📼 {histClips} Historical Clips ({histMtgs} Mtgs) →
          </Link>
        </div>

        {/* Speaking Capacity, Stance, Avg Speaking Time & Point of Order Strip */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-semibold text-indigo-200 ring-1 ring-indigo-400/30">
            🏛️ Capacity: {turn.speakingCapacity ?? turn.speakerRole}
            {turn.representingOrg && turn.representingOrg !== turn.speakerRole ? ` · ${turn.representingOrg}` : ""}
          </span>
          <span className={`rounded px-2 py-0.5 font-bold ring-1 ${stanceBadge}`}>
            {turn.stanceLabel ?? "Floor Deliberation"}
          </span>
          <span className="rounded bg-slate-800/90 px-2 py-0.5 font-mono text-slate-200 ring-1 ring-white/10">
            ⏱️ Clip: {fmtDurShort(clampedDur)} · Avg Turn: {avgFmt}
          </span>
          {(turn.hasPointOfOrder || poeCount > 0) && (
            <Link
              href={`/speakers?speaker=${encodeURIComponent(turn.speakerSlug)}&poe=1`}
              className={`rounded px-2 py-0.5 font-bold ring-1 ${
                turn.hasPointOfOrder
                  ? "bg-rose-600/30 text-rose-200 ring-rose-400/60 hover:bg-rose-600/50"
                  : "bg-amber-500/15 text-amber-200 ring-amber-400/30 hover:bg-amber-500/25"
              }`}
            >
              ⚖️ {turn.hasPointOfOrder ? `${turn.pointOfOrderType ?? "Point of Order"} · ` : ""}POE Events: {poeCount}
            </Link>
          )}
        </div>

        {/* Episode Date + Ordinance Links + Emotion */}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/episode/${turn.meetingSlug}`} className="font-mono text-sky-300 hover:underline">
              {turn.date} · {turn.bodyName}
            </Link>
            <span>·</span>
            <span className="font-mono text-amber-300">Floor [{turn.hms}]</span>
            {turn.videoTiming === "removed" && (
              <span title={turn.videoTimingNote ?? ""} className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 ring-1 ring-slate-500/40">
                📄 Transcript only
              </span>
            )}
            {(turn.videoTiming === "diarized_window" || turn.speakerAttributionVerified === false) && (
              <span title={turn.videoTimingNote ?? ""} className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-amber-400/30">
                ⚠ Speaker unverified
              </span>
            )}
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
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${emo.badge}`}>
            {emo.icon} {emo.label.split("/")[0].trim()}
          </span>
        </div>

        {/* Branded C-SPAN Video Stage */}
        <div className="mt-2.5">
          {!playing ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="w-full overflow-hidden rounded-lg border border-amber-400/40 bg-[#050912] text-left shadow-md transition hover:border-amber-300"
            >
              <div className="flex items-center justify-between border-b border-amber-400/50 bg-[#09152b] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-300">
                <span>[RWC] THE REAL WINDY CITY · C-SPAN MARQUEE EDITION</span>
                <span className="font-mono text-slate-200">INTRO + CAPTIONS + OUTRO · {clampedDur}s</span>
              </div>
              <div className="flex h-32 flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-900 via-[#0b1528] to-black px-3 text-center hover:from-slate-800">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-400 text-base font-black text-black shadow-lg">
                  ▶
                </span>
                <span className="text-xs font-black text-white">
                  Play {clampedDur}s Branded C-SPAN Speaker Clip ({turn.hms})
                </span>
                <span className="text-[10px] text-sky-300">
                  {turn.brandedMp4Url
                    ? "✓ Pre-Rendered H.264 C-SPAN Broadcast Clip"
                    : turn.directMp4Url
                      ? "✓ Standalone Speaker Segment MP4"
                      : turn.sourceMeetingMp4Url
                        ? turn.videoTiming === "diarized_window"
                          ? "✓ Internet Archive Ch.192 Slice · speaker label unverified"
                          : "✓ Internet Archive Ch.192 Slice · timing verified against transcript"
                        : turn.youtubeId
                          ? "✓ City of Cheyenne YouTube original · same timestamp"
                          : "Transcript only · no verified recording at this moment"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-rose-700/80 bg-[#0a1931] px-2.5 py-1 text-[10px] font-bold text-slate-200">
                <span className="truncate">{turn.speakerName} · {turn.speakingCapacity ?? turn.speakerRole}</span>
                <span className="font-mono text-emerald-300">{histClips} Clips · Avg {avgFmt}</span>
              </div>
            </button>
          ) : (
            <BrandedCspanVideoStage turn={turn} onEnded={onEnded} />
          )}
        </div>

        {/* Cleaned Verbatim Excerpt */}
        <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-slate-200">&ldquo;{turn.text}&rdquo;</p>

        {/* Speaker Topic, Lobby/Oppose, Capacity & OSINT Analytics Summary Box */}
        {sa && (
          <div className="mt-2.5 rounded-lg border border-white/10 bg-black/45 p-2.5 text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="font-bold text-sky-300">
                📊 Speaker Topics, Stances, Capacities &amp; OSINT ({histClips} Historical Clips)
              </span>
              <button
                type="button"
                onClick={() => setShowAnalytics((v) => !v)}
                className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-white/20"
              >
                {showAnalytics ? "▴ Compact" : "▾ Full Topic / Lobby / OSINT Breakdown"}
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-slate-300">
              {sa.topTopics.map((tp, idx) => (
                <span key={idx} className="rounded bg-slate-800 px-1.5 py-0.5">
                  🏷️ {tp}
                </span>
              ))}
            </div>
            {showAnalytics && (
              <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2 text-[10px]">
                <div>
                  <span className="font-bold text-indigo-300">Capacities on Record: </span>
                  <span className="text-slate-200">{sa.capacitiesSummary.join(" · ")}</span>
                </div>
                {sa.lobbiesFor.length > 0 && (
                  <div>
                    <span className="font-bold text-emerald-300">Lobbies For / Supports / Sponsors: </span>
                    <span className="text-slate-200">{sa.lobbiesFor.join(" · ")}</span>
                  </div>
                )}
                {sa.opposes.length > 0 && (
                  <div>
                    <span className="font-bold text-rose-300">Opposes / Challenges / Dissents: </span>
                    <span className="text-slate-200">{sa.opposes.join(" · ")}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="font-bold text-amber-300">Verified OSINT &amp; Profiles:</span>
                  {sa.profiles.map((p, idx) => (
                    <a
                      key={idx}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-sky-500/20 px-1.5 py-0.5 font-semibold text-sky-200 ring-1 ring-sky-400/30 hover:bg-sky-500/30"
                    >
                      🔗 {p.platform} ↗
                    </a>
                  ))}
                  <Link
                    href={`/osint?q=${encodeURIComponent(turn.speakerName)}`}
                    className="rounded bg-amber-400/20 px-1.5 py-0.5 font-bold text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-400/30"
                  >
                    🕸️ OSINT Entity Graph →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions: Strictly Speaker-Only Segment Download + All Historical Clips + FB Export */}
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
          <a
            href={`/api/clips/${turn.id}?download=1`}
            download={`RWC_${turn.date}_${turn.speakerSlug}_turn${turn.id}.mp4`}
            className="rounded bg-emerald-500/20 px-2 py-1 font-bold text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-500/30"
            title="Download strictly this <=3-min branded C-SPAN speaker segment (never full meeting)"
          >
            ⬇ C-SPAN Clip ({clampedDur}s)
          </a>
          <Link
            href={`/speakers?speaker=${encodeURIComponent(turn.speakerSlug)}`}
            className="rounded bg-amber-400/20 px-2 py-1 font-bold text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-400/30"
          >
            📼 All {histClips} Clips
          </Link>
          <button
            type="button"
            onClick={() => onShareFb(turn)}
            className="rounded bg-[#1877F2] px-2.5 py-1 font-bold text-white hover:bg-[#166fe5]"
          >
            📘 Export to FB
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
            SEARCH ALL 6,339 ARCHIVE PDFs (2008–2026) ↗
          </Link>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[310px_1fr_290px]">
        {/* Left Pane: Object Explorer Table */}
        <div className="flex max-h-[660px] flex-col rounded border border-slate-800 bg-[#080f1d]">
          <div className="border-b border-slate-800 p-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (filteredDocs[0]) setSelectedDoc(filteredDocs[0]);
              }}
              className="flex gap-1.5"
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter packet objects, SHA-1…"
                className="min-w-0 flex-1 rounded border border-slate-700 bg-[#040811] px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                className="rounded bg-sky-400 px-2.5 py-1.5 font-mono text-[11px] font-black text-black hover:bg-sky-300"
              >
                Enter
              </button>
            </form>
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
  const [filmPhase, setFilmPhase] = useState<"intro" | "body" | "outro">("body");
  const [ccOn, setCcOn] = useState(true);
  const [ledgerQ, setLedgerQ] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);

  if (!catalog) {
    return <div className="p-6 text-sm text-slate-400">Provenance film catalog loading…</div>;
  }

  const selectFilm = (next: { title: string; url: string; desc: string }) => {
    setActiveVideo(next);
    setFilmPhase("intro");
    playBroadcastChime(true);
    setTimeout(() => setFilmPhase("body"), 1800);
  };

  const allLedgerRows = catalog.chapters.flatMap((c) => c.ledgerRows.map((r) => ({ ...r, chapterTitle: c.title, clipUrl: c.localUrl })));
  const filteredRows = allLedgerRows.filter(
    (r) => !ledgerQ || `${r.key} ${r.item} ${r.how ?? ""} ${r.origin?.url ?? ""}`.toLowerCase().includes(ledgerQ.toLowerCase()),
  );
  const LEDGER_PER_PAGE = 20;
  const totalLedgerPages = Math.max(1, Math.ceil(filteredRows.length / LEDGER_PER_PAGE));
  const safeLedgerPage = Math.min(ledgerPage, totalLedgerPages);
  const pagedLedgerRows = filteredRows.slice((safeLedgerPage - 1) * LEDGER_PER_PAGE, safeLedgerPage * LEDGER_PER_PAGE);

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
          <code>cheyennecity.org</code>, Internet Archive / Wayback Machine, and public repositories to download each calendar, agenda packet, supporting PDF, clerk minute, and broadcast video by hand.
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

      {/* Main Screen-Recording Theater with C-SPAN Marquee Info Border + Intro/Outro + Captions */}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-white/15 bg-black p-4">
          {activeVideo && (
            <>
              <div className="overflow-hidden rounded-xl border-2 border-amber-400/50 bg-[#050912]">
                <div className="flex items-center justify-between border-b-2 border-amber-400 bg-[#09152b] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider">
                  <span className="text-amber-300">[RWC] THE REAL WINDY CITY · PROVENANCE BROADCAST</span>
                  <button
                    type="button"
                    onClick={() => setCcOn((v) => !v)}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-black ${ccOn ? "bg-amber-400 text-black" : "bg-white/15 text-slate-300"}`}
                  >
                    CC
                  </button>
                </div>
                <div className="relative aspect-video w-full bg-black">
                  {filmPhase === "intro" ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-[#070f20] p-4 text-center">
                      <div className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-300">THE REAL WINDY CITY · VERIFIED CLICK-PATH FILM</div>
                      <div className="mt-2 text-lg font-black text-white">{activeVideo.title}</div>
                      <div className="mt-1 text-xs text-slate-300">{activeVideo.desc}</div>
                    </div>
                  ) : filmPhase === "outro" ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-[#070f20] p-4 text-center">
                      <div className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-300">END OF PROVENANCE SEGMENT · THE REAL WINDY CITY</div>
                      <button
                        type="button"
                        onClick={() => selectFilm(activeVideo)}
                        className="mt-3 rounded bg-amber-400 px-3 py-1.5 text-xs font-black text-black hover:bg-amber-300"
                      >
                        ↻ Replay Provenance Film
                      </button>
                    </div>
                  ) : (
                    <>
                      <video
                        key={activeVideo.url}
                        src={activeVideo.url}
                        poster={catalog.masterFilms[0]?.posterUrl}
                        controls
                        autoPlay
                        onEnded={() => {
                          playBroadcastChime(false);
                          setFilmPhase("outro");
                        }}
                        className="h-full w-full bg-black object-contain"
                      />
                      {ccOn && (
                        <div className="pointer-events-none absolute inset-x-4 bottom-2 rounded bg-black/85 px-3 py-1 text-center text-xs font-semibold text-white">
                          {activeVideo.title}: {activeVideo.desc}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="border-t-2 border-rose-700 bg-[#0a1931] px-3 py-1.5 text-[11px] font-bold text-white">
                  {activeVideo.title} · <span className="text-sky-300">100% Reproducible Public-Portal Audit</span>
                </div>
                <div className="border-t border-amber-400/50 bg-[#040811] px-3 py-1 font-mono text-[10px] font-bold text-amber-300">
                  THE REAL WINDY CITY · ZERO-GAP PRIMARY RECORD AUDIT · OFFICIAL AGENDAS, MINUTES, PACKET PDFS &amp; INTERNET ARCHIVE BROADCASTS
                </div>
              </div>
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
                  ⬇ Download Provenance Clip (.MP4)
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
                onClick={() => selectFilm({ title: mf.title, url: mf.localUrl, desc: mf.description })}
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
                onClick={() => selectFilm({ title: ch.title, url: ch.localUrl, desc: ch.description })}
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
          🎞️ Verified Floor-Tape Supercuts &amp; Contradiction Reels
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.investigativeReels.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectFilm({ title: r.title, url: r.url, desc: "Rendered directly from unedited City of Cheyenne broadcast tape & statutory exhibit cards." })}
              className="rounded-xl border border-white/10 bg-black/50 p-3 text-left text-xs hover:border-amber-400/50"
            >
              <div className="font-mono text-[10px] text-amber-300">▶ FLOOR REEL · {r.duration}</div>
              <div className="mt-1 font-bold text-white">{r.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Searchable Manual Click-Path Ledger with Enter Button & Pagination */}
      <div className="rounded-2xl border border-white/10 bg-[#080f1d] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-300">
              Manual Click-Path Verification Ledger ({filteredRows.length} Matching Datum Paths)
            </h3>
            <p className="text-xs text-slate-400">Follow the literal click sequence below to re-fetch any public record yourself in two minutes.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setLedgerPage(1);
            }}
            className="flex gap-1.5"
          >
            <input
              value={ledgerQ}
              onChange={(e) => {
                setLedgerQ(e.target.value);
                setLedgerPage(1);
              }}
              placeholder="Filter click paths (e.g. supporting, minutes)…"
              className="w-64 rounded border border-white/15 bg-black/60 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="rounded bg-emerald-400 px-3 py-1.5 text-xs font-black text-black hover:bg-emerald-300"
            >
              Enter
            </button>
          </form>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#050912] font-mono text-[10px] uppercase text-slate-400">
              <tr>
                <th className="p-2">Datum / Family</th>
                <th className="p-2">Count</th>
                <th className="p-2">Literal Manual Click-Path</th>
                <th className="p-2">Film Cue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {pagedLedgerRows.map((r) => (
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
                      onClick={() => selectFilm({ title: r.chapterTitle, url: r.clipUrl, desc: r.how ?? "" })}
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
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
          <button
            type="button"
            disabled={safeLedgerPage <= 1}
            onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
            className="rounded bg-white/10 px-3 py-1.5 font-bold hover:bg-white/20 disabled:opacity-40"
          >
            ← Previous Page
          </button>
          <span className="font-mono text-slate-400">
            Page {safeLedgerPage} of {totalLedgerPages} ({filteredRows.length} rows)
          </span>
          <button
            type="button"
            disabled={safeLedgerPage >= totalLedgerPages}
            onClick={() => setLedgerPage((p) => Math.min(totalLedgerPages, p + 1))}
            className="rounded bg-white/10 px-3 py-1.5 font-bold hover:bg-white/20 disabled:opacity-40"
          >
            Next Page →
          </button>
        </div>
      </div>
    </div>
  );
}
