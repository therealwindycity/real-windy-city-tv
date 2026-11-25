#!/usr/bin/env python3
"""
Re-times speaker turns against the ACTUAL Internet Archive video they are linked to.

Clip times originally came from Granicus recordings, which are trimmed / split differently
from the Internet Archive (cochwy-*) uploads. This script finds where each turn's verbatim
text really occurs inside the IA video's own timestamped transcript and rewrites
startSec / endSec accordingly.

Transcript sources per IA item (in order of preference):
  1. IA's own English ASR captions   (<name>.en.asr.srt / .en.vtt)
  2. Local Whisper transcript         (data/retime/asr/<ident>.json, produced by asr_ia_audio.py)

Alignment: every word-trigram of the turn text votes for a start position in the transcript
word stream (position_in_transcript - position_in_turn). The densest vote cluster wins.
  score = winning votes / number of turn trigrams that exist anywhere in the transcript vocabulary

Output: data/retime/alignments.json  (one record per turn, with old/new times + score + status)
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data/seed"
RT = ROOT / "data/retime"
SRT_DIR = RT / "srt"
ASR_DIR = RT / "asr"
SRT_DIR.mkdir(parents=True, exist_ok=True)

TOK = re.compile(r"[a-z0-9']+")
TS = re.compile(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)")

ACCEPT = 0.28      # min fraction of trigrams agreeing on one position
MIN_VOTES = 6      # and at least this many agreeing trigrams
MAX_CLIP = 180.0   # speaker-only segment cap


def norm_words(s: str):
    s = s.lower().replace("’", "'")
    s = re.sub(r">>|\[.*?\]|\(.*?\)", " ", s)
    return TOK.findall(s)


WORD_TS = re.compile(r"<(\d+):(\d+):(\d+)[.,](\d+)>")


def _sec(h, m, s_, ms):
    return int(h) * 3600 + int(m) * 60 + int(s_) + int(ms) / 1000


def parse_srt(text: str):
    """-> list of (t_seconds, word).
    Handles YouTube/IA word-timed rolling captions (only lines carrying inline <hh:mm:ss.mmm> tags are new words;
    plain lines are repeats) and falls back to overlap de-duplication for plain rolling captions."""
    text = text.replace("\r", "").replace("&gt;", ">").replace("&lt;", "<").replace("&amp;", "&")
    text = re.sub(r"</?(?:c|v|i|b|u|font)(?:[.\s][^>]*)?>", "", text)   # VTT/SRT styling tags (<c>, <c.colorE5E5E5>, <v Speaker>)
    cues = []
    for b in re.split(r"\n\s*\n", text):
        m = TS.search(b)
        if not m:
            continue
        g = m.groups()
        cues.append((_sec(*g[0:4]), _sec(*g[4:8]), b[m.end():].strip("\n").split("\n")))
    timed = any(WORD_TS.search(l) for _, _, ls in cues for l in ls)
    out = []
    if timed:
        for t0, t1, lines in cues:
            for line in lines:
                if not WORD_TS.search(line):
                    continue
                # "w1<t2> w2<t3> w3" : w1 starts at cue start, each tag is the start of the following word
                parts = WORD_TS.split(line)
                cur = t0
                k = 0
                while k < len(parts):
                    chunk = parts[k]
                    for w in norm_words(chunk):
                        out.append((cur, w))
                    if k + 4 < len(parts) + 1 and k + 1 < len(parts):
                        cur = _sec(*parts[k + 1:k + 5])
                    k += 5
    else:
        prev = []
        for t0, t1, lines in cues:
            words = norm_words(" ".join(lines))
            if not words:
                continue
            # drop the longest prefix of this cue that equals a suffix of the previous cue (rolling repeat)
            ov = 0
            for L in range(min(len(prev), len(words)), 0, -1):
                if prev[-L:] == words[:L]:
                    ov = L
                    break
            new = words[ov:]
            step = max(0.0, t1 - t0) / max(1, len(new))
            out += [(t0 + i * step, w) for i, w in enumerate(new)]
            prev = words
    out = [(t, w) for t, w in out if w not in ("gt", "lt")]
    out.sort(key=lambda x: x[0])
    return out


def fetch(url: str, dest: Path):
    if dest.exists() and dest.stat().st_size > 0:
        return dest.read_text(errors="ignore")
    for _ in range(3):
        try:
            data = urllib.request.urlopen(url, timeout=60).read()
            dest.write_bytes(data)
            return data.decode("utf-8", "ignore")
        except Exception:
            pass
    return None


def load_transcript(ident: str, inv: dict):
    """-> (source_label, [(t, word), ...]) or (None, None)"""
    asr = ASR_DIR / f"{ident}.json"
    item = inv.get(ident, {})
    for name in (item.get("srt") or []) + (item.get("vtt") or []):
        txt = fetch(f"https://archive.org/download/{ident}/{urllib.parse.quote(name)}", SRT_DIR / f"{ident}__{name}")
        if txt:
            tw = parse_srt(txt)
            if len(tw) > 50:
                return "ia_asr_captions", tw
    if asr.exists():
        segs = json.loads(asr.read_text())
        tw = []
        for s in segs:
            ws = norm_words(s["text"])
            if not ws:
                continue
            step = max(0.0, s["end"] - s["start"]) / len(ws)
            tw += [(s["start"] + i * step, w) for i, w in enumerate(ws)]
        if len(tw) > 50:
            return "whisper_local", tw
    return None, None


def align(turn_words, tw, index):
    """Vote-based trigram alignment. Returns (start_idx, end_idx, score, votes)."""
    n = len(turn_words)
    if n < 6:
        return None
    grams = [tuple(turn_words[i:i + 3]) for i in range(n - 2)]
    known = 0
    votes = Counter()
    for i, g in enumerate(grams):
        pos = index.get(g)
        if not pos:
            continue
        known += 1
        if len(pos) > 40:          # extremely common phrase ("thank you mayor") — ignore
            continue
        for p in pos:
            votes[(p - i) // 12] += 1   # 12-word bins tolerate ASR insertions/deletions
    if not votes or known == 0:
        return None
    # merge neighbouring bins
    best_bin, best = None, 0
    for b in votes:
        v = votes[b] + votes.get(b - 1, 0) + votes.get(b + 1, 0)
        if v > best:
            best_bin, best = b, v
    # refine: earliest and latest matched transcript positions inside the winning window
    lo_pos, hi_pos = [], []
    for i, g in enumerate(grams):
        for p in index.get(g, ()):
            if abs((p - i) // 12 - best_bin) <= 1:
                lo_pos.append(p - i)
                hi_pos.append(p + (n - i))
    start_idx = int(sorted(lo_pos)[len(lo_pos) // 2]) if lo_pos else best_bin * 12
    end_idx = int(sorted(hi_pos)[len(hi_pos) // 2]) if hi_pos else start_idx + n
    return start_idx, end_idx, best / max(1, len(grams)), best


def main(only_ids=None):
    turns = json.loads((SEED / "speaker_turns.json").read_text())
    inv = json.loads((RT / "ia_inventory.json").read_text())
    by_ident = defaultdict(list)
    for t in turns:
        u = t.get("sourceMeetingMp4Url") or ""
        if t.get("directMp4Url"):
            continue  # pre-cut featured clip: its times are relative to its own MP4, not the meeting video
        if "archive.org/download/" in u and (only_ids is None or t["id"] in only_ids):
            by_ident[u.split("/download/")[1].split("/")[0]].append(t)

    # prefetch captions in parallel
    def pre(ident):
        load_transcript(ident, inv)
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(pre, by_ident))

    prev = {}
    out_path = RT / "alignments.json"
    if out_path.exists():
        prev = {r["id"]: r for r in json.loads(out_path.read_text())}

    results = []
    for ident, ts in sorted(by_ident.items()):
        src, tw = load_transcript(ident, inv)
        mp4 = (inv.get(ident, {}).get("mp4") or [{}])[0]
        vlen = mp4.get("length")
        if not tw:
            for t in ts:
                results.append({"id": t["id"], "ident": ident, "status": "no_transcript",
                                "oldStart": t["startSec"], "oldEnd": t["endSec"], "videoLen": vlen})
            continue
        words = [w for _, w in tw]
        index = defaultdict(list)
        for i in range(len(words) - 2):
            index[(words[i], words[i + 1], words[i + 2])].append(i)
        for t in ts:
            tw_turn = norm_words(t["text"])
            r = align(tw_turn, tw, index)
            rec = {"id": t["id"], "ident": ident, "source": src, "oldStart": t["startSec"],
                   "oldEnd": t["endSec"], "videoLen": vlen, "turnWords": len(tw_turn)}
            if not r:
                rec.update(status="no_match", score=0.0)
            else:
                si, ei, score, votes = r
                si = max(0, min(si, len(tw) - 1))
                ei = max(si + 1, min(ei, len(tw) - 1))
                new_start = max(0.0, tw[si][0] - 0.75)          # small lead-in so the first word isn't clipped
                new_end = min(tw[ei][0] + 1.0, (vlen if vlen and vlen > 60 else 1e9))  # ignore bogus IA lengths (e.g. 2.37s)
                if new_end - new_start > MAX_CLIP:
                    new_end = new_start + MAX_CLIP
                ok = score >= ACCEPT and votes >= MIN_VOTES
                rec.update(status="aligned" if ok else "low_confidence", score=round(score, 3), votes=votes,
                           newStart=round(new_start, 1), newEnd=round(new_end, 1),
                           shiftSec=round(new_start - float(t["startSec"]), 1))
            results.append(rec)

    merged = {**prev, **{r["id"]: r for r in results}}
    out_path.write_text(json.dumps(sorted(merged.values(), key=lambda r: r["id"]), indent=1))
    c = Counter(r["status"] for r in results)
    print("this run:", dict(c), "| total records:", len(merged))
    return results


if __name__ == "__main__":
    ids = set(map(int, sys.argv[1:])) if len(sys.argv) > 1 else None
    main(ids)
