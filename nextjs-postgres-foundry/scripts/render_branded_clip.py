#!/usr/bin/env python3
"""
Renders an individual speaker-only video segment (NEVER the full meeting!) with:
1. 2.5s 'THE REAL WINDY CITY' Branded Broadcast Intro (with audio chime)
2. C-SPAN Style 'THE REAL WINDY CITY' Marquee Info Border (top bar + framed video + lower-third chyron + scrolling ticker)
3. Burned-in, time-synced captions from the Minutes/Packet-reconciled transcript
4. 2.8s 'THE REAL WINDY CITY' Branded Broadcast Outro (with audio chime)

Usage:
  python3 scripts/render_branded_clip.py <turn_id> [output_mp4_path]
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path("/home/user/unified_civic_foundry")
SEED = ROOT / "data/seed"
OUT_DIR = ROOT / "public/rendered-clips"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def ass_time(sec: float) -> str:
    sec = max(0.0, sec)
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def esc_ass(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s.replace("\\", "/").replace("{", "(").replace("}", ")")

def esc_drawtext(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    for ch, rep in [("\\", "\\\\"), (":", "\\:"), ("'", "\u2019"), ("%", "\\%"), (",", "\\,"), ("[", "("), ("]", ")"), (";", "\\;")]:
        s = s.replace(ch, rep)
    return s

def build_ass_file(ass_path: Path, turn: dict, clip_dur: float):
    """
    Generates an Advanced SubStation Alpha (.ass) overlay @ 1280x720 containing:
    - C-SPAN / RWC Top Header Text & Lower-Third Chyron Text
    - Time-synced Cleaned Broadcast Captions (chunked ~11 words per cue)
    """
    spk = esc_ass(turn["speakerName"]).upper()
    role = esc_ass(turn["speakerRole"])
    sa = turn.get("speakerAnalytics") or {}
    hist_n = sa.get("historicalClipCount") or 1
    avg_fmt = esc_ass(sa.get("avgSpeakingFormatted") or f"{int(round(clip_dur))}s")
    poe_n = sa.get("pointOfOrderCount") or 0
    cap_txt = esc_ass(turn.get("speakingCapacity") or role)
    stance_txt = esc_ass(turn.get("stanceLabel") or "Floor Record")
    body_dt = esc_ass(f"{turn['bodyName'].upper()}  |  {turn['date']}  |  [{turn['hms']}]")
    themes = "  •  ".join(f"#{t.upper()}" for t in (turn.get("themes") or ["PUBLIC RECORD"])[:3])
    ords = turn.get("ordinances") or []
    ord_title_map = {}
    try:
        for o in json.loads((SEED / "ordinances.json").read_text()):
            ord_title_map[o["slug"]] = o["title"][:54]
    except Exception:
        pass
    if ords:
        otitle = ord_title_map.get(ords[0]["slug"], ords[0]["slug"])
        ord_line = f"{stance_txt.upper()}: {esc_ass(otitle.upper())} ({esc_ass(ords[0]['stage'].upper())})"
    else:
        ord_line = f"CAPACITY: {cap_txt.upper()}  •  STANCE: {stance_txt.upper()}  •  {themes}"
    if len(ord_line) > 108:
        ord_line = ord_line[:108].rsplit(" ", 1)[0].rstrip("•# ")
    stats_badge = esc_ass(f"ARCHIVE: {hist_n} CLIPS  •  AVG TURN: {avg_fmt}  •  POE: {poe_n}  •  SEG: {int(round(clip_dur))}s")

    # Split cleaned transcript into ~11-word readable broadcast caption cues
    words = esc_ass(turn.get("text") or "").split()
    if not words:
        words = ["(Verbatim", "speaker", "segment", "from", "City", "of", "Cheyenne", "official", "broadcast", "record.)"]
    chunk_size = 11
    chunks = [" ".join(words[i : i + chunk_size]) for i in range(0, min(len(words), 220), chunk_size)]
    cue_dur = max(1.6, clip_dur / max(1, len(chunks)))

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TopLeft,DejaVu Sans,19,&H0024BFFB,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0.6,0,1,1.5,0,7,22,20,13,1
Style: TopRight,DejaVu Sans,17,&H00F8FAFC,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0.3,0,1,1.5,0,9,20,22,14,1
Style: ChyronName,DejaVu Sans,25,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0.4,0,1,2.0,0,1,26,20,98,1
Style: ChyronSub,DejaVu Sans,16,&H00BAE6FD,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0.3,0,1,1.5,0,1,26,20,73,1
Style: ChyronRight,DejaVu Sans,15,&H006EE7B7,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0.3,0,1,1.5,0,3,20,26,98,1
Style: Caption,DejaVu Sans,22,&H00FFFFFF,&H000000FF,&H00080808,&HC8050912,-1,0,0,0,100,100,0.2,0,3,6.0,0,2,90,90,144,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 2,0:00:00.00,{ass_time(clip_dur)},TopLeft,,0,0,0,,[RWC] THE REAL WINDY CITY  •  CHEYENNE CIVIC BROADCAST
Dialogue: 2,0:00:00.00,{ass_time(clip_dur)},TopRight,,0,0,0,,{body_dt}
Dialogue: 2,0:00:00.00,{ass_time(clip_dur)},ChyronName,,0,0,0,,{spk}   {{\\fs16\\c&H24BFFB&}}({role.upper()})
Dialogue: 2,0:00:00.00,{ass_time(clip_dur)},ChyronSub,,0,0,0,,{ord_line}
Dialogue: 2,0:00:00.00,{ass_time(clip_dur)},ChyronRight,,0,0,0,,{stats_badge}
"""
    lines = [header.strip()]
    for idx, ch in enumerate(chunks):
        st = idx * cue_dur
        en = min(clip_dur, (idx + 1) * cue_dur)
        if st >= clip_dur:
            break
        # Wrap at ~58 chars onto 2 lines if needed
        if len(ch) > 58:
            mid = ch.rfind(" ", 0, 58)
            if mid > 15:
                ch = ch[:mid] + "\\N" + ch[mid + 1 :]
        lines.append(f"Dialogue: 3,{ass_time(st)},{ass_time(en)},Caption,,0,0,0,,{ch}")

    ass_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

def make_slate_mp4(out_path: Path, dur: float, line1: str, line2: str, line3: str, line4: str, is_intro: bool):
    l1 = esc_drawtext(line1)
    l2 = esc_drawtext(line2)[:58]
    l3 = esc_drawtext(line3)[:96]
    l4 = esc_drawtext(line4)[:92]
    freq_expr = "0.12*sin(2*PI*440*t)*exp(-2.2*t)+0.10*sin(2*PI*554.37*t)*exp(-1.9*t)+0.10*sin(2*PI*659.25*t)*exp(-1.5*t)" if is_intro else "0.12*sin(2*PI*523.25*t)*exp(-1.8*t)+0.10*sin(2*PI*392*t)*exp(-1.5*t)"
    vf = (
        f"drawbox=x=0:y=0:w=1280:h=68:color=0x0b1930:t=fill,"
        f"drawbox=x=0:y=68:w=1280:h=5:color=0xfbbf24:t=fill,"
        f"drawbox=x=0:y=647:w=1280:h=5:color=0xfbbf24:t=fill,"
        f"drawbox=x=0:y=652:w=1280:h=68:color=0x0b1930:t=fill,"
        f"drawbox=x=90:y=165:w=1100:h=390:color=0x0a1326@0.92:t=fill,"
        f"drawbox=x=90:y=165:w=1100:h=6:color=0xf43f5e:t=fill,"
        f"drawtext=fontfile={FONT_BOLD}:text='THE REAL WINDY CITY  |  CHEYENNE, WYOMING':fontcolor=0xfbbf24:fontsize=24:x=(w-text_w)/2:y=22,"
        f"drawtext=fontfile={FONT_BOLD}:text='{l1}':fontcolor=0x38bdf8:fontsize=20:x=(w-text_w)/2:y=215,"
        f"drawtext=fontfile={FONT_BOLD}:text='{l2}':fontcolor=white:fontsize=38:x=(w-text_w)/2:y=275,"
        f"drawtext=fontfile={FONT_REG}:text='{l3}':fontcolor=0xe2e8f0:fontsize=21:x=(w-text_w)/2:y=350,"
        f"drawtext=fontfile={FONT_BOLD}:text='{l4}':fontcolor=0xfbbf24:fontsize=19:x=(w-text_w)/2:y=435,"
        f"drawtext=fontfile={FONT_BOLD}:text='VERIFIED SPEAKER-ONLY SEGMENT  •  PRIMARY PUBLIC RECORD ARCHIVE (2008-2026)':fontcolor=0x94a3b8:fontsize=17:x=(w-text_w)/2:y=676"
    )
    cmd = [
        "ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", f"color=c=0x050912:s=1280x720:r=30:d={dur}",
        "-f", "lavfi", "-i", f"aevalsrc='{freq_expr}':s=44100:c=stereo:d={dur}",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        str(out_path),
    ]
    subprocess.run(cmd, check=True, timeout=45)

SILENCE_DB = -55.0  # anything quieter than this across the speech section is treated as "no audio"

class SilentSourceError(RuntimeError):
    pass

def mean_volume_db(p, start: float | None = None, dur: float | None = None) -> float:
    cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-nostats"]
    if start is not None:
        cmd += ["-ss", str(start)]
    if dur is not None:
        cmd += ["-t", str(dur)]
    cmd += ["-i", str(p), "-map", "0:a:0", "-af", "volumedetect", "-f", "null", "-"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stderr
    except Exception:
        return float("-inf")
    import re as _re
    m = _re.search(r"mean_volume: (-?[0-9.]+|-inf) dB", out)
    return float(m.group(1)) if m and m.group(1) != "-inf" else float("-inf")

def source_length_sec(url: str) -> float | None:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", url],
            text=True, timeout=30, stdin=subprocess.DEVNULL,
        ).strip()
        return float(out)
    except Exception:
        return None

def extract_raw_segment(turn: dict, raw_seg: Path) -> float:
    """Extracts ONLY the <=180s speaker segment [startSec, endSec] — NEVER the full meeting!"""
    start_s = float(turn.get("startSec") or 0.0)
    dur_s = min(180.0, max(8.0, float(turn.get("durationSec") or 45.0)))

    direct = turn.get("directMp4Url")
    src_mtg = turn.get("sourceMeetingMp4Url")
    yt_id = turn.get("youtubeId")

    # Case A: Pre-cut standalone MP4 clip (strictly non-Granicus, non-full-meeting!)
    if direct and direct.startswith("http") and "granicus.com" not in direct and "archive.org" not in direct:
        cmd = [
            "ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
            "-i", direct.split("#")[0],
            "-t", str(min(180.0, dur_s)),
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-ar", "44100", "-ac", "2",
            str(raw_seg),
        ]
        if subprocess.run(cmd, timeout=60).returncode == 0 and raw_seg.exists() and raw_seg.stat().st_size > 10000:
            return get_duration(raw_seg, dur_s)

    # Case B: Internet Archive (archive.org/download/cochwy-...) with HTTP Byte-Range seeking (-ss BEFORE -i downloads ONLY [startSec, endSec]!)
    if src_mtg and src_mtg.startswith("http") and "granicus.com" not in src_mtg:
        src_len = source_length_sec(src_mtg)
        if src_len is not None and start_s + 3 > src_len:
            raise SilentSourceError(
                f"Turn {turn['id']} starts at {start_s:.0f}s but linked video is only {src_len:.0f}s long — wrong video or timing; refusing to render"
            )
        cmd = [
            "ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
            "-ss", str(start_s), "-t", str(dur_s),
            "-i", src_mtg,
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-ar", "44100", "-ac", "2",
            str(raw_seg),
        ]
        if subprocess.run(cmd, timeout=300).returncode == 0 and raw_seg.exists() and raw_seg.stat().st_size > 10000:
            return get_duration(raw_seg, dur_s)

    # Case C: YouTube ID via yt-dlp --download-sections (downloads ONLY [startSec, endSec]!)
    if yt_id and shutil.which("yt-dlp"):
        cmd = [
            "yt-dlp", "--quiet", "--no-warnings",
            "--download-sections", f"*{int(start_s)}-{int(start_s + min(dur_s, 120))}",
            "-f", "mp4[height<=720]/best[height<=720]",
            "-o", str(raw_seg),
            f"https://www.youtube.com/watch?v={yt_id}",
        ]
        subprocess.run(cmd, timeout=300)
        if raw_seg.exists() and raw_seg.stat().st_size > 10000:
            return get_duration(raw_seg, min(dur_s, 120.0))

    # Case D removed: previously produced a silent text-slide "video". Fail loudly instead.
    raise SilentSourceError(f"Turn {turn['id']}: no reachable source video with audio; refusing to render a silent clip")

def get_duration(p: Path, fallback: float) -> float:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(p)],
            text=True, timeout=15,
        ).strip()
        return max(3.0, float(out))
    except Exception:
        return fallback

def has_audio_stream(p: Path) -> bool:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(p)],
            text=True, timeout=15,
        ).strip()
        return bool(out)
    except Exception:
        return False

def render_turn(turn_id: int, out_file: Path | None = None) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    turns = json.loads((SEED / "speaker_turns.json").read_text())
    turn = next((t for t in turns if int(t["id"]) == int(turn_id)), None)
    if not turn:
        raise SystemExit(f"Turn {turn_id} not found")

    target = out_file or (OUT_DIR / f"rwc-turn-{turn_id}.mp4")
    if target.exists() and target.stat().st_size > 50_000 and out_file is None:
        if mean_volume_db(target, 2.6, max(1.0, get_duration(target, 10) - 5.4)) >= SILENCE_DB:
            return target
        target.unlink()  # stale silent render — rebuild

    with tempfile.TemporaryDirectory(prefix=f"rwc_clip_{turn_id}_") as td:
        tmp = Path(td)
        intro_mp4 = tmp / "01_intro.mp4"
        raw_seg = tmp / "02_raw.mp4"
        body_mp4 = tmp / "02_body.mp4"
        outro_mp4 = tmp / "03_outro.mp4"
        ass_path = tmp / "captions.ass"
        concat_txt = tmp / "concat.txt"

        sa = turn.get("speakerAnalytics") or {}
        hist_n = sa.get("historicalClipCount") or 1
        avg_fmt = sa.get("avgSpeakingFormatted") or "1m 30s"
        poe_n = sa.get("pointOfOrderCount") or 0
        cap_txt = turn.get("speakingCapacity") or turn["speakerRole"]

        # 1. Intro Slate (2.5s)
        make_slate_mp4(
            intro_mp4,
            2.5,
            "OFFICIAL SPEAKER SEGMENT  •  MINUTES, PACKET & OSINT VERIFIED",
            turn["speakerName"].upper(),
            f"{turn['speakerRole']}  •  Capacity: {cap_txt}  •  {turn['date']}",
            f"Historical Archive: {hist_n} Clips  •  Avg Turn: {avg_fmt}  •  Points of Order: {poe_n}",
            is_intro=True,
        )

        # 2. Extract speaker-only raw segment & composite C-SPAN Marquee Info Border + Burned Captions
        seg_dur = extract_raw_segment(turn, raw_seg)
        if not has_audio_stream(raw_seg):
            raise SilentSourceError(f"Turn {turn_id}: source segment has no audio track; refusing to render")
        seg_db = mean_volume_db(raw_seg)
        if seg_db < SILENCE_DB:
            raise SilentSourceError(
                f"Turn {turn_id}: source segment is silent ({seg_db:.1f} dB mean) — likely wrong timing; refusing to render"
            )
        build_ass_file(ass_path, turn, seg_dur)

        marquee = esc_drawtext(
            f"THE REAL WINDY CITY  •  SPEAKER: {turn['speakerName'].upper()} ({turn['speakerRole'].upper()})  •  "
            f"HISTORICAL CLIPS: {hist_n}  •  AVG SPEAKING TIME: {avg_fmt}  •  POINTS OF ORDER: {poe_n}  •  "
            f"CAPACITY: {cap_txt.upper()}  •  STANCE: {(turn.get('stanceLabel') or 'FLOOR RECORD').upper()}  •  "
            f"INTERNET ARCHIVE & CLERK MINUTES VERIFIED  •  THEREALWINDYCITY.GITHUB.IO/REAL-WINDY-CITY-TV      "
        )

        # Scale raw video cleanly into 1248x532 centered inside 1280x720 C-SPAN broadcast frame (y=48..580)
        ass_escaped = str(ass_path).replace(":", "\\:")
        vf_body = (
            f"scale=1248:532:force_original_aspect_ratio=decrease,"
            f"pad=1280:720:(1280-iw)/2:48+((532-ih)/2):color=0x050912,"
            f"setsar=1,fps=30,"
            # Top C-SPAN / RWC Header Bar (0..46)
            f"drawbox=x=0:y=0:w=1280:h=45:color=0x09152b:t=fill,"
            f"drawbox=x=0:y=45:w=1280:h=3:color=0xfbbf24:t=fill,"
            # Left & Right C-SPAN Frame Pillars
            f"drawbox=x=0:y=48:w=14:h=532:color=0x09152b:t=fill,"
            f"drawbox=x=1266:y=48:w=14:h=532:color=0x09152b:t=fill,"
            # Bottom C-SPAN Lower-Third Chyron (580..676)
            f"drawbox=x=0:y=580:w=1280:h=4:color=0xb91c1c:t=fill,"
            f"drawbox=x=0:y=584:w=1280:h=92:color=0x0a1931:t=fill,"
            # Bottom Scrolling Marquee Ticker Bar (676..720)
            f"drawbox=x=0:y=676:w=1280:h=2:color=0xfbbf24:t=fill,"
            f"drawbox=x=0:y=678:w=1280:h=42:color=0x040811:t=fill,"
            f"drawtext=fontfile={FONT_BOLD}:text='{marquee}':fontcolor=0xfbbf24:fontsize=16:y=691:x=w-mod(t*115\\,w+tw),"
            f"subtitles='{ass_escaped}'"
        )

        if has_audio_stream(raw_seg):
            cmd_body = [
                "ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(raw_seg),
                "-vf", vf_body,
                "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", "30",
                "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                str(body_mp4),
            ]
        else:
            cmd_body = [
                "ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(raw_seg),
                "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={seg_dur}",
                "-shortest", "-vf", vf_body,
                "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", "30",
                "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                str(body_mp4),
            ]
        subprocess.run(cmd_body, check=True, timeout=420)

        # 3. Outro Slate (2.8s)
        make_slate_mp4(
            outro_mp4,
            2.8,
            "END OF VERIFIED SPEAKER SEGMENT",
            "THE REAL WINDY CITY",
            "Primary Sources: Official Clerk Minutes  •  Foundry Packet PDFs  •  Ch. 192 Broadcast",
            "Follow The Real Windy City on Facebook: facebook.com/profile.php?id=61576260305204",
            is_intro=False,
        )

        # 4. Concatenate Intro + Captioned C-SPAN Body + Outro seamlessly
        concat_txt.write_text(f"file '{intro_mp4}'\nfile '{body_mp4}'\nfile '{outro_mp4}'\n")
        subprocess.run(
            [
                "ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
                "-f", "concat", "-safe", "0", "-i", str(concat_txt),
                "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
                str(target),
            ],
            check=True,
            timeout=300,
        )
        body_db = mean_volume_db(target, 2.6, max(1.0, get_duration(target, seg_dur + 5.3) - 5.4))
        if body_db < SILENCE_DB:
            target.unlink(missing_ok=True)
            raise SilentSourceError(f"Turn {turn_id}: finished clip speech section is silent ({body_db:.1f} dB); deleted")
    return target

if __name__ == "__main__":
    tid = int(sys.argv[1])
    outp = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    try:
        res = render_turn(tid, outp)
    except SilentSourceError as e:
        print(f"REFUSED: {e}", file=sys.stderr)
        sys.exit(3)
    print(f"Rendered: {res} ({res.stat().st_size:,} bytes)")
