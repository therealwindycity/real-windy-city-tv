#!/usr/bin/env python3
"""
After re-timing: rename misleading pseudo-speakers everywhere and recompute per-speaker clip counts,
meeting counts, total and average speaking time from the corrected (transcript-verified) durations.
Only these numeric fields are touched; topics/stance/OSINT stay as built.
"""
import json
from collections import defaultdict
from pathlib import Path

SEED = Path(__file__).resolve().parent.parent / "data/seed"
RENAME = {
    "verified-floor-speaker": "unidentified-speaker",
    "Verified Floor Speaker": "Unidentified Speaker",
    "statutory-contradiction-exhibit": "compiled-exhibit",
    "Statutory Contradiction Exhibit": "Compiled Exhibit (multiple speakers)",
    "person-statutory-contradiction-exhibit": "person-compiled-exhibit",
    "person-verified-floor-speaker": "person-unidentified-speaker",
}


def fmt(sec):
    sec = int(round(sec))
    if sec >= 3600:
        return f"{sec // 3600}h {sec % 3600 // 60:02d}m"
    return f"{sec // 60}m {sec % 60:02d}s" if sec >= 60 else f"{sec}s"


def deep_rename(o):
    if isinstance(o, dict):
        return {deep_rename(k): deep_rename(v) for k, v in o.items()}
    if isinstance(o, list):
        return [deep_rename(v) for v in o]
    if isinstance(o, str):
        for a, b in RENAME.items():
            if o == a:
                return b
            if a in o and a[0].isupper():
                o = o.replace(a, b)
            elif a in o and ("/" in o or "#" in o or ":" in o):   # slugs inside URLs / hashes
                o = o.replace(a, b)
        return o
    return o


def main():
    files = ["speaker_turns.json", "speakers_directory.json", "osint_entities.json"]
    data = {f: deep_rename(json.loads((SEED / f).read_text())) for f in files}
    turns, spk = data["speaker_turns.json"], data["speakers_directory.json"]

    by = defaultdict(list)
    for t in turns:
        by[t["speakerSlug"]].append(t)
    stats = {}
    for slug, ts in by.items():
        # Average speaking time uses only clips whose duration is known (verified timing or pre-cut segment)
        known = [float(t["durationSec"]) for t in ts if t.get("videoTiming") != "removed" and t.get("durationSec")]
        avg = round(sum(known) / len(known), 1) if known else 0.0
        stats[slug] = {
            "historicalClipCount": len(ts),
            "historicalMeetingCount": len({t["meetingSlug"] for t in ts}),
            "avgSpeakingSec": avg,
            "avgSpeakingFormatted": fmt(avg) if known else "n/a",
            "verifiedVideoClipCount": sum(1 for t in ts if t.get("videoTiming") != "removed"),
            "totalDurationSec": int(round(sum(known))),
            "totalSpeakingSec": round(sum(known), 1),
            "totalSpeakingFormatted": fmt(sum(known)),
            "maxSpeakingSec": round(max(known), 1) if known else 0.0,
        }
    for t in turns:
        a = t.get("speakerAnalytics")
        if a is not None:
            s = stats[t["speakerSlug"]]
            for k in ("historicalClipCount", "historicalMeetingCount", "avgSpeakingSec", "avgSpeakingFormatted", "verifiedVideoClipCount"):
                a[k] = s[k]
    for s in spk:
        st = stats.get(s["slug"])
        if not st:
            continue
        s["turnCount"] = st["historicalClipCount"]
        s["meetingCount"] = st["historicalMeetingCount"]
        s["totalDurationSec"] = st["totalDurationSec"]
        if isinstance(s.get("analytics"), dict):
            for k in ("historicalClipCount", "historicalMeetingCount", "avgSpeakingSec", "avgSpeakingFormatted", "verifiedVideoClipCount",
                      "totalSpeakingSec", "totalSpeakingFormatted", "maxSpeakingSec"):
                s["analytics"][k] = st[k]
    missing = set(by) - {s["slug"] for s in spk}
    for f in files:
        (SEED / f).write_text(json.dumps(data[f], ensure_ascii=False, indent=1))
    print("speakers recomputed:", len(stats), "| turn slugs missing from directory:", sorted(missing))
    for slug in ("mark-moody", "unidentified-speaker", "compiled-exhibit"):
        print(slug, stats.get(slug))


if __name__ == "__main__":
    main()
