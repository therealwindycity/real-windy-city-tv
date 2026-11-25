#!/usr/bin/env python3
"""Probe IA video files used by speaker turns for mid-file corruption (decode 3s at several offsets over HTTP)."""
import concurrent.futures as cf
import json
import random
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
turns = json.loads((ROOT / "data/seed/speaker_turns.json").read_text())
urls = {}
for t in turns:
    u = t.get("sourceMeetingMp4Url")
    if u and "archive.org/download/" in u:
        urls.setdefault(u, []).append(float(t["startSec"]))
yt = [u for u in urls if re.search(r"-[A-Za-z0-9_-]{11}/", u)]
others = [u for u in urls if u not in yt]
random.seed(7)
sample = yt + random.sample(others, min(int(sys.argv[1]) if len(sys.argv) > 1 else 30, len(others)))


def probe(u):
    starts = sorted(urls[u])
    offs = sorted({starts[0], starts[len(starts) // 2], starts[-1]})
    bad = 0
    for o in offs:
        try:
            r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", str(o), "-t", "3", "-i", u, "-f", "null", "-"],
                               capture_output=True, text=True, timeout=90)
            n = r.stderr.count("Invalid")
        except subprocess.TimeoutExpired:
            n = -1
        bad += 1 if n > 50 else 0
    return u, len(starts), offs, bad


res = []
with cf.ThreadPoolExecutor(4) as ex:
    for u, n, offs, bad in ex.map(probe, sample):
        res.append({"url": u, "turns": n, "offsets": offs, "badOffsets": bad})
        print(("CORRUPT " if bad else "ok      ") + f"{bad}/{len(offs)} turns={n} {u.split('/download/')[1][:90]}", flush=True)
(ROOT / "data/retime/ia_integrity.json").write_text(json.dumps(res, indent=1))
