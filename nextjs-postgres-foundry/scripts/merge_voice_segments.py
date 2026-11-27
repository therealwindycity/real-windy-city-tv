#!/usr/bin/env python3
"""Merge voice_extract shard outputs into data/retime/voice_segments.json (adds start/dur from the input list)."""
import json, sys, glob
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
inp = {t["id"]: t for t in json.load(open(sys.argv[1]))}
out = ROOT / "data/retime/voice_segments.json"
res = {r["id"]: r for r in json.load(open(out))} if out.exists() else {}
for f in sys.argv[2:]:
    for r in json.load(open(f)):
        if r.get("status") == "ok" or r["id"] not in res:
            r["start"], r["dur"] = inp[r["id"]]["start"], inp[r["id"]]["dur"]
            res[r["id"]] = r
out.write_text(json.dumps(sorted(res.values(), key=lambda r: r["id"]), separators=(",", ":")))
from collections import Counter
print(len(res), Counter(r["status"] for r in res.values()))
