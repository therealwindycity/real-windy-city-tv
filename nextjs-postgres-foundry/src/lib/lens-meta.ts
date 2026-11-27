export type LensKey =
  | "foundry"
  | "gotham"
  | "speakers"
  | "provenance"
  | "story"
  | "tabloid"
  | "cast"
  | "callsheet"
  | "votes"
  | "map"
  | "history"
  | "money"
  | "jargon"
  | "legal"
  | "factcheck"
  | "analytics"
  | "transcript"
  | "script"
  | "evidence";

export type LensMeta = {
  key: LensKey;
  name: string;
  short: string;
  icon: string;
  accent: string;
  blurb: string;
  group: "Watch" | "Follow" | "Check";
};

export const LENSES: LensMeta[] = [
  { key: "foundry", name: "Meeting Documents", short: "Documents", icon: "📄", accent: "#38bdf8", group: "Check", blurb: "The agenda and every document attached to it, with a text search of the scanned pages and where each file came from." },
  { key: "gotham", name: "Connections", short: "Connections", icon: "🕸️", accent: "#10b981", group: "Follow", blurb: "Who and what is connected to this meeting: officials, companies, ordinances, documents, dollar amounts and speakers." },
  { key: "speakers", name: "Speaker Videos", short: "Speakers", icon: "🎙️", accent: "#f59e0b", group: "Watch", blurb: "Video clips (3 minutes or less) of each person who spoke, with topic tags, a download of all their clips and a Facebook share button." },
  { key: "provenance", name: "Where the Records Come From", short: "Sources", icon: "🎥", accent: "#f43f5e", group: "Check", blurb: "Screen recordings showing the public web pages and clicks used to download every document and video." },
  { key: "story", name: "Plain-English Story", short: "Story", icon: "📖", accent: "#fbbf24", group: "Watch", blurb: "What happened, why it matters, explained at four levels from one sentence to kid-friendly." },
  { key: "tabloid", name: "Front Page", short: "Front Page", icon: "🗞️", accent: "#ef4444", group: "Watch", blurb: "Newspaper-style headlines, each one footnoted back to the agenda packet." },
  { key: "cast", name: "Who Was There", short: "Who", icon: "🎭", accent: "#a855f7", group: "Watch", blurb: "Everyone on the roll call, how often they've voted no over the years, and who spoke." },
  { key: "callsheet", name: "Agenda, Item by Item", short: "Agenda", icon: "🎬", accent: "#38bdf8", group: "Watch", blurb: "The agenda in sections. Click an item to see who brought it, what was done and the dollar limit." },
  { key: "votes", name: "Votes", short: "Votes", icon: "🗳️", accent: "#22c55e", group: "Follow", blurb: "Every recorded motion in the official minutes, who voted no, and how close the votes were." },
  { key: "map", name: "Map", short: "Map", icon: "🗺️", accent: "#14b8a6", group: "Follow", blurb: "A simple city map showing where each annexation, rezoning, subdivision and easement is." },
  { key: "history", name: "Ordinance History", short: "History", icon: "🕰️", accent: "#f97316", group: "Follow", blurb: "Each ordinance on this agenda followed back through its earlier readings, 2008–2026." },
  { key: "money", name: "Follow the Money", short: "Money", icon: "💵", accent: "#84cc16", group: "Follow", blurb: "Every dollar amount on the agenda (contracts, bids, changes), largest first, with its source." },
  { key: "jargon", name: "City Terms Explained", short: "Terms", icon: "🔤", accent: "#ec4899", group: "Follow", blurb: "What UDC, NTE, consent agenda, BOPU, 6th Penny, first reading and other city terms mean." },
  { key: "legal", name: "The Legal Question", short: "Legal", icon: "⚖️", accent: "#8b5cf6", group: "Check", blurb: "For each legal question raised: the question, the rule that applies, how it applies here and the likely answer." },
  { key: "factcheck", name: "Fact Check", short: "Fact Check", icon: "🔍", accent: "#06b6d4", group: "Check", blurb: "Warnings from an automatic check of the agenda documents, each with the exact quote and page number." },
  { key: "analytics", name: "By the Numbers", short: "Numbers", icon: "📊", accent: "#eab308", group: "Check", blurb: "What kinds of items were on the agenda, how many passed together on consent, who brought them, and how this meeting compares to the rest of the year." },
  { key: "transcript", name: "Full Text", short: "Text", icon: "📜", accent: "#cbd5e1", group: "Check", blurb: "Searchable official minutes, what was said (split by speaker automatically) and the attached documents." },
  { key: "script", name: "Screenplay", short: "Script", icon: "✍️", accent: "#fda4af", group: "Watch", blurb: "The meeting written like a script, with who spoke, motions and their actual words." },
  { key: "evidence", name: "Source Files", short: "Files", icon: "🗄️", accent: "#94a3b8", group: "Check", blurb: "Every original link, saved web-page copy, Internet Archive video and document fingerprint." },
];

export const LENS_BY_KEY = Object.fromEntries(LENSES.map((l) => [l.key, l])) as Record<LensKey, LensMeta>;
export const isLensKey = (s: string): s is LensKey => Object.prototype.hasOwnProperty.call(LENS_BY_KEY, s);

/** Plain-English names for the automatic document checks. */
export const FLAG_LABEL: Record<string, string> = {
  PROVENANCE_LOCKED: "Source found",
  OCR_PACKET_VERIFIED: "Scanned text available",
  FINAL_READING: "Final vote",
  "FINAL-READING": "Final vote",
  "SECOND-READING": "2nd reading",
  FISCAL_CEILING: "Large dollar amount",
  BIG_MONEY: "Large dollar amount",
  SPLIT_ROLL_CALL: "Not a unanimous vote",
  STALE_REPORT: "Staff report may be out of date",
  LOW_CONTIGUITY: "Barely touches city limits",
  HOLDING_ZONE: "Temporary zoning",
  LANDOWNER_DETERMINES: "Landowner made the finding, not the council",
  NO_PUBLIC_COMMENT_HIGH_VIEWS: "Many views but 'no comments'",
  YEAR_MIX: "Document mixes years",
  PC_DENIED_STAFF_APPROVE: "Planning Commission said no, staff said yes",
  STAFF_DENY: "Staff recommends no",
  CRITERIA_FAIL: "Fails review criteria",
  GF_RESERVES: "Uses savings (reserves)",
  CONSENT_NONROUTINE: "Not routine, but on the consent agenda",
  "CONSENT-BUNDLING": "Passed together with other items",
  PC_UNANIMOUS_DENY: "Planning Commission unanimously said no",
  ANNEXATION: "Annexation",
  "ZONING-MAP-AMENDMENT": "Zoning map change",
  "BUDGET-REAPPROPRIATION": "Budget money moved",
};
export const SEV_LABEL: Record<string, string> = { HIGH: "Important", MED: "Worth a look", LOW: "Note" };
export const flagLabel = (code: string) => FLAG_LABEL[code] ?? code.replace(/[_-]+/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
