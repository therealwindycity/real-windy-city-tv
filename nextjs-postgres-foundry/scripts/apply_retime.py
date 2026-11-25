#!/usr/bin/env python3
"""
Applies transcript-verified video links + timings to data/seed/speaker_turns.json and meetings.json.

Per turn (pre-cut featured clips with their own directMp4Url are left untouched):
  realigned_relinked : found in a DIFFERENT (correct) IA recording  -> new sourceMeetingMp4Url + times
  realigned          : found in its current IA recording            -> new times
  diarized_window    : placeholder ("Diarized speaking turn ...") whose window contains speech in this recording
                       -> text filled from that recording's own transcript; speaker attribution flagged unverified
  removed            : could not be located in any recording        -> video link removed (transcript kept),
                       reason recorded in videoTimingNote
Old times are preserved in legacyStartSec / legacyEndSec for auditing.

Per meeting: mp4Url/videoUrl set to the recording where most of its turns were verified; links to clearly wrong
recordings (PSAs, TEST uploads, < 10 min clips) are removed. videoLinkVerified records the outcome.
"""
import json
import re
import sys
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import retime_turns as R  # noqa: E402
from relink_meetings import NON_MEETING  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data/seed"
RT = ROOT / "data/retime"
PLACEHOLDER = "Diarized speaking turn"
RENAME = {
    "verified-floor-speaker": ("unidentified-speaker", "Unidentified Speaker"),
    "statutory-contradiction-exhibit": ("compiled-exhibit", "Compiled Exhibit (multiple speakers)"),
}


def hms(sec):
    sec = int(round(sec))
    return f"{sec // 3600:02d}:{sec % 3600 // 60:02d}:{sec % 60:02d}"


def raw_text_window(ident, inv, start, end):
    """Original-cased transcript text spoken inside [start, end] of this IA recording."""
    asr = R.ASR_DIR / f"{ident}.json"
    item = inv.get(ident, {})
    for name in (item.get("srt") or []) + (item.get("vtt") or []):
        f = R.SRT_DIR / f"{ident}__{name}"
        if not f.exists():
            continue
        txt = f.read_text(errors="ignore").replace("\r", "")
        txt = re.sub(r"</?(?:c|v|i|b|u|font)(?:[.\s][^>]*)?>", "", txt).replace("&gt;", ">").replace("&amp;", "&")
        words = []
        for b in re.split(r"\n\s*\n", txt):
            m = R.TS.search(b)
            if not m:
                continue
            g = m.groups()
            t0 = R._sec(*g[0:4])
            for line in b[m.end():].strip("\n").split("\n"):
                if not R.WORD_TS.search(line):
                    continue
                parts = R.WORD_TS.split(line)
                cur = t0
                k = 0
                while k < len(parts):
                    for w in parts[k].split():
                        words.append((cur, w))
                    if k + 1 < len(parts):
                        cur = R._sec(*parts[k + 1:k + 5])
                    k += 5
        if words:
            sel = [w for t, w in words if start <= t <= end]
            return " ".join(sel).replace(" >>", " >>").strip()
    if asr.exists():
        segs = json.loads(asr.read_text())
        return " ".join(s["text"].strip() for s in segs if s["end"] >= start and s["start"] <= end).strip()
    return ""


_FILES_CACHE = {}
_TX_CACHE = {}
PLAYABLE_ORDER = (".mp4", ".HD.mp4", ".mpeg4", ".m4v", ".HD.mov", ".mov")


def item_video_files(ident):
    if ident not in _FILES_CACHE:
        import urllib.request
        try:
            fs = json.load(urllib.request.urlopen(f"https://archive.org/metadata/{ident}/files", timeout=40))["result"]
        except Exception:
            fs = []
        _FILES_CACHE[ident] = [f["name"] for f in fs if f["name"].endswith((".mp4", ".mpeg4", ".m4v", ".mov"))]
    return _FILES_CACHE[ident]


def fix_url(u, inv):
    """Return a URL to a video file that actually exists in the IA item (or None if the item has no video)."""
    if not u or "archive.org/download/" not in u:
        return u
    ident, fn = u.split("/download/")[1].split("/", 1)
    known = {f["name"] for f in (inv.get(ident, {}).get("mp4") or [])}
    if urllib.parse.unquote(fn) in known:
        return u
    names = item_video_files(ident)
    if urllib.parse.unquote(fn) in names:
        return u
    def rank(n):
        for i, suf in enumerate(PLAYABLE_ORDER):
            if n.endswith(suf) and not (suf == ".mp4" and n.endswith(".HD.mp4")) and not (suf == ".mov" and n.endswith(".HD.mov")):
                return i
        return 99
    names = sorted(names, key=rank)
    return f"https://archive.org/download/{ident}/{urllib.parse.quote(names[0])}" if names else None


def main():
    turns = json.loads((SEED / "speaker_turns.json").read_text())
    meetings = json.loads((SEED / "meetings.json").read_text())
    inv = json.loads((RT / "ia_inventory.json").read_text())
    A = {r["id"]: r for r in json.loads((RT / "alignments.json").read_text())}
    plan = {int(k): v for k, v in json.loads((RT / "relink_plan.json").read_text()).items()} if (RT / "relink_plan.json").exists() else {}

    # Placeholder turns whose meeting had no link but whose diarized windows were verified to contain speech in this
    # exact recording (57/60 windows) — see session notes. Link them so their text can be filled from the transcript.
    PLACEHOLDER_LINKS = {
        "2026-11-16-other": "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo",
    }
    for t in turns:
        ident = PLACEHOLDER_LINKS.get(t["meetingSlug"])
        if ident and t["text"].startswith(PLACEHOLDER) and not t.get("sourceMeetingMp4Url"):
            t["sourceMeetingMp4Url"] = fix_url(f"https://archive.org/download/{ident}/x.mp4", inv)

    out = Counter()
    reasons = Counter()
    for t in turns:
        if t["speakerSlug"] in RENAME:
            t["speakerSlug"], t["speakerName"] = RENAME[t["speakerSlug"]]
        if t.get("directMp4Url"):
            out["precut_untouched"] += 1
            continue
        t.setdefault("legacyStartSec", t["startSec"])
        t.setdefault("legacyEndSec", t["endSec"])
        a = A.get(t["id"], {})
        p = plan.get(t["id"])
        if p:
            ident = p["ident"]
            t["sourceMeetingMp4Url"] = p["mp4"]
            t["embedUrl"] = f"https://archive.org/details/{ident}"
            t["startSec"], t["endSec"] = p["newStart"], p["newEnd"]
            t["videoTiming"] = "realigned_relinked" if p["mp4"] != p.get("oldUrl") else "realigned"
            t["alignScore"], t["alignSource"] = p["score"], p["source"]
            t["videoTimingNote"] = None
        elif a.get("status") == "aligned":
            t["startSec"], t["endSec"] = a["newStart"], a["newEnd"]
            t["videoTiming"] = "realigned"
            t["alignScore"], t["alignSource"] = a["score"], a.get("source")
            t["videoTimingNote"] = None
        elif t["text"].startswith(PLACEHOLDER) and "archive.org/download/" in (t.get("sourceMeetingMp4Url") or ""):
            ident = t["sourceMeetingMp4Url"].split("/download/")[1].split("/")[0]
            txt = raw_text_window(ident, inv, float(t["startSec"]), float(t["endSec"]))
            if ident not in _TX_CACHE:
                _TX_CACHE[ident] = bool(R.load_transcript(ident, inv)[1])
            has_tx = _TX_CACHE[ident]
            if len(txt.split()) >= 5:
                t["text"] = txt
                t["videoTiming"] = "diarized_window"
                t["alignSource"] = "ia_asr_captions" if (inv.get(ident, {}).get("srt") or inv.get(ident, {}).get("vtt")) else "whisper_local"
                t["videoTimingNote"] = "Text transcribed from this recording at these times; speaker label came from automatic diarization and is unverified."
                t["speakerAttributionVerified"] = False
            else:
                t["videoTiming"] = "removed"
                t["videoTimingNote"] = ("No speech in this recording at the diarized times." if has_tx
                                        else "No transcript available for the linked recording to verify timing.")
        else:
            t["videoTiming"] = "removed"
            st = a.get("status") or ("unlinked" if not t.get("sourceMeetingMp4Url") else "unknown")
            minutes = bool(re.search(r"moved to approve|motion carried|voting .?yes|seconded by|record of proceedings|met in regular session|met in special session|roll call|the following members", t["text"], re.I))
            t["videoTimingNote"] = (
                "Text is a Clerk Minutes summary, not verbatim speech; it cannot be located in the recording."
                if minutes else
                {"no_transcript": "No transcript available for the linked recording to verify timing.",
                 "no_match": "Text not found in the linked recording or any same-date recording.",
                 "low_confidence": "Text only weakly matched the recording; timing could not be verified.",
                 "unlinked": "No Internet Archive recording found for this meeting."}.get(st, "Timing could not be verified.")
            )
        if t["videoTiming"] == "removed":
            reasons[t["videoTimingNote"]] += 1
            t["sourceMeetingMp4Url"] = None
            t["embedUrl"] = None
            t["brandedMp4Url"] = None
        else:
            s0, e0 = float(t["startSec"]), float(t["endSec"])
            if e0 - s0 < 1.0:   # never emit zero/negative clips
                e0 = s0 + min(180.0, max(8.0, float(t["legacyEndSec"]) - float(t["legacyStartSec"])))
                t["endSec"] = round(e0, 1)
            if e0 - s0 > 180.0:
                t["endSec"] = round(s0 + 180.0, 1)
            t["durationSec"] = round(float(t["endSec"]) - float(t["startSec"]), 1)
            t["hms"] = hms(float(t["startSec"]))
        out[t["videoTiming"]] += 1

    # Meetings: choose the recording with the most verified turns; drop clearly wrong links
    votes = defaultdict(Counter)
    for t in turns:
        if t.get("videoTiming") in ("realigned", "realigned_relinked", "diarized_window") and t.get("sourceMeetingMp4Url"):
            votes[t["meetingSlug"]][t["sourceMeetingMp4Url"]] += 1
    mstat = Counter()
    for m in meetings:
        cur = m.get("mp4Url") or ""
        if votes.get(m["slug"]):
            best = votes[m["slug"]].most_common(1)[0][0]
            ident = best.split("/download/")[1].split("/")[0]
            if best != cur:
                mstat["relinked"] += 1
            m["mp4Url"] = best
            m["videoUrl"] = f"https://archive.org/details/{ident}"
            links = [l for l in (m.get("extraLinks") or []) if l.get("kind") not in ("archive_video", "archive_embed")]
            for u, _ in votes[m["slug"]].most_common():
                idn = u.split("/download/")[1].split("/")[0]
                links += [{"label": f"Archive.org Ch192 ({idn})", "url": f"https://archive.org/details/{idn}", "kind": "archive_video"},
                          {"label": "Archive.org Embed Stream", "url": f"https://archive.org/embed/{idn}", "kind": "archive_embed"}]
            m["extraLinks"] = links
            m["videoLinkVerified"] = True
            mstat["verified"] += 1
        elif "archive.org/download/" in cur:
            ident = cur.split("/download/")[1].split("/")[0]
            item = inv.get(ident, {})
            vlen = ((item.get("mp4") or [{}])[0] or {}).get("length") or 0
            # Wrong only when a clerk/Granicus-sourced governing-body meeting was attached (by upload date) to a
            # PSA / interview / TEST upload. Episodes created from the IA item itself keep their own video.
            from_ia_only = set(m.get("sources") or []) <= {"archive.org/cochwy"}
            if m.get("body") != "other" and not from_ia_only and NON_MEETING.search(item.get("title") or ""):
                m["mp4Url"] = None
                if "archive.org" in (m.get("videoUrl") or ""):
                    m["videoUrl"] = None
                m["extraLinks"] = [l for l in (m.get("extraLinks") or []) if l.get("kind") not in ("archive_video", "archive_embed")]
                m["videoLinkVerified"] = False
                mstat["wrong_link_removed"] += 1
            else:
                mstat["unverified_kept"] += 1   # plausible recording, but no turn text to prove it

    # IA copies verified corrupt by scripts/probe_ia_integrity.py (h264/aac decode errors after ~4 min).
    # Their identifiers carry the City's YouTube video id; the IA captions were made from that same video, so
    # timings carry over 1:1. Play these turns from the YouTube original instead of the damaged file.
    CORRUPT_IA = {"cochwy-Finance_Committee_-_11-17-26-ehK-YMrWJBo": "ehK-YMrWJBo"}
    for t in turns:
        u = t.get("sourceMeetingMp4Url") or ""
        for ident, yid in CORRUPT_IA.items():
            if f"/download/{ident}/" in u:
                t["sourceMeetingMp4Url"] = None
                t["youtubeId"] = yid
                t["embedUrl"] = f"https://www.youtube.com/embed/{yid}?start={int(float(t['startSec']))}"
                extra = "Internet Archive copy is corrupt; playing the City of Cheyenne YouTube original at the same timestamp."
                t["videoTimingNote"] = f"{t['videoTimingNote']} {extra}" if t.get("videoTimingNote") else extra
    for m in meetings:
        for ident, yid in CORRUPT_IA.items():
            if f"/download/{ident}/" in (m.get("mp4Url") or ""):
                m["mp4Url"] = None
                m["videoUrl"] = f"https://www.youtube.com/watch?v={yid}"
                links = [l for l in (m.get("extraLinks") or []) if l.get("kind") not in ("archive_video", "archive_embed")]
                m["extraLinks"] = links + [{"label": "YouTube (City of Cheyenne) original", "url": f"https://www.youtube.com/watch?v={yid}", "kind": "youtube"},
                                           {"label": f"Archive.org Ch192 ({ident}) — file damaged after ~4 min", "url": f"https://archive.org/details/{ident}", "kind": "archive_page"}]

    # Every remaining link must point at a file that really exists in its IA item
    fixed = 0
    for t in turns:
        u = t.get("sourceMeetingMp4Url")
        nu = fix_url(u, inv)
        if nu != u:
            fixed += 1
            t["sourceMeetingMp4Url"] = nu
            if not nu:
                t["videoTiming"], t["videoTimingNote"], t["embedUrl"] = "removed", "Recording has no playable video file.", None
    for m in meetings:
        u = m.get("mp4Url")
        nu = fix_url(u, inv)
        if nu != u:
            fixed += 1
            m["mp4Url"] = nu
    mstat["dead_file_urls_fixed"] = fixed

    import os
    dest = Path(os.environ["RWC_APPLY_OUT"]) if os.environ.get("RWC_APPLY_OUT") else SEED
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "speaker_turns.json").write_text(json.dumps(turns, ensure_ascii=False, indent=1))
    (dest / "meetings.json").write_text(json.dumps(meetings, ensure_ascii=False, indent=1))
    summary = {"turns": dict(out), "removedReasons": dict(reasons), "meetings": dict(mstat)}
    (RT / "apply_summary.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
