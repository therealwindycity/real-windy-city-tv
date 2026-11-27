#!/usr/bin/env python3
"""Extract voice segments around every timed speaker turn (input for voice-profile verification).

Input : JSON list of {"id", "url", "start", "dur"}  (url = IA mp4/mp3; start/dur in seconds)
Output: JSON list of {"id", "t0", "segs": [[start, end, cluster], ...], "cents": {cluster: [256 floats, 4 dp]}}
        times are absolute seconds in the recording; clusters are per-turn (greedy cosine >= 0.5).
Usage : voice_extract.py turns.json out.json [shard_index shard_count]
Needs : ffmpeg, numpy, onnxruntime, kaldi-native-fbank, WeSpeaker ResNet34 ONNX at $SPK_MODEL
"""
import json, os, subprocess, sys, time
import numpy as np
import onnxruntime as ort
import kaldi_native_fbank as knf

SR = 16000
PRE, MAXBODY, TAIL = 25.0, 90.0, 5.0
WIN, HOP = 1.5, 0.5
so = ort.SessionOptions(); so.intra_op_num_threads = int(os.environ.get("ORT_THREADS", "2"))
SESS = ort.InferenceSession(os.environ.get("SPK_MODEL", os.path.expanduser("~/.cache/spk/wespeaker_r34.onnx")), so)


def fetch(url, start, dur):
    for attempt in range(3):
        p = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{max(0, start):.2f}", "-t", f"{dur:.2f}", "-i", url,
                            "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, timeout=300)
        x = np.frombuffer(p.stdout, dtype=np.float32)
        if len(x) > SR * 5:
            return x
        time.sleep(5 * (attempt + 1))
    return x


def embed(x):
    o = knf.FbankOptions(); o.frame_opts.dither = 0; o.frame_opts.samp_freq = SR; o.mel_opts.num_bins = 80
    f = knf.OnlineFbank(o); f.accept_waveform(SR, (x * 32768).tolist()); f.input_finished()
    feats = np.array([f.get_frame(i) for i in range(f.num_frames_ready)], dtype=np.float32)
    w, h = int(WIN * 100), int(HOP * 100)
    starts = list(range(0, max(1, len(feats) - w + 1), h))
    batch = np.stack([feats[s:s + w] - feats[s:s + w].mean(0) for s in starts])
    e = np.concatenate([SESS.run(None, {"feats": batch[i:i + 32]})[0] for i in range(0, len(batch), 32)])
    e /= np.linalg.norm(e, axis=1, keepdims=True) + 1e-9
    c = np.array([(s + w / 2) / 100 for s in starts])
    rms = np.array([np.sqrt(np.mean(x[int(s / 100 * SR): int((s + w) / 100 * SR)] ** 2) + 1e-12) for s in starts])
    return c, e, rms


def cluster(e, voiced, thr=0.5):
    lab = np.full(len(e), -1); cents = []
    for i in np.where(voiced)[0]:
        if cents:
            sims = np.array([ce @ e[i] / (np.linalg.norm(ce) + 1e-9) for ce in cents]); k = int(sims.argmax())
            if sims[k] >= thr:
                lab[i] = k; cents[k] = cents[k] + e[i]; continue
        cents.append(e[i].copy()); lab[i] = len(cents) - 1
    return lab, [ce / (np.linalg.norm(ce) + 1e-9) for ce in cents]


def segments(c, lab, gap=1.5, min_len=1.0):
    segs = []
    for i in np.where(lab >= 0)[0]:
        if segs and segs[-1][2] == lab[i] and c[i] - segs[-1][1] <= gap:
            segs[-1][1] = c[i]
        else:
            segs.append([c[i], c[i], int(lab[i])])
    segs = [s for s in segs if s[1] - s[0] >= min_len]
    out = []
    for s in segs:
        if out and out[-1][2] == s[2] and s[0] - out[-1][1] <= gap * 2:
            out[-1][1] = s[1]
        else:
            out.append(s)
    return [[round(a - WIN / 2, 1), round(b + WIN / 2, 1), k] for a, b, k in out]


def one(t):
    S, D = float(t["start"]), float(t["dur"])
    t0 = max(0.0, S - PRE)
    x = fetch(t["url"], t0, (S - t0) + min(D, MAXBODY) + TAIL)
    if len(x) < SR * 10:
        return {"id": t["id"], "status": "audio_short"}
    c, e, rms = embed(x)
    voiced = rms > max(0.003, np.percentile(rms, 10) * 2.0)
    lab, cents = cluster(e, voiced)
    segs = segments(c + t0, lab)
    used = sorted({k for *_, k in segs})
    return {"id": t["id"], "status": "ok", "t0": round(t0, 1),
            "segs": segs, "cents": {str(k): [round(float(v), 4) for v in cents[k]] for k in used}}


def main():
    turns = json.load(open(sys.argv[1])); out = sys.argv[2]
    if len(sys.argv) > 4:
        i, n = int(sys.argv[3]), int(sys.argv[4]); turns = turns[i::n]
    res = {r["id"]: r for r in json.load(open(out))} if os.path.exists(out) else {}
    for k, t in enumerate(turns):
        if t["id"] in res:
            continue
        try:
            res[t["id"]] = one(t)
        except Exception as ex:
            res[t["id"]] = {"id": t["id"], "status": "error", "err": str(ex)[:200]}
        if k % 10 == 0:
            json.dump(list(res.values()), open(out, "w")); print(k, len(turns), flush=True)
    json.dump(list(res.values()), open(out, "w"))
    print("done", len(res))


if __name__ == "__main__":
    main()
