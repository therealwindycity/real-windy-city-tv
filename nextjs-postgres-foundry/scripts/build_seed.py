#!/usr/bin/env python3
"""
Builds data/seed/*.json for the "Real Windy City — Council TV" app.

Sources (all public records, nothing invented):
  1. Wayback Machine capture 20260913055109 of
     https://www.cheyennecity.org/Your-Government/City-Council/Minutes-and-Agendas
     -> the season guide: every Council / PSC / COW / Work Session row with its
        Agenda / Minutes / Video links (saved locally at /tmp/agendas.html).
  2. therealwindycity/therealwindycity: 2026-09-14-council/civicwatch/data/civic.db
     -> agenda items, minutes text, attachment metadata + text, extracted facts.
  3. therealwindycity/therealwindycity: pipeline/meetings.json (Granicus clip index)
     and pipeline/ordinance_history.json (ordinance reading history).
  4. therealwindycity/therealwindycity: civicwatch briefs (deterministic rule hits).

Run from the project root:  python3 scripts/build_seed.py
"""
import re, json, html, sqlite3, os, collections, hashlib

SRC = "/tmp/src"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "seed")
os.makedirs(OUT, exist_ok=True)

BASE = "https://www.cheyennecity.org"
WB_TS = "20260913055109"
CAPTURE_DATE = "2026-09-13"
SECTIONS = {
    "City Council Meetings": "council",
    "Public Services Committee Meetings": "psc",
    "Committee of the Whole Meetings": "cow",
    "Work Sessions": "work",
    "Finance Committee Meetings": "finance",
}
BODY_NAME = {
    "council": "City Council",
    "special": "Special City Council",
    "psc": "Public Services Committee",
    "finance": "Finance Committee",
    "cow": "Committee of the Whole",
    "work": "Work Session",
}


def clean(t):
    return html.unescape(re.sub(r"<[^>]+>", "", t)).replace("\xa0", " ").strip()


def fix_url(u):
    u = html.unescape(u)
    if u.startswith("//"):
        return "https:" + u
    if u.startswith("/"):
        return BASE + u
    return u


def link_kind(label):
    l = label.lower()
    if "agenda" in l:
        return "agenda"
    if "minutes" in l:
        return "minutes"
    if "video" in l:
        return "video"
    if "present" in l:
        return "presentation"
    if "substitute" in l:
        return "substitute"
    return "other"


# ---------------------------------------------------------------- 1. Wayback
page = open("/tmp/agendas.html", encoding="utf8", errors="ignore").read()
main = page[page.find('id="main-content"'):]
meetings = {}  # (date, body) -> dict
sec = None
yr = None
for m in re.finditer(r"<(h1|h2|h3|p)\b[^>]*>(.*?)</\1>", main, flags=re.S):
    tag, inner = m.group(1), m.group(2)
    txt = clean(inner)
    if tag == "h1":
        sec = txt
        yr = None
        continue
    if tag in ("h2", "h3"):
        yr = txt
        continue
    if tag == "p" and txt in SECTIONS:
        sec = txt
        yr = None
        continue
    mm = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})\b", txt)
    if not mm or sec not in SECTIONS:
        continue
    mo, d, y = int(mm.group(1)), int(mm.group(2)), int(mm.group(3))
    if y < 100:
        y += 2000
    date = f"{y:04d}-{mo:02d}-{d:02d}"
    links = []
    for href, label in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', inner, flags=re.S):
        lab = clean(label)
        if not lab:
            continue
        links.append({"label": lab[:80], "kind": link_kind(lab), "url": fix_url(href)})
    rest = txt[mm.end():]
    for l in links:
        rest = rest.replace(l["label"], " ")
    rest = re.sub(r"\b(Agenda|Minutes|Video)\b", " ", rest)
    note = re.sub(r"\s+", " ", rest).strip(" -–—|")
    body = SECTIONS[sec]
    if body == "council" and "special" in (note + txt).lower():
        body = "special"
    key = (date, body)
    entry = meetings.setdefault(key, {
        "date": date, "body": body, "links": [], "note": "", "sources": ["wayback"],
    })
    entry["links"].extend(links)
    if note and len(note) > 2:
        entry["note"] = note[:160]

print("wayback rows:", len(meetings))

# ---------------------------------------------------------------- 2. civic.db
con = sqlite3.connect(f"{SRC}/civic.db")
con.row_factory = sqlite3.Row


def map_kind(name):
    n = name.lower()
    if "special" in n:
        return "special"
    if "public services" in n:
        return "psc"
    if "finance" in n:
        return "finance"
    if "whole" in n:
        return "cow"
    if "work" in n:
        return "work"
    return "council"


civic_by_key = {}
for r in con.execute("select * from meetings"):
    key = (r["date"], map_kind(r["kind"]))
    civic_by_key[key] = dict(r)
    e = meetings.setdefault(key, {"date": r["date"], "body": key[1], "links": [], "note": "", "sources": []})
    e["sources"].append("civic.db")
    e["civicId"] = r["id"]
    e["eventId"] = r["event_id"] or None
    e["clipId"] = r["clip_id"] or None
    e["granicusAgenda"] = r["agenda_url"]
    e["granicusMinutes"] = r["minutes_url"]

# ---------------------------------------------------------------- 3. clip index
clip_idx = json.load(open("/tmp/meetings.json"))["meetings"]
for cid, c in clip_idx.items():
    if c["date"] < "2022-01-01":
        continue
    key = (c["date"], map_kind(c["name"]))
    e = meetings.get(key)
    if e is None:
        e = meetings.setdefault(key, {"date": c["date"], "body": key[1], "links": [], "note": "", "sources": []})
    if "granicus-index" not in e["sources"]:
        e["sources"].append("granicus-index")
    e["clipId"] = e.get("clipId") or c["clip_id"]
    e["mp4Url"] = c.get("mp4_url")
    if c.get("minutes_url") and not e.get("granicusMinutes"):
        e["granicusMinutes"] = c["minutes_url"]
    if c.get("agenda_url") and not e.get("granicusAgenda"):
        e["granicusAgenda"] = c["agenda_url"]

# ------------------------------------------------------------ item handling
PROCEDURAL = re.compile(r"^(CALL |PLEDGE|CONSENT AGENDA|ADJOURN|PUBLIC COMMENT|OTHER BUSINESS|EXECUTIVE|MOTION|PUBLIC HEARINGS?:?$|LEASES/CONTRACTS|CONSIDERATION OF BIDS|COMMUNICATIONS|ANNOUNCEMENTS|REPORTS|APPOINT|PROCLAMATION)", re.I)


def classify(title, item_no):
    t = title.strip()
    u = t.upper()
    if u.startswith("ORDINANCE"):
        return "ordinance"
    if u.startswith("RESOLUTION"):
        return "resolution"
    if u.startswith("MINUTES"):
        return "minutes"
    if re.search(r"public hearing|hearing", t, re.I) and not u.startswith("CONSIDERATION"):
        return "hearing"
    if re.match(r"consideration (of bid|to purchase|of purchase)", t, re.I) or re.search(r"\bbid #", t, re.I):
        return "bid"
    if re.search(r"\b(contract|agreement|lease|memorandum of understanding|amendment no)", t, re.I):
        return "contract"
    if PROCEDURAL.match(t) or t.endswith(":"):
        return "procedural"
    return "other"


def reading_of(title):
    m = re.search(r"(\d)(?:st|nd|rd|th)\s+READING", title, re.I)
    return {"1": "first", "2": "second", "3": "third"}.get(m.group(1)) if m else None


def amount_of(*texts):
    for t in texts:
        if not t:
            continue
        m = re.search(r"\$\s?([\d,]+(?:\.\d{1,2})?)", t)
        if m:
            try:
                return float(m.group(1).replace(",", ""))
            except ValueError:
                pass
    return None


def norm_title(t):
    t = re.sub(r"^ORDINANCE\s*[–—-]\s*(\d(st|nd|rd|th)\s*READING)?\s*[–—-]?\s*", "", t, flags=re.I)
    t = re.sub(r"\(.*?\)", " ", t)
    t = re.sub(r"[^a-z0-9 ]", " ", t.lower())
    return re.sub(r"\s+", " ", t).strip()


def slug_for_meeting(date, body):
    return f"{date}-{body}"


items_out = []
civic_rows = {}
for r in con.execute("select * from items order by meeting_id, id"):
    civic_rows.setdefault(r["meeting_id"], []).append(dict(r))

meeting_civic_to_key = {v["id"]: k for k, v in civic_by_key.items()}
for mid, rows in civic_rows.items():
    key = meeting_civic_to_key.get(mid)
    if not key:
        continue
    slug = slug_for_meeting(*key)
    for pos, r in enumerate(rows):
        title = re.sub(r"\s+", " ", (r["title"] or "").replace("\xa0", " ")).strip()
        kind = classify(title, r["item_no"])
        items_out.append({
            "meeting": slug, "pos": pos, "itemNo": r["item_no"], "title": title[:900],
            "action": (r["action"] or "").strip()[:240], "sponsor": (r["sponsor"] or "").strip()[:120],
            "consent": bool(r["consent"]), "kind": kind, "reading": reading_of(title) if kind == "ordinance" else None,
            "amountUsd": amount_of(r["action"], title) if kind in ("bid", "contract", "resolution", "other") else None,
            "normKey": norm_title(title)[:240] if kind == "ordinance" else None,
        })
print("items:", len(items_out))

# ------------------------------------------------------------ minutes + docs
NAME_SET = set()
minutes_docs = {}
for d in con.execute("select * from docs where role='minutes'"):
    key = meeting_civic_to_key.get(d["meeting_id"])
    if not key:
        continue
    txt = "\n".join(p["text"] for p in con.execute("select text from pages where doc_id=? order by page", (d["id"],)))
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"\n\s*\n\s*(\n\s*)*", "\n\n", txt).strip()
    minutes_docs[key] = {"docId": d["id"], "url": d["url"], "pages": d["pages"], "words": d["words"], "text": txt}

roll_by_meeting = {}
for key, md in minutes_docs.items():
    flat = re.sub(r"\s+", " ", md["text"])
    mm = re.search(r"Present were:\s*MAYOR\s*[–—-]\s*(.+?)\s+COUNCIL MEMBERS\s*[–—-]\s*(.+?)\.\s*Also present:\s*(.+?)\.\s", flat, re.I)
    if not mm:
        continue
    mayor = mm.group(1).strip()
    seg_m = re.split(r"\s*\.?\s*Absent\b", mm.group(2))[0]
    members = [x.strip(" .") for x in re.split(r",\s*|\s+and\s+", seg_m) if x.strip(" .") and not re.search(r"\d|joining", x)]
    also = mm.group(3).strip()
    roll_by_meeting[key] = {"mayor": mayor, "members": members, "also": also}
    for n in members + [mayor]:
        ln = n.split()[-1].strip(",.") if n.split() else ""
        if len(ln) > 2:
            NAME_SET.add(ln)

# vote-event parser
VOTE_NO = re.compile(r"Voting\s*[“\"”']?\s*no\s*[”\"”']?\s*[–—-]\s*(.{0,200})", re.I)
vote_events = []
dissent = collections.Counter()
for key, md in minutes_docs.items():
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", md["text"]) if p.strip()]
    slug = slug_for_meeting(*key)
    idx = 0
    for p in paras:
        if "Voting" not in p and "Motion" not in p:
            continue
        if not re.search(r"Voting|carried|failed", p):
            continue
        no_names = []
        m = VOTE_NO.search(p)
        if m:
            seg = re.split(r"(?<!Dr)(?<!Mr)(?<!Ms)(?<!Mrs)\.\s", m.group(1), 1)[0]
            no_names = [n for n in sorted(NAME_SET) if re.search(r"\b" + re.escape(n) + r"\b", seg)]
        yes_all = bool(re.search(r"Voting\s*[“\"”']?\s*yes\s*[”\"”']?\s*[–—-]?\s*all members", p, re.I))
        result = "failed" if re.search(r"\b(failed|did not carry|died for lack)\b", p, re.I) else ("carried" if re.search(r"\bcarried\b", p, re.I) else "recorded")
        if no_names:
            for n in no_names:
                dissent[n] += 1
        vote_events.append({
            "meeting": slug, "idx": idx, "excerpt": p[:520], "result": result,
            "unanimous": bool(yes_all and not no_names), "noNames": no_names, "source": "official minutes",
        })
        idx += 1
print("vote events:", len(vote_events), "dissent:", dissent.most_common(8))

# ------------------------------------------------------------- attachments
FULLTEXT_MEETINGS = {("2026-09-14", "council")}
docs_out = []
for key, md in minutes_docs.items():
    docs_out.append({"id": md["docId"], "meeting": slug_for_meeting(*key), "role": "minutes", "itemNo": "", "title": "Official minutes (Granicus)",
                     "url": md["url"], "pages": md["pages"], "words": md["words"], "ocr": False, "sha1": None, "text": md["text"]})
for d in con.execute("select * from docs where role='attachment'"):
    key = meeting_civic_to_key.get(d["meeting_id"])
    if not key or key[0] < "2026-01-01":
        continue
    text = None
    if key in FULLTEXT_MEETINGS:
        parts = []
        for p in con.execute("select page,text from pages where doc_id=? order by page", (d["id"],)):
            parts.append(f"[p{p['page']}]\n" + re.sub(r"[ \t]+", " ", p["text"] or ""))
        text = re.sub(r"\n{3,}", "\n\n", "\n".join(parts))[:60000]
    docs_out.append({"id": d["id"], "meeting": slug_for_meeting(*key), "role": "attachment", "itemNo": d["item_no"] or "",
                     "title": re.sub(r"\s+", " ", d["item_title"] or "")[:300], "url": d["url"], "pages": d["pages"], "words": d["words"],
                     "ocr": bool(d["ocr"]), "sha1": d["sha1"], "text": text})
print("docs:", len(docs_out))

# ------------------------------------------------------------------- briefs
briefs = []
for fn, key in (("brief_2026-09-14_event1441.md", ("2026-09-14", "council")), ("brief_2026-09-21_event1443.md", ("2026-09-21", "psc")),
                ("brief_2026-09-22_event1444.md", ("2026-09-22", "finance")), ("brief_2026-08-24_clip1126.md", ("2026-08-24", "council"))):
    path = f"{SRC}/{fn}"
    if not os.path.exists(path):
        continue
    cur = None
    for line in open(path, encoding="utf8"):
        line = line.rstrip("\n")
        h = re.match(r"^## Item (\S+) — (.*?)\s*$", line)
        if h:
            cur = {"meeting": slug_for_meeting(*key), "itemNo": h.group(1), "title": h.group(2), "docId": None, "facts": {}, "flags": [], "quotes": []}
            briefs.append(cur)
            continue
        if cur is None:
            continue
        d = re.match(r"^\*doc (\d+) · (\d+)p · (\d+)w", line)
        if d:
            cur["docId"] = int(d.group(1))
            continue
        f = re.match(r"^- \*\*\[(HIGH|MED|LOW)\] ([A-Z_]+)\*\* — (.*)$", line)
        if f:
            cur["flags"].append({"sev": f.group(1), "code": f.group(2), "msg": f.group(3)})
            continue
        k = re.match(r"^- ([a-z_]+): (.*)$", line)
        if k:
            cur["facts"][k.group(1)] = k.group(2)
            continue
        q = re.match(r"^\s+> p(\d+): (.*)$", line)
        if q:
            cur["quotes"].append({"page": int(q.group(1)), "text": q.group(2)})
print("brief items:", len(briefs))

# ------------------------------------------------------------- ordinances
ord_hist = json.load(open("/tmp/ordh.json"))["ordinances"]
series = {}


def okey(t, n=190):
    return re.sub(r"[^a-z0-9]", "", t.lower())[:n]


def ord_kind(t):
    tl = t.lower()
    if "annex" in tl and "zoning" not in tl:
        return "Annexation"
    if "zoning" in tl:
        return "Rezoning"
    if "municipal code" in tl or "city code" in tl or re.search(r"title \d", tl):
        return "Code amendment"
    if "budget" in tl or "appropriat" in tl:
        return "Fiscal"
    return "Ordinance"


for it in items_out:
    if it["kind"] != "ordinance" or not it["normKey"]:
        continue
    k = okey(it["normKey"])
    s = series.setdefault(k, {"k": k, "title": it["title"], "readings": [], "sources": set()})
    s["sources"].add("agenda packets")
    date = it["meeting"][:10]
    s["readings"].append({"date": date, "body": BODY_NAME.get(it["meeting"][11:], "Council"), "stage": it["reading"] or "listed",
                          "context": (it["action"] or "")[:200], "meeting": it["meeting"], "itemNo": it["itemNo"], "source": "agenda packets"})
for hk, h in ord_hist.items():
    k = "h-" + okey(hk.replace("title-", "").replace("-", " "), 120)
    s = series.get(k)
    if s is None:
        title = (h["mentions"][0].get("context") or hk)[:240]
        s = series.setdefault(k, {"k": k, "title": title, "readings": [], "sources": set()})
    s["sources"].add("ordinance_history.json")
    for mn in h["mentions"]:
        s["readings"].append({"date": mn["date"], "body": mn["body"], "stage": mn.get("stage") or "listed", "context": (mn.get("context") or "")[:240],
                              "meeting": None, "itemNo": "", "source": "ordinance_history.json (transcript grep)"})
ordinances_out = []
for k, s in series.items():
    seen = set()
    rd = []
    for r in sorted(s["readings"], key=lambda r: (r["date"], r["stage"])):
        sig = (r["date"], r["stage"])
        if sig in seen:
            continue
        seen.add(sig)
        rd.append(r)
    title = s["title"]
    title = re.sub(r"^ORDINANCE\s*[–—-]\s*(\d(st|nd|rd|th)\s*READING)?\s*[–—-]?\s*", "", title, flags=re.I)
    title = re.sub(r"\s*\((?:SPONSOR|PUBLIC SERVICES|FINANCE|POSTPONED)[^)]*\)\s*", " ", title, flags=re.I).strip()
    title = title[:1].upper() + title[1:]
    slug = "o-" + hashlib.md5(k.encode()).hexdigest()[:8]
    ordinances_out.append({"slug": slug, "key": k, "title": title[:420], "kind": ord_kind(title), "sources": sorted(s["sources"]),
                           "firstDate": rd[0]["date"], "lastDate": rd[-1]["date"], "readings": rd})
ordinances_out.sort(key=lambda o: o["lastDate"], reverse=True)
print("ordinance series:", len(ordinances_out))

# ----------------------------------------------------------- facts (2026-08+)
facts_out = []
for r in con.execute("""select f.kind,f.key,f.value,f.span,f.page,d.id as doc_id,d.meeting_id,d.item_no from facts f join docs d on d.id=f.doc_id
                        where d.meeting_id in (select id from meetings where date>='2026-08-10')"""):
    key = meeting_civic_to_key.get(r["meeting_id"])
    if not key:
        continue
    facts_out.append({"meeting": slug_for_meeting(*key), "itemNo": r["item_no"] or "", "docId": r["doc_id"], "page": r["page"], "kind": r["kind"],
                      "key": (r["key"] or "")[:80], "value": (r["value"] or "")[:200], "span": re.sub(r"\s+", " ", r["span"] or "")[:300]})
print("facts:", len(facts_out))

# ------------------------------------------------------------- runtimes
def parse_times(text):
    flat = re.sub(r"\s+", " ", text)
    st = re.search(r"beginning at (\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?", flat, re.I)
    en = re.search(r"adjourned at (\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?", flat, re.I)

    def mins(m):
        if not m:
            return None
        h = int(m.group(1)) % 12
        mi = int(m.group(2) or 0)
        if m.group(3).lower() == "p":
            h += 12
        return h * 60 + mi
    a, b = mins(st), mins(en)
    run = (b - a) if (a is not None and b is not None and b > a) else None
    return a, b, run


times = {k: parse_times(v["text"]) for k, v in minutes_docs.items()}

# ------------------------------------------------------- final meeting list
GR = "https://cheyenne.granicus.com"
final = []
for (date, body), e in sorted(meetings.items()):
    if date < "2022-01-01":
        continue
    links = e.get("links", [])
    agenda = next((l["url"] for l in links if l["kind"] == "agenda"), None) or e.get("granicusAgenda")
    minutes = next((l["url"] for l in links if l["kind"] == "minutes"), None) or e.get("granicusMinutes")
    video = next((l["url"] for l in links if l["kind"] == "video"), None)
    ev = e.get("eventId")
    if not ev and agenda:
        mm = re.search(r"event_id=(\d+)", agenda)
        ev = int(mm.group(1)) if mm else None
    clip = e.get("clipId")
    if not clip and video:
        mm = re.search(r"clip[_/]id=(\d+)|/clip/(\d+)", video)
        clip = int(next(g for g in mm.groups() if g)) if mm else None
    final.append({
        "slug": slug_for_meeting(date, body), "date": date, "body": body, "bodyName": BODY_NAME[body], "season": int(date[:4]),
        "note": e.get("note", ""), "eventId": ev, "clipId": clip, "agendaUrl": agenda, "minutesUrl": minutes, "videoUrl": video,
        "mp4Url": e.get("mp4Url"), "extraLinks": [l for l in links if l["kind"] in ("presentation", "substitute", "other")][:6],
        "hasMinutesText": (date, body) in minutes_docs, "sources": e.get("sources", []),
        "startMin": times.get((date, body), (None, None, None))[0], "endMin": times.get((date, body), (None, None, None))[1],
        "runtimeMin": times.get((date, body), (None, None, None))[2],
    })
print("meetings:", len(final), collections.Counter(m["body"] for m in final))

# ---------------------------------------------------------------- people
def clean_person(n):
    n = re.sub(r"\(.*$", "", n)
    n = re.sub(r"\s*[,;]\s*(Mayor|Council Member).*$", "", n)
    return n.strip(" ,;.")


def split_title(full):
    m = re.match(r"^(Dr\.|Mr\.|Mrs\.|Ms\.)\s+", full)
    return (m.group(1), full[m.end():]) if m else ("", full)


canon = collections.defaultdict(collections.Counter)
for roll in roll_by_meeting.values():
    for full in [roll["mayor"]] + roll["members"]:
        _, nm = split_title(clean_person(full))
        if len(nm.split()) >= 2:
            canon[nm.split()[-1]][nm] += 1
canon_name = {ln: c.most_common(1)[0][0] for ln, c in canon.items()}

people = {}
for key, roll in roll_by_meeting.items():
    slug = slug_for_meeting(*key)
    entries = [(roll["mayor"], "Mayor")] + [(n, "Council Member") for n in roll["members"]]
    for full, role in entries:
        hon, name = split_title(clean_person(full))
        if len(name.split()) == 1:
            name = canon_name.get(name)
            if not name:
                continue
        p = people.setdefault(name, {"name": name, "honorific": hon, "role": role, "meetings": set()})
        if hon and not p["honorific"]:
            p["honorific"] = hon
        p["meetings"].add(slug)
    cl = re.search(r"([A-Z][a-z]+ [A-Z][a-z]+),\s*City Clerk", roll["also"])
    if cl:
        p = people.setdefault(cl.group(1), {"name": cl.group(1), "honorific": "", "role": "City Clerk", "meetings": set()})
        p["meetings"].add(slug)
for p in people.values():
    p["lastName"] = p["name"].split()[-1]
    p["dissents"] = dissent.get(p["lastName"], 0)
    p["meetingsPresent"] = len(p["meetings"])
    p["meetings"] = sorted(p["meetings"])[-12:]

json.dump(final, open(f"{OUT}/meetings.json", "w"), ensure_ascii=False)
json.dump(items_out, open(f"{OUT}/items.json", "w"), ensure_ascii=False)
json.dump(docs_out, open(f"{OUT}/documents.json", "w"), ensure_ascii=False)
json.dump(vote_events, open(f"{OUT}/vote_events.json", "w"), ensure_ascii=False)
json.dump(briefs, open(f"{OUT}/briefs.json", "w"), ensure_ascii=False)
json.dump(ordinances_out, open(f"{OUT}/ordinances.json", "w"), ensure_ascii=False)
json.dump(facts_out, open(f"{OUT}/facts.json", "w"), ensure_ascii=False)
json.dump(list(people.values()), open(f"{OUT}/people.json", "w"), ensure_ascii=False)
json.dump({"rolls": {f"{k[0]}-{k[1]}": v for k, v in roll_by_meeting.items()}, "dissent": dissent.most_common()},
          open(f"{OUT}/rolls.json", "w"), ensure_ascii=False)
for fn in os.listdir(OUT):
    print(fn, os.path.getsize(os.path.join(OUT, fn)))
