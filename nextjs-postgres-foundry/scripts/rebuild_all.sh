#!/usr/bin/env bash
# Rebuilds the corrected corpus from the pre-retime backup, in order. Idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."
B=data/retime/seed_backup_pre_retime
cp $B/speaker_turns.json $B/meetings.json $B/items.json $B/documents.json $B/briefs.json data/seed/
python3 scripts/apply_archive_zip_renames.py   # relabelled cheyenne-archives speaker ZIPs
python3 scripts/apply_retime.py        > data/retime/apply_summary.stdout
python3 scripts/finalize_clips.py
python3 scripts/relabel_self_introduced.py  # machine labels -> the person who introduces themself
python3 scripts/apply_leadin_trim.py   # start turns on the speaker, not the chair's call
python3 scripts/fix_trailing_calls.py    # clip showed the chair BEFORE the speaker was called
python3 scripts/fix_turn_ends.py         # end truncated turns where the speaker stops
python3 scripts/dedupe_turns.py          # comments recorded twice in the source data
python3 scripts/fix_exhibit_durations.py  # pre-cut exhibit clips: real file length
python3 scripts/apply_manual_corrections.py  # hand-verified windows (data/retime/manual_corrections.json)
python3 scripts/dedupe_meetings.py
python3 scripts/clean_text_markers.py    # '>>' speaker-change markers -> ' — ' for display
python3 scripts/recompute_speaker_stats.py | head -1
python3 scripts/plain_language.py         # plain-English labels, fresh counts, no name-match contracts
export DATABASE_URL=${DATABASE_URL:-postgresql://civic:civic@127.0.0.1:5432/civic_foundry}
npx tsx scripts/reseed_force.ts
