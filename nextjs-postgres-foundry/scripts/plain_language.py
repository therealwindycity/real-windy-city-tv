#!/usr/bin/env python3
"""
Plain-language pass over the seed data (runs after recompute_speaker_stats, before reseed).

The site's labels had grown out of a pile of jargon ("OSINT dossier", "Floor Inquiry /
Deliberation", "Civic Watchdog / Statutory Advocate", "145 Verified Broadcast
Interventions"...). This step rewrites every visitor-facing label in the seed into words a
normal reader understands, and refreshes the numbers that were frozen inside those labels
so they match the corrected clip data.

It also fixes three data problems in the people/organisations directory:
  * People were linked to "contracts" by a last-name text match (Charles Miller <- "Miller &
    Sons Construction", Jeff White <- "white" in a transcript), which gave individuals
    dollar totals they never received. People no longer carry contract lists or money.
  * Clip / meeting counts on people's directory cards were never recomputed after re-timing.
  * Several entries sat in the wrong group (the water utility under "Chamber / LEADS / DDA",
    a city finance manager under "Special Interest / Watchdog").

Idempotent: speakers_directory.json and osint_entities.json are not restored from the backup
by rebuild_all.sh, so every mapping below accepts both the old and the new label.
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

SEED = Path(__file__).resolve().parent.parent / "data/seed"

CAPACITY = {
    "Elected Official": "Elected official",
    "Municipal Staff / Counsel": "City staff",
    "Individual Citizen": "Resident",
    "Civic Watchdog / Statutory Advocate": "Civic watchdog",
    "Organizational / Lobbyist Representative": "Speaking for an organization",
    "Contractor / Vendor / Applicant Agent": "Contractor or applicant",
}

STANCE = {
    "support_lobby_for": "Supports",
    "oppose_challenge": "Opposes",
    "inquiry_discussion": "Questions & discussion",
    "technical_staff_report": "Staff report",
    "sponsor_motion": "Makes a motion",
    "procedural_point_of_order": "Raises a point of order",
}

TOPIC = {
    "annexation": "Annexation (adding land to the city)",
    "datacenters": "Data centers, power & water",
    "budget": "Budget & taxes",
    "zoning": "Zoning & building rules",
    "procedure": "Meeting rules & public comment",
    "housing": "Housing & subdivisions",
    "safety": "Police, fire & public safety",
    "contracts": "Contracts & bids",
    "infrastructure": "Roads, parks & stormwater",
}

# speakers whose role was guessed wrong by the original labelling
SLUG_CAPACITY = {
    "tony-laird": ("City board member", "Cheyenne Planning Commission (Chair)"),
    "gavin-lobmeyer": ("City board member", "Cheyenne Board of Adjustment"),
    "justin-tripp": ("City staff", "City of Cheyenne (Accounting & Finance Manager)"),
    "ben-trautwein": ("Contractor or applicant", "Applicant's engineer"),
    "brad-emmons": ("Contractor or applicant", "AVI PC (engineering & planning firm)"),
    "jeff-nakashima": ("Contractor or applicant", "Trammell Crow (applicant)"),
}

NOTE_FIXES = [
    ("speaker label came from automatic diarization and is unverified", "the speaker's name was assigned by software and has not been confirmed"),
    ("at the diarized times", "at these times"),
    ("The diarized window", "This part of the recording"),
    ("diarized window", "automatically detected stretch of speech"),
    ("automatic diarization", "automatic speaker detection"),
    ("diarization", "automatic speaker detection"),
    ("diarized", "automatically detected"),
    ("Clerk Minutes summary", "summary from the City Clerk's minutes"),
    ("This turn's text", "This clip's text"),
    ("caption-based speaker label", "speaker name taken from the captions"),
]

POE_TYPE = {
    "Point of Order / Statutory Challenge": "Point of order",
    "Chair Ruling / Clock or Mic Cutoff": "Chair ended the speaker's time",
}

ROLE = {
    "Public Commenter (Packet Verified)": "Public Commenter",
    "Council / Public Record": "Speaker not identified",
    "Verified Floor Exhibit Reel": "Compilation of several speakers",
}

HEADLINE_FIXES = [
    ("Founder/Chronicler, The Real Windy City • Statutory Compliance, Wyo. Stat. § 15-1-402 Annexation, UDC & Robert's Rules Watchdog",
     "Founder, The Real Windy City • Watches whether the city follows state annexation law, its own building code and meeting rules"),
    ("Frequent Fiscal & Zoning Dissent Voice", "Frequent dissenting voice on budget and zoning items"),
    ("Roll-Call & Official Proceedings Custodian across 2018–2024", "Kept the official meeting record, 2018–2024"),
    ("Dual-Capacity Testifier: Staff Annexation/UDC Presenter & CPEA Board Representative",
     "Presents annexation and building-code items for city staff; also speaks for the city employees' association (CPEA)"),
    ("Lead Author on UDC Text Amendments, Annexations, PUDs & Data Center Zoning",
     "Leads city building-code changes, annexations, planned developments and data center zoning"),
    ("Custodian of Official Minutes, Ordinances, Bids & Licensing", "Keeps the official minutes, ordinances, bids and licenses"),
    ("Municipal Code, Contracts & Statutory Counsel", "Legal adviser on city code, contracts and state law"),
    ("Planning Agent for Cheyenne LEADS & Commercial Rezoning Applicants + City Engineering Consultant",
     "Represents Cheyenne LEADS and business rezoning applicants; also an engineering consultant to the city"),
    ("Municipal Budget & 6th Penny Lead", "Leads on the city budget and 6th Penny sales tax"),
    ("Joint Powers Economic Board Rep", "Joint Powers economic board member"),
    ("Oversees Municipal Bids, Road Extensions (Storey Blvd, Christensen Rd), Stormwater & Consultant Contracts",
     "Oversees city bids, road extensions (Storey Blvd, Christensen Rd), stormwater and engineering contracts"),
    ("Annual Budget & Investment Policy Lead", "Leads the annual budget and investment policy"),
    ("Neighborhood & Stormwater Infrastructure Advocate", "Advocate for neighborhoods and stormwater projects"),
    ("Downtown & Historic Preservation Sponsor", "Sponsors downtown and historic-preservation items"),
    ("M.A. Geography / GIS Specialist", "M.A. in geography, mapping (GIS) specialist"),
    ("Chamber Endorsed", "Endorsed by the Chamber of Commerce"),
    ("Cheyenne LEADS & Chamber Participant", "Takes part in Cheyenne LEADS and the Chamber"),
]
INTERVENTIONS = re.compile(r"\s*•\s*\d+ Verified Broadcast Interventions \(\d{4}–\d{4}\)")
PLAIN_COUNT = re.compile(r"\s*•\s*\d+ clips? in meeting videos \(\d{4}(–\d{4})?\)")

# --------------------------------------------------------------------------- organisations
ORG = {
    "cheyenne-leads": dict(
        category="Business Groups", subtype="Non-profit economic development group",
        summary="Cheyenne's private, non-profit economic development group. It shares an office with the Chamber of Commerce at 1 Depot Square and often asks the city for business-park and industrial rezonings, data center land deals, agreements with the city, and road and utility extensions (often designed by AVI PC or Benchmark Engineers)."),
    "greater-cheyenne-chamber-of-commerce": dict(
        category="Business Groups", subtype="Business association",
        summary="Cheyenne's main business association. It endorses candidates and weighs in on city building standards, the 5th and 6th Penny sales taxes, business licenses, F.E. Warren Air Force Base partnerships and economic development incentives."),
    "cheyenne-downtown-development-authority": dict(
        category="Public Agencies", subtype="Downtown public authority",
        summary="A public authority that works on downtown Cheyenne. It is paid through city contracts (including Contract #8374) and a special downtown property tax, and comes before the council on downtown boundary changes (such as 2100 Snyder Ave), building-front grants, the West Edge and the Reed Avenue corridor."),
    "avi-pc-brad-emmons": dict(
        category="Contractors & Engineers", subtype="Engineering & planning firm",
        summary="An engineering firm with two roles: the city hires it for engineering and construction work (for example Storey Blvd and Summit Dr), and it also represents Cheyenne LEADS and private developers when they ask the Planning Commission and City Council for rezonings, plats and planned developments."),
    "simon-contractors": dict(
        category="Contractors & Engineers", subtype="Paving & road contractor",
        summary="One of the city's largest repeat contractors for street paving, asphalt and concrete work, mostly paid for with the 1% special-purpose (5th and 6th Penny) sales tax."),
    "knife-river-jtl-group": dict(
        category="Contractors & Engineers", subtype="Paving & road-materials contractor",
        summary="A repeat bidder and contract winner, alongside Simon Contractors, for repaving major streets (such as Nationway and College Dr) and supplying road materials to the city and the Board of Public Utilities."),
    "reiman-corp": dict(
        category="Contractors & Engineers", subtype="Road & bridge contractor",
        summary="A Cheyenne construction company that has won large sales-tax-funded projects, including the $3.49M Storey Boulevard extension (Bid #S-19-26), wheelchair-ramp work on Evers Blvd, and greenway structures."),
    "benchmark-engineers-pc": dict(
        category="Contractors & Engineers", subtype="Engineering firm",
        summary="An engineering firm the city hires for major road design (for example Contract #7520, changes to Christensen Road). It also draws up private subdivision plans."),
    "microsoft-datacenter-corridor": dict(
        category="Development Projects", subtype="Data center projects",
        name="Microsoft & other data center projects (Skybox, Hanwha)",
        summary="Large data center projects in Cheyenne's industrial parks. They come before the city for underground fiber easements, water deals with the Board of Public Utilities, power substations, the new data center zoning rules, and debates over a temporary pause on new data centers."),
    "sweetgrass-highlands-cox-ranch": dict(
        category="Development Projects", subtype="Growth & annexation projects",
        name="Sweetgrass, Cox Ranch & other annexation projects",
        summary="Large growth projects at the edge of town that the city has been asked to annex (bring inside city limits). The debates cover housing-density changes (Ord. #4524), greenway upkeep, who pays for roads and utilities, and whether the land legally touches the city as state law requires (W.S. § 15-1-402)."),
    "board-of-public-utilities-bopu": dict(
        category="Public Agencies", subtype="City water & sewer utility",
        summary="The city's water and sewer utility. It comes before the council on water and sewer lines for newly annexed land, water for cooling data centers, and debt and rate decisions (W.S. § 16-4-502)."),
    "the-real-windy-city-watchdog": dict(
        category="Advocates & Watchdogs", subtype="Citizen meeting archive & watchdog",
        name="The Real Windy City",
        summary="The citizen archive behind this site. It records and publishes city meetings, and speaks during public comment about open-meeting rules, annexation law, public-notice rules, items bundled onto the consent agenda, and how the presiding officer rules on points of order."),
}

PERSON_CATEGORY = {
    "Council / Elected": "Elected Officials",
    "City Staff": "City Staff & Boards",
}
PERSON_OVERRIDE = {  # misfiled entries
    "person-justin-tripp": "City Staff & Boards",
    "person-gavin-lobmeyer": "City Staff & Boards",
    "person-ben-trautwein": "Contractors & Engineers",
    "person-charles-miller": "Advocates & Watchdogs",
    "person-compiled-exhibit": "Other",
}
PLATFORM = {"Official Gov": "Official site", "Web": "Website", "Chamber / LEADS": "Website"}
LABEL_FIXES = [(re.compile(r"\bDossier\b", re.I), "Profile"), (re.compile(r"\bBroadcast Portal\b"), "Website"),
               (re.compile(r"\bCivic Foundry\b"), "Archive")]


def fmt(sec):
    sec = int(round(sec or 0))
    if sec >= 3600:
        return f"{sec // 3600}h {sec % 3600 // 60:02d}m"
    return f"{sec // 60}m {sec % 60:02d}s" if sec >= 60 else f"{sec}s"


def cap(v):
    return CAPACITY.get(v, v)


ORG_FIX = {
    "City of Cheyenne Governing Body (Council / Public Record)": "Not identified",
    "City of Cheyenne (Applicant / Engineer)": "Applicant's engineer",
    "City of Cheyenne (Principal, AVI PC (Engineering & Planning Agent))": "AVI PC (engineering & planning firm)",
    "City of Cheyenne (Senior Planner & CPEA Board Rep)": "City of Cheyenne (Senior Planner)",
    "The Real Windy City Documentary Exhibit": "The Real Windy City (compilation)",
    "The Real Windy City & Own Individual Capacity": "The Real Windy City / themself",
    "Individual Citizen Capacity (Public Hearings & Non-Agenda Comment)": "Speaks as a resident at public hearings and open comment",
    "Charles Miller (262 Floor Interventions)": "Charles Miller (frequent public commenter)",
    "Charles Miller (Statutory Challenger)": "Charles Miller (has challenged annexations under state law)",
    "Cheyenne LEADS Ex-Officio Counterpart": "Non-voting seat on Cheyenne LEADS",
    "City Council Rate & Debt Oversight": "City Council approves rates and debt",
    "Public Works & Street/Alley Bid Recipient": "Wins street and alley paving bids",
    "Municipal Bid & Overlay Contractor": "Wins city repaving bids",
    "Storey Blvd Extension & ADA Ramp Contractor": "Built the Storey Blvd extension and wheelchair ramps",
}


def clean_org(v):
    if not isinstance(v, str):
        return v
    v = ORG_FIX.get(v, v)
    v = re.sub(r"^City of Cheyenne Governing Body \((.*)\)$", r"City of Cheyenne (\1)", v)
    v = re.sub(r"^City of Cheyenne \((.*) \(([^()]*)\)\)$", r"City of Cheyenne (\1, \2)", v)
    v = re.sub(r"^City of Cheyenne \(([^()]*) \(([^()]*)\)([^()]*)\)$", r"City of Cheyenne (\1, \2\3)", v)
    v = re.sub(r"Own Individual Capacity \([^)]*\)", "Speaking for themself (resident)", v)
    return v


def years(ts):
    ys = sorted({t["date"][:4] for t in ts})
    return f"{ys[0]}–{ys[-1]}" if ys and ys[0] != ys[-1] else (ys[0] if ys else "")


def headline_for(spk, ts):
    o = (spk.get("analytics") or {}).get("osint") or {}
    h = o.get("headline") or spk["role"]
    for a, b in HEADLINE_FIXES:
        h = h.replace(a, b)
    h = INTERVENTIONS.sub("", h)
    h = PLAIN_COUNT.sub("", h)
    for a, b in ROLE.items():
        if h == a or h.startswith(a + " •"):
            h = b + h[len(a):]
    n = len(ts)
    if n and (h == ROLE.get(spk["role"], spk["role"]) or h in ROLE.values() or "•" not in h):
        h = f"{h} • {n} clip{'s' if n != 1 else ''} in meeting videos ({years(ts)})"
    return h


def main():
    turns = json.loads((SEED / "speaker_turns.json").read_text())
    spk = json.loads((SEED / "speakers_directory.json").read_text())
    osint = json.loads((SEED / "osint_entities.json").read_text())
    prov = json.loads((SEED / "provenance_videos.json").read_text())
    ords = json.loads((SEED / "ordinances.json").read_text())
    ord_title = {o["slug"]: o["title"] for o in ords}

    # ---------------------------------------------------------------- turns
    for t in turns:
        t["speakingCapacity"] = cap(t.get("speakingCapacity"))
        if t.get("stance") in STANCE:
            t["stanceLabel"] = STANCE[t["stance"]]
        t["representingOrg"] = clean_org(t.get("representingOrg"))
        if t.get("speakerSlug") in SLUG_CAPACITY:
            t["speakingCapacity"], t["representingOrg"] = SLUG_CAPACITY[t["speakerSlug"]]
        if t.get("pointOfOrderType"):
            t["pointOfOrderType"] = POE_TYPE.get(t["pointOfOrderType"], t["pointOfOrderType"])
        t["speakerRole"] = ROLE.get(t.get("speakerRole"), t.get("speakerRole"))
        for k in ("videoTimingNote", "speakerUnverifiedReason"):
            if isinstance(t.get(k), str):
                for a, b in NOTE_FIXES:
                    t[k] = t[k].replace(a, b)

    by = defaultdict(list)
    for t in turns:
        by[t["speakerSlug"]].append(t)

    # ---------------------------------------------------------------- speaker directory (recompute breakdowns from current turns)
    analytics_by_slug = {}
    for s in spk:
        s["role"] = ROLE.get(s["role"], s["role"])
        ts = by.get(s["slug"], [])
        a = s.get("analytics")
        if not isinstance(a, dict):
            continue
        n = len(ts) or 1
        cc = Counter(cap(t.get("speakingCapacity")) for t in ts)
        orgs = defaultdict(Counter)
        for t in ts:
            if t.get("representingOrg"):
                orgs[cap(t.get("speakingCapacity"))][t["representingOrg"]] += 1
        a["capacitiesBreakdown"] = [
            {"capacity": c, "count": k, "pct": round(100 * k / n, 1), "orgs": [o for o, _ in orgs[c].most_common(3)]}
            for c, k in cc.most_common()
        ]
        a["primaryCapacity"] = a["capacitiesBreakdown"][0]["capacity"] if a["capacitiesBreakdown"] else cap(a.get("primaryCapacity"))
        a["stanceCounts"] = dict(Counter(t.get("stance") for t in ts if t.get("stance")))
        poe = [t["id"] for t in ts if t.get("hasPointOfOrder")]
        a["pointOfOrderCount"] = len(poe)
        a["pointOfOrderTurnIds"] = poe
        tc = Counter(th for t in ts for th in (t.get("themes") or []))
        sup = Counter(th for t in ts if t.get("stance") in ("support_lobby_for", "sponsor_motion") for th in (t.get("themes") or []))
        opp = Counter(th for t in ts if t.get("stance") in ("oppose_challenge", "procedural_point_of_order") for th in (t.get("themes") or []))
        a["topicAnalytics"] = [
            {"topic": k, "label": TOPIC.get(k, k), "count": c, "pct": round(100 * c / n, 1), "supportCount": sup[k], "opposeCount": opp[k]}
            for k, c in tc.most_common()
        ]
        o = a.get("osint")
        if isinstance(o, dict):
            o["entityType"] = SLUG_CAPACITY[s["slug"]][0] if s["slug"] in SLUG_CAPACITY and s["slug"] != "brad-emmons" else cap(o.get("entityType"))
            o["affiliations"] = [clean_org(x) for x in o.get("affiliations") or []]
            o["headline"] = headline_for(s, ts)
            for p in o.get("profiles") or []:
                p["platform"] = PLATFORM.get(p.get("platform"), p.get("platform"))
                for rx, rep in LABEL_FIXES:
                    p["label"] = rx.sub(rep, p.get("label") or "")
        analytics_by_slug[s["slug"]] = a
    spk_by_slug = {s["slug"]: s for s in spk}

    # each turn carries a short copy of its speaker's statistics: keep it in step
    for t in turns:
        a = analytics_by_slug.get(t["speakerSlug"])
        c = t.get("speakerAnalytics")
        if a is None or not isinstance(c, dict):
            if isinstance(c, dict):
                c["primaryCapacity"] = cap(c.get("primaryCapacity"))
            continue
        c["primaryCapacity"] = a["primaryCapacity"]
        c["pointOfOrderCount"] = a["pointOfOrderCount"]
        c["capacitiesSummary"] = [f"{x['capacity']} ({x['pct']}%)" for x in a["capacitiesBreakdown"]]
        c["topTopics"] = [f"{x['label']} ({x['count']})" for x in a["topicAnalytics"][:3]]
        if isinstance(a.get("osint"), dict):
            c["profiles"] = a["osint"].get("profiles", c.get("profiles"))
        for k in ("historicalClipCount", "historicalMeetingCount", "avgSpeakingSec", "avgSpeakingFormatted", "verifiedVideoClipCount"):
            if k in a:
                c[k] = a[k]

    # ---------------------------------------------------------------- people & organisations directory
    for e in osint:
        for p in e.get("verifiedProfiles") or []:
            p["platform"] = PLATFORM.get(p.get("platform"), p.get("platform"))
            for rx, rep in LABEL_FIXES:
                p["label"] = rx.sub(rep, p.get("label") or "")
        if e["slug"] in ORG:
            o = ORG[e["slug"]]
            e["category"] = o["category"]
            e["subtype"] = o["subtype"]
            e["nexusSummary"] = o["summary"]
            if o.get("name"):
                e["name"] = o["name"]
        elif e["slug"].startswith("person-"):
            slug = e.get("speakerSlug") or e["slug"][len("person-"):]
            s = spk_by_slug.get(slug)
            ts = by.get(slug, [])
            cat = PERSON_OVERRIDE.get(e["slug"]) or PERSON_CATEGORY.get(e["category"])
            if not cat:
                cat = e["category"] if e["category"] in ("Elected Officials", "City Staff & Boards", "Advocates & Watchdogs",
                                                         "Contractors & Engineers", "Residents Who Spoke", "Other") else "Residents Who Spoke"
            e["category"] = cat
            e["subtype"] = ROLE.get(e["subtype"], e["subtype"])
            # last-name text matches are not evidence of a contract: drop them and their dollar totals
            e["contractsAndBids"] = []
            e["trackedContractValueUsd"] = 0.0
            if s:
                a = s.get("analytics") or {}
                e["meetingCount"] = s["meetingCount"]
                head = ((a.get("osint") or {}).get("headline") or s["role"])
                head = PLAIN_COUNT.sub("", head)
                poe = a.get("pointOfOrderCount") or 0
                e["nexusSummary"] = (
                    f"{head}. In meeting videos: {s['turnCount']} clip{'s' if s['turnCount'] != 1 else ''} from "
                    f"{s['meetingCount']} meeting{'s' if s['meetingCount'] != 1 else ''}, about {a.get('avgSpeakingFormatted') or fmt(0)} each on average"
                    + (f", {poe} point{'s' if poe != 1 else ''} of order" if poe else "") + "."
                )
                ord_slugs = []
                for t in sorted(ts, key=lambda x: x["date"], reverse=True):
                    for o in t.get("ordinances") or []:
                        if o.get("slug") and o["slug"] not in ord_slugs:
                            ord_slugs.append(o["slug"])
                e["ordinancesAndResolutions"] = [
                    {"slug": x, "title": ord_title.get(x, x)[:115], "kind": "ordinance"} for x in ord_slugs[:6] if x in ord_title
                ]
        # linked speaker clip counts follow the current data
        for ls in e.get("linkedSpeakers") or []:
            s = spk_by_slug.get(ls.get("slug"))
            if s:
                ls["name"] = s["name"]
                if "clipCount" in ls:
                    ls["clipCount"] = s["turnCount"]
                if "clips" in ls:
                    ls["clips"] = s["turnCount"]
        e["linkedSpeakers"] = [ls for ls in (e.get("linkedSpeakers") or []) if ls.get("slug") in spk_by_slug]
        e["keyPeople"] = [clean_org(k) for k in e.get("keyPeople") or []]

    # ---------------------------------------------------------------- "how we got the records" films
    FILM = {
        "The Provenance Showcase": ("Full film: every record, start to finish",
                                    "A 20-second time-lapse of every file in the archive, followed by all 11 screen recordings showing the public web pages and clicks used to download each kind of record."),
        "The Manual Click-Path Master Film": ("Step-by-step screen recording",
                                              "One chapter for each kind of record: the real public website, the clicks a person makes, the download, and the file being saved to the archive."),
        "The 7,466-File Archive Capture Timelapse": ("Time-lapse of all 7,466 files",
                                                     "A 20-second look at the size of the archive: every saved file, across 24 kinds of city records, in the order it was collected."),
    }
    for f in prov.get("masterFilms", []):
        for k, (title, desc) in FILM.items():
            if f["title"].startswith(k) or f["title"] == title:
                f["title"], f["description"] = title, desc
    CH = {
        "01": ("Meeting calendar", "On cheyennecity.org: Your Government → City Council → Minutes & Agendas, to confirm which bodies met on which dates."),
        "02": ("Agendas", "Opening the city's agenda viewers (Granicus / CivicClerk) and downloading the posted agenda PDFs."),
        "03": ("Supporting documents", "Each agenda item's attached staff report, plan or supporting PDF had to be opened and saved one at a time."),
        "04": ("Minutes & roll-call votes", "Finding the signed minutes from the City Clerk and checking the recorded votes."),
        "05": ("Transcripts & captions", "Pulling caption tracks and transcripts from the public meeting videos."),
        "06": ("Full meeting videos (Channel 192)", "Finding the unedited meeting video on Granicus, YouTube and the Internet Archive."),
        "07": ("The archive itself (2008–2026)", "Checking the archive's folder structure and that every file matches its recorded fingerprint."),
        "08": ("Local news cross-check", "Comparing public notices and local news coverage with the official meeting dates."),
        "09": ("Public safety logs", "Where the public safety logs and city enforcement records come from."),
        "10": ("Dispatch & scanner audio", "Recording and time-stamping public safety radio and scanner dispatch transcripts."),
        "11": ("Maps, parcels & open data", "Looking up Laramie County parcel maps, state law and city open-data pages by hand."),
    }
    for c in prov.get("chapters", []):
        m = re.match(r"Chapter (\d+)", c["title"])
        if m and m.group(1) in CH:
            c["title"] = f"Chapter {m.group(1)} · {CH[m.group(1)][0]}"
            c["description"] = CH[m.group(1)][1]

    REELS = {
        "THE CALLER: TAPE EDITION": "The Caller: March 9 & April 27 audio, with the gavel",
        "CONTENTION REEL": "Heated moments on the council floor, with the documents",
        "THE RECORD SPEAKS: VOICES": "What the minutes say vs. what was actually said",
        "Episode Reel S1": "48 Hours",
        "Episode Reel S2": "The $74 million list",
        "COX RANCH": "Cox Ranch: everything said at the meetings",
    }
    for r in prov.get("investigativeReels", []):
        for k, v in REELS.items():
            if r.get("title", "").startswith(k):
                r["title"] = v
    # featured meeting: plain title and section names (no TV jargon)
    feat_p = SEED / "featured.json"
    feat = json.loads(feat_p.read_text())
    if feat.get("title") == "Three Minutes Each":
        feat["title"] = "Council limits its own debate to three minutes"
    ACT_NAMES = {"Referral Row": "Sent back to committee", "Closed Doors": "Closed-door session", "The Rule": "The three-minute rule",
                 "The Return of Cox Ranch": "Cox Ranch is back"}
    for a in feat.get("acts", []):
        nm = re.sub(r"^(Act [IVX]+|Cold Open|Tag):\s*", "", a.get("name", ""))
        a["name"] = ACT_NAMES.get(nm, nm)
    feat.pop("rating", None); feat.pop("ratingNote", None)
    feat_p.write_text(json.dumps(feat, ensure_ascii=False, indent=2))
    # "for / against" lists on speaker profiles: plain topic names and wording
    OLD_TOPICS = {
        "Annexation & Statutory Contiguity": "Annexation (adding land to the city)",
        "Municipal Budget, Reserves & 6th Penny": "Budget & taxes",
        "Housing, Subdivisions & Urban Renewal": "Housing & subdivisions",
        "Data Centers, Power & BOPU Water": "Data centers, power & water",
        "Zoning & Unified Development Code (UDC)": "Zoning & building rules",
        "Procedure, Open Meetings & Points of Order": "Meeting rules & public comment",
        "Public Safety, Police & Fire": "Police, fire & public safety",
        "Public Safety, Police, Fire & Licensing": "Police, fire & public safety",
        "Contracts, Bids & LEADS": "Contracts & bids",
        "Stormwater, Roads & Parks": "Roads, parks & stormwater",
    }
    def plain_stance_item(x):
        for o, n in OLD_TOPICS.items():
            x = x.replace(o, n)
        x = re.sub(r"\((\d+) opposition/challenge turns?\)", lambda m: f"(spoke against {m.group(1)} time{'s' if m.group(1) != '1' else ''})", x)
        x = re.sub(r"\((\d+) supportive/motion turns?\)", lambda m: f"(spoke for {m.group(1)} time{'s' if m.group(1) != '1' else ''})", x)
        MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        x = re.sub(r"^Roll-Call NO Dissent \((\d{4})-(\d\d)-(\d\d)\):\s*", lambda m: f"Voted no on {MON[int(m.group(2)) - 1]} {int(m.group(3))}, {m.group(1)}: ", x)
        x = re.sub(r"^(Voted no on [^:]+: )(?:ORDINANCE|RESOLUTION)\s*[–-]\s*(?:\d(?:st|nd|rd|th)\s+READING\s*[–-]\s*)?", r"\1", x)
        return x
    for t_ in turns:
        sa_ = t_.get("speakerAnalytics") or {}
        for key in ("lobbiesFor", "opposes"):
            if isinstance(sa_.get(key), list):
                sa_[key] = [plain_stance_item(x) for x in sa_[key]]
    for sp_ in spk:
        an_ = sp_.get("analytics") or {}
        for key in ("lobbiesFor", "opposes"):
            if isinstance(an_.get(key), list):
                an_[key] = [plain_stance_item(x) for x in an_[key]]
    # placeholder "record" documents and their briefs: plain wording
    def plain_doc_text(x):
        if not isinstance(x, str):
            return x
        x = x.replace("PRIMARY SOURCE RECORD DOSSIER — ", "Source record — ")
        x = x.replace("Season Guide & Primary Source Index — ", "Source list — ")
        x = re.sub(r"\nEpisode Slug: [^\n]*", "", x)
        x = x.replace("Agenda URL: See Wayback Season Guide", "Agenda: see the saved copy of the city's meeting list")
        x = x.replace("Minutes URL: See Granicus / City Clerk Archive", "Minutes: see the City Clerk's archive (Granicus)")
        x = x.replace("Broadcast Video URL:", "Meeting video:")
        x = re.sub(r"^Verbatim Transcript — ", "Word-for-word transcript — ", x)
        x = x.replace("PRIMARY SUPPORTING PACKET PDF — Repository: ", "Attached PDF — stored in: ")
        x = x.replace("[VERBATIM BROADCAST TRANSCRIPT — ", "[Transcript of the meeting video — ")
        x = re.sub(r"\nPath: [^\n]*", "", x)
        x = re.sub(r"\nGit Blob SHA-1: ([0-9a-f]{40})", lambda m: "\nFile fingerprint: " + m.group(1)[:12], x)
        x = x.replace("\nDirect PDF Stream: ", "\nOpen the PDF: ")
        x = re.sub(r"\nAI-Record-OCR Endpoint Available[^\n]*", "\nScanned text: available", x)
        return x
    docs_p, briefs_p = SEED / "documents.json", SEED / "briefs.json"
    docs_ = json.loads(docs_p.read_text())
    for d_ in docs_:
        d_["title"] = plain_doc_text(d_.get("title"))
        d_["text"] = plain_doc_text(d_.get("text"))
    docs_p.write_text(json.dumps(docs_, ensure_ascii=False, indent=1))
    briefs_ = json.loads(briefs_p.read_text())
    FLAG_MSG = {"PROVENANCE_LOCKED": "Source checked"}
    for b_ in briefs_:
        bt_ = b_.get("title") or ""
        bt_ = re.sub(r"^SUPPORTING PACKET DOCKET\s*—\s*", "Attached document — ", bt_)
        bt_ = re.sub(r"^(?:[A-Z][A-Z /&]+) DOCKET\s*—\s*", "", bt_)
        bt_ = bt_.replace("[VERBATIM BROADCAST TRANSCRIPT — ", "[Transcript of the meeting video — ")
        bt_ = bt_.replace(" Regular Docket & Public Proceedings (", " agenda and public meeting (")
        b_["title"] = bt_
        for q_ in b_.get("quotes") or []:
            q_["text"] = plain_doc_text(q_.get("text"))
        for f_ in b_.get("flags") or []:
            if f_.get("code") in FLAG_MSG:
                f_["msg"] = re.sub(r"^Verified across ([^ ]+) \((\d+) linked documents?\)\.?$", lambda m: f"Found {'in the Internet Archive' if m.group(1).startswith('archive.org') else 'in a saved copy of the city website' if m.group(1) == 'wayback' else 'at ' + m.group(1)} ({m.group(2)} linked document{'s' if m.group(2) != '1' else ''}).", f_.get("msg", ""))
                f_["msg"] = re.sub(r"^Found on (wayback|archive\.org/cochwy) \((\d+) linked document\(s\)\)\.$", lambda m: f"Found {'in the Internet Archive' if m.group(1).startswith('archive.org') else 'in a saved copy of the city website'} ({m.group(2)} linked document{'s' if m.group(2) != '1' else ''}).", f_["msg"])
    SRC_LABEL = {"TheReelWindyCity/transcripts": "in the meeting video transcripts", "granicus-index": "on the city's Granicus meeting portal",
                 "official_records": "in official city records", "civic.db": "in official city records"}
    for b_ in briefs_:
        for f_ in b_.get("flags") or []:
            m_ = re.match(r"^Found on (\S+) \((\d+) linked document\(s\)\)\.$", f_.get("msg") or "")
            if m_:
                where = SRC_LABEL.get(m_.group(1), "in The Real Windy City document archive" if "cheyenne-archives" in m_.group(1) else "at " + m_.group(1))
                n_ = m_.group(2)
                f_["msg"] = f"Found {where} ({n_} linked document{'s' if n_ != '1' else ''})."
    for b_ in briefs_:
        for f_ in b_.get("flags") or []:
            if f_.get("msg") == "Supporting PDF matched to SHA-1 AI-Record-OCR corpus.":
                f_["msg"] = "This attached PDF was scanned, so its text is searchable."
            elif f_.get("msg") == "Split or dissenting roll-call vote recorded in official minutes.":
                f_["msg"] = "The official minutes show at least one member voting no."
            elif (f_.get("msg") or "").startswith("Ordinance on 3rd & final reading"):
                f_["msg"] = "This ordinance is on its 3rd and final reading, the vote that makes it law."
            elif (f_.get("msg") or "").startswith("Substantial fiscal ceiling"):
                f_["msg"] = re.sub(r"^Substantial fiscal ceiling \((.*?)\) detected across agenda items\.?", r"Agenda items add up to as much as \1.", f_["msg"])
    briefs_p.write_text(json.dumps(briefs_, ensure_ascii=False, indent=1))
    for t_ in turns:
        if isinstance(t_.get("videoTimingNote"), str):
            t_["videoTimingNote"] = t_["videoTimingNote"].replace("not verbatim speech", "not word-for-word speech").replace("verbatim", "word-for-word")
        m_ = re.match(r"^Diarized speaking turn \((\d\d)h(\d\d)m(\d\d)s-(\d\d)h(\d\d)m(\d\d)s\) in (.+?)\.$", t_.get("text") or "")
        if m_:
            g = m_.groups()
            t_["text"] = f"Someone spoke here ({int(g[0])}:{g[1]}:{g[2]}–{int(g[3])}:{g[4]}:{g[5]}) at the {g[6]} meeting. There is no transcript for this part, and the speaker's name was assigned by software, not confirmed."
        if t_.get("brandedClipWithheldReason", "").startswith("The diarized window"):
            t_["brandedClipWithheldReason"] = "The part of the recording the software picked out is silence before the meeting started; there is no speech to clip."
    # agenda item titles: drop internal "DOCKET" labels
    items_p = SEED / "items.json"
    items_ = json.loads(items_p.read_text())
    for i_ in items_:
        t = i_.get("title") or ""
        t = re.sub(r"^SUPPORTING PACKET DOCKET\s*—\s*", "Attached document — ", t)
        t = re.sub(r"^(?:[A-Z][A-Z /&]+) DOCKET\s*—\s*", "", t)
        t = t.replace("[VERBATIM BROADCAST TRANSCRIPT — ", "[Transcript of the meeting video — ")
        t = t.replace(" Regular Docket & Public Proceedings (", " agenda and public meeting (")
        i_["title"] = t
        if i_.get("action") == "Extracted from Verbatim Broadcast / Minutes":
            i_["action"] = "Taken from the meeting video and minutes"
    items_p.write_text(json.dumps(items_, ensure_ascii=False, indent=1))
    (SEED / "speaker_turns.json").write_text(json.dumps(turns, ensure_ascii=False, indent=1))
    (SEED / "speakers_directory.json").write_text(json.dumps(spk, ensure_ascii=False, indent=1))
    def _fix_titles(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("title", "label") and isinstance(v, str):
                    v = re.sub(r"^SUPPORTING PACKET DOCKET\s*—\s*", "Attached document — ", v)
                    v = v.replace("Planning & Annexation Dockets", "Planning & Annexation Agendas")
                    o[k] = v
                else:
                    _fix_titles(v)
        elif isinstance(o, list):
            for v in o:
                _fix_titles(v)
    _fix_titles(osint)
    (SEED / "osint_entities.json").write_text(json.dumps(osint, ensure_ascii=False, indent=1))
    (SEED / "provenance_videos.json").write_text(json.dumps(prov, ensure_ascii=False, indent=1))
    print("plain language: turns", len(turns), "| speakers", len(spk), "| directory", len(osint),
          "| categories", dict(Counter(e["category"] for e in osint)))


if __name__ == "__main__":
    main()
