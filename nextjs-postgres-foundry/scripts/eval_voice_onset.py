#!/usr/bin/env python3
"""Tune apply_voice_onset rules against an independent truth set.

Truth: turns whose text opens with a name-call ending in the labelled speaker's surname within the first 25 words
(e.g. "...any other comments Mr. President? Mr. Laybourn. Well, I'm not sure...").  True start = transcript time of
the first word after the surname (located by word LCS against the timed transcript).  Writes data/retime/onset_truth.json.
"""
import bisect, difflib, json, re, sys
from collections import defaultdict
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import retime_turns as R
from audit_start_times import lcs_pairs


def surname_idx(words, last, limit=25):
    last = re.sub(r"[^a-z]", "", last.lower()); hit = None
    for i, w in enumerate(words[:limit]):
        if len(w) >= 3 and w[:2] == last[:2] and difflib.SequenceMatcher(None, w, last).ratio() >= 0.6:
            hit = i
    return hit


def build_truth():
    turns = {t["id"]: t for t in json.loads((ROOT / "data/seed/speaker_turns.json").read_text())}
    recs = {r["id"]: r for r in json.loads((ROOT / "data/retime/voice_segments.json").read_text()) if r["status"] == "ok"}
    inv = json.loads((ROOT / "data/retime/ia_inventory.json").read_text())
    by = defaultdict(list)
    for i in recs:
        t = turns[i]
        if abs(float(t["startSec"]) - recs[i]["start"]) > .05: continue
        w = R.norm_words(t["text"])
        k = surname_idx(w, t["speakerName"].split()[-1])
        if k is not None and 1 <= k and k + 6 < len(w):
            by[t["sourceMeetingMp4Url"].split("/download/")[1].split("/")[0]].append((i, w, k))
    truth = {}
    for ident, L in by.items():
        _, tw = R.load_transcript(ident, inv)
        if not tw: continue
        times = [x[0] for x in tw]
        for i, w, k in L:
            S = recs[i]["start"]
            lo, hi = bisect.bisect_left(times, S - 15), bisect.bisect_right(times, S + 90)
            win = tw[lo:hi]; pairs = lcs_pairs(w[:80], [x for _, x in win])
            if len(pairs) < 8: continue
            diag = sorted(j - a for a, j in pairs)[len(pairs) // 2]
            pairs = [(a, j) for a, j in pairs if abs((j - a) - diag) <= 12]
            after = [(a, j) for a, j in pairs if a > k][:3]
            if len(after) < 3 or after[0][0] > k + 3: continue
            truth[i] = round(win[after[0][1]][0] - (after[0][0] - k - 1) * 0.4, 1)
        del tw, times
    (ROOT / "data/retime/onset_truth.json").write_text(json.dumps(truth))
    return truth


if __name__ == "__main__":
    t = build_truth(); print("truth turns", len(t))
