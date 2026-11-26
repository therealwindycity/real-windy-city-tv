#!/usr/bin/env bash
# Rebuilds the corrected corpus from the pre-retime backup, in order. Idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."
B=data/retime/seed_backup_pre_retime
cp $B/speaker_turns.json $B/meetings.json $B/items.json $B/documents.json $B/briefs.json data/seed/
python3 scripts/apply_retime.py        > data/retime/apply_summary.stdout
python3 scripts/finalize_clips.py
python3 scripts/dedupe_meetings.py
python3 scripts/recompute_speaker_stats.py | head -1
export DATABASE_URL=${DATABASE_URL:-postgresql://civic:civic@127.0.0.1:5432/civic_foundry}
npx tsx scripts/reseed_force.ts
