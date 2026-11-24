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
});

export const provenanceCatalog = pgTable("provenance_catalog", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
});
