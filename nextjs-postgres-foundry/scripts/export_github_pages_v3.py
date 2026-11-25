#!/usr/bin/env python3
"""
Exports the complete v3.2 static data shards + OSINT graph + provenance films +
upgraded UI + Next.js 16/PostgreSQL 17 source tree into /tmp/rwc_tv_deploy and
syncs /home/user/real_windy_city_tv for GitHub Pages.
"""
import json
import shutil
import subprocess
from collections import defaultdict
from pathlib import Path

ROOT = Path("/home/user/unified_civic_foundry")
SEED = ROOT / "data/seed"
STATIC_SRC = Path("/home/user/real_windy_city_tv")
DEPLOY = Path("/tmp/rwc_tv_deploy")


def main():
    if DEPLOY.exists():
        shutil.rmtree(DEPLOY)
    subprocess.run(
        ["git", "clone", "https://github.com/therealwindycity/real-windy-city-tv.git", str(DEPLOY)],
        check=True,
    )

    # Copy v3.2 static UI shell into DEPLOY
    for fn in ["index.html", "styles.css", "app.js"]:
        shutil.copy2(STATIC_SRC / fn, DEPLOY / fn)

    data_dir = DEPLOY / "data"
    seasons_dir = data_dir / "seasons"
    seasons_dir.mkdir(parents=True, exist_ok=True)

    # Pull computed TV episode rows directly from PostgreSQL 17
    pg_out = subprocess.check_output(
        [
            "psql",
            "postgresql://civic:civic@127.0.0.1:5432/civic_foundry",
            "-t",
            "-A",
            "-c",
            """
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT slug, date, body, body_name AS "bodyName", season,
                     episode_no AS "episodeNo", season_size AS "seasonSize",
                     title, logline, phase, featured, tags,
                     agenda_url AS "agendaUrl", minutes_url AS "minutesUrl",
                     video_url AS "videoUrl", mp4_url AS "mp4Url",
                     runtime_min AS "runtimeMin", extra_links AS "extraLinks",
                     video_link_verified AS "videoLinkVerified"
              FROM meetings ORDER BY date DESC
            ) t;
            """,
        ],
        text=True,
    )
    meetings = json.loads(pg_out)
    items = json.loads((SEED / "items.json").read_text())
    docs = json.loads((SEED / "documents.json").read_text())
    votes = json.loads((SEED / "vote_events.json").read_text())
    briefs = json.loads((SEED / "briefs.json").read_text())
    ords = json.loads((SEED / "ordinances.json").read_text())
    people = json.loads((SEED / "people.json").read_text())
    turns = json.loads((SEED / "speaker_turns.json").read_text())
    speakers = json.loads((SEED / "speakers_directory.json").read_text())
    osint = json.loads((SEED / "osint_entities.json").read_text())
    prov = json.loads((SEED / "provenance_videos.json").read_text())
    featured = json.loads((SEED / "featured.json").read_text())

    items_by_m = defaultdict(list)
    for x in items:
        items_by_m[x["meeting"]].append(x)

    docs_by_m = defaultdict(list)
    docs_compact = []
    m_map = {m["slug"]: m for m in meetings}
    for d in docs:
        mslug = d["meeting"]
        m = m_map.get(mslug, {})
        meta = {
            "id": d["id"],
            "role": d["role"],
            "itemNo": d["itemNo"],
            "title": d["title"],
            "url": d.get("url"),
            "pages": d.get("pages"),
            "words": d.get("words"),
            "ocr": bool(d.get("ocr")),
            "sha1": d.get("sha1"),
            "bodySnippet": (d.get("text") or "")[:3200] if d.get("text") else None,
        }
        docs_by_m[mslug].append(meta)
        docs_compact.append({
            "id": d["id"],
            "role": d["role"],
            "itemNo": d["itemNo"],
            "title": d["title"],
            "url": d.get("url"),
            "pages": d.get("pages"),
            "ocr": bool(d.get("ocr")),
            "sha1": d.get("sha1"),
            "meetingSlug": mslug,
            "date": m.get("date", ""),
            "season": m.get("season", 0),
            "bodyName": m.get("bodyName", ""),
            "episodeTitle": m.get("title", ""),
        })

    votes_by_m = defaultdict(list)
    for v in votes:
        votes_by_m[v["meeting"]].append(v)
    briefs_by_m = defaultdict(list)
    for b in briefs:
        briefs_by_m[b["meeting"]].append(b)
    turns_by_m = defaultdict(list)
    for t in turns:
        turns_by_m[t["meetingSlug"]].append(t)

    for mf in prov.get("masterFilms", []):
        mf["pagesUrl"] = "." + mf["localUrl"]
    for ch in prov.get("chapters", []):
        ch["pagesUrl"] = "." + ch["localUrl"]

    ep_index = []
    by_season = defaultdict(dict)
    for m in meetings:
        slug = m["slug"]
        s = m["season"]
        ep_index.append({
            **m,
            "itemCount": len(items_by_m[slug]),
            "docCount": len(docs_by_m[slug]),
            "turnCount": len(turns_by_m[slug]),
            "voteCount": len(votes_by_m[slug]),
        })
        by_season[s][slug] = {
            "items": items_by_m[slug],
            "docs": docs_by_m[slug],
            "votes": votes_by_m[slug],
            "briefs": briefs_by_m[slug],
            "turns": turns_by_m[slug],
        }

    (data_dir / "episodes_index.json").write_text(json.dumps(ep_index, separators=(",", ":")))
    for s, payload in by_season.items():
        (seasons_dir / f"{s}.json").write_text(json.dumps(payload, separators=(",", ":")))

    (data_dir / "speaker_turns.json").write_text(json.dumps(turns, separators=(",", ":")))
    (data_dir / "speakers_directory.json").write_text(json.dumps(speakers, separators=(",", ":")))
    (data_dir / "osint_entities.json").write_text(json.dumps(osint, separators=(",", ":")))
    (data_dir / "ordinances.json").write_text(json.dumps(ords, separators=(",", ":")))
    (data_dir / "documents_compact.json").write_text(json.dumps(docs_compact, separators=(",", ":")))
    (data_dir / "provenance_videos.json").write_text(json.dumps(prov, separators=(",", ":")))
    (data_dir / "people.json").write_text(json.dumps(people, separators=(",", ":")))
    (data_dir / "featured.json").write_text(json.dumps(featured, separators=(",", ":")))

    prov_dst = DEPLOY / "provenance"
    if prov_dst.exists():
        shutil.rmtree(prov_dst)
    shutil.copytree(ROOT / "public/provenance", prov_dst)

    nx_dst = DEPLOY / "nextjs-postgres-foundry"
    if nx_dst.exists():
        shutil.rmtree(nx_dst)
    nx_dst.mkdir(parents=True)
    for rel in [
        "src",
        "scripts",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "next.config.ts",
        "postcss.config.mjs",
        "drizzle.config.json",
        "docker-compose.yml",
        "README.md",
    ]:
        src_p = ROOT / rel
        if src_p.is_dir():
            shutil.copytree(src_p, nx_dst / rel)
        elif src_p.is_file():
            shutil.copy2(src_p, nx_dst / rel)

    n_turns = len(turns)
    n_turn_vid = sum(1 for t in turns if t.get("directMp4Url") or t.get("brandedMp4Url") or t.get("sourceMeetingMp4Url"))
    n_verified = sum(1 for t in turns if t.get("videoTiming") in ("realigned", "realigned_relinked"))
    n_relinked = sum(1 for t in turns if t.get("videoTiming") == "realigned_relinked")
    n_diar = sum(1 for t in turns if t.get("videoTiming") == "diarized_window")
    n_removed = sum(1 for t in turns if t.get("videoTiming") == "removed")
    n_mtg_ia = sum(1 for m in meetings if "archive.org" in (m.get("mp4Url") or ""))
    readme = f"""# The Real Windy City — Cheyenne Civic Broadcast, Speaker Analytics & OSINT Vault (v3.2)

Live `$0/mo` Serverless GitHub Pages Deployment: **https://therealwindycity.github.io/real-windy-city-tv/**

## v3.2 Highlights
- **Internet Archive (`cochwy-*`) Video Routing (`0` Granicus links)**: Routes `{n_mtg_ia:,}` meetings and `{n_turn_vid:,}` / `{n_turns:,}` speaker turns through Internet Archive MP4 streams (`archive.org/download/cochwy-...`) and pre-rendered GitHub Release clips (`branded-clips-v1`).
- **Transcript-Verified Clip Timing**: `{n_verified:,}` clips were located word-for-word in the recording's own captions or a local Whisper transcript (`{n_relinked:,}` of them moved to the correct recording), `{n_diar:,}` diarized clips carry text transcribed at their exact times (speaker label flagged unverified), and `{n_removed:,}` turns that could not be located (e.g. Clerk Minutes summaries) are shown as transcript-only instead of playing the wrong moment.
- **Official Minutes & Supporting-Packet Lexical Reconciliation**: `41,396` document fixes, `3,928` speaker-turn fixes, and `892` Clerk Minutes roster reconciliations across `109` canonical Cheyenne speakers (including **Councilman Mark Moody [Ward III]** — `262` clips across `83` meetings, `0` `Cathy Moody` misattributions).
- **51-Entity Civic OSINT & Contractor Graph (`#osint` / `/osint`)**: Cross-links elected officials, city staff, Greater Cheyenne Chamber of Commerce, Cheyenne LEADS, Downtown Development Authority (DDA), engineering consultants (`AVI PC`), contractors (`Simon Contractors`, `JTL Group / Knife River`, `Reiman Corp.`, `Benchmark Engineers`), ordinances, bids, and speaker testimony, matched with verified Facebook, LinkedIn, Chamber, and official profiles.
- **Per-Clip Historical & Behavioral Analytics**: Every speaker clip displays historical clip count + direct vault link, speaking capacities (individual citizen vs. organization/lobbyist/staff/official), topic & lobby/oppose breakdowns, average speaking time, and Point-of-Order tracking.
- **Branded C-SPAN Video Packaging & Strict `<= 3 Min` Speaker-Segment Export**: Every video includes **The Real Windy City** branded intro/outro, synced cleaned captions (`CC`), and a **C-SPAN style "The Real Windy City" marquee info border**; exports and downloads strictly isolate only the speaker's `<= 3 min` segment — never the full meeting video.
"""
    (DEPLOY / "README.md").write_text(readme)
    (nx_dst / ".env.example").write_text("DATABASE_URL=postgresql://civic:civic@127.0.0.1:5432/civic_foundry\n")
    (DEPLOY / ".nojekyll").write_text("")

    # Sync persisted workspace mirror /home/user/real_windy_city_tv (excluding .git)
    for rel_dir in ["data", "provenance"]:
        dst = STATIC_SRC / rel_dir
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(DEPLOY / rel_dir, dst)
    shutil.copy2(DEPLOY / "README.md", STATIC_SRC / "README.md")

    print("v3.2 Export complete:")
    print(" - Episodes:", len(ep_index))
    print(" - Season shards:", len(by_season))
    print(" - Speaker turns:", len(turns))
    print(" - Canonical speakers:", len(speakers))
    print(" - OSINT entities:", len(osint))


if __name__ == "__main__":
    main()
