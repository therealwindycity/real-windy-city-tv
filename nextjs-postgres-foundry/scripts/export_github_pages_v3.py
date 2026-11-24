#!/usr/bin/env python3
"""
Exports the complete zero-gap Option 3 static data shards + provenance films +
Next.js 16/PostgreSQL 17 source tree into /tmp/rwc_tv_deploy for GitHub Pages.
"""
import json
import shutil
import subprocess
from collections import defaultdict
from pathlib import Path

ROOT = Path("/home/user/unified_civic_foundry")
SEED = ROOT / "data/seed"
DEPLOY = Path("/tmp/rwc_tv_deploy")

def main():
    if DEPLOY.exists():
        shutil.rmtree(DEPLOY)
    subprocess.run(
        ["git", "clone", "https://github.com/therealwindycity/real-windy-city-tv.git", str(DEPLOY)],
        check=True,
    )

    data_dir = DEPLOY / "data"
    seasons_dir = data_dir / "seasons"
    seasons_dir.mkdir(parents=True, exist_ok=True)

    # Pull exact computed TV episode rows directly from PostgreSQL 17!
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
                     runtime_min AS "runtimeMin", extra_links AS "extraLinks"
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

    (nx_dst / ".env.example").write_text("DATABASE_URL=postgresql://civic:civic@127.0.0.1:5432/civic_foundry\n")
    (DEPLOY / ".nojekyll").write_text("")

    print("Export complete:")
    print(" - Episodes:", len(ep_index))
    print(" - Season shards:", len(by_season))
    print(" - Speaker turns:", len(turns))
    print(" - Speakers:", len(speakers))
    print(" - Ordinances:", len(ords))
    print(" - Foundry docs:", len(docs_compact))

if __name__ == "__main__":
    main()
