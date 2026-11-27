#!/usr/bin/env python3
"""Attach re-rendered branded clips (Release branded-clips-v1) and set accurate withheld reasons."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data/seed"
REL = "https://github.com/therealwindycity/real-windy-city-tv/releases/download/branded-clips-v1/rwc-turn-{}.mp4"
RECOVERED = [721, 841, 1883]   # now linked to the correct recording, re-rendered, audio + transcript verified
WITHHELD = {
    34: "The diarized window is pre-meeting silence in the recording; there is no speech to clip.",
    35: "The diarized window is pre-meeting silence in the recording; there is no speech to clip.",
    205: "The Internet Archive copy of this meeting is corrupt after ~4 minutes, so a branded clip cannot be cut; "
         "the in-page player streams the City of Cheyenne YouTube original at the correct timestamp instead.",
}
# branded clips whose audio (Whisper check 2026-11-27) is NOT the labelled speaker -> unbranded, label flagged
NOT_THE_SPEAKER = {
    336: "The audio is the mayor ending Charles Miller's time and the next public commenter (Sarah Morgan), not Charles "
         "Miller speaking, so this turn no longer has a branded clip and its speaker label is unverified.",
    1142: "The audio is the presiding officer (the mayor) taking the vote and calling the next item, not Bryan Cook, so "
          "this turn no longer has a branded clip and its speaker label is unverified.",
}

turns = json.loads((SEED / "speaker_turns.json").read_text())
for t in turns:
    if t["id"] in RECOVERED:
        assert (ROOT / f"public/rendered-clips/rwc-turn-{t['id']}.mp4").exists()
        t["brandedMp4Url"] = REL.format(t["id"])
        t.pop("brandedClipWithheldReason", None)
    elif t["id"] in NOT_THE_SPEAKER:
        t["brandedMp4Url"] = None
        t["brandedClipWithheldReason"] = NOT_THE_SPEAKER[t["id"]]
        t["speakerAttributionVerified"] = False
        t["speakerUnverifiedReason"] = NOT_THE_SPEAKER[t["id"]]
    elif t["id"] in WITHHELD:
        t["brandedMp4Url"] = None
        t["brandedClipWithheldReason"] = WITHHELD[t["id"]]
(SEED / "speaker_turns.json").write_text(json.dumps(turns, ensure_ascii=False, indent=1))
b = [t["id"] for t in turns if t.get("brandedMp4Url")]
print("branded clips:", len(b), b)
print("withheld:", {t["id"]: t["brandedClipWithheldReason"][:60] for t in turns if t.get("brandedClipWithheldReason")})
