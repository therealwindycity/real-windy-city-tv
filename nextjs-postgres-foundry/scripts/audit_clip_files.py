#!/usr/bin/env python3
"""Audit the 62 self-contained clip files (29 branded + 33 pre-cut): where do the turn's words start inside the file?

Downloads only the first HEAD seconds of each file (ffmpeg), transcribes them with faster-whisper (word timestamps),
and finds the first dense in-order match with the turn's opening words.
Output: data/retime/clip_file_audit.json
"""
import json, os, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import retime_turns as R
from audit_start_times import lcs_pairs, first_anchor
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
HEAD = float(os.environ.get("HEAD_SEC", "45"))
TMP = Path.home() / ".cache/clipaudit"; TMP.mkdir(parents=True, exist_ok=True)

def main():
    turns = json.loads((ROOT / "data/seed/speaker_turns.json").read_text())
    clips = [t for t in turns if t.get("brandedMp4Url") or t.get("directMp4Url")]
    model = WhisperModel(os.environ.get("MODEL", "base.en"), device="cpu", compute_type="int8", cpu_threads=2)
    out_path = ROOT / "data/retime/clip_file_audit.json"
    done = {r["id"]: r for r in json.loads(out_path.read_text())} if out_path.exists() else {}
    for t in clips:
        if t["id"] in done:
            continue
        url = t.get("brandedMp4Url") or t.get("directMp4Url")
        wav = TMP / f"{t['id']}.f32"
        r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-t", str(HEAD), "-i", url, "-ac", "1", "-ar", "16000", "-f", "f32le", str(wav)],
                           capture_output=True, text=True, timeout=300)
        rec = {"id": t["id"], "kind": "branded" if t.get("brandedMp4Url") else "precut", "url": url,
               "speaker": t.get("speakerSlug"), "text": t["text"][:120]}
        if r.returncode or not wav.exists():
            rec.update(status="download_failed", err=r.stderr[-200:])
        else:
            import numpy as np
            segs, _ = model.transcribe(np.fromfile(str(wav), dtype=np.float32), language="en", word_timestamps=True, vad_filter=False, beam_size=1)
            words = [(w.start, R.norm_words(w.word)) for s in segs for w in (s.words or [])]
            words = [(st, ws[0]) for st, ws in words if ws]
            heard = " ".join(w for _, w in words)
            tw = R.norm_words(t["text"])[:40]
            pairs = lcs_pairs(tw, [w for _, w in words])
            if pairs:
                diag = sorted(j - i for i, j in pairs)[len(pairs) // 2]
                pairs = [(i, j) for i, j in pairs if abs((j - i) - diag) <= 12]
            anc = first_anchor(pairs)
            first_speech = words[0][0] if words else None
            if anc:
                k, j = anc
                rec.update(status="ok", wordsStartAt=round(words[j][0] - k * 0.4, 1), anchorWord=k,
                           firstSpeechAt=first_speech, heard=heard[:160])
            else:
                rec.update(status="turn_words_not_in_first_%ds" % HEAD, firstSpeechAt=first_speech, heard=heard[:160])
            wav.unlink()
        done[t["id"]] = rec
        out_path.write_text(json.dumps(list(done.values()), indent=0))
        print(rec["id"], rec["kind"], rec["status"], rec.get("wordsStartAt"), "|", (rec.get("heard") or "")[:70], flush=True)

if __name__ == "__main__":
    main()
