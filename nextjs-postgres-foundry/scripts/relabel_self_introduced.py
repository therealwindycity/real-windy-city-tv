#!/usr/bin/env python3
"""Machine-labelled turns (diarized_window: speaker came from automatic voice clustering, flagged unverified) whose
text contains the speaker's own self-introduction by full name -- "Charles Miller, for the record ..." /
"my name is Seth Lloyd" -- right after a speaker change, get that person's label when the name is on the verified
roster.  The self-introduced speaker must open a '>>' segment (so it is not someone else quoting the name) and be the
only roster name introduced.  Runs in rebuild_all.sh after apply_leadin_trim.py.  Log: data/retime/relabel_log.json"""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data/seed/speaker_turns.json"
DIR = json.load(open(ROOT / "data/seed/speakers_directory.json"))
TITLE = r"(?:mayor|councilman|councilwoman|council member|dr\.?|mr\.?|mrs\.?|ms\.?|chief|director|attorney)\s+"
INTRO_BEFORE = r"(?:my name is|name is|this is|i'?m|i am|hi,?|hello,?|uh,?|um,?|yes,?|okay,?|ok,?|all right\.?,?|well,?)"
roster = []
for s in DIR:
    nm = re.sub("^" + TITLE, "", s["name"], flags=re.I).strip()
    parts = nm.split()
    if len(parts) >= 2 and not s["slug"].startswith("unidentified"):
        roster.append((s, parts[0].lower(), parts[-1].lower()))


def intro_of(seg):
    """roster entries introduced at the start of this speaker segment (first ~14 words)."""
    head = " ".join(seg.lower().replace(",", " ").split()[:14])
    hits = []
    for s, first, last in roster:
        m = re.search(rf"\b{re.escape(first)}\s+(?:\w\.?\s+)?{re.escape(last)}\b", head)
        if not m:
            continue
        before, after = head[:m.start()].strip(), head[m.end():m.end() + 70]
        ok_before = before == "" or re.fullmatch(rf"(?:{INTRO_BEFORE}\s*)+", before + " ") is not None \
            or before.endswith(("my name is", "this is", "i'm", "i am"))
        if ok_before and (re.search(r"for the (?:\w+ )*record|speaking|resident|representing|with the|ward|at \d|address|i live", after)
                          or before.endswith(("my name is", "this is", "i'm", "i am"))):
            hits.append(s)
    return hits


turns = json.loads(SEED.read_text())
log = []
for t in turns:
    if t.get("videoTiming") != "diarized_window" or ">>" not in (t.get("text") or "") + (t.get("textLeadIn") or ""):
        continue
    full = ((t.get("textLeadIn") or "") + " >> " + (t.get("text") or "")) if t.get("textLeadIn") else t["text"]
    segs = [x.strip(" -—") for x in full.split(">>") if x.strip()]
    found, before = {}, 0
    for i, seg in enumerate(segs):
        for s in intro_of(seg):
            last = next(l for r, f, l in roster if r is s)
            called = any(re.search(rf"\b(?:{TITLE.strip()})\s*{re.escape(last)}\b", x.lower()) for x in segs[:i])
            # the introduced person must be the one this clip is about: they speak near the start, or the chair
            # handed THEM the floor just before (apply_leadin_trim then starts the clip at the handoff)
            if before <= 25 or called:
                found[s["slug"]] = s
        before += len(seg.split())
    if len(found) != 1:
        continue
    s = next(iter(found.values()))
    if s["slug"] == t["speakerSlug"]:
        t["speakerAttributionVerified"] = True
        t["speakerUnverifiedReason"] = None
        t["videoTimingNote"] = "Text transcribed from this recording at these times; the speaker introduces themself by name in the clip."
        log.append({"id": t["id"], "action": "confirmed", "speaker": s["slug"]})
        continue
    log.append({"id": t["id"], "action": "relabelled", "from": t["speakerSlug"], "to": s["slug"]})
    t["speakerSlugDiarized"] = t["speakerSlug"]
    t["speakerSlug"], t["speakerName"], t["speakerRole"] = s["slug"], s["name"], s["role"]
    t["speakerAttributionVerified"] = True
    t["speakerUnverifiedReason"] = None
    t["videoTimingNote"] = ("Text transcribed from this recording at these times; the speaker introduces themself by name "
                            "in the clip (the automatic voice-cluster label was wrong and has been corrected).")
SEED.write_text(json.dumps(turns, ensure_ascii=False, indent=1))
(ROOT / "data/retime/relabel_log.json").write_text(json.dumps(log, indent=1))
print("relabel_self_introduced:", {a: sum(1 for x in log if x["action"] == a) for a in ("relabelled", "confirmed")})
