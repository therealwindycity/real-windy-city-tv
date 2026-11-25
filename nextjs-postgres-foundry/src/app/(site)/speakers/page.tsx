import { getSpeakerVault, listOrdinances, listSpeakersDirectory, querySpeakerTurns } from "@/lib/bundle";
import SpeakersVaultClient from "@/components/SpeakersVaultClient";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 30;

export default async function SpeakersPage({
  searchParams,
}: {
  searchParams: Promise<{
    speaker?: string;
    date?: string;
    ordinance?: string;
    theme?: string;
    emotion?: string;
    capacity?: string;
    stance?: string;
    poe?: string;
    q?: string;
    sort?: "impact" | "newest" | "oldest";
    tab?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const [speakers, turnsData, ords, activeVault] = await Promise.all([
    listSpeakersDirectory({ limit: 250 }),
    querySpeakerTurns({
      speakerSlug: sp.speaker,
      date: sp.date,
      ordinanceSlug: sp.ordinance,
      theme: sp.theme,
      emotion: sp.emotion,
      capacity: sp.capacity,
      stance: sp.stance,
      poeOnly: sp.poe === "1",
      q: sp.q,
      sort: sp.sort ?? (sp.date || sp.ordinance ? "oldest" : "impact"),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listOrdinances({ limit: 90 }),
    sp.speaker ? getSpeakerVault(sp.speaker) : Promise.resolve(null),
  ]);

  return (
    <SpeakersVaultClient
      speakers={speakers}
      turns={turnsData.rows}
      totalTurns={turnsData.total}
      page={page}
      pageSize={PAGE_SIZE}
      recentDates={turnsData.recentDates}
      ordinanceOptions={ords.rows.map((o) => ({ slug: o.slug, title: o.title, kind: o.kind }))}
      activeSpeaker={activeVault?.profile ?? null}
      filters={sp}
    />
  );
}
