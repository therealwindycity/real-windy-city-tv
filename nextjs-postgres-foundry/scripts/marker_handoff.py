"""Speaker-change markers ('>>', from the caption track) -> where the labelled speaker takes the floor.

A turn's text often opens with the previous speaker's last words and the chair handing the floor over:
  "...thank you for having me here tonight. >> Appreciate you being here. Anyone else online?
   >> Mr. Miller, you should be able to unmute yourself. >> Mr. Miller. >> Uh, yes. Hi. Can you hear me? ..."
find_handoff() returns the index (in R.norm_words(text)) of the last word BEFORE the segment that follows the last
floor-handing segment, or (None, reason)."""
import difflib, re

TITLES = {"mr", "mrs", "ms", "miss", "dr", "doctor", "councilman", "councilwoman", "councilmember", "council", "member",
          "mayor", "director", "chairman", "chair", "commissioner", "president", "attorney", "chief", "madam", "sir"}
HAND = ("go ahead", "unmute", "you have the floor", "the floor is yours", "come on up", "come forward",
        "state your name", "you may proceed", "please proceed", "you're up", "you are up")
CHAIR_ROLES = ("mayor", "chair", "president", "presiding")
SELF_INTRO = ("my name is", "name is", "i am", "i'm", "this is", "for the record")
PROC = ("all right anybody", "anybody else", "anyone else", "any other", "thank you", "is there anyone", "all in favor", "all those", "those opposed", "motion carried", "motion passes", "seconded", "roll call",
        "next item", "item number", "the motion")


def _fz(w, name):
    return len(w) >= 3 and w[:2] == name[:2] and difflib.SequenceMatcher(None, w, name).ratio() >= 0.6


def find_handoff(text, speaker_name, role, norm):
    if ">>" not in (text or ""):
        return None, "no_markers"
    if any(r in (role or "").lower() for r in CHAIR_ROLES):
        return None, "chair_speaker"           # the chair's own speech is interleaved with everyone else's
    parts = [q for q in (re.sub(r"[^a-z]", "", p.lower()) for p in speaker_name.split()) if q and q not in TITLES]
    if not parts or speaker_name.lower().startswith("unidentified"):
        return None, "no_name"
    last, first = parts[-1], (parts[0] if len(parts) > 1 else "")
    segs, pos = [], 0
    for raw in text.split(">>"):
        w = norm(raw)
        if w:
            segs.append((pos, w)); pos += len(w)
    total = pos
    if len(segs) < 2:
        return None, "single_segment"
    hand, other_call = None, None
    for i, (p, w) in enumerate(segs[:-1]):
        if p > 0.7 * total:
            break
        s = " ".join(w)
        named = [j for j, x in enumerate(w) if _fz(x, last)]
        self_intro = any(first and j > 0 and _fz(w[j - 1], first) and (j < 2 or not w[j - 2] in TITLES) for j in named) \
            and any(x in s for x in SELF_INTRO + ("for the",)) or any(f"{x} {last}" in s for x in ("name is", "i'm", "i am"))
        if self_intro:
            break                                # the speaker introduces themself here: they are already talking
        def is_call(j):                          # "... Mr. Miller." / "Mr. Miller, you can go ahead" / "Mr. Miller, can you hear me"
            if "'" in w[j] or not (j > 0 and w[j - 1] in TITLES):
                return False
            after = " ".join(w[j + 1:j + 8])
            handed = any(h in after for h in HAND + ("can you hear",)) or after.startswith(("you can", "you may"))
            if not handed and " ".join(w[max(0, j - 4):j - 1]).endswith(("thank you", "thanks", "thank you uh", "thank you so much")):
                return False                     # the chair thanking them AFTER they spoke
            return len(w) - j <= 2 or any(after.startswith(h) or f" {h}" in f" {after}"[:40] for h in HAND + ("can you hear",)) \
                or after.startswith(("you can", "you should", "you may", "are you there", "you there"))
        if any(is_call(j) for j in named):
            hand = i
        elif any(h in s for h in HAND):
            other_call = i                       # floor handed to someone not named / someone else
    if hand is None:
        return None, ("handoff_to_other" if other_call is not None else "no_handoff")
    tgt = hand + 1
    tw = " ".join(segs[tgt][1][:8])
    if any(tw.startswith(p) for p in PROC):
        return None, "chair_procedure_after_handoff"
    return segs[tgt][0] - 1, "marker_handoff"
