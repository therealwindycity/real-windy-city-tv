#!/usr/bin/env python3
"""A2 probe: can weakly-matched turns be verified by an in-order (LCS) word match?

For each turn we compare its content words with the transcript words around the trigram-vote candidate.
metric = LCS(content words of turn, content words in window) / content words in turn.
Null distribution: the same metric for each turn against random windows of OTHER recordings (cannot be correct).
Positive control: turns already accepted as 'aligned'.
"""
import json, random, sys
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import retime_turns as R

ROOT = Path(__file__).resolve().parent.parent
RT = ROOT / "data/retime"
STOP = set("""a an the and or but of to in on at for by with from as is are was were be been being it its this that these those
i you he she we they me him her us them my your our their mr mrs ms dr uh um so okay yes no not do does did have has had will would
can could should there here what which who whom whose if then than just very also all any some about up down out over into
thank thanks mayor council councilman councilwoman""".split())

def content(ws): return [w for w in ws if w not in STOP and len(w) > 2]

def lcs(a, b):
    if not a or not b: return 0
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0]
        for j, y in enumerate(b, 1):
            cur.append(prev[j - 1] + 1 if x == y else max(prev[j], cur[-1]))
        prev = cur
    return prev[-1]

def window_metric(turn_c, words, s, e, pad=40):
    win = content(words[max(0, s - pad): e + pad])
    return lcs(turn_c, win) / max(1, len(turn_c))

def main():
    inv = json.loads((RT / "ia_inventory.json").read_text())
    al = json.loads((RT / "alignments.json").read_text())
    turns = {t["id"]: t for t in json.loads((ROOT / "data/seed/speaker_turns.json").read_text())}
    def tx(ident):
        src, tw = R.load_transcript(ident, inv)
        words = [w for _, w in tw] if tw else []
        idx = defaultdict(list)
        for i in range(len(words) - 2): idx[(words[i], words[i + 1], words[i + 2])].append(i)
        return tw, words, idx
    rows = []
    random.seed(7)
    by_ident = defaultdict(list)
    for r in al:
        t = turns.get(r["id"])
        if not t or not r.get("ident") or r["status"] not in ("aligned", "low_confidence", "no_match"): continue
        if "Clerk Minutes summary" in (t.get("videoTimingNote") or ""): continue
        by_ident[r["ident"]].append((r, t))
    pool = []
    for o in random.sample(sorted(by_ident), 24):
        w = tx(o)[1]
        if len(w) > 600: pool.append((o, w))
    for ident, items in sorted(by_ident.items()):
        tw, words, idx = tx(ident)
        if not words: continue
        for r, t in items:
            tws = R.norm_words(t["text"]); tc = content(tws)
            if len(tc) < 8: continue
            a = R.align(tws, tw, idx)
            if a:
                s, e = a[0], a[1]
                m = window_metric(tc, words, s, min(e, s + 3 * len(tws)))
            else:
                m, s, e = 0.0, None, None
            nulls = []
            for o, ow in random.sample(pool, 3):
                if o == ident or len(ow) < len(tws) + 100: continue
                st = random.randrange(0, len(ow) - len(tws))
                nulls.append(window_metric(tc, ow, st, st + len(tws)))
            rows.append({"id": r["id"], "status": r["status"], "metric": round(m, 3), "null": [round(x, 3) for x in nulls],
                         "contentWords": len(tc), "s": s, "e": e, "ident": ident})
        del tw, words, idx
    (RT / "a2_lcs_probe.json").write_text(json.dumps(rows))
    import statistics as S
    for st in ("aligned", "low_confidence", "no_match"):
        ms = sorted(x["metric"] for x in rows if x["status"] == st)
        if ms: print(st, len(ms), "median", ms[len(ms) // 2], "p10", ms[len(ms) // 10], "p90", ms[9 * len(ms) // 10])
    nl = sorted(v for x in rows for v in x["null"])
    print("NULL", len(nl), "median", nl[len(nl) // 2], "p99", nl[int(.99 * len(nl))], "p99.9", nl[int(.999 * len(nl))], "max", nl[-1])

if __name__ == "__main__":
    main()
