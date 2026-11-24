import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const res = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM meetings) AS meetings,
        (SELECT count(*)::int FROM agenda_items) AS agenda_items,
        (SELECT count(*)::int FROM documents) AS documents,
        (SELECT count(*)::int FROM vote_events) AS vote_events,
        (SELECT count(*)::int FROM ordinances) AS ordinances,
        (SELECT count(*)::int FROM briefs) AS briefs,
        (SELECT count(*)::int FROM people) AS people,
        (SELECT count(*)::int FROM speaker_turns) AS speaker_turns,
        (SELECT count(*)::int FROM speakers_directory) AS speakers_directory,
        (SELECT count(*)::int FROM provenance_catalog) AS provenance_catalog
    `);
    return Response.json({ ok: true, engine: "PostgreSQL 17 + Drizzle ORM", counts: res.rows[0] });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
