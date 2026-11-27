import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  meetings,
  agendaItems,
  ordinances,
  voteEvents,
  documents,
  briefs,
  people,
  episodeContent,
  speakerTurns,
  speakersDirectory,
  osintEntities,
  provenanceCatalog,
} from "@/db/schema";

type RawMeeting = {
  slug: string;
  date: string;
  body: string;
  bodyName: string;
  season: number;
  note: string;
  eventId: number | null;
  clipId: number | null;
  agendaUrl: string | null;
  minutesUrl: string | null;
  videoUrl: string | null;
  mp4Url: string | null;
  extraLinks: { label: string; url: string; kind: string }[];
  hasMinutesText: boolean;
  sources: string[];
  startMin: number | null;
  endMin: number | null;
  runtimeMin: number | null;
};
type RawItem = {
  meeting: string;
  pos: number;
  itemNo: string;
  title: string;
  action: string;
  sponsor: string;
  consent: boolean;
  kind: string;
  reading: string | null;
  amountUsd: number | null;
};

const SEED_DIR = path.join(process.cwd(), "data", "seed");
const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(SEED_DIR, f), "utf8")) as T;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function prettyDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return `${WEEKDAYS[dt.getUTCDay()]}, ${MONTHS[m - 1]} ${day}, ${y}`;
}

function roadOf(title: string): string | null {
  const m = title.match(
    /(?:west|east|north|south|southwest|southeast|northwest|northeast|adjacent to|intersection of)\s+(?:of\s+)?(?:and\s+)?([A-Z][A-Za-z0-9.' ]{2,40}?(?:Road|Highway|Drive|Street|Avenue|Boulevard|Parkway|Lane|Way|Interstate \d+))/,
  );
  return m ? m[1].trim() : null;
}

function money(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

// Agenda items in the source data include placeholders ("CALL TO ORDER & ROLL CALL", "MUNICIPAL BOARD /
// COMMISSION DOCKET — municipal-docs", "Context/Agenda: <transcript snippet>") and packet attachments
// named only "Supporting Document", "Agenda", "Exhibit A" or a raw file name ("ws-09-30-22-agenda").
// None of those tell a reader what the meeting was about, so they are never used as a title.
const GENERIC_PART =
  /^(agenda( only)?|(amended |original |updated )?supporting\s+documents?|additional\s+(documents?|information)|proposed\s+substitut(e|ion)|substitute( map)?|proposed\s+amendment|appendi(x|ces)(\s+[a-z0-9]+)?|exhibits?(\s+[a-z0-9]+)?|attachments?(\s+[a-z0-9]+)?|memo(randum)?|[a-z]+ department memo|staff\s+report|contract|agreement|(amended |updated )?resolution|(amended |updated )?ordinance|(revised |updated )?map|annexation\s+map|general|general - document|document|presentation|minutes|packet|plat|letter|report|\d{4} drawings|drawings|municipal-docs|agenda-packets|planning-commission|special meeting|regular meeting|(first|second) regular meeting|(proposed )?(revised |substitute )+map|exhibit [a-z] substitute|[\d-]+ approved substitutes|master plan)$/i;
const PLACEHOLDER = /^(CALL TO ORDER|PUBLIC RECORD & ARCHIVAL|Context\/Agenda:|CALL (MEETING TO ORDER|ROLL)|ADJOURN|PLEDGE OF ALLEGIANCE|CONSENT AGENDA|VOUCHER REPORT|REVENUE REPORT|OTHER BUSINESS|ANNOUNCEMENTS)|Regular Docket & Public Proceedings/i;
const BODY_FROM_FILE: Record<string, string> = { fc: "Finance Committee", ws: "Work Session", psc: "Public Services Committee", cow: "Committee of the Whole", cc: "City Council" };

function sentenceCase(t: string): string {
  if (t !== t.toUpperCase() || !/[A-Z]{4}/.test(t)) return t;
  return t.toLowerCase().replace(/^./, (c) => c.toUpperCase()).replace(/\bcheyenne\b/g, "Cheyenne").replace(/\bwyoming\b/g, "Wyoming");
}

function candidate(raw: string, max = 70): string | null {
  if (PLACEHOLDER.test(raw)) return null;
  if (/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.? \d{1,2},? \d{4}\b.*\bMeeting\b/i.test(raw)) return null;
  let t = raw
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:SUPPORTING PACKET DOCKET|Attached document)\s*[—–-]\s*/i, "")
    .replace(/^[A-Z /&]+ DOCKET\s*[—–-]\s*/, "")
    .replace(/\(large file\)/gi, "")
    .replace(/^Agenda Only\s*-\s*/i, "")
    .trim();
  if (!/\s/.test(t) || /_/.test(t) || /^[a-z]{1,5}-\d/i.test(t)) return null; // raw file names
  let parts = t.split(/\s+-\s+/).map((x) => x.trim()).filter(Boolean);
  const half = parts.length % 2 === 0 ? parts.length / 2 : 0;
  if (half && parts.slice(0, half).join("|") === parts.slice(half).join("|")) parts = parts.slice(0, half);
  // file titles are often "<title cut at 50 chars> - <full title>": keep only the full one
  const norm = (x: string) => x.toLowerCase().replace(/\(large fi.*$/, "").replace(/[^a-z0-9]+/g, " ").trim();
  parts = parts.filter((x, i) => {
    const nx = norm(x);
    return !parts.some((y, j) => {
      if (j === i || nx.length < 12) return false;
      const ny = norm(y);
      return (ny.length > nx.length || (ny.length === nx.length && j > i)) && ny.startsWith(nx.slice(0, Math.max(12, nx.length - 2)));
    });
  });
  parts = parts.filter((x, i) => parts.indexOf(x) === i);
  parts = parts.filter((x) => !GENERIC_PART.test(x) && !/^(work session|city council|finance committee|public services committee|committee of the whole)$/i.test(x));
  if (!parts.length) return null;
  t = parts.join(" - ");
  // nothing left once dates, body names and filler are removed -> not a description
  const rest = t
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b\.?/gi, "")
    .replace(/\b(cheyenne|city council|council|work session|finance committee|public services committee|committee of the whole|planning commission|board of adjustment|urban renewal authority|meeting|regular|special|agenda|postponed|to|final)\b/gi, "")
    .replace(/[\d\s.,/:&()–—-]+/g, "");
  if (rest.length < 3 || t.length < 6) return null;
  return shortTitle(sentenceCase(t), max);
}

function shortTitle(raw: string, max = 72): string {
  let t = raw
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\d+[a-z]?\.\s*/i, "")
    .replace(/^(?:ORDINANCE|RESOLUTION|PUBLIC HEARING)\s*[—–-]\s*(?:\d(?:st|nd|rd|th)\s+READING\s*[—–-]\s*)?/i, "")
    .replace(/^(?:Consideration of|Approval of|A Resolution|An Ordinance)\s+(?:an?\s+|the\s+)?/i, "")
    .trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length <= max) return t.replace(/[.;:,]+$/, "");
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > 30 ? cut.lastIndexOf(" ") : max).replace(/[.;:,]+$/, "") + "…";
}

const READING: Record<string, string> = { first: "1st reading", second: "2nd reading", third: "final reading" };

function episodeTitle(m: RawMeeting, allItems: RawItem[]): string {
  const items = allItems.filter((i) => !i.itemNo.startsWith("REC-"));
  const ords = items.filter((i) => i.kind === "ordinance" && !PLACEHOLDER.test(i.title));
  const dc = ords.find((i) => /data cent/i.test(i.title));
  if (dc) return `Data center rules${dc.reading ? ` (${READING[dc.reading]})` : ""}`;
  const ord = ords[0];
  if (ord) {
    const r = roadOf(ord.title);
    const t = ord.title.toLowerCase();
    const stage = ord.reading ? READING[ord.reading] : null;
    const suffix = stage ? ` (${stage})` : "";
    if (r) {
      const word = t.includes("annex") && !t.includes("zoning") ? "Annexation" : t.includes("zoning") ? "Rezoning" : "Ordinance";
      return `${word} near ${r}${suffix}`;
    }
    const sec = ord.title.match(/(?:Sections?|Chapters?|Titles?)\s+[\d.-]*\d/i);
    if (sec) {
      // say what the change does ("... Code to establish standards for data centers") rather than list section numbers
      const code = /unified development code/i.test(ord.title) ? "Zoning code change" : "City code change";
      const purpose = ord.title.match(/\bCode(?: of the City of Cheyenne(?:, Wyoming)?)?,?\s+(?:in order\s+)?to\s+(.+)/i);
      if (purpose) {
        const what = shortTitle(purpose[1].replace(/\s*\((?:PUBLIC SERVICES|FINANCE)[^)]*\).*$/i, "").replace(/\s+ACTION:.*$/i, ""), 58).replace(/^./, (c) => c.toLowerCase());
        return `${code}: ${what}${suffix}`;
      }
      const purpose2 = ord.title.match(/Wyoming,?\s+((?:modifying|updating|revising|adding|creating|establishing|clarifying)\s.+)/i);
      if (purpose2) return `${code}: ${shortTitle(purpose2[1].replace(/\s*\((?:PUBLIC SERVICES|FINANCE)[^)]*\).*$/i, ""), 58).replace(/^./, (c) => c.toLowerCase())}${suffix}`;
      const fee = ord.title.match(/(?:the\s+)?(?:monthly\s+)?([A-Z][A-Za-z ]{3,40}?(?:Fee Schedule|user fee|fees?))\b/);
      if (fee) return `${code}: ${fee[1].replace(/\buser fee\b/, "fee").trim()}${suffix}`;
      const ttl = ord.title.match(/of Title \d+,\s+([A-Z][A-Za-z ,&-]{4,50}?),/);
      if (ttl) return `${code}: ${ttl[1].trim()}${suffix}`;
      const named = ord.title.match(/(?:Sections?|Chapters?)\s+[\d.]+\s*,?\s+([A-Z][A-Za-z ,&-]{4,50}?)(?:,| of )/);
      if (named) return `${code}: ${named[1].trim()}${suffix}`;
      return `${code}: ${sec[0].replace(/\s+/, " ")}${suffix}`;
    }
    const c = candidate(ord.title, 60);
    if (c) return `${c}${suffix}`;
  }
  const named = items.find((i) => i.kind === "resolution" && /[‘'“"]([^’'”"]{4,60})[’'”"]/.test(i.title));
  if (named) {
    const q = named.title.match(/[‘'“"]([^’'”"]{4,60})[’'”"]/);
    if (q) return `Resolution: ${q[1].replace(/[.,;:]+$/, "")}`;
  }
  const big = items.filter((i) => i.amountUsd && candidate(i.title)).sort((a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0))[0];
  if (big && (big.amountUsd ?? 0) >= 100000) return `${money(big.amountUsd ?? 0)}: ${candidate(big.title, 58)}`;
  const hearing = items.find((i) => i.kind === "hearing" && candidate(i.title));
  if (hearing) return `Public hearing: ${candidate(hearing.title, 56)}`;
  if (items.some((i) => /data center/i.test(i.title) && !PLACEHOLDER.test(i.title))) return "Data center rules";
  const real = items.filter((i) => i.kind !== "procedural" && !i.itemNo.startsWith("PKT-"));
  for (const it of [...real, ...items.filter((i) => i.itemNo.startsWith("PKT-"))]) {
    const c = candidate(it.title);
    if (c) return c;
  }
  const [y, mo, d] = m.date.split("-").map(Number);
  const when = `${MONTHS[mo - 1].slice(0, 3)} ${d}, ${y}`;
  if (m.body === "other") {
    // packet-only records: the file name tells us which committee the agenda belongs to
    for (const it of items) {
      const f = it.title.match(/—\s*([a-z]{2,3})-\d/i);
      if (f && BODY_FROM_FILE[f[1].toLowerCase()]) return `${BODY_FROM_FILE[f[1].toLowerCase()]} agenda · ${when}`;
      if (/Agenda_CHEY-/i.test(it.title)) return `City agenda · ${when}`;
    }
    return `Board or commission meeting · ${when}`;
  }
  return `${m.bodyName} meeting · ${when}`;
}

/** Only 2025+ council meetings have a measured start and end; everything else carried a per-body guess. */
function realRuntime(m: RawMeeting): number | null {
  return m.startMin != null && m.endMin != null && m.endMin > m.startMin ? m.endMin - m.startMin : null;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function loglineFor(m: RawMeeting, items: RawItem[], phase: string): string {
  const real = items.filter((i) => i.kind !== "procedural" && !/^(PKT|REC)-/.test(i.itemNo) && !PLACEHOLDER.test(i.title));
  const consent = real.filter((i) => i.consent).length;
  const ords = items.filter((i) => i.kind === "ordinance").length;
  const pkts = items.filter((i) => i.itemNo.startsWith("PKT-")).length;
  const hasZip = m.extraLinks.some((l) => l.kind === "speaker_zips");
  const bits: string[] = [`${m.bodyName} · ${prettyDate(m.date)}.`];
  const parts: string[] = [];
  if (real.length) parts.push(plural(real.length, "agenda item") + (consent ? ` (${consent} on the consent agenda)` : ""));
  if (ords) parts.push(plural(ords, "ordinance vote"));
  if (pkts) parts.push(plural(pkts, "attached document"));
  if (parts.length) bits.push(parts.join(", ").replace(/^./, (c) => c.toUpperCase()) + ".");
  if (hasZip) bits.push("Video clips of each speaker are available.");
  const rt = realRuntime(m);
  if (rt) bits.push(`Meeting length ${rt >= 60 ? `${Math.floor(rt / 60)}h ${String(rt % 60).padStart(2, "0")}m` : `${rt} min`}.`);
  if (phase === "upcoming") bits.push("Upcoming meeting.");
  return bits.join(" ");
}

export async function seedIfEmpty(force = false): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(7461001)");
    if (force) {
      await db.execute(
        sql`TRUNCATE TABLE meetings, agenda_items, ordinances, vote_events, documents, briefs, people, episode_content, speaker_turns, speakers_directory, osint_entities, provenance_catalog RESTART IDENTITY CASCADE`,
      );
    } else {
      const existing = await db.execute(sql`select count(*)::int as n from meetings`);
      const n = (existing.rows[0] as { n: number }).n;
      if (n > 0) return;
    }

    const rawMeetings = read<RawMeeting[]>("meetings.json");
    const rawItems = read<RawItem[]>("items.json");
    const featured = read<Record<string, unknown> & { slug: string; title: string; logline: string }>("featured.json");

    // episode numbering per body + season
    const groups = new Map<string, RawMeeting[]>();
    for (const m of rawMeetings) {
      const k = `${m.body}|${m.season}`;
      groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    const itemsByMeeting = new Map<string, RawItem[]>();
    for (const it of rawItems) itemsByMeeting.set(it.meeting, [...(itemsByMeeting.get(it.meeting) ?? []), it]);

    const rows: (typeof meetings.$inferInsert)[] = [];
    for (const [, arr] of groups) {
      arr.sort((a, b) => a.date.localeCompare(b.date));
      arr.forEach((m, i) => {
        const items = itemsByMeeting.get(m.slug) ?? [];
        const phase = m.date > "2026-11-24" ? "upcoming" : "aired";
        const isFeatured = m.slug === featured.slug;
        const tags: string[] = [];
        const rt = realRuntime(m);
        if (isFeatured) tags.push("Featured");
        if (m.date === "2026-11-23") tags.push("Latest meeting");
        if (i === 0) tags.push("First of the year");
        if (i === arr.length - 1 && m.season < 2026) tags.push("Last of the year");
        if (m.body === "special") tags.push("Special meeting");
        if ((rt ?? 0) >= 300) tags.push("5+ hours");
        if (rt && rt <= 45) tags.push("Short meeting");
        if (phase === "upcoming") tags.push("Upcoming");
        if (items.some((x) => x.kind === "ordinance" && (x.reading === "second" || x.reading === "third"))) tags.push("Ordinance vote");
        if (m.extraLinks.some((l) => l.kind === "speaker_zips")) tags.push("Speaker clips");
        if (m.sources.some((s) => s.startsWith("therealwindycity/cheyenne-archives"))) tags.push("Archived documents");
        rows.push({
          slug: m.slug,
          date: m.date,
          body: m.body,
          bodyName: m.bodyName,
          season: m.season,
          episodeNo: i + 1,
          seasonSize: arr.length,
          title: isFeatured ? featured.title : episodeTitle(m, items),
          logline: isFeatured ? featured.logline : loglineFor(m, items, phase),
          note: m.note,
          phase,
          featured: isFeatured,
          tags,
          eventId: m.eventId,
          clipId: m.clipId,
          agendaUrl: m.agendaUrl,
          minutesUrl: m.minutesUrl,
          videoUrl: m.videoUrl,
          mp4Url: m.mp4Url,
          videoLinkVerified: (m as { videoLinkVerified?: boolean | null }).videoLinkVerified ?? null,
          videoLinkBasis: (m as { videoLinkBasis?: string | null }).videoLinkBasis ?? null,
          hasMinutesText: m.hasMinutesText,
          sources: m.sources,
          extraLinks: m.extraLinks,
          startMin: m.startMin,
          endMin: m.endMin,
          runtimeMin: realRuntime(m),
        });
      });
    }
    for (let i = 0; i < rows.length; i += 200) await db.insert(meetings).values(rows.slice(i, i + 200));

    const idRows = await db.select({ id: meetings.id, slug: meetings.slug }).from(meetings);
    const idBySlug = new Map(idRows.map((r) => [r.slug, r.id]));

    const itemRows = rawItems
      .filter((i) => idBySlug.has(i.meeting))
      .map((i) => ({
        meetingId: idBySlug.get(i.meeting)!,
        pos: i.pos,
        itemNo: i.itemNo,
        title: i.title,
        action: i.action,
        sponsor: i.sponsor,
        consent: i.consent,
        kind: i.kind,
        reading: i.reading,
        amountUsd: i.amountUsd,
      }));
    for (let i = 0; i < itemRows.length; i += 400) await db.insert(agendaItems).values(itemRows.slice(i, i + 400));

    const ords = read<
      {
        slug: string;
        title: string;
        kind: string;
        firstDate: string;
        lastDate: string;
        sources: string[];
        readings: (typeof ordinances.$inferInsert)["readings"];
      }[]
    >("ordinances.json");
    for (let i = 0; i < ords.length; i += 100)
      await db.insert(ordinances).values(
        ords.slice(i, i + 100).map((o) => ({
          slug: o.slug,
          title: o.title,
          kind: o.kind,
          firstDate: o.firstDate,
          lastDate: o.lastDate,
          sources: o.sources,
          readings: o.readings,
        })),
      );

    const ve = read<{ meeting: string; idx: number; excerpt: string; result: string; unanimous: boolean; noNames: string[]; source: string }[]>("vote_events.json");
    const veRows = ve
      .filter((v) => idBySlug.has(v.meeting))
      .map((v) => ({ meetingId: idBySlug.get(v.meeting)!, idx: v.idx, excerpt: v.excerpt, result: v.result, unanimous: v.unanimous, noNames: v.noNames, source: v.source }));
    for (let i = 0; i < veRows.length; i += 400) await db.insert(voteEvents).values(veRows.slice(i, i + 400));

    const docs = read<
      { id: number; meeting: string; role: string; itemNo: string; title: string; url: string | null; pages: number | null; words: number | null; ocr: boolean; sha1: string | null; text: string | null }[]
    >("documents.json");
    const seenDoc = new Set<number>();
    const docRows = docs
      .filter((d) => idBySlug.has(d.meeting) && !seenDoc.has(d.id) && seenDoc.add(d.id))
      .map((d) => ({
        id: d.id,
        meetingId: idBySlug.get(d.meeting)!,
        role: d.role,
        itemNo: d.itemNo,
        title: d.title,
        url: d.url,
        pages: d.pages,
        words: d.words,
        ocr: d.ocr,
        sha1: d.sha1,
        body: d.text,
      }));
    for (let i = 0; i < docRows.length; i += 60) await db.insert(documents).values(docRows.slice(i, i + 60));

    const br = read<
      { meeting: string; itemNo: string; title: string; docId: number | null; facts: Record<string, string>; flags: { sev: string; code: string; msg: string }[]; quotes: { page: number; text: string }[] }[]
    >("briefs.json");
    const brRows = br
      .filter((b) => idBySlug.has(b.meeting))
      .map((b) => ({ meetingId: idBySlug.get(b.meeting)!, itemNo: b.itemNo, title: b.title, docId: b.docId, facts: b.facts, flags: b.flags, quotes: b.quotes }));
    for (let i = 0; i < brRows.length; i += 100) await db.insert(briefs).values(brRows.slice(i, i + 100));

    const ppl = read<{ name: string; honorific: string; role: string; lastName: string; dissents: number; meetingsPresent: number; meetings: string[] }[]>("people.json");
    for (const p of ppl)
      await db
        .insert(people)
        .values({ name: p.name, honorific: p.honorific, role: p.role, lastName: p.lastName, dissents: p.dissents, meetingsPresent: p.meetingsPresent, recent: p.meetings })
        .onConflictDoNothing();

    const fid = idBySlug.get(featured.slug);
    if (fid) await db.insert(episodeContent).values({ meetingId: fid, content: featured });

    const sTurns = read<(typeof speakerTurns.$inferInsert)[]>("speaker_turns.json");
    for (let i = 0; i < sTurns.length; i += 250) {
      await db.insert(speakerTurns).values(sTurns.slice(i, i + 250)).onConflictDoNothing();
    }

    const sDir = read<Omit<typeof speakersDirectory.$inferInsert, "id">[]>("speakers_directory.json");
    for (let i = 0; i < sDir.length; i += 100) {
      await db.insert(speakersDirectory).values(sDir.slice(i, i + 100)).onConflictDoNothing();
    }

    const osint = read<Omit<typeof osintEntities.$inferInsert, "id">[]>("osint_entities.json");
    for (let i = 0; i < osint.length; i += 50) {
      await db.insert(osintEntities).values(osint.slice(i, i + 50)).onConflictDoNothing();
    }

    const prov = read<Record<string, unknown>>("provenance_videos.json");
    await db.insert(provenanceCatalog).values({ key: "master", payload: prov }).onConflictDoNothing();
  } finally {
    await client.query("select pg_advisory_unlock(7461001)").catch(() => undefined);
    client.release();
  }
}

let seeding: Promise<void> | null = null;
export function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = seedIfEmpty().catch((e) => {
      seeding = null;
      throw e;
    });
  }
  return seeding;
}
