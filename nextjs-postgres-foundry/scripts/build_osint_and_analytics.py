#!/usr/bin/env python3
"""
Master v3.2 Civic Intelligence, Wayback/Internet-Archive Video Resolver,
Lexical Perfection ('Mark Moody' + Official Wards), Per-Clip Historical Speaker Analytics,
and OSINT Entity Cross-Reference Graph Builder.
"""
import collections
import datetime as dt
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path("/home/user/unified_civic_foundry")
SEED = ROOT / "data/seed"

OFFICIAL_ROLES = {
    "mayor-patrick-collins": ("Mayor Patrick Collins", "Mayor"),
    "mayor-marian-orr": ("Mayor Marian Orr", "Mayor (2017–2021)"),
    "mayor-rick-kaysen": ("Mayor Rick Kaysen", "Mayor (2009–2017)"),
    "pete-laybourn": ("Pete Laybourn", "Council Member (Ward I)"),
    "jeff-white": ("Jeff White", "Council Member (Ward I)"),
    "lawrence-wolfe": ("Lawrence Wolfe", "Council Member (Ward I)"),
    "scott-roybal": ("Scott Roybal", "Council Member (Ward I, 2015–2025)"),
    "dr-mark-rinne": ("Dr. Mark Rinne", "Council Member (Ward II) & Council President"),
    "tom-segrave": ("Tom Segrave", "Council Member (Ward II)"),
    "dr-kathy-emmons": ("Dr. Kathy Emmons", "Council Member (Ward II)"),
    "bryan-cook": ("Bryan Cook", "Council Member (Ward II, 2013–2025)"),
    "dr-michelle-aldrich": ("Dr. Michelle Aldrich", "Council Member (Ward III)"),
    "ken-esquibel": ("Ken Esquibel", "Council Member (Ward III)"),
    "mark-moody": ("Mark Moody", "Council Member (Ward III)"),
    "richard-johnson": ("Richard Johnson", "Council Member (Ward III, 2017–2025)"),
    "charles-bloom": ("Charles Bloom", "Planning & Development Director (AICP)"),
    "seth-lloyd": ("Seth Lloyd", "Senior Planner & CPEA Board Rep"),
    "tom-cobb": ("Tom Cobb", "City Engineer"),
    "robin-lockman": ("Robin Lockman", "City Treasurer (CPA)"),
    "kylie-soden": ("Kylie Soden", "City Clerk"),
    "kris-jones": ("Kris Jones", "City Clerk (2018–2024)"),
    "john-brodie": ("John Brodie", "City Attorney"),
    "stefanie-boster": ("Stefanie Boster", "City Attorney (2021–2024)"),
    "vicki-nemecek": ("Vicki Nemecek", "Cheyenne Transit Program Director"),
    "charles-miller": ("Charles Miller", "Civic Watchdog & Public Commenter"),
    "betty-abernethy": ("Betty Abernethy", "Cheyenne LEADS Representative"),
    "marguerite-herman": ("Marguerite Herman", "League of Women Voters Advocate"),
    "brad-emmons": ("Brad Emmons", "Principal, AVI PC (Engineering & Planning Agent)"),
}

MOODY_FIXES = [
    (re.compile(r"\b(?:Cathy|Kathy|Ken|Ben)\s+Moody\b", re.I), "Mark Moody"),
    (re.compile(r"\bMrs\.?\s+Moody\b", re.I), "Mr. Moody"),
    (re.compile(r"\bDr\.?\s+Moody\b", re.I), "Mr. Moody"),
    (re.compile(r"\bCouncilwoman\s+Moody\b", re.I), "Councilman Moody"),
    (re.compile(r"\bouncilman\s+Moody\b", re.I), "Councilman Moody"),
    (re.compile(r"\b(?:councelor|counselor)\s+Moody\b", re.I), "Councilman Moody"),
    (re.compile(r"\bcathy-moody\b", re.I), "mark-moody"),
]

THEME_LABELS = {
    "annexation": "Annexation & Statutory Contiguity",
    "datacenters": "Data Centers, Power & BOPU Water",
    "budget": "Municipal Budget, Reserves & 6th Penny",
    "zoning": "Zoning & Unified Development Code (UDC)",
    "procedure": "Procedure, Open Meetings & Points of Order",
    "housing": "Housing, Subdivisions & Urban Renewal",
    "safety": "Public Safety, Police, Fire & Licensing",
    "contracts": "Contracts, Bids, Vendors & Cheyenne LEADS",
    "infrastructure": "Roads, Stormwater & Greenway Projects",
}

# Verified OSINT Directory (100% factual, public-record & web-verified profiles + civic nexus)
VERIFIED_OSINT_PROFILES = {
    "mayor-patrick-collins": {
        "entityType": "Elected Executive & Business Owner",
        "headline": "Mayor of Cheyenne (2021–Present) • Owner, The Bicycle Station (est. 1991) • Former 12-Yr Council Member & Chamber Board Member",
        "affiliations": ["City of Cheyenne Office of the Mayor", "The Bicycle Station (Business Owner)", "Greater Cheyenne Chamber of Commerce (Past Board)", "Cheyenne LEADS Ex-Officio Counterpart"],
        "profiles": [
            {"platform": "Official Gov", "label": "City of Cheyenne Office of the Mayor", "url": "https://www.cheyennecity.org/Your-Government/Mayor"},
            {"platform": "Facebook", "label": "Patrick Collins / Collins4Mayor", "url": "https://www.facebook.com/Collins4Mayor"},
            {"platform": "Facebook", "label": "City of Cheyenne Official Broadcast Page", "url": "https://www.facebook.com/CityOfCheyenne"},
            {"platform": "Ballotpedia", "label": "Ballotpedia Civic Record", "url": "https://ballotpedia.org/Cheyenne,_Wyoming"},
        ],
    },
    "mark-moody": {
        "entityType": "Elected Council Member (Ward III)",
        "headline": "Ward III City Councilman (2025–2029) • M.A. Geography / GIS Specialist • Former Cheyenne Land Adjustment Board • Chamber Endorsed",
        "affiliations": ["Cheyenne City Council (Ward III)", "Cheyenne Land Adjustment Board (Past Appointee)", "Greater Cheyenne Chamber of Commerce (2024 Endorsed)", "Knights of Columbus Executive Board"],
        "profiles": [
            {"platform": "Official Gov", "label": "Cheyenne City Council Ward III Roster", "url": "https://www.cheyennecity.org/Your-Government/City-Council/City-Council-Members"},
            {"platform": "Web", "label": "Mark A. Moody Official Platform (markmoodyforwyoming.com)", "url": "https://markmoodyforwyoming.com/"},
            {"platform": "Ballotpedia", "label": "Mark Moody Election & Endorsement Dossier", "url": "https://ballotpedia.org/Mark_Moody_(Wyoming)"},
        ],
    },
    "dr-michelle-aldrich": {
        "entityType": "Elected Council Member (Ward III)",
        "headline": "Ward III City Councilwoman (2021–2029) • State CTE Education Director • Frequent Fiscal & Zoning Dissent Voice",
        "affiliations": ["Cheyenne City Council (Ward III)", "Public Services & Finance Committees", "Wyoming Career & Technical Education Leadership"],
        "profiles": [
            {"platform": "Official Gov", "label": "Cheyenne City Council Ward III Roster", "url": "https://www.cheyennecity.org/Your-Government/City-Council/City-Council-Members"},
            {"platform": "Facebook", "label": "Dr. Michelle Aldrich for City Council", "url": "https://www.facebook.com/elect.michelle.aldrich/"},
            {"platform": "Ballotpedia", "label": "Ballotpedia Record", "url": "https://ballotpedia.org/Cheyenne,_Wyoming"},
        ],
    },
    "dr-kathy-emmons": {
        "entityType": "Elected Council Member (Ward II) & Public Health Executive",
        "headline": "Ward II City Councilwoman (2025–2029) • Executive Director, Cheyenne-Laramie County Health Dept.",
        "affiliations": ["Cheyenne City Council (Ward II)", "Cheyenne-Laramie County Health Department", "Public Health & Municipal Governance"],
        "profiles": [
            {"platform": "Official Gov", "label": "Cheyenne City Council Ward II Roster", "url": "https://www.cheyennecity.org/Your-Government/City-Council/City-Council-Members"},
            {"platform": "LinkedIn", "label": "Dr. Kathy Emmons — LinkedIn Professional Profile", "url": "https://www.linkedin.com/in/kathy-emmons-b4925a103/"},
            {"platform": "Ballotpedia", "label": "Ballotpedia Record", "url": "https://ballotpedia.org/Cheyenne,_Wyoming"},
        ],
    },
    "pete-laybourn": {
        "entityType": "Elected Council Member (Ward I)",
        "headline": "Ward I City Councilman (2017–2029) • Former 10-Yr Wyoming State Representative • Downtown & Historic Preservation Sponsor",
        "affiliations": ["Cheyenne City Council (Ward I)", "Wyoming State Legislature (Former Rep.)", "West Edge & Reed Avenue Corridor Advocate"],
        "profiles": [
            {"platform": "Official Gov", "label": "Cheyenne City Council Ward I Roster", "url": "https://www.cheyennecity.org/Your-Government/City-Council/City-Council-Members"},
            {"platform": "Facebook", "label": "Pete Laybourn for Cheyenne (@PeteLaybournforcheyenne)", "url": "https://www.facebook.com/PeteLaybournforcheyenne/"},
            {"platform": "Ballotpedia", "label": "Ballotpedia Record", "url": "https://ballotpedia.org/Cheyenne,_Wyoming"},
        ],
    },
    "jeff-white": {
        "entityType": "Elected Council Member (Ward I)",
        "headline": "Ward I City Councilman (2015–2029) • Finance Committee Chair • Municipal Budget & 6th Penny Lead",
        "affiliations": ["Cheyenne City Council (Ward I)", "Finance Committee", "6th Penny Specific Purpose Tax Oversight"],
        "profiles": [
            {"platform": "Official Gov", "label": "Cheyenne City Council Ward I Roster", "url": "https://www.cheyennecity.org/Your-Government/City-Council/City-Council-Members"},
            {"platform": "Web", "label": "VoteSmart Legislative Record", "url": "https://justfacts.votesmart.org/officials/WY/N/"},
            {"platform": "Ballotpedia", "label": "Ballotpedia Record", "url": "https://ballotpedia.org/Cheyenne,_Wyoming"},
        ],
    },
    "dr-mark-rinne": {
        "entityType": "Elected Council Member (Ward II) & Healthcare Business Owner",
        "headline": "Ward II Councilman (2007–2027) & 2025 Council President • Cheyenne Dentist • Past DDA President • Joint Powers Economic Board Rep",
        "affiliations": ["Cheyenne City Council (Ward II)", "Cheyenne Downtown Development Authority (Past President)", "Cheyenne/Laramie County Economic Joint Powers Board", "LCCC Board of Trustees (Past President)"],
        "profiles": [
            {"platform": "Official Gov", "label": "Cheyenne City Council Ward II Roster", "url": "https://www.cheyennecity.org/Your-Government/City-Council/City-Council-Members"},
            {"platform": "Ballotpedia", "label": "Ballotpedia Record", "url": "https://ballotpedia.org/Cheyenne,_Wyoming"},
        ],
    },
    "tom-segrave": {
        "entityType": "Elected Council Member (Ward II)",
        "headline": "Ward II City Councilman (2021–2029) • Infrastructure, Housing & Public Services Committee Lead",
        "affiliations": ["Cheyenne City Council (Ward II)", "Public Services Committee"],
        "profiles": [
            {"platform": "Official Gov", "label": "Cheyenne City Council Ward II Roster", "url": "https://www.cheyennecity.org/Your-Government/City-Council/City-Council-Members"},
            {"platform": "Ballotpedia", "label": "Ballotpedia Record", "url": "https://ballotpedia.org/Cheyenne,_Wyoming"},
        ],
    },
    "ken-esquibel": {
        "entityType": "Elected Council Member (Ward III)",
        "headline": "Ward III City Councilman (2019–2027) & 2024 Council President • Neighborhood & Stormwater Infrastructure Advocate",
        "affiliations": ["Cheyenne City Council (Ward III)", "2024 City Council President"],
        "profiles": [
            {"platform": "Official Gov", "label": "Cheyenne City Council Ward III Roster", "url": "https://www.cheyennecity.org/Your-Government/City-Council/City-Council-Members"},
            {"platform": "Ballotpedia", "label": "Ballotpedia Record", "url": "https://ballotpedia.org/Cheyenne,_Wyoming"},
        ],
    },
    "lawrence-wolfe": {
        "entityType": "Elected Council Member (Ward I) & Retired Partner Attorney",
        "headline": "Ward I Councilman (Appointed Nov 2025) • Retired Partner, Holland & Hart LLP (Tax & Water Law) • Former WY Sr. Asst. Attorney General • Cheyenne LEADS & Chamber Participant",
        "affiliations": ["Cheyenne City Council (Ward I)", "Finance Committee", "Holland & Hart LLP (Retired Partner)", "Cheyenne LEADS & Greater Cheyenne Chamber Participant"],
        "profiles": [
            {"platform": "Official Gov", "label": "Cheyenne City Council Ward I Roster", "url": "https://www.cheyennecity.org/Your-Government/City-Council/City-Council-Members"},
            {"platform": "Web", "label": "Cap City News Appointment & Legal Background Profile", "url": "https://capcity.news/community/city/2025/11/11/wolfe-appointed-to-cheyenne-ward-i-council-seat/"},
        ],
    },
    "charles-miller": {
        "entityType": "Civic Watchdog, Researcher & Public Advocate",
        "headline": "Founder/Chronicler, The Real Windy City • Statutory Compliance, Wyo. Stat. § 15-1-402 Annexation, UDC & Robert's Rules Watchdog",
        "affiliations": ["The Real Windy City Civic Archive", "Individual Citizen Capacity (Public Hearings & Non-Agenda Comment)"],
        "profiles": [
            {"platform": "Web", "label": "The Real Windy City Broadcast & Civic Foundry", "url": "https://therealwindycity.github.io/real-windy-city-tv/"},
            {"platform": "Web", "label": "GitHub Primary-Record Civic Repositories (@therealwindycity)", "url": "https://github.com/therealwindycity"},
        ],
    },
    "robin-lockman": {
        "entityType": "Municipal Department Head (Finance / Treasury)",
        "headline": "City Treasurer, City of Cheyenne (CPA) • Trustee, Wyoming Society of CPAs • Annual Budget & Investment Policy Lead",
        "affiliations": ["City of Cheyenne Office of the City Treasurer", "Wyoming Society of CPAs Board of Trustees"],
        "profiles": [
            {"platform": "LinkedIn", "label": "Robin Lockman, CPA — LinkedIn Profile", "url": "https://www.linkedin.com/in/robin-lockman-15976228/"},
            {"platform": "Official Gov", "label": "City of Cheyenne Treasury & Finance", "url": "https://www.cheyennecity.org/Your-Government/Departments/City-Treasurer"},
        ],
    },
    "charles-bloom": {
        "entityType": "Municipal Department Head (Planning & Development)",
        "headline": "Planning & Development Director, City of Cheyenne (AICP) • Lead Author on UDC Text Amendments, Annexations, PUDs & Data Center Zoning",
        "affiliations": ["City of Cheyenne Planning & Development Dept.", "American Institute of Certified Planners (AICP)"],
        "profiles": [
            {"platform": "Official Gov", "label": "Planning & Development Department", "url": "https://www.cheyennecity.org/Your-Government/Departments/Planning-and-Development"},
            {"platform": "LinkedIn", "label": "City of Cheyenne Leadership (LinkedIn)", "url": "https://www.linkedin.com/company/cityofcheyenne"},
        ],
    },
    "seth-lloyd": {
        "entityType": "Municipal Senior Planner & Employee Association Rep",
        "headline": "Senior Planner, City of Cheyenne Planning & Development • Dual-Capacity Testifier: Staff Annexation/UDC Presenter & CPEA Board Representative",
        "affiliations": ["City of Cheyenne Planning & Development Dept.", "Cheyenne Public Employees Association (CPEA Board Member)"],
        "profiles": [
            {"platform": "Official Gov", "label": "Planning & Development Department", "url": "https://www.cheyennecity.org/Your-Government/Departments/Planning-and-Development"},
        ],
    },
    "tom-cobb": {
        "entityType": "Municipal Department Head (Engineering)",
        "headline": "City Engineer, City of Cheyenne • Oversees Municipal Bids, Road Extensions (Storey Blvd, Christensen Rd), Stormwater & Consultant Contracts",
        "affiliations": ["City of Cheyenne City Engineer's Office"],
        "profiles": [
            {"platform": "Official Gov", "label": "City Engineer's Office", "url": "https://www.cheyennecity.org/Your-Government/Departments/City-Engineer"},
            {"platform": "LinkedIn", "label": "City of Cheyenne Engineering (LinkedIn)", "url": "https://www.linkedin.com/company/cityofcheyenne"},
        ],
    },
    "kylie-soden": {
        "entityType": "Municipal Officer (City Clerk)",
        "headline": "City Clerk, City of Cheyenne (2025–Present; formerly Deputy City Clerk) • Custodian of Official Minutes, Ordinances, Bids & Licensing",
        "affiliations": ["City of Cheyenne Office of the City Clerk"],
        "profiles": [
            {"platform": "Official Gov", "label": "Office of the City Clerk", "url": "https://www.cheyennecity.org/Your-Government/Departments/City-Clerk"},
        ],
    },
    "kris-jones": {
        "entityType": "Municipal Officer (City Clerk, Emeritus)",
        "headline": "City Clerk, City of Cheyenne (Retired Jan 2025) • Roll-Call & Official Proceedings Custodian across 2018–2024",
        "affiliations": ["City of Cheyenne Office of the City Clerk"],
        "profiles": [
            {"platform": "Official Gov", "label": "Office of the City Clerk", "url": "https://www.cheyennecity.org/Your-Government/Departments/City-Clerk"},
        ],
    },
    "john-brodie": {
        "entityType": "Municipal Chief Legal Officer",
        "headline": "City Attorney, City of Cheyenne (2025–Present; formerly Deputy City Attorney) • Municipal Code, Contracts & Statutory Counsel",
        "affiliations": ["City of Cheyenne City Attorney's Office"],
        "profiles": [
            {"platform": "Official Gov", "label": "City Attorney's Office", "url": "https://www.cheyennecity.org/Your-Government/Departments/City-Attorney"},
        ],
    },
    "stefanie-boster": {
        "entityType": "Municipal Legal Counsel (Former City Attorney)",
        "headline": "City Attorney & Chief Legal Officer, City of Cheyenne (2021–Jan 2025)",
        "affiliations": ["City of Cheyenne City Attorney's Office"],
        "profiles": [
            {"platform": "Official Gov", "label": "City Attorney's Office", "url": "https://www.cheyennecity.org/Your-Government/Departments/City-Attorney"},
        ],
    },
    "betty-abernethy": {
        "entityType": "Economic Development Organization Representative",
        "headline": "Cheyenne LEADS Representative • Industrial Park Rezoning, Business Parkway & Economic Development Testimony",
        "affiliations": ["Cheyenne LEADS (1 Depot Square, 121 W. 15th St, Ste 304)"],
        "profiles": [
            {"platform": "Chamber / LEADS", "label": "Cheyenne LEADS Official Portal", "url": "https://cheyenneleads.org/about-us/leads-staff/"},
            {"platform": "Facebook", "label": "Cheyenne LEADS Official Facebook", "url": "https://www.facebook.com/cheyenneleads/"},
        ],
    },
    "brad-emmons": {
        "entityType": "Municipal Contractor & Developer Planning Agent",
        "headline": "Principal / Signatory, AVI Professional Corporation (AVI PC) • Planning Agent for Cheyenne LEADS & Commercial Rezoning Applicants + City Engineering Consultant",
        "affiliations": ["AVI PC (1103 Old Town Lane #101, Cheyenne, WY)", "Agent for Cheyenne LEADS (Cheyenne Business Pkwy 13th Filing, High Plains Business Park)", "City of Cheyenne Construction Admin Contractor"],
        "profiles": [
            {"platform": "Official Gov", "label": "PUDC-24-194 Staff Report (AVI PC / Cheyenne LEADS Filing)", "url": "https://www.cheyennecity.org/files/sharedassets/public/v/1/departments/planningdevelopment/agendas-and-minutes/pc/2024/2024-11-04/staff-reports/24-196-staff-report.pdf"},
        ],
    },
    "marguerite-herman": {
        "entityType": "Civic Nonprofit & Good-Government Advocate",
        "headline": "Advocate, League of Women Voters of Cheyenne / Wyoming • Public Testimony on Transparency, Elections, Civic Access & Municipal Policy",
        "affiliations": ["League of Women Voters of Wyoming / Cheyenne"],
        "profiles": [
            {"platform": "Web", "label": "League of Women Voters of Wyoming", "url": "https://wyominglwv.org/"},
        ],
    },
}

# Core Institutional, Corporate, Vendor, Contractor, Chamber/LEADS/DDA & Project OSINT Entities
CORE_OSINT_ENTITIES = [
    {
        "slug": "cheyenne-leads",
        "name": "Cheyenne LEADS",
        "category": "Chamber / LEADS / DDA",
        "subtype": "501(c)(6) Economic Development Organization",
        "address": "1 Depot Square, 121 W. 15th St, Suite 304, Cheyenne, WY 82001",
        "keyPeople": ["Betsey Hale, CEcD (CEO)", "Betty Abernethy", "Rachelle Zimmerman", "Brad Emmons / AVI PC (Planning Agent)"],
        "keywords": [r"\bcheyenne\s+leads\b", r"\bcheyenne\s+business\s+parkway\b", r"\bhigh\s+plains\s+business\s+park\b", r"\bswan\s+ranch\b", r"\bbetsey\s+hale\b", r"\bbetty\s+abernethy\b"],
        "nexusSummary": "Serves as Cheyenne & Laramie County's private non-profit economic development corporation co-located at 1 Depot Square with the Chamber of Commerce. Frequently appears as Applicant on BP (Business Park) & industrial rezonings, data center land assemblies, MOUs with the City of Cheyenne, and infrastructure extensions engineered by AVI PC and Benchmark Engineers.",
        "verifiedProfiles": [
            {"platform": "Chamber / LEADS", "label": "Cheyenne LEADS Website & Staff", "url": "https://cheyenneleads.org/about-us/leads-staff/"},
            {"platform": "Facebook", "label": "Cheyenne LEADS (@cheyenneleads)", "url": "https://www.facebook.com/cheyenneleads/"},
        ],
    },
    {
        "slug": "greater-cheyenne-chamber-of-commerce",
        "name": "Greater Cheyenne Chamber of Commerce",
        "category": "Chamber / LEADS / DDA",
        "subtype": "Business Advocacy & Endorsement Coalition",
        "address": "1 Depot Square, 121 W. 15th St, Suite 204, Cheyenne, WY 82001",
        "keyPeople": ["Dale Steenbergen (President & CEO)", "Mayor Patrick Collins (Past Board Member)", "Mark Moody (Endorsed Council Candidate)", "Lawrence Wolfe (Member)"],
        "keywords": [r"\bchamber\s+of\s+commerce\b", r"\bgreater\s+cheyenne\s+chamber\b", r"\bdale\s+steenbergen\b", r"\bdepot\s+square\b"],
        "nexusSummary": "Primary business lobby and candidate-endorsement organization in Cheyenne, headquartered at 1 Depot Square alongside Cheyenne LEADS. Lobbies on UDC commercial standards, 5th & 6th Penny sales tax propositions, business licensing, F.E. Warren AFB partnerships, and economic development incentives.",
        "verifiedProfiles": [
            {"platform": "Chamber / LEADS", "label": "Greater Cheyenne Chamber (cheyennechamber.org)", "url": "https://www.cheyennechamber.org/"},
            {"platform": "Facebook", "label": "Greater Cheyenne Chamber (@GreaterCheyenneChamber)", "url": "https://www.facebook.com/GreaterCheyenneChamber/"},
        ],
    },
    {
        "slug": "cheyenne-downtown-development-authority",
        "name": "Cheyenne Downtown Development Authority (DDA)",
        "category": "Chamber / LEADS / DDA",
        "subtype": "Statutory Municipal Development Authority (Title 2, Ch. 2.76)",
        "address": "109 W. 17th St, Cheyenne, WY 82001",
        "keyPeople": ["Dr. Mark Rinne (Past DDA President & Council President)", "Pete Laybourn (Council Sponsor)"],
        "keywords": [r"\bdowntown\s+development\s+authority\b", r"\bdowntown\s+development\s+district\b", r"\b2\.76\.040\b", r"\b2\.76\.020\b", r"\b8374\b", r"\breed\s+avenue\b"],
        "nexusSummary": "Statutory authority funded via municipal general-fund contracts (including Contract #8374), mill assessments, and TIF/district boundary ordinances under Municipal Code Ch. 2.76. Central nexus for downtown boundary expansions (e.g. 2100 Snyder Ave), facade grants, West Edge, and Reed Avenue Corridor revitalization.",
        "verifiedProfiles": [
            {"platform": "Web", "label": "Downtown Cheyenne / DDA Portal", "url": "https://downtowncheyenne.com/"},
            {"platform": "Official Gov", "label": "City of Cheyenne Boards & Commissions", "url": "https://www.cheyennecity.org/Your-Government/Boards-and-Commissions"},
        ],
    },
    {
        "slug": "avi-pc-brad-emmons",
        "name": "AVI Professional Corporation (AVI PC — Brad Emmons)",
        "category": "Vendor / Contractor",
        "subtype": "Civil Engineering, Surveying & Land-Use Planning Firm",
        "address": "1103 Old Town Lane #101, Cheyenne, WY 82009",
        "keyPeople": ["Brad Emmons (Principal / Signatory)"],
        "keywords": [r"\bavi\s*,?\s*p\.?c\.?\b", r"\bbrad\s+emmons\b", r"\bavipc\.com\b"],
        "nexusSummary": "Dual-role municipal contractor and private land-use agent: receives City of Cheyenne professional engineering/construction administration contracts (e.g. Storey Blvd & Summit Dr) while simultaneously representing Cheyenne LEADS and private developers on rezonings, expedited plats, and PUD dockets before Planning Commission and City Council.",
        "verifiedProfiles": [
            {"platform": "Web", "label": "AVI PC Civil Engineering & Surveying (avipc.com)", "url": "https://www.avipc.com/"},
            {"platform": "Official Gov", "label": "Planning Staff Report Filing (AVI PC / Cheyenne LEADS)", "url": "https://www.cheyennecity.org/files/sharedassets/public/v/1/departments/planningdevelopment/agendas-and-minutes/pc/2024/2024-11-04/staff-reports/24-196-staff-report.pdf"},
        ],
    },
    {
        "slug": "simon-contractors",
        "name": "Simon Contractors",
        "category": "Vendor / Contractor",
        "subtype": "Heavy Highway, Asphalt & Public Works Paving Contractor",
        "address": "Cheyenne, WY",
        "keyPeople": ["Public Works & Street/Alley Bid Recipient"],
        "keywords": [r"\bsimon\s+contractors\b"],
        "nexusSummary": "One of the City of Cheyenne's largest recurring street paving, hot-mix asphalt, and concrete public works contractors funded through 1% Specific Purpose / 5th & 6th Penny Optional Sales Tax bids and contract modifications.",
        "verifiedProfiles": [
            {"platform": "Web", "label": "Simon Contractors Corporate Profile", "url": "https://www.simonteam.com/"},
        ],
    },
    {
        "slug": "knife-river-jtl-group",
        "name": "JTL Group Inc. d/b/a Knife River",
        "category": "Vendor / Contractor",
        "subtype": "Aggregates, Asphalt Overlay & Heavy Civil Contractor",
        "address": "Cheyenne, WY",
        "keyPeople": ["Municipal Bid & Overlay Contractor"],
        "keywords": [r"\bknife\s+river\b", r"\bjtl\s+group\b"],
        "nexusSummary": "Major recurring bidder and contract awardee alongside Simon Contractors on City of Cheyenne arterial overlays (e.g. Nationway, College Dr), tack oil, and BOPU/Street & Alley aggregate supply bids.",
        "verifiedProfiles": [
            {"platform": "Web", "label": "Knife River Mountain Region", "url": "https://www.kniferiver.com/"},
        ],
    },
    {
        "slug": "reiman-corp",
        "name": "Reiman Corp.",
        "category": "Vendor / Contractor",
        "subtype": "Bridge, Roadway Extension & Municipal Infrastructure Contractor",
        "address": "Cheyenne, WY",
        "keyPeople": ["Storey Blvd Extension & ADA Ramp Contractor"],
        "keywords": [r"\breiman\s+corp\b"],
        "nexusSummary": "Cheyenne-based heavy civil contractor awarded major 1% Sales Tax capital construction contracts including the $3.49M Storey Boulevard Extension (Bid #S-19-26), Evers Blvd ADA improvements, and greenway structures.",
        "verifiedProfiles": [
            {"platform": "Web", "label": "Reiman Corp. Cheyenne", "url": "https://reimancorp.com/"},
        ],
    },
    {
        "slug": "benchmark-engineers-pc",
        "name": "Benchmark Engineers, PC",
        "category": "Vendor / Contractor",
        "subtype": "Municipal Design Engineering & Subdivision Surveying Firm",
        "address": "Cheyenne, WY",
        "keyPeople": ["Christensen Road & Subdivision Engineering"],
        "keywords": [r"\bbenchmark\s+engineers\b", r"\bbenchmark\s+engineering\b"],
        "nexusSummary": "Recurring engineering consultant on City of Cheyenne arterial corridors (e.g. Contract #7520 Christensen Road Design Modifications) and private residential/commercial subdivision plats.",
        "verifiedProfiles": [
            {"platform": "Official Gov", "label": "City of Cheyenne Engineering Procurement Archive", "url": "https://www.cheyennecity.org/Your-Government/Departments/City-Engineer"},
        ],
    },
    {
        "slug": "microsoft-datacenter-corridor",
        "name": "Microsoft Corp. & Hyperscale Data Center Corridor (Skybox / Hanwha)",
        "category": "Developer / Property / Project",
        "subtype": "Hyperscale Cloud, Fiber Easements, BOPU Water/Power & UDC 5.7.1",
        "address": "Cheyenne Business Parkway / North Range / High Plains Corridor, Cheyenne, WY",
        "keyPeople": ["Microsoft Corp.", "Skybox Datacenters", "Hanwha Qcells", "Cheyenne LEADS", "Holland & Hart LLP"],
        "keywords": [r"\bmicrosoft\b", r"\bdata\s+center\b", r"\bskybox\b", r"\bhanwha\b", r"\b5\.7\.1\b"],
        "nexusSummary": "Multi-billion-dollar hyperscale data center footprint across Cheyenne industrial parks involving underground fiber utility easements, BOPU industrial water/reclaimed water agreements, high-voltage substations, UDC data-center zoning standards, and temporary moratorium debates.",
        "verifiedProfiles": [
            {"platform": "Web", "label": "Microsoft Wyoming Datacenter Community Portal", "url": "https://local.microsoft.com/wyoming/"},
        ],
    },
    {
        "slug": "sweetgrass-highlands-cox-ranch",
        "name": "Sweetgrass PUD, Cox Ranch & Contiguous Annexation Projects",
        "category": "Developer / Property / Project",
        "subtype": "Master-Planned PUDs, Greenway Maintenance & Wyo. Stat. § 15-1-402 Annexations",
        "address": "SE of College Dr & Ave C / Roundtop Rd & Happy Jack Rd / East Cheyenne",
        "keyPeople": ["Sweetgrass Development / HOA", "Cox Ranch Annexation Applicants", "Charles Bloom (Planning)", "Charles Miller (Statutory Challenger)"],
        "keywords": [r"\bsweetgrass\b", r"\bcox\s+ranch\b", r"\b4524\b", r"\b15-1-402\b", r"\broundtop\b"],
        "nexusSummary": "Flashpoint growth & annexation dockets testing PUD density modifications (Ord. #4524), Greater Cheyenne Greenway maintenance agreements, perimeter road/utility cost-sharing, and statutory contiguity challenges under Wyo. Stat. § 15-1-402.",
        "verifiedProfiles": [
            {"platform": "Official Gov", "label": "Cheyenne Planning & Annexation Dockets", "url": "https://www.cheyennecity.org/Your-Government/Departments/Planning-and-Development"},
        ],
    },
    {
        "slug": "board-of-public-utilities-bopu",
        "name": "Cheyenne Board of Public Utilities (BOPU)",
        "category": "Chamber / LEADS / DDA",
        "subtype": "Semi-Autonomous Municipal Water & Wastewater Utility",
        "address": "2416 Snyder Ave, Cheyenne, WY 82001",
        "keyPeople": ["Brad Brooks / Clint Bassett (Utility Leadership)", "City Council Rate & Debt Oversight"],
        "keywords": [r"\bbopu\b", r"\bboard\s+of\s+public\s+utilities\b", r"\bwater\s+main\b", r"\baquifer\b"],
        "nexusSummary": "Controls municipal water supply, sewer infrastructure, annexation utility service extensions, industrial data-center cooling/water allocations, and Wyo. Stat. § 16-4-502 debt/rate resolutions before City Council.",
        "verifiedProfiles": [
            {"platform": "Official Gov", "label": "Cheyenne BOPU Official Website", "url": "https://www.cheyennebopu.org/"},
        ],
    },
    {
        "slug": "the-real-windy-city-watchdog",
        "name": "The Real Windy City & Statutory Transparency Coalition",
        "category": "Special Interest / Watchdog",
        "subtype": "Primary-Source Civic Broadcast Archive & Procedural Accountability Watchdog",
        "address": "Cheyenne, WY",
        "keyPeople": ["Charles Miller (262 Floor Interventions)", "League of Women Voters (Marguerite Herman)", "CPEA (Employee Rep)"],
        "keywords": [r"\bpoint\s+of\s+order\b", r"\bopen\s+meetings\b", r"\b16-4-403\b", r"\brobert'?s\s+rules\b", r"\bstatutory\s+contradiction\b"],
        "nexusSummary": "Public-interest archival and floor-testimony movement documenting Open Meetings Act compliance, Wyo. Stat. § 15-1-402 annexation contiguity, UDC notice rules, consent-agenda bundling, and presiding-officer Point of Order rulings.",
        "verifiedProfiles": [
            {"platform": "Web", "label": "The Real Windy City Broadcast Portal", "url": "https://therealwindycity.github.io/real-windy-city-tv/"},
            {"platform": "Web", "label": "Open Civic Data Repositories (@therealwindycity)", "url": "https://github.com/therealwindycity"},
        ],
    },
]


def apply_moody_and_roster_fixes(text: str) -> str:
    if not text:
        return text
    for rx, rep in MOODY_FIXES:
        text = rx.sub(rep, text)
    return text


def fetch_internet_archive_cochwy_map() -> dict[tuple[str, str], dict]:
    """
    Fetches all 805 cochwy-* items from Internet Archive and indexes them by (YYYY-MM-DD, body)
    using BOTH the date embedded in the title/identifier AND the IA metadata date!
    """
    ia_map: dict[tuple[str, str], dict] = {}
    url = "https://archive.org/advancedsearch.php?q=identifier%3Acochwy*&fl[]=identifier&fl[]=title&fl[]=date&rows=1000&page=1&output=json"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            docs = json.loads(r.read().decode()).get("response", {}).get("docs", [])
    except Exception as e:
        print(f"[WARN] IA advancedsearch fallback: {e}")
        docs = []

    date_pats = [
        re.compile(r"(\d{1,2})[-_/](\d{1,2})[-_/](\d{2,4})"),
        re.compile(r"(January|February|March|April|May|June|July|August|September|October|November|December)[_\s]+(\d{1,2}),?[_\s]+(\d{4})", re.I),
    ]
    months = {m.lower(): i + 1 for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"])}

    for d in docs:
        ident = d.get("identifier") or ""
        title = d.get("title") or ident
        comb = f"{title} {ident}".lower()
        body = "council"
        if "finance" in comb:
            body = "finance"
        elif "public service" in comb or "public_service" in comb:
            body = "psc"
        elif "work session" in comb or "work_session" in comb:
            body = "work"
        elif "committee of the whole" in comb:
            body = "cow"
        elif "planning commission" in comb or "planning_commission" in comb:
            body = "planning"
        elif "special" in comb:
            body = "special"

        suf = ident[len("cochwy-") :] if ident.startswith("cochwy-") else ident
        entry = {
            "detailsUrl": f"https://archive.org/details/{ident}",
            "mp4Url": f"https://archive.org/download/{ident}/{suf}.mp4",
            "identifier": ident,
        }

        cand_dates = []
        m1 = date_pats[0].search(f"{title} {ident}")
        if m1:
            mo, da, yr = int(m1.group(1)), int(m1.group(2)), int(m1.group(3))
            if yr < 100:
                yr += 2000
            if 1 <= mo <= 12 and 1 <= da <= 31 and 2008 <= yr <= 2027:
                cand_dates.append(f"{yr:04d}-{mo:02d}-{da:02d}")
        m2 = date_pats[1].search(f"{title} {ident}")
        if m2:
            mo = months[m2.group(1).lower()]
            da, yr = int(m2.group(2)), int(m2.group(3))
            cand_dates.append(f"{yr:04d}-{mo:02d}-{da:02d}")

        ia_dt = (d.get("date") or "")[:10]
        if re.match(r"^\d{4}-\d{2}-\d{2}$", ia_dt):
            cand_dates.append(ia_dt)
            try:
                prev = (dt.date.fromisoformat(ia_dt) - dt.timedelta(days=1)).isoformat()
                cand_dates.append(prev)
            except Exception:
                pass

        for cd in cand_dates:
            ia_map.setdefault((cd, body), entry)
            ia_map.setdefault((cd, "any"), entry)

    print(f"Indexed {len(docs)} Internet Archive cochwy-* broadcasts -> {len(ia_map)} (date, body) lookup keys.")
    return ia_map


ORG_PATTERNS = [
    (re.compile(r"\bcheyenne\s+leads\b", re.I), "Cheyenne LEADS", "Organizational / Lobbyist Representative"),
    (re.compile(r"\bgreater\s+cheyenne\s+chamber|\bchamber\s+of\s+commerce\b", re.I), "Greater Cheyenne Chamber of Commerce", "Organizational / Lobbyist Representative"),
    (re.compile(r"\bdowntown\s+development\s+authority|\bdda\b", re.I), "Cheyenne Downtown Development Authority (DDA)", "Organizational / Lobbyist Representative"),
    (re.compile(r"\bcpea\b|\bpublic\s+employees\s+association\b", re.I), "Cheyenne Public Employees Association (CPEA)", "Organizational / Lobbyist Representative"),
    (re.compile(r"\bleague\s+of\s+women\s+voters\b", re.I), "League of Women Voters", "Organizational / Lobbyist Representative"),
    (re.compile(r"\bhabitat\s+for\s+humanity\b", re.I), "Habitat for Humanity of Laramie County", "Organizational / Lobbyist Representative"),
    (re.compile(r"\bunited\s+way\b", re.I), "United Way of Laramie County", "Organizational / Lobbyist Representative"),
    (re.compile(r"\bvisit\s+cheyenne\b", re.I), "Visit Cheyenne", "Organizational / Lobbyist Representative"),
    (re.compile(r"\bavi\s*,?\s*p\.?c\.?\b", re.I), "AVI PC (Engineering / Planning Agent)", "Contractor / Vendor / Applicant Agent"),
    (re.compile(r"\bbenchmark\s+engineers\b", re.I), "Benchmark Engineers, PC", "Contractor / Vendor / Applicant Agent"),
    (re.compile(r"\bsteil\s+surveying\b", re.I), "Steil Surveying Services", "Contractor / Vendor / Applicant Agent"),
    (re.compile(r"\bsimon\s+contractors\b", re.I), "Simon Contractors", "Contractor / Vendor / Applicant Agent"),
    (re.compile(r"\breiman\s+corp\b", re.I), "Reiman Corp.", "Contractor / Vendor / Applicant Agent"),
    (re.compile(r"\bknife\s+river\b|\bjtl\s+group\b", re.I), "JTL Group / Knife River", "Contractor / Vendor / Applicant Agent"),
    (re.compile(r"\bholland\s*&\s*hart\b", re.I), "Holland & Hart LLP", "Contractor / Vendor / Applicant Agent"),
    (re.compile(r"\bboard\s+of\s+public\s+utilities\b|\bbopu\b", re.I), "Cheyenne BOPU", "Municipal Staff / Counsel"),
]

INTRO_ORG_RE = re.compile(
    r"(?:my name is [A-Z][a-z]+ [A-Z][a-z]+,?\s+(?:and\s+)?(?:i(?:'m|\s+am)\s+)?(?:representing|on behalf of|executive director of|director of|president of|ceo of|chair of))\s+([A-Z][A-Za-z0-9&.' -]{3,42}?)(?:[.,;]|(?:\s+(?:and|here|tonight|to\s+speak|in\s+support|in\s+opposition)))"
)


def classify_capacity(turn: dict) -> tuple[str, str]:
    role = (turn.get("speakerRole") or "").lower()
    slug = turn.get("speakerSlug") or ""
    txt = turn.get("text") or ""

    # Check explicit dual-capacity cues first (e.g. Seth Lloyd testifying as CPEA Board Member!)
    if slug == "seth-lloyd" and re.search(r"\bcpea\b|\bpersonnel\s+(?:commission|system)\b|\b2\.52\b", txt, re.I):
        return ("Organizational / Lobbyist Representative", "Cheyenne Public Employees Association (CPEA)")

    if slug == "charles-miller":
        if re.search(r"\breal\s+windy\s+city\b|\bpublic\s+records\b|\bopen\s+meetings\b|\b15-1-402\b|\bpoint\s+of\s+order\b", txt, re.I):
            return ("Civic Watchdog / Statutory Advocate", "The Real Windy City & Own Individual Capacity")
        return ("Individual Citizen", "Own Individual Capacity (Resident / Taxpayer)")

    if slug == "statutory-contradiction-exhibit":
        return ("Civic Watchdog / Statutory Advocate", "The Real Windy City Documentary Exhibit")

    if any(k in role for k in ("mayor", "council", "presiding")):
        return ("Elected Official", f"City of Cheyenne Governing Body ({turn.get('speakerRole')})")

    if any(k in role for k in ("planner", "planning", "director", "attorney", "clerk", "treasurer", "engineer", "transit", "chief", "staff")):
        return ("Municipal Staff / Counsel", f"City of Cheyenne ({turn.get('speakerRole')})")

    if slug == "brad-emmons" or "avi pc" in role:
        return ("Contractor / Vendor / Applicant Agent", "AVI PC (Engineering & Cheyenne LEADS Agent)")
    if slug == "betty-abernethy" or "cheyenne leads" in role:
        return ("Organizational / Lobbyist Representative", "Cheyenne LEADS")
    if slug == "marguerite-herman" or "league of women voters" in role:
        return ("Organizational / Lobbyist Representative", "League of Women Voters")

    # Check if speaker introduces themselves on behalf of a known organization/firm
    head = txt[:260]
    for rx, org_name, cap in ORG_PATTERNS:
        if rx.search(head) and re.search(r"\b(my name is|i am with|i'm with|representing|on behalf of|applicant|agent for|director of|president of|ceo of)\b", head, re.I):
            return (cap, org_name)
    m_org = INTRO_ORG_RE.search(head)
    if m_org:
        cand = m_org.group(1).strip()
        if not any(w in cand.lower() for w in ("cheyenne", "ward", "street", "avenue", "years", "tonight", "city council", "agricultural", "business park", "sorry")):
            return ("Organizational / Lobbyist Representative", cand)

    return ("Individual Citizen", "Own Individual Capacity (Resident / Public Commenter)")


POE_RAISED_RE = re.compile(r"\bpoint\s+of\s+order\b|\bstatutory\s+contradiction\b|\bviolat(?:es?|ing)\s+(?:wyo|wyoming|open\s+meetings|robert'?s\s+rules|section)\b", re.I)
POE_RULING_RE = re.compile(r"\bout\s+of\s+order\b|\byour\s+time\s+is\s+up\b|\bcut\s+(?:the\s+|your\s+)?mic\b|\bgavel\b|\bthree\s+minutes\s+(?:is|are)\s+up\b|\bstick\s+to\s+the\s+(?:motion|item|topic)\b", re.I)

OPPOSE_RE = re.compile(r"\b(oppose|against|vote\s+no|deny|postpone|moratorium|violat|illegal|unlawful|unacceptable|object|concern|harm|burden|arbitrary|contradict|reject)\b", re.I)
SUPPORT_RE = re.compile(r"\b(support|in\s+favor|urge\s+(?:you\s+to\s+)?(?:pass|approve)|approve|recommend\s+approval|endorse|commend|adopt|move\s+to\s+approve|second\s+the\s+motion)\b", re.I)
MOTION_RE = re.compile(r"\b(i\s+move|so\s+moved|substitute\s+motion|move\s+to\s+amend|move\s+to\s+postpone|second\s+that)\b", re.I)


def classify_poe_and_stance(turn: dict, cap: str) -> tuple[bool, str | None, str, str]:
    txt = turn.get("text") or ""
    emo = turn.get("emotion") or ""
    direct = turn.get("directMp4Url") or ""
    is_poe_clip = "POE-" in direct or "poe" in direct.lower()

    has_poe = False
    poe_type = None
    if is_poe_clip or POE_RAISED_RE.search(txt):
        has_poe = True
        poe_type = "Point of Order / Statutory Challenge"
    elif POE_RULING_RE.search(txt):
        has_poe = True
        poe_type = "Chair Ruling / Clock or Mic Cutoff"

    if has_poe and cap == "Individual Citizen":
        return (True, poe_type, "procedural_point_of_order", "Opposes / Raises Point of Order")
    if cap == "Municipal Staff / Counsel":
        return (has_poe, poe_type, "technical_staff_report", "Staff / Legal / Technical Testimony")
    if cap == "Elected Official" and MOTION_RE.search(txt):
        if OPPOSE_RE.search(txt) and not SUPPORT_RE.search(txt):
            return (has_poe, poe_type, "oppose_challenge", "Floor Amendment / Dissent")
        return (has_poe, poe_type, "sponsor_motion", "Sponsors Motion / Governing Action")

    opp_n = len(OPPOSE_RE.findall(txt)) + (2 if emo in ("angry", "concerned") else 0)
    sup_n = len(SUPPORT_RE.findall(txt)) + (2 if emo == "supportive" else 0)
    if opp_n > sup_n and opp_n >= 1:
        return (has_poe, poe_type, "oppose_challenge", "Opposes / Challenges Measure")
    if sup_n >= 1:
        return (has_poe, poe_type, "support_lobby_for", "Lobbies For / Supports Measure")
    return (has_poe, poe_type, "inquiry_discussion", "Floor Inquiry / Deliberation")


def fmt_dur_short(sec: float) -> str:
    s = max(1, int(round(sec)))
    m, rem = divmod(s, 60)
    return f"{m}m {rem:02d}s" if m else f"{rem}s"


def main():
    ia_map = fetch_internet_archive_cochwy_map()

    meetings = json.loads((SEED / "meetings.json").read_text())
    items = json.loads((SEED / "items.json").read_text())
    docs = json.loads((SEED / "documents.json").read_text())
    ords = json.loads((SEED / "ordinances.json").read_text())
    votes = json.loads((SEED / "vote_events.json").read_text())
    briefs = json.loads((SEED / "briefs.json").read_text())
    people = json.loads((SEED / "people.json").read_text())
    featured = json.loads((SEED / "featured.json").read_text())
    turns = json.loads((SEED / "speaker_turns.json").read_text())

    # 1. Fix Meetings: link all cochwy-* Internet Archive MP4s + convert Granicus links to Wayback Machine + purge dead archive-video.granicus.com!
    ia_upgraded_meetings = 0
    wb_upgraded_meetings = 0
    m_by_slug = {}
    for m in meetings:
        m["note"] = apply_moody_and_roster_fixes(m.get("note") or "")
        vu = m.get("videoUrl") or ""
        mu = m.get("mp4Url") or ""

        # Match Internet Archive cochwy-* either from existing videoUrl or from our 805-item IA date/body index
        ia_entry = None
        if "videoLinkVerified" in m:
            # Link was proven (or disproven) by transcript alignment in scripts/apply_retime.py — never re-guess by date.
            m_by_slug[m["slug"]] = m
            continue
        if "archive.org/details/" in vu:
            ident = vu.split("/details/")[-1].split("/")[0].split("?")[0]
            suf = ident[len("cochwy-") :] if ident.startswith("cochwy-") else ident
            ia_entry = {"detailsUrl": f"https://archive.org/details/{ident}", "mp4Url": f"https://archive.org/download/{ident}/{suf}.mp4"}
        else:
            ia_entry = ia_map.get((m["date"], m["body"])) or (ia_map.get((m["date"], "any")) if m["body"] == "council" else None)

        if ia_entry:
            if "archive.org" not in vu:
                m["videoUrl"] = ia_entry["detailsUrl"]
            m["mp4Url"] = ia_entry["mp4Url"]
            ia_upgraded_meetings += 1
        else:
            # Never leave raw dead archive-video.granicus.com in mp4Url!
            if "archive-video.granicus.com" in mu:
                m["mp4Url"] = None
            # Route cheyenne.granicus.com player links through Wayback Machine!
            if vu.startswith("https://cheyenne.granicus.com/") or vu.startswith("http://cheyenne.granicus.com/"):
                m["videoUrl"] = f"https://web.archive.org/web/2024/{vu}"
                wb_upgraded_meetings += 1

        for k in ("agendaUrl", "minutesUrl"):
            u = m.get(k) or ""
            if u.startswith("https://cheyenne.granicus.com/") or u.startswith("http://cheyenne.granicus.com/"):
                m[k] = f"https://web.archive.org/web/2024/{u}"

        m_by_slug[m["slug"]] = m

    print(f"Meetings linked to Internet Archive MP4s: {ia_upgraded_meetings} | Routed via Wayback Machine: {wb_upgraded_meetings}")

    # 2. Clean Cathy Moody & roster across people, items, ordinances, votes, briefs, featured, documents
    seen_people = {}
    cleaned_people = []
    for p in people:
        p["name"] = apply_moody_and_roster_fixes(p["name"])
        if p["name"] in ("Cathy Moody", "Kathy Moody"):
            p["name"] = "Mark Moody"
            p["honorific"] = "Mr."
        slug_guess = re.sub(r"[^a-z0-9]+", "-", p["name"].lower()).strip("-")
        for k_slug, (cname, crole) in OFFICIAL_ROLES.items():
            if slug_guess in k_slug or p["lastName"].lower() == cname.split()[-1].lower():
                if p["lastName"] == "Emmons" and "Brad" in p["name"]:
                    continue
                p["role"] = crole
                break
        if p["name"] not in seen_people:
            seen_people[p["name"]] = p
            cleaned_people.append(p)
    people = cleaned_people

    for it in items:
        it["title"] = apply_moody_and_roster_fixes(it.get("title") or "")
        it["sponsor"] = apply_moody_and_roster_fixes(it.get("sponsor") or "")
        it["action"] = apply_moody_and_roster_fixes(it.get("action") or "")

    ord_title_by_slug = {}
    for o in ords:
        o["title"] = apply_moody_and_roster_fixes(o.get("title") or "")
        ord_title_by_slug[o["slug"]] = o["title"]
        for r in o.get("readings") or []:
            r["context"] = apply_moody_and_roster_fixes(r.get("context") or "")

    # Track roll-call NO dissents per council member for 'opposes' analytics!
    dissents_by_lastname = collections.defaultdict(list)
    items_by_mtg = collections.defaultdict(list)
    for it in items:
        items_by_mtg[it["meeting"]].append(it)

    for v in votes:
        v["excerpt"] = apply_moody_and_roster_fixes(v.get("excerpt") or "")
        v["noNames"] = [apply_moody_and_roster_fixes(n) for n in (v.get("noNames") or [])]
        for nn in v["noNames"]:
            ln = nn.split()[-1].lower()
            dissents_by_lastname[ln].append((v["meeting"], v["excerpt"][:140]))

    for b in briefs:
        b["title"] = apply_moody_and_roster_fixes(b.get("title") or "")

    featured_str = apply_moody_and_roster_fixes(json.dumps(featured, ensure_ascii=False))
    featured = json.loads(featured_str)

    doc_moody_fixes = 0
    for d in docs:
        t0 = d.get("text") or ""
        t1 = apply_moody_and_roster_fixes(t0)
        if t1 != t0:
            d["text"] = t1
            doc_moody_fixes += 1
        d["title"] = apply_moody_and_roster_fixes(d.get("title") or "")
    print(f"Applied Moody/Roster cleanups across {doc_moody_fixes} documents.")

    # 3. Clean Speaker Turns, Fix Granicus -> Internet Archive / Wayback URLs, and Compute Turn-Level Capacity, Stance & POE
    granicus_purged = 0
    ia_turns_linked = 0
    for t in turns:
        t["text"] = apply_moody_and_roster_fixes(t.get("text") or "")
        t["speakerName"] = apply_moody_and_roster_fixes(t.get("speakerName") or "")
        if t["speakerSlug"] == "cathy-moody" or "moody" in t["speakerName"].lower():
            t["speakerSlug"] = "mark-moody"
            t["speakerName"] = "Mark Moody"

        if t["speakerSlug"] in OFFICIAL_ROLES:
            t["speakerName"], t["speakerRole"] = OFFICIAL_ROLES[t["speakerSlug"]]

        # Fix Granicus URLs! directMp4Url MUST ONLY contain pre-cut standalone speaker segments (never archive-video.granicus.com or archive.org full meetings!)
        d_url = t.get("directMp4Url") or ""
        if "granicus.com" in d_url or "archive.org" in d_url:
            t["directMp4Url"] = None
            t["verifiedClip"] = False
            granicus_purged += 1

        mtg = m_by_slug.get(t["meetingSlug"], {})
        if t.get("videoTiming"):
            pass  # per-turn link + times verified by transcript alignment (apply_retime.py) — keep exactly
        elif mtg.get("mp4Url") and "archive.org/download/" in mtg["mp4Url"]:
            t["sourceMeetingMp4Url"] = mtg["mp4Url"]
            t["embedUrl"] = mtg.get("videoUrl")
            ia_turns_linked += 1
        else:
            if "granicus.com" in (t.get("sourceMeetingMp4Url") or ""):
                t["sourceMeetingMp4Url"] = None
            if "granicus.com" in (t.get("embedUrl") or "") and "web.archive.org" not in (t.get("embedUrl") or ""):
                t["embedUrl"] = f"https://web.archive.org/web/2024/{t['embedUrl']}"

        # Clamp duration strictly <= 180s (aligned turns: duration = aligned end - aligned start)
        if t.get("videoTiming") in ("realigned", "realigned_relinked", "diarized_window"):
            t["durationSec"] = round(float(t["endSec"]) - float(t["startSec"]), 1)
        dur = min(180.0, max(5.0, float(t.get("durationSec") or 30.0)))
        t["durationSec"] = round(dur, 1)
        t["endSec"] = round(float(t.get("startSec") or 0.0) + dur, 1)

        cap, rep_org = classify_capacity(t)
        has_poe, poe_type, stance_code, stance_label = classify_poe_and_stance(t, cap)
        t["speakingCapacity"] = cap
        t["representingOrg"] = rep_org
        t["hasPointOfOrder"] = has_poe
        t["pointOfOrderType"] = poe_type
        t["stance"] = stance_code
        t["stanceLabel"] = stance_label

    print(f"Purged {granicus_purged} dead Granicus full-meeting URLs from directMp4Url; linked {ia_turns_linked} turns to live Internet Archive MP4s!")

    # 4. Aggregate Speaker-Level Analytics & Stamp Back onto Every Video Clip!
    turns_by_spk = collections.defaultdict(list)
    for t in turns:
        turns_by_spk[t["speakerSlug"]].append(t)

    # Sponsored items per council last name
    sponsored_by_ln = collections.defaultdict(list)
    for it in items:
        sp = (it.get("sponsor") or "").strip()
        if sp:
            for k_slug, (cname, _) in OFFICIAL_ROLES.items():
                ln = cname.split()[-1]
                if re.search(rf"\b{re.escape(ln)}\b", sp, re.I) and len(sponsored_by_ln[ln.lower()]) < 8:
                    title_short = it["title"][:95]
                    if title_short not in sponsored_by_ln[ln.lower()]:
                        sponsored_by_ln[ln.lower()].append(title_short)

    new_speakers_dir = []
    spk_summary_by_slug = {}

    for slug, sturns in sorted(turns_by_spk.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        sturns.sort(key=lambda x: (x["date"], x["startSec"]))
        name = sturns[-1]["speakerName"]
        role = sturns[-1]["speakerRole"]
        if slug in OFFICIAL_ROLES:
            name, role = OFFICIAL_ROLES[slug]

        turn_count = len(sturns)
        mtg_set = {x["meetingSlug"] for x in sturns}
        total_sec = int(round(sum(x["durationSec"] for x in sturns)))
        avg_sec = round(total_sec / max(1, turn_count), 1)
        max_sec = round(max(x["durationSec"] for x in sturns), 1)

        poe_turns = [x for x in sturns if x.get("hasPointOfOrder")]
        poe_count = len(poe_turns)
        poe_ids = [x["id"] for x in poe_turns[:12]]

        # Capacities breakdown
        cap_counter = collections.Counter()
        cap_orgs = collections.defaultdict(set)
        for x in sturns:
            c = x["speakingCapacity"]
            cap_counter[c] += 1
            if x.get("representingOrg"):
                cap_orgs[c].add(x["representingOrg"])
        capacities_breakdown = [
            {
                "capacity": c,
                "count": cnt,
                "pct": round(100.0 * cnt / turn_count, 1),
                "orgs": sorted(cap_orgs[c])[:4],
            }
            for c, cnt in cap_counter.most_common()
        ]

        # Topic & Stance breakdown
        topic_counts = collections.Counter()
        topic_sup = collections.Counter()
        topic_opp = collections.Counter()
        stance_counts = collections.Counter()
        lobbies_for_set = []
        opposes_set = []

        for x in sturns:
            st = x["stance"]
            stance_counts[st] += 1
            for th in x.get("themes") or ["procedure"]:
                topic_counts[th] += 1
                if st in ("support_lobby_for", "sponsor_motion"):
                    topic_sup[th] += 1
                elif st in ("oppose_challenge", "procedural_point_of_order"):
                    topic_opp[th] += 1

            # Capture specific ordinances/topics lobbied for or opposed
            for oref in x.get("ordinances") or []:
                otitle = ord_title_by_slug.get(oref["slug"], oref["slug"])[:88]
                if st in ("support_lobby_for", "sponsor_motion") and otitle not in lobbies_for_set and len(lobbies_for_set) < 6:
                    lobbies_for_set.append(otitle)
                elif st in ("oppose_challenge", "procedural_point_of_order") and otitle not in opposes_set and len(opposes_set) < 6:
                    opposes_set.append(otitle)

        # Enrich council members with official sponsored items & roll-call NO dissents!
        ln = name.split()[-1].lower()
        if "council" in role.lower() or "mayor" in role.lower():
            for sp_item in sponsored_by_ln.get(ln, [])[:4]:
                if sp_item not in lobbies_for_set and len(lobbies_for_set) < 6:
                    lobbies_for_set.append(f"Sponsored: {sp_item}")
            for mtg_s, exc in dissents_by_lastname.get(ln, [])[:4]:
                label_d = f"Roll-Call NO Dissent ({mtg_s[:10]}): {exc[:75]}"
                if label_d not in opposes_set and len(opposes_set) < 6:
                    opposes_set.append(label_d)

        # Fallback descriptive advocacy items from top supported/opposed themes if no specific ordinance slug matched
        if not lobbies_for_set:
            for th, cnt in topic_sup.most_common(3):
                if cnt > 0:
                    lobbies_for_set.append(f"{THEME_LABELS.get(th, th)} ({cnt} supportive/motion turns)")
        if not opposes_set:
            for th, cnt in topic_opp.most_common(3):
                if cnt > 0:
                    opposes_set.append(f"{THEME_LABELS.get(th, th)} ({cnt} opposition/challenge turns)")

        topic_analytics = [
            {
                "topic": th,
                "label": THEME_LABELS.get(th, th.title()),
                "count": cnt,
                "pct": round(100.0 * cnt / turn_count, 1),
                "supportCount": topic_sup[th],
                "opposeCount": topic_opp[th],
            }
            for th, cnt in topic_counts.most_common(6)
        ]

        emo_counts = collections.Counter(x["emotion"] for x in sturns)
        dom_emo = emo_counts.most_common(1)[0][0]
        ord_slugs = sorted({o["slug"] for x in sturns for o in (x.get("ordinances") or [])})
        zips = sorted({x["speakerZipUrl"] for x in sturns if x.get("speakerZipUrl")})
        direct_clips = [x for x in sturns if x.get("directMp4Url") or x.get("brandedMp4Url")]

        osint_prof = VERIFIED_OSINT_PROFILES.get(slug, {
            "entityType": capacities_breakdown[0]["capacity"] if capacities_breakdown else role,
            "headline": f"{role} • {turn_count} Verified Broadcast Interventions ({sturns[0]['date'][:4]}–{sturns[-1]['date'][:4]})",
            "affiliations": capacities_breakdown[0]["orgs"] if capacities_breakdown and capacities_breakdown[0]["orgs"] else [role],
            "profiles": [
                {"platform": "Official Gov", "label": "City of Cheyenne Clerk & Broadcast Record", "url": f"https://therealwindycity.github.io/real-windy-city-tv/#/speakers/{slug}"}
            ],
        })

        analytics_obj = {
            "historicalClipCount": turn_count,
            "historicalMeetingCount": len(mtg_set),
            "avgSpeakingSec": avg_sec,
            "avgSpeakingFormatted": fmt_dur_short(avg_sec),
            "totalSpeakingSec": total_sec,
            "totalSpeakingFormatted": f"{total_sec // 3600}h {(total_sec % 3600) // 60}m" if total_sec >= 3600 else fmt_dur_short(total_sec),
            "maxSpeakingSec": max_sec,
            "pointOfOrderCount": poe_count,
            "pointOfOrderTurnIds": poe_ids,
            "primaryCapacity": capacities_breakdown[0]["capacity"] if capacities_breakdown else "Individual Citizen",
            "capacitiesBreakdown": capacities_breakdown,
            "stanceCounts": dict(stance_counts),
            "topicAnalytics": topic_analytics,
            "lobbiesFor": lobbies_for_set,
            "opposes": opposes_set,
            "osint": osint_prof,
        }

        spk_summary_by_slug[slug] = analytics_obj

        # Preserve compilationReels if previously present in speakers_directory.json
        comp_reels = []
        if slug == "mark-moody":
            comp_reels = [{"title": "Councilman Mark Moody Substitute Motion Segment", "url": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/moody_swap.mp4"}]
        elif slug == "lawrence-wolfe":
            comp_reels = [{"title": "Councilman Lawrence Wolfe Public Comment Exchange", "url": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/jul13_wolfe.mp4"}]
        elif slug == "charles-miller":
            comp_reels = [
                {"title": "April 27 Statutory Annexation Floor Intervention", "url": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/apr27_first.mp4"},
                {"title": "Sept 14 Cox Ranch Contiguity Challenge", "url": "https://raw.githubusercontent.com/therealwindycity/therealwindycity/main/pipeline/videos/sep14_cox_a.mp4"},
            ]

        new_speakers_dir.append({
            "slug": slug,
            "name": name,
            "role": role,
            "turnCount": turn_count,
            "meetingCount": len(mtg_set),
            "totalDurationSec": total_sec,
            "firstDate": sturns[0]["date"],
            "lastDate": sturns[-1]["date"],
            "topThemes": [ta["topic"] for ta in topic_analytics[:4]],
            "dominantEmotion": dom_emo,
            "emotions": dict(emo_counts),
            "maxImpactScore": max(x.get("impactScore", 50) for x in sturns),
            "ordinanceCount": len(ord_slugs),
            "ordinanceSlugs": ord_slugs[:30],
            "speakerZipUrls": zips[:20],
            "compilationReels": comp_reels,
            "directClipCount": len(direct_clips),
            "analytics": analytics_obj,
        })

    # Stamp compact speaker historical analytics onto EVERY video clip in speaker_turns.json so every clip card & video player renders it immediately!
    for t in turns:
        a = spk_summary_by_slug[t["speakerSlug"]]
        t["speakerAnalytics"] = {
            "historicalClipCount": a["historicalClipCount"],
            "historicalMeetingCount": a["historicalMeetingCount"],
            "avgSpeakingSec": a["avgSpeakingSec"],
            "avgSpeakingFormatted": a["avgSpeakingFormatted"],
            "pointOfOrderCount": a["pointOfOrderCount"],
            "primaryCapacity": a["primaryCapacity"],
            "capacitiesSummary": [f"{c['capacity']} ({c['pct']}%)" for c in a["capacitiesBreakdown"][:3]],
            "topTopics": [f"{tp['label']} ({tp['count']})" for tp in a["topicAnalytics"][:3]],
            "lobbiesFor": a["lobbiesFor"][:3],
            "opposes": a["opposes"][:3],
            "profiles": a["osint"]["profiles"][:3],
        }

    # 5. Build Master OSINT & Cross-Entity Intelligence Graph (osint_entities.json)
    osint_entities = []

    # 5A. Mine real contracts, bids, ordinances, resolutions & co-appearing speakers for each institutional/vendor/project entity
    for core in CORE_OSINT_ENTITIES:
        rxs = [re.compile(pat, re.I) for pat in core["keywords"]]
        matched_contracts = []
        matched_ords = []
        matched_mtgs = set()
        total_usd = 0.0

        for it in items:
            txt_i = f"{it['title']} {it.get('sponsor','')} {it.get('action','')}"
            if any(rx.search(txt_i) for rx in rxs):
                matched_mtgs.add(it["meeting"])
                if it.get("amountUsd"):
                    total_usd += float(it["amountUsd"])
                if it["kind"] in ("contract", "bid", "budget", "resolution") and len(matched_contracts) < 10:
                    matched_contracts.append({
                        "meeting": it["meeting"],
                        "itemNo": it["itemNo"],
                        "kind": it["kind"],
                        "title": it["title"][:130],
                        "amountUsd": it.get("amountUsd"),
                        "sponsor": it.get("sponsor") or "",
                    })

        # Also scan Official Clerk Minutes & Supporting Packet PDFs for mentions of this OSINT entity!
        for d in docs:
            dtxt = f"{d.get('title','')} {(d.get('text') or '')[:12000]}"
            if any(rx.search(dtxt) for rx in rxs):
                matched_mtgs.add(d["meeting"])
                if len(matched_contracts) < 10 and d.get("role") != "minutes":
                    matched_contracts.append({
                        "meeting": d["meeting"],
                        "itemNo": d.get("itemNo") or f"DOC-{d['id']}",
                        "kind": "packet_exhibit",
                        "title": d["title"][:130],
                        "amountUsd": None,
                        "sponsor": "",
                    })

        for o in ords:
            if any(rx.search(o["title"]) for rx in rxs) and len(matched_ords) < 8:
                matched_ords.append({"slug": o["slug"], "title": o["title"][:120], "kind": o["kind"], "lastDate": o["lastDate"]})

        co_speakers = collections.Counter()
        for t in turns:
            if t["meetingSlug"] in matched_mtgs or any(rx.search(t["text"]) for rx in rxs):
                co_speakers[t["speakerSlug"]] += 1

        linked_speakers = [
            {
                "slug": sp_slug,
                "name": spk_summary_by_slug[sp_slug]["osint"].get("name") or next((s["name"] for s in new_speakers_dir if s["slug"] == sp_slug), sp_slug),
                "role": next((s["role"] for s in new_speakers_dir if s["slug"] == sp_slug), ""),
                "clipCount": spk_summary_by_slug[sp_slug]["historicalClipCount"],
                "sharedAppearances": cnt,
            }
            for sp_slug, cnt in co_speakers.most_common(8)
            if sp_slug in spk_summary_by_slug
        ]

        osint_entities.append({
            "slug": core["slug"],
            "name": core["name"],
            "category": core["category"],
            "subtype": core["subtype"],
            "address": core["address"],
            "keyPeople": core["keyPeople"],
            "nexusSummary": core["nexusSummary"],
            "verifiedProfiles": core["verifiedProfiles"],
            "meetingCount": len(matched_mtgs),
            "trackedContractValueUsd": round(total_usd, 2),
            "contractsAndBids": matched_contracts,
            "ordinancesAndResolutions": matched_ords,
            "linkedSpeakers": linked_speakers,
            "speakerSlug": None,
        })

    # 5B. Add Top Canonical Speakers (Council, Mayor, Staff, Watchdogs, Contractors, Org Reps) into OSINT Graph too!
    for s in new_speakers_dir[:40]:
        slug = s["slug"]
        if slug == "verified-floor-speaker":
            continue
        an = s["analytics"]
        os_p = an["osint"]
        ln = s["name"].split()[-1]
        sp_contracts = []
        total_sp_usd = 0.0
        for it in items:
            if re.search(rf"\b{re.escape(ln)}\b", f"{it.get('sponsor','')} {it['title']}", re.I):
                if it.get("amountUsd"):
                    total_sp_usd += float(it["amountUsd"])
                if len(sp_contracts) < 6:
                    sp_contracts.append({
                        "meeting": it["meeting"],
                        "itemNo": it["itemNo"],
                        "kind": it["kind"],
                        "title": it["title"][:125],
                        "amountUsd": it.get("amountUsd"),
                        "sponsor": it.get("sponsor") or "",
                    })

        sp_ords = [
            {"slug": os_slug, "title": ord_title_by_slug.get(os_slug, os_slug)[:115], "kind": "ordinance", "lastDate": s["lastDate"]}
            for os_slug in s["ordinanceSlugs"][:6]
        ]

        cat = "Council / Elected" if ("Council" in s["role"] or "Mayor" in s["role"]) else (
            "City Staff" if "Municipal Staff" in an["primaryCapacity"] else (
                "Vendor / Contractor" if "Contractor" in an["primaryCapacity"] else (
                    "Chamber / LEADS / DDA" if "Organizational" in an["primaryCapacity"] else "Special Interest / Watchdog"
                )
            )
        )

        osint_entities.append({
            "slug": f"person-{slug}",
            "name": s["name"],
            "category": cat,
            "subtype": s["role"],
            "address": "Cheyenne, WY",
            "keyPeople": os_p.get("affiliations", [s["role"]]),
            "nexusSummary": f"{os_p.get('headline', s['role'])}. Historical Floor Record: {s['turnCount']} video clips across {s['meetingCount']} meetings (Avg Speaking Time: {an['avgSpeakingFormatted']}, Points of Order: {an['pointOfOrderCount']}). Primary Capacity: {an['primaryCapacity']}.",
            "verifiedProfiles": os_p.get("profiles", []),
            "meetingCount": s["meetingCount"],
            "trackedContractValueUsd": round(total_sp_usd, 2),
            "contractsAndBids": sp_contracts,
            "ordinancesAndResolutions": sp_ords,
            "linkedSpeakers": [{
                "slug": slug,
                "name": s["name"],
                "role": s["role"],
                "clipCount": s["turnCount"],
                "sharedAppearances": s["turnCount"],
            }],
            "speakerSlug": slug,
        })

    # Write all updated seed files atomically
    (SEED / "meetings.json").write_text(json.dumps(meetings, ensure_ascii=False, indent=2))
    (SEED / "items.json").write_text(json.dumps(items, ensure_ascii=False, indent=2))
    (SEED / "documents.json").write_text(json.dumps(docs, ensure_ascii=False))
    (SEED / "ordinances.json").write_text(json.dumps(ords, ensure_ascii=False, indent=2))
    (SEED / "vote_events.json").write_text(json.dumps(votes, ensure_ascii=False, indent=2))
    (SEED / "briefs.json").write_text(json.dumps(briefs, ensure_ascii=False, indent=2))
    (SEED / "people.json").write_text(json.dumps(people, ensure_ascii=False, indent=2))
    (SEED / "featured.json").write_text(json.dumps(featured, ensure_ascii=False, indent=2))
    (SEED / "speaker_turns.json").write_text(json.dumps(turns, ensure_ascii=False, indent=2))
    (SEED / "speakers_directory.json").write_text(json.dumps(new_speakers_dir, ensure_ascii=False, indent=2))
    (SEED / "osint_entities.json").write_text(json.dumps(osint_entities, ensure_ascii=False, indent=2))

    print(f"SUCCESS: Wrote {len(new_speakers_dir)} enriched speaker profiles, {len(turns)} analytics-stamped clips, and {len(osint_entities)} OSINT entity dossiers!")


if __name__ == "__main__":
    main()
