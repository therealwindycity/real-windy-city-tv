#!/usr/bin/env python3
"""Push re-timed/re-linked fields from data/seed/{speaker_turns,meetings}.json into PostgreSQL."""
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data/seed"
DB = "postgresql://civic:civic@127.0.0.1:5432/civic_foundry"

TURN_COLS = {
    "startSec": ("start_sec", "double precision"), "endSec": ("end_sec", "double precision"),
    "durationSec": ("duration_sec", "double precision"), "hms": ("hms", "text"),
    "sourceMeetingMp4Url": ("source_meeting_mp4_url", "text"), "embedUrl": ("embed_url", "text"),
    "brandedMp4Url": ("branded_mp4_url", "text"), "text": ("text", "text"),
    "speakerSlug": ("speaker_slug", "text"), "speakerName": ("speaker_name", "text"),
    "videoTiming": ("video_timing", "text"), "videoTimingNote": ("video_timing_note", "text"),
    "alignScore": ("align_score", "double precision"), "alignSource": ("align_source", "text"),
    "legacyStartSec": ("legacy_start_sec", "double precision"), "legacyEndSec": ("legacy_end_sec", "double precision"),
    "speakerAttributionVerified": ("speaker_attribution_verified", "boolean"),
    "speakerAnalytics": ("speaker_analytics", "jsonb"),
}
MEET_COLS = {
    "mp4Url": ("mp4_url", "text"), "videoUrl": ("video_url", "text"),
    "extraLinks": ("extra_links", "jsonb"), "videoLinkVerified": ("video_link_verified", "boolean"),
}


def push(table, key_json, key_col, rows, cols):
    payload = []
    for r in rows:
        d = {key_json: r[key_json]}
        for k in cols:
            if k in r:
                d[k] = r[k]
        if table == "speaker_turns" and d.get("speakerAttributionVerified") is None:
            d["speakerAttributionVerified"] = True
        payload.append(d)
    rec = ", ".join(f'"{k}" {typ}' for k, (_, typ) in cols.items())
    sets = ", ".join(
        f"{col} = COALESCE(x.\"{k}\", {table}.{col})" if k in ("text", "speakerSlug", "speakerName", "hms", "startSec", "endSec", "durationSec", "speakerAttributionVerified")
        else f"{col} = x.\"{k}\""
        for k, (col, _) in cols.items()
    )
    keytyp = "integer" if key_col == "id" else "text"
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, dir=str(ROOT / "data/retime")) as f:
        json.dump(payload, f)
        path = f.name
    sql = f"""
    \\set content `cat {path}`
    UPDATE {table} SET {sets}
    FROM json_to_recordset(:'content'::json) AS x("{key_json}" {keytyp}, {rec})
    WHERE {table}.{key_col} = x."{key_json}";
    """
    out = subprocess.run(["psql", DB, "-v", "ON_ERROR_STOP=1", "-q"], input=sql, text=True, capture_output=True)
    Path(path).unlink()
    if out.returncode:
        raise SystemExit(out.stderr)
    print(table, "updated:", out.stdout.strip() or "ok")


def main():
    turns = json.loads((SEED / "speaker_turns.json").read_text())
    meetings = json.loads((SEED / "meetings.json").read_text())
    push("speaker_turns", "id", "id", turns, TURN_COLS)
    push("meetings", "slug", "slug", meetings, MEET_COLS)
    q = """SELECT video_timing, count(*) FROM speaker_turns GROUP BY 1 ORDER BY 2 DESC;
           SELECT video_link_verified, count(*) FROM meetings GROUP BY 1;"""
    print(subprocess.check_output(["psql", DB, "-A", "-F", "\t", "-c", q], text=True))


if __name__ == "__main__":
    main()
