#!/usr/bin/env python3
"""Turns whose text ENDS with the labelled speaker being handed the floor -- "...any public discussion? Okay, hearing
none. Mr. Roybal" / "...go ahead, Mr. Miller" / "...good evening, my name is Tom Jacobson" -- show the chair's speech
BEFORE that person talks: the caption-based segmentation put the speaker's name on the stretch that precedes them.
For those, the clip is moved to start at the call and end where someone else takes the floor (caption speaker change /
chair's closing line, else +60 s), and the displayed text is re-read from the recording's captions for the new window
(old text kept in `textBeforeCall`).  Runs in rebuild_all.sh after apply_leadin_trim.py, before fix_turn_ends.py.
Log: data/retime/trailing_call_log.json"""
import json, re, sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import retime_turns as R                                   # noqa: E402
from apply_retime import raw_text_window                    # noqa: E402
from fix_turn_ends import raw_words, segments, takes_floor_back   # noqa: E402

SEED = ROOT / "data/seed/speaker_turns.json"
INV = ROOT / "data/retime/ia_inventory.json"
TITLES = {"mr", "mrs", "ms", "miss", "dr", "councilman", "councilwoman", "councilmember", "director", "commissioner",
          "chief", "attorney"}
CHAIR_ROLES = ("mayor", "chair", "president", "presiding")
NOT_CALL_BEFORE = {"by", "thank", "thanks", "with", "and", "said", "asked", "from", "to", "for", "about", "made"}
TIMED = ("realigned", "realigned_relinked", "diarized_window")


def trailing_call(words, name):
    """-> index in words of the call's first word, or None."""
    parts = [q for q in (re.sub(r"[^a-z]", "", p.lower()) for p in name.split()) if q and q not in TITLES and q != "mayor"]
    if not parts or len(words) < 20:
        return None
    last, first = parts[-1], (parts[0] if len(parts) > 1 else "")
    n = len(words)
    for j in range(max(1, n - 10), n):
        if words[j] != last:
            continue
        rest = words[j + 1:]
        # (c) self-introduction by full name: "my name is tom jacobson" / "this is charles miller for the ..."
        if first and words[j - 1] == first:
            pre = " ".join(words[max(0, j - 5):j - 1])
            if pre.endswith(("my name is", "name is", "this is", "i am", "i'm", "evening", "afternoon", "morning")) or \
               " ".join(rest[:3]).startswith("for the"):
                return max(0, j - 4)
            continue
        if words[j - 1] not in TITLES:
            continue
        if any(x in ("roll", "clerk", "call", "called", "present", "here") for x in words[max(0, j - 9):j - 1]):
            continue                                       # the clerk calling the roll
        before = words[j - 2] if j >= 2 else ""
        if before in NOT_CALL_BEFORE or (before == "you" and j >= 3 and words[j - 3] in ("thank", "thanks")):
            continue
        # (a) bare call as the last words  /  (b) call + go ahead (either order)
        if len(rest) <= 1 or " ".join(rest[:3]).startswith(("go ahead", "you can go", "you may")) or \
           " ".join(words[max(0, j - 4):j - 1]).endswith(("go ahead", "hearing none", "seeing none")):
            return j - 1
    return None


def main():
    turns = json.loads(SEED.read_text())
    inv = json.loads(INV.read_text())
    todo = defaultdict(list)
    for t in turns:
        u = t.get("sourceMeetingMp4Url") or ""
        if t.get("videoTiming") not in TIMED or "/download/" not in u or t.get("startSec") is None:
            continue
        if any(r in (t.get("speakerRole") or "").lower() for r in CHAIR_ROLES) or t.get("leadInPrevStartSec"):
            continue
        words = R.norm_words(t.get("text") or "")
        j = trailing_call(words, t["speakerName"])
        if j is not None:
            todo[u.split("/download/")[1].split("/")[0]].append((t, words, j))
    log, stats = [], Counter()
    for ident, items in sorted(todo.items()):
        _, tw = R.load_transcript(ident, inv)
        segs = segments(raw_words(ident, inv))
        marked = len(segs) > 20
        for t, words, j in items:
            S, E = float(t["startSec"]), float(t["endSec"])
            # time of the call: proportional position inside [S, E] refined to the nearest transcript word
            approx = S + (E - S) * j / max(1, len(words))
            cands = [(abs(tm - approx), tm) for tm, w in (tw or []) if w == words[j] and S - 2 <= tm <= E + 2]
            call_t = min(cands)[1] if cands else approx
            new_s = round(max(S, call_t - 0.3), 1)
            new_e, how = None, None
            if marked:
                for st, ws in segs:
                    if st is not None and new_s + 12 <= st <= new_s + 180 and takes_floor_back(ws):
                        new_e, how = st - 0.2, "caption_speaker_change"; break
            if new_e is None:
                new_e, how = new_s + 60.0, "plus_60s"
            txt = raw_text_window(ident, inv, new_s, new_e)
            if any(x in ("present", "here", "absent") for x in R.norm_words(txt)[:6]) or \
               any(x in ("call", "roll", "clerk") for x in R.norm_words(txt)[:4]):
                stats["roll_call"] += 1
                continue
            if len(R.norm_words(txt)) < 8:
                stats["no_speech_after_call"] += 1
                continue
            t["textBeforeCall"] = t["text"]
            t["text"] = txt[:700].strip()
            t["callMovedFromSec"] = [S, E]
            t["startSec"], t["endSec"] = new_s, round(new_e, 1)
            t["durationSec"] = round(new_e - new_s, 1)
            sec = int(new_s); t["hms"] = f"{sec // 3600:02d}:{sec % 3600 // 60:02d}:{sec % 60:02d}"
            note = ("Clip moved to where this speaker is handed the floor; the earlier window showed the presiding "
                    "officer before they spoke." + ("" if how == "caption_speaker_change" else " End time is approximate."))
            t["videoTimingNote"] = ((t.get("videoTimingNote") or "") + " " + note).strip()
            stats[how] += 1
            log.append({"id": t["id"], "speaker": t["speakerSlug"], "old": [S, E], "new": [new_s, round(new_e, 1)],
                        "how": how, "call": " ".join(words[j:j + 6])})
        del tw, segs
    SEED.write_text(json.dumps(turns, ensure_ascii=False, indent=1))
    (ROOT / "data/retime/trailing_call_log.json").write_text(json.dumps(log, indent=1))
    print("trailing calls:", dict(stats))


if __name__ == "__main__":
    main()
