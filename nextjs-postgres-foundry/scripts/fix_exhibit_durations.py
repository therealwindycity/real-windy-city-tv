#!/usr/bin/env python3
"""Pre-cut exhibit clips (directMp4Url under pipeline/videos/) play from 0:00 of their own file.
Their stored durationSec/endSec were hand-typed estimates; set them to the real file length
(measured with ffprobe into data/retime/exhibit_clip_durations.json)."""
import json
from pathlib import Path
SEED = Path("data/seed/speaker_turns.json")
DUR = json.load(open("data/retime/exhibit_clip_durations.json"))
turns = json.load(open(SEED))
n = 0
for t in turns:
    d = DUR.get(t.get("directMp4Url") or "")
    if not d:
        continue
    if abs(float(t.get("durationSec") or 0) - d) > 0.05:
        t["exhibitPrevDurationSec"] = t.get("durationSec")
        t["durationSec"] = round(d, 1)
        t["endSec"] = round(float(t.get("startSec") or 0) + d, 1)
        n += 1
json.dump(turns, open(SEED, "w"), ensure_ascii=False, indent=1)
print(f"fix_exhibit_durations: {n} exhibit clips set to real file length")
