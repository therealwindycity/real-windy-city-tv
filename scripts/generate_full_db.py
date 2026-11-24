#!/usr/bin/env python3
"""
Builds data/civic_tv_db.js for The Real Windy City — Civic TV & Multi-Lens Engine
from real Archive.org (`cochwy`) transcripts, speaker manifests, and GitHub Releases.
"""
import json, os, re, sys, urllib.parse, urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, "/home/user/therealwindycity_github_kit/scripts")
from publish_to_github import parse_vtt_turns, extract_speaker_hint, fmt_hms, repo_for_year

os.makedirs("/home/user/real_windy_city_tv/data", exist_ok=True)

top8_meta = json.load(open("/home/user/.cache/vtts/top8_meta.json"))
all_804 = json.load(open("/home/user/.cache/vtts/all_804_docs.json"))
manifest_002 = json.load(open("/home/user/cheyenne_speaker_pipeline/manifests/002_Public_Services_11-16-26_manifest.json"))

live_releases = {}
try:
    rels = json.loads(urllib.request.urlopen("https://api.github.com/repos/therealwindycity/cheyenne-archives-2025-2026/releases?per_page=30").read().decode())
    for r in rels:
        live_releases[r["tag_name"]] = {
            "html_url": r["html_url"],
            "assets": [{"name": a["name"], "size": a["size"], "url": a["browser_download_url"]} for a in r.get("assets", [])],
        }
except Exception:
    pass

ROLE_INFO = {
    "Speaker_01_Chairwoman_Michelle_Aldrich": {"name": "Dr. Michelle Aldrich", "role": "Ward 3 Councilwoman & Public Services Chair", "archetype": "The Gavel", "color": "#f59e0b"},
    "Michelle_Aldrich_Council": {"name": "Dr. Michelle Aldrich", "role": "Ward 3 Councilwoman & Public Services Chair", "archetype": "The Gavel", "color": "#f59e0b"},
    "Speaker_02_Meeting_Clerk_Jennifer": {"name": "Clerk Jennifer", "role": "Committee Reading Clerk", "archetype": "Voice of the Docket", "color": "#94a3b8"},
    "Meeting_Clerk": {"name": "City / Committee Clerk", "role": "Official Reading Clerk", "archetype": "Voice of the Docket", "color": "#94a3b8"},
    "Speaker_03_Seth_Lloyd_Planning": {"name": "Seth Lloyd", "role": "Senior Planner, Planning & Development", "archetype": "Code Architect", "color": "#14b8a6"},
    "Seth_Lloyd_Planning": {"name": "Seth Lloyd", "role": "Senior Planner, Planning & Development", "archetype": "Code Architect", "color": "#14b8a6"},
    "Speaker_04_Dr_Kathy_Emmons_Council": {"name": "Dr. Kathy Emmons", "role": "Councilwoman", "archetype": "The Detail Hawk", "color": "#ec4899"},
    "Dr_Kathy_Emmons_Council": {"name": "Dr. Kathy Emmons", "role": "Councilwoman", "archetype": "The Detail Hawk", "color": "#ec4899"},
    "Speaker_05_Dr_Mark_Rinne_Council": {"name": "Dr. Mark Rinne", "role": "Ward 2 Councilman", "archetype": "The Cross-Examiner", "color": "#10b981"},
    "Dr_Mark_Rinne_Council": {"name": "Dr. Mark Rinne", "role": "Ward 2 Councilman", "archetype": "The Cross-Examiner", "color": "#10b981"},
    "Speaker_06_Councilman_Tom_Laybourn": {"name": "Councilman Tom Laybourn", "role": "Ward 2 Councilman", "archetype": "Constitutional Skeptic", "color": "#f97316"},
    "Councilman_Tom_Laybourn": {"name": "Councilman Tom Laybourn", "role": "Ward 2 Councilman", "archetype": "Constitutional Skeptic", "color": "#f97316"},
    "Speaker_07_Kristin_Lee_Attorney": {"name": "Kristin Lee, Esq.", "role": "Land-Use & Energy Counsel", "archetype": "Outside Counsel", "color": "#a855f7"},
    "Kristin_Lee_Attorney": {"name": "Kristin Lee, Esq.", "role": "Land-Use & Energy Counsel", "archetype": "Outside Counsel", "color": "#a855f7"},
    "Speaker_08_Councilman_Larry_Wolf": {"name": "Councilman Larry Wolf", "role": "Ward 3 Councilman", "archetype": "Institutional Memory", "color": "#8b5cf6"},
    "Councilman_Larry_Wolf": {"name": "Councilman Larry Wolf", "role": "Ward 3 Councilman", "archetype": "Institutional Memory", "color": "#8b5cf6"},
    "Speaker_09_David_Nicely": {"name": "David Nicely", "role": "Cheyenne Property Owner", "archetype": "Homeowner Defender", "color": "#eab308"},
    "David_Nicely": {"name": "David Nicely", "role": "Cheyenne Property Owner", "archetype": "Homeowner Defender", "color": "#eab308"},
    "Speaker_10_Dr_Lori_Chestnut": {"name": "Dr. Lori Chestnut", "role": "Cheyenne Resident & Advocate", "archetype": "Community Voice", "color": "#22c55e"},
    "Dr_Lori_Chestnut": {"name": "Dr. Lori Chestnut", "role": "Cheyenne Resident & Advocate", "archetype": "Community Voice", "color": "#22c55e"},
    "Speaker_11_Charles_Miller": {"name": "Charles Miller", "role": "Civic Watchdog & Frequent Testifier", "archetype": "The Citizen Gadfly", "color": "#ef4444"},
    "Charles_Miller": {"name": "Charles Miller", "role": "Civic Watchdog & Frequent Testifier", "archetype": "The Citizen Gadfly", "color": "#ef4444"},
    "Speaker_12_Balance_Simcik": {"name": "Balance Simcik", "role": "Public Testifier", "archetype": "Floor Witness", "color": "#06b6d4"},
    "Speaker_13_John_Brody_City_Attorney": {"name": "John Brody", "role": "Cheyenne City Attorney", "archetype": "Statutory Referee", "color": "#64748b"},
    "Speaker_14_Mr_Marley": {"name": "Mr. Marley", "role": "Public Testifier", "archetype": "Industry Witness", "color": "#84cc16"},
    "Speaker_15_David_Hopkinson_Deputy_City_Attorney": {"name": "David Hopkinson", "role": "Deputy City Attorney", "archetype": "Code Litigator", "color": "#0ea5e9"},
    "Speaker_16_Tammy_Nicely": {"name": "Tammy Nicely", "role": "Cheyenne Homeowner", "archetype": "Right-of-Way Rebel", "color": "#f43f5e"},
    "Speaker_17_Morgan_Dennis_Planning": {"name": "Morgan Dennis", "role": "Planner, City of Cheyenne", "archetype": "Subdivision Analyst", "color": "#2dd4bf"},
    "Speaker_18_Mr_Cobb_City_Engineering": {"name": "Tom Cobb", "role": "City Engineer", "archetype": "Infrastructure Chief", "color": "#60a5fa"},
    "Speaker_19_Patrick_Rudd_Bedrock_Dev": {"name": "Patrick Rudd", "role": "Bedrock Development / Engineering", "archetype": "Subdivision Builder", "color": "#fb923c"},
    "Speaker_20_Charles_Bloom_Planning_Director": {"name": "Charles Bloom", "role": "Planning & Development Director", "archetype": "Zoning Strategist", "color": "#6366f1"},
    "Charles_Bloom_Planning_Director": {"name": "Charles Bloom", "role": "Planning & Development Director", "archetype": "Zoning Strategist", "color": "#6366f1"},
    "Speaker_21_Brandon_Swain": {"name": "Brandon Swain", "role": "Applicant Representative", "archetype": "Project Envoy", "color": "#a3e635"},
    "Speaker_22_Dan_Dorsch_Habitat_for_Humanity": {"name": "Dan Dorsch", "role": "Habitat for Humanity Executive", "archetype": "Housing Builder", "color": "#38bdf8"},
    "Speaker_23_Mark_Christensen_Habitat_Board": {"name": "Mark Christensen", "role": "Habitat Board Member", "archetype": "Nonprofit Advocate", "color": "#4ade80"},
    "Speaker_24_Shane_Hanson_Style_Surveying": {"name": "Shane Hanson", "role": "Steil Surveying Services", "archetype": "Boundary Surveyor", "color": "#c084fc"},
    "Mayor_Patrick_Collins": {"name": "Mayor Patrick Collins", "role": "Mayor of Cheyenne", "archetype": "The Mayor's Gavel", "color": "#3b82f6"},
    "Councilman_Ken_Moody": {"name": "Councilman Ken Moody", "role": "Ward 1 Councilman", "archetype": "Fiscal Hawk", "color": "#06b6d4"},
    "Kylie_Soden": {"name": "Kylie Soden", "role": "City Grant & Sustainability Staff", "archetype": "Policy Presenter", "color": "#2dd4bf"},
    "Meeting_Chair": {"name": "Presiding Chair", "role": "Committee / Council Chair", "archetype": "The Gavel", "color": "#fbbf24"},
}

def classify_meeting_type(title):
    tl = title.lower()
    if "city council" in tl and "work" not in tl: return "City Council"
    if "public services" in tl: return "Public Services Committee"
    if "finance" in tl: return "Finance Committee"
    if "planning commission" in tl: return "Planning Commission"
    if "urban renewal" in tl: return "Urban Renewal Authority"
    if "board of adjustment" in tl: return "Board of Adjustment"
    if "historic" in tl: return "Historic Preservation"
    if "work session" in tl: return "Work Session"
    return "Special / Civic Broadcast"

EDITORIAL = {
    "cochwy-Finance_Committee_-_11-17-26-ehK-YMrWJBo": {
        "show_title": "The Lost Tape & The Climate Contract",
        "badge": "LATEST AIRING · FORENSIC MYSTERY",
        "drama_score": 8.4,
        "previously_on": [
            {"ep_id": "cochwy-Finance_Committee_-_11-03-26-R2J7kutcmDA", "label": "S15 · Finance 11-03-26", "summary": "Finance scrutinized multi-year consulting modifications on Reed Avenue (#7782) and National Forest Foundation (#8081)."},
            {"ep_id": "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs", "label": "S15 · Council 10-26-26", "summary": "Council debated year-end General Fund balance sweeps into Stormwater Management (Res. #17)."}
        ],
        "next_episode": {
            "headline": "Full Governing Body Floor Vote on Contract #8036 Mod #3 & Year-End Fiscal Package",
            "cliffhanger": "Will Lotus Engineering's expanded Climate Action Plan (CCAP) funding survive full Council scrutiny — and will Ch192 re-upload the corrupted MP4 master past 00:05:03?"
        },
        "ordinances": ["Contract #8036 Mod 3 (Lotus Engineering CCAP)", "FY2027 Grant & Procurement Docket"],
        "acts": [
            {"act": "ACT I — Cold Open & Call to Order (00:00–05:03)", "summary": "Committee convenes; Kylie Soden and Councilman Ken Moody open fiscal review before Ch192's archival MP4 stream suffers an abrupt mdat byte-stream corruption at 00:05:03.2 — while the WebVTT caption recorder keeps rolling for the remaining 46 minutes."},
            {"act": "ACT II — The Climate Plan Funding Clash (34:02)", "summary": "Clerk reads Item 28C: Contract Modification #3 to Contract #8036 with Lotus Engineering increasing funding for Cheyenne's Comprehensive Climate Action Plan (CCAP). Council members probe scope vs. federal grant compliance."},
            {"act": "ACT III — Citizen Watchdog Testimony & Committee Vote", "summary": "Charles Miller steps to the mic questioning long-term municipal commitments; committee advances recommendations to the Monday night Governing Body docket."}
        ],
        "layman": {
            "headline": "What Happened at Tuesday's Finance Committee — In Plain English",
            "tldr": "The Finance Committee reviewed contract amendments—most notably adding money and time to Lotus Engineering's contract (#8036) to finish Cheyenne's Comprehensive Climate Action Plan (CCAP). Bonus twist: the city's video file broke 5 minutes in, though the full 51-minute caption transcript survived intact.",
            "wallet_impact": "Grant-backed consulting amendments avoid immediate property-tax hikes, but shape future capital-project priorities when CCAP recommendations return as ordinances.",
            "who_cares": "Taxpayers tracking consulting spend, utility/energy ratepayers, and public-records watchdogs."
        },
        "tabloid": {
            "banner": "TAPE GOES DARK AT 5:03 AS CLIMATE CASH ROLLS ON!",
            "subhead": "Archive video scrambles into digital static right before Finance panel takes up Lotus Engineering's Climate Action Plan boost — but the captions caught every word!",
            "zingers": [
                {"who": "Official Docket (#28C, 34:02)", "line": "Contract Modification #3 to Contract #8036 with Lotus Engineering to reflect an increase in funding for Comprehensive Climate Action Plan preparation."},
                {"who": "Forensic Byte Audit", "line": "MP4 chunk #6529 at byte 11,206,866 flatlines — leaving 46 minutes of ghost transcript in the public archive!"}
            ],
            "winners": ["Lotus Engineering (Contract #8036 scope extended)", "WebVTT Caption Track (sole surviving record past 05:03)"],
            "losers": ["Video Watchers after Minute 5 (hit by corrupted H.264 NAL packets)"]
        },
        "legal": {
            "citations": ["Wyo. Stat. § 16-4-401 et seq. (Wyoming Public Meetings Act)", "Wyo. Stat. § 15-1-113 (Municipal Contracts & Public Improvements)", "Cheyenne Municipal Code Ch. 2.08 (Standing Council Committees)"],
            "posture": "Standing Committee Advisory Recommendation (binding authorization requires Governing Body majority vote).",
            "analysis": "Under W.S. § 16-4-403, public meetings must remain open, with written minutes serving as the statutory official record. Because Contract #8036 Mod #3 alters total contract consideration, Governing Body ratification by resolution is required prior to disbursement. Media forensic audit confirms `.mpeg4` mdat desynchronization at 303.2s; VTT track remains intact.",
            "risk_level": "MODERATE — Procurement scope modification & archival completeness."
        },
        "geo_pins": [
            {"title": "Municipal Building — Finance Room (2101 O'Neil Ave)", "lat": 41.1350, "lng": -104.8211, "x": 46, "y": 54, "tag": "Contract #8036 Mod 3"},
            {"title": "Citywide Climate Action Plan Footprint", "lat": 41.1400, "lng": -104.8202, "x": 52, "y": 48, "tag": "CCAP Scope"}
        ],
        "historical": [
            {"era": "2025–2026", "repo": "cheyenne-archives-2025-2026", "note": "Contract #8036 originally executed alongside federal Climate Pollution Reduction Grant milestones."},
            {"era": "2023–2024", "repo": "cheyenne-archives-2023-2024", "note": "Cheyenne debated sustainability & stormwater planning grants amid rising engineering consultant rates."},
            {"era": "2018–2021", "repo": "cheyenne-archives-2018-2021", "note": "Consultant-amendment guardrails established in Finance Committee procurement reviews."}
        ],
        "fiscal": [
            {"item": "Contract #8036 Mod #3 (Lotus Engineering — CCAP)", "fund": "Federal Grant / Special Projects", "direction": "Increase", "impact": "Consulting ceiling raised to complete Comprehensive Climate Action Plan deliverables."}
        ]
    },
    "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo": {
        "show_title": "The Two-Hour UDC War: Power Plants, Goats & Sidewalk Weeds",
        "badge": "BLOCKBUSTER EPISODE · 24 CAST MEMBERS",
        "drama_score": 9.7,
        "previously_on": [
            {"ep_id": "cochwy-City_Council_-_11-09-26-LspPbRmg9xg", "label": "S15 · Council 11-09-26", "summary": "Item #18 (UDC Establishing Uses) hit turbulence on Second Reading at 115:30 and came back to Public Services for surgical amendments."},
            {"ep_id": "cochwy-November_2_2026_Cheyenne_Planning_Commission_Meeting-stladJEUQ2w", "label": "S15 · Planning 11-02-26", "summary": "Planning Commission vetted PLTA-26-3 (Power Generation Facilities, 46:08) with Seth Lloyd and attorney Kristin Lee."}
        ],
        "next_episode": {
            "headline": "Monday Night City Council Showdown: Third & Final Readings on UDC Uses, Power Generation & Right-of-Way Duty",
            "cliffhanger": "After 2 hours and 18 minutes of amendments, homeowner pushback from the Nicelys, and constitutional warnings from Councilman Laybourn, which amendments survive on the Council floor?"
        },
        "ordinances": [
            "Item #18 — UDC §§ 1.1.8, 1.1.9, 5.8.9 Establishing Uses (2nd Reading)",
            "Item #20 — UDC § 5.7.14 Power Generation Facilities (2nd Reading)",
            "Item #21 — Mun. Code Ch. 6.08 Animal Care & Farm Exemptions (2nd Reading)",
            "Item #22 — Mun. Code §§ 8.60.30 & 8.60.35 Nuisances & Right-of-Way Maintenance (2nd Reading)",
            "Item #25 — Dell Range Addition 6th Filing Final Plat",
            "Item #26 — Pronghorn Crossing 2nd Filing Final Plat (Habitat for Humanity)"
        ],
        "acts": [
            {"act": "ACT I — What Counts as 'Establishing a Use'? (01:41–57:08)", "summary": "Planner Seth Lloyd faces rapid-fire cross-examination from Dr. Kathy Emmons, Dr. Mark Rinne, and Councilman Tom Laybourn over when a landowner's zoning rights vest — followed by testimony from attorney Kristin Lee, Mr. Marley, Councilman Larry Wolf, David Nicely, Dr. Lori Chestnut, Charles Miller, Balance Simcik, and City Attorney John Brody."},
            {"act": "ACT II — Private Power Plants & Urban Farm Exemptions (01:07:47–01:35:56)", "summary": "Item #20 creates UDC § 5.7.14 governing private power generation facilities (key to data-center microgrids), followed by Item #21 exempting farm operations under Animal Care & Control Ch. 6.08."},
            {"act": "ACT III — The Right-of-Way Revolt & Housing Plats (01:35:56–02:17:57)", "summary": "Deputy City Attorney David Hopkinson defends requiring owners to maintain adjacent city right-of-way (§ 8.60.35) against pushback from David & Tammy Nicely and Charles Miller; episode closes on Dell Range 6th Filing (Patrick Rudd) and Habitat for Humanity's Pronghorn Crossing 2nd Filing (Dan Dorsch, Mark Christensen, Shane Hanson)."}
        ],
        "layman": {
            "headline": "Four Rules That Touch Almost Every Property in Cheyenne — Debated in One Marathon Night",
            "tldr": "In 2 hours and 18 minutes, Public Services debated: (1) how fast you lose zoning approval if you don't finish building ('establishing uses'), (2) where private power plants/generators can sit near neighborhoods, (3) farm exemptions from city animal rules, (4) forcing homeowners to mow/maintain city-owned right-of-way strips next to their yards, plus two new housing plats on Dell Range and Story Blvd.",
            "wallet_impact": "Right-of-way maintenance (§ 8.60.35) carries code-enforcement fines/liens for homeowners; Habitat's Pronghorn Crossing plat unlocks affordable homeownership lots in east Cheyenne.",
            "who_cares": "Every homeowner with an alley/parkway strip, builders, agricultural parcel owners, data-center watchers, and east-side neighbors."
        },
        "tabloid": {
            "banner": "MOW THE CITY'S WEEDS OR PAY THE PRICE?! SPARKS FLY IN 24-SPEAKER MARATHON!",
            "subhead": "Homeowners David & Tammy Nicely challenge City Hall's right-of-way mandate while Council doctors Rinne & Emmons dissect every comma of Cheyenne's zoning code!",
            "zingers": [
                {"who": "Dr. Kathy Emmons (02:24)", "line": "Seth, I just want to be clear — can I talk about the amendment? Can I ask a question about the amendment right now?"},
                {"who": "Clerk Reading Item #22 (01:35:56)", "line": "Amending sections 8.60.30 nuisances prohibited and 8.60.35 care and maintenance of right-of-way adjacent to private properties..."},
                {"who": "Clerk Reading Item #20 (01:07:47)", "line": "Creating section 5.7.14 of the Cheyenne UDC to create definitions and establish use for power generation facilities."}
            ],
            "winners": ["Habitat for Humanity (Pronghorn Crossing 2nd Filing advances)", "Public Testifiers (forced deep scrutiny on §§ 1.1.8 & 8.60.35)"],
            "losers": ["Anyone hoping to leave Public Services before 7:30 PM"]
        },
        "legal": {
            "citations": ["Cheyenne UDC §§ 1.1.8, 1.1.9, 1.4.3, 4.5.3, 4.5.4, 5.7.14, 5.8.9", "Cheyenne Mun. Code Ch. 6.08 & §§ 8.60.30, 8.60.35", "Wyo. Stat. § 15-1-601 (Municipal Zoning & Vested Uses)", "Wyo. Stat. § 11-44-101 et seq. (Wyoming Right to Farm & Ranch Act)"],
            "posture": "Second Reading Committee Referral — Floor amendments tee'd up for Governing Body.",
            "analysis": "Three legal doctrines collide: (1) Vested Rights (UDC §§ 1.1.8–1.1.9): Wyoming protects substantial good-faith reliance under valid permits; rigid sunset triggers risk arbitrary-and-capricious review under W.S. § 16-3-114. (2) Energy Siting Preemption (UDC § 5.7.14): municipal power-generation rules must harmonize with PSC & Industrial Siting thresholds. (3) Abutting Right-of-Way Duties (§ 8.60.35): unimproved arterial edge mandates risk vagueness and selective-enforcement challenges.",
            "risk_level": "HIGH — Vested zoning rights, energy siting preemption, and code-enforcement due process."
        },
        "geo_pins": [
            {"title": "Dell Range Addition 6th Filing (S of Holland Ct, W of Ridge Rd)", "lat": 41.1585, "lng": -104.7680, "x": 76, "y": 28, "tag": "Item #25 Final Plat"},
            {"title": "Pronghorn Crossing 2nd Filing (S of Story Blvd — Habitat)", "lat": 41.1480, "lng": -104.7560, "x": 82, "y": 41, "tag": "Item #26 Habitat Plat"},
            {"title": "Municipal Chambers (2101 O'Neil Ave — Citywide UDC & Ch. 8.60)", "lat": 41.1350, "lng": -104.8211, "x": 46, "y": 54, "tag": "Items #18, #20, #21, #22"}
        ],
        "historical": [
            {"era": "2025–2026", "repo": "cheyenne-archives-2025-2026", "note": "Data-center & industrial power inquiries accelerated UDC § 5.7.14 drafting across Fall 2026."},
            {"era": "2023–2024", "repo": "cheyenne-archives-2023-2024", "note": "Prior nuisance & tall-weed enforcement sweeps sparked Ward 1 & Ward 3 homeowner appeals."},
            {"era": "2008–2013", "repo": "cheyenne-archives-2008-2013", "note": "Original Cheyenne Unified Development Code enacted in 2012 replacing legacy Title 17 zoning."}
        ],
        "fiscal": [
            {"item": "Dell Range 6th & Pronghorn Crossing 2nd Plats", "fund": "Private / Nonprofit Capital + Future Tax Roll", "direction": "Revenue-Positive", "impact": "Adds residential/commercial assessed valuation; developer/Habitat funds internal plat infrastructure."},
            {"item": "Mun. Code § 8.60.35 Right-of-Way Upkeep", "fund": "Private Homeowner Burden vs. Public Works", "direction": "Cost Shift", "impact": "Keeps parkway mowing off City General Fund by shifting upkeep liability to abutting owners."}
        ]
    },
    "cochwy-City_Council_-_11-09-26-LspPbRmg9xg": {
        "show_title": "The Annexation Endgame: Closing Cheyenne's County Islands",
        "badge": "PRIME-TIME COUNCIL · 3H 22M EPIC",
        "drama_score": 9.4,
        "previously_on": [
            {"ep_id": "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs", "label": "S15 · Council 10-26-26", "summary": "Council debated Second Readings on US-30/Commerce Circle (#6), Agricultural Uses (#11), Electric Fencing (#14), and First Reading of UDC Establishing Uses (#15)."},
            {"ep_id": "cochwy-Public_Services_Committee_-_11-02-26-Fg1Cn5ssNr4", "label": "S15 · Public Services 11-02-26", "summary": "Committee vetted Third Reading annexations along Tate Rd and South College."}
        ],
        "next_episode": {
            "headline": "Referred Ordinances Land in Nov 16 Public Services Committee",
            "cliffhanger": "Third Readings close the book on I-25 pocket annexations and electric fencing, while Item #18 (Establishing Uses) heads into the Nov 16 committee buzzsaw!"
        },
        "ordinances": [
            "Item #7 — Pocket Annexation (Western & Southern Cheyenne, East of I-25 — 3rd Reading)",
            "Item #9 — Annexation South of US-30 & North of Commerce Circle (3rd Reading)",
            "Item #14 — UDC §§ 1.4.3, 2.2.3, 5.7.2 Agricultural Use Allowances (3rd Reading)",
            "Item #17 — Mun. Code § 9.12.080 Electric Fencing for Ag/Livestock (3rd Reading)",
            "Item #18 — UDC §§ 1.1.8, 1.1.9, 5.8.9 Establishing Uses (2nd Reading)"
        ],
        "acts": [
            {"act": "ACT I — The Surrounded Enclaves Battle (18:06–84:42)", "summary": "Mayor Patrick Collins presides over more than an hour of testimony on Item #7: annexing unincorporated Laramie County islands completely surrounded by Cheyenne city limits east of I-25."},
            {"act": "ACT II — US-30 Industrial Growth & Urban Ag Finale (84:42–115:30)", "summary": "Council moves to Third Reading votes on US-30 / Commerce Circle annexation (#9), UDC Agricultural Uses (#14), and legalizing electric fencing for agricultural/livestock parcels (#17)."},
            {"act": "ACT III — Establishing Uses Cliffhanger (115:30–End)", "summary": "Item #18 hits Second Reading at nearly two hours in, setting up the Nov 16 Public Services Committee showdown."}
        ],
        "layman": {
            "headline": "Cheyenne Closes 'County Islands' Inside the City & Finalizes Urban Livestock Rules",
            "tldr": "Properties completely surrounded by Cheyenne ('county pockets' east of I-25) faced final annexation votes into the city—meaning city services, rules, and mill levies—while Council also voted on final readings for agricultural uses and electric livestock fencing.",
            "wallet_impact": "Annexed enclave owners transition onto Cheyenne municipal mill levies and utility structures.",
            "who_cares": "Western/Southern Cheyenne county-pocket residents, US-30 commercial owners, and urban livestock keepers."
        },
        "tabloid": {
            "banner": "SURROUNDED! CHEYENNE SWALLOWS LAST COUNTY ISLANDS IN 3-HOUR COUNCIL MARATHON!",
            "subhead": "East-of-I-25 enclave owners make a final stand at the podium before Council flips the switch on electric livestock fences!",
            "zingers": [
                {"who": "Clerk Reading Item #7 (18:06)", "line": "Ordinance third reading, annexing to the City of Cheyenne various tracts of land completely surrounded by current city limits, east of I-25..."},
                {"who": "Clerk Reading Item #17 (114:24)", "line": "Ordinance third reading amending section 9.12.080 to allow electric fencing for certain agricultural and livestock uses."}
            ],
            "winners": ["City Boundary Uniformity (police/fire dispatch simplified)", "Agricultural Parcel Owners (electric fencing cleared)"],
            "losers": ["County-island holdouts who preferred unincorporated rules"]
        },
        "legal": {
            "citations": ["Wyo. Stat. § 15-1-402 & § 15-1-404 (Annexation of Surrounded Enclaves)", "Cheyenne Mun. Code § 9.12.080", "Cheyenne UDC § 5.7.2"],
            "posture": "Third & Final Reading on Items #7, #9, #14, #17; Second Reading on Item #18.",
            "analysis": "Under Wyo. Stat. § 15-1-404, a governing body may annex surrounded enclaves subject to statutory annexation-report findings and W.S. § 15-1-409 60-day judicial appeal rights.",
            "risk_level": "HIGH — Statutory 60-day annexation appeal window under W.S. § 15-1-409."
        },
        "geo_pins": [
            {"title": "Western & Southern Enclaves (East of I-25)", "lat": 41.1190, "lng": -104.8420, "x": 32, "y": 72, "tag": "Item #7 Pocket Annexation"},
            {"title": "US-30 & Commerce Circle Corridor", "lat": 41.1430, "lng": -104.7410, "x": 88, "y": 46, "tag": "Item #9 Annexation"},
            {"title": "City Council Chambers (2101 O'Neil Ave)", "lat": 41.1350, "lng": -104.8211, "x": 46, "y": 54, "tag": "3rd Reading Votes"}
        ],
        "historical": [
            {"era": "2023–2024", "repo": "cheyenne-archives-2023-2024", "note": "Multi-phase county-pocket inventory launched to eliminate fragmented fire/police dispatch zones."},
            {"era": "2018–2021", "repo": "cheyenne-archives-2018-2021", "note": "Prior South Cheyenne annexation debates over water/sewer tap fees."}
        ],
        "fiscal": [
            {"item": "I-25 & US-30 Annexations (#7, #9)", "fund": "General Fund & Enterprise Utilities", "direction": "Mixed", "impact": "Expands municipal tax base while adding street, snowplow, and police service obligations."}
        ]
    },
    "cochwy-November_5_2026_Cheyenne_Urban_Renewal_Authority_Meeting-j2CCss3cLFM": {
        "show_title": "Blight, Bricks & Tax Increment: Inside Urban Renewal",
        "badge": "REDEVELOPMENT SPECIAL · DOWNTOWN ARC",
        "drama_score": 6.9,
        "previously_on": [
            {"ep_id": "cochwy-Finance_Committee_-_11-03-26-R2J7kutcmDA", "label": "S15 · Finance 11-03-26", "summary": "Finance advanced DHM Design Modification #2 for the Reed Avenue Rail Corridor project (#22B)."}
        ],
        "next_episode": {
            "headline": "Downtown & West-Edge Redevelopment Agreements Advance Toward Council Review",
            "cliffhanger": "How fast can TIF & corridor design investments catalyze private construction along the West Edge?"
        },
        "ordinances": ["Urban Renewal Plan & TIF Project Docket"],
        "acts": [
            {"act": "ACT I — Roll Call & Redevelopment Status", "summary": "Cheyenne Urban Renewal Authority reviews active downtown and West-Edge revitalization parcels."},
            {"act": "ACT II — Corridor & Blight Remediation Review", "summary": "Commissioners examine public-private catalytic tools and alignment with the Reed Avenue corridor."}
        ],
        "layman": {
            "headline": "How Cheyenne Turns Old Rail & Downtown Lots Into New Businesses",
            "tldr": "The Urban Renewal Authority (CURA) oversees redevelopment tools—like Tax Increment Financing (TIF)—that let new tax growth from fixed-up blighted properties pay for sidewalks, utilities, and cleanup without raising citywide tax rates.",
            "wallet_impact": "No new citywide taxes; pledges future property-tax increment on designated redevelopment parcels.",
            "who_cares": "Downtown business owners, West-Edge property owners, and historic-building developers."
        },
        "tabloid": {
            "banner": "WEST EDGE RISING: INSIDERS MAP NEXT WAVE OF DOWNTOWN REBIRTH!",
            "subhead": "Daytime board holds the keys to Cheyenne's redevelopment incentives!",
            "zingers": [{"who": "Urban Renewal Docket", "line": "Aligning West Edge catalytic parcels with Reed Avenue corridor engineering."}],
            "winners": ["Downtown & West-Edge Infill Builders"],
            "losers": ["Vacant blighted lots"]
        },
        "legal": {
            "citations": ["Wyo. Stat. § 15-9-101 et seq. (Wyoming Urban Renewal Code)", "Wyo. Stat. § 15-9-113 (Tax Increment Financing)"],
            "posture": "Statutory Urban Renewal Authority Board Proceeding.",
            "analysis": "CURA exercises delegated powers under Title 15, Chapter 9, subject to Governing Body blight findings and Urban Renewal Plan adoption.",
            "risk_level": "LOW — Standard statutory TIF administration."
        },
        "geo_pins": [
            {"title": "West Edge / Reed Avenue Redevelopment District", "lat": 41.1325, "lng": -104.8265, "x": 41, "y": 58, "tag": "CURA District"}
        ],
        "historical": [
            {"era": "2022", "repo": "cheyenne-archives-2022", "note": "Expansion of Cheyenne TIF districts from historic core blocks to West Edge."}
        ],
        "fiscal": [
            {"item": "TIF & Redevelopment Project Pipeline", "fund": "Tax Increment Dedicated Accounts", "direction": "Self-Financing", "impact": "Uses incremental assessed value growth on project sites."}
        ]
    },
    "cochwy-November_2_2026_Cheyenne_Planning_Commission_Meeting-stladJEUQ2w": {
        "show_title": "Origin Story: Birth of the Power Plant Code (PLTA-26-3)",
        "badge": "PREQUEL EPISODE · PLANNING COMMISSION",
        "drama_score": 8.2,
        "previously_on": [
            {"ep_id": "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs", "label": "S15 · Council 10-26-26", "summary": "Industrial annexation & business-park rezonings along US-30 and Tate Rd spotlighted Cheyenne's data-center boom."}
        ],
        "next_episode": {
            "headline": "PLTA-26-3 Becomes Council Item #20 (UDC § 5.7.14) at Public Services 11-16-26",
            "cliffhanger": "Planning Commission sends Power Generation Facilities text amendment upstairs — where Councilmen Laybourn and Wolf are waiting."
        },
        "ordinances": ["Docket PLTA-26-3 — UDC Power Generation Facilities Text Amendment"],
        "acts": [
            {"act": "ACT I — Subdivision & Zoning Plats (00:00–46:08)", "summary": "Commissioners review development plats and neighborhood buffering standards."},
            {"act": "ACT II — PLTA-26-3: Defining Power Generation in Cheyenne (46:08–End)", "summary": "Planner Seth Lloyd presents updated staff report on PLTA-26-3; attorney Kristin Lee and commissioners debate noise, setbacks, and accessory vs. principal power generation."}
        ],
        "layman": {
            "headline": "Where Can Someone Build a Power Plant Inside Cheyenne? Planning Commission Writes the Rules",
            "tldr": "With energy-hungry facilities eyeing Cheyenne, the city lacked clear zoning definitions for private power-generation plants. Planning Commission debated PLTA-26-3 to set ground rules on where they belong.",
            "wallet_impact": "Clarifies permitting rules for high-tax-base industrial employers while protecting neighborhoods.",
            "who_cares": "Industrial developers, utilities, and neighbors near industrial parks."
        },
        "tabloid": {
            "banner": "MEGAWATTS IN MY BACKYARD?! PLANNING BOARD WRITES CHEYENNE'S POWER-PLANT PLAYBOOK!",
            "subhead": "Seth Lloyd unveils updated PLTA-26-3 rules as industry counsel weighs in!",
            "zingers": [{"who": "Clerk / Chair (46:08)", "line": "Item C, PLTA-26-3, power generation facilities text amendment — staff, will you please present your updated report?"}],
            "winners": ["Regulatory Clarity for Industrial Parks"],
            "losers": ["Unregulated backyard turbine schemes"]
        },
        "legal": {
            "citations": ["Wyo. Stat. § 15-1-602 (Planning Commission Certification)", "Cheyenne UDC §§ 1.4.3, 5.1.4, 5.7.14"],
            "posture": "Mandatory Planning Commission Public Hearing & Certification.",
            "analysis": "Under W.S. § 15-1-602, Planning Commission certification is a statutory prerequisite before the Governing Body enacts UDC text amendments.",
            "risk_level": "MODERATE — Foundational administrative record for Item #20."
        },
        "geo_pins": [
            {"title": "Industrial Zoning Zones (I-80 / I-25 / US-30 Corridors)", "lat": 41.1080, "lng": -104.7750, "x": 70, "y": 80, "tag": "PLTA-26-3 Industrial Zones"}
        ],
        "historical": [
            {"era": "2023–2024", "repo": "cheyenne-archives-2023-2024", "note": "Cheyenne's hyperscale data-center growth drove substation and generation buildouts."}
        ],
        "fiscal": [
            {"item": "UDC § 5.7.14 Industrial Siting Clarity", "fund": "Industrial Tax Base", "direction": "Growth Enabler", "impact": "Supports high-valuation industrial investment."}
        ]
    },
    "cochwy-Finance_Committee_-_11-03-26-R2J7kutcmDA": {
        "show_title": "Tracks & Trees: Reed Avenue Rail Corridor & Forest Funds",
        "badge": "INFRASTRUCTURE LEDGER · 43M SPRINT",
        "drama_score": 7.1,
        "previously_on": [
            {"ep_id": "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs", "label": "S15 · Council 10-26-26", "summary": "Council weighed General Fund year-end reserve sweeps into infrastructure accounts."}
        ],
        "next_episode": {
            "headline": "Reed Ave Rail Corridor Design Modification Advances to Nov 9 Council",
            "cliffhanger": "DHM Design's Reed Avenue corridor blueprint moves closer to construction reality."
        },
        "ordinances": [
            "Item #22A — Contract #8081 Mod 1 (National Forest Foundation)",
            "Item #22B — Contract #7782 Mod 2 (DHM Design Corp — Reed Avenue Rail Corridor)"
        ],
        "acts": [
            {"act": "ACT I — National Forest Foundation Extension (02:10)", "summary": "Item #22A extends performance period and increases funding under Contract #8081 with the National Forest Foundation."},
            {"act": "ACT II — Reed Avenue Rail Corridor Design (08:01)", "summary": "Item #22B modifies Contract #7782 with DHM Design Corporation for Cheyenne's West-Edge Reed Avenue Rail Corridor."}
        ],
        "layman": {
            "headline": "Designing Cheyenne's Future West-Edge Gathering Spine on Reed Avenue",
            "tldr": "Finance Committee reviewed extending watershed/forestry work with the National Forest Foundation (#8081) and advancing DHM Design's engineering for the Reed Avenue Rail Corridor (#7782).",
            "wallet_impact": "6th-Penny specific-purpose sales tax & grant-leveraged capital funds—not property taxes.",
            "who_cares": "West-Edge businesses, cyclists/pedestrians, and Crow Creek watershed supporters."
        },
        "tabloid": {
            "banner": "ALL ABOARD REED AVE! DESIGN DOLLARS KEEP WEST-EDGE DREAM ON TRACK!",
            "subhead": "Councilman Wolf and Finance panel vet DHM Design's next move on Cheyenne's historic rail corridor!",
            "zingers": [{"who": "Clerk (08:01)", "line": "Item 22B: Contract modification number two to contract number 7782 between the City of Cheyenne and DHM Design Corporation for the Reed Avenue rail corridor design project."}],
            "winners": ["Reed Avenue Corridor Revitalization", "National Forest Foundation Partnership"],
            "losers": ["Potholed rail-spur gravel"]
        },
        "legal": {
            "citations": ["Wyo. Stat. § 15-1-113 (Municipal Public Works)", "6th Penny Specific Purpose Excise Tax Mandate"],
            "posture": "Committee Contract Amendment Review.",
            "analysis": "Voter-approved 6th-Penny funds are restricted to ballot-specified capital purposes; engineering modifications on Reed Avenue align with corridor capital delivery.",
            "risk_level": "LOW — Routine capital-design contract administration."
        },
        "geo_pins": [
            {"title": "Reed Avenue Rail Corridor (West Edge)", "lat": 41.1332, "lng": -104.8280, "x": 39, "y": 57, "tag": "Contract #7782 DHM Design"}
        ],
        "historical": [
            {"era": "2025–2026", "repo": "cheyenne-archives-2025-2026", "note": "2025.10.10 Reed Ave Corridor 6th-Penny Presentation archived in `cheyenne-archives-2025-2026/municipal-docs`."}
        ],
        "fiscal": [
            {"item": "Contract #7782 Mod #2 (DHM Design — Reed Ave)", "fund": "6th Penny / Capital Projects", "direction": "Capital Investment", "impact": "Advances shovel-ready corridor engineering."},
            {"item": "Contract #8081 Mod #1 (National Forest Foundation)", "fund": "Watershed / Grant Match", "direction": "Extension + Increase", "impact": "Extends performance window & watershed funding."}
        ]
    },
    "cochwy-Public_Services_Committee_-_11-02-26-Fg1Cn5ssNr4": {
        "show_title": "Unpaved Parking & South-Side Frontiers",
        "badge": "COMMITTEE CLASH · 2H 22M",
        "drama_score": 8.5,
        "previously_on": [
            {"ep_id": "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs", "label": "S15 · Council 10-26-26", "summary": "Tate Rd Business Park (#7), East Fox Farm annexation (#8), and Unpaved Parking UDC § 6.2.8 (#12) cleared Second Reading."}
        ],
        "next_episode": {
            "headline": "Final Annexation & Zoning Votes Head to Nov 9 City Council Floor",
            "cliffhanger": "Will site-specific unpaved parking flexibility (§ 6.2.8) satisfy small property owners without stirring dust & runoff complaints?"
        },
        "ordinances": [
            "Item #7 — BP Business Park Zoning South of Tate Rd (3rd Reading)",
            "Item #8 — Annexation S of East Fox Farm Rd / E of South College Dr (3rd Reading)",
            "Item #12 — UDC § 6.2.8 Site-Specific Unpaved Parking (3rd Reading)"
        ],
        "acts": [
            {"act": "ACT I — Tate Road Business Park & Fox Farm Annexation (07:25–51:20)", "summary": "Seth Lloyd presents Third Reading staff reports on BP Business Park zoning south of Tate Rd and annexing land bounded by East Fox Farm Rd, East Allison Rd, and South College Dr."},
            {"act": "ACT II — The Unpaved Parking Debate (51:20–End)", "summary": "Committee and regular testifiers Charles Miller and David Nicely dissect UDC § 6.2.8 allowing unpaved parking surfaces in site-specific low-intensity situations."}
        ],
        "layman": {
            "headline": "Do You Really Need Expensive Asphalt for Every Parking Lot in Cheyenne?",
            "tldr": "Paving a small or occasional-use lot can cost tens of thousands of dollars. Item #12 amends UDC § 6.2.8 to allow unpaved parking in qualifying site-specific situations, alongside south-side annexations near Fox Farm and Tate Rd.",
            "wallet_impact": "Saves small businesses, churches, and rural-edge parcels major asphalt paving costs where appropriate.",
            "who_cares": "Small business owners, South Cheyenne / Fox Farm residents, and industrial developers near Tate Rd."
        },
        "tabloid": {
            "banner": "GRAVEL VICTORY! CITY BLINKS ON PRICEY PAVING MANDATES!",
            "subhead": "South College & Fox Farm borders expand while UDC § 6.2.8 carves out relief from wall-to-wall asphalt!",
            "zingers": [{"who": "Clerk (51:20)", "line": "Number 12, ordinance third reading, amending section 6.2.8 of the Unified Development Code to allow for unpaved parking in certain site-specific situations."}],
            "winners": ["Small-lot & agricultural-edge businesses"],
            "losers": ["One-size-fits-all asphalt mandates"]
        },
        "legal": {
            "citations": ["Cheyenne UDC § 6.2.8 (Off-Street Parking Surface Standards)", "Wyo. Stat. § 15-1-401 & § 15-1-601", "ADA Accessible Parking Standards (42 U.S.C. § 12181)"],
            "posture": "Third Reading Committee Review.",
            "analysis": "While municipal code can relax local asphalt surfacing under UDC § 6.2.8, federal ADA accessible stall & path-of-travel firm/slip-resistant standards remain non-waivable.",
            "risk_level": "LOW-MODERATE — Site-specific administrative discretion criteria."
        },
        "geo_pins": [
            {"title": "East Fox Farm Rd / East Allison Rd / South College Dr", "lat": 41.1065, "lng": -104.7810, "x": 67, "y": 79, "tag": "Item #8 Annexation"},
            {"title": "South of Tate Road — BP Business Park", "lat": 41.0980, "lng": -104.7690, "x": 74, "y": 86, "tag": "Item #7 BP Zoning"}
        ],
        "historical": [
            {"era": "2022", "repo": "cheyenne-archives-2022", "note": "Recurring variance requests over paving costs prompted UDC § 6.2.8 reform."}
        ],
        "fiscal": [
            {"item": "UDC § 6.2.8 Parking Flexibility", "fund": "Private Small-Business Capital Relief", "direction": "Deregulatory Savings", "impact": "Lowers barrier to entry for low-intensity site improvements."}
        ]
    },
    "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs": {
        "show_title": "Ten Ordinances in One Night: The October Mega-Docket",
        "badge": "ARC LAUNCHPAD · 10 ORDINANCES",
        "drama_score": 9.1,
        "previously_on": [
            {"ep_id": "cochwy-Public_Services_Committee_-_10-19-26-ei5DMOblRIE", "label": "S15 · Public Services 10-19-26", "summary": "Committee tee'd up October's wave of annexations, livestock exceptions, and UDC reforms."}
        ],
        "next_episode": {
            "headline": "Every Thread Explodes Across Nov 2, Nov 9 & Nov 16 Episodes",
            "cliffhanger": "Item #15 (Establishing Uses) debuts on First Reading at 83:08 — igniting a month-long zoning battle across the next three episodes!"
        },
        "ordinances": [
            "Item #6 — US-30 / Commerce Circle Annexation (2nd Reading)",
            "Item #7 — Tate Rd BP Business Park Zoning (2nd Reading)",
            "Item #8 & #9 — East Fox Farm / South College Annexation & Ag Zoning (2nd Reading)",
            "Item #11 — UDC § 5.7.2 Agricultural Use Allowances (2nd Reading)",
            "Item #12 — UDC § 6.2.8 Unpaved Parking (2nd Reading)",
            "Item #13 — Mun. Code § 6.08.020 Keeping Livestock Exceptions (2nd Reading)",
            "Item #14 — Mun. Code § 9.12.080 Electric Fencing (2nd Reading)",
            "Item #15 — UDC §§ 1.1.8, 1.1.9, 5.8.9 Establishing Uses (1st Reading Debut!)",
            "Item #17 — Resolution Amending General Fund Balance Policy for Stormwater Transfers"
        ],
        "acts": [
            {"act": "ACT I — Four Back-to-Back Annexations & Rezonings (06:07–24:06)", "summary": "Mayor Patrick Collins, Planning Director Charles Bloom, and Council move through US-30, Tate Rd, and Fox Farm / South College growth boundaries."},
            {"act": "ACT II — Chickens, Goats, Electric Fences & Gravel Lots (24:06–83:08)", "summary": "Nearly an hour of rural-meets-urban debate across Agricultural Uses (#11), Unpaved Parking (#12), Keeping Livestock (#13), and Electric Fencing (#14)."},
            {"act": "ACT III — First Reading of Item #15 & Stormwater Millions (83:08–End)", "summary": "UDC Establishing Uses (#15) is introduced on First Reading alongside Resolution #17 channeling year-end General Fund surpluses into Stormwater Management."}
        ],
        "layman": {
            "headline": "The Night Everything Started: Annexations, Backyard Livestock, Gravel Parking & Drainage Dollars",
            "tldr": "Think of Oct 26 as the 'Season Arc Premiere' for Fall 2026: ten major ordinances and resolutions crossed the floor in one 2h 40m session—launching every storyline debated through mid-November.",
            "wallet_impact": "Resolution #17 creates a direct pipeline to move General Fund year-end surpluses into Cheyenne's Stormwater Runoff system without a new stormwater tax.",
            "who_cares": "Flood-prone Cheyenne neighborhoods, urban homesteaders, and anyone following Fall 2026 Council politics."
        },
        "tabloid": {
            "banner": "OCTOBER OMNI-BRAWL: FENCES, FARMS, FLOOD CASH & FOUR ANNEXATIONS!",
            "subhead": "Mayor Collins steers a 10-ordinance freight train through Council Chambers as November's biggest zoning war quietly drops at Minute 83!",
            "zingers": [
                {"who": "Clerk Reading Res. #17 (83:30)", "line": "Resolution amending the city's General Fund balance policy to provide for fiscal year-end review and potential transfers to the stormwater runoff management system account..."},
                {"who": "Clerk Reading Item #13 (52:50)", "line": "Amending section 6.08.020 of the municipal code to revise exceptions to restrictions on keeping livestock within the city."}
            ],
            "winners": ["Stormwater Drainage Upgrades (Res. #17 surplus mechanism)", "Urban Ag & Livestock Keepers"],
            "losers": ["Sleepy Monday agendas"]
        },
        "legal": {
            "citations": ["Wyo. Stat. § 15-1-103 (Three-Reading Ordinance Requirement)", "Wyo. Stat. § 16-4-101 et seq. (Uniform Municipal Fiscal Procedures Act)", "Cheyenne Mun. Code §§ 6.08.020, 9.12.080"],
            "posture": "Multi-Ordinance 1st & 2nd Readings + Binding Fiscal Policy Resolution (#17).",
            "analysis": "Wyoming requires ordinances to be read on three separate days (W.S. § 15-1-103), creating a natural three-act legislative arc where Second Reading serves as the primary floor-amendment battleground.",
            "risk_level": "MODERATE — Multi-track UDC & Municipal Code synchronization."
        },
        "geo_pins": [
            {"title": "US-30 & Commerce Circle", "lat": 41.1430, "lng": -104.7410, "x": 88, "y": 46, "tag": "Item #6"},
            {"title": "East Fox Farm & South College", "lat": 41.1065, "lng": -104.7810, "x": 67, "y": 79, "tag": "Items #8 & #9"},
            {"title": "Citywide Stormwater Basin Network (Crow Creek / Dry Creek)", "lat": 41.1450, "lng": -104.8000, "x": 58, "y": 44, "tag": "Res. #17 Stormwater"}
        ],
        "historical": [
            {"era": "2018–2021", "repo": "cheyenne-archives-2018-2021", "note": "After standalone stormwater fee proposals faced headwinds, Council pivoted to reserve-sweep funding mechanisms like Res. #17."}
        ],
        "fiscal": [
            {"item": "Resolution #17 — General Fund Surplus -> Stormwater", "fund": "General Fund -> Stormwater Account", "direction": "Internal Reserve Transfer", "impact": "Dedicates year-end surplus capacity to flood/drainage infrastructure."}
        ]
    }
}

rich_out = []
for m in top8_meta:
    ident = m["identifier"]
    ed = EDITORIAL[ident]
    rel_tag = f"speaker-videos-{m['date']}-{ident[-11:]}"
    rel_info = live_releases.get(rel_tag, {"html_url": "https://github.com/therealwindycity/cheyenne-archives-2025-2026/releases", "assets": []})

    if ident == "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo":
        turns = [
            {
                "n": it["global_idx"],
                "speaker_id": it["speaker"],
                "speaker": ROLE_INFO.get(it["speaker"], {}).get("name", it["speaker"]),
                "start": it["start"],
                "end": it["end"],
                "hms": it["hms"].split("-")[0],
                "text": it["text_preview"],
            }
            for it in manifest_002
        ]
        dur_sec = 8279
    else:
        raw = parse_vtt_turns(m["vtt_path"])
        turns = []
        floor_idx = 0
        for idx_r, (st, en, txt) in enumerate(raw):
            if en - st < 1.3 and len(txt.split()) < 4:
                continue
            h = extract_speaker_hint(txt, raw[idx_r-1][2] if idx_r > 0 else "")
            if not h:
                floor_idx = (floor_idx % 4) + 1
                h = f"Floor_Speaker_{floor_idx:02d}"
            turns.append({
                "n": len(turns) + 1,
                "speaker_id": h,
                "speaker": ROLE_INFO.get(h, {}).get("name", h.replace("_", " ")),
                "start": round(st, 1),
                "end": round(en, 1),
                "hms": fmt_hms(st),
                "text": txt[:420],
            })
        dur_sec = int(turns[-1]["end"]) if turns else 3000

    spk_sec = Counter()
    spk_cnt = Counter()
    spk_quote = {}
    transitions = Counter()
    for idx_t, t in enumerate(turns):
        sid = t["speaker_id"]
        d = max(1.5, t["end"] - t["start"])
        spk_sec[sid] += d
        spk_cnt[sid] += 1
        if sid not in spk_quote or (50 <= len(t["text"]) <= 220 and len(t["text"]) > len(spk_quote[sid]["quote"])):
            spk_quote[sid] = {"quote": t["text"][:220], "start": t["start"], "end": min(t["start"] + 25, t["end"] + 2), "hms": t["hms"]}
        if idx_t > 0 and turns[idx_t-1]["speaker_id"] != sid:
            transitions[(turns[idx_t-1]["speaker"], t["speaker"])] += 1

    vals = sorted(spk_sec.values())
    n_v = len(vals)
    gini = round((2 * sum((i + 1) * v for i, v in enumerate(vals))) / (n_v * sum(vals)) - (n_v + 1) / n_v, 2) if (n_v > 1 and sum(vals) > 0) else 0.0

    cast = []
    tot_sec = max(1.0, sum(spk_sec.values()))
    for sid, secs in spk_sec.most_common(14):
        ri = ROLE_INFO.get(sid, {"name": sid.replace("_", " "), "role": "Floor / Public Speaker", "archetype": "Floor Witness", "color": "#38bdf8"})
        bq = spk_quote.get(sid, {"quote": "", "start": 10, "end": 25, "hms": "00h00m10s"})
        zurl = rel_info["html_url"]
        for a in rel_info["assets"]:
            toks = [w for w in ri["name"].lower().replace(".", "").split() if len(w) > 3]
            if any(w in a["name"].lower() for w in toks):
                zurl = a["url"]
                break
        cast.append({
            "id": sid,
            "name": ri["name"],
            "role": ri["role"],
            "archetype": ri["archetype"],
            "color": ri["color"],
            "speaking_sec": int(round(secs)),
            "turns": spk_cnt[sid],
            "share_pct": round(100.0 * secs / tot_sec, 1),
            "quote": bq["quote"],
            "clip_start": bq["start"],
            "clip_end": bq["end"],
            "hms": bq["hms"],
            "zip_url": zurl,
        })

    n_bins = 12
    bw = max(60.0, dur_sec / n_bins)
    heat = []
    for b in range(n_bins):
        b0, b1 = b * bw, (b + 1) * bw
        bt = [t for t in turns if b0 <= t["start"] < b1]
        heat.append({"minute": int(round(b0 / 60)), "turns": len(bt), "speakers": len(set(t["speaker_id"] for t in bt))})

    rich_out.append({
        "id": ident,
        "code": f"S15·E{138 - m['ep_idx']:03d}",
        "season": 15,
        "year": 2026,
        "date": m["date"],
        "official_title": m["title"],
        "show_title": ed["show_title"],
        "badge": ed["badge"],
        "drama_score": ed["drama_score"],
        "meeting_type": classify_meeting_type(m["title"]),
        "duration_sec": dur_sec,
        "stream_url": f"https://archive.org/download/{ident}/{urllib.parse.quote(m['stream_vid'])}",
        "embed_url": f"https://archive.org/embed/{ident}",
        "archive_url": f"https://archive.org/details/{ident}",
        "github_repo": "therealwindycity/cheyenne-archives-2025-2026",
        "release_url": rel_info["html_url"],
        "release_zips_count": len(rel_info["assets"]),
        "previously_on": ed["previously_on"],
        "next_episode": ed["next_episode"],
        "ordinances": ed["ordinances"],
        "acts": ed["acts"],
        "layman": ed["layman"],
        "tabloid": ed["tabloid"],
        "legal": ed["legal"],
        "geo_pins": ed["geo_pins"],
        "historical": ed["historical"],
        "fiscal": ed["fiscal"],
        "cast": cast,
        "gini_index": gini,
        "heat_timeline": heat,
        "top_transitions": [{"from": a, "to": b, "count": c} for (a, b), c in transitions.most_common(8)],
        "total_turns": len(turns),
        "transcript": turns[:180],
    })

ORDINANCE_ARCS = [
    {
        "id": "ORD-UDC-USES-2026",
        "code": "MINI-SERIES · 3 EPISODES + FINALE PENDING",
        "ordinance_number": "UDC §§ 1.1.8, 1.1.9 & 5.8.9 (Council Item #18 / Oct #15)",
        "show_title": "Vested or Void? The 'Establishing Uses' Zoning Trilogy",
        "badge": "ACTIVE CLIFFHANGER · 3-READING SAGA",
        "drama_score": 9.6,
        "date": "2026-10-26 → 2026-11-16+",
        "meeting_type": "Ordinance Story Arc",
        "episodes_in_arc": [
            {"ep_id": "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs", "stage": "Ep 1 · First Reading Introduction (83:08)", "date": "2026-10-26", "note": "Introduced onto the Governing Body floor as Item #15."},
            {"ep_id": "cochwy-City_Council_-_11-09-26-LspPbRmg9xg", "stage": "Ep 2 · Second Reading Floor Clash (115:30)", "date": "2026-11-09", "note": "Debated as Item #18 and routed back for deep committee surgery."},
            {"ep_id": "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo", "stage": "Ep 3 · The 49-Minute Committee Cross-Examination (08:18–57:08)", "date": "2026-11-16", "note": "12 speakers—from Seth Lloyd and Dr. Rinne to Kristin Lee, David Nicely, and Charles Miller—battle over vesting timelines."}
        ],
        "linked_primary_episode": "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo",
        "summary": "Tracks Cheyenne's most fiercely debated Fall 2026 zoning ordinance from its Minute-83 introduction on Oct 26 to a 49-minute cross-examination on Nov 16 over when a property owner's right to establish a land use expires."
    },
    {
        "id": "ORD-POWER-GEN-5-7-14",
        "code": "MINI-SERIES · 2 EPISODES + COUNCIL VOTE NEXT",
        "ordinance_number": "UDC § 5.7.14 / PLTA-26-3 (Power Generation Facilities)",
        "show_title": "Megawatts on the Prairie: The Private Power Plant Code",
        "badge": "TECH & ENERGY ARC",
        "drama_score": 9.0,
        "date": "2026-11-02 → 2026-11-16+",
        "meeting_type": "Ordinance Story Arc",
        "episodes_in_arc": [
            {"ep_id": "cochwy-November_2_2026_Cheyenne_Planning_Commission_Meeting-stladJEUQ2w", "stage": "Ep 1 · Prequel at Planning Commission (46:08)", "date": "2026-11-02", "note": "PLTA-26-3 public hearing sets initial definitions and industrial zone rules."},
            {"ep_id": "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo", "stage": "Ep 2 · Public Services 2nd Reading Showdown (67:47–85:04)", "date": "2026-11-16", "note": "Councilmen Tom Laybourn & Larry Wolf press Seth Lloyd on power generation limits."}
        ],
        "linked_primary_episode": "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo",
        "summary": "As data centers and industrial users eye on-site power generation in Cheyenne, UDC § 5.7.14 writes the rulebook from scratch."
    },
    {
        "id": "ORD-URBAN-AG-LIVESTOCK",
        "code": "MINI-SERIES · 3 EPISODES",
        "ordinance_number": "Mun. Code Ch. 6.08, § 9.12.080 & UDC § 5.7.2",
        "show_title": "Fences, Farms & City Limits: The Urban Livestock Trilogy",
        "badge": "SEASON FINALE + SPIN-OFF",
        "drama_score": 8.8,
        "date": "2026-10-26 → 2026-11-16",
        "meeting_type": "Ordinance Story Arc",
        "episodes_in_arc": [
            {"ep_id": "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs", "stage": "Ep 1 · Triple 2nd Reading (24:06, 52:50, 61:56)", "date": "2026-10-26", "note": "Ag Uses (#11), Livestock Exceptions (#13), and Electric Fencing (#14) debated together."},
            {"ep_id": "cochwy-City_Council_-_11-09-26-LspPbRmg9xg", "stage": "Ep 2 · 3rd Reading Enactment Votes (92:36, 114:24)", "date": "2026-11-09", "note": "UDC Ag Uses (#14) and Electric Fencing (#17) reach final passage."},
            {"ep_id": "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo", "stage": "Ep 3 · Spin-Off Sequel: Ch. 6.08 Farm Exemptions (85:04)", "date": "2026-11-16", "note": "Item #21 exempts farm and farm-related operations from general animal control restrictions."}
        ],
        "linked_primary_episode": "cochwy-City_Council_-_11-09-26-LspPbRmg9xg",
        "summary": "Following pocket annexations of rural-edge parcels, Cheyenne rewrites its agricultural, livestock, and electric-fencing ordinances across three packed episodes."
    },
    {
        "id": "ORD-ROW-NUISANCE-8-60",
        "code": "SPECIAL FEATURE · HOMEOWNER REVOLT",
        "ordinance_number": "Mun. Code §§ 8.60.30 & 8.60.35 (Right-of-Way Maintenance)",
        "show_title": "Whose Weeds Are They Anyway? The Right-of-Way Mandate",
        "badge": "CITIZEN PUSHBACK · HIGH HEAT",
        "drama_score": 9.3,
        "date": "2026-11-16",
        "meeting_type": "Ordinance Story Arc",
        "episodes_in_arc": [
            {"ep_id": "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo", "stage": "Ep 1 · Committee Showdown (95:56–108:32)", "date": "2026-11-16", "note": "Deputy City Attorney David Hopkinson defends § 8.60.35 as David & Tammy Nicely and Charles Miller push back."}
        ],
        "linked_primary_episode": "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo",
        "summary": "Can City Hall require private homeowners to maintain city-owned right-of-way strips adjacent to their property under penalty of nuisance enforcement?"
    },
    {
        "id": "ORD-ANNEXATION-FRONTIER-2026",
        "code": "MINI-SERIES · 4 EPISODES",
        "ordinance_number": "Annexations & Plats: I-25 Enclaves, US-30, Fox Farm, Dell Range & Pronghorn",
        "show_title": "Expanding the Map: Cheyenne's 2026 Border Wars",
        "badge": "MAP EXPANSION SAGA",
        "drama_score": 9.4,
        "date": "2026-10-26 → 2026-11-16",
        "meeting_type": "Ordinance Story Arc",
        "episodes_in_arc": [
            {"ep_id": "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs", "stage": "Ep 1 · US-30, Tate Rd & Fox Farm 2nd Readings (06:07–24:06)", "date": "2026-10-26", "note": "Four border & zoning ordinances advance."},
            {"ep_id": "cochwy-Public_Services_Committee_-_11-02-26-Fg1Cn5ssNr4", "stage": "Ep 2 · South-Side 3rd Reading Vetting (07:25–51:20)", "date": "2026-11-02", "note": "Tate Rd BP Business Park & Fox Farm/College annexation scrutinized."},
            {"ep_id": "cochwy-City_Council_-_11-09-26-LspPbRmg9xg", "stage": "Ep 3 · The 66-Minute I-25 Pocket Annexation Finale (18:06–92:36)", "date": "2026-11-09", "note": "Surrounded county islands east of I-25 & US-30/Commerce Circle hit 3rd reading."},
            {"ep_id": "cochwy-Public_Services_Committee_-_11-16-26-bew0rx29Llo", "stage": "Ep 4 · New Neighborhoods: Dell Range 6th & Habitat's Pronghorn Crossing (108:32–137:57)", "date": "2026-11-16", "note": "Final plats bring new housing lots online."}
        ],
        "linked_primary_episode": "cochwy-City_Council_-_11-09-26-LspPbRmg9xg",
        "summary": "Every annexation, zoning map expansion, and subdivision plat reshaping Cheyenne's borders in late 2026."
    },
    {
        "id": "ORD-FISCAL-INFRA-2026",
        "code": "MINI-SERIES · 4 EPISODES",
        "ordinance_number": "Res. #17 Stormwater + Contracts #7782 (Reed Ave), #8081 (Forest) & #8036 (CCAP)",
        "show_title": "Follow the Money: Stormwater Surpluses, Rail Corridors & Climate Contracts",
        "badge": "FISCAL & INFRASTRUCTURE ARC",
        "drama_score": 8.3,
        "date": "2026-10-26 → 2026-11-17",
        "meeting_type": "Ordinance Story Arc",
        "episodes_in_arc": [
            {"ep_id": "cochwy-City_Council_-_10-26-26-FaIR-fx4sXs", "stage": "Ep 1 · Res. #17 General Fund -> Stormwater Pipeline (83:30)", "date": "2026-10-26", "note": "Establishes year-end surplus review for drainage transfers."},
            {"ep_id": "cochwy-Finance_Committee_-_11-03-26-R2J7kutcmDA", "stage": "Ep 2 · Reed Ave Rail Corridor (#7782) & Forest Foundation (#8081)", "date": "2026-11-03", "note": "Capital design & watershed modifications cleared."},
            {"ep_id": "cochwy-November_5_2026_Cheyenne_Urban_Renewal_Authority_Meeting-j2CCss3cLFM", "stage": "Ep 3 · CURA West-Edge TIF Coordination", "date": "2026-11-05", "note": "Redevelopment authority aligns West Edge parcels."},
            {"ep_id": "cochwy-Finance_Committee_-_11-17-26-ehK-YMrWJBo", "stage": "Ep 4 · Lotus Engineering CCAP Mod #3 (#8036)", "date": "2026-11-17", "note": "Climate Action Plan funding modification reviewed."}
        ],
        "linked_primary_episode": "cochwy-Finance_Committee_-_11-03-26-R2J7kutcmDA",
        "summary": "Tracks how Cheyenne allocates General Fund reserves, 6th-Penny capital dollars, TIF, and federal grants across drainage, rail corridors, and climate planning."
    }
]

by_year = defaultdict(list)
for d in all_804:
    ds = d.get("date", "2026-01-01")[:10]
    yr = int(ds[:4]) if ds[:4].isdigit() else 2026
    by_year[yr].append(d)

catalog_804 = []
for yr in sorted(by_year.keys(), reverse=True):
    yr_docs = sorted(by_year[yr], key=lambda x: x.get("date", ""))
    season_num = max(1, yr - 2011)
    for idx_in_yr, d in enumerate(yr_docs, 1):
        ds = d.get("date", "")[:10]
        catalog_804.append({
            "id": d["identifier"],
            "date": ds,
            "year": yr,
            "season": season_num,
            "ep_num": idx_in_yr,
            "code": f"S{season_num:02d}·E{idx_in_yr:03d}",
            "title": d.get("title", d["identifier"]),
            "type": classify_meeting_type(d.get("title", "")),
            "size_mb": round(int(d.get("item_size", 0) or 0) / 1e6, 1),
            "repo": repo_for_year("therealwindycity", yr),
            "premiere": idx_in_yr == 1,
            "finale": idx_in_yr == len(yr_docs) and yr < 2026,
            "has_deep_pack": d["identifier"] in EDITORIAL,
        })

catalog_804.sort(key=lambda x: (x["date"], x["ep_num"]), reverse=True)

payload = {
    "generated_at": "2026-11-24T12:25:00-07:00",
    "total_archive_episodes": len(catalog_804),
    "seasons_span": "Season 01 (2012) – Season 15 (2026)",
    "github_org": "therealwindycity",
    "archive_repos": [
        {"years": "2025–2026", "repo": "therealwindycity/cheyenne-archives-2025-2026", "episodes": 260},
        {"years": "2023–2024", "repo": "therealwindycity/cheyenne-archives-2023-2024", "episodes": 217},
        {"years": "2022",      "repo": "therealwindycity/cheyenne-archives-2022",      "episodes": 117},
        {"years": "2018–2021", "repo": "therealwindycity/cheyenne-archives-2018-2021", "episodes": 177},
        {"years": "2014–2017", "repo": "therealwindycity/cheyenne-archives-2014-2017", "episodes": 22},
        {"years": "2008–2013", "repo": "therealwindycity/cheyenne-archives-2008-2013", "episodes": 11},
    ],
    "rich_episodes": rich_out,
    "ordinance_arcs": ORDINANCE_ARCS,
    "catalog_804": catalog_804,
}

out_path = "/home/user/real_windy_city_tv/data/civic_tv_db.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("window.CIVIC_TV_DB = " + json.dumps(payload, separators=(",", ":")) + ";\n")
print(f"Wrote {out_path}: {os.path.getsize(out_path)/1024:.1f} KB | {len(rich_out)} deep episodes | {len(ORDINANCE_ARCS)} ordinance arcs | {len(catalog_804)} catalog items")
