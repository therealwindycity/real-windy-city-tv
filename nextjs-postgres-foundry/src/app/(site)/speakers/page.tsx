import { getSpeakerVault, listOrdinances, listSpeakersDirectory, querySpeakerTurns } from "@/lib/bundle";
import SpeakersVaultClient from "@/components/SpeakersVaultClient";

export const dynamic = "force-dynamic";

export default async function SpeakersPage({
  searchParams,
}: {
  searchParams: Promise<{
    speaker?: string;
    date?: string;
    ordinance?: string;
    theme?: string;
    emotion?: string;
    q?: string;
    sort?: "impact" | "newest" | "oldest";
    tab?: string;
  }>;
}) {
  const sp = await searchParams;
  const [speakers, turnsData, ords, activeVault] = await Promise.all([
    listSpeakersDirectory({ limit: 250 }),
    querySpeakerTurns({
      speakerSlug: sp.speaker,
      date: sp.date,
      ordinanceSlug: sp.ordinance,
      theme: sp.theme,
      emotion: sp.emotion,
      q: sp.q,
      sort: sp.sort ?? (sp.date || sp.ordinance ? "oldest" : "impact"),
      limit: 60,
    }),
    listOrdinances({ limit: 90 }),
    sp.speaker ? getSpeakerVault(sp.speaker) : Promise.resolve(null),
  ]);

  return (
    <SpeakersVaultClient
      speakers={speakers}
      turns={turnsData.rows}
      totalTurns={turnsData.total}
      recentDates={turnsData.recentDates}
      ordinanceOptions={ords.map((o) => ({ slug: o.slug, title: o.title, kind: o.kind }))}
      activeSpeaker={activeVault?.profile ?? null}
      filters={sp}
    />
  );
}
