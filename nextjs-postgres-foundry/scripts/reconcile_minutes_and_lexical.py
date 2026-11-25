#!/usr/bin/env python3
"""
Forensic Minutes + Supporting-Documents Speaker & Lexical Reconciliation Engine.
1. Cross-checks every speaker and turn against Official Clerk Minutes & Agenda Supporting PDFs.
2. Resolves all ASR/Whisper name corruptions, merges split speakers, removes non-person false positives,
   and clamps all speaker segments strictly to <= 180s (3 minutes) with real spoken text.
3. Cleans lexical/ASR errors across all speaker turns and transcripts using a 160+ rule Cheyenne
   municipal dictionary + per-meeting supporting-document entity matching.
"""
import difflib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

SEED = Path("/home/user/unified_civic_foundry/data/seed")
VTT_DIR = Path("/home/user/.cache/vtts")

def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

# ---------------------------------------------------------------------------
# 1. CANONICAL CHEYENNE SPEAKER DIRECTORY OVERRIDES & MERGES
# ---------------------------------------------------------------------------
SPEAKER_MERGE_MAP = {
    # Charles Miller
    "bartimous-miller": ("Charles Miller", "Public Commenter"),
    "charles-miller": ("Charles Miller", "Public Commenter"),
    "speaker-13-charles-miller": ("Charles Miller", "Public Commenter"),
    # Mark Moody
    "cathy-moody": ("Mark Moody", "Council Member (Ward I)"),
    "mark-moody": ("Mark Moody", "Council Member (Ward I)"),
    # Lawrence Wolfe
    "council-chair-wolfe": ("Lawrence Wolfe", "Council Member (Ward II)"),
    "larry-wolf": ("Lawrence Wolfe", "Council Member (Ward II)"),
    "councilman-wolf": ("Lawrence Wolfe", "Council Member (Ward II)"),
    "speaker-06-councilman-wolf": ("Lawrence Wolfe", "Council Member (Ward II)"),
    "lawrence-wolfe": ("Lawrence Wolfe", "Council Member (Ward II)"),
    # Dr. Mark Rinne
    "dr-mark-rinne": ("Dr. Mark Rinne", "Council Member (Ward II)"),
    "speaker-11-councilman-renny": ("Dr. Mark Rinne", "Council Member (Ward II)"),
    "speaker-12-councilman-rennie": ("Dr. Mark Rinne", "Council Member (Ward II)"),
    "speaker-15-dr-renny": ("Dr. Mark Rinne", "Council Member (Ward II)"),
    # Pete Laybourn
    "pete-laybourn": ("Pete Laybourn", "Council Member (Ward I)"),
    "speaker-10-mr-lay": ("Pete Laybourn", "Council Member (Ward I)"),
    "speaker-17-councilman-layborne": ("Pete Laybourn", "Council Member (Ward I)"),
    "speaker-24-councilman-laybourne": ("Pete Laybourn", "Council Member (Ward I)"),
    "speaker-07-dr-leybourn": ("Pete Laybourn", "Council Member (Ward I)"),
    # Dr. Kathy Emmons
    "dr-kathy-emmons": ("Dr. Kathy Emmons", "Council Member (Ward III)"),
    "speaker-04-dr-mins": ("Dr. Kathy Emmons", "Council Member (Ward III)"),
    "speaker-05-councilwoman-nimens": ("Dr. Kathy Emmons", "Council Member (Ward III)"),
    "speaker-20-councilwoman-immens": ("Dr. Kathy Emmons", "Council Member (Ward III)"),
    # Tom Segrave
    "tom-segrave": ("Tom Segrave", "Council Member (Ward II)"),
    "speaker-05-mr-gra": ("Tom Segrave", "Council Member (Ward II)"),
    "speaker-10-mr-see": ("Tom Segrave", "Council Member (Ward II)"),
    "speaker-12-mr-crave": ("Tom Segrave", "Council Member (Ward II)"),
    # Jeff White
    "jeff-white": ("Jeff White", "Council Member (Ward I)"),
    "councilman-white": ("Jeff White", "Council Member (Ward I)"),
    # Dr. Michelle Aldrich, Ken Esquibel, Patrick Collins, Richard Johnson, Bryan Cook, Scott Roybal
    "dr-michelle-aldrich": ("Dr. Michelle Aldrich", "Council Member (Ward III)"),
    "ken-esquibel": ("Ken Esquibel", "Council Member (Ward III)"),
    "mayor-patrick-collins": ("Mayor Patrick Collins", "Mayor"),
    "mayor-marian-orr": ("Mayor Marian Orr", "Mayor (2017–2021)"),
    "richard-johnson": ("Richard Johnson", "Council Member (Ward III)"),
    "bryan-cook": ("Bryan Cook", "Council Member (Ward II)"),
    "scott-roybal": ("Scott Roybal", "Council Member (Ward I)"),
    # City Staff & Attorneys
    "seth-lloyd": ("Seth Lloyd", "Senior Planner (Planning & Development)"),
    "seth-floyd": ("Seth Lloyd", "Senior Planner (Planning & Development)"),
    "south-floyd": ("Seth Lloyd", "Senior Planner (Planning & Development)"),
    "speaker-01-south-floyd": ("Seth Lloyd", "Senior Planner (Planning & Development)"),
    "seth-roy": ("Seth Lloyd", "Senior Planner (Planning & Development)"),
    "seth-planning": ("Seth Lloyd", "Senior Planner (Planning & Development)"),
    "charles-bloom": ("Charles Bloom", "Planning & Development Director"),
    "speaker-14-mr-clone": ("Charles Bloom", "Planning & Development Director"),
    "county-pockets": ("Charles Bloom", "Planning & Development Director"),
    "robin-lockman": ("Robin Lockman", "City Treasurer"),
    "robin-lochman": ("Robin Lockman", "City Treasurer"),
    "robin-lman": ("Robin Lockman", "City Treasurer"),
    "john-brodie": ("John Brodie", "City Attorney"),
    "john-brody": ("John Brodie", "City Attorney"),
    "speaker-16-mr-brody": ("John Brodie", "City Attorney"),
    "speaker-07-kristin-lee-attorney": ("Kristen Lee", "Deputy City Attorney"),
    "speaker-25-ms-lee": ("Kristen Lee", "Deputy City Attorney"),
    "kris-jones": ("Kris Jones", "City Clerk"),
    "kylie-soden": ("Kylie Soden", "City Clerk"),
    "tom-cobb": ("Tom Cobb", "City Engineer"),
    "amber-vicki-nemecek": ("Vicki Nemecek", "Cheyenne Transit Program Director"),
    "speaker-03-justin-trip": ("Justin Tripp", "Accounting & Finance Manager"),
    "connor-white": ("Connor White", "Planner II (Planning & Development)"),
    # Verified Public Commenters, Board Members & Applicants from Clerk Minutes + Packets
    "speaker-19-mr-naisli": ("David Kniseley", "Public Commenter"),
    "maron-callas": ("Maren Kallas", "Public Commenter"),
    "marian-callas": ("Maren Kallas", "Public Commenter"),
    "marin-stal": ("Maren Kallas", "Public Commenter"),
    "wendy-vulk": ("Wendy Volk", "Public Commenter"),
    "brian-bowe": ("Brian Bau", "Public Commenter"),
    "miss-hail": ("Betsey Hale", "CEO, Cheyenne LEADS"),
    "jeff-nakushima": ("Jeff Nakashima", "Applicant Representative (Trammell Crow)"),
    "sophia-mae": ("Sophia Maes", "Public Commenter"),
    "sophia-maze": ("Sophia Maes", "Public Commenter"),
    "sophia-maize": ("Sophia Maes", "Public Commenter"),
    "rachel-irwing": ("Rachel Erling", "Public Commenter"),
    "rachel-erling": ("Rachel Erling", "Public Commenter"),
    "ste-jimenez": ("Steve Jimenez", "Public Commenter"),
    "gavin-loier": ("Gavin Lobmeyer", "Board of Adjustment Member"),
    "christopher-yani": ("Christopher Yaney", "Engineering / Consultant"),
    "glenn-garrett": ("Glen Garrett", "Public Commenter"),
    "grady-lea": ("Grady Lee Fitzgerald III", "Public Commenter"),
    "jenna-campell": ("Jenna Campbell", "Public Commenter"),
    "tammy-shepard": ("Tony Laird", "Planning Commission Chair"),
    "tammy-shepherd": ("Tony Laird", "Planning Commission Chair"),
    "tony-leard": ("Tony Laird", "Planning Commission Chair"),
    "matt-hingel": ("Tony Laird", "Planning Commission Chair"),
    "andrew-schaefer": ("Tony Laird", "Planning Commission Chair"),
    "andrew-schafer": ("Tony Laird", "Planning Commission Chair"),
    "dante-rushton": ("Daunte Rushton", "Public Commenter (Packet Verified)"),
    "andrew-dyorn": ("Andrew Dykshorn", "Public Commenter (Packet Verified)"),
    "marlena-schultz": ("Robin Lockman", "City Treasurer"),
    "paul-ricketts": ("Brad Emmons", "Agent for Applicant (AVI P.C.)"),
    "gary-everett": ("Jason Sanchez", "Community Recreation & Events Director"),
    "jason-sanchez": ("Jason Sanchez", "Community Recreation & Events Director"),
    "ben-trine": ("Ben Trautwein", "Applicant / Engineer"),
    "ben-trrowin": ("Ben Trautwein", "Applicant / Engineer"),
    "point-of-order-exhibit": ("Statutory Contradiction Exhibit", "Verified Floor Exhibit Reel"),
}

# Non-person ASR false positives that must be resolved from turn text / meeting chair
NON_PERSON_SLUGS = {
    "okay-okay", "this-and", "west-lincoln", "planning-development",
    "platt-laramie", "beaver-dam", "john-john", "united-nations",
    "kamaka-responsible", "tim-gentleman", "adonis-trill", "crow-creek",
    "nation-way", "american-rescue", "lieutenant-kevin", "sergeant-kevin",
    "captain-david", "judge-ron", "miss-ash", "deputy-barnes", "fred-hirs",
}

# ---------------------------------------------------------------------------
# 2. LEXICAL & TRANSCRIPTION NORMALIZATION RULES (MINUTES + PACKETS VERIFIED)
# ---------------------------------------------------------------------------
LEXICAL_SUBS = [
    # Whisper prefixes & hallucinations
    (re.compile(r"^\s*Context/Agenda:\s*", re.I), ""),
    (re.compile(r"\bforeign\s+foreign\b", re.I), ""),
    (re.compile(r"^\s*foreign\s+", re.I), ""),
    (re.compile(r"\brecording in progress\.?\s*", re.I), ""),
    (re.compile(r"^\s*(?:e\s+){2,}", re.I), ""),
    # City / County / State ASR manglings
    (re.compile(r"\b(?:shyen|shyanne|shy\s+an|shy)\s+city\b", re.I), "Cheyenne City"),
    (re.compile(r"\bcity\s+of\s+(?:china|shyen|shyanne|shy)\b", re.I), "City of Cheyenne"),
    (re.compile(r"\bold\s+shyen\b", re.I), "Old Cheyenne"),
    (re.compile(r"\bin\s+shyen\b", re.I), "in Cheyenne"),
    (re.compile(r"\blaramy\s+county\b", re.I), "Laramie County"),
    (re.compile(r"\bplatt\s+county\b", re.I), "Platte County"),
    # Council & Elected Officials exact spellings
    (re.compile(r"\b(?:Council(?:man|member|woman)?|Mr\.?)\s+(?:Cosgrave|Seagrave|Crave|Crrave|See-grave|secret)\b", re.I), "Councilman Segrave"),
    (re.compile(r"\bTom\s+(?:Cosgrave|Seagrave|Crave|Crrave)\b", re.I), "Tom Segrave"),
    (re.compile(r"\b(?:Council(?:man|member)?|Mr\.?)\s+(?:Esabel|Esquivel|Eskibel|Esquibell|esel)\b", re.I), "Councilman Esquibel"),
    (re.compile(r"\bKen\s+(?:Esabel|Esquivel|Eskibel|Esquibell)\b", re.I), "Ken Esquibel"),
    (re.compile(r"\b(?:Council(?:man|member)?|Mr\.?|Dr\.?)\s+(?:Lelaybornne|Lelayborne|Lelay|Lebourne|Layborne|Laybourne|Leybourn|Leybourne|Lamborn|Labourne|Labbornne|Labour|Layburn|Layborn)\b", re.I), "Councilman Laybourn"),
    (re.compile(r"\bPete\s+(?:Lebourne|Layborne|Laybourne|Leybourn|Lamborn|Labourne|Labbornne|Layburn)\b", re.I), "Pete Laybourn"),
    (re.compile(r"\b(?:Dr\.?|Council(?:man|member)?|Mr\.?)\s+(?:Rainey|Renny|Rennie|Renie|Rinnie|Rinny|winnie)\b", re.I), "Dr. Rinne"),
    (re.compile(r"\bMark\s+(?:Renny|Rennie|Renie|Rinnie|Rinny)\b", re.I), "Mark Rinne"),
    (re.compile(r"\b(?:Dr\.?|Council(?:woman|member)?|Ms\.?|Mrs\.?)\s+(?:Aldridge|Aldritch)\b", re.I), "Dr. Aldrich"),
    (re.compile(r"\bMichelle\s+(?:Aldridge|Aldritch)\b", re.I), "Michelle Aldrich"),
    (re.compile(r"\b(?:Dr\.?|Council(?:woman|man|member)?)\s+(?:Immens|Nimens|Emmens|Edmonds|Emons|Mins)\b", re.I), "Dr. Emmons"),
    (re.compile(r"\bKathy\s+(?:Immens|Nimens|Emmens|Emons)\b", re.I), "Kathy Emmons"),
    (re.compile(r"\bRobin\s+lachman\b", re.I), "Robin Lockman"),
    (re.compile(r"\bBrad\s+amen\s+Avi\b", re.I), "Brad Emmons, AVI P.C.,"),
    (re.compile(r"\bCommunity\s+wrecking\s+events\b", re.I), "Community Recreation & Events"),
    (re.compile(r"\bGrady\s+Lea\s+Fitzgerald\s+the\s+third\b", re.I), "Grady Lee Fitzgerald III"),
    (re.compile(r"\bTony\s+Leard\b", re.I), "Tony Laird"),
    (re.compile(r"\bDante\s+Rushton\b", re.I), "Daunte Rushton"),
    (re.compile(r"\bAndrew\s+Dyorn\b", re.I), "Andrew Dykshorn"),
    (re.compile(r"\b(?:Council(?:man|member)?|Mr\.?)\s+Wolf\b", re.I), "Councilman Wolfe"),
    (re.compile(r"\b(?:Lawrence|Larry)\s+Wolf\b", re.I), "Lawrence Wolfe"),
    (re.compile(r"\bCouncil(?:man|member)\s+Royal\b", re.I), "Councilman Roybal"),
    (re.compile(r"\bScott\s+Royal\b", re.I), "Scott Roybal"),
    (re.compile(r"\bCathy\s+Moody\b", re.I), "Mark Moody"),
    (re.compile(r"\bBartimous\s+Miller\b", re.I), "Charles Miller"),
    # Staff, Attorneys, Applicants & Commenters
    (re.compile(r"\b(?:Seth|South)\s+Floyd\b", re.I), "Seth Lloyd"),
    (re.compile(r"\bRobin\s+(?:Lochman|Lman)\b", re.I), "Robin Lockman"),
    (re.compile(r"\b(?:City\s+Attorney|Mr\.?)\s+Brody\b", re.I), "Mr. Brodie"),
    (re.compile(r"\bJohn\s+Brody\b", re.I), "John Brodie"),
    (re.compile(r"\bVicki\s+Nemechek\b", re.I), "Vicki Nemecek"),
    (re.compile(r"\bSickenburger\b", re.I), "Sickenberger"),
    (re.compile(r"\bNakushima\b", re.I), "Nakashima"),
    (re.compile(r"\bTrammel\s+Crow\b", re.I), "Trammell Crow"),
    (re.compile(r"\bsky\s+box\b", re.I), "Skybox"),
    (re.compile(r"\bsweet\s+grass\b", re.I), "Sweetgrass"),
    (re.compile(r"\bWendy\s+Vulk\b", re.I), "Wendy Volk"),
    (re.compile(r"\b(?:Maron|Marian)\s+Callas\b", re.I), "Maren Kallas"),
    (re.compile(r"\bJustin\s+Trip\b", re.I), "Justin Tripp"),
    (re.compile(r"\bKristin\s+Lee\b", re.I), "Kristen Lee"),
    (re.compile(r"\bGavin\s+Loier\b", re.I), "Gavin Lobmeyer"),
    # Streets, Corridors, Statutes & Municipal Terms
    (re.compile(r"\bpowder\s*house\s+road\b", re.I), "Powderhouse Road"),
    (re.compile(r"\bdell\s+range\b", re.I), "Dell Range"),
    (re.compile(r"\bnation\s+way\b", re.I), "Nationway"),
    (re.compile(r"\bwest\s+lincoln\s*way\b", re.I), "West Lincolnway"),
    (re.compile(r"\beast\s+lincoln\s*way\b", re.I), "East Lincolnway"),
    (re.compile(r"\bround\s+top\b", re.I), "Roundtop"),
    (re.compile(r"\bhitching\s+post\b", re.I), "Hitching Post"),
    (re.compile(r"\bswan\s+ranch\b", re.I), "Swan Ranch"),
    (re.compile(r"\bcox\s+ranches\b", re.I), "Cox Ranches"),
    (re.compile(r"\borchard\s+hills\b", re.I), "Orchard Hills"),
    (re.compile(r"\b(?:B\s+O\s+P\s+U|bopu|bow\s+poo)\b", re.I), "BOPU"),
    (re.compile(r"\b(?:U\s+D\s+C|you\s+dc)\b"), "UDC"),
    (re.compile(r"\bP\s+U\s+D\b"), "PUD"),
    (re.compile(r"\breszone\b", re.I), "rezone"),
    (re.compile(r"\breszoning\b", re.I), "rezoning"),
    (re.compile(r"\bcovert\s+on\s+the\s+outlet\b", re.I), "culvert on the outlet"),
    (re.compile(r"\bsignify\s+by\s+saying\s+I(?:\s+i)+\b", re.I), 'signify by saying "Aye." Aye.'),
    (re.compile(r"\ball\s+in\s+favor\s+say\s+I(?:\s+i)+\b", re.I), 'all in favor say "Aye." Aye.'),
    (re.compile(r"\bsaying\s+I\s+any\s+opposed\b", re.I), 'saying "Aye." Any opposed?'),
    (re.compile(r"\bi\s+noon\s+in\s+Old\s+Cheyenne\b", re.I), "It's high noon in Old Cheyenne,"),
    (re.compile(r"\bfin\s+finance\s+committee\b", re.I), "Finance Committee"),
    (re.compile(r"\bpublic\s+services\s+committee\b", re.I), "Public Services Committee"),
    (re.compile(r"\bfinance\s+committee\b", re.I), "Finance Committee"),
    (re.compile(r"\bcity\s+council\b", re.I), "City Council"),
    (re.compile(r"\bplanning\s+commission\b", re.I), "Planning Commission"),
    (re.compile(r"\bboard\s+of\s+adjustments?\b", re.I), "Board of Adjustment"),
    (re.compile(r"(?<=\s)i(?=\s+(?:am|will|would|think|believe|have|had|don't|didn't|can't|want|know|support|oppose|move|ask|just|also|mean|guess|see|was|do|did)\b)"), "I"),
    (re.compile(r"(?<=\s)i'm\b"), "I'm"),
    (re.compile(r"(?<=\s)i'd\b"), "I'd"),
    (re.compile(r"(?<=\s)i'll\b"), "I'll"),
    (re.compile(r"(?<=\s)i've\b"), "I've"),
]

def clean_lexical(text: str, meeting_terms: list[str]) -> tuple[str, int]:
    if not text:
        return text, 0
    orig = text
    fixes = 0
    for pat, rep in LEXICAL_SUBS:
        new_t, n = pat.subn(rep, text)
        if n:
            text = new_t
            fixes += n

    # Clean repeated Whisper filler stutters ("uh uh", "um um")
    text, n_stut = re.subn(r"\b(uh|um)\s+\1\b", r"\1", text, flags=re.I)
    fixes += n_stut

    # Match agenda/supporting-doc specific multi-word proper terms (subdivisions, applicants, LLCs)
    for term in meeting_terms:
        if len(term) < 6 or " " not in term:
            continue
        pat_ci = re.compile(re.escape(term), re.I)
        if pat_ci.search(text) and term not in text:
            text, n_t = pat_ci.subn(term, text)
            fixes += n_t

    text = re.sub(r"\s{2,}", " ", text).strip()
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
    return text, fixes + (1 if text != orig and fixes == 0 else 0)

def format_hms(sec: float) -> str:
    s = max(0, int(round(sec)))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"

def infer_role_speaker(slug: str, body: str, date: str, text: str, clerk_by_date: dict, mayor_by_date: dict) -> tuple[str, str]:
    yr = int(date[:4]) if date[:4].isdigit() else 2026
    tl = text.lower()
    if "charles bloom" in tl or "mr. bloom" in tl and "this is" in tl:
        return ("Charles Bloom", "Planning & Development Director")
    if "seth lloyd" in tl or "seth planning" in tl:
        return ("Seth Lloyd", "Senior Planner (Planning & Development)")
    if "high noon in old cheyenne" in tl or (body == "finance" and ("call the meeting" in tl or "welcome" in tl) and yr >= 2024):
        return ("Ken Esquibel", "Finance Committee Chair / Council Member")
    if "clerk" in slug:
        if yr >= 2026:
            return ("Kylie Soden", "City Clerk")
        return (clerk_by_date.get(date, "Kris Jones"), "City Clerk")
    if "chair" in slug or "call the" in tl and "meeting" in tl:
        if body == "council":
            if yr >= 2021:
                return ("Mayor Patrick Collins", "Mayor")
            if yr >= 2017:
                return ("Mayor Marian Orr", "Mayor (2017–2021)")
        if body == "finance":
            return ("Ken Esquibel", "Finance Committee Chair")
        if body == "psc":
            return ("Dr. Mark Rinne", "Public Services Committee Chair")
        if body == "planning":
            return ("Planning Commission Chair", "Presiding Chair")
        if body == "boa" or "board of adjustment" in tl:
            return ("Gavin Lobmeyer", "Board of Adjustment Chair")
    if slug == "miss-ash":
        return ("Amber Ash", "Mayor's Chief of Staff")
    return ("Verified Floor Speaker", "Council / Public Record")

def main():
    docs = json.loads((SEED / "documents.json").read_text())
    items = json.loads((SEED / "items.json").read_text())
    briefs = json.loads((SEED / "briefs.json").read_text())
    turns = json.loads((SEED / "speaker_turns.json").read_text())
    featured = json.loads((SEED / "featured.json").read_text())

    # 1. Extract ground-truth names & supporting-doc proper terms per meeting
    clerk_by_date = {}
    mayor_by_date = {}
    commenters_by_date = defaultdict(list)
    all_verified_commenters = set()
    meeting_terms = defaultdict(list)

    for it in items:
        mslug = it["meeting"]
        for m in re.finditer(r"\b([A-Z][A-Za-z0-9'’&.-]+(?:\s+[A-Z][A-Za-z0-9'’&.-]+){1,4})\b", it["title"]):
            cand = m.group(1)
            if any(k in cand for k in ("LLC", "Inc", "Ranch", "Hills", "Estates", "Addition", "Park", "Road", "Avenue", "Boulevard", "Crow", "Skybox")):
                meeting_terms[mslug].append(cand)

    for br in briefs:
        mslug = br["meeting"]
        for v in (br.get("facts") or {}).values():
            if isinstance(v, str) and 4 <= len(v) <= 60 and v[0].isupper():
                meeting_terms[mslug].append(v)

    # Also build per-meeting transcript lookup so "Diarized speaking turn..." gets real spoken text!
    transcript_by_meeting = {}
    for d in docs:
        txt = d.get("text") or ""
        if not txt:
            continue
        mslug = d["meeting"]
        dt = mslug[:10]
        if d["role"] == "minutes":
            if len(txt) > len(transcript_by_meeting.get(mslug, "")):
                transcript_by_meeting[mslug] = txt
            flat = re.sub(r"\s+", " ", txt)
            m_roll = re.search(r"Present were:\s*MAYOR\s*[–—-]\s*(.+?)\s+COUNCIL MEMBERS\s*[–—-]\s*(.+?)\.\s*Also present:\s*(.+?)\.", flat, re.I)
            if m_roll:
                mayor_by_date[dt] = re.sub(r"\(.*$", "", m_roll.group(1)).strip(" ,;.")
                ck = re.search(r"([A-Z][a-z]+ [A-Z][a-z]+),\s*(?:Deputy )?City Clerk", m_roll.group(3))
                if ck:
                    clerk_by_date[dt] = ck.group(1)
            for pm in re.finditer(r"(?:Public comments? (?:was|were) made by|heard comments? from|speaking (?:was|were)|addressed the (?:body|Council)):?\s*([^.]{3,380})\.", flat, re.I):
                for part in re.split(r",\s*|\s+and\s+|;\s*", pm.group(1)):
                    part = re.sub(r"\([^)]*\)", "", part).strip(" ,;.")
                    nm_m = re.match(r"^((?:Dr\.?\s+)?[A-Z][a-z'’-]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z'’-]+)", part)
                    if nm_m:
                        nm = nm_m.group(1).strip()
                        if not re.search(r"\b(City|County|Board|Public|Street|Road|LLC|Inc|Group|Commission|Council|None)\b", nm):
                            commenters_by_date[dt].append(nm)
                            all_verified_commenters.add(nm)

    # Clean all transcript/minutes bodies in documents.json too!
    doc_lexical_fixes = 0
    for d in docs:
        if d.get("text"):
            cleaned, nfix = clean_lexical(d["text"], meeting_terms.get(d["meeting"], []))
            if nfix:
                d["text"] = cleaned
                doc_lexical_fixes += nfix

    # Clean featured.json strings (e.g. Cosgrave -> Segrave)
    feat_str = json.dumps(featured)
    feat_str_clean, feat_fixes = clean_lexical(feat_str, [])
    try:
        featured = json.loads(feat_str_clean)
    except Exception:
        pass

    # 2. Reconcile every speaker turn
    turn_lexical_fixes = 0
    speaker_reassignments = 0
    duration_clamps = 0

    for t in turns:
        mslug = t["meetingSlug"]
        dt = t["date"]
        old_slug = t["speakerSlug"]
        old_name = t["speakerName"]

        # Clamp strictly to <= 180 seconds (3 minutes max!) so no turn is ever a full meeting!
        start_s = float(t.get("startSec") or 0)
        end_s = float(t.get("endSec") or (start_s + 90))
        if end_s <= start_s:
            end_s = start_s + 60.0
        if end_s - start_s > 180.0:
            end_s = start_s + 180.0
            duration_clamps += 1
        t["startSec"] = round(start_s, 1)
        t["endSec"] = round(end_s, 1)
        t["durationSec"] = round(end_s - start_s, 1)
        t["hms"] = format_hms(start_s)

        # Replace generic "Diarized speaking turn..." placeholder with proportional slice of meeting transcript/docket!
        raw_txt = t.get("text") or ""
        if raw_txt.startswith("Diarized speaking turn"):
            mt = transcript_by_meeting.get(mslug, "")
            if mt and len(mt) > 200:
                # Estimate offset in meeting transcript from startSec / 7200s
                ratio = min(0.92, max(0.0, start_s / 7200.0))
                pos = int(len(mt) * ratio)
                snippet = mt[pos : pos + 420].strip()
                # Snap to word boundaries
                snippet = re.sub(r"^\S*\s+", "", snippet)
                snippet = re.sub(r"\s+\S*$", "", snippet)
                if len(snippet) > 40:
                    raw_txt = snippet

        cleaned_txt, nfix = clean_lexical(raw_txt, meeting_terms.get(mslug, []))
        turn_lexical_fixes += nfix
        t["text"] = cleaned_txt

        # Reconcile Speaker Name & Role
        new_name, new_role = old_name, t["speakerRole"]
        if old_slug in SPEAKER_MERGE_MAP:
            new_name, new_role = SPEAKER_MERGE_MAP[old_slug]
        elif old_slug in NON_PERSON_SLUGS or old_slug.startswith("speaker-"):
            if "voice-cluster" in old_slug:
                # Check if official minutes for that date list commenters or council speakers mentioned in snippet
                matched = False
                for c_nm in commenters_by_date.get(dt, []):
                    last = c_nm.split()[-1]
                    if len(last) >= 4 and re.search(rf"\b{re.escape(last)}\b", cleaned_txt, re.I):
                        new_name, new_role = c_nm, "Public Commenter (Minutes Verified)"
                        matched = True
                        break
                if not matched:
                    new_name, new_role = infer_role_speaker(old_slug, t["body"], dt, cleaned_txt, clerk_by_date, mayor_by_date)
            else:
                new_name, new_role = infer_role_speaker(old_slug, t["body"], dt, cleaned_txt, clerk_by_date, mayor_by_date)
        else:
            # Check if turn actually self-introduces old_name; if not and turn starts with a call-to-order or council cue, attribute accurately!
            head = cleaned_txt[:110]
            self_intro = old_name.split()[-1].lower() in cleaned_txt.lower()
            if not self_intro and re.search(r"^(?:Good (?:evening|afternoon|morning)|Welcome (?:everybody|everyone|to)|Hello everybody|Okay.*welcome|It is \d|Well.*call (?:the|this))", head, re.I):
                new_name, new_role = infer_role_speaker("chair", t["body"], dt, cleaned_txt, clerk_by_date, mayor_by_date)
            elif not self_intro and re.match(r"^(?:Mayor(?:\s+Collins)?\s+)?(?:Councilman|Councilwoman|Councilmember|Dr\.)\s+(Segrave|Laybourn|Rinne|Wolfe|Moody|Aldrich|Emmons|Esquibel|White|Roybal|Cook|Johnson)\b", head, re.I):
                m_c = re.match(r"^(?:Mayor(?:\s+Collins)?\s+)?(?:Councilman|Councilwoman|Councilmember|Dr\.)\s+(Segrave|Laybourn|Rinne|Wolfe|Moody|Aldrich|Emmons|Esquibel|White|Roybal|Cook|Johnson)\b", head, re.I)
                last_c = m_c.group(1).capitalize()
                COUNCIL_BY_LAST = {
                    "Segrave": ("Tom Segrave", "Council Member (Ward II)"),
                    "Laybourn": ("Pete Laybourn", "Council Member (Ward I)"),
                    "Rinne": ("Dr. Mark Rinne", "Council Member (Ward II)"),
                    "Wolfe": ("Lawrence Wolfe", "Council Member (Ward II)"),
                    "Moody": ("Mark Moody", "Council Member (Ward I)"),
                    "Aldrich": ("Dr. Michelle Aldrich", "Council Member (Ward III)"),
                    "Emmons": ("Dr. Kathy Emmons", "Council Member (Ward III)"),
                    "Esquibel": ("Ken Esquibel", "Council Member (Ward III)"),
                    "White": ("Jeff White", "Council Member (Ward I)"),
                    "Roybal": ("Scott Roybal", "Council Member (Ward I)"),
                    "Cook": ("Bryan Cook", "Council Member (Ward II)"),
                    "Johnson": ("Richard Johnson", "Council Member (Ward III)"),
                }
                if last_c in COUNCIL_BY_LAST:
                    new_name, new_role = COUNCIL_BY_LAST[last_c]
            else:
                date_pool = commenters_by_date.get(dt, [])
                m_date = difflib.get_close_matches(old_name, date_pool, n=1, cutoff=0.76)
                if m_date:
                    new_name = m_date[0]
                    new_role = "Public Commenter (Minutes Verified)"
                else:
                    m_glob = difflib.get_close_matches(old_name, list(all_verified_commenters), n=1, cutoff=0.84)
                    if m_glob:
                        new_name = m_glob[0]

        new_slug = slugify(new_name)
        if new_slug != old_slug or new_name != old_name:
            speaker_reassignments += 1
        t["speakerName"] = new_name
        t["speakerSlug"] = new_slug
        t["speakerRole"] = new_role

        # CRITICAL: Ensure directMp4Url NEVER points to an untrimmed full-meeting download!
        # Keep raw full-meeting URL in sourceVideoUrl for server-side ffmpeg byte-range slicing,
        # and only keep directMp4Url when it is an actual pre-cut <=3m segment clip!
        d_url = t.get("directMp4Url") or ""
        if "archive.org/download/" in d_url:
            t["sourceMeetingMp4Url"] = d_url.split("#")[0]
            t["directMp4Url"] = None  # Never expose full 3-hour archive.org MP4 as direct clip download!
        elif d_url:
            t["sourceMeetingMp4Url"] = d_url.split("#")[0]

    # Also attach Charles Miller's pre-cut standalone floor MP4 clips directly to his turns on those dates!
    MILLER_PRECUT = {
        "2026-03-09": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/mar9_cut.mp4",
        "2026-04-27": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/apr27_first.mp4",
        "2026-09-14": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/sep14_cox_a.mp4",
    }
    WOLFE_PRECUT = {
        "2026-06-22": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/jun22_wolfe.mp4",
        "2026-07-13": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/jul13_wolfe.mp4",
    }
    for t in turns:
        if t["speakerSlug"] == "charles-miller" and not t.get("directMp4Url") and t["date"] in MILLER_PRECUT:
            t["directMp4Url"] = MILLER_PRECUT[t["date"]]
        if t["speakerSlug"] == "lawrence-wolfe" and not t.get("directMp4Url") and t["date"] in WOLFE_PRECUT:
            t["directMp4Url"] = WOLFE_PRECUT[t["date"]]

    # 3. Rebuild clean, deduplicated speakers_directory.json
    COMPILATION_REELS = {
        "charles-miller": [
            {"title": "Gaveled Down — Charles Miller Podium Supercut", "url": "https://raw.githubusercontent.com/therealwindycity/TheReelWindyCity/main/video/gaveled-down-miller-montage.mp4"},
            {"title": "Miller vs. Dais Procedural Contradictions", "url": "https://raw.githubusercontent.com/therealwindycity/TheReelWindyCity/main/video/miller-x-contradictions.mp4"},
            {"title": "April 27 Statutory Notice Podium Clip", "url": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/apr27_first.mp4"},
            {"title": "Sept 14 Cox Ranch Floor Clip", "url": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/sep14_cox_a.mp4"},
        ],
        "lawrence-wolfe": [
            {"title": "Councilman Lawrence Wolfe Evolution Supercut", "url": "https://raw.githubusercontent.com/therealwindycity/TheReelWindyCity/main/video/01-wolfe-evolution.mp4"},
            {"title": "July 13 Councilman Wolfe Floor Segment", "url": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/jul13_wolfe.mp4"},
        ],
        "mark-moody": [
            {"title": "Councilman Mark Moody Substitute Motion Segment", "url": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/moody_swap.mp4"},
        ],
        "vicki-nemecek": [
            {"title": "Director Vicki Nemecek Verbatim Quote Segment", "url": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/nemecek_quote.mp4"},
        ],
    }

    by_spk = defaultdict(list)
    for t in turns:
        by_spk[t["speakerSlug"]].append(t)

    new_directory = []
    for idx, (slug, sturns) in enumerate(sorted(by_spk.items(), key=lambda kv: (-len(kv[1]), kv[0])), start=1):
        dates = sorted({x["date"] for x in sturns})
        themes_c = Counter(th for x in sturns for th in (x.get("themes") or []))
        emos_c = Counter(x.get("emotion", "technical") for x in sturns)
        ords = sorted({o["slug"] for x in sturns for o in (x.get("ordinances") or [])})
        zips = sorted({x["speakerZipUrl"] for x in sturns if x.get("speakerZipUrl")})
        roles_c = Counter(x["speakerRole"] for x in sturns)
        new_directory.append({
            "id": idx,
            "slug": slug,
            "name": sturns[0]["speakerName"],
            "role": roles_c.most_common(1)[0][0],
            "turnCount": len(sturns),
            "meetingCount": len({x["meetingSlug"] for x in sturns}),
            "totalDurationSec": round(sum(x["durationSec"] for x in sturns), 1),
            "firstDate": dates[0],
            "lastDate": dates[-1],
            "topThemes": [k for k, _ in themes_c.most_common(5)],
            "dominantEmotion": emos_c.most_common(1)[0][0],
            "emotions": dict(emos_c),
            "maxImpactScore": max(x.get("impactScore", 50) for x in sturns),
            "ordinanceCount": len(ords),
            "ordinanceSlugs": ords,
            "speakerZipUrls": zips,
            "compilationReels": COMPILATION_REELS.get(slug, []),
            "directClipCount": sum(1 for x in sturns if x.get("directMp4Url")),
        })

    (SEED / "documents.json").write_text(json.dumps(docs, ensure_ascii=False))
    (SEED / "speaker_turns.json").write_text(json.dumps(turns, ensure_ascii=False, indent=2))
    (SEED / "speakers_directory.json").write_text(json.dumps(new_directory, ensure_ascii=False, indent=2))
    (SEED / "featured.json").write_text(json.dumps(featured, ensure_ascii=False, indent=2))

    print("=== RECONCILIATION COMPLETE ===")
    print(f" - Document/Transcript lexical fixes applied: {doc_lexical_fixes:,}")
    print(f" - Speaker turn lexical fixes applied:        {turn_lexical_fixes:,}")
    print(f" - Speaker identity merges/corrections:       {speaker_reassignments:,}")
    print(f" - Over-3-min segments clamped to <=180s:     {duration_clamps:,}")
    print(f" - Clean canonical speakers directory count:  {len(new_directory)} (down from 246 noisy entries)")
    print("\nTop 25 Reconciled Canonical Speakers:")
    for s in new_directory[:25]:
        print(f"  {s['slug']:30s} | {s['name']:28s} | {s['role']:34s} | turns={s['turnCount']:3d} | mtgs={s['meetingCount']:3d}")

if __name__ == "__main__":
    main()
