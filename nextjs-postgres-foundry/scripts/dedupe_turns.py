#!/usr/bin/env python3
"""Drop duplicate speaker turns: the source data recorded some comments twice (two turns ~10 s apart covering the
same speech).  Once starts are corrected they collapse onto the same moment.  Same recording + same speaker + start
within 2 s -> keep one (branded clip > caption-verified end > longer > lower id).  Log: data/retime/dedupe_turns_log.json
Runs in scripts/rebuild_all.sh after fix_turn_ends.py."""
import json
from collections import defaultdict
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data/seed/speaker_turns.json"
ENDS = {x["id"]: x["how"] for x in json.load(open(ROOT / "data/retime/turn_end_log.json"))}
turns = json.loads(SEED.read_text())
groups = defaultdict(list)
for t in turns:
    if t.get("videoTiming") in (None, "removed") or t.get("startSec") is None or not t.get("sourceMeetingMp4Url"):
        continue
    groups[(t["sourceMeetingMp4Url"], t["speakerSlug"])].append(t)
drop, log = set(), []
for items in groups.values():
    items.sort(key=lambda t: t["startSec"])
    i = 0
    while i < len(items):
        j = i
        while j + 1 < len(items) and items[j + 1]["startSec"] - items[i]["startSec"] <= 2.0:
            j += 1
        g = items[i:j + 1]
        if len(g) > 1:
            g.sort(key=lambda t: (not t.get("brandedMp4Url"), ENDS.get(t["id"]) != "caption_speaker_change",
                                  -float(t["durationSec"]), t["id"]))
            keep = g[0]
            for t in g[1:]:
                drop.add(t["id"])
                log.append({"dropped": t["id"], "keptAs": keep["id"], "start": t["startSec"],
                            "droppedBranded": bool(t.get("brandedMp4Url"))})
        i = j + 1
turns = [t for t in turns if t["id"] not in drop]
SEED.write_text(json.dumps(turns, ensure_ascii=False, indent=1))
(ROOT / "data/retime/dedupe_turns_log.json").write_text(json.dumps(log, indent=1))
print(f"dedupe_turns: {len(drop)} duplicate turns dropped -> {len(turns)} turns")
