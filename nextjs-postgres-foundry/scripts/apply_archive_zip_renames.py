#!/usr/bin/env python3
"""Point speaker-ZIP links at the relabelled cheyenne-archives release assets (see relabel_archive_releases.py):
automatically named ZIPs ("Speaker_03_Councilman_Larry_Wolf_14_clips.zip") are now "Speaker_03_Unverified_Voice_14_..."."""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data/seed"
REN = json.load(open(ROOT / "data/retime/archive_zip_renames.json"))
URL = re.compile(r"https://github\.com/therealwindycity/(cheyenne-archives-[\d-]+)/releases/download/([^/]+)/([^/?#\"]+)")


def fix(s):
    def sub(m):
        new = REN.get(f"{m.group(1)}/{m.group(2)}/{m.group(3)}")
        return m.group(0) if not new else m.group(0)[: -len(m.group(3))] + new
    out = URL.sub(sub, s)
    for k, v in REN.items():            # visible labels ("Speaker ZIP: <old name>")
        old = k.rsplit("/", 1)[1]
        if old in out and out.startswith("Speaker ZIP:"):
            out = out.replace(old, v)
    return out


n = 0
turns = json.loads((SEED / "speaker_turns.json").read_text())
for t in turns:
    u = t.get("speakerZipUrl")
    if u and fix(u) != u:
        t["speakerZipUrl"] = fix(u); n += 1
(SEED / "speaker_turns.json").write_text(json.dumps(turns, ensure_ascii=False, indent=1))
meetings = json.loads((SEED / "meetings.json").read_text())
for m in meetings:
    for l in m.get("extraLinks") or []:
        for k in ("url", "label"):
            if isinstance(l.get(k), str) and fix(l[k]) != l[k]:
                l[k] = fix(l[k]); n += 1
(SEED / "meetings.json").write_text(json.dumps(meetings, ensure_ascii=False, indent=1))
print("archive zip links relabelled:", n)
