#!/usr/bin/env python3
"""Independent spot-check: pull the actual audio at each re-timed clip's start from Internet Archive,
transcribe it with faster-whisper, and measure word overlap with the turn text."""
import json
import random
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
turns = json.loads((ROOT / "data/seed/speaker_turns.json").read_text())
N = int(sys.argv[1]) if len(sys.argv) > 1 else 24
random.seed(20261125)
pool = {k: [t for t in turns if t.get("videoTiming") == k] for k in ("realigned", "realigned_relinked", "diarized_window")}
sample = random.sample(pool["realigned"], N // 2) + random.sample(pool["realigned_relinked"], N // 4) + random.sample(pool["diarized_window"], N - N // 2 - N // 4)
model = WhisperModel("tiny.en", device="cpu", compute_type="int8", cpu_threads=2)


def words(s):
    return re.findall(r"[a-z0-9']+", s.lower())


rows = []
for t in sample:
    dur = min(25.0, float(t["durationSec"]))
    try:
        raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", str(t["startSec"]), "-t", str(dur), "-i", t["sourceMeetingMp4Url"],
                              "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, timeout=240).stdout
    except subprocess.TimeoutExpired:
        raw = b""
    if len(raw) < 16000:
        rows.append((t["id"], t["videoTiming"], None, "audio fetch failed"))
        print(t["id"], t["videoTiming"], "audio fetch failed", flush=True)
        continue
    audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
    heard = " ".join(s.text for s in model.transcribe(audio, language="en", beam_size=1)[0])
    hw = set(words(heard)) - {"the", "a", "and", "to", "of", "i", "you", "is", "that", "it", "uh", "um", "in"}
    tw = words(t["text"])
    # compare against the portion of the turn text that should be audible in the first `dur` seconds
    expect = set(tw[: max(12, int(len(tw) * dur / max(1.0, float(t["durationSec"]))) + 10)]) - {"the", "a", "and", "to", "of", "i", "you", "is", "that", "it", "uh", "um", "in"}
    overlap = len(hw & expect) / max(1, len(expect))
    rows.append((t["id"], t["videoTiming"], round(overlap, 2), heard.strip()[:90]))
    print(t["id"], t["videoTiming"], round(overlap, 2), "|", heard.strip()[:90], flush=True)

ok = [r for r in rows if r[2] is not None]
good = [r for r in ok if r[2] >= 0.35]
summary = {"sampled": len(rows), "audio_ok": len(ok), "match_ge_0.35": len(good),
           "median_overlap": sorted(r[2] for r in ok)[len(ok) // 2] if ok else None, "rows": rows}
(ROOT / "data/retime/audit_sample.json").write_text(json.dumps(summary, indent=1))
print({k: v for k, v in summary.items() if k != "rows"})
