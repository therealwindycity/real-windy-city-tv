import { and, asc, desc, eq, ilike, inArray, lt, gt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSeeded, prettyDate } from "@/db/seed";
import { agendaItems, briefs, documents, episodeContent, meetings, ordinances, osintEntities, people, provenanceCatalog, speakersDirectory, speakerTurns, voteEvents } from "@/db/schema";
import type {
  Act,
  Analytics,
  CastMember,
  EpisodeBundle,
  Item,
  Lenses,
  Meeting,
  Montage,
  OrdSeries,
  OsintEntity,
  ProvenanceCatalogData,
  Recap,
  Show,
  SpeakerProfile,
  SpeakerTurn,
} from "@/lib/types";

const WB_TS = "20260913055109";
const WB_PAGE = "https://www.cheyennecity.org/Your-Government/City-Council/Minutes-and-Agendas";
const BODY_KEY: Record<string, string> = {
  "City Council": "council",
  "Special City Council": "special",
  "Public Services Committee": "psc",
  "Finance Committee": "finance",
  "Committee of the Whole": "cow",
  "Work Session": "work",
  "Planning Commission": "planning",
  "Urban Renewal Authority": "ura",
  "Board of Adjustment": "boa",
};
const CODE: Record<string, string> = { council: "CC", special: "SP", psc: "PSC", finance: "FIN", cow: "COW", work: "WS", planning: "PC", ura: "URA", boa: "BOA", other: "MB" };

export const BODIES = [
  { key: "council", name: "City Council" },
  { key: "special", name: "Special Council" },
  { key: "psc", name: "Public Services Committee" },
  { key: "finance", name: "Finance Committee" },
  { key: "cow", name: "Committee of the Whole" },
  { key: "work", name: "Work Sessions" },
  { key: "planning", name: "Planning Commission" },
  { key: "ura", name: "Urban Renewal Authority" },
  { key: "boa", name: "Board of Adjustment" },
  { key: "other", name: "Boards & Commissions" },
];

function money(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString("en-US")}`;
}
function hm(min: number) {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}
function short(t: string, n = 120) {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
function sentenceCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

type Featured = Record<string, any> & { slug: string }; // eslint-disable-line @typescript-eslint/no-explicit-any

const FEATURED_CAST: CastMember[] = [
  { name: "Patrick Collins", role: "Mayor", billing: "Presiding", note: "Chairs the meeting; the minutes show the Mayor voting as a member of the governing body.", src: "Aug 24 roll call" },
  { name: "Dr. Michelle Aldrich", role: "Council Member", billing: "Starring", note: "Moved the three-minute debate limit; sponsor line on twelve agenda items (CivicWatch brief).", src: "debrief; brief 1441" },
  { name: "Lawrence Wolfe", role: "Council Member", billing: "Starring", note: "One of three no votes on every Cox item.", src: "debrief" },
  { name: "Mark Moody", role: "Council Member", billing: "Starring", note: "No on the debate limit, all three Cox items and the Sickenberger judge appointment.", src: "debrief" },
  { name: "Pete Laybourn", role: "Council Member", billing: "Starring", note: "No on the debate limit and Cox; called the Comprehensive Plan \u201cnot routine\u201d.", src: "debrief" },
  { name: "Dr. Mark Rinne", role: "Council Member", billing: "Co-starring", note: "Arrived at 8:10 p.m., after the Cox votes, per the watchdog notes.", src: "Cox history notes" },
  { name: "Tom Segrave", role: "Council Member", billing: "Co-starring", note: "Appears as \u201cCosgrave\u201d in the auto-transcribed debrief.", src: "name normalized" },
  { name: "Jeff White", role: "Council Member", billing: "Co-starring", note: "Asked whether the Cox neighbor concerns had been resolved.", src: "Cox history notes" },
  { name: "Ken Esquibel", role: "Council Member", billing: "Co-starring", note: "Sponsor of the FY2026 budget re-appropriation (item 20).", src: "agenda item 20" },
  { name: "Dr. Kathy Emmons", role: "Council Member", billing: "Co-starring", note: "Spoke on the I-25/College diverging diamond.", src: "debrief" },
  { name: "Kylie Soden", role: "City Clerk", billing: "Keeper of the record", note: "Expected per the last published roll call (Aug 24).", src: "Aug 24 minutes" },
  { name: "Skybox (O\u2019Neal)", role: "Developer representative", billing: "Guest star", note: "Described staffing, water use and a lease that exists only as \u201cverbal conversations\u201d.", src: "debrief" },
  { name: "Trammell Crow (Nakashima)", role: "Developer representative", billing: "Guest star", note: "Orchard Hills; offered buffer, noise and lighting conditions in writing.", src: "debrief" },
  { name: "Doug Samuelson", role: "Landowner / applicant", billing: "Guest star", note: "Swan Ranch LLC & Clear Creek Land Co LLC (Hitching Post).", src: "packet item 10" },
  { name: "Trey Rinne (AVI P.C.)", role: "Agent", billing: "Guest star", note: "Agent for Orchard Hills LLC.", src: "packet item 14" },
  { name: "Cox Ranches LLC / Cox Revocable Trust", role: "Applicant", billing: "Title role", note: "Applicant on the three Cox ordinances.", src: "packet items 7\u20139" },
  { name: "Planning staff (White, Bloom)", role: "City staff", billing: "Supporting", note: "Answered questions on notice dates, lighting and the Comprehensive Plan.", src: "debrief" },
  { name: "Charles Miller", role: "Public commenter", billing: "Recurring", note: "Listed as a public speaker in the official minutes on several 2026 items.", src: "minutes" },
];

function parseRoll(text: string) {
  const flat = text.replace(/\s+/g, " ");
  const m = flat.match(/Present were:\s*MAYOR\s*[–—-]\s*(.+?)\s+COUNCIL MEMBERS\s*[–—-]\s*(.+?)\.\s*Also present:\s*(.+?)\.\s/i);
  if (!m) return null;
  const clean = (n: string) => n.replace(/\(.*$/, "").replace(/\s*[,;]\s*(Mayor|Council Member).*$/, "").trim().replace(/[ ,;.]+$/, "");
  const members = m[2]
    .split(/\s*\.?\s*Absent\b/)[0]
    .split(/,\s*|\s+and\s+/)
    .map(clean)
    .filter((x) => x && !/\d|joining/.test(x));
  const clerk = (m[3].match(/([A-Z][a-z]+ [A-Z][a-z]+),\s*City Clerk/) ?? [])[1] ?? null;
  return { mayor: clean(m[1]), members, clerk };
}

function parseCommenters(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.replace(/\s+/g, " ").matchAll(/Public comments? (?:was|were) made by:?\s*(.*?)\.\s/g)) {
    for (const p of m[1].split(/,\s*|\s+and\s+/)) {
      const nm = p.trim();
      if (/^[A-Z][a-z]+(?: [A-Z]\.?)?(?: [A-Z][a-z'’-]+){1,2}$/.test(nm) && !/LLC|Inc|Group|Company/.test(nm)) out.add(nm);
    }
  }
  return [...out].slice(0, 10);
}

function locationsOf(items: Item[]) {
  const out: { text: string; osm: string }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const m = it.title.match(/(?:land|property|parcel|lot)s?\s+(?:generally\s+)?(?:located\s+)?((?:west|east|north|south|southwest|southeast|northwest|northeast|at|adjacent)[^.(]{12,200})/i);
    if (!m) continue;
    const text = m[1].replace(/\s+/g, " ").trim();
    const key = text.slice(0, 50).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const road = text.match(/([A-Z][A-Za-z0-9.' ]{2,30}(?:Road|Highway|Drive|Street|Avenue|Boulevard|Parkway|Lane|Way))/);
    const q = road ? `${road[1]}, Cheyenne, WY` : "Cheyenne, WY";
    out.push({ text, osm: `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}` });
    if (out.length >= 10) break;
  }
  return out;
}

// ------------------------------------------------------------------ queries
export async function listEpisodes(opts: { body?: string; season?: number; q?: string; phase?: string; limit?: number; offset?: number; withMinutes?: boolean }) {
  await ensureSeeded();
  const conds = [];
  if (opts.body) conds.push(eq(meetings.body, opts.body));
  if (opts.season) conds.push(eq(meetings.season, opts.season));
  if (opts.phase) conds.push(eq(meetings.phase, opts.phase));
  if (opts.withMinutes) conds.push(eq(meetings.hasMinutesText, true));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(meetings.title, like), ilike(meetings.logline, like), ilike(meetings.date, like), ilike(meetings.bodyName, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select().from(meetings).where(where).orderBy(desc(meetings.date)).limit(opts.limit ?? 48).offset(opts.offset ?? 0);
  const total = await db.select({ n: sql<number>`count(*)::int` }).from(meetings).where(where);
  return { rows: rows as Meeting[], total: total[0]?.n ?? 0 };
}

export async function seasonSummary() {
  await ensureSeeded();
  const rows = await db.execute(sql`select season, body, count(*)::int as n from meetings group by season, body order by season desc`);
  return rows.rows as { season: number; body: string; n: number }[];
}

export async function getFeatured(): Promise<Meeting> {
  await ensureSeeded();
  const r = await db.select().from(meetings).where(eq(meetings.featured, true)).limit(1);
  return r[0] as Meeting;
}

export async function getFeaturedContent(): Promise<Featured | null> {
  await ensureSeeded();
  const r = await db.select({ c: episodeContent.content }).from(episodeContent).limit(1);
  return (r[0]?.c as Featured) ?? null;
}

export async function getDocument(id: number) {
  await ensureSeeded();
  const r = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return r[0] ?? null;
}

export async function listOrdinances(opts: { q?: string; kind?: string; limit?: number; offset?: number }) {
  await ensureSeeded();
  const conds = [];
  if (opts.kind) conds.push(eq(ordinances.kind, opts.kind));
  if (opts.q) conds.push(ilike(ordinances.title, `%${opts.q}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(ordinances)
      .where(where)
      .orderBy(desc(ordinances.lastDate))
      .limit(opts.limit ?? 30)
      .offset(opts.offset ?? 0),
    db.select({ n: sql<number>`count(*)::int` }).from(ordinances).where(where),
  ]);
  return { rows, total: totalRow[0]?.n ?? 0 };
}

export async function getOrdinance(slug: string) {
  await ensureSeeded();
  const r = await db.select().from(ordinances).where(eq(ordinances.slug, slug)).limit(1);
  if (!r[0]) return null;
  const slugs = [...new Set(r[0].readings.map((x) => x.meeting).filter((x): x is string => !!x))];
  const ms = slugs.length
    ? await db
        .select({
          id: meetings.id,
          slug: meetings.slug,
          title: meetings.title,
          date: meetings.date,
          bodyName: meetings.bodyName,
          videoUrl: meetings.videoUrl,
          mp4Url: meetings.mp4Url,
          agendaUrl: meetings.agendaUrl,
          minutesUrl: meetings.minutesUrl,
          extraLinks: meetings.extraLinks,
        })
        .from(meetings)
        .where(inArray(meetings.slug, slugs))
    : [];
  const meetingIds = ms.map((m) => m.id);
  const [turns, docs, votes] = await Promise.all([
    slugs.length
      ? db.select().from(speakerTurns).where(inArray(speakerTurns.meetingSlug, slugs)).orderBy(asc(speakerTurns.date), asc(speakerTurns.startSec))
      : Promise.resolve([]),
    meetingIds.length
      ? db
          .select({
            id: documents.id,
            meetingId: documents.meetingId,
            role: documents.role,
            itemNo: documents.itemNo,
            title: documents.title,
            url: documents.url,
            pages: documents.pages,
            words: documents.words,
            ocr: documents.ocr,
            sha1: documents.sha1,
          })
          .from(documents)
          .where(inArray(documents.meetingId, meetingIds))
      : Promise.resolve([]),
    meetingIds.length
      ? db.select().from(voteEvents).where(inArray(voteEvents.meetingId, meetingIds)).orderBy(asc(voteEvents.idx))
      : Promise.resolve([]),
  ]);
  return { ord: r[0], episodes: ms, speakerTurns: turns as SpeakerTurn[], docs, votes };
}

export async function getProvenanceBundle(): Promise<ProvenanceCatalogData | null> {
  await ensureSeeded();
  const r = await db.select().from(provenanceCatalog).where(eq(provenanceCatalog.key, "master")).limit(1);
  return (r[0]?.payload as unknown as ProvenanceCatalogData) ?? null;
}

export async function listSpeakersDirectory(opts?: { q?: string; theme?: string; emotion?: string; limit?: number }) {
  await ensureSeeded();
  const conds = [];
  if (opts?.q) conds.push(or(ilike(speakersDirectory.name, `%${opts.q}%`), ilike(speakersDirectory.role, `%${opts.q}%`))!);
  if (opts?.emotion) conds.push(eq(speakersDirectory.dominantEmotion, opts.emotion));
  if (opts?.theme) conds.push(sql`${speakersDirectory.topThemes} @> ${JSON.stringify([opts.theme])}::jsonb`);
  const rows = await db
    .select()
    .from(speakersDirectory)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(speakersDirectory.turnCount), desc(speakersDirectory.maxImpactScore))
    .limit(opts?.limit ?? 150);
  return rows as SpeakerProfile[];
}

export async function querySpeakerTurns(opts: {
  speakerSlug?: string;
  date?: string;
  ordinanceSlug?: string;
  theme?: string;
  emotion?: string;
  capacity?: string;
  stance?: string;
  poeOnly?: boolean;
  q?: string;
  sort?: "impact" | "newest" | "oldest";
  limit?: number;
  offset?: number;
}) {
  await ensureSeeded();
  const conds = [];
  if (opts.speakerSlug) conds.push(eq(speakerTurns.speakerSlug, opts.speakerSlug));
  if (opts.date) conds.push(eq(speakerTurns.date, opts.date));
  if (opts.emotion) conds.push(eq(speakerTurns.emotion, opts.emotion));
  if (opts.capacity) conds.push(eq(speakerTurns.speakingCapacity, opts.capacity));
  if (opts.stance) conds.push(eq(speakerTurns.stance, opts.stance));
  if (opts.poeOnly) conds.push(eq(speakerTurns.hasPointOfOrder, true));
  if (opts.theme) conds.push(sql`${speakerTurns.themes} @> ${JSON.stringify([opts.theme])}::jsonb`);
  if (opts.ordinanceSlug) conds.push(sql`${speakerTurns.ordinances} @> ${JSON.stringify([{ slug: opts.ordinanceSlug }])}::jsonb`);
  if (opts.q) {
    const lk = `%${opts.q}%`;
    conds.push(or(ilike(speakerTurns.text, lk), ilike(speakerTurns.speakerName, lk), ilike(speakerTurns.date, lk), ilike(speakerTurns.bodyName, lk))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const order =
    opts.sort === "oldest"
      ? [asc(speakerTurns.date), asc(speakerTurns.startSec)]
      : opts.sort === "newest"
        ? [desc(speakerTurns.date), asc(speakerTurns.startSec)]
        : [desc(speakerTurns.impactScore), desc(speakerTurns.date)];

  const [rows, totalRow, datesAgg] = await Promise.all([
    db
      .select()
      .from(speakerTurns)
      .where(where)
      .orderBy(...order)
      .limit(opts.limit ?? 36)
      .offset(opts.offset ?? 0),
    db.select({ n: sql<number>`count(*)::int` }).from(speakerTurns).where(where),
    db.execute(sql`select date, body_name as "bodyName", meeting_slug as "meetingSlug", count(*)::int as turns, count(distinct speaker_slug)::int as speakers from speaker_turns group by date, body_name, meeting_slug order by date desc limit 80`),
  ]);
  return {
    rows: rows as SpeakerTurn[],
    total: totalRow[0]?.n ?? 0,
    recentDates: datesAgg.rows as { date: string; bodyName: string; meetingSlug: string; turns: number; speakers: number }[],
  };
}

export async function listOsintEntities(opts: { q?: string; category?: string; entitySlug?: string; limit?: number; offset?: number }) {
  await ensureSeeded();
  const conds = [];
  if (opts.category) conds.push(eq(osintEntities.category, opts.category));
  if (opts.entitySlug) conds.push(eq(osintEntities.slug, opts.entitySlug));
  if (opts.q) {
    const lk = `%${opts.q}%`;
    conds.push(
      or(
        ilike(osintEntities.name, lk),
        ilike(osintEntities.subtype, lk),
        ilike(osintEntities.nexusSummary, lk),
        ilike(osintEntities.address, lk),
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(osintEntities)
      .where(where)
      .orderBy(desc(osintEntities.trackedContractValueUsd), desc(osintEntities.meetingCount), asc(osintEntities.name))
      .limit(opts.limit ?? 24)
      .offset(opts.offset ?? 0),
    db.select({ n: sql<number>`count(*)::int` }).from(osintEntities).where(where),
  ]);
  return { rows: rows as OsintEntity[], total: totalRow[0]?.n ?? 0 };
}

export async function getSpeakerVault(slug: string) {
  await ensureSeeded();
  const prof = await db.select().from(speakersDirectory).where(eq(speakersDirectory.slug, slug)).limit(1);
  if (!prof[0]) return null;
  const turns = await db
    .select()
    .from(speakerTurns)
    .where(eq(speakerTurns.speakerSlug, slug))
    .orderBy(desc(speakerTurns.date), asc(speakerTurns.startSec));
  const ordSlugs = prof[0].ordinanceSlugs;
  const ords = ordSlugs.length ? await db.select().from(ordinances).where(inArray(ordinances.slug, ordSlugs)) : [];
  return { profile: prof[0] as SpeakerProfile, turns: turns as SpeakerTurn[], ordinances: ords };
}

export async function listFoundryDocuments(opts: { q?: string; role?: string; ocrOnly?: boolean; season?: number; limit?: number; offset?: number }) {
  await ensureSeeded();
  const conds = [];
  if (opts.role) conds.push(eq(documents.role, opts.role));
  if (opts.ocrOnly) conds.push(eq(documents.ocr, true));
  if (opts.season) conds.push(eq(meetings.season, opts.season));
  if (opts.q) {
    const lk = `%${opts.q}%`;
    conds.push(or(ilike(documents.title, lk), ilike(documents.sha1, lk), ilike(meetings.date, lk), ilike(meetings.bodyName, lk))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: documents.id,
        role: documents.role,
        itemNo: documents.itemNo,
        title: documents.title,
        url: documents.url,
        pages: documents.pages,
        words: documents.words,
        ocr: documents.ocr,
        sha1: documents.sha1,
        meetingSlug: meetings.slug,
        date: meetings.date,
        season: meetings.season,
        bodyName: meetings.bodyName,
        episodeTitle: meetings.title,
      })
      .from(documents)
      .innerJoin(meetings, eq(documents.meetingId, meetings.id))
      .where(where)
      .orderBy(desc(meetings.date), asc(documents.id))
      .limit(opts.limit ?? 60)
      .offset(opts.offset ?? 0),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(documents)
      .innerJoin(meetings, eq(documents.meetingId, meetings.id))
      .where(where),
  ]);
  return { rows, total: totalRow[0]?.n ?? 0 };
}

export async function getCast() {
  await ensureSeeded();
  return db.select().from(people).orderBy(desc(people.meetingsPresent));
}

async function seriesFor(meeting: Meeting, items: Item[]): Promise<OrdSeries[]> {
  const ordItems = items.filter((i) => i.kind === "ordinance");
  if (!ordItems.length) return [];
  const rows = await db.select().from(ordinances).where(sql`${ordinances.readings} @> ${JSON.stringify([{ meeting: meeting.slug }])}::jsonb`).limit(14);
  return rows.map((o) => ({
    slug: o.slug,
    title: o.title,
    kind: o.kind,
    firstDate: o.firstDate,
    lastDate: o.lastDate,
    readings: o.readings.map((r) => ({ ...r, link: r.meeting ? `/episode/${r.meeting}` : null })),
  }));
}

// ------------------------------------------------------------------ bundle
export async function getEpisodeBundle(slug: string): Promise<EpisodeBundle | null> {
  await ensureSeeded();
  const mrow = await db.select().from(meetings).where(eq(meetings.slug, slug)).limit(1);
  if (!mrow[0]) return null;
  const meeting = mrow[0] as Meeting;

  const [itemRows, voteRows, briefRows, docRows, epTurns, provBundle] = await Promise.all([
    db.select().from(agendaItems).where(eq(agendaItems.meetingId, meeting.id)).orderBy(asc(agendaItems.pos)),
    db.select().from(voteEvents).where(eq(voteEvents.meetingId, meeting.id)).orderBy(asc(voteEvents.idx)),
    db.select().from(briefs).where(eq(briefs.meetingId, meeting.id)).orderBy(asc(briefs.id)),
    db
      .select({ id: documents.id, role: documents.role, itemNo: documents.itemNo, title: documents.title, url: documents.url, pages: documents.pages, words: documents.words, ocr: documents.ocr, sha1: documents.sha1, hasText: sql<boolean>`${documents.body} is not null` })
      .from(documents)
      .where(eq(documents.meetingId, meeting.id))
      .orderBy(asc(documents.id)),
    db.select().from(speakerTurns).where(eq(speakerTurns.meetingSlug, meeting.slug)).orderBy(asc(speakerTurns.startSec)),
    getProvenanceBundle(),
  ]);
  const items = itemRows.map((i) => ({ itemNo: i.itemNo, pos: i.pos, title: i.title, action: i.action, sponsor: i.sponsor, consent: i.consent, kind: i.kind, reading: i.reading, amountUsd: i.amountUsd })) as Item[];
  const minutesDoc = await db.select({ b: documents.body }).from(documents).where(and(eq(documents.meetingId, meeting.id), eq(documents.role, "minutes"))).limit(1);
  const minutesText = minutesDoc[0]?.b ?? null;

  const fc = (await db.select({ c: episodeContent.content }).from(episodeContent).where(eq(episodeContent.meetingId, meeting.id)).limit(1))[0]?.c as Featured | undefined;
  const glossarySource = fc ?? (await getFeaturedContent());

  const prevRow = await db.select().from(meetings).where(and(eq(meetings.body, meeting.body), lt(meetings.date, meeting.date))).orderBy(desc(meetings.date)).limit(1);
  const nextRows = await db.select().from(meetings).where(gt(meetings.date, meeting.date)).orderBy(asc(meetings.date)).limit(4);
  const nextSame = await db.select().from(meetings).where(and(eq(meetings.body, meeting.body), gt(meetings.date, meeting.date))).orderBy(asc(meetings.date)).limit(1);
  const seasonRows = await db.select({ slug: meetings.slug, title: meetings.title, episodeNo: meetings.episodeNo }).from(meetings).where(and(eq(meetings.body, meeting.body), eq(meetings.season, meeting.season))).orderBy(asc(meetings.date));

  // roll call (own minutes, otherwise most recent earlier minutes)
  let roll = minutesText ? parseRoll(minutesText) : null;
  let rollFrom: string | null = roll ? meeting.date : null;
  if (!roll) {
    const r = await db.execute(sql`select m.date, d.body from documents d join meetings m on m.id=d.meeting_id where d.role='minutes' and m.date <= ${meeting.date} order by m.date desc limit 1`);
    const row = r.rows[0] as { date: string; body: string } | undefined;
    if (row) {
      roll = parseRoll(row.body);
      rollFrom = row.date;
    }
  }
  const commenters = minutesText ? parseCommenters(minutesText) : [];

  const dissentThis = new Map<string, number>();
  for (const v of voteRows) for (const n of v.noNames) dissentThis.set(n, (dissentThis.get(n) ?? 0) + 1);

  let cast: CastMember[] = [];
  let castNote = "";
  if (fc) {
    cast = FEATURED_CAST;
    castNote = "Billing combines the Aug 24 roll call (the last published), agenda packet, and the watchdog debrief. Names that came from auto-captions are normalized and flagged.";
  } else if (roll) {
    cast.push({ name: roll.mayor, role: "Mayor", billing: "Presiding", note: "", src: `roll call ${rollFrom}` });
    for (const m of roll.members) {
      const last = m.split(" ").pop() ?? m;
      const d = dissentThis.get(last) ?? 0;
      cast.push({ name: m, role: "Council Member", billing: d ? "Starring" : "Co-starring", note: d ? `Voted no on ${d} recorded motion${d > 1 ? "s" : ""}.` : "", src: `roll call ${rollFrom}` });
    }
    if (roll.clerk) cast.push({ name: roll.clerk, role: "City Clerk", billing: "Keeper of the record", note: "", src: `roll call ${rollFrom}` });
    for (const c of commenters) cast.push({ name: c, role: "Public commenter", billing: "Guest star", note: "Named in the minutes as a public speaker.", src: "minutes" });
    castNote = rollFrom === meeting.date ? "Cast taken from this episode\u2019s official roll call." : `No minutes for this episode yet \u2014 expected cast from the last published roll call (${rollFrom}).`;
  } else {
    castNote = "No roll call is available for this episode in the dataset.";
  }

  // ----- analytics
  const byKindMap = new Map<string, number>();
  for (const i of items) byKindMap.set(i.kind, (byKindMap.get(i.kind) ?? 0) + 1);
  const amounts = items.filter((i) => i.amountUsd).map((i) => ({ itemNo: i.itemNo, title: short(i.title, 90), amount: i.amountUsd as number })).sort((a, b) => b.amount - a.amount);
  const sponsorMap = new Map<string, number>();
  for (const i of items) {
    const s = (i.sponsor || "").replace(/^SPONSOR\s*[–-]\s*/i, "").trim();
    if (s) sponsorMap.set(s, (sponsorMap.get(s) ?? 0) + 1);
  }
  const flagMap = new Map<string, number>();
  for (const b of briefRows) for (const f of b.flags) flagMap.set(f.sev, (flagMap.get(f.sev) ?? 0) + 1);

  const peersRaw = await db.select().from(meetings).where(and(eq(meetings.body, meeting.body), lt(meetings.date, meeting.date))).orderBy(desc(meetings.date)).limit(6);
  const peers = await Promise.all(
    peersRaw.map(async (p) => {
      const c = await db.execute(sql`select (select count(*)::int from agenda_items where meeting_id=${p.id}) as items, (select count(*)::int from vote_events where meeting_id=${p.id}) as votes, (select count(*)::int from agenda_items where meeting_id=${p.id} and kind='ordinance') as ords`);
      const r = c.rows[0] as { items: number; votes: number; ords: number };
      return { slug: p.slug, date: p.date, items: r.items, votes: r.votes, runtime: p.runtimeMin, ordinances: r.ords };
    }),
  );
  const analytics: Analytics = {
    itemCount: items.length,
    substantive: items.filter((i) => i.kind !== "procedural").length,
    consentCount: items.filter((i) => i.consent).length,
    byKind: [...byKindMap.entries()].map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n),
    amounts: amounts.slice(0, 8),
    amountTotal: amounts.reduce((s, a) => s + a.amount, 0),
    sponsors: [...sponsorMap.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 6),
    votes: { total: voteRows.length, unanimous: voteRows.filter((v) => v.unanimous).length, failed: voteRows.filter((v) => v.result === "failed").length, split: voteRows.filter((v) => v.noNames.length && v.result !== "failed").length },
    dissent: [...dissentThis.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    docs: { n: docRows.length, pages: docRows.reduce((s, d) => s + (d.pages ?? 0), 0), words: docRows.reduce((s, d) => s + (d.words ?? 0), 0), ocr: docRows.filter((d) => d.ocr).length },
    flags: ["HIGH", "MED", "LOW"].map((sev) => ({ sev, n: flagMap.get(sev) ?? 0 })),
    minutesWords: minutesText ? minutesText.split(/\s+/).length : 0,
    peers,
  };

  // ----- show (TV structure)
  const real = items.filter((i) => i.kind !== "procedural");
  const ordItems = items.filter((i) => i.kind === "ordinance");
  const bodyKey = meeting.body;
  const code = `${CODE[bodyKey] ?? "EP"} S${meeting.season}E${String(meeting.episodeNo).padStart(2, "0")}`;

  let acts: Act[];
  if (fc) {
    acts = fc.acts as Act[];
  } else {
    const groups: [string, string, (i: Item) => boolean][] = [
      ["Cold Open", "Roll call, pledge, consent agenda and minutes.", (i) => i.kind === "procedural" || i.kind === "minutes"],
      ["Public Hearings", "Hearings that take public testimony.", (i) => i.kind === "hearing"],
      ["The Ordinance Arc", "Ordinances moving through their three readings.", (i) => i.kind === "ordinance"],
      ["Resolutions", "Statements and policy decisions.", (i) => i.kind === "resolution"],
      ["Contracts, Bids & Money", "Agreements, purchases and bids with dollar figures.", (i) => i.kind === "contract" || i.kind === "bid"],
      ["Other Business", "Everything else on the call sheet.", (i) => i.kind === "other"],
    ];
    acts = groups
      .map(([name, beat, f], n) => ({ n, name, beat: `${beat} (${items.filter(f).length})`, items: items.filter(f).map((i) => i.itemNo) }))
      .filter((a) => a.items.length);
  }

  let montage: Montage[];
  if (fc) {
    montage = fc.montage as Montage[];
  } else {
    montage = [];
    if (items.length) montage.push({ big: String(items.length), small: "agenda items on the call sheet" });
    if (ordItems.length) montage.push({ big: String(ordItems.length), small: "ordinance readings" });
    if (amounts[0]) montage.push({ big: money(amounts[0].amount), small: `largest dollar item: ${short(amounts[0].title, 48)}` });
    if (voteRows.length) montage.push({ big: String(voteRows.length), small: "recorded votes in the minutes" });
    if (analytics.votes.failed) montage.push({ big: String(analytics.votes.failed), small: "motions failed" });
    if (meeting.runtimeMin) montage.push({ big: hm(meeting.runtimeMin), small: "runtime, gavel to gavel" });
    if (!montage.length) montage.push({ big: meeting.date.slice(5).replace("-", "/"), small: meeting.bodyName }, { big: `S${meeting.season}`, small: `Episode ${meeting.episodeNo} of ${meeting.seasonSize}` });
  }

  const themeLyrics: string[] = fc
    ? (fc.themeLyrics as string[])
    : [
        "Gavel comes down, the agenda unfolds,",
        `${meeting.bodyName}, and the story is told.`,
        "Read it once, read it twice, read it three,",
        "Every vote on the record for the whole city to see.",
        "This is the Real Windy City \u2014",
        "Roll call\u2026 and we\u2019re on the air!",
      ];

  // previously
  let previously: Recap[] = [];
  if (fc) {
    previously = fc.previously as Recap[];
  } else if (prevRow[0]) {
    const p = prevRow[0];
    const pv = await db.select().from(voteEvents).where(eq(voteEvents.meetingId, p.id)).orderBy(asc(voteEvents.idx));
    const pit = await db.select().from(agendaItems).where(eq(agendaItems.meetingId, p.id)).orderBy(asc(agendaItems.pos));
    const score = (v: (typeof pv)[number]) =>
      (v.result === "failed" ? 4 : 0) + (v.noNames.length ? 3 : 0) + (/ORDINANCE|RESOLUTION|Agreement|Contract|Bid|hearing/i.test(v.excerpt) ? 2 : 0) - (/^Consent Agenda|^Upon request/i.test(v.excerpt) ? 10 : 0);
    const picks = [...pv].sort((a, b) => score(b) - score(a)).slice(0, 3);
    previously = picks.map((v) => ({ date: p.date, slug: p.slug, text: short(v.excerpt, 200), src: "official minutes" }));
    if (!previously.length) previously = pit.filter((i) => i.kind !== "procedural").slice(0, 3).map((i) => ({ date: p.date, slug: p.slug, text: short(i.title, 180), src: "agenda" }));
    if (!previously.length) previously = [{ date: p.date, slug: p.slug, text: `${p.title} \u2014 ${p.logline}`, src: "season guide" }];
  }

  // to be continued
  let toBeContinued: Recap[] = [];
  if (fc) {
    toBeContinued = fc.toBeContinued as Recap[];
  } else {
    toBeContinued = items
      .filter((i) => /refer|postpon/i.test(i.action) || (i.kind === "ordinance" && i.reading !== "third"))
      .slice(0, 6)
      .map((i) => ({ text: `${i.reading ? sentenceCase(i.reading) + " reading \u2014 " : ""}${short(i.title, 140)}${i.action ? ` (${short(i.action, 60)})` : ""}`, src: `item ${i.itemNo}` }));
  }

  // next time
  let nextTime: Recap[] = [];
  if (fc) {
    const dates = new Set<string>();
    const found = await db.select({ slug: meetings.slug }).from(meetings);
    for (const f of found) dates.add(f.slug);
    nextTime = (fc.nextTime as Recap[]).map((n) => {
      const key = BODY_KEY[n.body ?? ""] ?? "council";
      const s = `${n.date}-${key}`;
      return { ...n, slug: dates.has(s) ? s : null };
    });
  } else {
    nextTime = nextRows.slice(0, 3).map((n) => ({ date: n.date, body: n.bodyName, text: n.title, slug: n.slug, src: "season guide" }));
  }

  const tagline = fc ? (fc.tagline as string) : meeting.logline.split(". ").slice(0, 1).join(". ");
  const show: Show = {
    code,
    title: meeting.title,
    tagline,
    logline: meeting.logline,
    rating: fc ? (fc.rating as string) : meeting.runtimeMin && meeting.runtimeMin > 240 ? "TV-14" : "TV-G",
    ratingNote: fc ? (fc.ratingNote as string) : meeting.runtimeMin && meeting.runtimeMin > 240 ? "Long-form: runtime over four hours." : "Routine municipal business.",
    tags: meeting.tags,
    runtimeLabel: meeting.runtimeMin ? hm(meeting.runtimeMin) : null,
    acts,
    montage,
    themeLyrics,
    previously,
    toBeContinued,
    nextTime,
    cast,
    castNote,
  };

  // ----- lenses
  const authored = !!fc;
  const failedVotes = voteRows.filter((v) => v.result === "failed");
  const splitVotes = voteRows.filter((v) => v.noNames.length && v.result !== "failed");
  const topItems = real.filter((i) => i.kind !== "minutes").slice(0, 3);
  const layman = fc
    ? (fc.layman as Lenses["layman"])
    : {
        headline: items.length
          ? `${meeting.bodyName}, ${prettyDate(meeting.date)}: ${real.length} items${voteRows.length ? `, ${voteRows.length} recorded votes` : ""}${failedVotes.length ? `, ${failedVotes.length} failed` : ""}.`
          : `${meeting.bodyName}, ${prettyDate(meeting.date)}.`,
        brief: [
          `On ${prettyDate(meeting.date)} the ${meeting.bodyName} met${meeting.runtimeMin ? ` for ${hm(meeting.runtimeMin)}` : ""}.${items.length ? ` The agenda listed ${items.length} items; ${analytics.consentCount} were routine items passed together on the consent agenda.` : " This episode is listed in the season guide with source links, but the agenda was not extracted into item-level data."}`,
          topItems.length ? `What came up: ${topItems.map((i) => short(i.title, 110)).join(" \u2022 ")}` : "No substantive item titles are available for this episode.",
          voteRows.length
            ? `How the votes went (parsed from the official minutes): ${analytics.votes.unanimous} of ${analytics.votes.total} recorded motions were unanimous${analytics.votes.failed ? `, ${analytics.votes.failed} failed` : ""}${analytics.dissent.length ? `; members voting no: ${analytics.dissent.map((d) => `${d.name} (${d.n})`).join(", ")}` : ""}.`
            : "No vote events were parsed for this episode (no minutes text in the dataset).",
        ],
        deep: [
          ordItems.length ? `Ordinances: ${ordItems.map((o) => `${o.reading ? sentenceCase(o.reading) + " reading" : "listed"} \u2014 ${short(o.title, 100)}`).join("; ")}.` : "No ordinance readings were on this agenda.",
          amounts.length ? `Money on the table: ${amounts.slice(0, 4).map((a) => `${money(a.amount)} (${short(a.title, 60)})`).join("; ")}. Listed dollar figures total ${money(analytics.amountTotal)}.` : "No dollar figures were detected in the item titles or recommended actions.",
          "This summary is generated from structured fields (agenda titles, recommended actions, parsed minutes). It does not add facts that aren\u2019t in those fields.",
        ],
        kids: `A group of people who run the city met to talk about ${real.length || "some"} things and ${voteRows.length ? `voted ${voteRows.length} times` : "make decisions"}.`,
      };

  const tabStories: Lenses["tabloid"]["stories"] = [];
  for (const v of failedVotes.slice(0, 2)) tabStories.push({ headline: `MOTION FAILS: ${short(v.excerpt.replace(/^\[CA\]\s*/, ""), 70).toUpperCase()}`, deck: v.noNames.length ? `Voting no: ${v.noNames.join(", ")}.` : "Result recorded as failed in the minutes.", body: short(v.excerpt, 260), receipts: "Official minutes" });
  for (const v of splitVotes.slice(0, 2)) tabStories.push({ headline: `SPLIT DECISION: ${v.noNames.join(" & ").toUpperCase()} SAY NO`, deck: short(v.excerpt, 110), body: short(v.excerpt, 260), receipts: "Official minutes" });
  for (const a of amounts.slice(0, 2)) tabStories.push({ headline: `${money(a.amount).toUpperCase()} ON THE TABLE`, deck: a.title, body: `Item ${a.itemNo}. The figure comes straight from the item title or recommended action.`, receipts: `Agenda item ${a.itemNo}` });
  for (const o of ordItems.slice(0, 2)) tabStories.push({ headline: `${(o.reading ?? "listed").toUpperCase()} READING: ${short(o.title.replace(/^ORDINANCE\s*[–-]\s*\d\w+ READING\s*[–-]\s*/i, ""), 64).toUpperCase()}`, deck: o.action || "On the agenda.", body: short(o.title, 240), receipts: `Agenda item ${o.itemNo}` });
  if (!tabStories.length) tabStories.push({ headline: "QUIET NIGHT AT THE DAIS", deck: "Nothing in the dataset for this episode beyond its listing.", body: meeting.logline, receipts: "Season guide (Wayback capture)" });
  const tabloid = fc
    ? (fc.tabloid as Lenses["tabloid"])
    : { masthead: "THE WINDY CITY GAZETTE", slogan: "Every word of the record. Louder.", banner: tabStories[0].headline, stories: tabStories.slice(0, 5) };

  const statutes = new Set<string>();
  for (const i of items) for (const m of i.title.matchAll(/(?:W\.S\.|Wyoming Statute)\s*§+\s*([\d-]+(?:\([a-z]+\))?(?:\s*(?:&|and)\s*[\d-]+)?)/g)) statutes.add(m[1]);
  const legal = fc
    ? (fc.legal as Lenses["legal"])
    : {
        disclaimer: "Auto-assembled from agenda text. Not legal advice; verify against the Municipal Code, Wyoming Statutes and the final minutes.",
        issues: [
          ...ordItems.slice(0, 4).map((o, n) => ({
            id: `ord${n}`,
            question: `Where is this ordinance in its three readings? (${short(o.title.replace(/^ORDINANCE\s*[–-]\s*\d\w+ READING\s*[–-]\s*/i, ""), 80)})`,
            rule: "Cheyenne ordinances are read and voted on up to three times; committees often review between readings.",
            application: `Agenda item ${o.itemNo}: ${o.reading ? sentenceCase(o.reading) + " reading" : "listed"}${o.action ? `, recommended action \u201c${o.action}\u201d` : ""}${o.sponsor ? `, ${o.sponsor.toLowerCase()}` : ""}.`,
            conclusion: o.reading === "third" ? "Final reading on this agenda." : "Not final \u2014 at least one more reading follows.",
            cites: ["Agenda packet", "Ordinance series (see History lens)"],
          })),
          ...[...statutes].slice(0, 4).map((s, n) => ({
            id: `ws${n}`,
            question: `Which statute does the agenda cite? W.S. \u00a7${s}`,
            rule: `The agenda cites W.S. \u00a7${s} in an item title.`,
            application: "See the item title and attachments for how it is applied.",
            conclusion: "Read the statute text at wyoleg.gov; this lens does not paraphrase statutes it has not verified.",
            cites: [`W.S. \u00a7${s}`],
          })),
          ...(amounts.length ? [{ id: "nte", question: "Do the dollar figures bind the city?", rule: "\u201cNot to exceed\u201d is a ceiling on a contract or purchase approved by the governing body.", application: `${amounts.length} item(s) carry a dollar figure; the largest is ${money(amounts[0].amount)}.`, conclusion: "A new approval would be needed to exceed an approved ceiling.", cites: ["Agenda recommended actions"] }] : []),
        ],
      };
  if (!legal.issues.length) legal.issues.push({ id: "none", question: "No legal issues are extractable for this episode.", rule: "\u2014", application: "No item-level data in the dataset.", conclusion: "Open the source agenda for the full text.", cites: [] });

  const glossary = ((glossarySource?.glossary as Lenses["glossary"]) ?? []).filter((g) => fc || /reading|consent|refer|postpon|annex|zoning|not to exceed|executive|point of order|substitute/i.test(g.term) || items.some((i) => i.title.toLowerCase().includes(g.term.toLowerCase().split(" ")[0])));

  const script: Lenses["script"] = fc
    ? (fc.script as Lenses["script"])
    : [
        { t: "scene", text: `INT. COUNCIL CHAMBERS \u2014 ${prettyDate(meeting.date).toUpperCase()}` },
        { t: "action", text: `${meeting.bodyName} convenes${meeting.startMin ? ` at ${Math.floor(meeting.startMin / 60) % 12 || 12}:${String(meeting.startMin % 60).padStart(2, "0")} ${meeting.startMin >= 720 ? "P.M." : "A.M."}` : ""}.${roll ? ` MAYOR ${roll.mayor.toUpperCase()} presides.` : ""}` },
        ...real.slice(0, 7).map((i) => ({ t: "action", text: `ITEM ${i.itemNo}: ${short(i.title, 150)}${i.action ? ` \u2014 ${short(i.action, 60)}` : ""}` })),
        ...voteRows.slice(0, 4).map((v) => ({ t: "dialogue", who: "THE CLERK", paren: "official minutes", text: short(v.excerpt, 170) })),
        { t: "transition", text: meeting.endMin ? `SMASH CUT TO: ADJOURNED AT ${Math.floor(meeting.endMin / 60) % 12 || 12}:${String(meeting.endMin % 60).padStart(2, "0")} ${meeting.endMin >= 720 ? "P.M." : "A.M."}` : "FADE OUT." },
      ];

  const series = await seriesFor(meeting, items);

  const lenses: Lenses = {
    authored,
    layman,
    tabloid,
    legal,
    glossary,
    script,
    scoreboard: fc ? (fc.scoreboard as Lenses["scoreboard"]) : [],
    moments: fc ? (fc.moments as Lenses["moments"]) : [],
    coxTimeline: fc ? (fc.coxTimeline as Lenses["coxTimeline"]) : [],
    compare: fc ? (fc.compare as Lenses["compare"]) : [],
    sweetgrass: fc ? (fc.sweetgrass as Lenses["sweetgrass"]) : [],
    map: fc ? (fc.map as Lenses["map"]) : null,
    locations: locationsOf(items),
  };

  const wbCaps = ((fc?.captures as string[] | undefined) ?? (glossarySource?.captures as string[] | undefined) ?? [WB_TS]).map((ts) => ({ ts, url: `https://web.archive.org/web/${ts}/${WB_PAGE}` }));

  return {
    meeting,
    show,
    items,
    voteEvents: voteRows.map((v) => ({ idx: v.idx, excerpt: v.excerpt, result: v.result, unanimous: v.unanimous, noNames: v.noNames, source: v.source })),
    briefs: briefRows.map((b) => ({ itemNo: b.itemNo, title: b.title, docId: b.docId, facts: b.facts, flags: b.flags, quotes: b.quotes })),
    docs: docRows as EpisodeBundle["docs"],
    speakerTurns: epTurns as SpeakerTurn[],
    provenanceFilms: provBundle,
    minutesText,
    analytics,
    lenses,
    series,
    provenance: {
      waybackTs: WB_TS,
      waybackUrl: `https://web.archive.org/web/${WB_TS}/${WB_PAGE}`,
      captures: wbCaps,
      official: fc ? ((fc.provenance as Record<string, string>).official ?? "") : "Season guide row from the Wayback capture; agenda items and minutes from Granicus (as extracted by the CivicWatch pipeline) where available.",
      watchdog: fc ? ((fc.provenance as Record<string, string>).watchdog ?? null) : null,
      nameWarning: fc ? ((fc.provenance as Record<string, string>).nameWarning ?? null) : null,
    },
    nav: {
      prev: prevRow[0] ? { slug: prevRow[0].slug, title: prevRow[0].title, date: prevRow[0].date } : null,
      next: nextSame[0] ? { slug: nextSame[0].slug, title: nextSame[0].title, date: nextSame[0].date } : null,
      premiere: seasonRows[0] ? { slug: seasonRows[0].slug, title: seasonRows[0].title } : null,
      finale: seasonRows.length ? { slug: seasonRows[seasonRows.length - 1].slug, title: seasonRows[seasonRows.length - 1].title } : null,
    },
  };
}
