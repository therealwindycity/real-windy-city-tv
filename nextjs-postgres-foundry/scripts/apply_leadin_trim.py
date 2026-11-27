#!/usr/bin/env python3
"""Start speaker-turn videos where the labelled speaker starts, not on the chair's call.

Turn boundaries came from captions (no speaker-change markers), so hundreds of turns open with someone else
calling on the speaker:  "...any other comments, Mr. President?  Mr. Laybourn.  | Well, I'm not sure how..."
For those, the speaker's first word is the word right after the name-call.  This step:
  1. finds a name-call that ends in the labelled speaker's surname within the turn's first 25 words, preceded by a
     title (Mr / Dr / Councilman / Mayor ...), NOT a self-introduction ("my name is ..."), NOT a roll-call answer,
     and NOT followed by chair procedure ("all in favor", "seconded", "motion carried" ...) -- those turns are
     mislabelled chair speech, which no start time can fix, and are left alone (logged as label_suspect);
  2. locates that word in the meeting's timed transcript (word LCS on the turn's own diagonal, 3 confirming matches);
  3. moves startSec there (minus 0.3 s), keeps endSec, and trims the lead-in from the displayed text
     (kept in `textLeadIn`).
Writes data/retime/leadin_trim_log.json.  Runs inside scripts/rebuild_all.sh after finalize_clips.py.
"""
import bisect, difflib, json, re, sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import retime_turns as R                    # noqa: E402
from audit_start_times import lcs_pairs      # noqa: E402
from marker_handoff import find_handoff      # noqa: E402

SEED = ROOT / "data/seed/speaker_turns.json"
LOG = ROOT / "data/retime/leadin_trim_log.json"
INV = ROOT / "data/retime/ia_inventory.json"
TIMED = ("realigned", "realigned_relinked", "diarized_window")

TITLES = {"mr", "mrs", "ms", "miss", "dr", "doctor", "councilman", "councilwoman", "councilmember", "council",
          "member", "mayor", "director", "chairman", "chair", "commissioner", "president", "attorney", "chief",
          "senator", "representative", "officer", "sergeant", "captain", "judge", "madam", "sir"}
SELF_INTRO = ("my name is", "name is", "i am", "i'm", "this is", "i m")
PROC_START = ("all in favor", "all those", "any further", "any other", "next item", "motion carried", "motion passes",
              "motion fails", "voting", "seconded", "second by", "moved to", "moved by", "move by", "raises",
              "opened a public", "s ", "has the floor", "is recognized", "thank you any", "further discussion",
              "public comment", "any public", "any comments", "any questions", "next on", "item number",
              "discussion", "questions", "are you", "you want", "do you", "would you", "can you", "did you",
              "go ahead", "you can", "you have", "you may", "please")
FILLERS = {"uh", "um", "uhm", "er", "ah", "oh"}
NOT_A_CALL_BEFORE = {"by", "asked", "ask", "told", "with", "and", "from", "said", "says", "what", "for", "about", "of",
                     "like", "as", "that", "whom", "which"}
# a name followed by one of these is being talked ABOUT (or the caller keeps talking), not handed the floor
MENTION_NEXT = {"is", "was", "said", "says", "has", "had", "did", "does", "likes", "made", "wants", "mentioned",
                "asked", "brought", "raised", "raises", "will", "would", "could", "can", "and", "s", "just", "also",
                "pointed", "noted", "stated", "talked", "indicated", "suggested", "seconded", "moved",
                "about", "for", "during", "to", "on", "in", "at", "of", "with", "from", "because", "that",
                "you", "your", "appreciate", "indicated", "spoke", "referred", "talked", "agreed", "or", "as"}
ROLL = {"yes", "no", "aye", "nay", "here", "present", "absent"}
PAD, MIN_MOVE, MAX_MOVE, MIN_LEFT = 0.3, 1.0, 60.0, 5.0


def fuzzy(w, name):
    return len(w) >= 3 and w[:2] == name[:2] and difflib.SequenceMatcher(None, w, name).ratio() >= 0.6


def find_call(words, speaker_name):
    """-> (k, reason): k = index of the surname word ending the name-call, or None with a reason."""
    parts = [q for q in (re.sub(r"[^a-z]", "", p.lower()) for p in speaker_name.split()) if q and q not in TITLES]
    last, first = parts[-1], (parts[0] if len(parts) > 1 else "")
    hits = [i for i, w in enumerate(words[:25]) if fuzzy(w, last)]
    if not hits:
        return None, "no_name_call"
    k = hits[-1]
    if k == 0 or k + 6 >= len(words):
        return None, "no_name_call"
    if first and fuzzy(words[k - 1], first):
        return None, "self_introduction"      # full names are self-introductions / mentions, not chair calls
    before = words[max(0, k - 2):k]
    if not any(b in TITLES or (first and fuzzy(b, first)) for b in before):
        return None, "name_not_a_call"
    ctx = " ".join(words[max(0, k - 6):k])
    nxt0 = next((w for w in words[k + 1:k + 4] if w not in FILLERS), "")
    if any(p in ctx for p in SELF_INTRO) or "council members" in ctx or "members of" in ctx or nxt0.isdigit():
        return None, "self_introduction"
    # the call may continue after the name: "Councilman Moody, you can go ahead." -> speaker starts after it
    GO_AHEAD = (("you", "can", "go", "ahead"), ("you", "may", "go", "ahead"), ("please", "go", "ahead"), ("go", "ahead"),
                ("you", "may", "proceed"), ("please", "proceed"), ("you", "have", "the", "floor"))
    j = k + 1
    while j < len(words) and words[j] in FILLERS:
        j += 1
    for g in GO_AHEAD:
        if tuple(words[j:j + len(g)]) == g:
            k = j + len(g) - 1
            while k + 1 < len(words) and words[k + 1] in ("right", "sir", "please", "maam", "ma"):
                k += 1
            if k + 6 >= len(words):
                return None, "no_name_call"
            explicit_call = True
            break
    else:
        explicit_call = False
    rest = [w for w in words[k + 1:k + 10] if w not in FILLERS]
    pre = " ".join(words[max(0, k - 4):k])
    OPENERS = ("can you hear", "hello", "hi ", "good evening", "good afternoon", "good morning", "thank you")
    if explicit_call or "go ahead" in pre or "recogniz" in pre or any((" ".join(rest) + " ").startswith(o) for o in OPENERS):
        nxt = " ".join(rest[:6]) + " "
        CALLER_CONTINUES = ("are you", "you want", "do you", "would you", "can you", "did you", "go ahead", "you can",
                            "you have", "you may", "please")
        if any(nxt.startswith(p) for p in PROC_START if p not in CALLER_CONTINUES):
            return None, "label_suspect_chair_procedure"
        return k, "name_call"
    # member addresses the chair ("Mayor?" / "Mr. Mayor?" / "Mr. Chair?") and the chair names them ("Mr. White.")
    CHAIR_ADDR = {"mayor", "chair", "chairman", "chairwoman", "president", "madam"}
    short_recognition = (2 <= k <= 3 and all(w in TITLES or w in FILLERS for w in words[:k])
                         and any(w in CHAIR_ADDR for w in words[:k - 1]) and words[k - 1] in TITLES)
    if short_recognition:                      # "Mayor? -- Mr. White. -- Just a quick comment..."
        nxt = " ".join(rest[:6]) + " "
        if (rest and rest[0] in ROLL) or any(w in ("present", "here", "absent") for w in rest[:5]):
            return None, "roll_call"
        if any(nxt.startswith(p) for p in PROC_START):
            return None, "label_suspect_chair_procedure"
        return k, "name_call"
    lead = [w for w in words[max(0, k - 4):k] if w not in TITLES and not (first and fuzzy(w, first))]
    if lead and lead[-1] in NOT_A_CALL_BEFORE or " ".join(lead[-2:]) in ("thank you", "thanks to"):
        return None, "label_suspect_motion_or_mention"
    nxt = " ".join(rest[:6]) + " "
    if words[k].endswith("s") and not last.endswith("s") or (rest and rest[0] in MENTION_NEXT):
        return None, "label_suspect_motion_or_mention"
    if (rest and rest[0] in ROLL) or any(w in ("present", "here", "absent") for w in rest[:5] + words[max(0, k - 6):k]):
        return None, "roll_call"
    if any(nxt.startswith(p) for p in PROC_START):
        return None, "label_suspect_chair_procedure"
    return k, "name_call"


def locate(words, k, tw, times, S, end):
    lo, hi = bisect.bisect_left(times, S - 15), bisect.bisect_right(times, end + 10)
    win = tw[lo:hi]
    if not win:
        return None
    pairs = lcs_pairs(words[:max(120, k + 40)], [w for _, w in win])
    if len(pairs) < 8:
        return None
    diag = sorted(j - i for i, j in pairs)[len(pairs) // 2]
    pairs = [(i, j) for i, j in pairs if abs((j - i) - diag) <= 12]
    after = [(i, j) for i, j in pairs if i > k][:3]
    if len(after) < 3 or after[0][0] > k + 3 or after[2][0] > k + 10:
        return None
    return win[after[0][1]][0] - (after[0][0] - (k + 1)) * 0.4


def main():
    turns = json.loads(SEED.read_text())
    inv = json.loads(INV.read_text())
    by_ident, log, why_of = defaultdict(list), [], {}
    suspect_ids = set()
    for t in turns:
        u = t.get("sourceMeetingMp4Url") or ""
        if t.get("videoTiming") not in TIMED or "/download/" not in u or t.get("startSec") is None:
            continue
        words = R.norm_words(t.get("text") or "")
        # caption speaker-change markers ('>>') first: they show exactly where the floor was handed over
        k, why = find_handoff(t.get("text") or "", t["speakerName"], t.get("speakerRole"), R.norm_words)
        if k is None:
            k, why = find_call(words, t["speakerName"])
        ent = {"id": t["id"], "speaker": t["speakerSlug"], "decision": why}
        if k is None:
            if why.startswith("label_suspect"):
                suspect_ids.add(t["id"])
            if why != "no_name_call":
                ent["head"] = " ".join(words[:k if k else 14][:24]); log.append(ent)
            continue
        ent["leadIn"] = " ".join(words[:k + 1])
        why_of[t["id"]] = why
        by_ident[u.split("/download/")[1].split("/")[0]].append((t, words, k, ent))
        log.append(ent)

    MINUTES = re.compile(r'Voting “(yes|no)”|Comments? (was|were) made by the following|carried\. Voting')
    REASON = {
        "label_suspect_chair_procedure": "After {n} is called on, the words in this clip are the presiding officer's or clerk's "
                                         "(motions, votes, next item), not {n}'s. The caption-based speaker label is unverified.",
        "label_suspect_motion_or_mention": "{n} is only named here (a motion, a second, or a reference); the person speaking "
                                           "in this clip may be someone else. The caption-based speaker label is unverified.",
        "minutes_text": "This turn's text is the written meeting minutes, not a transcript of speech, so the clip may not show "
                        "{n} speaking. The speaker label is unverified.",
    }
    flagged = Counter()
    for t in turns:
        if t.get("videoTiming") not in TIMED:
            continue
        e = next((x for x in log if x["id"] == t["id"]), None) if t["id"] in suspect_ids else None
        why = e["decision"] if e and e["decision"] in REASON else None
        if MINUTES.search(t.get("text") or "") and (t.get("alignScore") or 1) < 0.5:
            why = "minutes_text"
        if why and t.get("speakerAttributionVerified") is not False:
            t["speakerAttributionVerified"] = False
            t["speakerUnverifiedReason"] = REASON[why].format(n=t["speakerName"])
            t["videoTimingNote"] = ((t.get("videoTimingNote") or "") + " " + t["speakerUnverifiedReason"]).strip()
            flagged[why] += 1
    print("speaker label flagged unverified:", dict(flagged))

    for ident, items in sorted(by_ident.items()):
        _, tw = R.load_transcript(ident, inv)
        times = [x[0] for x in tw] if tw else []
        for t, words, k, ent in items:
            S, end = float(t["startSec"]), float(t["endSec"])
            when = locate(words, k, tw, times, S, end) if tw else None
            if when is None:
                ent["decision"] = "not_located"; continue
            new = round(max(0.0, when - PAD), 1)
            d = new - S
            if d < MIN_MOVE:
                ent.update(decision="already_ok", delta=round(d, 1)); continue
            max_move = 150.0 if ent.get("decision") == "marker_handoff" or why_of.get(t["id"]) == "marker_handoff" else MAX_MOVE
            if d > max_move or end - new < (20.0 if d > MAX_MOVE else MIN_LEFT):
                ent.update(decision="move_rejected", delta=round(d, 1)); continue
            # trim the displayed text: drop original tokens covering norm-words 0..k
            toks, seen, cut = t["text"].split(), 0, None
            for ti, tok in enumerate(toks):
                seen += len(R.norm_words(tok))
                if seen >= k + 1:
                    cut = ti + 1; break
            ent.update(decision="moved", oldStart=S, newStart=new, delta=round(d, 1))
            t["leadInPrevStartSec"] = S
            t["startSec"] = new
            t["durationSec"] = round(end - new, 1)
            sec = int(new); t["hms"] = f"{sec // 3600:02d}:{sec % 3600 // 60:02d}:{sec % 60:02d}"
            if cut and cut < len(toks) - 3:
                rest = " ".join(toks[cut:]).lstrip(",.;:-> ")
                t["textLeadIn"] = " ".join(toks[:cut])
                t["text"] = rest[:1].upper() + rest[1:]
            note = f"Start moved {d:+.1f}s past the chair's call to the speaker's first word."
            t["videoTimingNote"] = ((t.get("videoTimingNote") or "") + " " + note).strip()
        del tw, times

    SEED.write_text(json.dumps(turns, ensure_ascii=False, indent=1))
    LOG.write_text(json.dumps(log, indent=1))
    print("lead-in trim:", dict(Counter(e["decision"] for e in log)))


if __name__ == "__main__":
    main()
