#!/usr/bin/env python3
"""
Finds the CORRECT Internet Archive (cochwy-*) recording(s) for meetings whose current video link is wrong,
missing, or only covers part of the meeting — and proves it by text alignment.

For every meeting with at least one verbatim turn that failed alignment against its current link:
  1. candidates = collection items whose title date (or upload date -0..+10 days) matches the meeting date,
     excluding obvious non-meeting uploads (PSAs, interviews, TEST, < 10 min)
  2. load each candidate's transcript (IA captions or local Whisper)
  3. align every still-unmatched verbatim turn against every candidate; a turn is assigned to the candidate where it
     aligns with the highest score (>= ACCEPT). Multi-part meetings naturally spread across "Part 1/Part 2" items.
Writes data/retime/relink_plan.json and data/retime/relink_needs_asr.txt (candidates lacking any transcript).
"""
import json
import re
import sys
import urllib.request
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import retime_turns as R  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RT = ROOT / "data/retime"
MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
NON_MEETING = re.compile(r"\b(test|psa|message|interview|talks about|recruit|swearing|update|ceremony|safety|video|minute|promo|tour|award|parade|holiday)\b", re.I)
BODY_WORDS = {
    "council": ["council"], "finance": ["finance"], "psc": ["public services", "public service"],
    "planning": ["planning"], "work": ["work session", "worksession", "ws"], "special": ["special"],
    "cow": ["committee of the whole"], "boa": ["adjustment"],
}


def title_date(title: str):
    t = (title or "").lower().replace("sept.", "sep").replace("sept", "sep")
    m = re.search(r"(\d{1,2})[-_/. ](\d{1,2})[-_/. ](\d{2,4})", t)
    if m:
        mo, d, y = map(int, m.groups())
        y = y + 2000 if y < 100 else y
        try:
            return date(y, mo, d)
        except ValueError:
            pass
    m = re.search(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+(\d{1,2}),?\s+(\d{4})", t)
    if m:
        try:
            return date(int(m.group(3)), MONTHS[m.group(1)], int(m.group(2)))
        except ValueError:
            pass
    return None


def ensure_inventory(idents, inv):
    missing = [i for i in idents if i not in inv]

    def get(ident):
        try:
            d = json.load(urllib.request.urlopen(f"https://archive.org/metadata/{ident}", timeout=40))
            fs = d.get("files", [])
            md = d.get("metadata", {})
            return ident, {
                "title": md.get("title"), "date": md.get("date"),
                "mp4": [{"name": f["name"], "length": float(f["length"]) if re.match(r"^[0-9.]+$", str(f.get("length", ""))) else None}
                        for f in fs if f["name"].endswith(".mp4")],
                "mp3": [f["name"] for f in fs if f["name"].endswith(".mp3")],
                "srt": [f["name"] for f in fs if f["name"].endswith(".en.asr.srt")],
                "vtt": [f["name"] for f in fs if f["name"].endswith(".en.vtt")],
            }
        except Exception as e:
            return ident, {"error": str(e)}
    with ThreadPoolExecutor(10) as ex:
        for k, v in ex.map(get, missing):
            inv[k] = v
    return inv


def main():
    turns = json.loads((R.SEED / "speaker_turns.json").read_text())
    meetings = {m["slug"]: m for m in json.loads((R.SEED / "meetings.json").read_text())}
    A = {r["id"]: r for r in json.loads((RT / "alignments.json").read_text())}
    inv = json.loads((RT / "ia_inventory.json").read_text())
    coll = json.loads((RT / "ia_collection.json").read_text())

    def verbatim(t):
        return not t["text"].startswith("Diarized speaking turn") and not t.get("directMp4Url") and len(R.norm_words(t["text"])) >= 8

    need = defaultdict(list)
    for t in turns:
        if not verbatim(t):
            continue
        st = A.get(t["id"], {}).get("status")
        if st != "aligned":
            need[t["meetingSlug"]].append(t)

    plan, needs_asr = {}, set()
    cand_by_meeting = {}
    for slug, ts in need.items():
        md = date.fromisoformat(slug[:10])
        kind = slug[11:]
        words = BODY_WORDS.get(kind, [])
        cands = []
        for d in coll:
            ident, title = d["identifier"], d.get("title") or ""
            if NON_MEETING.search(title):
                continue
            td = title_date(title)
            up = date.fromisoformat(d["date"][:10]) if d.get("date") else None
            date_ok = (td == md) or (td is None and up and timedelta(0) <= up - md <= timedelta(days=10))
            if not date_ok:
                continue
            body_ok = (not words) or any(w in title.lower() for w in words) or kind in ("other", "special")
            if body_ok:
                cands.append(ident)
        cand_by_meeting[slug] = cands

    all_c = sorted({c for cs in cand_by_meeting.values() for c in cs})
    inv = ensure_inventory(all_c, inv)
    (RT / "ia_inventory.json").write_text(json.dumps(inv, indent=1))

    transcripts = {}
    with ThreadPoolExecutor(8) as ex:
        for ident, res in zip(all_c, ex.map(lambda i: R.load_transcript(i, inv), all_c)):
            vlen = ((inv.get(ident, {}).get("mp4") or [{}])[0] or {}).get("length") or 0
            if vlen and vlen < 600:
                continue
            if res[1]:
                transcripts[ident] = res
            else:
                needs_asr.add(ident)

    summary = Counter()
    for slug, ts in need.items():
        idx_cache = {}
        for ident in cand_by_meeting[slug]:
            if ident not in transcripts:
                continue
            src, tw = transcripts[ident]
            words = [w for _, w in tw]
            index = defaultdict(list)
            for i in range(len(words) - 2):
                index[(words[i], words[i + 1], words[i + 2])].append(i)
            idx_cache[ident] = (src, tw, index)
        for t in ts:
            best = None
            tw_turn = R.norm_words(t["text"])
            for ident, (src, tw, index) in idx_cache.items():
                r = R.align(tw_turn, tw, index)
                if not r:
                    continue
                si, ei, score, votes = r
                if score >= R.ACCEPT and votes >= R.MIN_VOTES and (best is None or score > best["score"]):
                    si = max(0, min(si, len(tw) - 1))
                    ei = max(si + 1, min(ei, len(tw) - 1))
                    vlen = ((inv[ident].get("mp4") or [{}])[0] or {}).get("length") or 1e9
                    if vlen <= 60:
                        vlen = 1e9   # bogus IA length metadata (e.g. 2.37s for a 1-hour recording)
                    ns = max(0.0, tw[si][0] - 0.75)
                    ne = min(tw[ei][0] + 1.0, vlen, ns + R.MAX_CLIP)
                    best = {"id": t["id"], "meeting": slug, "ident": ident, "source": src, "score": round(score, 3),
                            "votes": votes, "newStart": round(ns, 1), "newEnd": round(ne, 1),
                            "mp4": f"https://archive.org/download/{ident}/{(inv[ident]['mp4'] or [{}])[0].get('name')}",
                            "oldUrl": t.get("sourceMeetingMp4Url")}
            if best:
                plan[t["id"]] = best
                summary["relinked" if best["mp4"] != t.get("sourceMeetingMp4Url") else "retimed_same_video"] += 1
            else:
                summary["still_unmatched"] += 1

    (RT / "relink_plan.json").write_text(json.dumps(plan, indent=1))
    (RT / "relink_needs_asr.txt").write_text("\n".join(sorted(needs_asr)) + "\n")
    print("meetings needing work:", len(need), "| candidate items:", len(all_c),
          "| with transcript:", len(transcripts), "| need ASR:", len(needs_asr))
    print("turn outcomes:", dict(summary))


if __name__ == "__main__":
    main()
