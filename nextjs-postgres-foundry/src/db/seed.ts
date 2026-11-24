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

function episodeTitle(m: RawMeeting, items: RawItem[]): string {
  const ord = items.find((i) => i.kind === "ordinance");
  if (ord) {
    const r = roadOf(ord.title);
    const t = ord.title.toLowerCase();
    const word = t.includes("annex") && !t.includes("zoning") ? "Annexation" : t.includes("zoning") ? "Rezoning" : "Ordinance";
    const stage = ord.reading === "first" ? "Pilot" : ord.reading === "second" ? "Act Two" : ord.reading === "third" ? "Finale" : null;
    const prefix = stage ? `${stage}: ` : "";
    if (r) return `${prefix}${word} at ${r}`;
    const sec = ord.title.match(/Section\s+([\d-]+)/i);
    if (/municipal code|city code/i.test(ord.title)) return `${prefix}Code Amendment${sec ? ` ${sec[1]}` : ""}`;
    return `${prefix}Ordinance Night`;
  }
  const named = items.find((i) => i.kind === "resolution" && /[‘'“"]([^’'”"]{4,60})[’'”"]/.test(i.title));
  if (named) {
    const q = named.title.match(/[‘'“"]([^’'”"]{4,60})[’'”"]/);
    if (q) return `The ${q[1].replace(/[.,;:]+$/, "")} Resolution`;
  }
  const big = items.filter((i) => i.amountUsd).sort((a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0))[0];
  if (big && (big.amountUsd ?? 0) >= 100000) return `The ${money(big.amountUsd ?? 0)} Question`;
  const hearing = items.find((i) => i.kind === "hearing" && i.title.length > 20);
  if (hearing) return "Public Hearing Night";
  const dataCenter = items.find((i) => /data center/i.test(i.title));
  if (dataCenter) return "The Data Center Standard";
  const pkt = items.find((i) => i.itemNo.startsWith("PKT-"));
  if (pkt) {
    const clean = pkt.title.replace(/^SUPPORTING PACKET DOCKET\s*[—–-]\s*/i, "").trim();
    if (clean.length >= 4 && clean.length <= 54) return clean;
  }
  const [y, mo, d] = m.date.split("-").map(Number);
  const label = `${MONTHS[mo - 1].slice(0, 3)} ${d}`;
  if (m.body === "special") return `Special Edition: ${label}, ${y}`;
  if (m.body === "work") return `Work Session: ${label}`;
  if (m.body === "cow") return `Committee of the Whole: ${label}`;
  if (m.body === "psc") return `Committee Cut: ${label}`;
  if (m.body === "finance") return `Appropriations: ${label}`;
  if (m.body === "planning") return `Site Plan Review: ${label}`;
  return `The ${label} Sitting`;
}

function loglineFor(m: RawMeeting, items: RawItem[], phase: string): string {
  const real = items.filter((i) => i.kind !== "procedural");
  const consent = items.filter((i) => i.consent).length;
  const ords = items.filter((i) => i.kind === "ordinance").length;
  const pkts = items.filter((i) => i.itemNo.startsWith("PKT-")).length;
  const hasZip = m.extraLinks.some((l) => l.kind === "speaker_zips");
  const bits: string[] = [`${m.bodyName} · ${prettyDate(m.date)}.`];
  if (items.length) {
    bits.push(
      `${real.length} substantive docket items${consent ? `, ${consent} on consent` : ""}${ords ? `, ${ords} ordinance readings` : ""}${pkts ? `, ${pkts} supporting packet PDFs` : ""}.`,
    );
  }
  if (hasZip) bits.push("Diarized speaker MP4 ZIPs published.");
  if (m.runtimeMin) bits.push(`Runtime ${Math.floor(m.runtimeMin / 60)}h ${String(m.runtimeMin % 60).padStart(2, "0")}m.`);
  if (phase === "upcoming") bits.push("Scheduled upcoming docket.");
  return bits.join(" ");
}

export async function seedIfEmpty(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(7461001)");
    const existing = await db.execute(sql`select count(*)::int as n from meetings`);
    const n = (existing.rows[0] as { n: number }).n;
    if (n > 0) return;

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
        if (isFeatured) tags.push("Flagship Episode");
        if (m.date === "2026-11-23") tags.push("Latest Airing");
        if (i === 0) tags.push("Season Premiere");
        if (i === arr.length - 1 && m.season < 2026) tags.push("Season Finale");
        if (m.body === "special") tags.push("Special Event");
        if ((m.runtimeMin ?? 0) >= 300) tags.push("Marathon");
        if (m.runtimeMin && m.runtimeMin <= 45) tags.push("Quickie");
        if (phase === "upcoming") tags.push("Coming Soon");
        if (items.some((x) => x.kind === "ordinance" && (x.reading === "second" || x.reading === "third"))) tags.push("Ordinance Arc");
        if (m.extraLinks.some((l) => l.kind === "speaker_zips")) tags.push("Speaker ZIPs");
        if (m.sources.some((s) => s.startsWith("therealwindycity/cheyenne-archives"))) tags.push("Foundry PDFs");
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
          hasMinutesText: m.hasMinutesText,
          sources: m.sources,
          extraLinks: m.extraLinks,
          startMin: m.startMin,
          endMin: m.endMin,
          runtimeMin: m.runtimeMin,
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
