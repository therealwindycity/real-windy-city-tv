export type Meeting = {
  id: number;
  slug: string;
  date: string;
  body: string;
  bodyName: string;
  season: number;
  episodeNo: number;
  seasonSize: number;
  title: string;
  logline: string;
  note: string;
  phase: string;
  featured: boolean;
  tags: string[];
  eventId: number | null;
  clipId: number | null;
  agendaUrl: string | null;
  minutesUrl: string | null;
  videoUrl: string | null;
  mp4Url: string | null;
  hasMinutesText: boolean;
  sources: string[];
  extraLinks: { label: string; url: string; kind: string }[];
  startMin: number | null;
  endMin: number | null;
  runtimeMin: number | null;
};

export type Item = {
  itemNo: string;
  pos: number;
  title: string;
  action: string;
  sponsor: string;
  consent: boolean;
  kind: string;
  reading: string | null;
  amountUsd: number | null;
};

export type VoteEvent = { idx: number; excerpt: string; result: string; unanimous: boolean; noNames: string[]; source: string };
export type Brief = {
  itemNo: string;
  title: string;
  docId: number | null;
  facts: Record<string, string>;
  flags: { sev: string; code: string; msg: string }[];
  quotes: { page: number; text: string }[];
};
export type DocMeta = { id: number; role: string; itemNo: string; title: string; url: string | null; pages: number | null; words: number | null; ocr: boolean; sha1: string | null; hasText: boolean };

export type CastMember = { name: string; role: string; billing: string; note: string; src: string };
export type Act = { n: number; name: string; beat: string; items: string[] };
export type Montage = { big: string; small: string };
export type Recap = { date?: string; text: string; src?: string; slug?: string | null; body?: string };

export type Show = {
  code: string;
  title: string;
  tagline: string;
  logline: string;
  rating: string;
  ratingNote: string;
  tags: string[];
  runtimeLabel: string | null;
  acts: Act[];
  montage: Montage[];
  themeLyrics: string[];
  previously: Recap[];
  toBeContinued: Recap[];
  nextTime: Recap[];
  cast: CastMember[];
  castNote: string;
};

export type Lenses = {
  authored: boolean;
  layman: { headline: string; brief: string[]; deep: string[]; kids: string };
  tabloid: { masthead: string; slogan: string; banner: string; stories: { headline: string; deck: string; body: string; receipts: string }[] };
  legal: { disclaimer: string; issues: { id: string; question: string; rule: string; application: string; conclusion: string; cites: string[] }[] };
  glossary: { term: string; def: string }[];
  script: { t: string; text: string; who?: string; paren?: string }[];
  scoreboard: { items: string[]; label: string; result: string; tally: string; no: string[]; conf: string; note: string }[];
  moments: { who: string; item: string; text: string; quote: boolean }[];
  coxTimeline: { date: string; what: string; vote: string; note: string }[];
  compare: { row: string; a: string; b: string }[];
  sweetgrass: { what: string; vote: string }[];
  map: {
    note: string;
    roads: { id: string; label: string; d: string; w: number }[];
    parcels: { id: string; label: string; sub: string; x: number; y: number; w: number; h: number; tone: string; items: string[] }[];
  } | null;
  locations: { text: string; osm: string }[];
};

export type Analytics = {
  itemCount: number;
  substantive: number;
  consentCount: number;
  byKind: { kind: string; n: number }[];
  amounts: { itemNo: string; title: string; amount: number }[];
  amountTotal: number;
  sponsors: { name: string; n: number }[];
  votes: { total: number; unanimous: number; failed: number; split: number };
  dissent: { name: string; n: number }[];
  docs: { n: number; pages: number; words: number; ocr: number };
  flags: { sev: string; n: number }[];
  minutesWords: number;
  peers: { slug: string; date: string; items: number; votes: number; runtime: number | null; ordinances: number }[];
};

export type OrdSeries = {
  slug: string;
  title: string;
  kind: string;
  firstDate: string;
  lastDate: string;
  readings: { date: string; body: string; stage: string; context: string; meeting: string | null; source: string; link: string | null }[];
};

export type SpeakerTurn = {
  id: number;
  speakerSlug: string;
  speakerName: string;
  speakerRole: string;
  meetingSlug: string;
  date: string;
  season: number;
  body: string;
  bodyName: string;
  turnIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  hms: string;
  directMp4Url: string | null;
  footageMp4Url?: string | null;
  cardPngUrl?: string | null;
  embedUrl: string | null;
  youtubeId: string | null;
  speakerZipUrl: string | null;
  releaseUrl: string | null;
  text: string;
  ordinances: { slug: string; stage: string }[];
  themes: string[];
  emotion: string;
  impactScore: number;
  verifiedClip: boolean;
};

export type SpeakerProfile = {
  id: number;
  slug: string;
  name: string;
  role: string;
  turnCount: number;
  meetingCount: number;
  totalDurationSec: number;
  firstDate: string;
  lastDate: string;
  topThemes: string[];
  dominantEmotion: string;
  emotions: Record<string, number>;
  maxImpactScore: number;
  ordinanceCount: number;
  ordinanceSlugs: string[];
  speakerZipUrls: string[];
  compilationReels: { title: string; url: string }[];
  directClipCount: number;
};

export type ProvenanceFilmChapter = {
  id: string;
  file: string;
  ledgerKey: string;
  title: string;
  description: string;
  masterStartSec: number;
  durationSec: number;
  localUrl: string;
  cdnUrl: string;
  ledgerRows: { key: string; ledger: string; item: string; value: string | number; origin?: { url: string; host: string }; how?: string }[];
};

export type ProvenanceCatalogData = {
  generatedAt: string;
  summaryStats: {
    totalFilesAudited: number;
    recordFamilies: number;
    publicSiteCaptures: number;
    originHosts: number;
    unaccountedFiles: number;
    manualEquivalentEstimate: string;
    ledgerRows: number;
  };
  masterFilms: {
    id: string;
    title: string;
    durationSec: number;
    sizeMb: number;
    localUrl: string;
    cdnUrl: string;
    posterUrl: string;
    description: string;
  }[];
  chapters: ProvenanceFilmChapter[];
  investigativeReels: { id: string; title: string; duration: string; url: string }[];
};

export type EpisodeBundle = {
  meeting: Meeting;
  show: Show;
  items: Item[];
  voteEvents: VoteEvent[];
  briefs: Brief[];
  docs: DocMeta[];
  speakerTurns: SpeakerTurn[];
  provenanceFilms: ProvenanceCatalogData | null;
  minutesText: string | null;
  analytics: Analytics;
  lenses: Lenses;
  series: OrdSeries[];
  provenance: {
    waybackTs: string;
    waybackUrl: string;
    captures: { ts: string; url: string }[];
    official: string;
    watchdog: string | null;
    nameWarning: string | null;
  };
  nav: {
    prev: { slug: string; title: string; date: string } | null;
    next: { slug: string; title: string; date: string } | null;
    premiere: { slug: string; title: string } | null;
    finale: { slug: string; title: string } | null;
  };
};
