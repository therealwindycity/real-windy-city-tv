#!/usr/bin/env python3
"""Display clean-up, LAST text step (the timing steps read the markers): caption speaker-change markers '>>' are
shown as ' — ' between speakers and dropped at the start of a text.  Raw text stays in the pre-retime backup."""
import json, re
from pathlib import Path
SEED = Path(__file__).resolve().parent.parent / "data/seed/speaker_turns.json"
turns = json.loads(SEED.read_text())
n = 0
for t in turns:
    for k in ("text", "textLeadIn"):
        s = t.get(k)
        if s and ">>" in s:
            s2 = re.sub(r"^\s*(>>\s*)+", "", s)
            s2 = re.sub(r"\s*(>>\s*)+", " — ", s2).strip()
            s2 = s2[:1].upper() + s2[1:]
            t[k] = s2; n += 1
SEED.write_text(json.dumps(turns, ensure_ascii=False, indent=1))
print(f"clean_text_markers: {n} texts cleaned")
