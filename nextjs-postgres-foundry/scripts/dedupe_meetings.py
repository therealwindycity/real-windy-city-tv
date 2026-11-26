#!/usr/bin/env python3
"""
Meeting-level video verification + duplicate removal (runs after apply_retime.py / finalize_clips.py).

1. Ghost episodes: created from an Internet Archive upload date (sources = archive.org/cochwy only, 0 speaker turns,
   only auto-generated placeholder items) that duplicate a real meeting of the same body whose date is the date in
   the IA title. The ghost is removed; if its video is a different part of the same meeting (e.g. "part 2"), that
   video is attached to the real meeting first.
2. Wrong-date links: clerk/Granicus/Wayback-sourced meetings linked to an IA recording whose title carries a
   different date (and no speaker turn was verified in it) -> link removed, videoLinkVerified=false.
3. Title-verified links: IA title date == meeting date -> videoLinkVerified=true, videoLinkBasis="title_date".
   Episodes created from the IA item itself -> videoLinkBasis="ia_item_itself".
Transcript-verified links (set by apply_retime.py) get videoLinkBasis="transcript".
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data/seed"
RT = ROOT / "data/retime"
MON = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def title_dates(t):
    out = set()
    for a, b, c in re.findall(r"(\d{1,2})[-_./ ](\d{1,2})[-_./ ](\d{2,4})", t or ""):
        y = int(c)
        y = y + 2000 if y < 100 else y
        if 1 <= int(a) <= 12 and 1 <= int(b) <= 31 and 2000 <= y <= 2030:
            out.add(f"{y:04d}-{int(a):02d}-{int(b):02d}")
    for mo, d, y in re.findall(r"([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})", t or ""):
        if mo[:3].lower() in MON:
            out.add(f"{int(y):04d}-{MON[mo[:3].lower()]:02d}-{int(d):02d}")
    return out


def ident_of(u):
    return u.split("/download/")[1].split("/")[0] if u and "archive.org/download/" in u else None


def main():
    meetings = json.loads((SEED / "meetings.json").read_text())
    turns = json.loads((SEED / "speaker_turns.json").read_text())
    items = json.loads((SEED / "items.json").read_text())
    docs = json.loads((SEED / "documents.json").read_text())
    briefs = json.loads((SEED / "briefs.json").read_text())
    inv = json.loads((RT / "ia_inventory.json").read_text())
    col = {x["identifier"]: x for x in json.loads((RT / "ia_collection.json").read_text())}
    title = lambda i: (inv.get(i) or {}).get("title") or (col.get(i) or {}).get("title") or i

    tcount = Counter(t["meetingSlug"] for t in turns)
    verified_turn_idents = defaultdict(set)
    for t in turns:
        if t.get("videoTiming") in ("realigned", "realigned_relinked", "diarized_window"):
            i = ident_of(t.get("sourceMeetingMp4Url"))
            if i:
                verified_turn_idents[t["meetingSlug"]].add(i)
    by_body_date = defaultdict(list)
    for m in meetings:
        by_body_date[(m["body"], m["date"])].append(m)

    stats = Counter()
    ghosts = set()
    log = []
    for m in meetings:
        i = ident_of(m.get("mp4Url"))
        removed = m.get("iaRemovedIdent")   # IA item withdrawn from archive.org; only used for ghost detection
        if m.get("videoLinkVerified") is True:
            m["videoLinkBasis"] = "transcript"
            continue
        if removed and not i:
            i = removed
        elif not i or m.get("videoLinkVerified") is False:
            continue
        t = title(i)
        ds = title_dates(t) or title_dates(i)
        ia_only = set(m.get("sources") or []) <= {"archive.org/cochwy"}
        if removed and (m["date"] in ds or not ds):
            continue   # removed item: never re-verify a link, only test for an upload-date ghost below
        if m["date"] in ds:
            m["videoLinkVerified"], m["videoLinkBasis"] = True, "title_date"
            stats["title_date_verified"] += 1
            continue
        if not ds:
            if ia_only:
                m["videoLinkVerified"], m["videoLinkBasis"] = True, "ia_item_itself"
                stats["ia_item_itself"] += 1
            else:
                stats["unverified_no_date_in_title"] += 1
            continue
        # Title carries a different date
        twins = [x for d in ds for x in by_body_date.get((m["body"], d), []) if x["slug"] != m["slug"]]
        if not twins and ia_only:   # same recording already attached to a meeting of another body on the title date
            twins = [x for x in meetings if x["date"] in ds and x["slug"] != m["slug"] and ident_of(x.get("mp4Url")) == i]
        if ia_only and tcount[m["slug"]] == 0 and twins:
            real = twins[0]
            if ident_of(real.get("mp4Url")) != i and not removed:
                links = real.setdefault("extraLinks", [])
                if not any(i in (l.get("url") or "") for l in links):
                    links.append({"label": f"Archive.org Ch192 — {t}", "url": f"https://archive.org/details/{i}", "kind": "archive_video_part"})
                if not real.get("mp4Url"):
                    real["mp4Url"], real["videoUrl"] = m["mp4Url"], f"https://archive.org/details/{i}"
                    real["videoLinkVerified"], real["videoLinkBasis"] = True, "title_date"
            ghosts.add(m["slug"])
            log.append({"action": "ghost_removed", "slug": m["slug"], "realMeeting": real["slug"], "iaTitle": t})
            stats["ghost_removed"] += 1
        elif i in verified_turn_idents.get(m["slug"], set()):
            m["videoLinkVerified"], m["videoLinkBasis"] = True, "transcript"
            stats["transcript_verified_despite_title_date"] += 1
        else:
            log.append({"action": "wrong_date_link_removed", "slug": m["slug"], "iaTitle": t, "titleDates": sorted(ds)})
            m["mp4Url"] = None
            if "archive.org" in (m.get("videoUrl") or ""):
                m["videoUrl"] = None
            m["extraLinks"] = [l for l in (m.get("extraLinks") or []) if l.get("kind") not in ("archive_video", "archive_embed")]
            m["videoLinkVerified"], m["videoLinkBasis"] = False, "wrong_date"
            stats["wrong_date_link_removed"] += 1

    if ghosts:
        meetings = [m for m in meetings if m["slug"] not in ghosts]
        items = [x for x in items if x["meeting"] not in ghosts]
        docs = [x for x in docs if x["meeting"] not in ghosts]
        briefs = [x for x in briefs if x.get("meeting") not in ghosts and x.get("slug") not in ghosts]
    for name, data in (("meetings.json", meetings), ("items.json", items), ("documents.json", docs), ("briefs.json", briefs)):
        (SEED / name).write_text(json.dumps(data, ensure_ascii=False, indent=1))
    (RT / "dedupe_log.json").write_text(json.dumps(log, indent=1))
    print(dict(stats), "| meetings now:", len(meetings), "| items:", len(items), "| docs:", len(docs), "| briefs:", len(briefs))


if __name__ == "__main__":
    main()
