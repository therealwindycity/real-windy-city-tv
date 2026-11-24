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
  group: "Watch" | "Follow" | "Verify";
};

export const LENSES: LensMeta[] = [
  { key: "foundry", name: "Foundry Docs Vault", short: "Foundry", icon: "🧬", accent: "#38bdf8", group: "Verify", blurb: "Palantir Foundry workbench: all Agendas & Supporting PDFs, SHA-1 hashes, live AI-Record-OCR & lineage DAG." },
  { key: "gotham", name: "Gotham Link Graph", short: "Gotham", icon: "🕸️", accent: "#10b981", group: "Follow", blurb: "Palantir Gotham entity-link graph connecting Officials, Vendors, Ordinances, Supporting PDFs, $ Flows & Speakers." },
  { key: "speakers", name: "Speaker Turn Videos", short: "Speakers", icon: "🎙️", accent: "#f59e0b", group: "Watch", blurb: "Individual <=3-min speaker turn videos with emotion/theme tags, full speaker .zip download & Facebook post studio." },
  { key: "provenance", name: "Provenance Films", short: "Provenance", icon: "🎥", accent: "#f43f5e", group: "Verify", blurb: "Screen-recorded walkthroughs showing the exact manual browser clicks used to fetch every document & video." },
  { key: "story", name: "Plain-English Story", short: "Story", icon: "📖", accent: "#fbbf24", group: "Watch", blurb: "What happened, why it matters, and a 4-stop curiosity dial from one sentence to kid mode." },
  { key: "tabloid", name: "Front Page", short: "Tabloid", icon: "🗞️", accent: "#ef4444", group: "Watch", blurb: "Newsprint edition — screaming headlines, every claim footnoted back to the packet." },
  { key: "cast", name: "Cast & Crew", short: "Cast", icon: "🎭", accent: "#a855f7", group: "Watch", blurb: "Every member on the roll call, their dissent count across the archive, and who took the mic." },
  { key: "callsheet", name: "Run of Show", short: "Acts", icon: "🎬", accent: "#38bdf8", group: "Watch", blurb: "The agenda cut into TV acts — click any item for its sponsor, action, and dollar ceiling." },
  { key: "votes", name: "Vote Lab", short: "Votes", icon: "🗳️", accent: "#22c55e", group: "Follow", blurb: "Every recorded motion in the official minutes, who voted no, and how split this night was." },
  { key: "map", name: "Cheyenne Map", short: "Map", icon: "🗺️", accent: "#14b8a6", group: "Follow", blurb: "Schematic of the city showing where each annexation, rezone, plat, and easement sits." },
  { key: "history", name: "History Compare", short: "History", icon: "🕰️", accent: "#f97316", group: "Follow", blurb: "Every ordinance on tonight's docket traced back through its earlier readings across 2008–2026." },
  { key: "money", name: "Follow the Money", short: "Money", icon: "💵", accent: "#84cc16", group: "Follow", blurb: "Every dollar figure printed on the agenda — contracts, bids, modifications — ranked and cited." },
  { key: "jargon", name: "Jargon Decoder", short: "Jargon", icon: "🔤", accent: "#ec4899", group: "Follow", blurb: "UDC, NTE, Consent Agenda, BOPU, 6th Penny, First Reading — municipal Cheyenne translated." },
  { key: "legal", name: "Legal (IRAC)", short: "Legal", icon: "⚖️", accent: "#8b5cf6", group: "Verify", blurb: "Issue · Rule · Application · Conclusion on the statutory questions raised on the floor." },
  { key: "factcheck", name: "Fact-Check Desk", short: "Briefs", icon: "🔍", accent: "#06b6d4", group: "Verify", blurb: "Rule-engine flags from the packet PDFs, each paired with the verbatim quote and page number." },
  { key: "analytics", name: "Analytics", short: "Stats", icon: "📊", accent: "#eab308", group: "Verify", blurb: "Item mix, consent-agenda share, sponsor breakdown, and how this episode compares to the season." },
  { key: "transcript", name: "Verbatim Record", short: "Minutes", icon: "📜", accent: "#cbd5e1", group: "Verify", blurb: "Full searchable text of the official minutes & diarized broadcast transcript, plus packet attachments." },
  { key: "script", name: "Screenplay", short: "Script", icon: "✍️", accent: "#fda4af", group: "Watch", blurb: "Formatted like a shooting script — sluglines, character cues, motions, and real podium dialogue." },
  { key: "evidence", name: "Evidence Locker", short: "Sources", icon: "🗄️", accent: "#94a3b8", group: "Verify", blurb: "Every primary URL, Wayback capture, Archive.org stream, and document SHA-1 hash." },
];

export const LENS_BY_KEY = Object.fromEntries(LENSES.map((l) => [l.key, l])) as Record<LensKey, LensMeta>;
export const isLensKey = (s: string): s is LensKey => Object.prototype.hasOwnProperty.call(LENS_BY_KEY, s);
