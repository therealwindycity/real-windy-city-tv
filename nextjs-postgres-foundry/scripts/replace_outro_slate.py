#!/usr/bin/env python3
"""Swap ONLY the 2.8 s outro slate of an existing branded clip (for turns whose source can't be re-downloaded,
e.g. YouTube-only turn 195). Usage: replace_outro_slate.py <in.mp4> <out.mp4>"""
import subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_branded_clip as RB

OUTRO = 2.8
src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                           capture_output=True, text=True).stdout)
with tempfile.TemporaryDirectory() as td:
    td = Path(td); outro = td / "outro.mp4"
    RB.make_slate_mp4(outro, OUTRO, "END OF VERIFIED SPEAKER SEGMENT", "THE REAL WINDY CITY",
                      "Primary Sources: Official Clerk Minutes  •  Foundry Packet PDFs  •  Ch. 192 Broadcast",
                      "Follow The Real Windy City on Facebook: facebook.com/profile.php?id=61576260305204", is_intro=False)
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", str(src), "-i", str(outro), "-filter_complex",
                    f"[0:v]trim=0:{dur - OUTRO:.3f},setpts=PTS-STARTPTS,fps=30,scale=1280:720,setsar=1,format=yuv420p[v0];"
                    f"[0:a]atrim=0:{dur - OUTRO:.3f},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo[a0];"
                    "[1:v]fps=30,scale=1280:720,setsar=1,format=yuv420p[v1];[1:a]aresample=44100,aformat=channel_layouts=stereo[a1];"
                    "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
                    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart", str(dst)], check=True)
print("wrote", dst)
