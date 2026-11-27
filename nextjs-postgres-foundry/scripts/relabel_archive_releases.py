#!/usr/bin/env python3
"""Relabel automatically-named speaker ZIPs in the cheyenne-archives-* "speaker-videos-*" releases.

The Speaker Video Splitter named voice clusters from (a) whoever was mentioned at the end of the previous caption line
and (b) voice similarity to those guesses (cosine >= 0.32), so names like "Councilman_Larry_Wolf",
"Councilman_Ken_Moody" or "Mr._Mom" were attached to clips of other people.  Every named ZIP is renamed to
"Speaker_NN_Unverified_Voice_<count>_clips.zip" (asset rename -- no re-upload), labelled as an unverified automatic
grouping, and each release body gets a notice.  Clip file names INSIDE the ZIPs still carry the old automatic label.

usage: relabel_archive_releases.py [--apply]       (token in $GH_TOKEN)
writes data/retime/archive_zip_renames.json  {"<repo>/<tag>/<old zip>": "<new zip>"}
"""
import json, os, re, sys, urllib.request
from pathlib import Path

OWNER = "therealwindycity"
REPOS = ["cheyenne-archives-2008-2013", "cheyenne-archives-2014-2017", "cheyenne-archives-2018-2021",
         "cheyenne-archives-2022", "cheyenne-archives-2023-2024", "cheyenne-archives-2025-2026"]
OUT = Path(__file__).resolve().parent.parent / "data/retime/archive_zip_renames.json"
TOK = os.environ["GH_TOKEN"]
APPLY = "--apply" in sys.argv
NOTICE = ("> ⚠️ **Speaker names corrected (2026-11-27).** These clip packages were grouped by an automatic voice "
          "splitter that guessed names from whoever was mentioned just before a turn. Those guesses were often wrong "
          "(e.g. naming the presiding officer after a council member who seconded a motion), so every automatically "
          "named package is now labelled **Unverified_Voice** — the identity of the speaker has not been verified. "
          "File names inside older ZIPs may still show the old automatic label. Verified speaker identities are on "
          "[The Real Windy City TV](https://www.facebook.com/profile.php?id=61576260305204).\n\n")
NAMED = re.compile(r"^(Speaker_\d+)_(.+)_(\d+)_clips\.zip$")


def api(method, url, data=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Authorization": f"Bearer {TOK}", "Accept": "application/vnd.github+json",
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"null")


def main():
    renames = json.loads(OUT.read_text()) if OUT.exists() else {}
    total = 0
    for repo in REPOS:
        rels = api("GET", f"https://api.github.com/repos/{OWNER}/{repo}/releases?per_page=100")
        for rel in rels:
            if not rel["tag_name"].startswith("speaker-videos"):
                continue
            body, changed = rel.get("body") or "", False
            for a in rel["assets"]:
                m = NAMED.match(a["name"])
                if not m or m.group(2).startswith(("Voice_Cluster", "Unverified_Voice", "Speaker_Unknown")):
                    continue
                new = f"{m.group(1)}_Unverified_Voice_{m.group(3)}_clips.zip"
                key = f"{repo}/{rel['tag_name']}/{a['name']}"
                renames[key] = new
                total += 1
                body = body.replace(a["name"], new).replace(f"{m.group(1)}_{m.group(2)}", f"{m.group(1)}_Unverified_Voice")
                changed = True
                if APPLY:
                    api("PATCH", f"https://api.github.com/repos/{OWNER}/{repo}/releases/assets/{a['id']}",
                        {"name": new, "label": f"{m.group(1).replace('_', ' ')} — unverified automatic voice grouping "
                                               f"({m.group(3)} clips)"})
            if changed and not body.startswith("> ⚠️ **Speaker names corrected"):
                body = NOTICE + body
            if changed and APPLY:
                api("PATCH", f"https://api.github.com/repos/{OWNER}/{repo}/releases/{rel['id']}", {"body": body})
        print(repo, "done")
    OUT.write_text(json.dumps(renames, indent=1, ensure_ascii=False))
    print(("renamed" if APPLY else "would rename"), total, "assets; map ->", OUT)


if __name__ == "__main__":
    main()
