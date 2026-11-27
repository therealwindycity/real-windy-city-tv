#!/usr/bin/env python3
"""Apply hand-verified turn corrections from data/retime/manual_corrections.json.

Each entry was checked by listening to the meeting recording (the reason is recorded in the entry).
An entry may set startSec/endSec/text and mark the speaker as verified. The step refuses to touch a
turn whose speaker no longer matches the entry, so a later relabel cannot silently receive the wrong window.

Runs in scripts/rebuild_all.sh after fix_exhibit_durations.py.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data/seed/speaker_turns.json"
FIX = ROOT / "data/retime/manual_corrections.json"


def hms(s):
    s = int(s)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def main():
    turns = json.loads(SEED.read_text())
    by_id = {t["id"]: t for t in turns}
    applied, problems = 0, []
    for c in json.loads(FIX.read_text()):
        t = by_id.get(c["id"])
        if t is None:
            problems.append(f"{c['id']}: turn missing")
            continue
        if t.get("speakerSlug") != c["speakerSlug"]:
            problems.append(f"{c['id']}: speaker is {t.get('speakerSlug')}, correction is for {c['speakerSlug']}")
            continue
        S = float(c.get("startSec", t["startSec"]))
        E = float(c.get("endSec", t["endSec"]))
        if not 0 <= S < E:
            problems.append(f"{c['id']}: bad window {S}-{E}")
            continue
        t["manualPrevWindow"] = [t["startSec"], t["endSec"]]
        t["startSec"], t["endSec"] = S, E
        t["durationSec"] = round(E - S, 1)
        t["hms"] = hms(S)
        if c.get("text"):
            t["text"] = c["text"]
            t.pop("textLeadIn", None)
        if c.get("verifySpeaker"):
            t["speakerAttributionVerified"] = True
            t.pop("speakerUnverifiedReason", None)
            t["verifiedClip"] = True
        t["videoTimingNote"] = "Speaker and timing checked by listening to the recording."
        t["manualCorrection"] = c["reason"]
        applied += 1
    SEED.write_text(json.dumps(turns, ensure_ascii=False, indent=1))
    print(f"manual corrections: applied {applied}")
    if problems:
        print("manual corrections NOT applied:\n  " + "\n  ".join(problems))
        sys.exit(1)


if __name__ == "__main__":
    main()
