#!/usr/bin/env python3
"""Spot-verify apply_leadin_trim: transcribe the first 8 s of audio at the NEW start (and the old start) with
faster-whisper and report whether the turn's (trimmed) opening words are heard there.
Usage: verify_leadin_trim.py N [seed]   -> data/retime/leadin_verify.json"""
import json, random, subprocess, sys, difflib
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import retime_turns as R

def audio(url, s, d=8.0):
    p = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{s:.2f}", "-t", f"{d}", "-i", url, "-vn", "-ac", "1",
                        "-ar", "16000", "-f", "f32le", "-"], capture_output=True, timeout=180)
    return np.frombuffer(p.stdout, dtype=np.float32)

def overlap(heard, expect):
    a, b = R.norm_words(heard), R.norm_words(expect)[:12]
    if not a or not b: return 0.0
    m = difflib.SequenceMatcher(None, a, b).get_matching_blocks()
    return sum(x.size for x in m) / len(b)

def main():
    n = int(sys.argv[1]); random.seed(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
    turns = [t for t in json.loads((ROOT / "data/seed/speaker_turns.json").read_text()) if t.get("leadInPrevStartSec") is not None]
    import os
    if os.environ.get("IDS"):
        want = {int(x) for x in os.environ["IDS"].split(",")}; turns = [t for t in turns if t["id"] in want]
    model = WhisperModel("base.en", device="cpu", compute_type="int8", cpu_threads=2)
    out = []
    for t in random.sample(turns, min(n, len(turns))):
        u = t["sourceMeetingMp4Url"]; row = {"id": t["id"], "delta": round(t["startSec"] - t["leadInPrevStartSec"], 1)}
        for tag, s in (("new", t["startSec"]), ("old", t["leadInPrevStartSec"])):
            x = audio(u, s)
            segs, _ = model.transcribe(x, language="en", beam_size=1, vad_filter=False)
            row[tag] = " ".join(sg.text.strip() for sg in segs)
        row["expect"] = t["text"][:80]; row["leadIn"] = t.get("textLeadIn", "")[-60:]
        row["new_match"] = round(overlap(row["new"], t["text"]), 2)
        row["old_heard_leadin"] = round(overlap(row["old"], t.get("textLeadIn", "")), 2) if t.get("textLeadIn") else None
        out.append(row); print(json.dumps(row), flush=True)
    (ROOT / "data/retime/leadin_verify.json").write_text(json.dumps(out, indent=1))
    print("new start opens on the speaker's words (>=0.5 match):", sum(r["new_match"] >= 0.5 for r in out), "/", len(out))

if __name__ == "__main__":
    main()
