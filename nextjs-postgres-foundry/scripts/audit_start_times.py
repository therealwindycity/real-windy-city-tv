#!/usr/bin/env python3
"""Audit: does each timed speaker turn start where its words start in the recording?

For every turn with a playable IA recording, take the transcript words in [startSec-90, startSec+90] and do an
in-order (LCS) match against the turn's first 40 words. The earliest matched turn word (index k, time T) gives the
true start ~= T - k*0.4s. offset = startSec - trueStart (negative = clip starts too early, positive = too late).
Also reports how many of the turn's first 10 words are found at all (low = the turn's opening words are not in the
recording, e.g. a speaker-name prefix or text belonging to someone else).
Output: data/retime/start_audit.json
"""
import json, sys
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import retime_turns as R

ROOT = Path(__file__).resolve().parent.parent
RT = ROOT / "data/retime"
SEED = ROOT / "data/seed"
SEC_PER_WORD = 0.4


def lcs_pairs(a, b):
    """Return matched index pairs (i in a, j in b) of one LCS."""
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        ai, row, nxt = a[i], dp[i], dp[i + 1]
        for j in range(m - 1, -1, -1):
            row[j] = nxt[j + 1] + 1 if ai == b[j] else (nxt[j] if nxt[j] >= row[j + 1] else row[j + 1])
    i = j = 0
    out = []
    while i < n and j < m:
        if a[i] == b[j]:
            out.append((i, j)); i += 1; j += 1
        elif dp[i + 1][j] >= dp[i][j + 1]:
            i += 1
        else:
            j += 1
    return out


def first_anchor(pairs, min_run=3, max_gap=4):
    """Earliest matched pair that starts a dense run (>= min_run matches with turn gaps <= max_gap), so a
    stray common word far away cannot define the start."""
    for s in range(len(pairs)):
        run = 1
        for t in range(s + 1, len(pairs)):
            if pairs[t][0] - pairs[t - 1][0] <= max_gap and pairs[t][1] - pairs[t - 1][1] <= max_gap * 3:
                run += 1
                if run >= min_run:
                    return pairs[s]
            else:
                break
    return None


def main():
    inv = json.loads((RT / "ia_inventory.json").read_text())
    turns = json.loads((SEED / "speaker_turns.json").read_text())
    by = defaultdict(list)
    for t in turns:
        u = t.get("sourceMeetingMp4Url") or ""
        if t.get("videoTiming") in ("realigned", "realigned_relinked", "diarized_window") and "/download/" in u:
            by[u.split("/download/")[1].split("/")[0]].append(t)
    rows = []
    for ident, ts in sorted(by.items()):
        src, tw = R.load_transcript(ident, inv)
        if not tw:
            continue
        times = [x[0] for x in tw]
        import bisect
        for t in ts:
            s0 = float(t["startSec"])
            lo, hi = bisect.bisect_left(times, s0 - 90), bisect.bisect_right(times, s0 + 90)
            win = tw[lo:hi]
            words = R.norm_words(t["text"])[:40]
            if len(words) < 6 or not win:
                rows.append({"id": t["id"], "timing": t["videoTiming"], "status": "too_short"}); continue
            pairs = lcs_pairs(words, [w for _, w in win])
            first10 = sum(1 for i, _ in pairs if i < 10)
            # keep only pairs on the turn's main diagonal (j - i near the median), so a formulaic phrase said
            # earlier ("the recommendation of the ... committee") cannot pull the anchor away
            if pairs:
                diag = sorted(j - i for i, j in pairs)[len(pairs) // 2]
                pairs = [(i, j) for i, j in pairs if abs((j - i) - diag) <= 12]
            anc = first_anchor(pairs)
            if not anc:
                rows.append({"id": t["id"], "timing": t["videoTiming"], "status": "no_anchor", "first10": first10}); continue
            k, j = anc
            true_start = win[j][0] - k * SEC_PER_WORD
            rows.append({"id": t["id"], "ident": ident, "timing": t["videoTiming"], "status": "ok",
                         "startSec": s0, "trueStart": round(true_start, 1), "offset": round(s0 - true_start, 1),
                         "anchorWord": k, "first10": first10, "matched": len(pairs), "src": src,
                         "speaker": t.get("speakerSlug"), "text": t["text"][:90]})
        del tw, times
    (RT / "start_audit.json").write_text(json.dumps(rows, indent=0))
    ok = [r for r in rows if r["status"] == "ok"]
    print("audited", len(rows), "ok", len(ok), {s: sum(1 for r in rows if r["status"] == s) for s in ("too_short", "no_anchor")})
    for name, sel in (("ALL", ok), ("realigned", [r for r in ok if r["timing"] != "diarized_window"]),
                      ("diarized_window", [r for r in ok if r["timing"] == "diarized_window"])):
        if not sel:
            continue
        a = [abs(r["offset"]) for r in sel]
        b = lambda x: sum(1 for v in a if v <= x)
        print(f"{name:16s} n={len(sel)}  <=2s {b(2)}  <=5s {b(5)}  <=10s {b(10)}  >10s {len(a)-b(10)}  >30s {len(a)-b(30)}"
              f"  early(<-5s) {sum(1 for r in sel if r['offset'] < -5)}  late(>5s) {sum(1 for r in sel if r['offset'] > 5)}")


if __name__ == "__main__":
    main()
