import { notFound } from "next/navigation";
import { getOrdinance } from "@/lib/bundle";
import OrdinanceArcPlayer from "@/components/OrdinanceArcPlayer";

export const dynamic = "force-dynamic";

export default async function OrdinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getOrdinance(slug);
  if (!data) notFound();
  return (
    <OrdinanceArcPlayer
      ord={data.ord}
      episodes={data.episodes}
      speakerTurns={data.speakerTurns}
      docs={data.docs}
      votes={data.votes}
    />
  );
}
