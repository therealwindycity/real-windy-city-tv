#!/usr/bin/env python3
"""Apply the speaker-name fix to a cheyenne-archives-* clone (arg: path to clone).
1) scripts/publish_to_github.py: verified-roster CANONICAL_RULES; no names from the previous line's mention;
   no name propagation by voice similarity.
2) speaker-videos/*/{episode.json,manifest.json,SPEAKER_INDEX.md}: automatic names -> Speaker_NN_Unverified_Voice
   using data/retime/archive_zip_renames.json (same renames as the release assets)."""
import json, re, sys
from pathlib import Path
clone = Path(sys.argv[1]); repo = clone.name if clone.name.startswith("cheyenne-archives") else sys.argv[2]
REN = json.load(open(Path(__file__).resolve().parent.parent / "data/retime/archive_zip_renames.json"))
p = clone / "scripts/publish_to_github.py"; s = p.read_text()
R = [('(r"(laybourn|layborne|layborn|leybourn|leborn|labour|\\blay\\b)", "Councilman_Tom_Laybourn")', '(r"(laybourn|layborne|layborn|leybourn|leborn|labour)", "Councilman_Pete_Laybourn")'),
     ('(r"(wolf|wolfe)", "Councilman_Larry_Wolf")', '(r"(wolf|wolfe)", "Councilman_Lawrence_Wolfe")'),
     ('(r"(moody)", "Councilman_Ken_Moody")', '(r"(moody)", "Councilman_Mark_Moody")'),
     ('(r"(esquibel|esabel|escoel)", "Councilman_Richard_Johnson_or_Esquibel")', '(r"(esquibel|esabel|escoel)", "Councilman_Ken_Esquibel")'),
     ('(r"(segrave|crave|seagrave)", "Councilman_Pete_Laybourn_or_Segrave")', '(r"(segrave|seagrave)", "Councilman_Tom_Segrave")'),
     ('(r"(kristin_lee|kristen_lee|ms\\.?_lee)", "Kristin_Lee_Attorney")', '(r"(kristin_lee|kristen_lee|ms\\.?_lee)", "Kristen_Lee_Deputy_City_Attorney")'),
     ('(r"(emmons|emmens|immens|nimens|edmonds|\\bmins\\b)", "Dr_Kathy_Emmons_Council")', '(r"(emmons|emmens|immens|nimens|edmonds)", "Dr_Kathy_Emmons_Council")'),
     ('(r"(seth_lloyd|seth_white|sethway|subway_planning|\\blloyd\\b)", "Seth_Lloyd_Planning")', '(r"(seth_lloyd|\\blloyd\\b)", "Seth_Lloyd_Planning")')]
if "Councilman_Larry_Wolf" in s:
    for a, b in R:
        assert s.count(a) == 1, a; s = s.replace(a, b)
    old = '''    tail = prev_text[-65:]
    m_rec = re.search(r"((?:Councilman|Councilwoman|Mayor|Dr\\.|Mr\\.|Ms\\.|Mrs\\.)\\s+[A-Z][a-z]+)\\.?$", tail)
    if m_rec:
        return canonicalize_speaker(sanitize_name(m_rec.group(1)))
    return None'''
    new = '''    # NOTE: a name at the end of the PREVIOUS caption line ("Seconded by Mr. Wolf.") is NOT used any more: it named
    # whoever spoke next after any mention, motion or second (e.g. the presiding officer became "Larry Wolf").
    return None'''
    assert s.count(old) == 1; s = s.replace(old, new)
    i = s.index("        named_centroids = {}"); j = s.index("        unlabeled = [j for j, h in enumerate(hints) if not h]")
    s = s[:i] + s[j:]
    old = '''            for pos, j in enumerate(unlabeled):
                if named_centroids:
                    best_spk, best_sim = max(
                        ((s, float(cosine_similarity(feats_norm[j : j + 1], c.reshape(1, -1))[0, 0])) for s, c in named_centroids.items()),
                        key=lambda kv: kv[1],
                    )
                    if best_sim >= 0.32:
                        hints[j] = best_spk
                        continue
                hints[j] = f"Voice_Cluster_{labels[pos] + 1:02d}"'''
    new = '''            # Unnamed turns stay anonymous voice clusters.  They are NOT given the name of the most similar "named"
            # voice any more: at the old cosine >= 0.32 threshold staff, chairs and public commenters were merged
            # into council members' clips.  Names now come only from a speaker introducing themself in that turn.
            for pos, j in enumerate(unlabeled):
                hints[j] = f"Voice_Cluster_{labels[pos] + 1:02d}"'''
    assert s.count(old) == 1; s = s.replace(old, new)
    p.write_text(s); print("patched", p)
n = 0
for folder in sorted(d for d in (clone / "speaker-videos").glob("*") if d.is_dir()):
    ep = folder / "episode.json"
    e = json.loads(ep.read_text()) if ep.exists() else None
    tag = (e or {}).get("release_tag") or ""
    if not tag and (folder / "SPEAKER_INDEX.md").exists():
        m_ = re.search(r"releases/(?:tag|download)/(speaker-videos-[^/)\s`]+)", (folder / "SPEAKER_INDEX.md").read_text())
        tag = m_.group(1) if m_ else ""
    zmap = {k.rsplit("/", 1)[1]: v for k, v in REN.items() if k.startswith(f"{repo}/{tag}/")}
    if not zmap:
        continue
    lmap = {re.sub(r"_\d+_clips\.zip$", "", o): re.sub(r"_\d+_clips\.zip$", "", v) for o, v in zmap.items()}
    if e is not None:
        for c in e.get("cast", []):
            c["speaker"] = lmap.get(c.get("speaker"), c.get("speaker"))
            for o, v in zmap.items():
                c["zip_url"] = (c.get("zip_url") or "").replace("/" + o, "/" + v)
        ep.write_text(json.dumps(e, indent=2, ensure_ascii=False) + "\n")
    mf = ep.parent / "manifest.json"
    if mf.exists() and mf.stat().st_size > 0:
        try:
            m = json.loads(mf.read_text())
            for x in m:
                if x.get("speaker") in lmap:
                    x["speaker_original_automatic_label"] = x["speaker"]
                    x["speaker"] = lmap[x["speaker"]]
            mf.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n")
        except Exception as ex:
            print("manifest skipped", mf, ex)
    md = ep.parent / "SPEAKER_INDEX.md"
    if md.exists():
        t = md.read_text()
        for o, v in sorted(zmap.items(), key=lambda kv: -len(kv[0])):
            t = t.replace(o, v)
        for o, v in sorted(lmap.items(), key=lambda kv: -len(kv[0])):
            t = t.replace(f"`{o}`", f"`{v}`")
        if "Speaker names corrected" not in t:
            t = t.replace("## 🎭 Cast of Characters", "> ⚠️ **Speaker names corrected (2026-11-27):** automatically guessed names "
                          "were unreliable and are now shown as `Unverified_Voice`; clip file names inside the ZIPs may still "
                          "carry the old automatic label (listed as `speaker_original_automatic_label` in manifest.json).\n\n"
                          "## 🎭 Cast of Characters", 1)
        md.write_text(t)
    n += 1
print(repo, "episodes updated:", n)
