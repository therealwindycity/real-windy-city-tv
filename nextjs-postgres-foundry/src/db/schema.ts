import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  doublePrecision,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const meetings = pgTable(
  "meetings",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    date: text("date").notNull(),
    body: text("body").notNull(),
    bodyName: text("body_name").notNull(),
    season: integer("season").notNull(),
    episodeNo: integer("episode_no").notNull(),
    seasonSize: integer("season_size").notNull(),
    title: text("title").notNull(),
    logline: text("logline").notNull(),
    note: text("note").notNull().default(""),
    phase: text("phase").notNull().default("aired"),
    featured: boolean("featured").notNull().default(false),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    eventId: integer("event_id"),
    clipId: integer("clip_id"),
    agendaUrl: text("agenda_url"),
    minutesUrl: text("minutes_url"),
    videoUrl: text("video_url"),
    mp4Url: text("mp4_url"),
    videoLinkVerified: boolean("video_link_verified"),
    videoLinkBasis: text("video_link_basis"),
    hasMinutesText: boolean("has_minutes_text").notNull().default(false),
    sources: jsonb("sources").$type<string[]>().notNull().default([]),
    extraLinks: jsonb("extra_links").$type<{ label: string; url: string; kind: string }[]>().notNull().default([]),
    startMin: integer("start_min"),
    endMin: integer("end_min"),
    runtimeMin: integer("runtime_min"),
  },
  (t) => [index("meetings_date_idx").on(t.date), index("meetings_body_idx").on(t.body, t.season)],
);

export const agendaItems = pgTable(
  "agenda_items",
  {
    id: serial("id").primaryKey(),
    meetingId: integer("meeting_id").notNull(),
    pos: integer("pos").notNull(),
    itemNo: text("item_no").notNull(),
    title: text("title").notNull(),
    action: text("action").notNull().default(""),
    sponsor: text("sponsor").notNull().default(""),
    consent: boolean("consent").notNull().default(false),
    kind: text("kind").notNull(),
    reading: text("reading"),
    amountUsd: doublePrecision("amount_usd"),
  },
  (t) => [index("items_meeting_idx").on(t.meetingId)],
);

export const ordinances = pgTable(
  "ordinances",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    firstDate: text("first_date").notNull(),
    lastDate: text("last_date").notNull(),
    sources: jsonb("sources").$type<string[]>().notNull().default([]),
    readings: jsonb("readings")
      .$type<
        {
          date: string;
          body: string;
          stage: string;
          context: string;
          meeting: string | null;
          itemNo: string;
          source: string;
        }[]
      >()
      .notNull()
      .default([]),
  },
  (t) => [index("ord_last_idx").on(t.lastDate)],
);

export const voteEvents = pgTable(
  "vote_events",
  {
    id: serial("id").primaryKey(),
    meetingId: integer("meeting_id").notNull(),
    idx: integer("idx").notNull(),
    excerpt: text("excerpt").notNull(),
    result: text("result").notNull(),
    unanimous: boolean("unanimous").notNull().default(false),
    noNames: jsonb("no_names").$type<string[]>().notNull().default([]),
    source: text("source").notNull().default("official minutes"),
  },
  (t) => [index("votes_meeting_idx").on(t.meetingId)],
);

export const documents = pgTable(
  "documents",
  {
    id: integer("id").primaryKey(),
    meetingId: integer("meeting_id").notNull(),
    role: text("role").notNull(),
    itemNo: text("item_no").notNull().default(""),
    title: text("title").notNull(),
    url: text("url"),
    pages: integer("pages"),
    words: integer("words"),
    ocr: boolean("ocr").notNull().default(false),
    sha1: text("sha1"),
    body: text("body"),
  },
  (t) => [index("docs_meeting_idx").on(t.meetingId)],
);

export const briefs = pgTable(
  "briefs",
  {
    id: serial("id").primaryKey(),
    meetingId: integer("meeting_id").notNull(),
    itemNo: text("item_no").notNull(),
    title: text("title").notNull(),
    docId: integer("doc_id"),
    facts: jsonb("facts").$type<Record<string, string>>().notNull().default({}),
    flags: jsonb("flags").$type<{ sev: string; code: string; msg: string }[]>().notNull().default([]),
    quotes: jsonb("quotes").$type<{ page: number; text: string }[]>().notNull().default([]),
  },
  (t) => [index("briefs_meeting_idx").on(t.meetingId)],
);

export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  honorific: text("honorific").notNull().default(""),
  role: text("role").notNull(),
  lastName: text("last_name").notNull(),
  dissents: integer("dissents").notNull().default(0),
  meetingsPresent: integer("meetings_present").notNull().default(0),
  recent: jsonb("recent").$type<string[]>().notNull().default([]),
});

export const episodeContent = pgTable("episode_content", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().unique(),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
});

export type SpeakerClipAnalytics = {
  historicalClipCount: number;
  historicalMeetingCount: number;
  avgSpeakingSec: number;
  avgSpeakingFormatted: string;
  pointOfOrderCount: number;
  primaryCapacity: string;
  capacitiesSummary: string[];
  topTopics: string[];
  lobbiesFor: string[];
  opposes: string[];
  profiles: { platform: string; label: string; url: string }[];
};

export type SpeakerFullAnalytics = {
  historicalClipCount: number;
  historicalMeetingCount: number;
  avgSpeakingSec: number;
  avgSpeakingFormatted: string;
  totalSpeakingSec: number;
  totalSpeakingFormatted: string;
  maxSpeakingSec: number;
  pointOfOrderCount: number;
  pointOfOrderTurnIds: number[];
  primaryCapacity: string;
  capacitiesBreakdown: { capacity: string; count: number; pct: number; orgs: string[] }[];
  stanceCounts: Record<string, number>;
  topicAnalytics: { topic: string; label: string; count: number; pct: number; supportCount: number; opposeCount: number }[];
  lobbiesFor: string[];
  opposes: string[];
  osint: {
    entityType: string;
    headline: string;
    affiliations: string[];
    profiles: { platform: string; label: string; url: string }[];
  };
};

export const speakerTurns = pgTable(
  "speaker_turns",
  {
    id: integer("id").primaryKey(),
    speakerSlug: text("speaker_slug").notNull(),
    speakerName: text("speaker_name").notNull(),
    speakerRole: text("speaker_role").notNull(),
    meetingSlug: text("meeting_slug").notNull(),
    date: text("date").notNull(),
    season: integer("season").notNull(),
    body: text("body").notNull(),
    bodyName: text("body_name").notNull(),
    turnIndex: integer("turn_index").notNull(),
    startSec: doublePrecision("start_sec").notNull(),
    endSec: doublePrecision("end_sec").notNull(),
    durationSec: doublePrecision("duration_sec").notNull(),
    hms: text("hms").notNull(),
    directMp4Url: text("direct_mp4_url"),
    sourceMeetingMp4Url: text("source_meeting_mp4_url"),
    brandedMp4Url: text("branded_mp4_url"),
    footageMp4Url: text("footage_mp4_url"),
    cardPngUrl: text("card_png_url"),
    embedUrl: text("embed_url"),
    youtubeId: text("youtube_id"),
    speakerZipUrl: text("speaker_zip_url"),
    releaseUrl: text("release_url"),
    text: text("text").notNull(),
    ordinances: jsonb("ordinances").$type<{ slug: string; stage: string }[]>().notNull().default([]),
    themes: jsonb("themes").$type<string[]>().notNull().default([]),
    emotion: text("emotion").notNull(),
    impactScore: integer("impact_score").notNull().default(50),
    verifiedClip: boolean("verified_clip").notNull().default(false),
    speakingCapacity: text("speaking_capacity").notNull().default("Resident"),
    representingOrg: text("representing_org").notNull().default(""),
    hasPointOfOrder: boolean("has_point_of_order").notNull().default(false),
    pointOfOrderType: text("point_of_order_type"),
    stance: text("stance").notNull().default("inquiry_discussion"),
    stanceLabel: text("stance_label").notNull().default("Questions & discussion"),
    speakerAnalytics: jsonb("speaker_analytics").$type<SpeakerClipAnalytics | null>().default(null),
    videoTiming: text("video_timing"),
    videoTimingNote: text("video_timing_note"),
    alignScore: doublePrecision("align_score"),
    alignSource: text("align_source"),
    legacyStartSec: doublePrecision("legacy_start_sec"),
    legacyEndSec: doublePrecision("legacy_end_sec"),
    speakerAttributionVerified: boolean("speaker_attribution_verified").notNull().default(true),
  },
  (t) => [
    index("st_speaker_idx").on(t.speakerSlug),
    index("st_meeting_idx").on(t.meetingSlug),
    index("st_date_idx").on(t.date),
    index("st_emotion_idx").on(t.emotion, t.impactScore),
  ],
);

export const speakersDirectory = pgTable("speakers_directory", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  turnCount: integer("turn_count").notNull(),
  meetingCount: integer("meeting_count").notNull(),
  totalDurationSec: integer("total_duration_sec").notNull(),
  firstDate: text("first_date").notNull(),
  lastDate: text("last_date").notNull(),
  topThemes: jsonb("top_themes").$type<string[]>().notNull().default([]),
  dominantEmotion: text("dominant_emotion").notNull(),
  emotions: jsonb("emotions").$type<Record<string, number>>().notNull().default({}),
  maxImpactScore: integer("max_impact_score").notNull(),
  ordinanceCount: integer("ordinance_count").notNull().default(0),
  ordinanceSlugs: jsonb("ordinance_slugs").$type<string[]>().notNull().default([]),
  speakerZipUrls: jsonb("speaker_zip_urls").$type<string[]>().notNull().default([]),
  compilationReels: jsonb("compilation_reels").$type<{ title: string; url: string }[]>().notNull().default([]),
  directClipCount: integer("direct_clip_count").notNull().default(0),
  analytics: jsonb("analytics").$type<SpeakerFullAnalytics | null>().default(null),
});

export const osintEntities = pgTable(
  "osint_entities",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    subtype: text("subtype").notNull().default(""),
    address: text("address").notNull().default(""),
    keyPeople: jsonb("key_people").$type<string[]>().notNull().default([]),
    nexusSummary: text("nexus_summary").notNull().default(""),
    verifiedProfiles: jsonb("verified_profiles").$type<{ platform: string; label: string; url: string }[]>().notNull().default([]),
    meetingCount: integer("meeting_count").notNull().default(0),
    trackedContractValueUsd: doublePrecision("tracked_contract_value_usd").notNull().default(0),
    contractsAndBids: jsonb("contracts_and_bids")
      .$type<{ meeting: string; itemNo: string; kind: string; title: string; amountUsd: number | null; sponsor: string }[]>()
      .notNull()
      .default([]),
    ordinancesAndResolutions: jsonb("ordinances_and_resolutions")
      .$type<{ slug: string; title: string; kind: string; lastDate: string }[]>()
      .notNull()
      .default([]),
    linkedSpeakers: jsonb("linked_speakers")
      .$type<{ slug: string; name: string; role: string; clipCount: number; sharedAppearances: number }[]>()
      .notNull()
      .default([]),
    speakerSlug: text("speaker_slug"),
  },
  (t) => [index("osint_cat_idx").on(t.category)],
);

export const provenanceCatalog = pgTable("provenance_catalog", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
});
