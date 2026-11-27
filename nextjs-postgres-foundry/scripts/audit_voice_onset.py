#!/usr/bin/env python3
"""Acoustic audit: does each clip start where the SPEAKER starts talking?

For a turn with start S and duration D, fetch audio [S-25, S+45] from its IA recording (ffmpeg seeks by byte range),
embed 1.5 s windows (0.25 s hop) with WeSpeaker ResNet34 (ONNX), and build a reference voice from the body of the turn
([S+max(6, .35*min(D,45)), S+min(D,45)]). Windows are labelled S (same voice), D (other voice) or U (silence/unsure).
The voice onset is the S window nearest to S that starts a run where S dominates the next 3 s and the previous 2 s is
mostly another voice or silence. offset = S - onset (+ = clip starts after the speaker began; - = starts early).

Usage: audit_voice_onset.py [N_SAMPLE] [--ids 1,2,3] [--all]     -> data/retime/voice_onset_audit.json
"""
import json, os, random, subprocess, sys
from pathlib import Path
import numpy as np
import onnxruntime as ort
import kaldi_native_fbank as knf

ROOT = Path(__file__).resolve().parent.parent
MODEL = Path.home() / ".cache/spk/wespeaker_r34.onnx"
SR = 16000
PRE, POST = 25.0, 45.0
WIN, HOP = 1.5, 0.25
OUT = ROOT / "data/retime/voice_onset_audit.json"

so = ort.SessionOptions(); so.intra_op_num_threads = 2
SESS = ort.InferenceSession(str(MODEL), so)


def fetch(url, start, dur):
    p = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{max(0, start):.2f}", "-t", f"{dur:.2f}", "-i", url,
                        "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, timeout=240)
    return np.frombuffer(p.stdout, dtype=np.float32)


def fbank(x):
    o = knf.FbankOptions(); o.frame_opts.dither = 0; o.frame_opts.samp_freq = SR; o.mel_opts.num_bins = 80
    f = knf.OnlineFbank(o); f.accept_waveform(SR, (x * 32768).tolist()); f.input_finished()
    return np.array([f.get_frame(i) for i in range(f.num_frames_ready)], dtype=np.float32)


def embed_windows(x):
    feats = fbank(x)                       # 100 frames / s
    w, h = int(WIN * 100), int(HOP * 100)
    starts = list(range(0, max(1, len(feats) - w + 1), h))
    batch = np.stack([feats[s:s + w] - feats[s:s + w].mean(0) for s in starts])
    embs = []
    for i in range(0, len(batch), 32):
        embs.append(SESS.run(None, {"feats": batch[i:i + 32]})[0])
    e = np.concatenate(embs); e /= np.linalg.norm(e, axis=1, keepdims=True) + 1e-9
    centers = np.array([(s + w / 2) / 100 for s in starts])
    rms = np.array([np.sqrt(np.mean(x[int(s / 100 * SR): int((s + w) / 100 * SR)] ** 2) + 1e-12) for s in starts])
    return centers, e, rms


def voices(c, e, voiced, thr=0.5):
    """Greedy centroid clustering of voiced windows -> cluster id per window (-1 = unvoiced)."""
    lab = np.full(len(c), -1); cents, counts = [], []
    for i in np.where(voiced)[0]:
        if cents:
            sims = np.array([ce @ e[i] / (np.linalg.norm(ce) + 1e-9) for ce in cents])
            k = int(sims.argmax())
            if sims[k] >= thr:
                lab[i] = k; cents[k] = cents[k] + e[i]; counts[k] += 1; continue
        cents.append(e[i].copy()); counts.append(1); lab[i] = len(cents) - 1
    return lab


def segments(c, lab, gap=1.5, min_len=1.0):
    """Contiguous same-voice segments (short unvoiced gaps bridged; blips < min_len dropped)."""
    segs = []
    for i in np.where(lab >= 0)[0]:
        if segs and segs[-1][2] == lab[i] and c[i] - segs[-1][1] <= gap:
            segs[-1][1] = c[i]
        else:
            segs.append([c[i], c[i], int(lab[i])])
    segs = [s_ for s_ in segs if s_[1] - s_[0] >= min_len]
    merged = []
    for s_ in segs:
        if merged and merged[-1][2] == s_[2] and s_[0] - merged[-1][1] <= gap * 2:
            merged[-1][1] = s_[1]
        else:
            merged.append(s_)
    return [(a_ - WIN / 2, b_ + WIN / 2, k) for a_, b_, k in merged]


def analyse(t):
    S = float(t["startSec"]); D = float(t.get("durationSec") or (float(t["endSec"]) - S))
    t0 = max(0.0, S - PRE)
    x = fetch(t["sourceMeetingMp4Url"], t0, PRE + POST)
    if len(x) < SR * 20:
        return {"status": "audio_short"}
    c, e, rms = embed_windows(x)
    c = c + t0
    voiced = rms > max(0.003, np.percentile(rms, 10) * 2.0)
    lab = voices(c, e, voiced)
    segs = segments(c, lab)
    body_end = S + min(D, POST)
    # main voice of the turn = most speaking time inside [S, S+min(D,45)]
    tot = {}
    for a_, b_, k in segs:
        ov = max(0.0, min(b_, body_end) - max(a_, S))
        tot[k] = tot.get(k, 0.0) + ov
    if not tot or max(tot.values()) < 4:
        return {"status": "undetermined", "why": "little speech in turn"}
    main = max(tot, key=tot.get)
    share = tot[main] / max(1e-6, sum(tot.values()))
    # voice heard first after the clip starts (first segment overlapping [S, S+3])
    first = next(((a_, b_, k) for a_, b_, k in segs if b_ > S + 0.5), None)
    main_onset = next((a_ for a_, b_, k in segs if k == main and b_ > S + 0.5), None)
    res = {"mainShare": round(share, 2), "voicesInWindow": len({k for *_, k in segs})}
    if first is None or main_onset is None:
        return {"status": "undetermined", "why": "no segment", **res}
    if first[2] != main and main_onset - S > 3:
        return {"status": "starts_on_someone_else", "delay": round(main_onset - S, 1), "offset": round(S - main_onset, 1), **res}
    seg_start = first[0] if first[2] == main else main_onset
    if seg_start < S - 3:
        return {"status": "starts_mid_speech", "late": round(S - seg_start, 1), "offset": round(S - seg_start, 1), **res}
    return {"status": "ok", "offset": round(S - seg_start, 1), **res}


def main():
    args = sys.argv[1:]
    turns = json.loads((ROOT / "data/seed/speaker_turns.json").read_text())
    pool = [t for t in turns if t.get("videoTiming") in ("realigned", "realigned_relinked", "diarized_window")
            and "archive.org/download/" in (t.get("sourceMeetingMp4Url") or "") and float(t.get("durationSec") or 0) >= 15]
    if "--ids" in args:
        ids = set(map(int, args[args.index("--ids") + 1].split(","))); sel = [t for t in pool if t["id"] in ids]
    elif "--all" in args:
        sel = pool
    else:
        n = int(args[0]) if args else 100
        random.seed(11); sel = random.sample(pool, min(n, len(pool)))
    done = {r["id"]: r for r in json.loads(OUT.read_text())} if OUT.exists() else {}
    for k, t in enumerate(sel):
        if t["id"] in done:
            continue
        try:
            r = analyse(t)
        except Exception as ex:  # network hiccup etc.
            r = {"status": "error", "err": str(ex)[:150]}
        r.update(id=t["id"], startSec=t["startSec"], durationSec=t.get("durationSec"), timing=t["videoTiming"],
                 speaker=t.get("speakerSlug"), meeting=t.get("meetingSlug"), url=t["sourceMeetingMp4Url"])
        done[t["id"]] = r
        if k % 5 == 0 or k == len(sel) - 1:
            OUT.write_text(json.dumps(list(done.values()), indent=0))
        print(k, t["id"], r["status"], r.get("offset"), r.get("tau"), flush=True)
    OUT.write_text(json.dumps(list(done.values()), indent=0))
    from collections import Counter
    ids = {t["id"] for t in sel}
    rs = [r for r in done.values() if r["id"] in ids]
    print("SUMMARY", len(rs), dict(Counter(r["status"] for r in rs)))


if __name__ == "__main__":
    main()
