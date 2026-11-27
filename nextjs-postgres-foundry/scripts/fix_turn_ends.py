#!/usr/bin/env python3
"""End speaker-turn clips where the speaker stops, not where the stored text stops.

Stored turn texts are capped at ~700 characters, and the transcript alignment set endSec to the time of the LAST STORED
word.  For long turns (public comments, reports) that cut the clip off mid-sentence -- e.g. turn 337 ended 90 s before
Charles Miller finished.  For those truncated turns this step looks in the meeting's caption track for the first
speaker change ('>>') after the stored text where someone else takes the floor back ("Thank you", "Anyone else?",
"Mr. Jacobson, you can go ahead", "All in favor" ...) and ends the clip there.  Without caption markers it falls back to
the turn's original (pre-alignment) end, shifted by the alignment offset.  Never shortens a clip; caps at 180 s.
Runs in scripts/rebuild_all.sh after apply_leadin_trim.py.  Log: data/retime/turn_end_log.json
"""
import json, re, sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import retime_turns as R                     # noqa: E402

SEED = ROOT / "data/seed/speaker_turns.json"
INV = ROOT / "data/retime/ia_inventory.json"
LOG = ROOT / "data/retime/turn_end_log.json"
TITLES = {"mr", "mrs", "ms", "miss", "dr", "councilman", "councilwoman", "councilmember", "mayor", "director",
          "chairman", "commissioner", "president", "madam"}
CLOSE_START = ("thank you", "thanks", "appreciate", "anyone else", "anybody else", "is there anyone", "is there anybody",
               "any other", "any further", "all right anybody", "okay anybody", "all right anyone", "okay anyone",
               "okay thank", "all right thank", "that's time", "that is time", "your time", "time is up", "we'll move",
               "moving on", "all in favor", "all those in favor", "those in favor", "seeing none", "hearing none",
               "next up", "next speaker", "next item", "okay next")
HAND = ("go ahead", "unmute", "you have the floor", "come on up", "come forward", "state your name")
MAX_LEN, MIN_SPEECH, PAD = 180.0, 8.0, 0.2


def raw_words(ident, inv):
    """[(t, token)] from the word-timed caption file, keeping '>>' speaker-change tokens."""
    item = inv.get(ident, {})
    for name in (item.get("srt") or []) + (item.get("vtt") or []):
        f = R.SRT_DIR / f"{ident}__{name}"
        if not f.exists():
            continue
        txt = f.read_text(errors="ignore").replace("\r", "")
        txt = re.sub(r"</?(?:c|v|i|b|u|font)(?:[.\s][^>]*)?>", "", txt).replace("&gt;", ">").replace("&amp;", "&")
        words = []
        for b in re.split(r"\n\s*\n", txt):
            m = R.TS.search(b)
            if not m:
                continue
            t0 = R._sec(*m.groups()[0:4])
            for line in b[m.end():].strip("\n").split("\n"):
                if not R.WORD_TS.search(line):
                    continue
                parts, cur, k = R.WORD_TS.split(line), t0, 0
                while k < len(parts):
                    for w in parts[k].split():
                        words.append((cur, w))
                    if k + 1 < len(parts):
                        cur = R._sec(*parts[k + 1:k + 5])
                    k += 5
        if words:
            return words
    return []


def segments(words):
    """[(start_time, [normalized words])] split at '>>'."""
    segs, cur, t = [], [], None
    for tm, w in words:
        if w.startswith(">>"):
            if cur:
                segs.append((t, cur))
            cur, t = [], None
            w = w[2:]
            if not w:
                continue
        for n in R.norm_words(w):
            if t is None:
                t = tm
            cur.append(n)
    if cur:
        segs.append((t, cur))
    return segs


def takes_floor_back(ws):
    s = " ".join(ws[:14])
    if s.startswith(CLOSE_START):
        return True
    if any(h in s for h in HAND):
        return True
    # another person called by title: "Mr. Jacobson?"  "Councilman Moody."
    return any(ws[i] in TITLES and i + 1 < len(ws) and i <= 3 for i in range(min(len(ws), 5)))


def main():
    turns = json.loads(SEED.read_text())
    inv = json.loads(INV.read_text())
    todo = defaultdict(list)
    for t in turns:
        u = t.get("sourceMeetingMp4Url") or ""
        if t.get("videoTiming") not in ("realigned", "realigned_relinked") or "/download/" not in u:
            continue
        if t.get("legacyEndSec") is None or t.get("legacyStartSec") is None or t.get("callMovedFromSec"):
            continue
        full = ((t.get("textLeadIn") or "") + " " + (t.get("text") or "")).strip()
        if len(full) < 600:                      # not truncated: the alignment end IS the last spoken word
            continue
        S, E = float(t["startSec"]), float(t["endSec"])
        aligned_start = float(t.get("leadInPrevStartSec") or S)
        legacy_end = float(t["legacyEndSec"]) + (aligned_start - float(t["legacyStartSec"]))
        if legacy_end - E < 10:
            continue
        todo[u.split("/download/")[1].split("/")[0]].append((t, S, E, legacy_end))
    log, stats = [], Counter()
    for ident, items in sorted(todo.items()):
        segs = segments(raw_words(ident, inv))
        tw = None if segs and len(segs) > 20 else (R.load_transcript(ident, inv)[1] or [])
        for t, S, E, legacy_end in items:
            hi = min(S + MAX_LEN, legacy_end + 45)
            new, how = None, None
            if segs and len(segs) > 20:              # a caption file with real speaker-change markers
                for st, ws in segs:
                    if st is None or st < max(S + MIN_SPEECH, E - 2) or st > hi:
                        continue
                    if takes_floor_back(ws):
                        new, how = st - PAD, "caption_speaker_change"
                        break
            if new is None and tw:
                # no speaker markers: the chair's closing line in the plain transcript ("thank you mr miller anyone else",
                # "thank you anybody else", "thank you sir next") -- end just before it
                lo = max(S + MIN_SPEECH, E - 2)
                idx = [i for i, (tm, _) in enumerate(tw) if lo <= tm <= hi]
                for i in idx:
                    if tw[i][1] not in ("thank", "thanks"):
                        continue
                    nxt = " ".join(w for _, w in tw[i:i + 9])
                    if re.match(r"thanks?( you)?( (very|so) much)?( (mr|mrs|ms|miss|dr|sir|maam|councilman|councilwoman)( \w+)?)?"
                                r" (anyone|anybody|any other|is there|next|all right anybody|okay anybody|ok anybody|we ll move|"
                                r"moving on|we have|our next|hearing none|seeing none)", nxt):
                        new, how = tw[i][0] - PAD, "transcript_closing_phrase"
                        break
            if new is None:
                # last resort: the turn's original end, but never more than 40 s past the stored text
                # (calibrated on the 477 caption-marker ends: +40 s has the lowest mean error, ~30 s)
                new, how = min(S + MAX_LEN, legacy_end, E + 40), "original_end"
            new = round(min(new, S + MAX_LEN), 1)
            if new <= E + 1:
                stats["unchanged"] += 1
                continue
            t["endSecTextOnly"] = E
            t["endSec"] = new
            t["durationSec"] = round(new - S, 1)
            note = ("End extended to where the speaker finished (the stored transcript excerpt is shortened)."
                    if how in ("caption_speaker_change", "transcript_closing_phrase") else
                    "End time is approximate (within about 30 s): the stored transcript excerpt is shortened and this recording's "
                    "captions have no speaker-change markers.")
            t["videoTimingNote"] = ((t.get("videoTimingNote") or "") + " " + note).strip()
            stats[how] += 1
            log.append({"id": t["id"], "how": how, "oldEnd": E, "newEnd": new, "legacyEndShifted": round(legacy_end, 1)})
        del segs, tw
    SEED.write_text(json.dumps(turns, ensure_ascii=False, indent=1))
    LOG.write_text(json.dumps(log, indent=1))
    print("turn ends:", dict(stats))


if __name__ == "__main__":
    main()
