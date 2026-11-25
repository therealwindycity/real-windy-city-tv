#!/usr/bin/env python3
"""
Transcribes Internet Archive cochwy-* MP3 audio with faster-whisper (base.en, int8, CPU) so that
speaker turns in items WITHOUT IA captions can be re-timed by text alignment (retime_turns.py).

- Streams 10-minute chunks (16 kHz mono s16le via ffmpeg pipe) -> low RAM (fits in 1 GB)
- Prefetches the next MP3 while the current one is transcribed
- Resume-safe: skips items whose data/retime/asr/<ident>.json already exists
- MP3s are cached under ~/.cache/rwc_asr and deleted after use

Usage: python3 asr_ia_audio.py <ident> [<ident> ...]     or     python3 asr_ia_audio.py --from-file list.txt
"""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
RT = ROOT / "data/retime"
ASR_DIR = RT / "asr"
ASR_DIR.mkdir(parents=True, exist_ok=True)
CACHE = Path.home() / ".cache/rwc_asr"
CACHE.mkdir(parents=True, exist_ok=True)
CHUNK = 300.0
MODEL = os.environ.get("RWC_ASR_MODEL", "tiny.en")


def mp3_path(ident, inv):
    name = (inv.get(ident, {}).get("mp3") or [None])[0]
    return name, CACHE / f"{ident}.mp3"


def download(ident, inv):
    name, dest = mp3_path(ident, inv)
    if not name:
        return None
    if dest.exists() and dest.stat().st_size > 10000:
        return dest
    url = f"https://archive.org/download/{ident}/{urllib.parse.quote(name)}"
    tmp = dest.with_suffix(".part")
    for attempt in range(4):
        try:
            subprocess.run(["curl", "-sL", "--fail", "--retry", "3", "--max-time", "3600", "-o", str(tmp), url], check=True)
            tmp.rename(dest)
            return dest
        except Exception:
            time.sleep(5 * (attempt + 1))
    return None


def duration(p):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], text=True)
    return float(out.strip())


def chunk_audio(p, start, dur):
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", str(p),
         "-ar", "16000", "-ac", "1", "-f", "s16le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def transcribe(model, ident, p):
    total = duration(p)
    segs = []
    t = 0.0
    while t < total:
        a = chunk_audio(p, t, CHUNK)
        if a.size < 1600:
            break
        out, _ = model.transcribe(a, language="en", beam_size=1, vad_filter=True,
                                  condition_on_previous_text=False)
        for s in out:
            txt = s.text.strip()
            if txt:
                segs.append({"start": round(t + s.start, 2), "end": round(t + s.end, 2), "text": txt})
        t += CHUNK
    return segs, total


def main(idents):
    inv = json.loads((RT / "ia_inventory.json").read_text())
    todo = [i for i in idents if not (ASR_DIR / f"{i}.json").exists()]
    print(f"[asr] {len(todo)} items to transcribe ({len(idents) - len(todo)} already done)", flush=True)
    model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=int(os.environ.get("RWC_ASR_THREADS", "1")))
    prefetch = {}

    def start_prefetch(k):
        if k < len(todo) and todo[k] not in prefetch:
            th = threading.Thread(target=lambda i=todo[k]: prefetch.__setitem__(i, download(i, inv)), daemon=True)
            prefetch[todo[k]] = th
            th.start()

    start_prefetch(0)
    t_all = time.time()
    audio_done = 0.0
    for k, ident in enumerate(todo):
        v = prefetch.get(ident)
        if isinstance(v, threading.Thread):
            v.join()
        p = prefetch.get(ident)
        start_prefetch(k + 1)
        if not isinstance(p, Path) or not p.exists():
            print(f"[asr] {k + 1}/{len(todo)} {ident}: MP3 download FAILED", flush=True)
            continue
        t0 = time.time()
        try:
            segs, total = transcribe(model, ident, p)
        except Exception as e:
            print(f"[asr] {k + 1}/{len(todo)} {ident}: ERROR {e}", flush=True)
            continue
        (ASR_DIR / f"{ident}.json").write_text(json.dumps(segs))
        p.unlink(missing_ok=True)
        audio_done += total
        el = time.time() - t0
        print(f"[asr] {k + 1}/{len(todo)} {ident}: {total / 60:.0f} min audio in {el / 60:.1f} min "
              f"({total / max(1, el):.0f}x) {len(segs)} segs | cumulative {audio_done / 3600:.1f} h in {(time.time() - t_all) / 60:.0f} min",
              flush=True)
    print("[asr] DONE", flush=True)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--from-file":
        ids = [l.strip() for l in open(sys.argv[2]) if l.strip()]
    else:
        ids = sys.argv[1:]
    main(ids)
